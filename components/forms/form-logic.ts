// Turns the raw form fields into contract inputs and validates them with the contract schemas.
import type { z } from "zod";
import { EntrepreneurInput, InvestorInput } from "@/lib/contracts";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
/** "" → undefined (not entered); "$500,000" → 500000; "abc" → NaN (fails validation). */
const num = (fd: FormData, key: string) => {
  const t = text(fd, key).replace(/[$,%\s]/g, "");
  return t === "" ? undefined : Number(t);
};
const list = (fd: FormData, key: string) =>
  text(fd, key)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

const usd = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * Rent budget as $/SF/yr. A monthly total is converted with the largest size entered:
 * monthly × 12 ÷ SF. That is the cap every space in the size range can meet.
 */
export function rentPsfYear(mode: string, amount: number | undefined, sfMax: number | undefined): number | undefined {
  if (amount == null || Number.isNaN(amount) || mode !== "monthly") return amount;
  if (!sfMax || Number.isNaN(sfMax) || sfMax <= 0) return undefined;
  return Math.round(((amount * 12) / sfMax) * 100) / 100;
}

/** The conversion written out for the user, or null when there is nothing to convert yet. */
export function rentFormula(amount: number | undefined, sfMax: number | undefined): string | null {
  const psf = rentPsfYear("monthly", amount, sfMax);
  if (psf == null || Number.isNaN(psf) || amount == null || !sfMax || amount <= 0) return null;
  return `$${usd.format(amount)} × 12 ÷ ${usd.format(sfMax)} SF = $${usd.format(psf)}/SF/yr`;
}

type Errors = Record<string, string>;
export type Checked<T> = { data?: T; errors: Errors };

function validate<S extends z.ZodType>(schema: S, candidate: unknown, messages: Errors): Checked<z.infer<S>> {
  const result = schema.safeParse(candidate);
  const errors: Errors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= messages[key] ?? issue.message;
    }
  }
  return { data: result.success ? result.data : undefined, errors };
}

const MARKETS = "Pick at least one market.";

export function checkInvestor(fd: FormData): Checked<z.infer<typeof InvestorInput>> {
  const pct = num(fd, "targetPct");
  return validate(
    InvestorInput,
    {
      persona: "investor",
      capitalUsd: num(fd, "capitalUsd"),
      riskTolerance: text(fd, "riskTolerance") || undefined,
      markets: fd.getAll("markets"),
      horizonYears: num(fd, "horizonYears"),
      strategy: text(fd, "strategy") || undefined,
      targetAnnualReturn: pct == null ? undefined : pct / 100,
      goals: list(fd, "goals"),
    },
    {
      capitalUsd: "Enter your capital in dollars, above zero.",
      riskTolerance: "Pick a risk level.",
      markets: MARKETS,
      horizonYears: "Enter a whole number of years, from 1 to 30.",
      strategy: "Pick lease, buy or either.",
      targetAnnualReturn: "Enter a percentage from 0 to 100, or leave it blank.",
    },
  );
}

export function checkEntrepreneur(fd: FormData): Checked<z.infer<typeof EntrepreneurInput>> {
  const sfMin = num(fd, "sfMin");
  const sfMax = num(fd, "sfMax");
  const checked = validate(
    EntrepreneurInput,
    {
      persona: "entrepreneur",
      businessConcept: text(fd, "businessConcept"),
      sfMin,
      sfMax,
      maxRentPsfYear: rentPsfYear(text(fd, "rentMode"), num(fd, "rentAmount"), sfMax),
      markets: fd.getAll("markets"),
      mustHaves: list(fd, "mustHaves"),
    },
    {
      businessConcept: "Describe the business in a few words.",
      sfMin: "Enter the smallest size in square feet.",
      sfMax: "Enter the largest size in square feet.",
      maxRentPsfYear: "Enter a rent above zero, or leave it blank.",
      markets: MARKETS,
    },
  );
  // Not in the contract, but a range that runs backwards can never match a space.
  if (sfMin != null && sfMax != null && sfMin > sfMax) {
    return { errors: { ...checked.errors, sfMax: "The largest size must be at least the smallest size." } };
  }
  return checked;
}
