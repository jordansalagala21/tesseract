/**
 * MarketAnalysis, FinancialScenario, Opportunity, AgentToolCall, AnalysisResponse.
 * Producer: Developer 1 (lib/agent, lib/market, lib/finance). Consumer: Developer 3 (UI).
 * OWNER: Developer 1.
 */
import { z } from "zod";
import { IsoDateTime } from "./common";
import { Evidence } from "./evidence";
import { AnalysisRequest, UserPersona } from "./persona";

/* ------------------------------------------------------------------ */
/* Market analysis — ONLY over data we actually have (kit properties). */
/* ------------------------------------------------------------------ */

export const NumericRange = z.object({
  min: z.number().nullable(),
  median: z.number().nullable(),
  max: z.number().nullable(),
});

export const MarketAnalysis = z.object({
  propertyId: z.number().int(),
  radiusMeters: z.number().positive(),
  /** Advertised spaces in OTHER kit properties within radius (not a full market census) */
  comparableSpaces: z.object({
    count: z.number().int(),
    /** Normalized $/SF/yr, only spaces with a published rate; mixed service types flagged */
    askingRentPsfYear: NumericRange,
    serviceTypes: z.array(z.object({ serviceType: z.string(), count: z.number().int() })),
    spaceUses: z.array(z.object({ spaceUse: z.string(), count: z.number().int() })),
  }),
  /** Current tenants of kit buildings within radius (location-occupancy + company-detail) */
  nearbyTenants: z.object({
    count: z.number().int(),
    byIndustry: z.array(z.object({ industry: z.string(), count: z.number().int() })),
  }),
  saleComps: z.object({ count: z.number().int(), withDisclosedPrice: z.number().int() }),
  /** Always populated: what this analysis cannot tell you */
  limitations: z.array(z.string()).min(1),
  evidenceIds: z.array(z.string()),
});
export type MarketAnalysis = z.infer<typeof MarketAnalysis>;

/* ------------------------------------------------------------------ */
/* Financial scenarios — every input is labelled by origin.            */
/* ------------------------------------------------------------------ */

export const Assumption = z.object({
  value: z.number(),
  /** user = typed by user; costar = taken from kit data; default = labelled app default */
  origin: z.enum(["user", "costar", "default"]),
  label: z.string(),
  evidenceId: z.string().optional(),
});
export type Assumption = z.infer<typeof Assumption>;

/** Tenant/business leasing a space (entrepreneur, owner-as-operator) */
export const LeaseScenarioInput = z.object({
  mode: z.literal("lease"),
  spaceSf: Assumption,
  baseRentPsfYear: Assumption,
  /** NNN pass-throughs (taxes, insurance, CAM) $/SF/yr — required when serviceType is NNN */
  nnnPsfYear: Assumption,
  buildOutCostUsd: Assumption,
  monthlyRevenueUsd: Assumption.optional(),
  otherMonthlyOpexUsd: Assumption.optional(),
});

/** Investor acquiring a property */
export const AcquisitionScenarioInput = z.object({
  mode: z.literal("acquisition"),
  purchasePriceUsd: Assumption,
  rentableSf: Assumption,
  marketRentPsfYear: Assumption,
  vacancyAllowancePct: Assumption,
  operatingExpensePsfYear: Assumption,
  capexUsd: Assumption,
  equityUsd: Assumption,
  loanInterestRatePct: Assumption.optional(),
  loanAmortYears: Assumption.optional(),
});

export const FinancialScenarioInput = z.discriminatedUnion("mode", [LeaseScenarioInput, AcquisitionScenarioInput]);
export type FinancialScenarioInput = z.infer<typeof FinancialScenarioInput>;

export const FinancialScenario = z.object({
  id: z.string(),
  name: z.string(),
  input: FinancialScenarioInput,
  /** Outputs are null when an input needed for them is missing */
  output: z.object({
    annualOccupancyCostUsd: z.number().nullable(),
    monthlyOccupancyCostUsd: z.number().nullable(),
    breakEvenMonthlyRevenueUsd: z.number().nullable(),
    netOperatingIncomeUsd: z.number().nullable(),
    capRatePct: z.number().nullable(),
    cashOnCashPct: z.number().nullable(),
    paybackYears: z.number().nullable(),
  }),
  /** Formulas used, shown in the UI for transparency */
  formulas: z.array(z.string()),
  warnings: z.array(z.string()),
  disclaimer: z.literal("Illustrative scenario from labelled assumptions. Not a forecast, appraisal or investment advice."),
});
export type FinancialScenario = z.infer<typeof FinancialScenario>;

/* ------------------------------------------------------------------ */
/* Opportunities                                                        */
/* ------------------------------------------------------------------ */

export const ScoreComponent = z.object({
  /** 0–100, or null when there is insufficient evidence (never guess) */
  score: z.number().min(0).max(100).nullable(),
  rationale: z.string(),
  evidenceIds: z.array(z.string()),
});

export const Opportunity = z.object({
  id: z.string(),
  rank: z.number().int().min(1),
  title: z.string(),
  /** e.g. "restaurant_bar", "fitness_studio", "coworking", "specialty_retail", "medical_office" */
  useCategory: z.string(),
  propertyId: z.number().int(),
  spaceId: z.number().int().nullable(),
  /** owner-operator lease vs investor acquisition — never blended */
  strategy: z.enum(["lease", "acquisition", "reposition"]),
  verdict: z.enum(["promising", "possible", "unlikely", "insufficient_evidence"]),
  summary: z.string(),
  scores: z.object({
    physical: ScoreComponent,
    market: ScoreComponent,
    access: ScoreComponent,
    economic: ScoreComponent,
    /** Weighted composite from lib/market scoring; null if any required component is null */
    overall: z.number().min(0).max(100).nullable(),
  }),
  supportingEvidenceIds: z.array(z.string()),
  blockers: z.array(z.object({ description: z.string(), evidenceIds: z.array(z.string()) })),
  unknowns: z.array(z.string()),
  likelyChanges: z.array(z.string()),
  nextSteps: z.array(z.string()),
  financialScenarioIds: z.array(z.string()),
});
export type Opportunity = z.infer<typeof Opportunity>;

/* ------------------------------------------------------------------ */
/* Agent trace                                                          */
/* ------------------------------------------------------------------ */

export const AgentToolName = z.enum([
  "search_properties",
  "search_available_spaces",
  "get_property_profile",
  "get_nearby_context",
  "get_matterport_model",
  "analyze_interior",
  "get_aerial_imagery",
  "analyze_exterior",
  "score_uses",
  "run_financial_scenario",
]);
export type AgentToolName = z.infer<typeof AgentToolName>;

export const AgentToolCall = z.object({
  id: z.string(),
  step: z.number().int().min(1),
  tool: AgentToolName,
  /** Why the agent chose this tool (one sentence, shown in the investigation timeline) */
  reason: z.string(),
  input: z.record(z.string(), z.unknown()),
  status: z.enum(["pending", "running", "succeeded", "failed", "skipped"]),
  startedAt: IsoDateTime,
  finishedAt: IsoDateTime.nullable(),
  outputSummary: z.string().nullable(),
  evidenceIds: z.array(z.string()),
  error: z.string().nullable(),
});
export type AgentToolCall = z.infer<typeof AgentToolCall>;

/* ------------------------------------------------------------------ */
/* Analysis response                                                    */
/* ------------------------------------------------------------------ */

export const AnalysisStatus = z.enum(["queued", "running", "completed", "failed"]);

export const AnalysisResponse = z
  .object({
    id: z.string(),
    status: AnalysisStatus,
    persona: UserPersona,
    request: AnalysisRequest,
    createdAt: IsoDateTime,
    completedAt: IsoDateTime.nullable(),
    /** All evidence; each item is exactly one of the four kinds */
    evidence: z.array(Evidence),
    /** Convenience index so the UI can render the four buckets without filtering */
    evidenceIndex: z.object({
      verifiedFactIds: z.array(z.string()),
      aiObservationIds: z.array(z.string()),
      userAssumptionIds: z.array(z.string()),
      missingInfoIds: z.array(z.string()),
    }),
    opportunities: z.array(Opportunity),
    marketAnalysis: MarketAnalysis.nullable(),
    financialScenarios: z.array(FinancialScenario),
    toolCalls: z.array(AgentToolCall),
    disclaimers: z.array(z.string()).min(1),
    error: z.string().nullable(),
  })
  .superRefine((r, ctx) => {
    const byId = new Map(r.evidence.map((e) => [e.id, e.kind]));
    if (byId.size !== r.evidence.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate evidence ids", path: ["evidence"] });
    }
    const buckets = [
      ["verifiedFactIds", "verified_fact"],
      ["aiObservationIds", "ai_observation"],
      ["userAssumptionIds", "user_assumption"],
      ["missingInfoIds", "missing"],
    ] as const;
    for (const [key, kind] of buckets) {
      for (const id of r.evidenceIndex[key]) {
        if (byId.get(id) !== kind) {
          ctx.addIssue({ code: "custom", message: `${id} is not a ${kind}`, path: ["evidenceIndex", key] });
        }
      }
    }
    const referenced = [
      ...r.opportunities.flatMap((o) => [
        ...o.supportingEvidenceIds,
        ...o.blockers.flatMap((b) => b.evidenceIds),
        ...Object.values(o.scores).flatMap((s) => (s && typeof s === "object" ? s.evidenceIds : [])),
      ]),
      ...(r.marketAnalysis?.evidenceIds ?? []),
      ...r.toolCalls.flatMap((t) => t.evidenceIds),
    ];
    for (const id of referenced) {
      if (!byId.has(id)) ctx.addIssue({ code: "custom", message: `Unknown evidence id referenced: ${id}` });
    }
  });
export type AnalysisResponse = z.infer<typeof AnalysisResponse>;

export const STANDARD_DISCLAIMERS = [
  "Advertised availability is not confirmed physical vacancy.",
  "AI observations from imagery are preliminary and are not measurements, inspections, or code/zoning determinations.",
  "Financial figures are illustrative scenarios built from labelled assumptions, not forecasts or investment advice.",
  "Coverage is limited to properties in the CoStar hackathon kit (Houston and Los Angeles).",
] as const;
