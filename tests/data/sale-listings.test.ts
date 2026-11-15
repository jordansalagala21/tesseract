import { existsSync } from "node:fs";
import { afterAll, describe, expect, test } from "vitest";
import { closeDb, queryRows } from "@/lib/data/duckdb";
import { getSaleListings, searchSaleListings } from "@/lib/data/sale-listings";

const dbPath = process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
afterAll(async () => {
  await closeDb();
});

describe.skipIf(!existsSync(dbPath))("sale listings (requires a built DuckDB)", () => {
  test("excludes multifamily and listings under contract by default", async () => {
    const { items, total } = await searchSaleListings({ limit: 100 });
    expect(total).toBeGreaterThan(0);
    const ids = items.map((i) => i.propertyId);
    const mf = await queryRows<{ id: number }>(`SELECT id FROM properties WHERE is_multifamily AND id IN (${ids.join(",")})`);
    expect(mf).toEqual([]);
    expect(items.some((i) => i.saleStatus === "UnderContract" || i.saleStatus === "Escrow")).toBe(false);
    const all = await searchSaleListings({ includeUnavailable: true, includeMultifamily: true, limit: 100 });
    expect(all.total).toBe(107);
  });

  test("treats a 0 asking price as undisclosed, never as free", async () => {
    // 800 12th St, LA lists office units with askingPriceLow = 0.
    const units = await getSaleListings(5528958);
    expect(units.length).toBeGreaterThan(0);
    expect(units.every((u) => u.askingPriceLowUsd === null)).toBe(true);
  });

  test("filters by market and disclosed price, cheapest first", async () => {
    const { items } = await searchSaleListings({ market: "houston", maxAskingPriceUsd: 3_000_000 });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.market === "houston" && i.askingPriceLowUsd !== null && i.askingPriceLowUsd <= 3_000_000)).toBe(true);
    const prices = items.map((i) => i.askingPriceLowUsd!);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test("reports asking cap rates in percent and cites the listing", async () => {
    const { items } = await searchSaleListings({ limit: 100 });
    for (const i of items.filter((x) => x.askingCapRatePct !== null)) {
      expect(i.askingCapRatePct!).toBeGreaterThan(1);
      expect(i.askingCapRatePct!).toBeLessThan(20);
    }
    expect(items[0].source).toMatchObject({ system: "costar", dataset: "commercial-listing-summary", recordId: String(items[0].listingId) });
  });
});
