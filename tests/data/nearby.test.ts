import { existsSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { afterAll, describe, expect, test } from "vitest";
import { MarketAnalysis } from "@/lib/contracts";
import { closeDb } from "@/lib/data/duckdb";
import { DISTANCE_METERS_SQL, getNearbyContext } from "@/lib/data/nearby";

const dbPath = process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
const describeDb = describe.skipIf(!existsSync(dbPath));

const TRAVIS = 1018657;

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
