/**
 * Shared helpers for financial scenarios (AI-06). OWNER: Developer 1.
 * Pure functions only, no I/O.
 */
import type { Assumption, FinancialScenario } from "@/lib/contracts";

export const DISCLAIMER: FinancialScenario["disclaimer"] =
  "Illustrative scenario from labelled assumptions. Not a forecast, appraisal or investment advice.";

export type ScenarioOutput = FinancialScenario["output"];

export const EMPTY_OUTPUT: ScenarioOutput = {
  annualOccupancyCostUsd: null,
  monthlyOccupancyCostUsd: null,
  breakEvenMonthlyRevenueUsd: null,
  netOperatingIncomeUsd: null,
  capRatePct: null,
  cashOnCashPct: null,
  paybackYears: null,
};

/** Round money to cents and ratios to 2 decimals, so outputs are stable and readable. */
export const money = (n: number) => Math.round(n * 100) / 100;
export const pct = (n: number) => Math.round(n * 100) / 100;
export const years = (n: number) => Math.round(n * 100) / 100;

/** The numeric value of an optional assumption, or null when it was not given. */
export const valueOf = (a: Assumption | undefined): number | null => (a === undefined ? null : a.value);

/** Collects warnings and returns null for a value that cannot be used. */
export class Checks {
  readonly warnings: string[] = [];

  /** A required value that must be > 0. Returns null (with a warning) otherwise. */
  positive(a: Assumption | undefined, what: string): number | null {
    if (a === undefined) {
      this.warnings.push(`${what} was not given, so outputs that need it are left blank.`);
      return null;
    }
    if (!Number.isFinite(a.value) || a.value <= 0) {
      this.warnings.push(`${what} must be greater than zero (got ${a.value}); outputs that need it are left blank.`);
      return null;
    }
    return a.value;
  }

  /** A value that may be zero but not negative. */
  nonNegative(a: Assumption | undefined, what: string): number | null {
    if (a === undefined) {
      this.warnings.push(`${what} was not given, so outputs that need it are left blank.`);
      return null;
    }
    if (!Number.isFinite(a.value) || a.value < 0) {
      this.warnings.push(`${what} cannot be negative (got ${a.value}); outputs that need it are left blank.`);
      return null;
    }
    return a.value;
  }

  /** A percentage in [0, 100). */
  percent(a: Assumption | undefined, what: string, { allowZero = true } = {}): number | null {
    if (a === undefined) {
      this.warnings.push(`${what} was not given, so outputs that need it are left blank.`);
      return null;
    }
    const ok = Number.isFinite(a.value) && a.value < 100 && (allowZero ? a.value >= 0 : a.value > 0);
    if (!ok) {
      this.warnings.push(`${what} must be a percentage ${allowZero ? "from 0" : "above 0"} to below 100 (got ${a.value}).`);
      return null;
    }
    return a.value;
  }

  note(message: string) {
    this.warnings.push(message);
  }
}

/** Warn about every assumption that is an app default rather than user- or CoStar-sourced. */
export function defaultWarnings(input: object): string[] {
  return Object.values(input)
    .filter((a): a is Assumption => typeof a === "object" && a !== null && (a as Assumption).origin === "default")
    .map((a) => `"${a.label}" is an app default (${a.value}), not data. Replace it with your own figure.`);
}
