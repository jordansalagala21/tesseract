/**
 * Agent tools (AI-01). OWNER: Developer 1.
 *
 * Each tool has a Zod input schema (also sent to Claude as JSON Schema), and a handler.
 * Data access is injected as `DataDeps` so the agent never fabricates data: until a data module
 * lands (DATA-03/04/05/07, AI-02), its tool fails honestly and the analysis records the gap.
 *
 * `score_uses` and `run_financial_scenario` are implemented here on top of lib/market and lib/finance:
 * the scores and numbers are deterministic, the model only chooses what to evaluate.
 */
import { z } from "zod";
import { FinancialScenarioInput, type AgentToolName, type FinancialScenario, type MarketAnalysis } from "@/lib/contracts";
import { runScenario } from "@/lib/finance";
import { scoreUse, type MarketSignals, type ScoreResult, type SiteFacts, type UserPreferences, type Weights } from "@/lib/market/scoring";
import { USE_CATEGORIES, type UseCategory } from "@/lib/market/uses";
import type { EvidenceDraft, EvidenceRegistry } from "./evidence";

/* -------------------------------------------------------------- subjects */

/** A subject is what gets scored: a property (`p1018657`) or one space in it (`p1018657-s21053094`). */
export const subjectKey = (propertyId: number, spaceId?: number | null) =>
  spaceId ? `p${propertyId}-s${spaceId}` : `p${propertyId}`;

export function parseSubject(key: string): { propertyId: number; spaceId: number | null } | null {
  const m = /^p(\d+)(?:-s(\d+))?$/.exec(key);
  return m ? { propertyId: Number(m[1]), spaceId: m[2] ? Number(m[2]) : null } : null;
}

/* ------------------------------------------------------------ tool output */

/** Market signals keyed so that per-use counts stay separate. */
export interface MarketContext {
  comparableRent?: MarketSignals["comparableRent"];
  byUse?: Partial<Record<UseCategory, Omit<MarketSignals, "comparableRent">>>;
}

/** What a data tool returns. Evidence ids in `facts`/`market` refer to draft ids in `evidence`. */
export interface ToolOutput {
  /** One line for the investigation timeline. */
  summary: string;
  evidence: EvidenceDraft[];
  /** Facts about a subject for scoring, keyed by subjectKey(). */
  facts?: Record<string, SiteFacts>;
  market?: Record<string, MarketContext>;
  /** The dashboard's market analysis for one property (AI-04). Its evidenceIds are draft ids. */
  marketAnalysis?: MarketAnalysis;
  /** Extra structured data returned to the model (ids, lists). Keep it small. */
  data?: unknown;
}

export class ToolUnavailableError extends Error {}

/* ------------------------------------------------------------ data deps */

export const PropertyRef = z.object({ propertyId: z.number().int(), spaceId: z.number().int().optional() });

export interface DataDeps {
  searchProperties(input: { query?: string; market?: string; hasAvailableSpace?: boolean; forSale?: boolean; maxAskingPriceUsd?: number; limit?: number }): Promise<ToolOutput>;
  searchAvailableSpaces(input: { market?: string; sfMin?: number; sfMax?: number; maxRentPsfYear?: number; spaceUses?: string[]; limit?: number }): Promise<ToolOutput>;
  getPropertyProfile(input: { propertyId: number; spaceId?: number }): Promise<ToolOutput>;
  getNearbyContext(input: { propertyId: number; spaceId?: number; radiusMeters?: number; useCategories?: UseCategory[] }): Promise<ToolOutput>;
  getMatterportModel(input: { propertyId: number; spaceId?: number }): Promise<ToolOutput>;
  analyzeInterior(input: { propertyId: number; spaceId?: number }): Promise<ToolOutput>;
  getAerialImagery(input: { propertyId: number }): Promise<ToolOutput>;
  analyzeExterior(input: { propertyId: number }): Promise<ToolOutput>;
}

const unavailable = (what: string, issue: string) => async (): Promise<ToolOutput> => {
  throw new ToolUnavailableError(`${what} is not connected yet (${issue}).`);
};

/** Honest defaults until the data modules land: every data tool fails with a clear reason. */
export const UNAVAILABLE_DEPS: DataDeps = {
  searchProperties: unavailable("Property search", "DATA-02"),
  searchAvailableSpaces: unavailable("Space search", "DATA-02"),
  getPropertyProfile: unavailable("Property lookup", "DATA-03"),
  getNearbyContext: unavailable("Nearby context", "DATA-07"),
  getMatterportModel: unavailable("Matterport metadata", "DATA-04"),
  analyzeInterior: unavailable("Interior vision", "AI-02"),
  getAerialImagery: unavailable("Vexcel imagery", "DATA-05"),
  analyzeExterior: unavailable("Exterior vision", "AI-02"),
};

/* -------------------------------------------------------- analysis state */

export interface AgentState {
  evidence: EvidenceRegistry;
  facts: Record<string, SiteFacts>;
  market: Record<string, MarketContext>;
  /** Market analyses by propertyId, evidence ids already registered. */
  marketAnalyses: Record<number, MarketAnalysis>;
  preferences: UserPreferences;
  weights?: Partial<Weights>;
  /** Owners have no budget: allow an overall score without economics (verdict capped). */
  economicOptional?: boolean;
  scores: Record<string, Partial<Record<UseCategory, ScoreResult>>>;
  scenarios: FinancialScenario[];
  newId: (prefix: string) => string;
}

/* ---------------------------------------------------------- definitions */

const reason = z.string().min(1).describe("One plain sentence: why you are calling this tool now. Shown to the user.");
const useCategory = z.enum(USE_CATEGORIES as [UseCategory, ...UseCategory[]]);

export const TOOL_INPUTS = {
  search_properties: z.object({
    reason,
    query: z.string().optional().describe("Address or building name text"),
    market: z.enum(["houston", "los_angeles"]).optional(),
    hasAvailableSpace: z.boolean().optional(),
    forSale: z.boolean().optional().describe("Only buildings listed for sale (asking price, asking cap rate, NOI when the listing states them)."),
    maxAskingPriceUsd: z.number().positive().optional().describe("With forSale: only listings with a disclosed asking price at or below this."),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  search_available_spaces: z.object({
    reason,
    market: z.enum(["houston", "los_angeles"]).optional(),
    sfMin: z.number().positive().optional(),
    sfMax: z.number().positive().optional(),
    maxRentPsfYear: z.number().positive().optional(),
    spaceUses: z
      .array(z.enum(["Retail", "Office", "OfficeRetail", "Medical", "OfficeMedical", "Flex", "Industrial"]))
      .optional()
      .describe("CoStar space uses to include, e.g. [\"Retail\"] for a café or shop. Omit for any use."),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  get_property_profile: PropertyRef.extend({ reason }),
  get_nearby_context: PropertyRef.extend({
    reason,
    radiusMeters: z.number().int().min(100).max(5000).optional(),
    useCategories: z.array(useCategory).optional(),
  }),
  get_matterport_model: PropertyRef.extend({ reason }),
  analyze_interior: PropertyRef.extend({ reason }),
  get_aerial_imagery: z.object({ reason, propertyId: z.number().int() }),
  analyze_exterior: z.object({ reason, propertyId: z.number().int() }),
  score_uses: z.object({
    reason,
    subject: z.string().describe("Subject key from an earlier tool result, e.g. p1018657-s21053094"),
    useCategories: z.array(useCategory).min(1),
  }),
  run_financial_scenario: z.object({
    reason,
    name: z.string().min(1),
    input: FinancialScenarioInput,
  }),
} satisfies Record<AgentToolName, z.ZodType>;

const DESCRIPTIONS: Record<AgentToolName, string> = {
  search_properties: "Search CoStar kit properties (Houston and Los Angeles only) by text and filters.",
  search_available_spaces: "Find advertised lease spaces matching size, rent and market. Advertised availability is not confirmed vacancy.",
  get_property_profile: "Load CoStar facts for a property (and optionally one advertised space): type, size, ceiling, frontage, advertised spaces and rents, current tenants.",
  get_nearby_context: "Nearby advertised rents and tenants from the CoStar kit around a property. Kit buildings only, not a full market census.",
  get_matterport_model: "Matterport 3D model metadata for a property or suite: rooms, scanned area, link method.",
  analyze_interior: "Vision analysis of the Matterport interior photos and floor plan. Returns AI observations, never measurements or code findings.",
  get_aerial_imagery: "Vexcel aerial imagery references for a property.",
  analyze_exterior: "Vision analysis of Vexcel aerial images: parking, access, corner, neighbours. AI observations only.",
  score_uses: "Deterministically score candidate uses for a subject from the facts gathered so far. You cannot set scores; this tool does.",
  run_financial_scenario: "Run a lease OR acquisition scenario from labelled assumptions. Every assumption needs origin user|costar|default; costar assumptions must cite a verified_fact evidenceId.",
};

/** The final-report tool. Not an AgentToolName: it is how the agent finishes, not an investigation step. */
export const SUBMIT_REPORT = "submit_report";
export const ReportInput = z.object({
  opportunities: z
    .array(
      z.object({
        subject: z.string(),
        useCategory,
        title: z.string().min(1),
        summary: z.string().min(1).describe("2-3 sentences explaining the scores; cite only facts you were given"),
        strategy: z.enum(["lease", "acquisition", "reposition"]),
        supportingEvidenceIds: z.array(z.string()),
        unknowns: z.array(z.string()),
        likelyChanges: z.array(z.string()),
        nextSteps: z.array(z.string()),
        financialScenarioIds: z.array(z.string()),
      }),
    )
    .describe("One entry per use you scored and want to present. Ranking is done by score, not by order."),
  missing: z
    .array(z.object({ statement: z.string(), whyNeeded: z.string(), howToResolve: z.string().optional() }))
    .describe("Information the decision needs but no tool could provide"),
});
export type ReportInput = z.infer<typeof ReportInput>;

function schemaOf(t: z.ZodType) {
  const { $schema: _drop, ...schema } = z.toJSONSchema(t, { target: "draft-2020-12" }) as Record<string, unknown>;
  void _drop;
  return schema as { type: "object"; [k: string]: unknown };
}

export function toolDefinitions(names: AgentToolName[]) {
  return [
    ...names.map((name) => ({ name, description: DESCRIPTIONS[name], input_schema: schemaOf(TOOL_INPUTS[name]) })),
    {
      name: SUBMIT_REPORT,
      description: "Submit the final opportunities once you have scored the uses. Call exactly once, at the end.",
      input_schema: schemaOf(ReportInput),
    },
  ];
}

/* ------------------------------------------------------------- handlers */

export interface ToolResult {
  summary: string;
  evidenceIds: string[];
  /** JSON returned to the model. */
  forModel: unknown;
}

/** Register a data tool's evidence and remap the draft ids its facts refer to. */
function absorb(state: AgentState, out: ToolOutput): ToolResult {
  const map = new Map<string, string>();
  const ids = out.evidence.map((d) => {
    const id = state.evidence.add(d);
    if (d.id) map.set(d.id, id);
    return id;
  });
  const remap = <T extends { evidenceId: string }>(f: T): T => ({ ...f, evidenceId: map.get(f.evidenceId) ?? f.evidenceId });
  const remapObj = <O extends object>(o: O): O =>
    Object.fromEntries(
      Object.entries(o).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.map(remap) : v && typeof v === "object" && "evidenceId" in v ? remap(v as { evidenceId: string }) : v,
      ]),
    ) as O;

  for (const [subject, facts] of Object.entries(out.facts ?? {})) {
    state.facts[subject] = { ...state.facts[subject], ...remapObj(facts) };
  }
  for (const [subject, ctx] of Object.entries(out.market ?? {})) {
    // Merge per use, signal by signal: the profile's "same category in the building" and the
    // nearby tool's industry counts are different signals for the same use and must both survive.
    const prev = state.market[subject]?.byUse ?? {};
    const byUse = { ...prev };
    for (const [u, sig] of Object.entries(ctx.byUse ?? {}) as [UseCategory, Omit<MarketSignals, "comparableRent">][]) {
      byUse[u] = { ...prev[u], ...remapObj(sig) };
    }
    state.market[subject] = {
      comparableRent: ctx.comparableRent ? remap(ctx.comparableRent) : state.market[subject]?.comparableRent,
      byUse,
    };
  }
  if (out.marketAnalysis) {
    const a = out.marketAnalysis;
    state.marketAnalyses[a.propertyId] = { ...a, evidenceIds: a.evidenceIds.map((id) => map.get(id) ?? id) };
  }
  return {
    summary: out.summary,
    evidenceIds: ids,
    forModel: {
      summary: out.summary,
      evidence: state.evidence.summaryFor(ids),
      subjects: Object.keys(out.facts ?? {}),
      data: out.data ?? null,
    },
  };
}

/** Score uses for one subject from the facts gathered so far. Also used by the orchestrator's safety net. */
export function scoreSubject(state: AgentState, input: { subject: string; useCategories: UseCategory[] }): ToolResult {
  return scoreUses(state, input);
}

function scoreUses(state: AgentState, input: { subject: string; useCategories: UseCategory[] }): ToolResult {
  // Property-level facts (e.g. aerial observations) apply to every space in the property.
  const parent = parseSubject(input.subject);
  const propertyFacts = parent?.spaceId ? state.facts[subjectKey(parent.propertyId)] : undefined;
  if (!state.facts[input.subject] && !propertyFacts) {
    throw new Error(`No facts gathered for subject ${input.subject}. Load the property profile first.`);
  }
  const site = { ...propertyFacts, ...state.facts[input.subject] };
  // A property's market context applies to every space in it unless the space has its own.
  const ctx = state.market[input.subject] ?? (parent?.spaceId ? state.market[subjectKey(parent.propertyId)] : undefined);
  const results = input.useCategories.map((use) => {
    const r = scoreUse({
      use,
      site,
      market: { comparableRent: ctx?.comparableRent, ...ctx?.byUse?.[use] },
      preferences: state.preferences,
      weights: state.weights,
      economicOptional: state.economicOptional,
    });
    (state.scores[input.subject] ??= {})[use] = r;
    return r;
  });
  const fmt = (n: number | null) => (n === null ? "n/a" : String(n));
  return {
    summary: results.map((r) => `${r.use}: ${fmt(r.scores.overall)} (${r.verdict})`).join("; "),
    evidenceIds: [...new Set(results.flatMap((r) => Object.values(r.scores).flatMap((s) => (s && typeof s === "object" ? s.evidenceIds : []))))],
    forModel: results.map((r) => ({
      use: r.use,
      verdict: r.verdict,
      scores: r.scores,
      blockers: r.blockers,
      notes: r.notes,
    })),
  };
}

function financialScenario(state: AgentState, input: z.infer<(typeof TOOL_INPUTS)["run_financial_scenario"]>): ToolResult {
  // Integrity: an assumption claiming to come from CoStar must cite a verified fact we actually hold.
  for (const [field, a] of Object.entries(input.input)) {
    if (a && typeof a === "object" && "origin" in a && a.origin === "costar") {
      const ev = a.evidenceId ? state.evidence.get(a.evidenceId) : undefined;
      if (!ev || ev.kind !== "verified_fact") {
        throw new Error(`Assumption "${field}" has origin "costar" but does not cite a verified_fact evidenceId. Use origin "user" or "default" instead.`);
      }
    }
  }
  const scenario = runScenario(input.input, { id: state.newId("scn"), name: input.name });
  state.scenarios.push(scenario);
  const evidenceIds = state.evidence.known(
    Object.values(input.input).flatMap((a) => (a && typeof a === "object" && "evidenceId" in a && a.evidenceId ? [a.evidenceId] : [])),
  );
  const o = scenario.output;
  const parts = [
    o.annualOccupancyCostUsd !== null && `occupancy $${o.annualOccupancyCostUsd.toLocaleString("en-US")}/yr`,
    o.breakEvenMonthlyRevenueUsd !== null && `break-even $${o.breakEvenMonthlyRevenueUsd.toLocaleString("en-US")}/mo`,
    o.capRatePct !== null && `cap rate ${o.capRatePct}%`,
    o.cashOnCashPct !== null && `cash-on-cash ${o.cashOnCashPct}%`,
  ].filter(Boolean);
  return {
    summary: `${scenario.name}: ${parts.join(", ") || "not enough inputs"}`,
    evidenceIds,
    forModel: { scenarioId: scenario.id, output: scenario.output, warnings: scenario.warnings },
  };
}

export async function runTool(name: AgentToolName, rawInput: unknown, state: AgentState, deps: DataDeps): Promise<ToolResult> {
  const parsed = TOOL_INPUTS[name].safeParse(rawInput);
  if (!parsed.success) throw new Error(`Invalid input for ${name}: ${z.prettifyError(parsed.error)}`);
  const { reason: _r, ...input } = parsed.data as { reason: string } & Record<string, unknown>;
  void _r;

  switch (name) {
    case "search_properties":
      return absorb(state, await deps.searchProperties(input));
    case "search_available_spaces":
      return absorb(state, await deps.searchAvailableSpaces(input));
    case "get_property_profile":
      return absorb(state, await deps.getPropertyProfile(input as z.infer<typeof PropertyRef>));
    case "get_nearby_context":
      return absorb(state, await deps.getNearbyContext(input as Parameters<DataDeps["getNearbyContext"]>[0]));
    case "get_matterport_model":
      return absorb(state, await deps.getMatterportModel(input as z.infer<typeof PropertyRef>));
    case "analyze_interior":
      return absorb(state, await deps.analyzeInterior(input as z.infer<typeof PropertyRef>));
    case "get_aerial_imagery":
      return absorb(state, await deps.getAerialImagery(input as { propertyId: number }));
    case "analyze_exterior":
      return absorb(state, await deps.analyzeExterior(input as { propertyId: number }));
    case "score_uses":
      return scoreUses(state, parsed.data as z.infer<(typeof TOOL_INPUTS)["score_uses"]>);
    case "run_financial_scenario":
      return financialScenario(state, parsed.data as z.infer<(typeof TOOL_INPUTS)["run_financial_scenario"]>);
  }
}
