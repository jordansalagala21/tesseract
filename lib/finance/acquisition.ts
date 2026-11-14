/**
 * Acquisition scenario (AI-06). OWNER: Developer 1.
 * For an investor buying a property. Never blended with a lease scenario.
 * Formulas: docs/MARKET_ANALYSIS.md §5.
 */
import type { FinancialScenario } from "@/lib/contracts";
import { z } from "zod";
import { AcquisitionScenarioInput } from "@/lib/contracts";
import { Checks, DISCLAIMER, EMPTY_OUTPUT, defaultWarnings, money, pct } from "./shared";

export type AcquisitionInput = z.infer<typeof AcquisitionScenarioInput>;

export const ACQUISITION_FORMULAS = {
  gpi: "GPI = rentableSf × marketRentPsfYear",
  egi: "EGI = GPI × (1 − vacancyAllowancePct / 100)",
  noi: "NOI = EGI − rentableSf × operatingExpensePsfYear",
  capRate: "capRatePct = NOI / purchasePrice × 100",
  loan: "loan = purchasePrice + capex − equity",
  debtService: "annualDebtService = 12 × loan × r / (1 − (1 + r)^−n), r = rate / 12 / 100, n = years × 12",
  cashOnCash: "cashOnCashPct = (NOI − annualDebtService) / equity × 100",
} as const;

/** Standard fully amortizing loan payment, annualized. */
export function annualDebtService(loan: number, ratePct: number, amortYears: number): number {
  const n = amortYears * 12;
  const r = ratePct / 12 / 100;
  const monthly = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
  return monthly * 12;
}

export function acquisitionScenario(input: AcquisitionInput, meta: { id: string; name: string }): FinancialScenario {
  const c = new Checks();
  const output = { ...EMPTY_OUTPUT };
  const formulas: string[] = [];

  const price = c.positive(input.purchasePriceUsd, "Purchase price ($)");
  const sf = c.positive(input.rentableSf, "Rentable area (SF)");
  const rent = c.nonNegative(input.marketRentPsfYear, "Market rent ($/SF/yr)");
  const vacancy = c.percent(input.vacancyAllowancePct, "Vacancy allowance (%)");
  const opex = c.nonNegative(input.operatingExpensePsfYear, "Operating expenses ($/SF/yr)");
  const capex = c.nonNegative(input.capexUsd, "Capital expenditure ($)");
  const equity = c.positive(input.equityUsd, "Equity ($)");

  // NOI and cap rate
  let noi: number | null = null;
  if (sf !== null && rent !== null && vacancy !== null && opex !== null) {
    const gpi = sf * rent;
    const egi = gpi * (1 - vacancy / 100);
    noi = egi - sf * opex;
    output.netOperatingIncomeUsd = money(noi);
    formulas.push(ACQUISITION_FORMULAS.gpi, ACQUISITION_FORMULAS.egi, ACQUISITION_FORMULAS.noi);
    if (price !== null) {
      output.capRatePct = pct((noi / price) * 100);
      formulas.push(ACQUISITION_FORMULAS.capRate);
    }
    if (noi < 0) c.note("Operating expenses exceed effective income, so NOI is negative.");
  }

  // Debt service and cash-on-cash
  if (noi !== null && price !== null && capex !== null && equity !== null) {
    const loan = price + capex - equity;
    let debtService: number | null = null;
    if (loan <= 0) {
      debtService = 0;
      c.note("Equity covers the full price and capex, so there is no loan and no debt service.");
    } else if (input.loanInterestRatePct === undefined || input.loanAmortYears === undefined) {
      c.note("Cash-on-cash needs a loan interest rate and amortization period, which were not both given.");
    } else {
      const rate = c.percent(input.loanInterestRatePct, "Loan interest rate (%)");
      const term = c.positive(input.loanAmortYears, "Loan amortization (years)");
      if (rate !== null && term !== null) {
        debtService = annualDebtService(loan, rate, term);
        formulas.push(ACQUISITION_FORMULAS.loan, ACQUISITION_FORMULAS.debtService);
      }
    }
    if (debtService !== null) {
      output.cashOnCashPct = pct(((noi - debtService) / equity) * 100);
      formulas.push(ACQUISITION_FORMULAS.cashOnCash);
    }
  }

  return {
    id: meta.id,
    name: meta.name,
    input,
    output,
    formulas,
    warnings: [...c.warnings, ...defaultWarnings(input)],
    disclaimer: DISCLAIMER,
  };
}
