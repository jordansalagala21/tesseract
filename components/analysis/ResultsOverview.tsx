"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Eye, Plane } from "lucide-react";
import type { AnalysisResponse } from "@/lib/contracts";
import { AnalysisResults } from "./AnalysisResults";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { cleanStatement } from "./evidence-format";
import { Recommendation } from "./Recommendation";
import { MarketInsights, MatchCards, MoneySummary } from "./ResultSections";
import { heroImageFor, observationsWithImages } from "./result-images";
import { ScenarioControls } from "./ScenarioControls";

/**
 * The results, simplest first (progressive disclosure):
 *   1. the recommendation with its address, before/after, reasons, risks and requirements match
 *   2. the numbers in plain words · 3. the neighbourhood in three insights · 4. other matches
 *   then, collapsed: every photo the AI reviewed, the detailed financial scenarios, and the full
 *   technical evidence with the agent's trace. Nothing is removed, only moved down.
 */
export function ResultsOverview({ analysis: a }: { analysis: AnalysisResponse }) {
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const open = (id: string) => id && setEvidenceId(id);
  const byId = new Map(a.evidence.map((e) => [e.id, e]));
  const seen = observationsWithImages(a.evidence);
  const used = new Set<string>();
  const cardImages = a.opportunities.map((o) => heroImageFor(o, byId, seen.map((s) => s.image), used));
  const o = a.opportunities[Math.min(selected, a.opportunities.length - 1)];
  const working = a.status === "queued" || a.status === "running";

  return (
    <div className="flex flex-col gap-8">
      {o && (
        <>
          <Recommendation analysis={a} selected={selected} onSelect={setSelected} onEvidence={open} />
          <div className="grid gap-8 lg:grid-cols-2">
            <MoneySummary o={o} a={a} onEvidence={open} />
            <MarketInsights o={o} a={a} onEvidence={open} />
          </div>
          <MatchCards a={a} images={cardImages} selected={selected} onSelect={setSelected} onEvidence={open} />
        </>
      )}

      {/* While the agent works, its photos appear here as it looks at them. Afterwards they fold away. */}
      {seen.length > 0 &&
        (working && !o ? (
          <Gallery rows={seen} onEvidence={open} heading="What the AI is looking at" />
        ) : (
          <Section id="details-photos" title={`All photos the AI reviewed (${seen.length})`}>
            <Gallery rows={seen} onEvidence={open} />
          </Section>
        ))}

      {a.financialScenarios.length > 0 && (
        <Section id="details-financial" title="Detailed financial analysis">
          <p className="mb-4 text-sm text-muted-foreground">Every number says where it came from: CoStar, you, or an app default. Change one and the result updates.</p>
          <div className="flex flex-col gap-4">
            {a.financialScenarios.map((s) => (
              <ScenarioControls key={s.id} scenario={s} onEvidenceSelect={open} />
            ))}
          </div>
        </Section>
      )}

      <Section id="details-evidence" title={`Technical evidence and agent trace (${a.toolCalls.length} steps · ${a.evidence.length} sources)`}>
        <AnalysisResults analysis={{ ...a, financialScenarios: [] }} />
      </Section>

      <EvidenceDrawer open={evidenceId !== null} onClose={() => setEvidenceId(null)} evidence={a.evidence} evidenceIndex={a.evidenceIndex} selectedId={evidenceId} />
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <details id={id} className="group scroll-mt-6 rounded-2xl border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold sm:px-5">
        {title}
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t p-4 sm:p-5">{children}</div>
    </details>
  );
}

function Gallery({ rows, onEvidence, heading }: { rows: ReturnType<typeof observationsWithImages>; onEvidence: (id: string) => void; heading?: string }) {
  return (
    <section aria-label={heading ?? "Photos the AI reviewed"} className="flex flex-col gap-3">
      {heading && (
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
          <p className="text-sm text-muted-foreground">Photos from the 3D scan and aerial images. AI observations, not inspections.</p>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {rows.map(({ e, image }) => (
          <li key={e.id}>
            <button type="button" onClick={() => onEvidence(e.id)} className="flex w-full flex-col overflow-hidden rounded-xl border bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="relative block aspect-[4/3] bg-muted">
                <Image src={image.src} alt={image.alt} fill unoptimized sizes="(min-width: 1024px) 300px, 50vw" className="object-cover" />
              </span>
              <span className="flex flex-col gap-1 p-3">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {image.kind === "aerial" ? <Plane className="size-3" aria-hidden="true" /> : <Eye className="size-3" aria-hidden="true" />}
                  AI observation{e.kind === "ai_observation" ? ` · ${e.confidence} confidence` : ""}
                </span>
                <span className="line-clamp-3 text-sm leading-snug">{cleanStatement(e.statement)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
