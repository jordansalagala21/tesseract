import { afterEach, describe, expect, test } from "vitest";
import { MatterportModel } from "@/lib/contracts";
import {
  MODEL_QUERY,
  clearModelCache,
  getMatterportModel,
  getModelImages,
  toMatterportModel,
  type RawMatterportModel,
} from "@/lib/data/matterport";

const hasCreds = Boolean(process.env.MATTERPORT_API_KEY && process.env.MATTERPORT_API_TOKEN);
const describeLive = describe.skipIf(!hasCreds);

/**
 * Synthetic response with the SHAPE of a real one — field names and nesting verified against the
 * live API, values invented. No real Matterport response is committed.
 */
const RAW: RawMatterportModel = {
  id: "modelAAAAAAA",
  name: "Suite 1 - 1,000SF",
  visibility: "public",
  created: "2026-01-01T00:00:00Z",
  address: { address: "1 Example St, Houston, TX, 77000, US" },
  geocoordinates: { latitude: 29.5, longitude: -95.5 },
  dimensions: { areaFloor: 950.5 },
  floors: [
    { id: "floor1", label: "Floor 1", dimensions: { areaFloor: 950.5 } },
    { id: "floor2", label: null, dimensions: null },
  ],
  rooms: [
    { id: "roomA", classifications: [{ label: "Office", confidence: 0.9 }], dimensions: { areaFloor: 200, width: 10, depth: 20 } },
    { id: "roomVoid", classifications: [{ label: "Void", confidence: 1 }], dimensions: null },
    { id: "roomNoClass", classifications: [], dimensions: { areaFloor: 50, width: 5, depth: 10 } },
  ],
  panoLocations: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
  assets: {
    photos: [{ url: "https://signed.example/photo1.jpg" }, { url: "https://signed.example/photo2.jpg" }],
    floorplans: [{ url: "https://signed.example/plan.png", flags: ["png"] }],
  },
  publication: { published: true, url: "https://my.matterport.com/show/?m=modelAAAAAAA" },
};

const COSTAR = { propertyId: 1018657, caption: "Suite 1 - 1,000SF", matchedSuite: "1" };

afterEach(() => {
  clearModelCache();
});

describe("the GraphQL query", () => {
  test("only ever reads — never mutates a model", () => {
    expect(MODEL_QUERY).toMatch(/^\s*query/);
    expect(MODEL_QUERY.toLowerCase()).not.toContain("mutation");
  });

  test("asks for imperial units, since the contract is in feet", () => {
    expect(MODEL_QUERY).toContain("units: imperial");
  });
});

describe("toMatterportModel", () => {
  test("maps a response onto the contract", () => {
    const model = toMatterportModel(RAW, COSTAR);
    expect(() => MatterportModel.parse(model)).not.toThrow();
  });

  test("carries the identity, address and scanned area", () => {
    const model = toMatterportModel(RAW, COSTAR);
    expect(model).toMatchObject({
      id: "modelAAAAAAA",
      name: "Suite 1 - 1,000SF",
      propertyId: 1018657,
      costarCaption: "Suite 1 - 1,000SF",
      matchedSuite: "1",
      visibility: "public",
      address: "1 Example St, Houston, TX, 77000, US",
      location: { lat: 29.5, lon: -95.5 },
      scannedAreaSf: 950.5,
      panoCount: 3,
      photoCount: 2,
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  test("builds the public embed URL and leaks no credential", () => {
    const model = toMatterportModel(RAW, COSTAR);
    expect(model.embedUrl).toBe("https://my.matterport.com/show/?m=modelAAAAAAA");
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("signed.example"); // no expiring asset URLs in metadata
    expect(serialized.toLowerCase()).not.toContain("authorization");
  });

  test("keeps a Void room but leaves its dimensions null", () => {
    const { rooms } = toMatterportModel(RAW, COSTAR);
    expect(rooms).toHaveLength(3);
    expect(rooms.find((r) => r.id === "roomVoid")).toMatchObject({
      classification: "Void",
      areaSf: null,
      widthFt: null,
      depthFt: null,
    });
  });

  test("takes the highest-confidence classification, or null when there is none", () => {
    const { rooms } = toMatterportModel(RAW, COSTAR);
    expect(rooms.find((r) => r.id === "roomA")?.classification).toBe("Office");
    expect(rooms.find((r) => r.id === "roomNoClass")?.classification).toBeNull();
  });

  test("reports floorplan formats from the flags, not the signed URLs", () => {
    expect(toMatterportModel(RAW, COSTAR).floorplanFormats).toEqual(["png"]);
  });

  test("tolerates a model with no address, geo, dimensions or assets", () => {
    const sparse: RawMatterportModel = { id: "m2", name: "Bare", panoLocations: [], rooms: [], floors: [] };
    const model = toMatterportModel(sparse, { propertyId: 1, caption: null, matchedSuite: null });
    expect(() => MatterportModel.parse(model)).not.toThrow();
    expect(model).toMatchObject({
      address: null,
      location: null,
      scannedAreaSf: null,
      panoCount: 0,
      photoCount: 0,
      floorplanFormats: [],
      visibility: null,
      createdAt: null,
    });
  });

  test("records a SourceRef pointing at the Matterport model", () => {
    const { source } = toMatterportModel(RAW, COSTAR);
    expect(source).toMatchObject({ system: "matterport", dataset: "model", recordId: "modelAAAAAAA" });
  });

  test("never presents scanned area as leasable area", () => {
    // Suite 100 scans at 8,879 SF but is advertised at 9,889 SF. The field name is the warning.
    const model = toMatterportModel(RAW, COSTAR);
    expect(Object.keys(model)).toContain("scannedAreaSf");
    expect(Object.keys(model)).not.toContain("leasableAreaSf");
  });
});

describeLive("live Matterport API (needs MATTERPORT_API_KEY/TOKEN)", () => {
  test("returns a contract-valid model for suite 100's scan", async () => {
    const model = await getMatterportModel("NxYn1owequw", COSTAR);
    expect(model).not.toBeNull();
    expect(() => MatterportModel.parse(model)).not.toThrow();
    expect(model).toMatchObject({ id: "NxYn1owequw", visibility: "public" });
    expect(model!.scannedAreaSf).toBeGreaterThan(8000);
    expect(model!.rooms.length).toBeGreaterThan(0);
  }, 30_000);

  test("returns a contract-valid model for suite 104's scan", async () => {
    const model = await getMatterportModel("4H2JSnQ3wSj", {
      propertyId: 1018657,
      caption: "Suite 104 - 2,946SF",
      matchedSuite: "104",
    });
    expect(() => MatterportModel.parse(model)).not.toThrow();
  }, 30_000);

  test("caches metadata, so a second call does not refetch", async () => {
    const first = await getMatterportModel("NxYn1owequw", COSTAR);
    const second = await getMatterportModel("NxYn1owequw", COSTAR);
    expect(second).toBe(first);
  }, 30_000);

  test("returns null for a model id that does not exist", async () => {
    expect(await getMatterportModel("notamodelid", COSTAR)).toBeNull();
  }, 30_000);

  test("getModelImages returns freshly signed URLs with the SourceRef vision expects", async () => {
    const images = await getModelImages("NxYn1owequw", 3);
    expect(images.length).toBeGreaterThan(0);
    expect(images.length).toBeLessThanOrEqual(3);
    for (const image of images) {
      expect(image.url).toMatch(/^https:\/\//);
      expect(image.source).toMatchObject({ system: "matterport", recordId: "NxYn1owequw" });
      expect(image.source.field).toMatch(/^assets\.(photos|floorplans)\[\d+\]$/);
    }
  }, 30_000);

  test("does not cache signed URLs, which expire in about an hour", async () => {
    const first = await getModelImages("NxYn1owequw", 1);
    const second = await getModelImages("NxYn1owequw", 1);
    expect(second).not.toBe(first);
  }, 30_000);
});
