"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startAnalysis } from "./start-analysis";

/** Starts an owner analysis of one advertised space and opens its live results page. */
export function AnalyzeSpaceButton({ propertyId, spaceId, label = "Analyze this space" }: { propertyId: number; spaceId?: number; label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ kind: "idle" | "sending" } | { kind: "failed"; message: string }>({ kind: "idle" });

  async function go() {
    setState({ kind: "sending" });
    const r = await startAnalysis({ input: { persona: "owner", propertyId, ...(spaceId ? { spaceId } : {}), priorities: [], constraints: [] } });
    if ("id" in r) router.push(`/analysis/${r.id}`);
    else setState({ kind: "failed", message: r.error });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={go} disabled={state.kind === "sending"} className="w-fit">
        <Sparkles className="size-4" aria-hidden="true" />
        {state.kind === "sending" ? "Starting…" : label}
      </Button>
      {state.kind === "failed" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}
