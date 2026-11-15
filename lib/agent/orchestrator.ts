/**
 * Agent orchestration (AI-01). OWNER: Developer 1.
 *
 * A manual Claude tool-use loop (we need per-call records with reasons, timing and evidence,
 * a hard step limit, and failed tools that don't stop the analysis).
 *
 * Division of labour:
 *  - Claude decides what to investigate and writes the explanations.
 *  - Tools return cited evidence; lib/market scores uses; lib/finance computes scenarios.
 *  - Claude never sets a score, a verdict or a number. Opportunities are ranked by score.
 */
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  AnalysisResponse,
  STANDARD_DISCLAIMERS,
  type AgentToolCall,
  type AgentToolName,
  type AnalysisRequest,
  type Opportunity,
} from "@/lib/contracts";
import { AgentToolName as ToolNameSchema } from "@/lib/contracts";
import { USES } from "@/lib/market/uses";
import { allowedStrategies, orderForPersona, personaPrompt, personaWeights } from "./personas";
import { EvidenceRegistry, type EvidenceDraft } from "./evidence";
import {
  ReportInput,
  SUBMIT_REPORT,
  ToolUnavailableError,
  UNAVAILABLE_DEPS,
  parseSubject,
  runTool,
  toolDefinitions,
  type AgentState,
  type DataDeps,
} from "./tools";


/** The one SDK call the orchestrator makes; injectable so tests can script Claude. */
export type CreateMessage = (params: MessageCreateParamsNonStreaming) => Promise<BetaMessage>;

export interface RunOptions {
  id: string;
  request: AnalysisRequest;
  createMessage: CreateMessage;
  model: string;
  deps?: DataDeps;
  now?: () => string;
  /** Called with a fresh snapshot after every step, so pollers see live progress. */
  onUpdate?: (snapshot: AnalysisResponse) => void;
}

const SYSTEM_PROMPT = `You are Tesseract's investigation agent. You help people discover evidence-backed alternative uses for commercial space, using CoStar data, Matterport 3D scans and Vexcel aerial imagery.

How to work:
- Investigate with the tools, then call score_uses for the candidate uses that fit, then call submit_report once.
- Every tool call needs a short "reason" sentence; the user sees it in a live timeline.
- Only state what the tools returned. Cite evidence ids exactly as given. If something is unknown, say so and list it under missing; never estimate demographics, foot traffic, competitor counts, property values, rents or returns.
- You do not set scores or verdicts. score_uses does. Explain its results in plain language.
- "Advertised available" is not "vacant". Never call a space vacant.
- Vision results are AI observations, not measurements, inspections, or code or zoning findings.
- Leasing and acquisition are separate strategies; never blend them in one opportunity or scenario.
- If a tool fails or is not connected, carry on with what you have and list the gap under missing.
- Financial scenarios: label every assumption honestly (origin user, costar or default). Use origin costar only with the evidenceId of a CoStar verified fact.
- Keep summaries short and concrete. Write for a property owner, not an analyst.`;

const nowIso = () => new Date().toISOString();

/** Seed evidence from the user's own inputs, so scoring can cite it. */
function seedUserEvidence(request: AnalysisRequest, state: AgentState) {
  const i = request.input;
  if (i.persona === "entrepreneur" && i.maxRentPsfYear) {
    const draft: EvidenceDraft = {
      kind: "user_assumption",
      id: "ev_user_budget",
      origin: "user",
      statement: `Rent budget up to $${i.maxRentPsfYear}/SF/yr`,
      value: i.maxRentPsfYear,
      unit: "$/SF/yr",
      sources: [{ system: "user" }],
    };
    const id = state.evidence.add(draft);
    state.preferences.maxRentPsfYear = { value: i.maxRentPsfYear, evidenceId: id };
  }
}

function toolsFor(request: AnalysisRequest): AgentToolName[] {
  return ToolNameSchema.options.filter(
    (t) =>
      (request.options.includeInteriorVision || t !== "analyze_interior") &&
      (request.options.includeAerialVision || t !== "analyze_exterior"),
  );
}

/** Turn the model's report plus the deterministic scores into contract Opportunities, ranked by score. */
/**
 * Turn the model's report plus the deterministic scores into contract Opportunities (AI-03).
 * Rules: only scored (subject, use) pairs; only strategies the persona allows; every opportunity
 * cites at least one verified fact; invented evidence ids are dropped; each use's key checks are
 * always listed as unknowns. Ranking is by score (grouped by strategy for investors).
 */
function buildOpportunities(report: ReportInput | null, state: AgentState, request: AnalysisRequest): Opportunity[] {
  if (!report) return [];
  const scenarioIds = new Set(state.scenarios.map((s) => s.id));
  const allowed = new Set(allowedStrategies(request.input));
  const isVerified = (id: string) => state.evidence.get(id)?.kind === "verified_fact";
  const seen = new Set<string>();
  const built: Opportunity[] = [];
  for (const o of report.opportunities) {
    const subject = parseSubject(o.subject);
    const scored = state.scores[o.subject]?.[o.useCategory];
    const key = `${o.subject}|${o.useCategory}|${o.strategy}`;
    if (!subject || !scored || seen.has(key) || !allowed.has(o.strategy)) continue;

    // Every opportunity must rest on at least one verified fact: the model's citations first,
    // then the verified facts the deterministic scores used.
    const scoreEvidence = Object.values(scored.scores).flatMap((c) => (c && typeof c === "object" ? c.evidenceIds : []));
    const cited = state.evidence.known(o.supportingEvidenceIds);
    const supporting = cited.some(isVerified) ? cited : state.evidence.known([...cited, ...scoreEvidence.filter(isVerified)]);
    if (!supporting.some(isVerified)) continue;

    seen.add(key);
    const checks = USES[o.useCategory].keyChecks.filter((c) => !o.unknowns.some((u) => u.toLowerCase() === c.toLowerCase()));
    // An overall formed without economics says so first, where the owner will read it.
    const economicGap =
      scored.scores.overall !== null && scored.scores.economic.score === null
        ? [`Economics not assessed: ${scored.scores.economic.rationale.replace(/^Insufficient evidence: /, "")} The verdict is capped at "possible" until rent evidence exists.`]
        : [];
    built.push({
      id: "",
      rank: 1,
      title: o.title,
      useCategory: o.useCategory,
      propertyId: subject.propertyId,
      spaceId: subject.spaceId,
      strategy: o.strategy,
      verdict: scored.verdict,
      summary: o.summary,
      scores: scored.scores,
      supportingEvidenceIds: supporting,
      blockers: scored.blockers.map(({ description, evidenceIds }) => ({ description, evidenceIds })),
      unknowns: [...economicGap, ...o.unknowns, ...checks],
      likelyChanges: o.likelyChanges,
      nextSteps: o.nextSteps,
      financialScenarioIds: o.financialScenarioIds.filter((id) => scenarioIds.has(id)),
    });
  }
  return orderForPersona(request.input, built)
    .slice(0, request.options.maxCandidates)
    .map((o, i) => ({ ...o, rank: i + 1, id: `opp_${i + 1}` }));
}

/** Facts the kit never has, recorded up front so no analysis implies they were checked. */
function seedStandingGaps(state: AgentState) {
  state.evidence.add({
    kind: "missing",
    id: "ev_missing_permitted_use",
    statement: "Permitted uses and zoning for this site are not verified",
    whyNeeded: "A new use must be allowed by zoning, permits and any lease or deed restrictions.",
    howToResolve: "Confirm with the city's planning department and the listing broker.",
    sources: [],
  });
}

/** A data tool that failed leaves a gap; record it once per tool so it can't be silently forgotten. */
function recordToolGap(state: AgentState, tool: AgentToolName, message: string) {
  const id = `ev_missing_${tool}`;
  if (state.evidence.has(id)) return;
  state.evidence.add({
    kind: "missing",
    id,
    statement: `${TOOL_GAP_LABELS[tool]} could not be checked`,
    whyNeeded: message,
    sources: [],
  });
}

const TOOL_GAP_LABELS: Record<AgentToolName, string> = {
  search_properties: "Property search",
  search_available_spaces: "Advertised-space search",
  get_property_profile: "CoStar property facts",
  get_nearby_context: "Nearby rents and tenants",
  get_matterport_model: "Matterport 3D model details",
  analyze_interior: "Interior condition and build-out",
  get_aerial_imagery: "Aerial imagery",
  analyze_exterior: "Site access from aerial imagery",
  score_uses: "Use scoring",
  run_financial_scenario: "Financial scenario",
};

/** The owner's own property; otherwise the first property analysed (the contract holds one). */
function pickMarketAnalysis(state: AgentState, request: AnalysisRequest): AnalysisResponse["marketAnalysis"] {
  const i = request.input;
  if (i.persona === "owner") return state.marketAnalyses[i.propertyId] ?? null;
  return Object.values(state.marketAnalyses)[0] ?? null;
}

export async function runAnalysis(opts: RunOptions): Promise<AnalysisResponse> {
  const now = opts.now ?? nowIso;
  const deps = opts.deps ?? UNAVAILABLE_DEPS;
  const { request } = opts;
  const createdAt = now();
  let idCounter = 0;
  const state: AgentState = {
    evidence: new EvidenceRegistry(now),
    facts: {},
    market: {},
    marketAnalyses: {},
    preferences: {},
    scores: {},
    scenarios: [],
    newId: (prefix) => `${prefix}_${opts.id}_${++idCounter}`,
  };
  const toolCalls: AgentToolCall[] = [];
  let report: ReportInput | null = null;
  let error: string | null = null;

  const snapshot = (status: AnalysisResponse["status"]): AnalysisResponse => ({
    id: opts.id,
    status,
    persona: request.input.persona,
    request,
    createdAt,
    completedAt: status === "completed" || status === "failed" ? now() : null,
    evidence: state.evidence.all(),
    evidenceIndex: state.evidence.index(),
    opportunities: status === "completed" ? buildOpportunities(report, state, request) : [],
    marketAnalysis: pickMarketAnalysis(state, request),
    financialScenarios: [...state.scenarios],
    toolCalls: [...toolCalls],
    disclaimers: [...STANDARD_DISCLAIMERS],
    error,
  });
  const publish = () => opts.onUpdate?.(snapshot("running"));

  state.weights = personaWeights(request.input);
  state.economicOptional = request.input.persona === "owner";
  seedStandingGaps(state);
  seedUserEvidence(request, state);
  const tools = toolDefinitions(toolsFor(request));
  const messages: BetaMessageParam[] = [{ role: "user", content: personaPrompt(request) }];
  let steps = 0;
  let nudged = false;

  try {
    // Each loop turn is one model call. The step budget counts investigation tool calls.
    for (let turn = 0; turn < request.options.maxAgentSteps + 4; turn++) {
      const response = await opts.createMessage({
        model: opts.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: tools as BetaTool[],
        messages,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      if (response.stop_reason === "refusal") {
        throw new Error("The model declined this request.");
      }
      messages.push({ role: "assistant", content: response.content as BetaContentBlockParam[] });

      const toolUses = response.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) {
        if (report || nudged) break;
        nudged = true;
        messages.push({ role: "user", content: `Now call ${SUBMIT_REPORT} with your opportunities.` });
        continue;
      }

      const results: BetaToolResultBlockParam[] = [];
      for (const use of toolUses) {
        if (use.name === SUBMIT_REPORT) {
          const parsed = ReportInput.safeParse(use.input);
          if (parsed.success) {
            report = parsed.data;
            for (const m of parsed.data.missing) {
              state.evidence.add({ kind: "missing", statement: m.statement, whyNeeded: m.whyNeeded, howToResolve: m.howToResolve, sources: [] });
            }
            results.push({ type: "tool_result", tool_use_id: use.id, content: "Report received." });
          } else {
            results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `Invalid report: ${parsed.error.message}` });
          }
          continue;
        }

        const name = ToolNameSchema.safeParse(use.name);
        const input = (use.input ?? {}) as Record<string, unknown>;
        const reasonText = typeof input.reason === "string" && input.reason ? input.reason : "No reason given.";
        if (!name.success) {
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `Unknown tool ${use.name}.` });
          continue;
        }

        const call: AgentToolCall = {
          id: `tc_${toolCalls.length + 1}`,
          step: toolCalls.length + 1,
          tool: name.data,
          reason: reasonText,
          input: Object.fromEntries(Object.entries(input).filter(([k]) => k !== "reason")),
          status: "running",
          startedAt: now(),
          finishedAt: null,
          outputSummary: null,
          evidenceIds: [],
          error: null,
        };

        if (steps >= request.options.maxAgentSteps) {
          toolCalls.push({ ...call, status: "skipped", finishedAt: now(), error: "Step limit reached." });
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `Step limit reached. Call ${SUBMIT_REPORT} now.` });
          continue;
        }
        steps++;
        toolCalls.push(call);
        publish();

        try {
          const r = await runTool(name.data, use.input, state, deps);
          Object.assign(call, { status: "succeeded", finishedAt: now(), outputSummary: r.summary, evidenceIds: r.evidenceIds });
          results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(r.forModel) });
        } catch (e) {
          // A failed tool is recorded and the investigation continues.
          const message = e instanceof Error ? e.message : String(e);
          Object.assign(call, { status: "failed", finishedAt: now(), error: message });
          if (e instanceof ToolUnavailableError) recordToolGap(state, name.data, message);
          const hint = e instanceof ToolUnavailableError ? " Continue without it and list the gap under missing." : "";
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: message + hint });
        }
        publish();
      }

      // All tool results go back in one user message.
      messages.push({ role: "user", content: results });
      if (report) break;
    }
    if (!report) error = "The agent finished without submitting a report.";
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const final = snapshot(report && !error ? "completed" : "failed");
  const checked = AnalysisResponse.safeParse(final);
  if (checked.success) return checked.data;
  // Never return an invalid response: keep the investigation record, drop what failed validation.
  return { ...final, status: "failed", opportunities: [], error: `Response failed validation: ${checked.error.message}` };
}
