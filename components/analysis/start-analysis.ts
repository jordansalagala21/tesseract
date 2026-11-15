import { AnalyzeAcceptedResponse, type AnalysisRequest } from "@/lib/contracts";

/** Start an analysis; returns its id or a plain-English error. Used by the Analyze buttons and the retry. */
export async function startAnalysis(body: { input: AnalysisRequest["input"]; options?: Partial<AnalysisRequest["options"]> }): Promise<{ id: string } | { error: string }> {
  try {
    const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    const accepted = AnalyzeAcceptedResponse.safeParse(json);
    if (!res.ok || !accepted.success) return { error: json?.error?.message ?? `The analysis service answered ${res.status}.` };
    return { id: accepted.data.analysisId };
  } catch {
    return { error: "The analysis service couldn’t be reached. Check your connection and try again." };
  }
}
