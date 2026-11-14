import { existsSync } from "node:fs";
import { afterAll, describe, expect, test } from "vitest";
import { AvailableSpace, Property } from "@/lib/contracts";
import { closeDb } from "@/lib/data/duckdb";
import { getProperty, getSpaces } from "@/lib/data/properties";
import { getCurrentTenants } from "@/lib/data/tenants";

const dbPath = process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
const describeDb = describe.skipIf(!existsSync(dbPath));

const TRAVIS = 1018657;

afterAll(async () => {
  await closeDb();
});

describeDb("getProperty (requires a built DuckDB)", () => {
  test("returns 2600 Travis and satisfies the Property contract", async () => {
    const property = await getProperty(TRAVIS);
    expect(property).not.toBeNull();
    expect(() => Property.parse(property)).not.toThrow();
  });

  test("carries the retail detail the reuse analysis depends on", async () => {
    const property = await getProperty(TRAVIS);
    expect(property).toMatchObject({
      propertyType: "GeneralRetail",
      propertySubtype: "GeneralRetail_Freestanding",
      buildingClass: "A",
      yearBuilt: 1960,
      yearRenovated: 2019,
      stories: 2,
      zoningDescription: "N/Ap Houston",
      retail: { glaSf: 36932, ceilingHeightFt: 20 },
      lot: { value: 0.98, unit: "acres" },
    });
    // Frontage drives whether a restaurant or retail conversion is plausible.
    expect(property?.retail?.frontage).toEqual([
      { street: "Travis St", feet: 203, curbCuts: 4, isPrimary: true },
    ]);
  });

  test("reports counts the UI uses to decide what to show", async () => {
    const property = await getProperty(TRAVIS);
    expect(property?.counts).toEqual({ availableSpaces: 4, currentTenants: 2, saleComps: 3 });
  });

  test("lists the Matterport model ids attached to the property", async () => {
    const property = await getProperty(TRAVIS);
    expect(property?.matterportModelIds.sort()).toEqual(["4H2JSnQ3wSj", "NxYn1owequw"]);
  });

  test("carries a SourceRef back to the CoStar record", async () => {
    const property = await getProperty(TRAVIS);
    expect(property?.source).toMatchObject({
      system: "costar",
      dataset: "commercial-property",
      recordId: String(TRAVIS),
    });
  });

  test("returns null for an unknown property", async () => {
    expect(await getProperty(999_999_999)).toBeNull();
  });
});

describeDb("getSpaces (requires a built DuckDB)", () => {
  test("returns the four advertised suites, contract-valid", async () => {
    const spaces = await getSpaces(TRAVIS);
    expect(spaces).toHaveLength(4);
    for (const space of spaces) expect(() => AvailableSpace.parse(space)).not.toThrow();
    expect(spaces.map((s) => s.suite)).toEqual(["100", "104", "106", "107"]);
  });

  test("normalizes rents to $/SF/yr and keeps the service type", async () => {
    const spaces = await getSpaces(TRAVIS);
    const suite100 = spaces.find((s) => s.suite === "100");
    expect(suite100?.askingRent).toMatchObject({
      low: 45,
      high: 45,
      basis: "yearly",
      psfYearLow: 45,
      psfYearHigh: 45,
      serviceType: "TripleNet",
    });
  });

  test("never reports a space as vacant — only advertised or lease-pending", async () => {
    const spaces = await getSpaces(TRAVIS);
    for (const space of spaces) {
      expect(["advertised_available", "lease_pending"]).toContain(space.availabilityStatus);
    }
  });

  test("links suite 100 to its model by the space's own floorPlan key", async () => {
    // Suite 100 carries BOTH signals for the same model. The direct floorPlan key is
    // unambiguous, so that is the provenance reported; the richer attachment caption is still
    // what a person reads.
    const spaces = await getSpaces(TRAVIS);
    expect(spaces.find((s) => s.suite === "100")?.matterport).toEqual({
      modelId: "NxYn1owequw",
      linkMethod: "space_floorplan_videokey",
      caption: "Suite 100 - 9,889SF",
    });
    expect(spaces.find((s) => s.suite === "104")?.matterport?.modelId).toBe("4H2JSnQ3wSj");
  });

  test("surfaces a direct link for a space with no caption match", async () => {
    // Before #53 these 20 spaces had no link at all, because the contract admitted only
    // caption matches. 239774/suite 350 is one of the 13 that no caption names.
    const spaces = await getSpaces(239774);
    expect(spaces.find((s) => s.suite === "350")?.matterport).toMatchObject({
      modelId: "dqAzgcvs42P",
      linkMethod: "space_floorplan_videokey",
    });
  });

  test("returns one row per space when a suite has two scans", async () => {
    // Property 246836 holds two different models both captioned "Suite 1950". A plain join
    // returns space 21903500 twice, which would put a duplicate space in the response.
    const spaces = await getSpaces(246836);
    const ids = spaces.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(spaces.filter((s) => s.suite === "1950")).toHaveLength(1);
  });

  test("never reports a model against a different suite", async () => {
    const spaces = await getSpaces(TRAVIS);
    for (const space of spaces) {
      if (!space.matterport) continue;
      // Every link either came from this space's own floorPlan or names this suite.
      const caption = space.matterport.caption.toLowerCase();
      const suite = (space.suite ?? "").toLowerCase();
      const namesAnotherSuite = /suite\s+([a-z0-9-]+)/.exec(caption)?.[1];
      if (namesAnotherSuite) expect(namesAnotherSuite).toBe(suite);
    }
  });

  test("leaves matterport null for a suite with no matched model", async () => {
    const spaces = await getSpaces(TRAVIS);
    expect(spaces.find((s) => s.suite === "106")?.matterport).toBeNull();
  });

  test("decodes the floor rather than exposing the enum ordinal", async () => {
    const spaces = await getSpaces(TRAVIS);
    for (const space of spaces) expect(space.floor).toBe("FirstFloor");
  });

  test("returns an empty list for a property with no advertised space", async () => {
    expect(await getSpaces(999_999_999)).toEqual([]);
  });
});

describeDb("getCurrentTenants (requires a built DuckDB)", () => {
  test("returns the building's two sitting tenants", async () => {
    const tenants = await getCurrentTenants(TRAVIS);
    expect(tenants.map((t) => t.name).sort()).toEqual(["F45 Training, Inc.", "Warehouse Live"]);
  });

  test("carries industry and suite where CoStar has them", async () => {
    const tenants = await getCurrentTenants(TRAVIS);
    const f45 = tenants.find((t) => t.name === "F45 Training, Inc.");
    expect(f45?.suite).toBe("103");
    expect(typeof f45?.industry === "string" || f45?.industry === null).toBe(true);
  });
});
