import { describe, expect, it } from "vitest";
import type { AnalysisResponse, Evidence, Opportunity } from "@/lib/contracts";
import { travisAnalysisFixture } from "@/lib/contracts/examples/travis";
import { factsFor, insightsFor, moneyFor, risksFor } from "@/components/analysis/result-facts";

const NOW = "2026-11-14T00:00:00.000Z";
const src = [{ system: "costar" as const, dataset: "d", recordId: "1" }];
const fact = (id: string, statement: string, value?: number | string): Evidence => ({ id, kind: "verified_fact", statement, value, createdAt: NOW, sources: src });
const missing = (id: string, statement: string): Evidence => ({ id, kind: "missing", statement, whyNeeded: "w", createdAt: NOW, sources: [] });

const EV: Evidence[] = [
  fact("ev_p1018657_type", "2600 Travis St, Houston is a general retail (freestanding) building in CoStar", "GeneralRetail"),
  fact("ev_s21053094_status", "Suite 100 (Retail) is advertised as available; advertised availability is not confirmed vacancy"),
  fact("ev_s21053094_sf", "Suite 100 is advertised at 9,889 SF", 9889),
  fact("ev_s21053094_rent", "Suite 100 asking rent is $45/SF/yr TripleNet (advertised, not achieved)", 45),
  fact("ev_s21053094_service", "Suite 100 is quoted on a TripleNet basis", "TripleNet"),
  missing("ev_missing_permitted_use", "Permitted uses and zoning for this site are not verified"),
  missing("ev_mkt_missing_comparable_rent", "No comparable TripleNet Retail asking rent is published within 1,500 m"),
  fact("ev_mkt_peer_1", "30 of 202 nearby tenants with a known industry are in Accommodation and food services (a broad CoStar industry group, kit buildings only)", 30),
  fact("ev_mkt_complement_2", "102 nearby tenants are in industries whose staff or visitors are likely customers of a restaurant / bar", 102),
];
const score = (s: number | null, ids: string[] = []) => ({ score: s, rationale: "", evidenceIds: ids });
const opp = (over: Partial<Opportunity> = {}): Opportunity => ({
  id: "o1", rank: 1, title: "Restaurant", useCategory: "restaurant_bar", propertyId: 1018657, spaceId: 21053094, strategy: "lease", verdict: "possible", summary: "",
  scores: { physical: score(94), market: score(85, ["ev_mkt_peer_1", "ev_mkt_complement_2"]), access: score(100), economic: score(null), overall: 94 },
  supportingEvidenceIds: [], blockers: [], unknowns: ["Economics not assessed: no budget.", "Kitchen hood condition is unknown."], likelyChanges: [], nextSteps: [], financialScenarioIds: [], ...over,
});
const analysis = (evidence = EV, financialScenarios: AnalysisResponse["financialScenarios"] = []) => ({ ...travisAnalysisFixture, evidence, financialScenarios }) as AnalysisResponse;

describe("factsFor", () => {
  it("reads address, suite, size and rent from the space's own evidence", () => {
    const f = factsFor(opp(), EV);
    expect(f).toMatchObject({ address: "2600 Travis St, Houston", suite: "Suite 100", size: "9,889 SF", rent: "$45/SF/yr NNN", rentPsfYear: 45 });
    expect(f.ids.rent).toBe("ev_s21053094_rent");
  });
  it("says a rent isn't published instead of inventing one", () => {
    const ev = [...EV.filter((e) => e.id !== "ev_s21053094_rent"), missing("ev_s21053094_rent_missing", "Suite 100 does not publish an asking rent")];
    expect(factsFor(opp(), ev).rent).toBe("Rent not published");
  });
  it("falls back to the property id when nothing names it", () => {
    expect(factsFor(opp({ propertyId: 42, spaceId: null }), []).address).toBe("Property 42");
  });
});

describe("risksFor", () => {
  it("leads with blockers, then zoning, the unchecked rent and the agent's own unknown", () => {
    const r = risksFor(opp({ blockers: [{ description: "No ground floor. Retail needs one.", evidenceIds: ["ev_x"] }] }), EV);
    expect(r.map((x) => x.text)).toEqual([
      "No ground floor.",
      "Permitted use and zoning aren’t verified. Confirm with the city before committing.",
      "We couldn’t check if the rent is competitive: no similar spaces nearby publish a rent.",
    ]);
  });
  it("on a card, shows the idea's own risk rather than the zoning note every idea shares", () => {
    const r = risksFor(opp(), EV, { specific: true }).map((x) => x.text);
    expect(r).toEqual(["Kitchen hood condition is unknown.", "We couldn’t check if the rent is competitive: no similar spaces nearby publish a rent."]);
  });
});

describe("insightsFor", () => {
  it("gives three plain insights from cited counts, and says when rent can't be compared", () => {
    const i = insightsFor(opp(), analysis());
    expect(i.map((x) => x.tone)).toEqual(["missing", "fact", "fact"]);
    expect(i[1].text).toBe("30 of 202 nearby businesses we know of are in the same broad category.");
    expect(i[2].text).toMatch(/^102 nearby businesses have staff or visitors/);
    expect(i.every((x) => !/demand is (high|strong)/i.test(x.text))).toBe(true);
  });
});

describe("moneyFor", () => {
  it("without a scenario, shows base rent from the cited facts with its formula", () => {
    const m = moneyFor(opp(), analysis(), factsFor(opp(), EV))!;
    expect(m.headline).toEqual([{ label: "Base rent / month", value: "$37,084" }, { label: "Base rent / year", value: "$445,005" }]);
    expect(m.basis).toBe("9,889 SF × $45/SF/yr asking rent (CoStar).");
    expect(m.sentence).toMatch(/NNN lease/);
  });
  it("prefers the agent's lease scenario when there is one", () => {
    const s = travisAnalysisFixture.financialScenarios[0];
    const m = moneyFor(opp({ financialScenarioIds: [s.id] }), analysis(EV, [s]), factsFor(opp(), EV))!;
    expect(m.scenarioId).toBe(s.id);
  });
});
