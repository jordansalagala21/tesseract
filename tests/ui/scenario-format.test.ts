import { describe, expect, it } from "vitest";
import { FIELDS, OUTPUTS, blankReason, buildInput, defaultDraft, formatOutput, initialDrafts, withUnit } from "@/components/analysis/scenario-format";
import { travisLeaseScenario } from "@/lib/contracts/examples/travis";

const base = travisLeaseScenario.input;
const output = (key: string) => OUTPUTS.lease.find((o) => o.key === key)!;

describe("scenario controls helpers", () => {
  it("starts from the scenario's own numbers and keeps their origins and evidence links", () => {
    const drafts = initialDrafts(base);
    expect(drafts.spaceSf.text).toBe("9889");
    expect(drafts.monthlyRevenueUsd.text).toBe("");

    const { input, errors, assumptions } = buildInput(base, drafts);
    expect(errors).toEqual({});
    expect(input).toEqual(base);
    expect(assumptions.baseRentPsfYear).toMatchObject({ origin: "costar", evidenceId: "ev_space_rent" });
  });

  it("relabels a changed CoStar number as the user's and drops its evidence link", () => {
    const { assumptions } = buildInput(base, { ...initialDrafts(base), baseRentPsfYear: { text: "$40" } });
    expect(assumptions.baseRentPsfYear).toEqual({ value: 40, origin: "user", label: "Base rent (your input)" });
    // Typing the original number back restores the CoStar label.
    expect(buildInput(base, { ...initialDrafts(base), baseRentPsfYear: { text: "45.0" } }).assumptions.baseRentPsfYear.origin).toBe("costar");
  });

  it("labels an app default as a default, but the same number typed by hand as the user's", () => {
    const drafts = initialDrafts(base);
    const viaButton = buildInput(base, { ...drafts, targetOccupancyCostRatioPct: defaultDraft("targetOccupancyCostRatioPct") });
    expect(viaButton.assumptions.targetOccupancyCostRatioPct).toMatchObject({ value: 10, origin: "default" });
    const typed = buildInput(base, { ...drafts, targetOccupancyCostRatioPct: { text: "10" } });
    expect(typed.assumptions.targetOccupancyCostRatioPct.origin).toBe("user");
  });

  it("sends nothing while a field is empty, not a number or negative", () => {
    const drafts = initialDrafts(base);
    expect(buildInput(base, { ...drafts, spaceSf: { text: "" } })).toMatchObject({ input: null, errors: { spaceSf: "Enter a number." } });
    expect(buildInput(base, { ...drafts, nnnPsfYear: { text: "abc" } }).input).toBeNull();
    expect(buildInput(base, { ...drafts, nnnPsfYear: { text: "-1" } }).errors.nnnPsfYear).toBe("This can't be negative.");
    // Optional fields may stay empty.
    expect(buildInput(base, { ...drafts, monthlyRevenueUsd: { text: " " } }).input).not.toBeNull();
  });

  it("explains a blank output by naming the inputs to add", () => {
    expect(blankReason(output("paybackYears"), base)).toBe("Add expected monthly revenue to see this.");
    const withRevenue = buildInput(base, { ...initialDrafts(base), monthlyRevenueUsd: { text: "1000" } }).input!;
    expect(blankReason(output("paybackYears"), withRevenue)).toBe("These inputs can't produce it. The notes below say why.");
  });

  it("formats money, percentages and years, and never mixes lease and buying outputs", () => {
    expect(formatOutput(563673, "usd")).toBe("$563,673");
    expect(formatOutput(-1200.4, "usd")).toBe("-$1,200");
    expect(formatOutput(5.257, "pct")).toBe("5.26%");
    expect(formatOutput(1, "years")).toBe("1 year");
    expect([withUnit("10", "pct"), withUnit("25", "years"), withUnit("4,000", "usd")]).toEqual(["10%", "25 years", "$4,000"]);
    const leaseKeys = OUTPUTS.lease.map((o) => o.key);
    expect(OUTPUTS.acquisition.some((o) => leaseKeys.includes(o.key))).toBe(false);
    expect(FIELDS.acquisition.some((f) => f.key === "baseRentPsfYear")).toBe(false);
  });
});
