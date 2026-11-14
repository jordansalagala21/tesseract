/**
 * CoStar asking-rent normalization (DATA-01).
 * OWNER: Developer 2.
 *
 * Rules, from `models/commercial-listing-summary.md` and CLAUDE.md §6:
 *  - a rate of `0` means "no rate was recorded" and becomes `null` (never 0);
 *  - `rateBasis` 1 = Monthly, 2 = Yearly. Everything is normalized to $/SF/yr;
 *  - an Unknown basis cannot be normalized, so the raw rate survives and the
 *    normalized value is `null` — we do not assume a period;
 *  - `serviceType` always travels with the rate: a TripleNet rate and a
 *    FullService rate are not comparable.
 *
 * This is the reference implementation. `scripts/build-db.ts` applies the same
 * three rules in SQL for bulk speed; its integration tests pin the aggregate result.
 */
import { z } from "zod";
import { AskingRent } from "@/lib/contracts";

export type AskingRent = z.infer<typeof AskingRent>;

/** A space's rate fields, straight off `forLeaseSummary.spaces[]`. */
export interface RawRate {
  rateLow: number | null;
  rateHigh: number | null;
  rateBasis: number | null;
  serviceType: string | null;
}

/** CoStar `RateBasis`: 1 = Monthly, 2 = Yearly, 0/absent = Unknown. */
function basisOf(rateBasis: number | null): AskingRent["basis"] {
  if (rateBasis === 1) return "monthly";
  if (rateBasis === 2) return "yearly";
  return "unknown";
}

/** A rate of 0 (or null/undefined) means no rate was recorded. */
function rawRate(value: number | null): number | null {
  return value === null || value === undefined || value === 0 ? null : value;
}

export function normalizeAskingRent(input: RawRate): AskingRent {
  const basis = basisOf(input.rateBasis);
  const low = rawRate(input.rateLow);
  const high = rawRate(input.rateHigh);
  const factor = basis === "monthly" ? 12 : basis === "yearly" ? 1 : null;
  const toPsfYear = (value: number | null) => (value === null || factor === null ? null : value * factor);

  return {
    low,
    high,
    basis,
    psfYearLow: toPsfYear(low),
    psfYearHigh: toPsfYear(high),
    serviceType: input.serviceType,
  };
}
