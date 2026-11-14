"use client";

import { useEffect, useState } from "react";
import { AnalysisResponse } from "@/lib/contracts";

/**
 * Polls GET /api/analysis/[id] until the analysis completes or fails, so the timeline updates live.
 * ponytail: polling every 1.5 s; switch to the optional SSE streamUrl if Dev 1 ships it.
 */
export function useAnalysis(analysisId: string, intervalMs = 1500) {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`The analysis service answered ${res.status}.`);
        const parsed = AnalysisResponse.safeParse(await res.json());
        if (!parsed.success) throw new Error("The analysis response didn’t match the expected format.");
        if (stopped) return;
        setData(parsed.data);
        setError(null);
        if (parsed.data.status === "queued" || parsed.data.status === "running") timer = setTimeout(poll, intervalMs);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "The analysis couldn’t be loaded.");
      }
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [analysisId, intervalMs]);

  return { data, error };
}
