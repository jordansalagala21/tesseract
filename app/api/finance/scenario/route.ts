// OWNER: Developer 1 (AI-06). Contract: FinanceScenarioRequest → FinancialScenario (lib/contracts/api.ts)
import { FinanceScenarioRequest } from "@/lib/contracts";
import { runScenario } from "@/lib/finance";
import { apiError } from "@/lib/http";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "bad_request", "Request body must be JSON.");
  }

  const parsed = FinanceScenarioRequest.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "bad_request", "Invalid scenario request.", { details: parsed.error.issues });
  }

  const scenario = runScenario(parsed.data.input, { id: `scn_${crypto.randomUUID()}`, name: parsed.data.name });
  return Response.json(scenario);
}
