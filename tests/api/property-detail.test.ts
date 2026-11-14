import { existsSync } from "node:fs";
import { afterAll, describe, expect, test } from "vitest";
import { GET as detail } from "@/app/api/properties/[id]/route";
import { GET as spaces } from "@/app/api/properties/[id]/spaces/route";
import { ApiError, PropertyDetailResponse, PropertySpacesResponse } from "@/lib/contracts";
import { closeDb } from "@/lib/data/duckdb";

const dbPath = process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
const describeDb = describe.skipIf(!existsSync(dbPath));

const TRAVIS = "1018657";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

afterAll(async () => {
  await closeDb();
});

describe("dynamic property routes — input validation", () => {
  test("a non-numeric id is a 400, not a 500", async () => {
    const response = await detail(new Request("http://localhost/api/properties/abc"), ctx("abc"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(() => ApiError.parse(body)).not.toThrow();
  });

  test("the spaces route rejects a non-numeric id too", async () => {
    const response = await spaces(new Request("http://localhost/api/properties/abc/spaces"), ctx("abc"));
    expect(response.status).toBe(400);
  });
});

describeDb("GET /api/properties/[id] (requires a built DuckDB)", () => {
  test("returns 2600 Travis, contract-valid", async () => {
    const response = await detail(new Request(`http://localhost/api/properties/${TRAVIS}`), ctx(TRAVIS));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(() => PropertyDetailResponse.parse(body)).not.toThrow();
    expect(body.property.id).toBe(1018657);
    expect(body.currentTenants).toHaveLength(2);
  });

  test("an unknown property is a 404 ApiError", async () => {
    const response = await detail(new Request("http://localhost/api/properties/999999999"), ctx("999999999"));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(() => ApiError.parse(body)).not.toThrow();
    expect(body.error.code).toBe("not_found");
  });
});

describeDb("GET /api/properties/[id]/spaces (requires a built DuckDB)", () => {
  test("returns the four suites with the availability note, contract-valid", async () => {
    const response = await spaces(
      new Request(`http://localhost/api/properties/${TRAVIS}/spaces`),
      ctx(TRAVIS),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(() => PropertySpacesResponse.parse(body)).not.toThrow();
    expect(body.items).toHaveLength(4);
    expect(body.availabilityNote).toBe(
      "Advertised availability from CoStar listings — not confirmed physical vacancy.",
    );
  });

  test("no space is labelled vacant", async () => {
    const response = await spaces(
      new Request(`http://localhost/api/properties/${TRAVIS}/spaces`),
      ctx(TRAVIS),
    );
    const body = await response.json();
    // The note itself says "not confirmed physical vacancy", which is the point of it; the
    // space data must never use the word at all.
    expect(JSON.stringify(body.items).toLowerCase()).not.toContain("vacan");
  });

  test("an unknown property is a 404, distinct from a property with no space", async () => {
    const response = await spaces(
      new Request("http://localhost/api/properties/999999999/spaces"),
      ctx("999999999"),
    );
    expect(response.status).toBe(404);
  });
});
