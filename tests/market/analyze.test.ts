import { describe, expect, it } from "vitest";
import { Evidence, MarketAnalysis } from "@/lib/contracts";
import { analyzeNearby } from "@/lib/market/analyze";
import { scoreUse } from "@/lib/market/scoring";
import { EMPTY, LA_GROUPS, TRAVIS_1000 } from "./nearby-fixtures";

const NOW = "2026-11-14T12:00:00.000Z";
const SUITE_100 = { serviceType: "TripleNet", spaceUse: "Retail" };

describe("analyzeNearby: MarketAnalysis", () => {
  const { analysis, evidence } = analyzeNearby(TRAVIS_1000, { retrievedAt: NOW });

  it("returns a contract-valid analysis whose evidence ids all exist", () => {
    expect(() => MarketAnalysis.parse(analysis)).not.toThrow();
    for (const e of evidence) expect(() => Evidence.parse({ ...e, createdAt: NOW })).not.toThrow();
    expect(analysis.evidenceIds).toEqual(evidence.map((e) => e.id));
  });

  it("passes the kit counts through unchanged, with sample sizes", () => {
    expect(analysis.comparableSpaces.count).toBe(54);
    expect(analysis.nearbyTenants.count).toBe(146);
    expect(analysis.saleComps).toEqual({ count: 41, withDisclosedPrice: 15 });
    expect(analysis.limitations).toContain(
      "Rents are advertised asking rents, not signed leases: 14 of 54 comparable spaces publish a rate, and spaces without one are excluded from every range.",
    );
  });

  it("always lists what it cannot tell you", () => {
    expect(analysis.limitations.length).toBeGreaterThan(0);
    expect(analysis.limitations[0]).toMatch(/31 CoStar kit properties within 1,000 m, not a full market census/);
    expect(analysis.limitations.join(" ")).toMatch(/No demographics, foot traffic/);
    expect(analysis.limitations.join(" ")).toMatch(/38 of 146 nearby tenants have no known industry/);
  });

  it("states each rated rent group as a verified fact with its basis and n", () => {
    const rent = evidence.filter((e) => e.id.startsWith("ev_mkt_rent_"));
    expect(rent).toHaveLength(1);
    expect(rent[0]).toMatchObject({ kind: "verified_fact", value: 18, unit: "$/SF/yr" });
    expect(rent[0].statement).toBe(
      "Nearby TripleNet Office asking rents within 1,000 m: $18/SF/yr (median $18, 14 of 14 spaces publish a rate). Advertised asking rents, not achieved rents.",
    );
  });

  it("never fills a use's rent range from other uses", () => {
    const retail = analyzeNearby(TRAVIS_1000, { spaceUse: "Retail" }).analysis;
    expect(retail.comparableSpaces.askingRentPsfYear).toEqual({ min: null, median: null, max: null });
    expect(retail.limitations).toContain("No nearby Retail space publishes an asking rent, so there is no Retail rent range.");
  });

  it("does not blend one use quoted on several service types", () => {
    const la = analyzeNearby({ ...TRAVIS_1000, comparableSpaces: { ...TRAVIS_1000.comparableSpaces, rentGroups: LA_GROUPS } }, { spaceUse: "Retail" }).analysis;
    expect(la.comparableSpaces.askingRentPsfYear.median).toBeNull();
    expect(la.limitations.join(" ")).toMatch(/Retail rents are quoted on 2 different service types \(FullService, ModifiedGross\)/);
  });

  it("uses the one matching group's range when a use has exactly one", () => {
    const office = analyzeNearby(TRAVIS_1000, { spaceUse: "Office" }).analysis;
    expect(office.comparableSpaces.askingRentPsfYear).toEqual({ min: 18, median: 18, max: 18 });
  });

  it("flags an overall range that mixes groups", () => {
    const la = analyzeNearby({ ...TRAVIS_1000, comparableSpaces: { ...TRAVIS_1000.comparableSpaces, rentGroups: LA_GROUPS } }).analysis;
    expect(la.limitations.join(" ")).toMatch(/overall rent range mixes 4 service type × space use groups/);
  });

  it("handles an empty radius without inventing anything", () => {
    const r = analyzeNearby(EMPTY);
    expect(() => MarketAnalysis.parse(r.analysis)).not.toThrow();
    expect(r.analysis.comparableSpaces.askingRentPsfYear.median).toBeNull();
    expect(r.analysis.limitations.join(" ")).toMatch(/No kit property lies within 500 m/);
    expect(r.signals.byUse).toEqual({});
  });
});

describe("analyzeNearby: comparable rent for a subject space", () => {
  it("records Suite 100's missing retail comparable instead of using the $18 office median", () => {
    const { evidence, signals, analysis } = analyzeNearby(TRAVIS_1000, { subject: SUITE_100 });
    expect(signals.comparableRent).toBeUndefined();
    const gap = evidence.find((e) => e.id === "ev_mkt_missing_comparable_rent");
    expect(gap).toMatchObject({ kind: "missing", statement: "No comparable TripleNet Retail asking rent is published within 1,000 m" });
    expect(analysis.limitations.join(" ")).toMatch(/Rents for other uses or lease types are not substituted/);
  });

  it("provides a comparable when the same basis publishes rates", () => {
    const { signals, evidence } = analyzeNearby(TRAVIS_1000, { subject: { serviceType: "TripleNet", spaceUse: "Office" } });
    expect(signals.comparableRent?.value).toEqual({ medianPsfYear: 18, n: 14, serviceType: "TripleNet" });
    expect(evidence.map((e) => e.id)).toContain(signals.comparableRent!.evidenceId);
  });
});

describe("analyzeNearby: per-use signals", () => {
  const { signals, evidence } = analyzeNearby(TRAVIS_1000);
  const ids = new Set(evidence.map((e) => e.id));

  it("counts a use's industry group out of tenants with a known industry", () => {
    expect(signals.byUse.cafe?.sameIndustryNearby?.value).toEqual({ count: 15, knownTotal: 108, industries: ["AccommodationAndFoodServices"] });
    expect(signals.byUse.medical_office?.sameIndustryNearby?.value.count).toBe(18);
    expect(signals.byUse.fitness_studio?.sameIndustryNearby?.value.count).toBe(2);
  });

  it("counts complementary neighbours", () => {
    // Office-type groups (17+12+10+2+1+1+1 = 44) + health care 18 + education 1.
    expect(signals.byUse.cafe?.complementaryNearby?.value).toBe(63);
  });

  it("shares one evidence item between uses with the same industry group", () => {
    expect(signals.byUse.cafe?.sameIndustryNearby?.evidenceId).toBe(signals.byUse.restaurant_bar?.sameIndustryNearby?.evidenceId);
    for (const s of Object.values(signals.byUse)) {
      for (const f of [s?.sameIndustryNearby, s?.complementaryNearby]) if (f) expect(ids.has(f.evidenceId)).toBe(true);
    }
  });

  it("gives coworking no peer count, because its CoStar group is too broad", () => {
    expect(signals.byUse.coworking?.sameIndustryNearby).toBeUndefined();
    expect(analyzeNearby(TRAVIS_1000).analysis.limitations.join(" ")).toMatch(/Coworking operators share CoStar's Real estate industry group/);
  });

  it("builds signals only for the uses asked for", () => {
    expect(Object.keys(analyzeNearby(TRAVIS_1000, { uses: ["cafe"] }).signals.byUse)).toEqual(["cafe"]);
  });

  it("feeds lib/market scoring a market component with cited factors", () => {
    const r = scoreUse({
      use: "cafe",
      site: { spaceSf: { value: 2946, evidenceId: "ev_sf" } },
      market: signals.byUse.cafe,
    });
    expect(r.scores.market.score).not.toBeNull();
    expect(r.scores.market.rationale).toContain("15 of 108 nearby tenants with a known industry are in Accommodation and food services");
    expect(r.scores.market.evidenceIds).toEqual(expect.arrayContaining([signals.byUse.cafe!.sameIndustryNearby!.evidenceId]));
  });
});
