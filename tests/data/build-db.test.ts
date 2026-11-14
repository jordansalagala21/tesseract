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

  test("every unknown-basis space in this kit is a no-rate space", async () => {
    // The plan assumed 14 spaces had a non-zero rate with an Unknown basis. They don't: all 14
    // have rateLow = rateHigh = 0, so this table cannot exercise "raw rate kept, normalized
    // null" at all. That semantic is pinned by the unit test in tests/data/rent.test.ts.
    const [{ unknown_rows, with_raw, with_psf }] = await rows<{
      unknown_rows: number;
      with_raw: number;
      with_psf: number;
    }>(
      `SELECT count(*)::INT unknown_rows, count(rate_low)::INT with_raw, count(psf_year_low)::INT with_psf
       FROM spaces WHERE rate_basis = 'unknown'`,
    );
    expect(unknown_rows).toBe(14);
    expect(with_raw).toBe(0);
    expect(with_psf).toBe(0);
  });

  test("floor is the decoded FloorName, not the raw enum ordinal", async () => {
    // floorName is `integer (FloorName)`, a 153-member enum: 24 = FirstFloor, 23 = Ground.
    // Casting it to text put "24" on every Travis suite, which reads as the 24th storey of a
    // two-storey retail building. The agreed fixture says "FirstFloor".
    const f = await rows<{ floor: string }>(
      "SELECT DISTINCT floor FROM spaces WHERE property_id = 1018657",
    );
    expect(f.map((r) => r.floor)).toEqual(["FirstFloor"]);
  });

  test("no space exposes a bare integer as its floor", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM spaces WHERE floor IS NOT NULL AND regexp_matches(floor, '^[0-9]+$')",
    );
    expect(n).toBe(0);
  });

  test("a portfolio comp's price is never attached to one property as its own", async () => {
    // 684 comps cover several properties; fanning the comp-level price across entities would
    // publish a portfolio total as each property's sale price (CLAUDE.md §6.2).
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM comps WHERE entity_count > 1 AND sold_for_price IS NOT NULL AND allocated_price IS NULL",
    );
    expect(n).toBe(0);
  });

  test("the 485-property portfolio comp keeps its price at portfolio level only", async () => {
    const [r] = await rows<Record<string, unknown>>(
      `SELECT entity_count, sold_for_price, portfolio_sold_for_price, portfolio_type, sale_price_status
       FROM comps WHERE comp_id = 1228299 AND property_id = 129240`,
    );
    expect(r).toMatchObject({
      entity_count: 485,
      sold_for_price: null,
      portfolio_sold_for_price: 39205645000,
      portfolio_type: "BulkPortfolio",
      sale_price_status: "Confirmed",
    });
  });

  test("money is a JS number, and a portfolio total survives a cast INT could not hold", async () => {
    // getRowObjectsJS() returns BIGINT as a JS bigint, which fails z.number() and makes
    // JSON.stringify throw. $39.2B also overflows INT32, so the cast must be DOUBLE.
    const [c] = await rows<Record<string, unknown>>(
      "SELECT portfolio_sold_for_price p FROM comps WHERE comp_id = 1228299 LIMIT 1",
    );
    expect(typeof c.p).toBe("number");
    expect(c.p).toBe(39205645000);
    const [s] = await rows<Record<string, unknown>>(
      "SELECT asking_price_low a FROM sale_listings WHERE asking_price_low IS NOT NULL LIMIT 1",
    );
    expect(typeof s.a).toBe("number");
  });

  test("comps has one row per (comp, property)", async () => {
    // Some comps list the same property several times (comp 3486993 lists 5528958 nine times),
    // which would over-report counts.saleComps and skew any average over comps.
    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::INT n FROM (
         SELECT comp_id, property_id FROM comps GROUP BY ALL HAVING count(*) > 1
       )`,
    );
    expect(n).toBe(0);
  });

  test("dates are pinned to UTC so every machine builds the same date", async () => {
    // Kit timestamps are noon in a US offset (16:00/17:00Z). try_cast(TIMESTAMPTZ AS DATE) uses
    // the session timezone, so an unpinned build on a UTC+9 machine shifts every date a day.
    // This assertion cannot fail on a US-timezone machine; it guards the teammate in Asia.
    const [{ stored }] = await rows<{ stored: string }>(
      "SELECT available_on::VARCHAR stored FROM spaces WHERE id = 21053094",
    );
    expect(stored).toBe("2018-08-13");
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

  // ------------------------------------------------------------------ Task 6 tables

  test("tenants_current holds the current tenancies", () => {
    expect(result.tables.tenants_current).toBe(11179);
  });

  test("a tenancy is current when toDate is absent, not literally null", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM tenants_current WHERE to_date IS NOT NULL",
    );
    expect(n).toBe(0);
  });

  test("tenancies without a tenantLocationId survive with a null name", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM tenants_current WHERE tenant_location_id IS NULL",
    );
    expect(n).toBe(1835);
  });

  test("a tenancy whose tenantLocationId resolves to no company still survives", async () => {
    // Exactly one current tenancy points at company 25111053, which is absent from
    // company-detail. A LEFT JOIN keeps the tenancy; an INNER JOIN would silently drop it.
    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::INT n FROM tenants_current
       WHERE tenant_location_id IS NOT NULL AND tenant_name IS NULL`,
    );
    expect(n).toBe(1);
  });

  test("1018657 resolves its two current tenants", async () => {
    const t = await rows<{ tenant_name: string }>(
      "SELECT tenant_name FROM tenants_current WHERE property_id = 1018657 ORDER BY tenant_name",
    );
    expect(t.map((r) => r.tenant_name)).toEqual(["F45 Training, Inc.", "Warehouse Live"]);
  });

  test("comps keep the raw salePriceStatus wherever there is a price", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM comps WHERE sale_price_status_id IS NULL AND sold_for_price IS NOT NULL",
    );
    expect(n).toBe(0);
  });

  test("a priced comp whose status is Unknown keeps the id and decodes to a null label", async () => {
    // The raw id is what we must not lose; the decoded label is null because "Unknown" is not a
    // status we can show anyone. 132 comps have a PER-PROPERTY price with status 0: 110 whose
    // sale covered one property, plus 22 portfolio members with their own allocatedPrice.
    const [{ total, single_prop, via_allocated }] = await rows<{
      total: number;
      single_prop: number;
      via_allocated: number;
    }>(
      `SELECT count(DISTINCT comp_id)::INT total,
              count(DISTINCT CASE WHEN entity_count = 1 THEN comp_id END)::INT single_prop,
              count(DISTINCT CASE WHEN entity_count > 1 THEN comp_id END)::INT via_allocated
       FROM comps
       WHERE sold_for_price IS NOT NULL AND sale_price_status_id = 0 AND sale_price_status IS NULL`,
    );
    expect(total).toBe(132);
    expect(single_prop).toBe(110);
    expect(via_allocated).toBe(22);
  });

  test("comps is one row per (comp, property) after dropping repeated entities", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM comps WHERE property_id IS NULL",
    );
    expect(n).toBe(0);
    // 17,339 raw (comp, entity) pairs minus 29 repeats of a property inside one comp.
    expect(result.tables.comps).toBe(17310);
  });

  test("no per-property comp price is a portfolio total in disguise", async () => {
    // Before the fix, 6,252 rows carried a price over $1B and comp 1228299 put $39.2B on each
    // of 485 properties. The portfolio figure is still available, just not as one asset's price.
    const [{ per_property, portfolio }] = await rows<{ per_property: number; portfolio: number }>(
      "SELECT max(sold_for_price) per_property, max(portfolio_sold_for_price) portfolio FROM comps",
    );
    expect(per_property).toBeLessThan(1_000_000_000);
    expect(portfolio).toBe(39205645000);
  });

  test("sale_listings carry the seller's marketed cap rate and NOI", async () => {
    const [{ total, with_cap }] = await rows<{ total: number; with_cap: number }>(
      "SELECT count(*)::INT total, count(capitalization_rate)::INT with_cap FROM sale_listings",
    );
    expect(total).toBe(107);
    expect(with_cap).toBe(32);
  });

  test("matterport_models links suite 100 and 104 to their models", async () => {
    const m = await rows(
      `SELECT matched_suite, model_id, link_method FROM matterport_models
       WHERE property_id = 1018657 AND matched_suite IS NOT NULL AND link_method = 'caption_suite_match'
       ORDER BY matched_suite`,
    );
    expect(m).toEqual([
      { matched_suite: "100", model_id: "NxYn1owequw", link_method: "caption_suite_match" },
      { matched_suite: "104", model_id: "4H2JSnQ3wSj", link_method: "caption_suite_match" },
    ]);
  });

  test("a model attached twice by the kit yields one caption link, not two", async () => {
    // 1018657 lists each of its two Matterport attachments twice. Without a dedupe the UI
    // would offer the same 3D tour twice for one suite.
    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::INT n FROM (
         SELECT property_id, model_id, matched_suite, link_method, count(*) AS c
         FROM matterport_models WHERE link_method = 'caption_suite_match'
         GROUP BY ALL HAVING count(*) > 1
       )`,
    );
    expect(n).toBe(0);
  });

  test("the direct floorPlan.videoKey links are recorded with their own method", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*)::INT n FROM matterport_models WHERE link_method = 'space_floorplan_videokey'",
    );
    expect(n).toBe(20);
  });

  test("a direct link and a caption match never disagree about the model", async () => {
    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::INT n
       FROM matterport_models d
       JOIN matterport_models c
         ON c.property_id = d.property_id AND c.matched_suite = d.matched_suite
        AND c.link_method = 'caption_suite_match'
       WHERE d.link_method = 'space_floorplan_videokey' AND c.model_id != d.model_id`,
    );
    expect(n).toBe(0);
  });

  test("suite-matched 3D coverage matches the verified count", async () => {
    const [{ n }] = await rows<{ n: number }>(`
      SELECT count(DISTINCT s.id)::INT n FROM spaces s
      JOIN properties p ON p.id = s.property_id
      JOIN matterport_models m ON m.property_id = s.property_id AND m.matched_suite = s.suite_norm
      WHERE NOT p.is_multifamily AND m.link_method = 'caption_suite_match'`);
    expect(n).toBe(110);
  });
});

describe("buildDb input validation", () => {
  test("a missing kit directory fails with an actionable message", async () => {
    // path.join is platform-native, so assert the joined path rather than a POSIX-style regex.
    const expected = path.join("/no/such/kit", "data");
    await expect(buildDb({ kitDir: "/no/such/kit", dbPath: tmpDbPath })).rejects.toThrow(expected);
  });
});
