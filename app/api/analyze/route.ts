// OWNER: Developer 1 (AI-01). Contract: AnalyzeRequestBody → 202 AnalyzeAcceptedResponse (lib/contracts/api.ts)
import { after } from "next/server";
import type { z } from "zod";
import { AnalyzeAcceptedResponse, AnalyzeRequestBody } from "@/lib/contracts";
import { executeAnalysis, queuedAnalysis } from "@/lib/agent/run";
import { saveAnalysis } from "@/lib/agent/store";
import { apiError } from "@/lib/http";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "bad_request", "Request body must be JSON.");
  }
  const parsed = AnalyzeRequestBody.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "bad_request", "Invalid analysis request.", { details: parsed.error.issues });
  }

  const id = `ana_${crypto.randomUUID()}`;
  saveAnalysis(queuedAnalysis(id, parsed.data));
  // Run after the response is sent; the client polls GET /api/analysis/[id].
  after(() => executeAnalysis(id, parsed.data));

  const accepted: z.infer<typeof AnalyzeAcceptedResponse> = { analysisId: id, status: "queued", pollUrl: `/api/analysis/${id}` };
  return Response.json(accepted, { status: 202 });
}
