"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Expand, ImageOff, X } from "lucide-react";
import type { AerialImagery } from "@/lib/contracts";
import { cn } from "@/lib/utils";
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
        <h2 id="aerial-heading" className="text-[20px] font-semibold tracking-tight">
          Aerial view
        </h2>
        {images.length > 1 && (
          <div role="group" aria-label="Choose a view" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1">
            {images.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={a.id === activeId}
                onClick={() => setActiveId(a.id)}
                className={cn(
                  "h-8 shrink-0 rounded-lg px-3 text-[15px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  a.id === activeId ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {aerialLabel(a)}
              </button>
            ))}
          </div>
        )}
      </div>

      {!image ? (
        <p className="rounded-[20px] border bg-card px-5 py-6 text-[15px] text-muted-foreground">
          No Vexcel aerial image is available for this property yet.
        </p>
      ) : (
        <figure className="overflow-hidden rounded-[20px] border bg-card">
          <div className={cn("relative bg-muted", !broken && "aspect-[4/3]")}>
            {broken ? (
              <div className="px-6 py-10 text-center">
                <ImageOff className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 text-[17px] font-semibold">Aerial image didn’t load</p>
                <p className="mx-auto mt-1 max-w-md text-[15px] text-muted-foreground">
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
                <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur">
                  <Expand className="size-3.5" aria-hidden="true" />
                  Enlarge
                </span>
              </button>
            )}
          </div>
          <figcaption className="flex flex-wrap gap-x-5 gap-y-1 border-t px-5 py-3 text-[13px] text-muted-foreground">
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
          className="m-auto max-h-[92vh] max-w-[92vw] overflow-hidden rounded-[20px] border bg-card p-0 text-foreground backdrop:bg-black/70"
        >
          <div className="relative">
            {/* Plain img: the enlarged view should show the full frame at its own aspect ratio */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.imageUrl} alt="" className="block max-h-[85vh] w-auto max-w-[92vw]" />
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close enlarged image"
              className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <p className="px-5 py-3 text-[13px] text-muted-foreground">
            {aerialLabel(image)}, captured {formatCaptureRange(image.captureDate)}. {image.attribution}
          </p>
        </dialog>
      )}
    </section>
  );
}
