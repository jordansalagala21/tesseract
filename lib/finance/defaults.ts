/**
 * Labelled default assumptions (AI-06). OWNER: Developer 1.
 *
 * These are app defaults so a scenario can be shown before the user types anything.
 * Each one is origin "default", says so in its label, and carries a rationale. None of them is
 * market data from the CoStar kit, and the scenario output warns whenever one is used.
 *
 * Deliberately NOT defaulted, because a guess would look like a fact:
 *   NNN pass-throughs, market rent, purchase price, operating expenses, interest rate,
 *   revenue and build-out cost. Those must come from the user or from CoStar.
 */
import type { Assumption } from "@/lib/contracts";

export type DefaultKey = "targetOccupancyCostRatioPct" | "vacancyAllowancePct" | "loanAmortYears";

export const DEFAULT_RATIONALE: Record<DefaultKey, string> = {
  targetOccupancyCostRatioPct:
    "Rule of thumb: many retail and food businesses aim to keep rent plus pass-throughs near 10% of sales. Varies widely by business.",
  vacancyAllowancePct: "Generic underwriting placeholder for income lost to vacancy and credit loss.",
  loanAmortYears: "Common amortization period for commercial mortgages.",
};

const VALUES: Record<DefaultKey, { value: number; label: string }> = {
  targetOccupancyCostRatioPct: { value: 10, label: "Target occupancy cost, % of revenue (app default)" },
  vacancyAllowancePct: { value: 5, label: "Vacancy and credit-loss allowance, % (app default)" },
  loanAmortYears: { value: 25, label: "Loan amortization, years (app default)" },
};

/** A labelled default assumption. */
export function defaultAssumption(key: DefaultKey): Assumption {
  return { value: VALUES[key].value, origin: "default", label: VALUES[key].label };
}
