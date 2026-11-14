// OWNER: Developer 1 (AI-04). Contract: MarketAnalyzeRequest → MarketAnalysis (lib/contracts/api.ts)
import { MarketAnalyzeRequest } from "@/lib/contracts";
import { getNearbyContext } from "@/lib/data/nearby";
import { apiError } from "@/lib/http";
import { analyzeNearby } from "@/lib/market/analyze";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "bad_request", "Request body must be JSON.");
  }
  const parsed = MarketAnalyzeRequest.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "bad_request", "Invalid market analysis request.", { details: parsed.error.issues });
  }

  const { propertyId, radiusMeters, spaceUse } = parsed.data;
  try {
    const nearby = await getNearbyContext(propertyId, radiusMeters);
    // The dashboard needs the market picture, not per-use scoring signals.
    return Response.json(analyzeNearby(nearby, { spaceUse, uses: [] }).analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A teammate who has not built the database yet should be told so, not handed a 500.
    if (message.includes("npm run db:build")) return apiError(503, "upstream_error", message);
    throw error;
  }
}
