"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, ArrowRight, Box, Check, ChevronDown, ExternalLink, Eye, ImageOff, MapPin, Ruler, Sparkles, Tag } from "lucide-react";
import type { AnalysisResponse, Evidence, Opportunity } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { USES, type UseCategory } from "@/lib/market/uses";
import { cn } from "@/lib/utils";
import { safeEmbedUrl } from "@/components/viewer/tours";
import { conceptFor, emptyViewFor, type ConceptManifest } from "./concepts";
import { cleanStatement } from "./evidence-format";
import { delay, motion as m, useCountUp, useMounted } from "./motion";
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
    <section id="recommendation" aria-labelledby="rec-heading" className={cn("scroll-mt-6 overflow-hidden rounded-2xl border bg-card shadow-sm", m.rise)}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {ideas.length > 1 && (
          <div role="group" aria-label="Compare ideas" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {ideas.map((idea, i) => (
              <button
                key={idea.id}
                type="button"
                aria-pressed={i === selected}
                onClick={() => onSelect(i)}
                style={delay(i, 50)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                  m.rise,
                  i === selected ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-background hover:-translate-y-0.5 hover:bg-muted",
                )}
              >
                <span className="tabular-nums">{idea.rank}</span>
                {chipLabel(idea, ideas, a)}
              </button>
            ))}
          </div>
        )}

        <div key={o.id} className={cn("flex flex-col gap-2", m.rise)}>
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
      <div className="relative grid gap-4 px-4 pb-5 sm:px-6 lg:grid-cols-2">
        <CurrentSpace
          key={`${o.propertyId}-${o.spaceId}`}
          images={space.images}
          hidden={space.hidden}
          emptyView={emptyViewFor(o, manifest)}
          modelId={space.modelId}
          propertyId={o.propertyId}
          suite={f.suite}
        />
        <Concept key={o.id} o={o} manifest={manifest} />
        {/* Today → could become, on wide screens: a small arrow over the gap between the pictures. */}
        <span aria-hidden="true" className={cn("pointer-events-none absolute top-[calc(50%-2.5rem)] left-1/2 z-10 hidden size-11 items-center justify-center rounded-full border bg-card text-primary shadow-lg lg:flex", m.arrow)}>
          <ArrowRight className="size-5" />
        </span>
      </div>

      <div key={o.id} className="grid gap-px border-t bg-border md:grid-cols-3">
        <Panel title="Why it fits">
          <ul className="flex flex-col gap-2.5">
            {reasonsFor(o, byId).map((e, i) => (
              <li key={e.id} className={m.rise} style={delay(i + 2, 80)}>
                <EvidenceLine e={e} onEvidence={onEvidence} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Watch out for" tone="warning">
          <ul className="flex flex-col gap-2.5">
            {risksFor(o, a.evidence).map((r, i) => (
              <li key={r.text} className={m.rise} style={delay(i + 3, 80)}>
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

function CurrentSpace({
  images,
  hidden,
  emptyView,
  modelId,
  propertyId,
  suite,
}: {
  images: ResultImage[];
  /** Scan photos left out because they show furniture. */
  hidden: number;
  /** The AI "furniture removed" view, shown first when furnished photos were hidden. */
  emptyView: string | null;
  modelId: string | null;
  propertyId: number;
  suite: string | null;
}) {
  const [shown, setShown] = useState(0);
  const tour = modelId ? safeEmbedUrl(modelId) : null;
  const name = suite ?? "The space";
  // Only ever this property: its own bare scan photos, an AI view of its own photo with the
  // furniture removed (first, whenever furnished photos were hidden), or its own aerial view.
  const aerial: ResultImage = { src: `/api/imagery/vexcel/ortho?propertyId=${propertyId}`, alt: "Vexcel aerial image of this property", kind: "aerial", evidenceId: "" };
  const empty: ResultImage | null = hidden > 0 && emptyView ? { src: emptyView, alt: `${name} with its furniture removed (AI view of a scan photo)`, kind: "scan", evidenceId: "" } : null;
  const views = empty ? [empty, ...images] : images;
  const main = views[shown] ?? aerial;
  const isEmptyView = main === empty;
  const scanned = views.length > 0;
  const badge = isEmptyView ? "Today · AI view, furniture removed" : scanned ? "Today · Matterport 3D scan" : hidden > 0 ? "Aerial of this property" : "No interior scan · aerial of this property";
  const caption = isEmptyView
    ? "The scan photos show the current furniture, so this AI view of one of them takes it out. Open the 3D tour for the real space."
    : scanned
      ? `${name} as it is today, from its 3D scan.${hidden ? ` ${hidden} photo${hidden === 1 ? "" : "s"} with furniture hidden.` : ""}`
      : hidden > 0
        ? "Every scan photo shows the current furniture, so they are hidden. Open the 3D tour to look around."
        : "This space has no 3D scan, so only the building is shown.";

  return (
    <figure className={cn("flex flex-col gap-2", m.swap)}>
      <Frame image={main} badge={badge} drift />
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{caption}</span>
        {tour && (
          <a href={tour} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <Box className="size-4" aria-hidden="true" />
            Open 3D Tour
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </figcaption>
      {views.length > 1 && (
        <ul className="grid grid-cols-5 gap-2" aria-label="More photos from the 3D scan">
          {views.slice(0, 5).map((img, i) => (
            <li key={img.src} className={m.rise} style={delay(i + 2, 60)}>
              <button
                type="button"
                onClick={() => setShown(i)}
                aria-pressed={i === shown}
                aria-label={img === empty ? "Show the AI view with furniture removed" : `Show scan photo ${i + 1}`}
                className={cn(
                  "relative block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring",
                  i === shown ? "scale-[1.04] border-primary shadow-md" : "border-transparent opacity-75 hover:-translate-y-0.5 hover:opacity-100",
                )}
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

export function useConceptManifest(): ConceptManifest {
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
      <div className={cn("flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 p-6 text-center", m.swap)}>
        <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-base font-semibold">Concept preview coming soon</p>
        <p className="max-w-xs text-sm text-muted-foreground">An illustrative concept of this space as a {labelOf(o.useCategory).toLowerCase()} will appear here.</p>
      </div>
    );
  }
  return (
    <figure className="flex flex-col gap-2">
      <div className={m.becoming}>
        <Frame image={{ src: concept.src, alt: `AI concept: this space as a ${labelOf(o.useCategory).toLowerCase()}`, kind: "scan", evidenceId: "" }} badge={`Could become · ${labelOf(o.useCategory)}`} accent />
      </div>
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

function Frame({ image, badge, accent, drift }: { image: ResultImage; badge: string; accent?: boolean; drift?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = loaded === image.src;
  return (
    <div className={cn("relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted", !ready && !failed && m.shimmer, accent && ready && m.sweep)}>
      {!failed ? (
        <Image
          key={image.src}
          src={image.src}
          alt={image.alt}
          fill
          unoptimized
          loading="eager"
          sizes="(min-width: 1024px) 600px, 100vw"
          className={cn("object-cover", m.img, !ready && m.loading, drift && ready && m.drift)}
          onLoad={() => setLoaded(image.src)}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Image unavailable</span>
      )}
      <span className={cn("absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur", m.rise, accent ? "bg-amber-500/90 text-white" : "bg-scrim text-scrim-foreground")}>{badge}</span>
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
  const counted = useCountUp(score);
  const grown = useMounted();
  const known = SCORE_PARTS.filter(([k]) => o.scores[k].score !== null).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums" aria-label={score === null ? "Not scored" : `${score} out of 100`}>
          {counted ?? "–"}
        </span>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        {score !== null && <div className={cn("h-full rounded-full bg-gradient-to-r from-primary/70 to-primary", m.bar)} style={{ width: grown ? `${score}%` : "0%" }} />}
      </div>
      <p className="text-sm leading-snug text-muted-foreground">
        How well this space meets what a {labelOf(o.useCategory).toLowerCase()} typically needs. <span className="font-medium text-foreground">Not a forecast of business success.</span>
      </p>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
        How it was scored ({known} of 4 checks)
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul className="flex flex-col gap-2">
          {SCORE_PARTS.map(([key, label], i) => {
            const s = o.scores[key].score;
            return (
              <li key={key} className={cn("flex flex-col gap-1", m.rise)} style={delay(i, 60)}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold tabular-nums">{s ?? "not checked"}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">{s !== null && <ScoreBar value={s} />}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const grown = useMounted();
  return <div className={cn("h-full rounded-full bg-primary/70", m.bar)} style={{ width: grown ? `${value}%` : "0%" }} />;
}
