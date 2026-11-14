import { describe, expect, it } from "vitest";
import { checkEntrepreneur, checkInvestor, rentFormula, rentPsfYear } from "@/components/forms/form-logic";
import { AnalysisRequest } from "@/lib/contracts";

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
}

const investor = { capitalUsd: "$500,000", riskTolerance: "medium", markets: ["houston"], horizonYears: "5", strategy: "either" };
const founder = { businessConcept: "Coffee shop", sfMin: "1,500", sfMax: "2,500", rentMode: "psf", markets: ["houston", "los_angeles"] };

describe("persona forms", () => {
  it("builds a valid investor request", () => {
    const { data, errors } = checkInvestor(form({ ...investor, targetPct: "8", goals: "Steady income\nLow upkeep" }));
    expect(errors).toEqual({});
    expect(data).toMatchObject({ persona: "investor", capitalUsd: 500000, horizonYears: 5, targetAnnualReturn: 0.08, goals: ["Steady income", "Low upkeep"] });
    expect(AnalysisRequest.safeParse({ input: data }).success).toBe(true);
  });

  it("explains each invalid investor field in plain words", () => {
    const { data, errors } = checkInvestor(form({ capitalUsd: "abc", horizonYears: "40", targetPct: "150" }));
    expect(data).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(["capitalUsd", "horizonYears", "markets", "riskTolerance", "strategy", "targetAnnualReturn"]);
    expect(errors.markets).toBe("Pick at least one market.");
  });

  it("builds a valid business request with rent per square foot", () => {
    const { data, errors } = checkEntrepreneur(form({ ...founder, rentAmount: "40", mustHaves: "Parking, Street frontage" }));
    expect(errors).toEqual({});
    expect(data).toMatchObject({ sfMin: 1500, sfMax: 2500, maxRentPsfYear: 40, mustHaves: ["Parking", "Street frontage"] });
    expect(AnalysisRequest.safeParse({ input: data }).success).toBe(true);
  });

  it("converts a monthly rent budget to $/SF/yr with the largest size", () => {
    expect(rentPsfYear("monthly", 8000, 2500)).toBe(38.4);
    expect(rentFormula(8000, 2500)).toBe("$8,000 × 12 ÷ 2,500 SF = $38.4/SF/yr");
    expect(checkEntrepreneur(form({ ...founder, rentMode: "monthly", rentAmount: "8000" })).data?.maxRentPsfYear).toBe(38.4);
    expect(rentFormula(8000, undefined)).toBeNull();
    expect(rentFormula(undefined, 2500)).toBeNull();
  });

  it("leaves rent out when none is entered and rejects a backwards size range", () => {
    expect(checkEntrepreneur(form(founder)).data?.maxRentPsfYear).toBeUndefined();
    const backwards = checkEntrepreneur(form({ ...founder, sfMin: "3000" }));
    expect(backwards.data).toBeUndefined();
    expect(backwards.errors.sfMax).toBe("The largest size must be at least the smallest size.");
  });
});
