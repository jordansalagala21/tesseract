"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Expand, ImageOff, X } from "lucide-react";
import type { AerialImagery } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";
import { aerialLabel, formatCaptureRange, formatGsd } from "./aerial-format";

export function AerialViewer({ images }: { images: AerialImagery[] }) {
  const [activeId, setActiveId] = useState(images[0]?.id);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const image = images.find((a) => a.id === activeId);
  const broken = image ? failed.has(image.id) : false;

  return (
    <section aria-labelledby="aerial-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="aerial-heading" className="text-xl font-semibold tracking-tight">
          Aerial view
        </h2>
        {images.length > 1 && (
          <Segmented
            label="Choose a view"
            options={images.map((a) => ({ value: a.id, label: aerialLabel(a) }))}
            value={activeId ?? ""}
            onChange={setActiveId}
          />
        )}
      </div>

      {!image ? (
        <p className="rounded-2xl border bg-card p-5 text-base text-muted-foreground sm:p-6">
          No Vexcel aerial image is available for this property yet.
        </p>
      ) : (
        <figure className="overflow-hidden rounded-2xl border bg-card">
          <div className={cn("relative bg-muted", !broken && "aspect-[4/3]")}>
            {broken ? (
              <div className="px-6 py-10 text-center">
                <ImageOff className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 text-lg font-semibold">Aerial image didn’t load</p>
                <p className="mx-auto mt-1 max-w-md text-base text-muted-foreground">
                  The imagery service isn’t reachable right now, so only the capture details are shown.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => dialogRef.current?.showModal()}
                className="group absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                aria-label={`Enlarge ${aerialLabel(image).toLowerCase()} aerial image`}
              >
                <Image
                  key={image.id}
                  src={image.imageUrl}
                  alt={`${aerialLabel(image)} aerial image of the property from Vexcel, captured ${formatCaptureRange(image.captureDate)}`}
                  fill
                  unoptimized
                  sizes="(min-width: 960px) 900px, 100vw"
                  className="object-cover"
                  onError={() => setFailed((s) => new Set(s).add(image.id))}
                />
                <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-scrim px-3 py-1.5 text-sm font-medium text-scrim-foreground backdrop-blur">
                  <Expand className="size-3.5" aria-hidden="true" />
                  Enlarge
                </span>
              </button>
            )}
          </div>
          <figcaption className="flex flex-wrap gap-x-5 gap-y-1 border-t px-5 py-3 text-sm text-muted-foreground">
            <span>Captured {formatCaptureRange(image.captureDate)}</span>
            <span>{formatGsd(image.gsdMeters)}</span>
            <span>{image.attribution}</span>
          </figcaption>
        </figure>
      )}

      {image && !broken && (
        <dialog
          ref={dialogRef}
          aria-label={`${aerialLabel(image)} aerial image`}
          onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
          className="m-auto max-h-[92vh] max-w-[92vw] overflow-hidden rounded-2xl border bg-card p-0 text-foreground backdrop:bg-scrim"
        >
          <div className="relative">
            {/* Plain img: the enlarged view should show the full frame at its own aspect ratio */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.imageUrl} alt="" className="block max-h-[85vh] w-auto max-w-[92vw]" />
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close enlarged image"
              className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-scrim text-scrim-foreground backdrop-blur outline-none focus-visible:ring-2 focus-visible:ring-scrim-foreground"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <p className="px-5 py-3 text-sm text-muted-foreground">
            {aerialLabel(image)}, captured {formatCaptureRange(image.captureDate)}. {image.attribution}
          </p>
        </dialog>
      )}
    </section>
  );
}
