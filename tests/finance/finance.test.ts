import { describe, expect, it } from "vitest";
import { FinancialScenario, type Assumption } from "@/lib/contracts";
import { travisLeaseScenario } from "@/lib/contracts/examples/travis";
import {
  acquisitionScenario,
  annualDebtService,
  defaultAssumption,
  leaseScenario,
  runScenario,
  ACQUISITION_FORMULAS,
  LEASE_FORMULAS,
} from "@/lib/finance";
import type { AcquisitionInput } from "@/lib/finance/acquisition";
import type { LeaseInput } from "@/lib/finance/lease";

const meta = { id: "scn_test", name: "Test" };
const user = (value: number, label = "test input"): Assumption => ({ value, origin: "user", label });

const lease = (over: Partial<LeaseInput> = {}): LeaseInput => ({
  mode: "lease",
  spaceSf: user(9889),
  baseRentPsfYear: user(45),
  nnnPsfYear: user(12),
  buildOutCostUsd: user(0),
  ...over,
});

const acquisition = (over: Partial<AcquisitionInput> = {}): AcquisitionInput => ({
  mode: "acquisition",
  purchasePriceUsd: user(1_000_000),
  rentableSf: user(10_000),
  marketRentPsfYear: user(20),
  vacancyAllowancePct: user(5),
  operatingExpensePsfYear: user(6),
  capexUsd: user(0),
  equityUsd: user(300_000),
  loanInterestRatePct: user(6),
  loanAmortYears: user(25),
  ...over,
});

describe("lease scenario", () => {
  it("reproduces the Travis Suite 100 fixture: 9,889 × (45 + 12) = 563,673", () => {
    const s = leaseScenario(travisLeaseScenario.input as LeaseInput, meta);
    expect(s.output.annualOccupancyCostUsd).toBe(563_673);
    expect(s.output.monthlyOccupancyCostUsd).toBe(46_972.75);
    expect(s.output).toEqual(travisLeaseScenario.output);
    expect(() => FinancialScenario.parse(s)).not.toThrow();
  });

  it("lists the formulas it used", () => {
    const s = leaseScenario(lease(), meta);
    expect(s.formulas).toEqual([LEASE_FORMULAS.annual, LEASE_FORMULAS.monthly]);
  });

  it("computes break-even revenue from a target occupancy-cost ratio", () => {
    // monthly occupancy 46,972.75 + opex 3,027.25 = 50,000; / 10% = 500,000
    const s = leaseScenario(lease({ otherMonthlyOpexUsd: user(3027.25), targetOccupancyCostRatioPct: user(10) }), meta);
    expect(s.output.breakEvenMonthlyRevenueUsd).toBe(500_000);
    expect(s.formulas).toContain(LEASE_FORMULAS.breakEven);
  });

  it("leaves break-even blank, with a warning, when the ratio is missing", () => {
    const s = leaseScenario(lease(), meta);
    expect(s.output.breakEvenMonthlyRevenueUsd).toBeNull();
    expect(s.warnings.join(" ")).toMatch(/target occupancy-cost ratio/i);
  });

  it("computes payback from revenue, occupancy and other costs", () => {
    // profit/month = 80,000 − 46,972.75 − 13,027.25 = 20,000 → 480,000 / 240,000 = 2 years
    const s = leaseScenario(
      lease({ buildOutCostUsd: user(480_000), monthlyRevenueUsd: user(80_000), otherMonthlyOpexUsd: user(13_027.25) }),
      meta,
    );
    expect(s.output.paybackYears).toBe(2);
    expect(s.formulas).toContain(LEASE_FORMULAS.payback);
  });

  it("never invents a payback when revenue does not cover costs", () => {
    const s = leaseScenario(lease({ buildOutCostUsd: user(100_000), monthlyRevenueUsd: user(40_000) }), meta);
    expect(s.output.paybackYears).toBeNull();
    expect(s.warnings.join(" ")).toMatch(/never pays back/);
  });

  it("blanks occupancy outputs for an impossible size instead of computing nonsense", () => {
    const s = leaseScenario(lease({ spaceSf: user(0) }), meta);
    expect(s.output.annualOccupancyCostUsd).toBeNull();
    expect(s.output.monthlyOccupancyCostUsd).toBeNull();
    expect(s.warnings.join(" ")).toMatch(/Space size/);
  });

  it("never fills acquisition outputs", () => {
    const s = leaseScenario(lease({ targetOccupancyCostRatioPct: user(10), monthlyRevenueUsd: user(90_000) }), meta);
    expect(s.output.netOperatingIncomeUsd).toBeNull();
    expect(s.output.capRatePct).toBeNull();
    expect(s.output.cashOnCashPct).toBeNull();
  });

  it("flags app defaults as defaults", () => {
    const s = leaseScenario(lease({ targetOccupancyCostRatioPct: defaultAssumption("targetOccupancyCostRatioPct") }), meta);
    expect(s.output.breakEvenMonthlyRevenueUsd).toBe(469_727.5);
    expect(s.warnings.join(" ")).toMatch(/app default \(10\)/);
  });
});

describe("acquisition scenario", () => {
  it("computes NOI and cap rate", () => {
    // GPI 200,000; EGI 190,000; NOI 190,000 − 60,000 = 130,000; cap 13%
    const s = acquisitionScenario(acquisition(), meta);
    expect(s.output.netOperatingIncomeUsd).toBe(130_000);
    expect(s.output.capRatePct).toBe(13);
    expect(s.formulas).toEqual(expect.arrayContaining([ACQUISITION_FORMULAS.noi, ACQUISITION_FORMULAS.capRate]));
  });

  it("amortizes the loan like a standard mortgage table", () => {
    // $700,000 at 6% over 25 years = $4,510.11/month
    expect(annualDebtService(700_000, 6, 25) / 12).toBeCloseTo(4510.11, 2);
    expect(annualDebtService(700_000, 0, 25)).toBeCloseTo(28_000, 6);
  });

  it("computes cash-on-cash after debt service", () => {
    const s = acquisitionScenario(acquisition(), meta);
    expect(s.output.cashOnCashPct).toBe(25.29);
    expect(() => FinancialScenario.parse(s)).not.toThrow();
  });

  it("handles an all-cash purchase without needing a rate", () => {
    const s = acquisitionScenario(
      acquisition({ equityUsd: user(1_000_000), loanInterestRatePct: undefined, loanAmortYears: undefined }),
      meta,
    );
    expect(s.output.cashOnCashPct).toBe(13);
    expect(s.warnings.join(" ")).toMatch(/no loan/);
  });

  it("leaves cash-on-cash blank, with a warning, when loan terms are missing", () => {
    const s = acquisitionScenario(acquisition({ loanInterestRatePct: undefined }), meta);
    expect(s.output.netOperatingIncomeUsd).toBe(130_000);
    expect(s.output.cashOnCashPct).toBeNull();
    expect(s.warnings.join(" ")).toMatch(/interest rate/);
  });

  it("rejects an impossible vacancy allowance", () => {
    const s = acquisitionScenario(acquisition({ vacancyAllowancePct: user(120) }), meta);
    expect(s.output.netOperatingIncomeUsd).toBeNull();
    expect(s.output.capRatePct).toBeNull();
  });

  it("never fills lease outputs", () => {
    const s = acquisitionScenario(acquisition(), meta);
    expect(s.output.annualOccupancyCostUsd).toBeNull();
    expect(s.output.breakEvenMonthlyRevenueUsd).toBeNull();
    expect(s.output.paybackYears).toBeNull();
  });
});

describe("runScenario", () => {
  it("dispatches on mode and keeps the fixed disclaimer", () => {
    expect(runScenario(lease(), meta).output.annualOccupancyCostUsd).toBe(563_673);
    expect(runScenario(acquisition(), meta).output.capRatePct).toBe(13);
    expect(runScenario(lease(), meta).disclaimer).toMatch(/Not a forecast/);
  });
});
