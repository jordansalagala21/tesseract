import { describe, expect, it } from "vitest";
import { Opportunity } from "@/lib/contracts";
import { travisAnalysisFixture } from "@/lib/contracts/examples/travis";
import {
  DEFAULT_WEIGHTS,
  normalizeWeights,
  scoreUse,
  sizeFitScore,
  verdictFor,
  type SiteFacts,
} from "@/lib/market/scoring";
import { USES, USE_CATEGORIES } from "@/lib/market/uses";

const fact = <T,>(value: T, evidenceId = `ev_${String(value)}`) => ({ value, evidenceId });

/** 2600 Travis St, Suite 100, as the CoStar kit records it. */
const travis: SiteFacts = {
  spaceSf: fact(9889, "ev_space_sf"),
  ceilingFt: fact(20, "ev_ceiling"),
  isGroundFloor: fact(true, "ev_floor"),
  frontageFt: fact(203, "ev_frontage"),
  curbCuts: fact(4, "ev_curb_cuts"),
  askingRentPsfYear: fact(45, "ev_space_rent"),
  serviceType: fact("TripleNet", "ev_service"),
};

describe("sizeFitScore", () => {
  const sf = USES.cafe.sf; // 600 / 1,000–2,500 / 4,500
  it.each([
    [1500, 100],
    [1000, 100],
    [2500, 100],
    [800, 80], // halfway from min to idealMin: 60 → 100
    [3500, 80], // halfway from idealMax to max: 100 → 60
    [300, 20], // half of min → 40 × 0.5
  ])("%i SF → %i", (n, expected) => expect(Math.round(sizeFitScore(n, sf))).toBe(expected));
  it("never goes negative for huge spaces", () => expect(sizeFitScore(1_000_000, sf)).toBeGreaterThanOrEqual(0));
});

describe("null components are never treated as 0", () => {
  it("leaves physical null without a size, even when other facts exist", () => {
    const r = scoreUse({ use: "cafe", site: { ceilingFt: fact(12), isGroundFloor: fact(true) } });
    expect(r.scores.physical.score).toBeNull();
    expect(r.scores.physical.rationale).toMatch(/Insufficient evidence/);
  });

  it("leaves economic null without a rent", () => {
    const { askingRentPsfYear: _omit, ...noRent } = travis;
    void _omit;
    expect(scoreUse({ use: "cafe", site: noRent }).scores.economic.score).toBeNull();
  });

  it("leaves economic null with a rent but no budget and no comparables", () => {
    const r = scoreUse({ use: "fitness_studio", site: travis });
    expect(r.scores.economic.score).toBeNull();
    expect(r.scores.overall).toBeNull();
    expect(r.verdict).toBe("insufficient_evidence");
  });

  it("does not let a null market drag the overall down", () => {
    const withBudget = scoreUse({ use: "fitness_studio", site: travis, preferences: { maxRentPsfYear: fact(50, "ev_budget") } });
    expect(withBudget.scores.market.score).toBeNull();
    // physical 100, access 100, economic 100 → overall 100, not pulled down by an unknown market
    expect(withBudget.scores.overall).toBe(100);
    expect(withBudget.notes.join(" ")).toMatch(/re-normalized/);
  });

  it("ignores comparables with too small a sample", () => {
    const r = scoreUse({
      use: "cafe",
      site: travis,
      market: { comparableRent: fact({ medianPsfYear: 40, n: 2, serviceType: "TripleNet" }, "ev_comps") },
    });
    expect(r.scores.economic.score).toBeNull();
  });

  it("refuses to compare rents across service types", () => {
    const r = scoreUse({
      use: "cafe",
      site: travis,
      market: { comparableRent: fact({ medianPsfYear: 30, n: 12, serviceType: "FullServiceGross" }, "ev_comps") },
    });
    expect(r.scores.economic.score).toBeNull();
  });
});

describe("Travis Suite 100 scenarios", () => {
  it("flags F45 already in the building as a soft blocker for a gym", () => {
    const r = scoreUse({
      use: "fitness_studio",
      site: travis,
      market: { sameCategoryInBuilding: fact({ count: 1, names: ["F45 Training"] }, "ev_tenants") },
      preferences: { maxRentPsfYear: fact(50, "ev_budget") },
    });
    expect(r.blockers).toEqual([expect.objectContaining({ hard: false, evidenceIds: ["ev_tenants"] })]);
    expect(r.blockers[0].description).toMatch(/F45/);
    expect(r.scores.market.score).toBe(35);
    expect(r.verdict).toBe("promising"); // soft blockers don't cap the verdict
  });

  it("scores economics against nearby asking rents on the same basis", () => {
    const r = scoreUse({
      use: "restaurant_bar",
      site: travis,
      market: { comparableRent: fact({ medianPsfYear: 42, n: 8, serviceType: "TripleNet" }, "ev_comps") },
    });
    // 45 / 42 = 1.07 → 70
    expect(r.scores.economic.score).toBe(70);
    expect(r.scores.economic.evidenceIds).toEqual(expect.arrayContaining(["ev_space_rent", "ev_comps", "ev_service"]));
  });

  it("rewards existing build-out but never penalizes its absence", () => {
    const base = scoreUse({ use: "restaurant_bar", site: { spaceSf: fact(4000) } }).scores.physical.score;
    const withKitchen = scoreUse({
      use: "restaurant_bar",
      site: { spaceSf: fact(4000), buildOut: [fact("commercial_kitchen" as const, "ev_obs_kitchen")] },
    }).scores.physical;
    expect(base).toBe(100);
    expect(withKitchen.score).toBe(100);
    expect(withKitchen.evidenceIds).toContain("ev_obs_kitchen");
    const small = scoreUse({ use: "restaurant_bar", site: { spaceSf: fact(2000) } }).scores.physical.score!;
    const smallWithKitchen = scoreUse({
      use: "restaurant_bar",
      site: { spaceSf: fact(2000), buildOut: [fact("commercial_kitchen" as const)] },
    }).scores.physical.score!;
    expect(smallWithKitchen).toBeGreaterThan(small);
  });
});

describe("hard blockers", () => {
  it("an upper floor is a hard blocker for uses that need ground floor", () => {
    const r = scoreUse({
      use: "cafe",
      site: { ...travis, spaceSf: fact(1500), isGroundFloor: fact(false, "ev_floor") },
      preferences: { maxRentPsfYear: fact(60) },
    });
    expect(r.blockers.some((b) => b.hard && /ground-floor/.test(b.description))).toBe(true);
    expect(r.verdict).not.toBe("promising");
  });

  it("an upper floor is not a blocker for coworking", () => {
    const r = scoreUse({ use: "coworking", site: { ...travis, isGroundFloor: fact(false) } });
    expect(r.blockers).toHaveLength(0);
  });

  it("a low ceiling is a hard blocker for a gym", () => {
    const r = scoreUse({ use: "fitness_studio", site: { ...travis, ceilingFt: fact(8) } });
    expect(r.blockers.some((b) => b.hard && /Ceiling/.test(b.description))).toBe(true);
  });
});

describe("weights", () => {
  it("defaults to 35/25/20/20", () => expect(normalizeWeights()).toEqual(DEFAULT_WEIGHTS));
  it("normalizes any positive weights to sum to 100", () => {
    const w = normalizeWeights({ physical: 1, market: 1, access: 1, economic: 1 });
    expect(w).toEqual({ physical: 25, market: 25, access: 25, economic: 25 });
  });
  it("rejects negative or all-zero weights", () => {
    expect(() => normalizeWeights({ physical: -1 })).toThrow();
    expect(() => normalizeWeights({ physical: 0, market: 0, access: 0, economic: 0 })).toThrow();
  });
  it("changing weights changes the overall", () => {
    const input = {
      use: "restaurant_bar" as const,
      site: travis,
      market: { comparableRent: fact({ medianPsfYear: 30, n: 8, serviceType: "TripleNet" }) },
    };
    const physicalHeavy = scoreUse({ ...input, weights: { physical: 90, economic: 10 } }).scores.overall!;
    const economicHeavy = scoreUse({ ...input, weights: { physical: 10, economic: 90 } }).scores.overall!;
    expect(physicalHeavy).toBeGreaterThan(economicHeavy);
  });
});

describe("verdict thresholds", () => {
  it.each([
    [85, false, "promising"],
    [70, false, "promising"],
    [69, false, "possible"],
    [50, false, "possible"],
    [49, false, "unlikely"],
    [85, true, "possible"],
    [60, true, "unlikely"],
    [null, false, "insufficient_evidence"],
  ] as const)("overall %s, hard blocker %s → %s", (overall, hard, expected) => {
    expect(verdictFor(overall, hard ? [{ description: "x", evidenceIds: [], hard: true }] : [])).toBe(expected);
  });
});

describe("contract compatibility", () => {
  it("produces scores that fit the Opportunity schema for every use", () => {
    const base = travisAnalysisFixture.opportunities[0];
    for (const use of USE_CATEGORIES) {
      const r = scoreUse({ use, site: travis, preferences: { maxRentPsfYear: fact(50) } });
      expect(() => Opportunity.parse({ ...base, useCategory: use, scores: r.scores, verdict: r.verdict })).not.toThrow();
    }
  });
});

describe("industry-group market signal", () => {
  const share = (count: number, knownTotal: number) =>
    scoreUse({ use: "cafe", site: travis, market: { sameIndustryNearby: fact({ count, knownTotal, industries: ["AccommodationAndFoodServices"] }, "ev_ind") } }).scores.market;

  it.each([
    [0, 100, 55],
    [15, 108, 80],
    [25, 100, 65],
    [40, 100, 45],
  ])("%s of %s known tenants → %s", (count, total, expected) => {
    expect(share(count, total).score).toBe(expected);
  });

  it("ignores a sample too thin to read", () => {
    expect(share(3, 9).score).toBeNull();
  });

  it("labels the count as a broad group, never as competitors", () => {
    const m = share(15, 108);
    expect(m.rationale).toContain("a broad industry group, not exact competitors");
    expect(m.evidenceIds).toEqual(["ev_ind"]);
  });
});
