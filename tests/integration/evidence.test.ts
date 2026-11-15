import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AnalysisRequest, AnalysisResponse } from "@/lib/contracts";
import { travisOrtho, travisProperty, travisSpaces, travisSuite100Model } from "@/lib/contracts/examples/travis";
import { auditAnalysis } from "@/lib/agent/audit";
import { liveDataDeps, type DataModules } from "@/lib/agent/data-deps";
import { runAnalysis } from "@/lib/agent/orchestrator";
import type { ToolOutput } from "@/lib/agent/tools";
import { TRAVIS_1000 } from "../market/nearby-fixtures";

/**
 * INT-03: every claim the UI renders maps to evidence with a resolvable source.
 * CI: a full owner analysis on the live data-tool code with fixture data (no network).
 * Locally: also the last captured live run (tmp/int02-live.json, gitignored: it holds sponsor data).
 */

const PID = travisProperty.id;
const SUITE = travisSpaces.find((s) => s.suite === "100")!;
const SUBJECT = `p${PID}-s${SUITE.id}`;

const modules: DataModules = {
  searchProperties: async () => ({ items: [], total: 0 }),
  getProperty: async (id) => (id === PID ? travisProperty : null),
  getSpaces: async () => travisSpaces,
  getCurrentTenants: async () => [{ name: "F45 Training, Inc.", industry: null, suite: "103", squareFeet: null, since: null }],
  getNearbyContext: async () => TRAVIS_1000,
  getMatterportModel: async (_id, link) => ({ ...travisSuite100Model, costarCaption: link.caption ?? null, matchedSuite: link.matchedSuite ?? null }),
  getModelImages: async () => [],
  getAerialImagery: async () => travisOrtho,
  fetchVexcelImage: async () => { throw new Error("unused"); },
  download: async () => Buffer.from(""),
};

/** What AI-02 returns, shaped as the live run shaped it (model-id media, caveat, source). */
const interior: ToolOutput = {
  summary: "1 interior observation",
  evidence: [
    {
      id: "ev_int_bar",
      kind: "ai_observation",
      statement: "A long bar counter runs along one side of the lounge.",
      model: "claude-opus-5-5",
      confidence: "high",
      caveat: "Visual/AI observation — not a verified measurement or inspection.",
      media: [{ type: "matterport_model", ref: "NxYn1owequw" }],
      sources: [{ system: "matterport", dataset: "model", recordId: "NxYn1owequw", field: "assets.photos[0]" }],
    },
  ],
  facts: { [SUBJECT]: { buildOut: [{ value: "bar_counter", evidenceId: "ev_int_bar" }] } },
};

let n = 0;
const toolUse = (name: string, input: Record<string, unknown>) => ({ type: "tool_use" as const, id: `tu_${++n}`, name, input });
const msg = (content: unknown[]) =>
  ({ id: `m_${++n}`, type: "message", role: "assistant", model: "t", content, stop_reason: "tool_use", stop_sequence: null, usage: {} }) as unknown as BetaMessage;

async function ownerRun(): Promise<AnalysisResponse> {
  const lease = {
    mode: "lease",
    spaceSf: { value: 9889, origin: "costar", label: "Suite 100 SF", evidenceId: `ev_s${SUITE.id}_sf` },
    baseRentPsfYear: { value: 45, origin: "costar", label: "Asking rent", evidenceId: `ev_s${SUITE.id}_rent` },
    nnnPsfYear: { value: 12, origin: "user", label: "NNN estimate" },
    buildOutCostUsd: { value: 150000, origin: "user", label: "Build-out" },
  };
  const responses = [
    msg([
      toolUse("get_property_profile", { reason: "Facts.", propertyId: PID, spaceId: SUITE.id }),
      toolUse("get_matterport_model", { reason: "Scan.", propertyId: PID, spaceId: SUITE.id }),
      toolUse("analyze_interior", { reason: "Fit-out.", propertyId: PID, spaceId: SUITE.id }),
      toolUse("get_aerial_imagery", { reason: "Aerial.", propertyId: PID }),
      toolUse("get_nearby_context", { reason: "Market.", propertyId: PID, spaceId: SUITE.id, radiusMeters: 1000 }),
    ]),
    msg([
      toolUse("score_uses", { reason: "Score.", subject: SUBJECT, useCategories: ["restaurant_bar", "fitness_studio"] }),
      toolUse("run_financial_scenario", { reason: "Price it.", name: "Suite 100 lease", input: lease }),
    ]),
    msg([
      toolUse("submit_report", {
        opportunities: [
          { subject: SUBJECT, useCategory: "restaurant_bar", title: "Second-generation restaurant", summary: "Existing bar fit-out.", strategy: "lease", supportingEvidenceIds: ["ev_int_bar", `ev_s${SUITE.id}_sf`, "ev_invented"], unknowns: [], likelyChanges: [], nextSteps: [], financialScenarioIds: ["scn_does_not_exist"] },
          { subject: SUBJECT, useCategory: "fitness_studio", title: "Boutique fitness", summary: "Tall open floor.", strategy: "lease", supportingEvidenceIds: [], unknowns: [], likelyChanges: [], nextSteps: [], financialScenarioIds: [] },
        ],
        missing: [{ statement: "Exhaust hood condition is unknown", whyNeeded: "Restaurants need one", howToResolve: "Ask the broker" }],
      }),
    ]),
  ];
  const deps = { ...liveDataDeps(modules, { createMessage: async () => { throw new Error("unused"); }, visionModel: "t" }), analyzeInterior: async () => interior };
  return runAnalysis({ id: "int03", request: AnalysisRequest.parse({ input: { persona: "owner", propertyId: PID, spaceId: SUITE.id } }), model: "t", deps, createMessage: async () => responses.shift()! });
}

describe("INT-03: evidence audit of a full owner analysis", () => {
  it("has zero findings: no unknown ids, every fact has a record, safe media, no vacancy wording", async () => {
    const r = await ownerRun();
    expect(r.status).toBe("completed");
    expect(() => AnalysisResponse.parse(r)).not.toThrow();
    expect(r.opportunities.length).toBe(2);
    expect(auditAnalysis(r)).toEqual([]);
  });

  it("dropped the model's invented evidence id and scenario id instead of rendering them", async () => {
    const r = await ownerRun();
    const restaurant = r.opportunities.find((o) => o.useCategory === "restaurant_bar")!;
    expect(restaurant.supportingEvidenceIds).not.toContain("ev_invented");
    expect(restaurant.financialScenarioIds).toEqual([]);
  });

  it("every verified fact names a dataset and a record id", async () => {
    const r = await ownerRun();
    const facts = r.evidence.filter((e) => e.kind === "verified_fact");
    expect(facts.length).toBeGreaterThan(10);
    for (const f of facts) for (const s of f.sources) expect(s.dataset && s.recordId).toBeTruthy();
  });
});

describe("auditAnalysis catches each rule", () => {
  const rules = async (mutate: (r: AnalysisResponse) => void) => {
    const r = structuredClone(await ownerRun());
    mutate(r);
    return auditAnalysis(r).map((f) => f.rule);
  };

  it("unknown evidence id in a scenario assumption", async () => {
    expect(await rules((r) => { (r.financialScenarios[0].input as { spaceSf: { evidenceId?: string } }).spaceSf.evidenceId = "ev_gone"; })).toContain("unknown_evidence_id");
  });
  it("CoStar assumption without a verified fact", async () => {
    expect(await rules((r) => { delete (r.financialScenarios[0].input as { baseRentPsfYear: { evidenceId?: string } }).baseRentPsfYear.evidenceId; })).toContain("costar_assumption_uncited");
  });
  it("unknown scenario id on an opportunity", async () => {
    expect(await rules((r) => { r.opportunities[0].financialScenarioIds = ["scn_x"]; })).toContain("unknown_scenario_id");
  });
  it("verified fact without a record id", async () => {
    expect(await rules((r) => { const f = r.evidence.find((e) => e.kind === "verified_fact")!; delete f.sources[0].recordId; })).toContain("fact_without_record");
  });
  it("signed third-party media URL", async () => {
    expect(await rules((r) => { r.evidence[0].media = [{ type: "image", ref: "https://cdn-2.matterport.com/x.jpg?t=signed" }]; })).toContain("unsafe_media_url");
  });
  it("vacancy wording, but not the 'not confirmed vacancy' disclaimer", async () => {
    expect(await rules((r) => { r.opportunities[0].summary = "The vacant suite is ready."; })).toContain("vacancy_wording");
    expect(await rules(() => {})).not.toContain("vacancy_wording");
  });
  it("opportunity without a verified fact", async () => {
    expect(await rules((r) => { r.opportunities[0].supportingEvidenceIds = ["ev_int_bar"]; })).toContain("opportunity_without_fact");
  });
});

describe.skipIf(!existsSync("tmp/int02-live.json"))("INT-03: last captured live run (local only)", () => {
  it("has zero audit findings", () => {
    const r = AnalysisResponse.parse(JSON.parse(readFileSync("tmp/int02-live.json", "utf8")));
    expect(auditAnalysis(r)).toEqual([]);
  });
});
