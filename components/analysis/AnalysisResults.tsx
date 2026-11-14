"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisResponse } from "@/lib/contracts";
import { AgentTimeline } from "./AgentTimeline";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { OpportunityReveal } from "./OpportunityReveal";

/**
 * The analysis workspace: investigation timeline and opportunity cards, with one Evidence Trail
 * drawer. Any evidence chip opens the drawer on that item; the button opens it at the top.
 * Pass showTimeline={false} for a second view of the same evidence (for example another persona).
 */
export function AnalysisResults({ analysis, showTimeline = true }: { analysis: AnalysisResponse; showTimeline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const select = (id: string) => {
    setSelectedId(id);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-8">
      {showTimeline && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base text-muted-foreground">Tap any evidence chip to see its source.</p>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedId(null);
                setOpen(true);
              }}
            >
              <ScrollText className="size-4" aria-hidden="true" />
              Open Evidence Trail ({analysis.evidence.length})
            </Button>
          </div>
          <AgentTimeline toolCalls={analysis.toolCalls} evidence={analysis.evidence} status={analysis.status} onEvidenceSelect={select} />
        </>
      )}
      <OpportunityReveal opportunities={analysis.opportunities} evidence={analysis.evidence} persona={analysis.persona} onEvidenceSelect={select} />
      <EvidenceDrawer
        open={open}
        onClose={() => setOpen(false)}
        evidence={analysis.evidence}
        evidenceIndex={analysis.evidenceIndex}
        selectedId={selectedId}
      />
    </div>
  );
}
