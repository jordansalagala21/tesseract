import { existsSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { MarketAnalysis } from "@/lib/contracts";
import { POST } from "@/app/api/market/analyze/route";
import { closeDb } from "@/lib/data/duckdb";

const dbPath = process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
const post = (body: unknown) =>
  POST(new Request("http://test/api/market/analyze", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

afterAll(async () => {
  await closeDb();
});

describe("POST /api/market/analyze: validation", () => {
  it("rejects a non-JSON body", async () => {
    expect((await post("nope")).status).toBe(400);
  });
  it("rejects a radius outside the contract", async () => {
    expect((await post({ propertyId: 1018657, radiusMeters: 50 })).status).toBe(400);
  });
});

describe.skipIf(!existsSync(dbPath))("POST /api/market/analyze: 2600 Travis against the kit", () => {
  it("returns a valid MarketAnalysis with sample sizes and limitations", async () => {
    const res = await post({ propertyId: 1018657, radiusMeters: 1000 });
    expect(res.status).toBe(200);
    const a = MarketAnalysis.parse(await res.json());
    expect(a.propertyId).toBe(1018657);
    expect(a.comparableSpaces.count).toBeGreaterThan(0);
    expect(a.limitations.length).toBeGreaterThan(2);
  });

  it("reports no Retail rent range rather than borrowing office rents", async () => {
    const a = MarketAnalysis.parse(await (await post({ propertyId: 1018657, radiusMeters: 1000, spaceUse: "Retail" })).json());
    expect(a.comparableSpaces.askingRentPsfYear.median).toBeNull();
    expect(a.limitations).toContain("No nearby Retail space publishes an asking rent, so there is no Retail rent range.");
  });
});
