"use client";

import { useState } from "react";
import Image from "next/image";
import { Box, Check, ExternalLink, Eye, ImageOff, Sparkles } from "lucide-react";
import type { AnalysisResponse, Evidence, Opportunity } from "@/lib/contracts";
import { USES, type UseCategory } from "@/lib/market/uses";
import { cn } from "@/lib/utils";
import { safeEmbedUrl } from "@/components/viewer/tours";
import { conceptFor } from "./concepts";
import { cleanStatement } from "./evidence-format";
import { reasonsFor, spaceImagesFor, type ResultImage } from "./result-images";

const labelOf = (u: string) => USES[u as UseCategory]?.label ?? u;

/**
 * "See the space and its potential": what the space is now (its own 3D-scan photos), what it
 * could become (an AI concept for the selected idea), and why the idea fits (its evidence).
 * Selecting another idea updates the concept, the reasons and, when the idea is in another
 * property, the current-space photos too.
 */
export function SpacePotential({
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
  const ideas = a.opportunities;
  const o = ideas[Math.min(selected, ideas.length - 1)];
  if (!o) return null;
  const byId = new Map(a.evidence.map((e) => [e.id, e]));
  const space = spaceImagesFor(o, a);

  return (
    <section id="space-potential" aria-labelledby="potential-heading" className="flex scroll-mt-6 flex-col gap-5 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3">
        <h2 id="potential-heading" className="text-xl font-semibold tracking-tight">
          See the space and its potential
        </h2>
        {ideas.length > 1 && (
          <div role="group" aria-label="Choose an idea to preview" className="flex flex-wrap gap-2">
            {ideas.map((idea, i) => (
              <button
                key={idea.id}
                type="button"
                aria-pressed={i === selected}
                onClick={() => onSelect(i)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                <span className="tabular-nums">{idea.rank}</span>
                {labelOf(idea.useCategory)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* key: a different property starts on its own first photo */}
        <CurrentSpace key={`${o.propertyId}-${o.spaceId}`} images={space.images} modelId={space.modelId} propertyId={o.propertyId} />
        <PotentialConcept o={o} />
      </div>

      <WhyItFits o={o} byId={byId} onEvidence={onEvidence} />
    </section>
  );
}

/* ----------------------------------------------------------------- left */

function CurrentSpace({ images, modelId, propertyId }: { images: ResultImage[]; modelId: string | null; propertyId: number }) {
  const [shown, setShown] = useState(0);
  const tour = modelId ? safeEmbedUrl(modelId) : null;
  // No interior scan for this space: show the building from above rather than an empty frame.
  const main: ResultImage = images[shown] ?? { src: `/api/imagery/vexcel/ortho?propertyId=${propertyId}`, alt: "Vexcel aerial image of the property", kind: "aerial", evidenceId: "" };

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-center justify-between gap-3">
        <span className="text-base font-semibold">Current space</span>
        {tour && (
          <a href={tour} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <Box className="size-4" aria-hidden="true" />
            Open 3D tour
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </figcaption>
      <Frame image={main} badge={main.kind === "aerial" ? (images.length === 0 ? "No interior scan · Vexcel aerial" : "Vexcel aerial") : "Matterport 3D scan · today"} />
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

/* ---------------------------------------------------------------- right */

function PotentialConcept({ o }: { o: Opportunity }) {
  const concept = conceptFor(o);
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex min-h-11 items-center gap-2">
        <span className="text-base font-semibold">Potential concept</span>
        <span className="text-sm text-muted-foreground">· {labelOf(o.useCategory)}</span>
      </figcaption>
      {concept ? (
        <>
          <Frame image={{ src: concept.src, alt: `AI concept of a ${labelOf(o.useCategory).toLowerCase()}`, kind: "scan", evidenceId: "" }} badge="AI concept" accent />
          <p className="flex items-start gap-1.5 text-sm leading-snug text-muted-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              <span className="font-medium text-foreground">AI concept — illustrative only, not an architectural plan.</span>{" "}
              {concept.scope === "generic" ? "A generic concept for this use, made from a different space, not from this scan." : "Made from this space’s own scan photo."}
            </span>
          </p>
        </>
      ) : (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 p-6 text-center">
          <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-base font-semibold">Concept preview coming soon</p>
          <p className="max-w-xs text-sm text-muted-foreground">An illustrative concept of this space as a {labelOf(o.useCategory).toLowerCase()} will appear here.</p>
        </div>
      )}
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
      <span className={cn("absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur", accent ? "bg-amber-500/90 text-white" : "bg-scrim text-scrim-foreground")}>{badge}</span>
    </div>
  );
}

function WhyItFits({ o, byId, onEvidence }: { o: Opportunity; byId: Map<string, Evidence>; onEvidence: (id: string) => void }) {
  const reasons = reasonsFor(o, byId);
  if (reasons.length === 0) return null;
  return (
    <div className="border-t pt-4">
      <h3 className="mb-2 text-base font-semibold">Why this fits</h3>
      <ul className="grid gap-2 md:grid-cols-3">
        {reasons.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onEvidence(e.id)} className="flex h-full w-full items-start gap-2 rounded-lg p-2 text-left text-sm leading-snug outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              {e.kind === "ai_observation" ? <Eye className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" /> : <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
              <span>
                <span className="block text-xs text-muted-foreground">{e.kind === "ai_observation" ? "AI saw" : "CoStar fact"}</span>
                {cleanStatement(e.statement)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
