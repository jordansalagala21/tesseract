import { existsSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { afterAll, describe, expect, test } from "vitest";
import { MarketAnalysis } from "@/lib/contracts";
import { closeDb } from "@/lib/data/duckdb";
import { DISTANCE_METERS_SQL, getNearbyContext } from "@/lib/data/nearby";

const dbPath = process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
const describeDb = describe.skipIf(!existsSync(dbPath));

const TRAVIS = 1018657;

/** Direct DB reads for assertions about what the module should have filtered. */
async function rows<T>(sql: string): Promise<T[]> {
  const { queryRows } = await import("@/lib/data/duckdb");
  return queryRows<T>(sql);
}

afterAll(async () => {
  await closeDb();
});

/** The Haversine expression on its own, against a tiny in-memory table — needs no sponsor data. */
describe("DISTANCE_METERS_SQL", () => {
  test("measures known distances correctly", async () => {
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    await connection.run("CREATE TABLE p (id INT, lat DOUBLE, lon DOUBLE)");
    await connection.run(`INSERT INTO p VALUES
      (1, 29.74587, -95.375417),   -- 2600 Travis itself
      (2, 29.75487, -95.375417),   -- 0.009 deg north, about 1 km
      (3, 29.74587, -95.365417)`); // 0.010 deg east, about 0.97 km

    const reader = await connection.runAndReadAll(
      `SELECT id, ${DISTANCE_METERS_SQL} AS m FROM p ORDER BY id`,
      [29.74587, 29.74587, -95.375417] as never,
    );
    const rows = reader.getRowObjectsJS() as { id: number; m: number }[];

    expect(rows[0].m).toBeCloseTo(0, 5);
    expect(rows[1].m).toBeGreaterThan(960);
    expect(rows[1].m).toBeLessThan(1040);
    expect(rows[2].m).toBeGreaterThan(900);
    expect(rows[2].m).toBeLessThan(1000);

    connection.closeSync();
    instance.closeSync();
  });
});

describeDb("getNearbyContext (requires a built DuckDB)", () => {
  test("finds the 31 kit properties within 1 km of 2600 Travis, excluding itself", async () => {
    const context = await getNearbyContext(TRAVIS, 1000);
    expect(context.propertiesInRadius).toBe(31);
    expect(context.propertyIds).not.toContain(TRAVIS);
  });

  test("its comparable spaces exclude the subject property's own suites", async () => {
    const context = await getNearbyContext(TRAVIS, 1000);
    expect(context.comparableSpaces.count).toBeGreaterThan(0);
    expect(context.comparableSpaces.propertyIds).not.toContain(TRAVIS);
  });

  test("reports a rent range only over spaces that published a rate", async () => {
    const { comparableSpaces: cs } = await getNearbyContext(TRAVIS, 1000);
    expect(cs.withPublishedRate).toBeLessThanOrEqual(cs.count);
    if (cs.withPublishedRate > 0) {
      expect(cs.askingRentPsfYear.min).not.toBeNull();
      expect(cs.askingRentPsfYear.min!).toBeLessThanOrEqual(cs.askingRentPsfYear.median!);
      expect(cs.askingRentPsfYear.median!).toBeLessThanOrEqual(cs.askingRentPsfYear.max!);
    }
  });

  test("a radius with no published rate reports a null range, not a zero", async () => {
    const context = await getNearbyContext(TRAVIS, 1);
    expect(context.propertiesInRadius).toBe(0);
    expect(context.comparableSpaces.count).toBe(0);
    expect(context.comparableSpaces.askingRentPsfYear).toEqual({ min: null, median: null, max: null });
  });

  test("breakdowns account for every space and tenant counted", async () => {
    const context = await getNearbyContext(TRAVIS, 1000);
    const serviceTotal = context.comparableSpaces.serviceTypes.reduce((n, s) => n + s.count, 0);
    const useTotal = context.comparableSpaces.spaceUses.reduce((n, s) => n + s.count, 0);
    const industryTotal = context.nearbyTenants.byIndustry.reduce((n, s) => n + s.count, 0);
    expect(serviceTotal).toBe(context.comparableSpaces.count);
    expect(useTotal).toBe(context.comparableSpaces.count);
    expect(industryTotal).toBe(context.nearbyTenants.count);
  });

  test("excludes multifamily buildings from comparable spaces", async () => {
    // 7 of the spaces in the Travis radius sit in apartment buildings. A retail owner
    // comparing against apartment asking rents would be misled.
    const context = await getNearbyContext(TRAVIS, 1000);
    const ids = context.comparableSpaces.propertyIds;
    const [{ multifamily }] = await rows<{ multifamily: number }>(
      `SELECT count(*)::INT multifamily FROM properties
       WHERE is_multifamily AND id IN (${ids.join(",") || "-1"})`,
    );
    expect(multifamily).toBe(0);
  });

  test("groups rent by service type and space use", async () => {
    const { comparableSpaces: cs } = await getNearbyContext(TRAVIS, 1000);
    expect(cs.rentGroups.length).toBeGreaterThan(1);
    for (const group of cs.rentGroups) {
      expect(typeof group.serviceType).toBe("string");
      expect(typeof group.spaceUse).toBe("string");
      expect(group.withPublishedRate).toBeLessThanOrEqual(group.count);
      if (group.withPublishedRate > 0) {
        expect(group.askingRentPsfYear.min!).toBeLessThanOrEqual(group.askingRentPsfYear.median!);
        expect(group.askingRentPsfYear.median!).toBeLessThanOrEqual(group.askingRentPsfYear.max!);
      } else {
        expect(group.askingRentPsfYear).toEqual({ min: null, median: null, max: null });
      }
    }
  });

  test("the groups account for every comparable space", async () => {
    const { comparableSpaces: cs } = await getNearbyContext(TRAVIS, 1000);
    expect(cs.rentGroups.reduce((n, g) => n + g.count, 0)).toBe(cs.count);
    expect(cs.rentGroups.reduce((n, g) => n + g.withPublishedRate, 0)).toBe(cs.withPublishedRate);
  });

  test("shows that the only published rents near Travis are office, not retail", async () => {
    // The blended range reads $18, which looks like a comparable for Travis's $45 retail.
    // Grouped, every one of the 14 published rents is TripleNet/Office, and the retail spaces
    // publish no rate at all. "No retail evidence here" is the honest answer, and only the
    // grouping can say it.
    const { comparableSpaces: cs } = await getNearbyContext(TRAVIS, 1000);
    const rated = cs.rentGroups.filter((g) => g.withPublishedRate > 0);
    expect(rated).toHaveLength(1);
    expect(rated[0]).toMatchObject({
      serviceType: "TripleNet",
      spaceUse: "Office",
      count: 14,
      withPublishedRate: 14,
      askingRentPsfYear: { min: 18, median: 18, max: 18 },
    });

    const retail = cs.rentGroups.filter((g) => g.spaceUse === "Retail");
    expect(retail.length).toBeGreaterThan(0);
    for (const group of retail) {
      expect(group.withPublishedRate).toBe(0);
      expect(group.askingRentPsfYear).toEqual({ min: null, median: null, max: null });
    }
  });

  test("min, median and max all describe the same rate basis", async () => {
    // Previously min/median came from psf_year_low while max came from psf_year_high, so the
    // three numbers did not describe the same thing.
    const { comparableSpaces: cs } = await getNearbyContext(TRAVIS, 1000);
    const [{ low_max }] = await rows<{ low_max: number }>(
      `SELECT max(psf_year_low) low_max FROM spaces s JOIN properties p ON p.id = s.property_id
       WHERE NOT p.is_multifamily AND s.property_id IN (${cs.propertyIds.join(",") || "-1"})`,
    );
    expect(cs.askingRentPsfYear.max).toBe(low_max);
  });

  test("sale comps report how many disclosed a price", async () => {
    const { saleComps } = await getNearbyContext(TRAVIS, 1000);
    expect(saleComps.withDisclosedPrice).toBeLessThanOrEqual(saleComps.count);
  });

  test("fits the MarketAnalysis shape that AI-04 fills in", async () => {
    const context = await getNearbyContext(TRAVIS, 1000);
    const candidate = {
      propertyId: context.propertyId,
      radiusMeters: context.radiusMeters,
      comparableSpaces: {
        count: context.comparableSpaces.count,
        askingRentPsfYear: context.comparableSpaces.askingRentPsfYear,
        serviceTypes: context.comparableSpaces.serviceTypes,
        spaceUses: context.comparableSpaces.spaceUses,
      },
      nearbyTenants: context.nearbyTenants,
      saleComps: context.saleComps,
      limitations: ["Kit data only — not a market census."],
      evidenceIds: [],
    };
    expect(() => MarketAnalysis.parse(candidate)).not.toThrow();
  });

  test("an unknown subject property yields an empty context, not an error", async () => {
    const context = await getNearbyContext(999_999_999, 1000);
    expect(context.propertiesInRadius).toBe(0);
    expect(context.comparableSpaces.count).toBe(0);
  });
});
