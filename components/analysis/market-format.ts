import type { MarketAnalysis } from "@/lib/contracts";

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 1500 → "1.5 km (0.9 mi)"; 800 → "800 m (0.5 mi)". */
export function formatRadius(meters: number): string {
  const metric = meters >= 1000 ? `${num.format(Math.round(meters / 100) / 10)} km` : `${num.format(meters)} m`;
  return `${metric} (${(meters / 1609.344).toFixed(1)} mi)`;
}

export type BarRow = { label: string; count: number; widthPct: number; sharePct: number };

/**
 * Rows for a bar list, largest first. Width is relative to the largest count; share is relative
 * to the given total (the section's sample size), so the chart can say "9 of 14".
 */
export function barRows(items: { label: string; count: number }[], total: number): BarRow[] {
  const max = Math.max(0, ...items.map((i) => i.count));
  return [...items]
    .sort((a, b) => b.count - a.count)
    .map((i) => ({
      label: i.label,
      count: i.count,
      widthPct: max > 0 ? (i.count / max) * 100 : 0,
      sharePct: total > 0 ? Math.round((i.count / total) * 100) : 0,
    }));
}

export type RentRange = { min: number; median: number | null; max: number; medianPct: number | null };

/** The asking-rent range for drawing, or null when no rates were published (never a made-up range). */
export function rentRange(r: MarketAnalysis["comparableSpaces"]["askingRentPsfYear"]): RentRange | null {
  if (r.min == null || r.max == null) return null;
  const span = r.max - r.min;
  const medianPct = r.median == null ? null : span > 0 ? Math.min(100, Math.max(0, ((r.median - r.min) / span) * 100)) : 50;
  return { min: r.min, median: r.median, max: r.max, medianPct };
}

export const money = (n: number) => `$${num.format(n)}`;
