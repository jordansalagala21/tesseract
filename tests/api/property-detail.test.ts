import { existsSync } from "node:fs";
import { afterAll, describe, expect, test, vi } from "vitest";
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

  /**
   * The enrichment must never take the page down with it. AerialViewer and toTourOptions are
   * presentational, so whatever this route omits is simply not shown — but a 500 here loses the
   * CoStar facts too, which come from our own DuckDB and always answer.
   */
  test("still answers with the CoStar facts when Matterport and Vexcel are unreachable", async () => {
    const { clearModelCache } = await import("@/lib/data/matterport");
    clearModelCache();
    vi.stubEnv("MATTERPORT_API_KEY", "");
    vi.stubEnv("MATTERPORT_API_TOKEN", "");
    vi.stubEnv("VEXCEL_API_KEY", "");
    try {
      const response = await detail(new Request(`http://localhost/api/properties/${TRAVIS}`), ctx(TRAVIS));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(() => PropertyDetailResponse.parse(body)).not.toThrow();
      expect(body.matterportModels).toEqual([]);
      expect(body.aerial).toEqual([]);
      // The part that does not depend on a credential.
      expect(body.property.id).toBe(1018657);
      expect(body.currentTenants).toHaveLength(2);
      expect(body.property.matterportModelIds.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllEnvs();
      clearModelCache();
    }
  });

  test("never serializes a credential or an upstream host", async () => {
    const response = await detail(new Request(`http://localhost/api/properties/${TRAVIS}`), ctx(TRAVIS));
    const text = await response.text();
    for (const secret of ["x-api-key", "vexcelgroup.com", "api.matterport.com", "Authorization"]) {
      expect(text).not.toContain(secret);
    }
  });
});

/** Needs live credentials: these assert the enrichment is actually wired up, not just safe. */
describe.skipIf(!existsSync(dbPath) || !process.env.VEXCEL_API_KEY || !process.env.MATTERPORT_API_KEY)(
  "GET /api/properties/[id] enrichment (requires a built DuckDB and credentials)",
  () => {
    test("carries Matterport metadata and both Vexcel views", async () => {
      const response = await detail(new Request(`http://localhost/api/properties/${TRAVIS}`), ctx(TRAVIS));
      const body = await response.json();
      expect(() => PropertyDetailResponse.parse(body)).not.toThrow();

      // Suite 100 and Suite 104 are the two models CoStar links to this property.
      expect(body.matterportModels.length).toBe(body.property.matterportModelIds.length);
      for (const model of body.matterportModels) {
        expect(model.scannedAreaSf).toBeGreaterThan(0);
        expect(model.rooms.length).toBeGreaterThan(0);
      }

      // One ortho and one north oblique, each pointing at our proxy rather than at Vexcel.
      expect(body.aerial.map((a: { kind: string }) => a.kind)).toEqual(["ortho", "oblique"]);
      for (const image of body.aerial) {
        expect(image.imageUrl.startsWith("/api/imagery/vexcel/")).toBe(true);
        expect(image.attribution).toContain("Vexcel");
        expect(image.collection).not.toBe("unknown");
      }
    }, 60_000);
  },
);

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
