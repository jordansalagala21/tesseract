import { existsSync } from "node:fs";
import { afterAll, describe, expect, test } from "vitest";
import { PropertySearchQuery, PropertySearchResponse } from "@/lib/contracts";
import { closeDb } from "@/lib/data/duckdb";
import { searchProperties, searchTokens } from "@/lib/data/properties";

// These need the DuckDB built by `npm run db:build`, which CI has no sponsor data for.
const dbPath = process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
const describeDb = describe.skipIf(!existsSync(dbPath));

/** Query defaults come from the contract, so tests state only what they are exercising. */
const query = (overrides: Record<string, unknown> = {}) => PropertySearchQuery.parse(overrides);

afterAll(async () => {
  await closeDb();
});

describeDb("searchProperties (requires a built DuckDB)", () => {
  test("finds 2600 Travis by text and market", async () => {
    const result = await searchProperties(query({ q: "travis", market: "houston" }));
    const travis = result.items.find((p) => p.id === 1018657);
    expect(travis).toBeDefined();
    expect(travis).toMatchObject({
      market: "houston",
      propertyType: "GeneralRetail",
      address: { city: "Houston", state: "TX" },
    });
  });

  test("output satisfies the PropertySearchResponse contract", async () => {
    const result = await searchProperties(query({ q: "travis", market: "houston" }));
    expect(() => PropertySearchResponse.parse(result)).not.toThrow();
  });

  test("excludes multifamily unless asked", async () => {
    const without = await searchProperties(query({ limit: 100 }));
    const with_ = await searchProperties(query({ limit: 100, includeMultifamily: "true" }));
    expect(without.total).toBe(574); // 3,339 kit properties minus 2,765 multifamily
    expect(with_.total).toBe(3339);
  });

  test("every item reports whether a suite has a matched 3D model", async () => {
    const result = await searchProperties(query({ q: "travis", market: "houston" }));
    for (const item of result.items) {
      expect(typeof item.hasSuiteMatched3d).toBe("boolean");
      expect(typeof item.hasMatterport).toBe("boolean");
    }
    expect(result.items.find((p) => p.id === 1018657)).toMatchObject({
      hasMatterport: true,
      hasSuiteMatched3d: true,
    });
  });

  test("filters to properties that advertise space", async () => {
    const result = await searchProperties(query({ hasAvailableSpace: "true", limit: 100 }));
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) expect(item.availableSpaceCount).toBeGreaterThan(0);
  });

  test("filters by market", async () => {
    const la = await searchProperties(query({ market: "los_angeles", limit: 100 }));
    for (const item of la.items) expect(item.market).toBe("los_angeles");
  });

  test("near returns the subject property and only nearby ones", async () => {
    // 2600 Travis St, within 500 m of itself.
    const result = await searchProperties(query({ near: "29.74587,-95.375417,500", limit: 100 }));
    expect(result.items.map((p) => p.id)).toContain(1018657);
    for (const item of result.items) {
      expect(Math.abs(item.location.lat - 29.74587)).toBeLessThan(0.01);
    }
  });

  test("limit and offset page through a stable total", async () => {
    const first = await searchProperties(query({ limit: 5 }));
    const second = await searchProperties(query({ limit: 5, offset: 5 }));
    expect(first.items).toHaveLength(5);
    expect(first.total).toBe(second.total);
    expect(first.items.map((p) => p.id)).not.toEqual(second.items.map((p) => p.id));
  });

  test("a text search that matches nothing returns an empty page, not an error", async () => {
    const result = await searchProperties(query({ q: "zzzzznotarealstreet" }));
    expect(result).toEqual({ items: [], total: 0 });
  });

  describe("address matching", () => {
    // All four phrasings name the same building. An owner types whichever they have.
    test.each([
      "2600 Travis St",
      "2600 Travis Street",
      "2600 travis st, houston",
      "Travis 2600",
    ])("finds 1018657 for %j", async (q) => {
      const result = await searchProperties(query({ q, limit: 100 }));
      expect(result.items.map((p) => p.id)).toContain(1018657);
    });

    test("requires every token, so an unrelated token excludes the match", async () => {
      const result = await searchProperties(query({ q: "2600 Travis Dallas" }));
      expect(result).toEqual({ items: [], total: 0 });
    });

    test("ignores punctuation and repeated spaces", async () => {
      const result = await searchProperties(query({ q: "  2600,,  travis.  st  " }));
      expect(result.items.map((p) => p.id)).toContain(1018657);
    });

    test("treats % and _ as literal characters, not wildcards", async () => {
      expect(await searchProperties(query({ q: "%" }))).toEqual({ items: [], total: 0 });
      expect(await searchProperties(query({ q: "_" }))).toEqual({ items: [], total: 0 });
      expect(await searchProperties(query({ q: "travis%" }))).toEqual({ items: [], total: 0 });
    });

    test("does not mangle a street whose name contains a suffix word", async () => {
      // "Broadway" contains "road". Canonicalizing without word boundaries would make it
      // "Brdway" and lose both of these buildings.
      const result = await searchProperties(query({ q: "Broadway", includeMultifamily: "true", limit: 100 }));
      expect(result.items.map((p) => p.id)).toContain(249138);
    });

    test("matches a long suffix form against short-form stored data", async () => {
      const short = await searchProperties(query({ q: "3201 Broadway", includeMultifamily: "true" }));
      expect(short.items.map((p) => p.id)).toContain(249138);
    });
  });

  test("a single quote in the search text is not an injection", async () => {
    const result = await searchProperties(query({ q: "o'brien' OR 1=1 --" }));
    expect(result.total).toBe(0);
  });
});

describe("searchTokens", () => {
  test("canonicalizes suffixes and directions", () => {
    expect(searchTokens("2600 Travis Street")).toEqual(["2600", "travis", "st"]);
    expect(searchTokens("North Main Avenue")).toEqual(["n", "main", "ave"]);
  });

  test("escapes LIKE wildcards instead of dropping them", () => {
    // A template-literal slip once made this emit the literal text "${char}", which matched
    // nothing and so looked correct in a result-count test. String.raw keeps the expectation
    // honest about the single backslash we require.
    expect(searchTokens("travis%")).toEqual([String.raw`travis\%`]);
    expect(searchTokens("a_b")).toEqual([String.raw`a\_b`]);
    // A typed backslash is split out as punctuation, so it can never reach the pattern and be
    // mistaken for the ESCAPE character.
    expect(searchTokens(String.raw`back\slash`)).toEqual(["back", "slash"]);
  });

  test("splits on punctuation and collapses whitespace", () => {
    expect(searchTokens("  2600,,  travis.  st  ")).toEqual(["2600", "travis", "st"]);
  });

  test("returns no tokens for an empty or punctuation-only query", () => {
    expect(searchTokens("   ")).toEqual([]);
    expect(searchTokens("---")).toEqual([]);
  });
});
