import { describe, expect, it } from "vitest";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AnalysisRequest, AnalysisResponse } from "@/lib/contracts";
import { runAnalysis, type CreateMessage } from "@/lib/agent/orchestrator";
import { ToolUnavailableError, UNAVAILABLE_DEPS, type DataDeps, type ToolOutput } from "@/lib/agent/tools";

const SUBJECT = "p1018657-s21053094";
const request = AnalysisRequest.parse({ input: { persona: "owner", propertyId: 1018657, spaceId: 21053094 } });
const costar = (field: string) => [{ system: "costar" as const, dataset: "commercial-listing-summary", recordId: "21053094", field }];

/** Test double for DATA-03: the CoStar facts for Travis Suite 100. */
const travisProfile: ToolOutput = {
  summary: "Retail, 9,889 SF Suite 100, $45/SF/yr NNN, 20 ft ceiling, ground floor",
  evidence: [
    { id: "ev_sf", kind: "verified_fact", statement: "Suite 100 is advertised at 9,889 SF", value: 9889, unit: "SF", sources: costar("squareFeetMax") },
    { id: "ev_rent", kind: "verified_fact", statement: "Asking rent $45/SF/yr NNN", value: 45, unit: "$/SF/yr", sources: costar("rateLow") },
    { id: "ev_ceiling", kind: "verified_fact", statement: "Ceiling height 20 ft", value: 20, unit: "ft", sources: costar("ceilingHeightFeet") },
    { id: "ev_floor", kind: "verified_fact", statement: "First floor", value: true, sources: costar("floorName") },
  ],
  facts: {
    [SUBJECT]: {
      spaceSf: { value: 9889, evidenceId: "ev_sf" },
      askingRentPsfYear: { value: 45, evidenceId: "ev_rent" },
      ceilingFt: { value: 20, evidenceId: "ev_ceiling" },
      isGroundFloor: { value: true, evidenceId: "ev_floor" },
    },
  },
};

const deps: DataDeps = {
  ...UNAVAILABLE_DEPS,
  getPropertyProfile: async () => travisProfile,
  getNearbyContext: async () => {
    throw new ToolUnavailableError("Nearby context is not connected yet (DATA-07).");
  },
};

let blockId = 0;
const toolUse = (name: string, input: Record<string, unknown>) => ({ type: "tool_use" as const, id: `tu_${++blockId}`, name, input });
const message = (content: unknown[], stop_reason: BetaMessage["stop_reason"] = "tool_use") =>
  ({ id: `msg_${++blockId}`, type: "message", role: "assistant", model: "test", content, stop_reason, stop_sequence: null, usage: {} }) as unknown as BetaMessage;

/** A scripted Claude: returns the next response each call and records what it was sent. */
function script(responses: BetaMessage[]) {
  const calls: MessageCreateParamsNonStreaming[] = [];
  const create: CreateMessage = async (params) => {
    calls.push(structuredClone(params));
    const next = responses.shift();
    if (!next) throw new Error("Script ran out of responses");
    return next;
  };
  return { create, calls };
}

const leaseInput = {
  mode: "lease",
  spaceSf: { value: 9889, origin: "costar", label: "Suite 100 SF", evidenceId: "ev_sf" },
  baseRentPsfYear: { value: 45, origin: "costar", label: "Asking rent", evidenceId: "ev_rent" },
  nnnPsfYear: { value: 12, origin: "user", label: "NNN estimate" },
  buildOutCostUsd: { value: 0, origin: "user", label: "Build-out" },
};

const report = {
  opportunities: [
    {
      subject: SUBJECT, useCategory: "fitness_studio", title: "Boutique gym", summary: "Large, tall, ground-floor space.", strategy: "lease",
      supportingEvidenceIds: ["ev_sf", "ev_ceiling", "ev_made_up"], unknowns: ["Parking"], likelyChanges: [], nextSteps: ["Ask broker about parking"], financialScenarioIds: [],
    },
    {
      subject: SUBJECT, useCategory: "cafe", title: "Café", summary: "Bigger than a café needs.", strategy: "lease",
      supportingEvidenceIds: ["ev_sf"], unknowns: [], likelyChanges: [], nextSteps: [], financialScenarioIds: [],
    },
  ],
  missing: [{ statement: "Permitted uses are not verified", whyNeeded: "A use must be allowed here", howToResolve: "Check with the City of Houston" }],
};

const happyPath = () =>
  script([
    message([
      toolUse("get_property_profile", { reason: "Load the CoStar facts.", propertyId: 1018657, spaceId: 21053094 }),
      toolUse("get_nearby_context", { reason: "Check nearby rents.", propertyId: 1018657 }),
    ]),
    message([
      toolUse("score_uses", { reason: "Score the uses that fit.", subject: SUBJECT, useCategories: ["fitness_studio", "cafe"] }),
      toolUse("run_financial_scenario", { reason: "Price a lease.", name: "Suite 100 lease", input: leaseInput }),
    ]),
    message([toolUse("submit_report", report)]),
  ]);

describe("runAnalysis", () => {
  it("runs the loop end to end and returns a valid AnalysisResponse", async () => {
    const { create } = happyPath();
    const updates: string[] = [];
    const r = await runAnalysis({ id: "t1", request, createMessage: create, model: "test", deps, onUpdate: (s) => updates.push(s.status) });

    expect(r.status).toBe("completed");
    expect(() => AnalysisResponse.parse(r)).not.toThrow();
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.every((s) => s === "running")).toBe(true);
  });

  it("records every tool call with reason, status, timing and evidence", async () => {
    const r = await runAnalysis({ id: "t2", request, createMessage: happyPath().create, model: "test", deps });
    expect(r.toolCalls.map((c) => [c.tool, c.status])).toEqual([
      ["get_property_profile", "succeeded"],
      ["get_nearby_context", "failed"],
      ["score_uses", "succeeded"],
      ["run_financial_scenario", "succeeded"],
    ]);
    const profile = r.toolCalls[0];
    expect(profile.reason).toBe("Load the CoStar facts.");
    expect(profile.input).not.toHaveProperty("reason");
    expect(profile.evidenceIds).toEqual(["ev_sf", "ev_rent", "ev_ceiling", "ev_floor"]);
    expect(profile.finishedAt).not.toBeNull();
    expect(r.toolCalls[1].error).toMatch(/DATA-07/);
  });

  it("keeps going after a failed tool and tells the model to list the gap", async () => {
    const { create, calls } = happyPath();
    await runAnalysis({ id: "t3", request, createMessage: create, model: "test", deps });
    const secondCall = calls[1].messages.at(-1)!;
    const results = secondCall.content as { is_error?: boolean; content: string }[];
    expect(results[1].is_error).toBe(true);
    expect(results[1].content).toMatch(/missing/);
  });

  it("takes scores and verdicts from lib/market, never from the model, and ranks by score", async () => {
    const r = await runAnalysis({ id: "t4", request, createMessage: happyPath().create, model: "test", deps });
    expect(r.opportunities.map((o) => o.useCategory)).toEqual(["fitness_studio", "cafe"]);
    const [gym, cafe] = r.opportunities;
    expect(gym.rank).toBe(1);
    expect(gym.scores.physical.score).toBe(100);
    expect(gym.scores.market.score).toBeNull(); // nearby context failed → insufficient evidence
    expect(gym.scores.economic.score).toBeNull(); // no budget and no comparables
    expect(gym.verdict).toBe("insufficient_evidence");
    expect(cafe.scores.physical.score!).toBeLessThan(100); // 9,889 SF is far above a café's range
  });

  it("drops evidence ids the model invented", async () => {
    const r = await runAnalysis({ id: "t5", request, createMessage: happyPath().create, model: "test", deps });
    expect(r.opportunities[0].supportingEvidenceIds).toEqual(["ev_sf", "ev_ceiling"]);
  });

  it("stores the lease scenario computed by lib/finance", async () => {
    const r = await runAnalysis({ id: "t6", request, createMessage: happyPath().create, model: "test", deps });
    expect(r.financialScenarios).toHaveLength(1);
    expect(r.financialScenarios[0].output.annualOccupancyCostUsd).toBe(563_673);
    expect(r.toolCalls[3].evidenceIds).toEqual(["ev_sf", "ev_rent"]);
  });

  it("records gaps as missing evidence: zoning always, failed tools, and the model's own", async () => {
    const r = await runAnalysis({ id: "t7", request, createMessage: happyPath().create, model: "test", deps });
    const missing = r.evidence.filter((e) => e.kind === "missing");
    expect(missing.map((m) => m.statement)).toEqual([
      "Permitted uses and zoning for this site are not verified",
      "Nearby rents and tenants could not be checked",
      "Permitted uses are not verified",
    ]);
    expect(r.evidenceIndex.missingInfoIds).toEqual(missing.map((m) => m.id));
  });

  it("lists each use's key checks as unknowns", async () => {
    const r = await runAnalysis({ id: "t7b", request, createMessage: happyPath().create, model: "test", deps });
    const gym = r.opportunities.find((o) => o.useCategory === "fitness_studio")!;
    expect(gym.unknowns[0]).toBe("Parking"); // the model's own first
    expect(gym.unknowns).toContain("Floor loading and sound or vibration limits for equipment");
  });

  it("rejects a 'costar' assumption that cites no verified fact", async () => {
    const bad = { ...leaseInput, baseRentPsfYear: { value: 30, origin: "costar", label: "Made-up rent" } };
    const { create } = script([
      message([toolUse("run_financial_scenario", { reason: "Price it.", name: "x", input: bad })]),
      message([toolUse("submit_report", { opportunities: [], missing: [] })]),
    ]);
    const r = await runAnalysis({ id: "t8", request, createMessage: create, model: "test", deps });
    expect(r.toolCalls[0].status).toBe("failed");
    expect(r.toolCalls[0].error).toMatch(/verified_fact/);
    expect(r.financialScenarios).toHaveLength(0);
  });

  it("enforces the step limit and skips extra calls", async () => {
    const limited = AnalysisRequest.parse({ ...request, options: { ...request.options, maxAgentSteps: 1 } });
    const { create } = script([
      message([
        toolUse("get_property_profile", { reason: "a", propertyId: 1018657 }),
        toolUse("get_property_profile", { reason: "b", propertyId: 1018657 }),
      ]),
      message([toolUse("submit_report", { opportunities: [], missing: [] })]),
    ]);
    const r = await runAnalysis({ id: "t9", request: limited, createMessage: create, model: "test", deps });
    expect(r.toolCalls.map((c) => c.status)).toEqual(["succeeded", "skipped"]);
    expect(r.status).toBe("completed");
  });

  it("nudges once for a report, then fails honestly if none comes", async () => {
    const { create, calls } = script([message([{ type: "text", text: "Done." }], "end_turn"), message([{ type: "text", text: "Still done." }], "end_turn")]);
    const r = await runAnalysis({ id: "t10", request, createMessage: create, model: "test", deps });
    expect(calls).toHaveLength(2);
    expect(r.status).toBe("failed");
    expect(r.error).toMatch(/without submitting a report/);
    expect(() => AnalysisResponse.parse(r)).not.toThrow();
  });

  it("fails cleanly on a refusal or an API error", async () => {
    const refused = await runAnalysis({ id: "t11", request, createMessage: script([message([], "refusal")]).create, model: "test", deps });
    expect(refused.status).toBe("failed");
    const broken = await runAnalysis({
      id: "t12", request, model: "test", deps,
      createMessage: async () => {
        throw new Error("network down");
      },
    });
    expect(broken.status).toBe("failed");
    expect(broken.error).toBe("network down");
  });

  it("sends the model the tools, effort and the refusal fallback", async () => {
    const { create, calls } = happyPath();
    await runAnalysis({ id: "t13", request, createMessage: create, model: "claude-opus-5-5", deps });
    const first = calls[0];
    expect(first.model).toBe("claude-opus-5-5");
    expect(first.fallbacks).toBe("default");
    expect(first.output_config?.effort).toBe("medium");
    const names = (first.tools as { name: string }[]).map((t) => t.name);
    expect(names).toContain("score_uses");
    expect(names).toContain("submit_report");
    expect(JSON.stringify(first.messages[0].content)).toContain(SUBJECT);
  });

  it("leaves out vision tools when the request disables them", async () => {
    const noVision = AnalysisRequest.parse({ ...request, options: { ...request.options, includeInteriorVision: false, includeAerialVision: false } });
    const { create, calls } = script([message([toolUse("submit_report", { opportunities: [], missing: [] })])]);
    await runAnalysis({ id: "t14", request: noVision, createMessage: create, model: "test", deps });
    const names = (calls[0].tools as { name: string }[]).map((t) => t.name);
    expect(names).not.toContain("analyze_interior");
    expect(names).not.toContain("analyze_exterior");
  });
});
