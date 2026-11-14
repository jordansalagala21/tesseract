/**
 * Internal Tesseract API — request/response schemas for every route.
 * These are APPLICATION endpoints (Next.js route handlers), not CoStar/Matterport/Vexcel endpoints.
 * Frontend and data workstreams develop independently against these.
 * OWNER: Developer 1.
 */
import { z } from "zod";
import { Market } from "./common";
import { AerialImagery, MatterportModel } from "./imagery";
import { AvailableSpace, Property, PropertySummary } from "./property";
import { AnalysisRequest } from "./persona";
import { AnalysisResponse, AnalysisStatus, FinancialScenario, FinancialScenarioInput, MarketAnalysis } from "./analysis";

/* GET /api/properties ------------------------------------------------ */
export const PropertySearchQuery = z.object({
  q: z.string().optional(),
  market: Market.optional(),
  propertyType: z.string().optional(),
  /** Exclude multifamily by default — Tesseract focuses on commercial space */
  includeMultifamily: z.stringbool().default(false),
  hasAvailableSpace: z.stringbool().optional(),
  hasMatterport: z.stringbool().optional(),
  /** "lat,lon,radiusMeters" */
  near: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export const PropertySearchResponse = z.object({
  items: z.array(PropertySummary),
  total: z.number().int(),
});

/* GET /api/properties/[id] ------------------------------------------- */
export const PropertyDetailResponse = z.object({
  property: Property,
  matterportModels: z.array(MatterportModel),
  /** May be empty if Vexcel not yet fetched; UI requests imagery lazily */
  aerial: z.array(AerialImagery),
  currentTenants: z.array(
    z.object({
      name: z.string().nullable(),
      industry: z.string().nullable(),
      suite: z.string().nullable(),
      squareFeet: z.number().nullable(),
      since: z.string().nullable(),
    }),
  ),
});

/* GET /api/properties/[id]/spaces ------------------------------------ */
export const PropertySpacesResponse = z.object({
  propertyId: z.number().int(),
  items: z.array(AvailableSpace),
  /** Always rendered by the UI near the list */
  availabilityNote: z.literal("Advertised availability from CoStar listings — not confirmed physical vacancy."),
});

/* POST /api/analyze --------------------------------------------------- */
export const AnalyzeRequestBody = AnalysisRequest;
export const AnalyzeAcceptedResponse = z.object({
  analysisId: z.string(),
  status: AnalysisStatus,
  /** Poll GET /api/analysis/[id]; optional SSE stream for live tool calls */
  pollUrl: z.string(),
  streamUrl: z.string().optional(),
});

/* POST /api/market/analyze ------------------------------------------- */
export const MarketAnalyzeRequest = z.object({
  propertyId: z.number().int(),
  radiusMeters: z.number().int().min(100).max(10000).default(1500),
  spaceUse: z.string().optional(),
});
export const MarketAnalyzeResponse = MarketAnalysis;

/* POST /api/finance/scenario ----------------------------------------- */
export const FinanceScenarioRequest = z.object({
  name: z.string().default("Scenario"),
  input: FinancialScenarioInput,
});
export const FinanceScenarioResponse = FinancialScenario;

/* GET /api/analysis/[id] --------------------------------------------- */
export const AnalysisGetResponse = AnalysisResponse;

/** Route catalogue — single source of truth used by docs and tests. */
export const API_ROUTES = {
  "GET /api/properties": { query: PropertySearchQuery, response: PropertySearchResponse, issue: "DATA-02" },
  "GET /api/properties/[id]": { response: PropertyDetailResponse, issue: "DATA-03" },
  "GET /api/properties/[id]/spaces": { response: PropertySpacesResponse, issue: "DATA-03" },
  "POST /api/analyze": { body: AnalyzeRequestBody, response: AnalyzeAcceptedResponse, issue: "AI-01" },
  "POST /api/market/analyze": { body: MarketAnalyzeRequest, response: MarketAnalyzeResponse, issue: "AI-04" },
  "POST /api/finance/scenario": { body: FinanceScenarioRequest, response: FinanceScenarioResponse, issue: "AI-06" },
  "GET /api/analysis/[id]": { response: AnalysisGetResponse, issue: "AI-01" },
} as const;
