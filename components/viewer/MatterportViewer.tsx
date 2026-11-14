"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";
import { formatSf } from "@/components/property/format";
import type { TourOption } from "./tours";

function matchNote(t: TourOption): string {
  if (!t.matchedSuite) return "Building scan. It isn’t matched to an advertised suite.";
  if (!t.suiteListed) return `This scan shows Suite ${t.matchedSuite}, which isn’t in the current listings.`;
  const caption = t.caption ? ` by the CoStar photo caption “${t.caption}”` : "";
  const area =
    t.scannedAreaSf != null && t.advertisedSf != null
      ? ` Scanned ${formatSf(t.scannedAreaSf)} against ${formatSf(t.advertisedSf)} advertised; scanned area isn’t leasable area.`
      : "";
  return `Scan of advertised Suite ${t.matchedSuite}, matched${caption}.${area}`;
}

export function MatterportViewer({ tours, initialModelId }: { tours: TourOption[]; initialModelId?: string }) {
  const [activeId, setActiveId] = useState(
    () => tours.find((t) => t.modelId === initialModelId)?.modelId ?? tours[0]?.modelId,
  );
  const tour = tours.find((t) => t.modelId === activeId);

  return (
    <section id="tour" aria-labelledby="tour-heading" className="scroll-mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="tour-heading" className="text-xl font-semibold tracking-tight">
          3D tour
        </h2>
        {tours.length > 1 && (
          <Segmented
            label="Choose a scan"
            options={tours.map((t) => ({ value: t.modelId, label: t.title }))}
            value={activeId ?? ""}
            onChange={setActiveId}
          />
        )}
      </div>

      {!tour ? (
        <p className="rounded-2xl border bg-card p-5 text-base text-muted-foreground sm:p-6">
          No Matterport scan is linked to this property in the CoStar data, so there’s no 3D tour.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="relative aspect-[4/3] bg-muted sm:aspect-video">
            <iframe
              key={tour.modelId}
              src={tour.embedUrl}
              title={`Matterport 3D tour of ${tour.title}`}
              allow="fullscreen; xr-spatial-tracking"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 size-full border-0"
            />
          </div>
          <div className="flex flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <p className={cn("text-sm leading-snug", tour.suiteListed ? "text-muted-foreground" : "font-medium text-foreground")}>
              {matchNote(tour)}
            </p>
            <a
              href={tour.embedUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open in Matterport
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
