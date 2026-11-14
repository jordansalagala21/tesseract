// OWNER: Developer 1 (AI-01). Contract: AnalysisGetResponse (lib/contracts/api.ts)
import { getAnalysis } from "@/lib/agent/store";
import { apiError } from "@/lib/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/analysis/[id]">) {
  const { id } = await ctx.params;
  const analysis = getAnalysis(id);
  if (!analysis) return apiError(404, "not_found", `No analysis ${id}. Analyses live in memory and reset when the server restarts.`);
  return Response.json(analysis, { headers: { "cache-control": "no-store" } });
}
