import { existsSync } from "node:fs";
import { afterAll, describe, expect, test } from "vitest";
import { GET } from "@/app/api/imagery/vexcel/[kind]/route";
import { ApiError } from "@/lib/contracts";
import { closeDb } from "@/lib/data/duckdb";

const dbPath = process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
const hasKey = Boolean(process.env.VEXCEL_API_KEY);
const describeDb = describe.skipIf(!existsSync(dbPath));
const describeLive = describe.skipIf(!existsSync(dbPath) || !hasKey);

const call = (kind: string, qs = "") =>
  GET(new Request(`http://localhost/api/imagery/vexcel/${kind}${qs}`), {
    params: Promise.resolve({ kind }),
  });

afterAll(async () => {
  await closeDb();
});

describe("GET /api/imagery/vexcel/[kind] — input validation", () => {
  test("rejects an unknown imagery kind", async () => {
    const response = await call("sideways", "?propertyId=1018657");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(() => ApiError.parse(body)).not.toThrow();
  });

  test("requires a propertyId", async () => {
    expect((await call("ortho")).status).toBe(400);
    expect((await call("ortho", "?propertyId=abc")).status).toBe(400);
  });

  test("rejects an unknown oblique direction", async () => {
    const response = await call("oblique", "?propertyId=1018657&direction=sideways");
    expect(response.status).toBe(400);
  });
});

describeDb("GET /api/imagery/vexcel/[kind] — property lookup", () => {
  test("an unknown property is a 404", async () => {
    const response = await call("ortho", "?propertyId=999999999");
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });
});

describeLive("GET /api/imagery/vexcel/[kind] — live proxy", () => {
  test("streams an ortho JPEG with attribution and no leaked key", async () => {
    const response = await call("ortho", "?propertyId=1018657");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    expect(response.headers.get("x-vexcel-attribution")).toContain("Vexcel");
    expect(response.headers.get("x-vexcel-collection")).toBe("us-tx-houston-2026");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));

    const headerDump = JSON.stringify([...response.headers.entries()]);
    expect(headerDump).not.toContain("vexcelgroup.com");
    expect(headerDump.toLowerCase()).not.toContain("x-api-key");
    expect(headerDump).not.toContain(process.env.VEXCEL_API_KEY!);
  }, 60_000);

  test("streams a north oblique JPEG", async () => {
    const response = await call("oblique", "?propertyId=1018657&direction=north");
    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(bytes.length).toBeGreaterThan(10_000);
  }, 60_000);
});
