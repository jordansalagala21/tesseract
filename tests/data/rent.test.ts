import { describe, expect, test } from "vitest";
import { AskingRent } from "@/lib/contracts";
import { normalizeAskingRent } from "@/lib/data/rent";

describe("normalizeAskingRent", () => {
  test("yearly rate passes through to psfYear", () => {
    const r = normalizeAskingRent({ rateLow: 45, rateHigh: 45, rateBasis: 2, serviceType: "TripleNet" });
    expect(r).toEqual({
      low: 45,
      high: 45,
      basis: "yearly",
      psfYearLow: 45,
      psfYearHigh: 45,
      serviceType: "TripleNet",
    });
  });

  test("monthly rate is multiplied by 12", () => {
    const r = normalizeAskingRent({ rateLow: 2.5, rateHigh: 3, rateBasis: 1, serviceType: "FullService" });
    expect(r.basis).toBe("monthly");
    expect(r.psfYearLow).toBe(30);
    expect(r.psfYearHigh).toBe(36);
  });

  test("rate 0 becomes null, not zero", () => {
    const r = normalizeAskingRent({ rateLow: 0, rateHigh: 0, rateBasis: 2, serviceType: "TripleNet" });
    expect(r.low).toBeNull();
    expect(r.high).toBeNull();
    expect(r.psfYearLow).toBeNull();
    expect(r.psfYearHigh).toBeNull();
  });

  test("unknown basis keeps the raw rate but cannot normalize it", () => {
    const r = normalizeAskingRent({ rateLow: 20, rateHigh: 20, rateBasis: 0, serviceType: null });
    expect(r.basis).toBe("unknown");
    expect(r.low).toBe(20);
    expect(r.psfYearLow).toBeNull();
  });

  test("serviceType is preserved verbatim", () => {
    expect(
      normalizeAskingRent({ rateLow: 1, rateHigh: 1, rateBasis: 1, serviceType: "PlusElectric" }).serviceType,
    ).toBe("PlusElectric");
  });

  test("output satisfies the AskingRent contract", () => {
    const r = normalizeAskingRent({ rateLow: 45, rateHigh: 45, rateBasis: 2, serviceType: "TripleNet" });
    expect(() => AskingRent.parse(r)).not.toThrow();
  });

  test("a null rate stays null in both raw and normalized form", () => {
    const r = normalizeAskingRent({ rateLow: null, rateHigh: null, rateBasis: 2, serviceType: "TripleNet" });
    expect(r).toEqual({
      low: null,
      high: null,
      basis: "yearly",
      psfYearLow: null,
      psfYearHigh: null,
      serviceType: "TripleNet",
    });
  });

  test("a one-sided rate normalizes only the side that has a value", () => {
    const r = normalizeAskingRent({ rateLow: 2, rateHigh: 0, rateBasis: 1, serviceType: "TripleNet" });
    expect(r.psfYearLow).toBe(24);
    expect(r.psfYearHigh).toBeNull();
  });
});
