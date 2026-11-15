"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Box, Check, ChevronDown, ExternalLink, Eye, ImageOff, MapPin, Ruler, Sparkles, Tag } from "lucide-react";
import type { AnalysisResponse, Evidence, Opportunity } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { USES, type UseCategory } from "@/lib/market/uses";
import { cn } from "@/lib/utils";
import { safeEmbedUrl } from "@/components/viewer/tours";
import { conceptFor, type ConceptManifest } from "./concepts";
import { cleanStatement } from "./evidence-format";
import { SCORE_PARTS, STRATEGIES, VERDICTS } from "./opportunity-format";
import { factsFor, risksFor } from "./result-facts";
import { reasonsFor, spaceImagesFor, type ResultImage } from "./result-images";

export const labelOf = (u: string) => USES[u as UseCategory]?.label ?? u;

/**
 * What an idea button says: the use when every idea is for one space (owner), the place when
 * every idea is the same use (business starter), and both when they differ (investor).
 */
function chipLabel(o: Opportunity, ideas: Opportunity[], a: AnalysisResponse): string {
  const oneSpace = new Set(ideas.map((i) => `${i.propertyId}-${i.spaceId}`)).size === 1;
  if (oneSpace) return labelOf(o.useCategory);
  const f = factsFor(o, a.evidence);
  const place = `${f.address.split(",")[0]}${f.suite ? `, ${f.suite}` : ""}`;
  return new Set(ideas.map((i) => i.useCategory)).size === 1 ? place : `${place} · ${labelOf(o.useCategory)}`;
}

/**
 * The recommendation, front and centre: what it is and where (address, size, rent), the space as
 * it is today next to an AI concept of what it could become, then why it fits, what to watch out
 * for, and how well it matches the use's requirements. Choosing another idea updates all of it.
 */
export function Recommendation({
  analysis: a,
  selected,
  onSelect,
  onEvidence,
}: {
  analysis: AnalysisResponse;
  selected: number;
  onSelect: (index: number) => void;
  onEvidence: (id: string) => void;
}) {
  const manifest = useConceptManifest();
  const ideas = a.opportunities;
  const o = ideas[Math.min(selected, ideas.length - 1)];
  if (!o) return null;
  const byId = new Map(a.evidence.map((e) => [e.id, e]));
  const f = factsFor(o, a.evidence);
  const space = spaceImagesFor(o, a);
  const verdict = VERDICTS[o.verdict];

  return (
    <section id="recommendation" aria-labelledby="rec-heading" className="scroll-mt-6 overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {ideas.length > 1 && (
          <div role="group" aria-label="Compare ideas" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {ideas.map((idea, i) => (
              <button
                key={idea.id}
                type="button"
                aria-pressed={i === selected}
                onClick={() => onSelect(i)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                <span className="tabular-nums">{idea.rank}</span>
                {chipLabel(idea, ideas, a)}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{o.rank === 1 ? "Top recommendation" : `Idea ${o.rank} of ${ideas.length}`}</Badge>
            <Badge variant={verdict.variant}>{verdict.label}</Badge>
            <span className="text-sm text-muted-foreground">{STRATEGIES[o.strategy]}</span>
          </div>
          <h2 id="rec-heading" className="text-2xl leading-tight font-semibold text-balance sm:text-3xl">
            {o.title}
          </h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-base text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {f.address}
              {f.suite ? `, ${f.suite}` : ""}
            </li>
            {f.size && (
              <li className="inline-flex items-center gap-1.5">
                <Ruler className="size-4" aria-hidden="true" />
                {f.size}
              </li>
            )}
            {o.strategy === "acquisition" && f.askingPriceUsd ? (
              <li className="inline-flex items-center gap-1.5">
                <Tag className="size-4" aria-hidden="true" />${f.askingPriceUsd.toLocaleString("en-US")} asking price
              </li>
            ) : (
              f.rent && (
                <li className="inline-flex items-center gap-1.5">
                  <Tag className="size-4" aria-hidden="true" />
                  {f.rent === "Rent not published" ? f.rent : `${f.rent} asking`}
                </li>
              )
            )}
          </ul>
        </div>
      </div>

      {/* The centrepiece: today vs. what it could become, same room. */}
      <div className="grid gap-4 px-4 pb-5 sm:px-6 lg:grid-cols-2">
        <CurrentSpace key={`${o.propertyId}-${o.spaceId}`} images={space.images} modelId={space.modelId} propertyId={o.propertyId} suite={f.suite} />
        <Concept o={o} manifest={manifest} />
      </div>

      <div className="grid gap-px border-t bg-border md:grid-cols-3">
        <Panel title="Why it fits">
          <ul className="flex flex-col gap-2.5">
            {reasonsFor(o, byId).map((e) => (
              <li key={e.id}>
                <EvidenceLine e={e} onEvidence={onEvidence} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Watch out for" tone="warning">
          <ul className="flex flex-col gap-2.5">
            {risksFor(o, a.evidence).map((r) => (
              <li key={r.text}>
                <button
                  type="button"
                  disabled={!r.evidenceId}
                  onClick={() => r.evidenceId && onEvidence(r.evidenceId)}
                  className="flex w-full items-start gap-2 text-left text-sm leading-snug outline-none enabled:hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <span>{r.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Requirements match">
          <MatchMeter o={o} />
        </Panel>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- before */

function CurrentSpace({ images, modelId, propertyId, suite }: { images: ResultImage[]; modelId: string | null; propertyId: number; suite: string | null }) {
  const [shown, setShown] = useState(0);
  const tour = modelId ? safeEmbedUrl(modelId) : null;
  const scanned = images.length > 0;
  // Only ever this property: its own interior photos, or its own aerial view if there is no scan.
  const main: ResultImage = images[shown] ?? { src: `/api/imagery/vexcel/ortho?propertyId=${propertyId}`, alt: "Vexcel aerial image of this property", kind: "aerial", evidenceId: "" };

  return (
    <figure className="flex flex-col gap-2">
      <Frame image={main} badge={scanned ? "Today · Matterport 3D scan" : "No interior scan · aerial of this property"} />
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{scanned ? `${suite ?? "The space"} as it is today, from its 3D scan.` : "This space has no 3D scan, so only the building is shown."}</span>
        {tour && (
          <a href={tour} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <Box className="size-4" aria-hidden="true" />
            Open 3D Tour
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </figcaption>
      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2" aria-label="More photos from the 3D scan">
          {images.slice(0, 5).map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                onClick={() => setShown(i)}
                aria-pressed={i === shown}
                aria-label={`Show scan photo ${i + 1}`}
                className={cn("relative block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 outline-none focus-visible:ring-2 focus-visible:ring-ring", i === shown ? "border-primary" : "border-transparent opacity-80 hover:opacity-100")}
              >
                <Image src={img.src} alt="" fill unoptimized sizes="120px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/* ---------------------------------------------------------------- after */

function useConceptManifest(): ConceptManifest {
  const [manifest, setManifest] = useState<ConceptManifest>({});
  useEffect(() => {
    let live = true;
    fetch("/concepts/manifest.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => live && m && typeof m === "object" && setManifest(m as ConceptManifest))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return manifest;
}

function Concept({ o, manifest }: { o: Opportunity; manifest: ConceptManifest }) {
  const concept = conceptFor(o, manifest);
  if (!concept) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 p-6 text-center">
        <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-base font-semibold">Concept preview coming soon</p>
        <p className="max-w-xs text-sm text-muted-foreground">An illustrative concept of this space as a {labelOf(o.useCategory).toLowerCase()} will appear here.</p>
      </div>
    );
  }
  return (
    <figure className="flex flex-col gap-2">
      <Frame image={{ src: concept.src, alt: `AI concept: this space as a ${labelOf(o.useCategory).toLowerCase()}`, kind: "scan", evidenceId: "" }} badge={`Could become · ${labelOf(o.useCategory)}`} accent />
      <figcaption className="flex items-start gap-1.5 text-sm leading-snug text-muted-foreground">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span>
          <span className="font-medium text-foreground">AI concept, illustrative only, not an architectural plan.</span> Made from the same scan photo.
        </span>
      </figcaption>
    </figure>
  );
}

/* --------------------------------------------------------------- shared */

function Frame({ image, badge, accent }: { image: ResultImage; badge: string; accent?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
      {!failed ? (
        <Image key={image.src} src={image.src} alt={image.alt} fill unoptimized loading="eager" sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Image unavailable</span>
      )}
      <span className={cn("absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur", accent ? "bg-amber-500/90 text-white" : "bg-scrim text-scrim-foreground")}>{badge}</span>
    </div>
  );
}

function Panel({ title, tone, children }: { title: string; tone?: "warning"; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 p-4 sm:p-5", tone === "warning" ? "bg-amber-50 dark:bg-amber-950/30" : "bg-card")}>
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function EvidenceLine({ e, onEvidence }: { e: Evidence; onEvidence: (id: string) => void }) {
  const seen = e.kind === "ai_observation";
  return (
    <button type="button" onClick={() => onEvidence(e.id)} className="flex w-full items-start gap-2 text-left text-sm leading-snug outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
      {seen ? <Eye className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" /> : <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
      <span>
        <span className="block text-xs text-muted-foreground">{seen ? "Seen in the 3D scan or aerial (AI)" : "CoStar record"}</span>
        {cleanStatement(e.statement)}
      </span>
    </button>
  );
}

function MatchMeter({ o }: { o: Opportunity }) {
  const [open, setOpen] = useState(false);
  const score = o.scores.overall;
  const known = SCORE_PARTS.filter(([k]) => o.scores[k].score !== null).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums">{score ?? "–"}</span>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">{score !== null && <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />}</div>
      <p className="text-sm leading-snug text-muted-foreground">
        How well this space meets what a {labelOf(o.useCategory).toLowerCase()} typically needs. <span className="font-medium text-foreground">Not a forecast of business success.</span>
      </p>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
        How it was scored ({known} of 4 checks)
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul className="flex flex-col gap-2">
          {SCORE_PARTS.map(([key, label]) => {
            const s = o.scores[key].score;
            return (
              <li key={key} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold tabular-nums">{s ?? "not checked"}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">{s !== null && <div className="h-full rounded-full bg-primary/70" style={{ width: `${s}%` }} />}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
