/**
 * Server entry point that wires the orchestrator to the real Claude client and the store (AI-01).
 * OWNER: Developer 1.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisRequest, AnalysisResponse } from "@/lib/contracts";
import { STANDARD_DISCLAIMERS } from "@/lib/contracts";
import { agentEnv } from "@/lib/config/env";
import { getNearbyContext } from "@/lib/data/nearby";
import { nearbyContextDep } from "./market-tool";
import { runAnalysis } from "./orchestrator";
import { saveAnalysis } from "./store";
import { UNAVAILABLE_DEPS, type DataDeps } from "./tools";

/**
 * Data modules connected so far. The rest fail honestly until INT-02 wires them
 * (search and profile need DATA-02/03, imagery needs DATA-04/05 plus visionDeps).
 */
export const DEFAULT_DEPS: DataDeps = {
  ...UNAVAILABLE_DEPS,
  getNearbyContext: nearbyContextDep({ getNearbyContext }),
};

/** The queued record shown while the analysis starts. */
export function queuedAnalysis(id: string, request: AnalysisRequest): AnalysisResponse {
  return {
    id,
    status: "queued",
    persona: request.input.persona,
    request,
    createdAt: new Date().toISOString(),
    completedAt: null,
    evidence: [],
    evidenceIndex: { verifiedFactIds: [], aiObservationIds: [], userAssumptionIds: [], missingInfoIds: [] },
    opportunities: [],
    marketAnalysis: null,
    financialScenarios: [],
    toolCalls: [],
    disclaimers: [...STANDARD_DISCLAIMERS],
    error: null,
  };
}

/** Run one analysis to completion, saving progress as it goes. Never throws. */
export async function executeAnalysis(id: string, request: AnalysisRequest, deps: DataDeps = DEFAULT_DEPS): Promise<void> {
  try {
    const env = agentEnv();
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const result = await runAnalysis({
      id,
      request,
      model: env.ANTHROPIC_MODEL_ORCHESTRATOR,
      createMessage: (params) => client.beta.messages.create(params),
      deps,
      onUpdate: saveAnalysis,
    });
    saveAnalysis(result);
  } catch (e) {
    saveAnalysis({
      ...queuedAnalysis(id, request),
      status: "failed",
      completedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
