import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildDb } from "@/scripts/build-db";

const kitDir = process.env.COSTAR_KIT_DIR;
const describeKit = describe.skipIf(!kitDir);

let dir: string;
let tmpDbPath: string;
let connection: DuckDBConnection | undefined;
let instance: DuckDBInstance | undefined;

/**
 * Local helper: queries the temporary build directly. `queryRows` from lib/data/duckdb.ts is
 * read-only and bound to $DUCKDB_PATH, so it cannot see this build.
 */
async function rows<T>(sql: string): Promise<T[]> {
  if (!connection) {
    instance = await DuckDBInstance.create(tmpDbPath, { access_mode: "READ_ONLY" });
    connection = await instance.connect();
  }
  const reader = await connection.runAndReadAll(sql);
  return reader.getRowObjectsJS() as T[];
}

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tesseract-build-"));
  tmpDbPath = path.join(dir, "test.duckdb");
});

afterAll(() => {
  connection?.closeSync();
  instance?.closeSync();
  rmSync(dir, { recursive: true, force: true });
});

describeKit("buildDb (requires the sponsor kit)", () => {
  let result: Awaited<ReturnType<typeof buildDb>>;

  beforeAll(async () => {
    result = await buildDb({ kitDir: kitDir!, dbPath: tmpDbPath });
  }, 180_000);

  test("properties has one row per kit property", () => {
    expect(result.tables.properties).toBe(3339);
  });

  test("spaces has one row per advertised space on an Active listing", () => {
    expect(result.tables.spaces).toBe(3955);
  });

  test("multifamily is flagged, not dropped", async () => {
    const [{ n }] = await rows<{ n: number }>("SELECT count(*)::INT n FROM properties WHERE is_multifamily");
    expect(n).toBe(2765);
  });

  test("every property is geocoded", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM properties WHERE lat IS NULL OR lon IS NULL",
    );
    expect(n).toBe(0);
  });

  test("1018657 imports as the Travis St retail property", async () => {
    const [p] = await rows<Record<string, unknown>>("SELECT * FROM properties WHERE id = 1018657");
    expect(p).toMatchObject({
      city: "Houston",
      state: "TX",
      research_market_id: 14,
      property_type: "GeneralRetail",
      building_class: "A",
      retail_gla_sf: 36932,
      retail_ceiling_height_ft: 20,
      year_built: 1960,
      year_renovated: 2019,
    });
    expect(p.lat as number).toBeCloseTo(29.74587, 5);
  });

  test("1018657 has its four advertised suites with normalized NNN rents", async () => {
    const s = await rows(
      `SELECT suite, sf_max, psf_year_low, service_type, availability_status
       FROM spaces WHERE property_id = 1018657 ORDER BY suite`,
    );
    expect(s).toEqual([
      { suite: "100", sf_max: 9889, psf_year_low: 45, service_type: "TripleNet", availability_status: "advertised_available" },
      { suite: "104", sf_max: 2946, psf_year_low: 45, service_type: "TripleNet", availability_status: "advertised_available" },
      { suite: "106", sf_max: 4681, psf_year_low: 37, service_type: "TripleNet", availability_status: "advertised_available" },
      { suite: "107", sf_max: 4681, psf_year_low: 37, service_type: "TripleNet", availability_status: "advertised_available" },
    ]);
  });

  test("a rate of 0 is stored as null", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM spaces WHERE rate_low = 0 OR rate_high = 0 OR psf_year_low = 0",
    );
    expect(n).toBe(0);
  });

  test("spaces with a published rate match the verified count", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM spaces WHERE psf_year_low IS NOT NULL",
    );
    expect(n).toBe(2196);
  });

  test("a monthly rate is normalized to a yearly rate", async () => {
    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::INT n FROM spaces
       WHERE rate_basis = 'monthly' AND psf_year_low IS NOT NULL AND psf_year_low != rate_low * 12`,
    );
    expect(n).toBe(0);
  });

  test("an unknown rate basis keeps the raw rate but has no normalized rate", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM spaces WHERE rate_basis = 'unknown' AND psf_year_low IS NOT NULL",
    );
    expect(n).toBe(0);
  });

  test("availability_status admits only the two advertised values", async () => {
    const v = await rows<{ availability_status: string }>(
      "SELECT DISTINCT availability_status FROM spaces ORDER BY 1",
    );
    expect(v.map((r) => r.availability_status)).toEqual(["advertised_available", "lease_pending"]);
  });

  test("exactly the six lease-pending spaces are flagged", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM spaces WHERE availability_status = 'lease_pending'",
    );
    expect(n).toBe(6);
  });

  test("the build finishes inside the two-minute budget", () => {
    expect(result.elapsedMs).toBeLessThan(120_000);
  });
});

describe("buildDb input validation", () => {
  test("a missing kit directory fails with an actionable message", async () => {
    // path.join is platform-native, so assert the joined path rather than a POSIX-style regex.
    const expected = path.join("/no/such/kit", "data");
    await expect(buildDb({ kitDir: "/no/such/kit", dbPath: tmpDbPath })).rejects.toThrow(expected);
  });
});
