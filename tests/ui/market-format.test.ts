import { describe, expect, it } from "vitest";
import { barRows, formatRadius, rentRange } from "@/components/analysis/market-format";

describe("market dashboard helpers", () => {
  it("formats the search radius in metric and miles", () => {
    expect(formatRadius(1500)).toBe("1.5 km (0.9 mi)");
    expect(formatRadius(800)).toBe("800 m (0.5 mi)");
  });

  it("sorts bars largest first with widths and shares of the sample", () => {
    const rows = barRows(
      [
        { label: "Office", count: 3 },
        { label: "Retail", count: 9 },
      ],
      14,
    );
    expect(rows.map((r) => r.label)).toEqual(["Retail", "Office"]);
    expect(rows[0]).toMatchObject({ widthPct: 100, sharePct: 64 });
    expect(rows[1].widthPct).toBeCloseTo(33.33, 1);
    expect(barRows([], 0)).toEqual([]);
    expect(barRows([{ label: "x", count: 0 }], 0)[0]).toMatchObject({ widthPct: 0, sharePct: 0 });
  });

  it("places the median inside the rent range and never invents a range", () => {
    expect(rentRange({ min: 28, median: 36, max: 48 })).toEqual({ min: 28, median: 36, max: 48, medianPct: 40 });
    expect(rentRange({ min: 30, median: 30, max: 30 })?.medianPct).toBe(50);
    expect(rentRange({ min: 28, median: null, max: 48 })?.medianPct).toBeNull();
    expect(rentRange({ min: null, median: null, max: null })).toBeNull();
  });
});
