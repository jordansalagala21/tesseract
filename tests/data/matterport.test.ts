import { afterEach, describe, expect, test, vi } from "vitest";
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
 * Synthetic response with the SHAPE of a real one — field names, nesting and the *kinds* of
 * values verified against the live API; the values themselves are invented. No real Matterport
 * response is committed.
 *
 * Note `flags` vs `filename`: flags are render styles, not formats. An earlier version of this
 * fixture put formats in `flags`, which made a broken mapping look correct.
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
    photos: [
      { resizeUrl: "https://signed.example/photo1-web.jpg" },
      { resizeUrl: "https://signed.example/photo2-web.jpg" },
      { resizeUrl: "https://signed.example/photo3-web.jpg" },
    ],
    floorplans: [
      { url: "https://signed.example/plan.jpg", filename: "mp_floorplan_x.jpg", flags: ["photogramy"] },
      { url: "https://signed.example/plan.png", filename: "mp_floorplan_x.png", flags: ["photogramy", "alpha"] },
      { url: "https://signed.example/plan.dxf", filename: "mp_floorplan_x.dxf", flags: ["schematic"] },
    ],
  },
  publication: { published: true, url: "https://my.matterport.com/show/?m=modelAAAAAAA" },
};

const COSTAR = { propertyId: 1018657, caption: "Suite 1 - 1,000SF", matchedSuite: "1" };

/**
 * A canned GraphQL transport, so cache and selection regressions run in CI without credentials.
 * Fake credentials are stubbed too: matterportEnv() validates before any request is built, so
 * without them these tests would fail on auth instead of exercising the logic under test.
 */
function stubFetch(payload: unknown) {
  vi.stubEnv("MATTERPORT_API_KEY", "test-key-not-real");
  vi.stubEnv("MATTERPORT_API_TOKEN", "test-token-not-real");
  const spy = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  clearModelCache();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the GraphQL query", () => {
  test("only ever reads — never mutates a model", () => {
    expect(MODEL_QUERY).toMatch(/^\s*query/);
    expect(MODEL_QUERY.toLowerCase()).not.toContain("mutation");
  });

  test("asks for imperial units, since the contract is in feet", () => {
    expect(MODEL_QUERY).toContain("units: imperial");
  });

  test("asks for web-resized photos, not multi-megabyte originals", () => {
    expect(MODEL_QUERY).toContain("resizeUrl(resolution: web)");
  });

  test("asks for floorplan filenames, which is where the format actually lives", () => {
    expect(MODEL_QUERY).toContain("filename");
  });
});

describe("toMatterportModel", () => {
  test("maps a response onto the contract", () => {
    expect(() => MatterportModel.parse(toMatterportModel(RAW, COSTAR))).not.toThrow();
  });

  test("carries the identity, address and scanned area", () => {
    expect(toMatterportModel(RAW, COSTAR)).toMatchObject({
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
      photoCount: 3,
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  test("builds the public embed URL and leaks no credential or signed asset", () => {
    const model = toMatterportModel(RAW, COSTAR);
    expect(model.embedUrl).toBe("https://my.matterport.com/show/?m=modelAAAAAAA");
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("signed.example");
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

  test("reads floorplan formats from filename extensions, not from render-style flags", () => {
    // flags here are photogramy/alpha/schematic — render styles. Reading formats from them
    // would report "photogramy" as a file format.
    expect(toMatterportModel(RAW, COSTAR).floorplanFormats.sort()).toEqual(["dxf", "jpg", "png"]);
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
    expect(toMatterportModel(RAW, COSTAR).source).toMatchObject({
      system: "matterport",
      dataset: "model",
      recordId: "modelAAAAAAA",
    });
  });

  test("never presents scanned area as leasable area", () => {
    // Suite 100 scans at 8,879 SF but is advertised at 9,889 SF. The field name is the warning.
    const model = toMatterportModel(RAW, COSTAR);
    expect(Object.keys(model)).toContain("scannedAreaSf");
    expect(Object.keys(model)).not.toContain("leasableAreaSf");
  });
});

describe("metadata cache (stubbed transport)", () => {
  test("caches the API response but never the caller's CoStar association", async () => {
    const spy = stubFetch({ data: { model: RAW } });

    const first = await getMatterportModel("modelAAAAAAA", COSTAR);
    const second = await getMatterportModel("modelAAAAAAA", {
      propertyId: 353482,
      caption: "Suite I - 1,200SF",
      matchedSuite: "I",
    });

    expect(spy).toHaveBeenCalledTimes(1); // served from cache
    expect(first).toMatchObject({ propertyId: 1018657, matchedSuite: "1" });
    expect(second).toMatchObject({ propertyId: 353482, matchedSuite: "I" });
  });

  test("a cache hit still stamps this call's fetchedAt", async () => {
    stubFetch({ data: { model: RAW } });
    const first = await getMatterportModel("modelAAAAAAA", COSTAR);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await getMatterportModel("modelAAAAAAA", COSTAR);
    expect(second!.fetchedAt >= first!.fetchedAt).toBe(true);
  });

  test("a not.found GraphQL error means no such model, not a failure", async () => {
    stubFetch({
      errors: [
        {
          message: "Error fetching data (path: /model, code: not.found): Not Found",
          extensions: { code: "not.found", httpCode: 404 },
        },
      ],
    });
    await expect(getMatterportModel("notamodelid", COSTAR)).resolves.toBeNull();
  });

  test("any other GraphQL error still throws", async () => {
    stubFetch({ errors: [{ message: "Rate limited", extensions: { code: "too.many", httpCode: 429 } }] });
    await expect(getMatterportModel("modelAAAAAAA", COSTAR)).rejects.toThrow(/Rate limited/);
  });
});

describe("getModelImages selection (stubbed transport)", () => {
  test("reserves one slot for a floor plan and uses web-resized photos", async () => {
    stubFetch({ data: { model: RAW } });
    const images = await getModelImages("modelAAAAAAA", 3);
    expect(images.map((i) => i.kind)).toEqual(["photo", "photo", "floorplan"]);
    expect(images[0].url).toContain("-web.jpg");
  });

  test("never offers a DXF floor plan to vision", async () => {
    stubFetch({ data: { model: RAW } });
    const images = await getModelImages("modelAAAAAAA", 6);
    expect(images.some((i) => i.url.endsWith(".dxf"))).toBe(false);
    // 3 photos + the 2 raster plans; the DXF is dropped.
    expect(images).toHaveLength(5);
  });

  test("at a limit of 1 the slot goes to a photo", async () => {
    stubFetch({ data: { model: RAW } });
    const images = await getModelImages("modelAAAAAAA", 1);
    expect(images).toHaveLength(1);
    expect(images[0].kind).toBe("photo");
  });

  test("falls back to floor plans when a model has no photos", async () => {
    stubFetch({ data: { model: { ...RAW, assets: { photos: [], floorplans: RAW.assets!.floorplans } } } });
    const images = await getModelImages("modelAAAAAAA", 2);
    expect(images.map((i) => i.kind)).toEqual(["floorplan", "floorplan"]);
  });

  test("a non-positive limit returns nothing and makes no request", async () => {
    const spy = stubFetch({ data: { model: RAW } });
    // stubFetch also stubs credentials; the point here is that neither is consulted.
    expect(await getModelImages("modelAAAAAAA", 0)).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  test("tags each image with the asset path an observation came from", async () => {
    stubFetch({ data: { model: RAW } });
    for (const image of await getModelImages("modelAAAAAAA", 4)) {
      expect(image.source.field).toMatch(/^assets\.(photos|floorplans)\[\d+\]$/);
    }
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

  test("reports the real floorplan formats for suite 100", async () => {
    const model = await getMatterportModel("NxYn1owequw", COSTAR);
    expect(model!.floorplanFormats.sort()).toEqual(["dxf", "jpg", "png"]);
  }, 30_000);

  test("returns null for a model id that does not exist", async () => {
    expect(await getMatterportModel("notamodelid", COSTAR)).toBeNull();
  }, 30_000);

  test("getModelImages returns a floor plan alongside web-resized photos", async () => {
    const images = await getModelImages("NxYn1owequw", 6);
    expect(images).toHaveLength(6);
    expect(images.filter((i) => i.kind === "floorplan")).toHaveLength(1);
    expect(images.some((i) => i.url.endsWith(".dxf"))).toBe(false);
    for (const image of images) {
      expect(image.url).toMatch(/^https:\/\//);
      expect(image.source).toMatchObject({ system: "matterport", recordId: "NxYn1owequw" });
    }
  }, 30_000);

  test("does not cache signed URLs, which expire in about an hour", async () => {
    const first = await getModelImages("NxYn1owequw", 1);
    const second = await getModelImages("NxYn1owequw", 1);
    expect(second).not.toBe(first);
  }, 30_000);
});
