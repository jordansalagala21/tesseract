/**
 * Lease scenario (AI-06). OWNER: Developer 1.
 * For a business or owner-operator leasing a space. Never blended with acquisition.
 * Formulas: docs/MARKET_ANALYSIS.md §5.
 */
import type { FinancialScenario } from "@/lib/contracts";
import { z } from "zod";
import { LeaseScenarioInput } from "@/lib/contracts";
import { Checks, DISCLAIMER, EMPTY_OUTPUT, defaultWarnings, money, valueOf, years } from "./shared";

export type LeaseInput = z.infer<typeof LeaseScenarioInput>;

export const LEASE_FORMULAS = {
  annual: "annualOccupancyCost = spaceSf × (baseRentPsfYear + nnnPsfYear)",
  monthly: "monthlyOccupancyCost = annualOccupancyCost / 12",
  breakEven: "breakEvenMonthlyRevenue = (monthlyOccupancyCost + otherMonthlyOpex) / (targetOccupancyCostRatioPct / 100)",
  payback: "paybackYears = buildOutCost / (12 × (monthlyRevenue − monthlyOccupancyCost − otherMonthlyOpex))",
} as const;

export function leaseScenario(input: LeaseInput, meta: { id: string; name: string }): FinancialScenario {
  const c = new Checks();
  const output = { ...EMPTY_OUTPUT };
  const formulas: string[] = [];

  const sf = c.positive(input.spaceSf, "Space size (SF)");
  const rent = c.nonNegative(input.baseRentPsfYear, "Base rent ($/SF/yr)");
  const nnn = c.nonNegative(input.nnnPsfYear, "NNN pass-throughs ($/SF/yr)");

  // Occupancy cost
  let monthlyOccupancy: number | null = null;
  if (sf !== null && rent !== null && nnn !== null) {
    const annual = sf * (rent + nnn);
    monthlyOccupancy = annual / 12;
    output.annualOccupancyCostUsd = money(annual);
    output.monthlyOccupancyCostUsd = money(monthlyOccupancy);
    formulas.push(LEASE_FORMULAS.annual, LEASE_FORMULAS.monthly);
  }

  // Other operating costs are optional: treat a missing value as 0 but say so.
  let otherOpex = valueOf(input.otherMonthlyOpexUsd);
  if (otherOpex === null) {
    otherOpex = 0;
  } else if (otherOpex < 0) {
    c.note(`Other monthly operating costs cannot be negative (got ${otherOpex}); treated as 0.`);
    otherOpex = 0;
  }
  const opexGiven = input.otherMonthlyOpexUsd !== undefined && input.otherMonthlyOpexUsd.value >= 0;

  // Break-even revenue needs the target occupancy-cost ratio.
  if (input.targetOccupancyCostRatioPct === undefined) {
    c.note("Break-even revenue needs a target occupancy-cost ratio, which was not given.");
  } else {
    const ratio = c.percent(input.targetOccupancyCostRatioPct, "Target occupancy-cost ratio (%)", { allowZero: false });
    if (ratio !== null && monthlyOccupancy !== null) {
      output.breakEvenMonthlyRevenueUsd = money((monthlyOccupancy + otherOpex) / (ratio / 100));
      formulas.push(LEASE_FORMULAS.breakEven);
      if (!opexGiven) c.note("Break-even revenue counts occupancy cost only; other operating costs were not given.");
    }
  }

  // Payback needs revenue and build-out cost.
  const buildOut = c.nonNegative(input.buildOutCostUsd, "Build-out cost ($)");
  if (input.monthlyRevenueUsd === undefined) {
    c.note("Payback needs expected monthly revenue, which was not given.");
  } else if (monthlyOccupancy !== null && buildOut !== null) {
    const monthlyProfit = input.monthlyRevenueUsd.value - monthlyOccupancy - otherOpex;
    if (monthlyProfit <= 0) {
      c.note("At this revenue the space does not cover its costs, so the build-out never pays back.");
    } else {
      output.paybackYears = years(buildOut / (12 * monthlyProfit));
      formulas.push(LEASE_FORMULAS.payback);
      if (!opexGiven) c.note("Payback ignores other operating costs (staff, supplies, utilities), which were not given.");
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
