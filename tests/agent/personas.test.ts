import { describe, expect, it } from "vitest";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AnalysisRequest, AnalysisResponse, type Opportunity } from "@/lib/contracts";
import { runAnalysis, type CreateMessage } from "@/lib/agent/orchestrator";
import { PERSONA_WEIGHTS, allowedStrategies, orderForPersona, personaPrompt } from "@/lib/agent/personas";
import { UNAVAILABLE_DEPS, type DataDeps, type ToolOutput } from "@/lib/agent/tools";

let n = 0;
const toolUse = (name: string, input: Record<string, unknown>) => ({ type: "tool_use" as const, id: `tu_${++n}`, name, input });
const msg = (content: unknown[]) => ({ id: `m${++n}`, type: "message", role: "assistant", model: "t", content, stop_reason: "tool_use", stop_sequence: null, usage: {} }) as unknown as BetaMessage;
function script(responses: BetaMessage[]) {
  const calls: MessageCreateParamsNonStreaming[] = [];
  const create: CreateMessage = async (p) => (calls.push(p), responses.shift()!);
  return { create, calls };
}

/** A test double for DATA-03: one space with a size and a rent, cited as CoStar facts. */
function space(propertyId: number, spaceId: number, sf: number, rent: number): ToolOutput {
  const sub = `p${propertyId}-s${spaceId}`;
  const src = [{ system: "costar" as const, dataset: "commercial-listing-summary", recordId: String(spaceId) }];
  return {
    summary: `${sf} SF at $${rent}`,
    evidence: [
      { id: `ev_sf_${spaceId}`, kind: "verified_fact", statement: `${sf} SF advertised`, value: sf, sources: src },
      { id: `ev_rent_${spaceId}`, kind: "verified_fact", statement: `$${rent}/SF/yr asking`, value: rent, sources: src },
      { id: `ev_floor_${spaceId}`, kind: "verified_fact", statement: "Ground floor", value: true, sources: src },
    ],
    facts: { [sub]: { spaceSf: { value: sf, evidenceId: `ev_sf_${spaceId}` }, askingRentPsfYear: { value: rent, evidenceId: `ev_rent_${spaceId}` }, isGroundFloor: { value: true, evidenceId: `ev_floor_${spaceId}` } } },
  };
}
const SPACES: Record<number, ToolOutput> = { 11: space(1, 11, 1500, 30), 22: space(2, 22, 2000, 48), 33: space(3, 33, 1200, 36) };
const deps: DataDeps = { ...UNAVAILABLE_DEPS, getPropertyProfile: async (i) => SPACES[i.spaceId!] };

const opp = (subject: string, useCategory: string, strategy: string) => ({
  subject, useCategory, strategy, title: `${useCategory} at ${subject}`, summary: "Fits.", supportingEvidenceIds: [], unknowns: [], likelyChanges: [], nextSteps: ["Ask the broker about venting"], financialScenarioIds: [],
});

describe("persona settings", () => {
  it("weights emphasise what each persona cares about", () => {
    expect(PERSONA_WEIGHTS.owner.physical).toBeGreaterThan(PERSONA_WEIGHTS.owner.economic);
    expect(PERSONA_WEIGHTS.investor.economic).toBeGreaterThan(PERSONA_WEIGHTS.investor.physical);
    expect(PERSONA_WEIGHTS.entrepreneur.economic).toBe(PERSONA_WEIGHTS.entrepreneur.physical);
  });

  it("restricts strategies by persona and investor preference", () => {
    const inv = (strategy: string) => AnalysisRequest.parse({ input: { persona: "investor", capitalUsd: 1e6, riskTolerance: "medium", markets: ["houston"], horizonYears: 5, strategy } }).input;
    expect(allowedStrategies(AnalysisRequest.parse({ input: { persona: "owner", propertyId: 1 } }).input)).toEqual(["lease", "reposition"]);
    expect(allowedStrategies(inv("acquire"))).toEqual(["acquisition"]);
    expect(allowedStrategies(inv("lease"))).toEqual(["lease", "reposition"]);
    expect(allowedStrategies(inv("either"))).toEqual(["acquisition", "lease", "reposition"]);
  });

  it("orders investor results acquisition first, then lease, each by score", () => {
    const input = AnalysisRequest.parse({ input: { persona: "investor", capitalUsd: 1e6, riskTolerance: "low", markets: ["houston"], horizonYears: 5, strategy: "either" } }).input;
    const o = (strategy: Opportunity["strategy"], overall: number | null) => ({ strategy, scores: { overall } }) as Opportunity;
    const ordered = orderForPersona(input, [o("lease", 90), o("acquisition", 40), o("acquisition", 70), o("reposition", null)]);
    expect(ordered.map((x) => [x.strategy, x.scores.overall])).toEqual([["acquisition", 70], ["acquisition", 40], ["lease", 90], ["reposition", null]]);
  });

  it("gives each persona its own goal and tool strategy", () => {
    const owner = personaPrompt(AnalysisRequest.parse({ input: { persona: "owner", propertyId: 1018657, spaceId: 21053094 } }));
    expect(owner).toMatch(/Scoring subject: p1018657-s21053094/);
    expect(owner).toMatch(/analyze_interior/);
    const ent = personaPrompt(AnalysisRequest.parse({ input: { persona: "entrepreneur", businessConcept: "Coffee shop", sfMin: 900, sfMax: 2000, markets: ["houston"] } }));
    expect(ent).toMatch(/at least 3 candidate spaces/);
    expect(ent).toMatch(/Allowed strategies for this persona: lease\./);
  });
});

describe("each persona produces a valid AnalysisResponse", () => {
  it("entrepreneur: ranks three spaces by fit for one concept, and only as leases", async () => {
    const request = AnalysisRequest.parse({ input: { persona: "entrepreneur", businessConcept: "Neighborhood coffee shop", sfMin: 900, sfMax: 2200, maxRentPsfYear: 40, markets: ["houston"] } });
    const { create, calls } = script([
      msg([11, 22, 33].map((s) => toolUse("get_property_profile", { reason: "Load the space.", propertyId: Math.floor(s / 11), spaceId: s }))),
      msg([11, 22, 33].map((s) => toolUse("score_uses", { reason: "Score it.", subject: `p${s / 11}-s${s}`, useCategories: ["cafe"] }))),
      msg([toolUse("submit_report", {
        opportunities: [opp("p1-s11", "cafe", "lease"), opp("p2-s22", "cafe", "lease"), opp("p3-s33", "cafe", "lease"), opp("p1-s11", "cafe", "acquisition")],
        missing: [],
      })]),
    ]);
    const r = await runAnalysis({ id: "e1", request, createMessage: create, model: "t", deps });
    expect(() => AnalysisResponse.parse(r)).not.toThrow();
    expect(r.status).toBe("completed");
    expect(r.opportunities).toHaveLength(3); // the acquisition one is not allowed for this persona
    expect(r.opportunities.every((o) => o.strategy === "lease")).toBe(true);
    // $48 is over the $40 budget, so space 22 ranks last
    expect(r.opportunities.map((o) => o.spaceId)).toEqual([11, 33, 22]);
    expect(r.opportunities.map((o) => o.rank)).toEqual([1, 2, 3]);
    expect(JSON.stringify(calls[0].messages[0].content)).toMatch(/ev_user_budget/);
  });

  it("investor: keeps acquisition separate from lease and respects an 'acquire' preference", async () => {
    const request = AnalysisRequest.parse({ input: { persona: "investor", capitalUsd: 2e6, riskTolerance: "medium", markets: ["houston"], horizonYears: 7, strategy: "acquire" } });
    const { create } = script([
      msg([toolUse("get_property_profile", { reason: "Load it.", propertyId: 1, spaceId: 11 })]),
      msg([toolUse("score_uses", { reason: "Score.", subject: "p1-s11", useCategories: ["cafe", "specialty_retail"] })]),
      msg([toolUse("submit_report", { opportunities: [opp("p1-s11", "cafe", "lease"), opp("p1-s11", "specialty_retail", "acquisition")], missing: [] })]),
    ]);
    const r = await runAnalysis({ id: "i1", request, createMessage: create, model: "t", deps });
    expect(() => AnalysisResponse.parse(r)).not.toThrow();
    expect(r.opportunities.map((o) => o.strategy)).toEqual(["acquisition"]);
  });

  it("owner: never receives an acquisition opportunity", async () => {
    const request = AnalysisRequest.parse({ input: { persona: "owner", propertyId: 1, spaceId: 11 } });
    const { create } = script([
      msg([toolUse("get_property_profile", { reason: "Load it.", propertyId: 1, spaceId: 11 })]),
      msg([toolUse("score_uses", { reason: "Score.", subject: "p1-s11", useCategories: ["cafe"] })]),
      msg([toolUse("submit_report", { opportunities: [opp("p1-s11", "cafe", "acquisition"), opp("p1-s11", "cafe", "reposition")], missing: [] })]),
    ]);
    const r = await runAnalysis({ id: "o1", request, createMessage: create, model: "t", deps });
    expect(() => AnalysisResponse.parse(r)).not.toThrow();
    expect(r.opportunities.map((o) => o.strategy)).toEqual(["reposition"]);
  });
});

describe("evidence grounding (AI-03)", () => {
  it("adds the verified facts behind the scores when the model cites none", async () => {
    const request = AnalysisRequest.parse({ input: { persona: "owner", propertyId: 1, spaceId: 11 } });
    const { create } = script([
      msg([toolUse("get_property_profile", { reason: "Load it.", propertyId: 1, spaceId: 11 })]),
      msg([toolUse("score_uses", { reason: "Score.", subject: "p1-s11", useCategories: ["cafe"] })]),
      msg([toolUse("submit_report", { opportunities: [{ ...opp("p1-s11", "cafe", "lease"), supportingEvidenceIds: ["ev_fake"] }], missing: [] })]),
    ]);
    const r = await runAnalysis({ id: "g1", request, createMessage: create, model: "t", deps });
    const ids = r.opportunities[0].supportingEvidenceIds;
    expect(ids).not.toContain("ev_fake");
    expect(ids.some((id) => r.evidence.find((e) => e.id === id)?.kind === "verified_fact")).toBe(true);
  });

  it("drops an opportunity with no verified fact behind it", async () => {
    const request = AnalysisRequest.parse({ input: { persona: "owner", propertyId: 9 } });
    const aiOnly: DataDeps = {
      ...UNAVAILABLE_DEPS,
      getPropertyProfile: async () => ({
        summary: "AI only",
        evidence: [{ id: "ev_ai", kind: "ai_observation", statement: "Looks like about a café-sized room", model: "m", confidence: "low", sources: [{ system: "matterport", recordId: "x" }] }],
        facts: { p9: { spaceSf: { value: 1500, evidenceId: "ev_ai" } } },
      }),
    };
    const { create } = script([
      msg([toolUse("get_property_profile", { reason: "Load it.", propertyId: 9 })]),
      msg([toolUse("score_uses", { reason: "Score.", subject: "p9", useCategories: ["cafe"] })]),
      msg([toolUse("submit_report", { opportunities: [{ ...opp("p9", "cafe", "lease"), supportingEvidenceIds: ["ev_ai"] }], missing: [] })]),
    ]);
    const r = await runAnalysis({ id: "g2", request, createMessage: create, model: "t", deps: aiOnly });
    expect(r.status).toBe("completed");
    expect(r.opportunities).toHaveLength(0);
  });

  it("the contract itself rejects a response that references a fake evidence id", () => {
    const valid = { id: "a", status: "completed", persona: "owner", request: AnalysisRequest.parse({ input: { persona: "owner", propertyId: 1 } }), createdAt: "2026-11-14T00:00:00Z", completedAt: "2026-11-14T00:00:00Z", evidence: [], evidenceIndex: { verifiedFactIds: [], aiObservationIds: [], userAssumptionIds: [], missingInfoIds: [] }, opportunities: [], marketAnalysis: null, financialScenarios: [], toolCalls: [], disclaimers: ["x"], error: null };
    expect(AnalysisResponse.safeParse(valid).success).toBe(true);
    const tampered = { ...valid, toolCalls: [{ id: "tc", step: 1, tool: "score_uses", reason: "r", input: {}, status: "succeeded", startedAt: "2026-11-14T00:00:00Z", finishedAt: null, outputSummary: null, evidenceIds: ["ev_fake"], error: null }] };
    expect(AnalysisResponse.safeParse(tampered).success).toBe(false);
  });
});
