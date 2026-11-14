import { existsSync } from "node:fs";
import { afterAll, describe, expect, test } from "vitest";
import { GET } from "@/app/api/properties/route";
import { ApiError, PropertySearchResponse } from "@/lib/contracts";
import { closeDb } from "@/lib/data/duckdb";

const dbPath = process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
const describeDb = describe.skipIf(!existsSync(dbPath));

const call = (qs: string) => GET(new Request(`http://localhost:3000/api/properties${qs}`));

afterAll(async () => {
  await closeDb();
});

describe("GET /api/properties — input validation", () => {
  test("rejects an unknown market with a 400 ApiError", async () => {
    const response = await call("?market=trenton");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(() => ApiError.parse(body)).not.toThrow();
    expect(body.error.code).toBe("bad_request");
  });

  test("rejects a malformed near parameter", async () => {
    const response = await call("?near=not-a-point");
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("bad_request");
  });

  test("rejects a limit above the contract's maximum", async () => {
    expect((await call("?limit=500")).status).toBe(400);
  });

  test("names the offending field so a caller can fix the request", async () => {
    const body = await (await call("?market=trenton")).json();
    expect(JSON.stringify(body.error)).toContain("market");
  });
});

describeDb("GET /api/properties — results (requires a built DuckDB)", () => {
  test("returns 2600 Travis for the demo query", async () => {
    const response = await call("?q=travis&market=houston");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(() => PropertySearchResponse.parse(body)).not.toThrow();
    expect(body.items.map((p: { id: number }) => p.id)).toContain(1018657);
  });

  test("applies the contract defaults when no query is given", async () => {
    const body = await (await call("")).json();
    expect(body.items).toHaveLength(20); // default limit
    expect(body.total).toBe(574); // multifamily excluded by default
  });

  test("answers a plain search well under the 300 ms budget", async () => {
    const started = performance.now();
    await call("?q=travis&market=houston");
    expect(performance.now() - started).toBeLessThan(300);
  });
});

describe("GET /api/properties — database not built", () => {
  test("returns 503 with the build command, not a bare 500", async () => {
    const original = process.env.DUCKDB_PATH;
    process.env.DUCKDB_PATH = "./data/definitely-not-built.duckdb";
    const { closeDb: close } = await import("@/lib/data/duckdb");
    await close();
    try {
      const response = await call("?q=travis");
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(() => ApiError.parse(body)).not.toThrow();
      expect(body.error.message).toContain("npm run db:build");
    } finally {
      process.env.DUCKDB_PATH = original;
      await close();
    }
  });
});
