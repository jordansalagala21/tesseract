// Pure helpers for the financial scenario controls (UI-10): which inputs and outputs each mode
// has, how typed text becomes labelled assumptions, and why an output is blank.
// The maths lives in lib/finance (Dev 1) behind POST /api/finance/scenario; nothing is computed here.
import { FinancialScenarioInput, type Assumption, type FinancialScenario } from "@/lib/contracts";
import { defaultAssumption, type DefaultKey } from "@/lib/finance/defaults";

type Mode = FinancialScenarioInput["mode"];
type Unit = "usd" | "sf" | "psf" | "pct" | "years";

export type FieldSpec = { key: string; label: string; unit: Unit; optional?: boolean; hint?: string; defaultKey?: DefaultKey };
export type OutputSpec = { key: keyof FinancialScenario["output"]; label: string; unit: Unit; needs: string[] };
/** What is typed in one input. fromDefault is true only when the app default button filled it. */
export type Draft = { text: string; fromDefault?: boolean };
export type Drafts = Record<string, Draft>;

export const UNITS: Record<Unit, string> = { usd: "$", sf: "SF", psf: "$/SF/yr", pct: "%", years: "years" };

/** A typed number with its unit, the way people write it: "$4,000", "10%", "25 years". */
export const withUnit = (text: string, unit: Unit) =>
  unit === "usd" ? `$${text}` : unit === "pct" ? `${text}%` : `${text} ${UNITS[unit]}`;

export const MODES: Record<Mode, string> = { lease: "Leasing", acquisition: "Buying" };

export const ORIGINS: Record<Assumption["origin"], { label: string; variant: "accent" | "neutral" | "warning" }> = {
  costar: { label: "CoStar", variant: "accent" },
  user: { label: "You", variant: "neutral" },
  default: { label: "Default", variant: "warning" },
};

export const FIELDS: Record<Mode, FieldSpec[]> = {
  lease: [
    { key: "spaceSf", label: "Space size", unit: "sf" },
    { key: "baseRentPsfYear", label: "Base rent", unit: "psf" },
    { key: "nnnPsfYear", label: "Pass-through costs", unit: "psf", hint: "Taxes, insurance and upkeep. Listings don't publish this, so ask the broker." },
    { key: "buildOutCostUsd", label: "Build-out cost", unit: "usd" },
    { key: "monthlyRevenueUsd", label: "Expected monthly revenue", unit: "usd", optional: true },
    { key: "otherMonthlyOpexUsd", label: "Other monthly costs", unit: "usd", optional: true, hint: "Staff, supplies and utilities." },
    { key: "targetOccupancyCostRatioPct", label: "Share of revenue you can spend on rent", unit: "pct", optional: true, defaultKey: "targetOccupancyCostRatioPct" },
  ],
  acquisition: [
    { key: "purchasePriceUsd", label: "Purchase price", unit: "usd" },
    { key: "rentableSf", label: "Rentable area", unit: "sf" },
    { key: "marketRentPsfYear", label: "Market rent", unit: "psf" },
    { key: "vacancyAllowancePct", label: "Vacancy allowance", unit: "pct", defaultKey: "vacancyAllowancePct" },
    { key: "operatingExpensePsfYear", label: "Operating expenses", unit: "psf" },
    { key: "capexUsd", label: "Upfront improvements", unit: "usd" },
    { key: "equityUsd", label: "Cash you put in", unit: "usd" },
    { key: "loanInterestRatePct", label: "Loan interest rate", unit: "pct", optional: true },
    { key: "loanAmortYears", label: "Loan length", unit: "years", optional: true, defaultKey: "loanAmortYears" },
  ],
};

// Lease and acquisition outputs are never shown together (CLAUDE.md §6.5).
export const OUTPUTS: Record<Mode, OutputSpec[]> = {
  lease: [
    { key: "monthlyOccupancyCostUsd", label: "Rent and pass-throughs per month", unit: "usd", needs: [] },
    { key: "annualOccupancyCostUsd", label: "Rent and pass-throughs per year", unit: "usd", needs: [] },
    { key: "breakEvenMonthlyRevenueUsd", label: "Monthly revenue needed to sustain that", unit: "usd", needs: ["targetOccupancyCostRatioPct"] },
    { key: "paybackYears", label: "Time to earn back the build-out", unit: "years", needs: ["monthlyRevenueUsd"] },
  ],
  acquisition: [
    { key: "netOperatingIncomeUsd", label: "Net operating income per year", unit: "usd", needs: [] },
    { key: "capRatePct", label: "Cap rate", unit: "pct", needs: [] },
    { key: "cashOnCashPct", label: "Cash-on-cash return", unit: "pct", needs: ["loanInterestRatePct", "loanAmortYears"] },
  ],
};

const assumptionsOf = (input: FinancialScenarioInput) => input as unknown as Record<string, Assumption | undefined>;

export function initialDrafts(input: FinancialScenarioInput): Drafts {
  const given = assumptionsOf(input);
  return Object.fromEntries(
    FIELDS[input.mode].map((f) => [f.key, { text: given[f.key] ? String(given[f.key]!.value) : "", fromDefault: given[f.key]?.origin === "default" }]),
  );
}

/** The app default for a field, as a draft. Only fields lib/finance gives a labelled default for. */
export const defaultDraft = (key: DefaultKey): Draft => ({ text: String(defaultAssumption(key).value), fromDefault: true });

/**
 * Turn what is typed into labelled assumptions. A value left as it came keeps its origin and
 * evidence link; a changed value becomes origin "user"; an app default stays origin "default".
 * `input` is null while any field has an error, so nothing invalid is sent.
 */
export function buildInput(base: FinancialScenarioInput, drafts: Drafts) {
  const given = assumptionsOf(base);
  const assumptions: Record<string, Assumption> = {};
  const errors: Record<string, string> = {};

  for (const f of FIELDS[base.mode]) {
    const draft = drafts[f.key] ?? { text: "" };
    const text = draft.text.replace(/[$,\s]/g, "");
    if (text === "") {
      if (!f.optional) errors[f.key] = "Enter a number.";
      continue;
    }
    const value = Number(text);
    if (!Number.isFinite(value)) errors[f.key] = "Enter a number, for example 12.5.";
    else if (value < 0) errors[f.key] = "This can't be negative.";
    else if (given[f.key]?.value === value) assumptions[f.key] = given[f.key]!;
    else if (draft.fromDefault && f.defaultKey) assumptions[f.key] = defaultAssumption(f.defaultKey);
    else assumptions[f.key] = { value, origin: "user", label: `${f.label} (your input)` };
  }

  const parsed = Object.keys(errors).length ? null : FinancialScenarioInput.safeParse({ mode: base.mode, ...assumptions });
  return { assumptions, errors, input: parsed?.success ? parsed.data : null };
}

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const twoDp = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatOutput(value: number, unit: Unit): string {
  if (unit === "usd") return value < 0 ? `-$${whole.format(-value)}` : `$${whole.format(value)}`;
  if (unit === "pct") return `${twoDp.format(value)}%`;
  if (unit === "years") return `${twoDp.format(value)} ${value === 1 ? "year" : "years"}`;
  return `${twoDp.format(value)} ${UNITS[unit]}`;
}

/** One plain sentence on why an output is blank: name the inputs to add, or point at the notes. */
export function blankReason(spec: OutputSpec, input: FinancialScenarioInput): string {
  const given = assumptionsOf(input);
  const missing = spec.needs.filter((k) => !given[k]).map((k) => FIELDS[input.mode].find((f) => f.key === k)!.label.toLowerCase());
  return missing.length ? `Add ${missing.join(" and ")} to see this.` : "These inputs can't produce it. The notes below say why.";
}
