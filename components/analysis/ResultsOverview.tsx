"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Box, Check, Eye, Plane } from "lucide-react";
import type { AnalysisResponse, Evidence, Opportunity } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { cleanStatement } from "./evidence-format";
import { SCORE_PARTS, STRATEGIES, VERDICTS } from "./opportunity-format";
import { heroImageFor, imagesFor, observationsWithImages, reasonsFor, type ResultImage } from "./result-images";

/**
 * The visual summary of an analysis: the top idea as a large card with a photo of the space,
 * the other ideas as photo cards, and what the AI saw as a picture gallery. Every reason links
 * to its evidence; the full investigation stays available below the page.
 */
export function ResultsOverview({ analysis: a }: { analysis: AnalysisResponse }) {
  const [selected, setSelected] = useState<string | null>(null);
  const byId = new Map(a.evidence.map((e) => [e.id, e]));
  const seen = observationsWithImages(a.evidence);
  const pool = seen.map((s) => s.image);
  const used = new Set<string>();
  const ideas = a.opportunities.map((o) => ({ o, image: heroImageFor(o, byId, pool, used) }));
  const aerials = a.evidence.flatMap((e) => (e.kind === "verified_fact" ? imagesFor(e).filter((i) => i.kind === "aerial") : []));
  const open = (id: string) => id && setSelected(id);
  // Said once above the ideas when it applies to all of them, instead of on every card.
  const gaps = a.opportunities.map((o) => o.unknowns.find((u) => u.startsWith("Economics not assessed")));
  const sharedGap = gaps.length > 0 && gaps.every(Boolean) ? `${gaps[0]!.split(". ")[0]}. Every idea is capped at "possible" until there is rent evidence.` : null;

  return (
    <div className="flex flex-col gap-10">
      {ideas.length > 0 && (
        <section aria-labelledby="ideas-heading" className="flex flex-col gap-4">
          <h2 id="ideas-heading" className="text-xl font-semibold tracking-tight">
            Ranked ideas
          </h2>
          {sharedGap && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm leading-snug">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span>{sharedGap}</span>
            </p>
          )}
          <TopIdea o={ideas[0].o} image={ideas[0].image} byId={byId} onEvidence={open} hideGap={!!sharedGap} />
          {ideas.length > 1 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ideas.slice(1).map(({ o, image }) => (
                <li key={o.id}>
                  <IdeaCard o={o} image={image} byId={byId} onEvidence={open} hideGap={!!sharedGap} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {seen.length > 0 && (
        <section aria-labelledby="seen-heading" className="flex flex-col gap-4">
          <div>
            <h2 id="seen-heading" className="text-xl font-semibold tracking-tight">
              What the AI saw
            </h2>
            <p className="mt-1 text-base text-muted-foreground">Photos from the 3D scan and aerial images the agent looked at. AI observations, not inspections.</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {seen.slice(0, 8).map(({ e, image }) => (
              <li key={e.id}>
                <button type="button" onClick={() => open(e.id)} className="group flex w-full flex-col overflow-hidden rounded-xl border bg-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Picture image={image} className="aspect-[4/3]" />
                  <span className="flex flex-col gap-1 p-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      {image.kind === "aerial" ? <Plane className="size-3" aria-hidden="true" /> : <Eye className="size-3" aria-hidden="true" />}
                      AI observation · {e.kind === "ai_observation" ? e.confidence : ""} confidence
                    </span>
                    <span className="line-clamp-3 text-sm leading-snug">{cleanStatement(e.statement)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {aerials.length > 0 && (
        <section aria-labelledby="aerial-heading" className="flex flex-col gap-4">
          <h2 id="aerial-heading" className="text-xl font-semibold tracking-tight">
            From above
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {aerials.slice(0, 2).map((img) => (
              <li key={img.src} className="overflow-hidden rounded-xl border bg-card">
                <Picture image={img} className="aspect-[4/3]" />
                <p className="p-3 text-sm text-muted-foreground">{cleanStatement(byId.get(img.evidenceId)?.statement ?? "")}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <EvidenceDrawer open={selected !== null} onClose={() => setSelected(null)} evidence={a.evidence} evidenceIndex={a.evidenceIndex} selectedId={selected} />
    </div>
  );
}

/* --------------------------------------------------------------- parts */

function Picture({ image, className }: { image: ResultImage | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn("relative block w-full overflow-hidden bg-muted", className)}>
      {image && !failed ? (
        <Image src={image.src} alt={image.alt} fill unoptimized sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Box className="size-8" aria-hidden="true" />
        </span>
      )}
      {image && !failed && (
        <span className="absolute bottom-2 left-2 rounded-full bg-scrim px-2 py-0.5 text-xs font-medium text-scrim-foreground backdrop-blur">
          {image.kind === "aerial" ? "Vexcel aerial · © Vexcel Imaging US, Inc." : "Matterport 3D scan"}
        </span>
      )}
    </span>
  );
}

function Meter({ score, label, large }: { score: number | null; label: string; large?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("text-muted-foreground", large ? "text-sm" : "text-xs")}>{label}</span>
        <span className={cn("font-semibold tabular-nums", large ? "text-2xl" : "text-sm")}>{score ?? "–"}</span>
      </div>
      <div className={cn("overflow-hidden rounded-full bg-muted", large ? "h-2.5" : "h-1.5")}>
        {score !== null && <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />}
      </div>
    </div>
  );
}

function Reasons({ o, byId, onEvidence, max = 3, hideGap }: { o: Opportunity; byId: Map<string, Evidence>; onEvidence: (id: string) => void; max?: number; hideGap?: boolean }) {
  const reasons = reasonsFor(o, byId).slice(0, max);
  const caution = o.blockers[0]?.description ?? o.unknowns.find((u) => !(hideGap && u.startsWith("Economics not assessed")));
  return (
    <ul className="flex flex-col gap-2">
      {reasons.map((e) => (
        <li key={e.id}>
          <button type="button" onClick={() => onEvidence(e.id)} className="flex w-full items-start gap-2 text-left text-sm leading-snug outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
            {e.kind === "ai_observation" ? <Eye className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" /> : <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
            <span>
              <span className="sr-only">{e.kind === "ai_observation" ? "AI observation: " : "CoStar fact: "}</span>
              {cleanStatement(e.statement)}
            </span>
          </button>
        </li>
      ))}
      {caution && (
        <li className="flex items-start gap-2 text-sm leading-snug text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>{caution.split(". ")[0].replace(/\.$/, "")}.</span>
        </li>
      )}
    </ul>
  );
}

type CardProps = { o: Opportunity; image: ResultImage | null; byId: Map<string, Evidence>; onEvidence: (id: string) => void; hideGap?: boolean };

/** "based on 3 of 4 scores": the overall re-weights over what is known, so say how much that is. */
const basis = (o: Opportunity) => {
  const n = SCORE_PARTS.filter(([k]) => o.scores[k].score !== null).length;
  return `Overall fit · based on ${n} of 4 scores`;
};

function TopIdea({ o, image, byId, onEvidence, hideGap }: CardProps) {
  const verdict = VERDICTS[o.verdict];
  return (
    <article className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-[1.15fr_1fr]">
      <Picture image={image} className="aspect-[4/3] lg:aspect-auto lg:min-h-[22rem]" />
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">Top idea</Badge>
            <Badge variant={verdict.variant}>{verdict.label}</Badge>
            <span className="text-sm text-muted-foreground">{STRATEGIES[o.strategy]}</span>
          </div>
          <h3 className="text-2xl leading-tight font-semibold text-balance">{o.title}</h3>
        </div>
        <Meter score={o.scores.overall} label={basis(o)} large />
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          {SCORE_PARTS.map(([key, label]) => (
            <Meter key={key} score={o.scores[key].score} label={label} />
          ))}
        </div>
        <Reasons o={o} byId={byId} onEvidence={onEvidence} hideGap={hideGap} />
      </div>
    </article>
  );
}

function IdeaCard({ o, image, byId, onEvidence, hideGap }: CardProps) {
  const verdict = VERDICTS[o.verdict];
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="relative">
        <Picture image={image} className="aspect-[16/10]" />
        <span className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-full bg-card text-sm font-semibold shadow">{o.rank}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={verdict.variant}>{verdict.label}</Badge>
          <span className="text-xs text-muted-foreground">{STRATEGIES[o.strategy]}</span>
        </div>
        <h3 className="line-clamp-2 text-base leading-snug font-semibold">{o.title}</h3>
        <Meter score={o.scores.overall} label={basis(o)} />
        <Reasons o={o} byId={byId} onEvidence={onEvidence} max={2} hideGap={hideGap} />
      </div>
    </article>
  );
}
