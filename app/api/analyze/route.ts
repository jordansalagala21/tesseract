// OWNER: Developer 1 (AI-01). Contract: AnalyzeRequestBody → 202 AnalyzeAcceptedResponse (lib/contracts/api.ts)
import { after } from "next/server";
import type { z } from "zod";
import { AnalyzeAcceptedResponse, AnalyzeRequestBody } from "@/lib/contracts";
import { executeAnalysis, queuedAnalysis } from "@/lib/agent/run";
import { takeDailyRun } from "@/lib/agent/limits";
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

  // A public deployment must not run up the API bills: cap live analyses per day.
  let allowance;
  try {
    allowance = await takeDailyRun();
  } catch {
    return apiError(503, "upstream_error", "The analysis service is busy. Try again in a minute.");
  }
  if (!allowance.ok) {
    return apiError(429, "rate_limited", `Today's ${allowance.limit} live analyses have all been used. Try again tomorrow, or open one of the recorded demo runs.`);
  }

  const id = `ana_${crypto.randomUUID()}`;
  await saveAnalysis(queuedAnalysis(id, parsed.data));
  // Run after the response is sent; the client polls GET /api/analysis/[id].
  after(() => executeAnalysis(id, parsed.data));

  const accepted: z.infer<typeof AnalyzeAcceptedResponse> = { analysisId: id, status: "queued", pollUrl: `/api/analysis/${id}` };
  return Response.json(accepted, { status: 202 });
}
