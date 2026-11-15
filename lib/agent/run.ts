/**
 * Server entry point that wires the orchestrator to the real Claude client and the store (AI-01).
 * OWNER: Developer 1.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisRequest, AnalysisResponse } from "@/lib/contracts";
import { STANDARD_DISCLAIMERS } from "@/lib/contracts";
import { agentEnv } from "@/lib/config/env";
import { getMatterportModel, getModelImages } from "@/lib/data/matterport";
import { getNearbyContext } from "@/lib/data/nearby";
import { getProperty, getSpaces, searchProperties } from "@/lib/data/properties";
import { getSaleListings, searchSaleListings } from "@/lib/data/sale-listings";
import { getCurrentTenants } from "@/lib/data/tenants";
import { fetchVexcelImage, getAerialImagery } from "@/lib/data/vexcel";
import { liveDataDeps, type DataModules } from "./data-deps";
import { runAnalysis, type CreateMessage } from "./orchestrator";
import { saveAnalysis } from "./store";
import type { DataDeps } from "./tools";

/** The real lib/data modules (DATA-02…07). */
export const DATA_MODULES: DataModules = {
  searchProperties,
  getProperty,
  getSpaces,
  getCurrentTenants,
  searchSaleListings,
  getSaleListings,
  getNearbyContext,
  getMatterportModel,
  getModelImages,
  getAerialImagery,
  fetchVexcelImage,
  async download(url) {
    // Signed Matterport asset URL: fetched server-side only, never logged or sent to the browser.
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Matterport asset download failed (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  },
};

/** Live tools: CoStar via DuckDB, Matterport, Vexcel, and Claude vision on their images. */
export function liveDeps(createMessage: CreateMessage, visionModel: string): DataDeps {
  return liveDataDeps(DATA_MODULES, { createMessage, visionModel });
}

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
export async function executeAnalysis(id: string, request: AnalysisRequest, deps?: DataDeps): Promise<void> {
  try {
    const env = agentEnv();
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const createMessage: CreateMessage = (params) => client.beta.messages.create(params);
    const result = await runAnalysis({
      id,
      request,
      model: env.ANTHROPIC_MODEL_ORCHESTRATOR,
      createMessage,
      // Vision uses the orchestrator model: reading a fit-out from photos is the hard part.
      deps: deps ?? liveDeps(createMessage, env.ANTHROPIC_MODEL_ORCHESTRATOR),
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
