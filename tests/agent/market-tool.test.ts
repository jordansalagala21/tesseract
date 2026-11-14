import { describe, expect, it } from "vitest";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AnalysisRequest, AnalysisResponse } from "@/lib/contracts";
import { nearbyContextDep, DEFAULT_RADIUS_M } from "@/lib/agent/market-tool";
import { runAnalysis, type CreateMessage } from "@/lib/agent/orchestrator";
import { UNAVAILABLE_DEPS, type DataDeps, type ToolOutput } from "@/lib/agent/tools";
import { TRAVIS_1000 } from "../market/nearby-fixtures";

const SUBJECT = "p1018657-s21053094";

describe("nearbyContextDep", () => {
  it("passes the radius through, defaulting to the route's 1,500 m", async () => {
    const radii: number[] = [];
    const dep = nearbyContextDep({ getNearbyContext: async (_id, r) => (radii.push(r), { ...TRAVIS_1000, radiusMeters: r }) });
    await dep({ propertyId: 1018657 });
    await dep({ propertyId: 1018657, radiusMeters: 1000 });
    expect(radii).toEqual([DEFAULT_RADIUS_M, 1000]);
  });

  it("keys signals by the space and uses its basis for the comparable rent", async () => {
    const dep = nearbyContextDep({
      getNearbyContext: async () => TRAVIS_1000,
      getSpaceBasis: async () => ({ serviceType: "TripleNet", spaceUse: "Retail" }),
    });
    const out = await dep({ propertyId: 1018657, spaceId: 21053094 });
    expect(Object.keys(out.market!)).toEqual([SUBJECT]);
    expect(out.market![SUBJECT].comparableRent).toBeUndefined();
    expect(out.evidence.map((e) => e.id)).toContain("ev_mkt_missing_comparable_rent");
    expect(out.marketAnalysis?.propertyId).toBe(1018657);
  });

  it("records the comparable as missing when the space's basis can't be looked up", async () => {
    const out = await nearbyContextDep({ getNearbyContext: async () => TRAVIS_1000 })({ propertyId: 1018657, spaceId: 21053094 });
    const gap = out.evidence.find((e) => e.id === "ev_mkt_missing_comparable_rent");
    expect(gap?.kind).toBe("missing");
  });
});

/* ---------------------------------------------------- through the agent */

const costar = (field: string) => [{ system: "costar" as const, dataset: "commercial-listing-summary", recordId: "21053094", field }];
const profile: ToolOutput = {
  summary: "Suite 100",
  evidence: [
    { id: "ev_sf", kind: "verified_fact", statement: "Suite 100 is 9,889 SF", value: 9889, sources: costar("squareFeetMax") },
    { id: "ev_rent", kind: "verified_fact", statement: "Asking $45/SF/yr NNN", value: 45, sources: costar("rateLow") },
    { id: "ev_st", kind: "verified_fact", statement: "Service type TripleNet", value: "TripleNet", sources: costar("serviceType") },
  ],
  facts: {
    [SUBJECT]: {
      spaceSf: { value: 9889, evidenceId: "ev_sf" },
      askingRentPsfYear: { value: 45, evidenceId: "ev_rent" },
      serviceType: { value: "TripleNet", evidenceId: "ev_st" },
    },
  },
};

let n = 0;
const toolUse = (name: string, input: Record<string, unknown>) => ({ type: "tool_use" as const, id: `tu_${++n}`, name, input });
const message = (content: unknown[]) =>
  ({ id: `m_${++n}`, type: "message", role: "assistant", model: "t", content, stop_reason: "tool_use", stop_sequence: null, usage: {} }) as unknown as BetaMessage;
const scripted = (responses: BetaMessage[]): CreateMessage => async () => responses.shift()!;

describe("market context in a full analysis", () => {
  // Nearby context is fetched for the PROPERTY, then a SPACE is scored: the space inherits it.
  const deps: DataDeps = {
    ...UNAVAILABLE_DEPS,
    getPropertyProfile: async () => profile,
    getNearbyContext: nearbyContextDep({ getNearbyContext: async () => TRAVIS_1000 }),
  };
  const request = AnalysisRequest.parse({ input: { persona: "owner", propertyId: 1018657, spaceId: 21053094 } });
  const run = () =>
    runAnalysis({
      id: "mkt",
      request,
      model: "t",
      deps,
      createMessage: scripted([
        message([
          toolUse("get_property_profile", { reason: "Facts.", propertyId: 1018657, spaceId: 21053094 }),
          toolUse("get_nearby_context", { reason: "Market.", propertyId: 1018657, radiusMeters: 1000 }),
        ]),
        message([toolUse("score_uses", { reason: "Score.", subject: SUBJECT, useCategories: ["cafe", "fitness_studio"] })]),
        message([
          toolUse("submit_report", {
            opportunities: [
              { subject: SUBJECT, useCategory: "cafe", title: "Café", summary: "s", strategy: "lease", supportingEvidenceIds: ["ev_sf"], unknowns: [], likelyChanges: [], nextSteps: [], financialScenarioIds: [] },
            ],
            missing: [],
          }),
        ]),
      ]),
    });

  it("fills the market score for a space from its property's nearby context", async () => {
    const r = await run();
    expect(r.status).toBe("completed");
    const cafe = r.opportunities.find((o) => o.useCategory === "cafe")!;
    expect(cafe.scores.market.score).not.toBeNull();
    expect(cafe.scores.market.evidenceIds.every((id) => r.evidence.some((e) => e.id === id))).toBe(true);
  });

  it("returns the property's MarketAnalysis with evidence ids that resolve", async () => {
    const r = await run();
    expect(() => AnalysisResponse.parse(r)).not.toThrow();
    expect(r.marketAnalysis?.propertyId).toBe(1018657);
    expect(r.marketAnalysis!.evidenceIds.length).toBeGreaterThan(0);
    for (const id of r.marketAnalysis!.evidenceIds) expect(r.evidence.some((e) => e.id === id)).toBe(true);
  });
});
