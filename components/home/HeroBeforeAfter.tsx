"use client";

// Homepage hero: a real bare-shell photo (Before) against an AI-generated fit-out of the same
// photo (After), compared with a draggable divider.
//
// Before: Matterport scan JGZk8wzTJYk, 19350 State Highway 249, Houston, Suite 500
// (CoStar listing 38440282). After images are AI renders of that exact frame, made outside the app.
// To add a render, save it as a 1600×900 WebP in public/hero/ and set `after` below.
// Evidence rule (CLAUDE.md §6): a render is never presented as a real fit-out, so the
// "Illustrative concept, AI-generated" label is always on screen whenever an After image is shown.

import Image, { type StaticImageData } from "next/image";
import { ChevronsLeftRight } from "lucide-react";
import shellImg from "@/public/hero/shell.webp";
import gymImg from "@/public/hero/gym.webp";
import cafeImg from "@/public/hero/cafe.webp";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";

const BEFORE = {
  src: shellImg,
  caption: "Matterport scan · Suite 500, Houston",
  address: "19350 State Highway 249, Houston, Suite 500",
  alt: "Bare-shell office floor in Houston: exposed ceiling grid, raw concrete floor, a full wall of windows.",
};

type Use = { id: string; label: string; after: StaticImageData | null; alt: string };

const USES: Use[] = [
  {
    id: "gym",
    label: "Gym",
    after: gymImg,
    alt: "The same floor shown as a boutique gym: AI-generated illustration.",
  },
  {
    id: "cafe",
    label: "Café",
    after: cafeImg,
    alt: "The same floor shown as a café: AI-generated illustration.",
  },
];

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const pill =
  "inline-block rounded-full bg-scrim px-3 py-1.5 text-sm leading-4 font-medium whitespace-nowrap text-scrim-foreground";

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export function HeroBeforeAfter() {
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const [index, setIndex] = useState(0);
  // Divider position, as % of width from the left. Left of it = Before, right of it = After.
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  const use = USES[index];
  const hasAfter = use.after !== null;

  const moveTo = useCallback((clientX: number) => {
    const r = frame.current?.getBoundingClientRect();
    if (r && r.width > 0) setPos(clamp(((clientX - r.left) / r.width) * 100));
  }, []);

  // One-time hint on load: sweep the divider so people see it moves. Skipped with reduced motion.
  const hinted = useRef(false);
  useEffect(() => {
    if (reduced || hinted.current || !hasAfter) return;
    // Mark it done only once it has run, so React's dev double-effect doesn't cancel it.
    const out = setTimeout(() => setPos(78), 400);
    const back = setTimeout(() => {
      setPos(50);
      hinted.current = true;
    }, 1100);
    return () => {
      clearTimeout(out);
      clearTimeout(back);
    };
  }, [reduced, hasAfter]);

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const move: Record<string, (p: number) => number> = {
      ArrowLeft: (p) => p - step,
      ArrowRight: (p) => p + step,
      Home: () => 0,
      End: () => 100,
    };
    const f = move[e.key];
    if (!f) return;
    e.preventDefault();
    // Functional update: held-down keys repeat faster than renders, so each step builds on the last.
    setPos((p) => clamp(f(p)));
  };

  return (
    <figure className="relative overflow-hidden rounded-2xl border bg-muted">
      <div
        ref={frame}
        className={cn("relative aspect-[4/3] touch-pan-y select-none", hasAfter && "cursor-ew-resize")}
        onPointerDown={(e) => {
          if (!hasAfter) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => dragging && moveTo(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <Image
          src={BEFORE.src}
          alt={BEFORE.alt}
          fill
          priority
          placeholder="blur"
          sizes="(min-width: 1024px) 640px, 100vw"
          className="object-cover"
          draggable={false}
        />

        {hasAfter && (
          <div
            className={cn(
              "absolute inset-0",
              !dragging && "transition-[clip-path] duration-700 ease-out motion-reduce:transition-none",
            )}
            style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
          >
            <Image
              key={use.id}
              src={use.after!}
              alt={use.alt}
              fill
              placeholder="blur"
              sizes="(min-width: 1024px) 640px, 100vw"
              className="object-cover"
              draggable={false}
            />
          </div>
        )}

        {hasAfter && (
          <div
            role="slider"
            tabIndex={0}
            aria-label={`Compare the bare shell with the ${use.label.toLowerCase()} concept`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={`${Math.round(pos)}% bare shell`}
            onKeyDown={onKey}
            className={cn(
              "group absolute inset-y-0 -ml-6 w-12 cursor-ew-resize outline-none",
              !dragging && "transition-[left] duration-700 ease-out motion-reduce:transition-none",
            )}
            style={{ left: `${pos}%` }}
          >
            <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-scrim-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" />
            <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-black/10 group-focus-visible:ring-4 group-focus-visible:ring-ring">
              <ChevronsLeftRight className="size-5" aria-hidden="true" />
            </span>
          </div>
        )}

        {/* Evidence labels stay on the image at all times. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <span className={cn(pill, "font-semibold")}>Today: bare shell</span>
          {hasAfter ? (
            <span className={cn(pill, "font-semibold")}>Could be: {use.label.toLowerCase()}</span>
          ) : (
            <span className={pill}>{use.label} concept render coming soon</span>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <span className={pill}>Real photo</span>
          {hasAfter && <span className={pill}>AI-generated concept</span>}
        </div>
      </div>

      <figcaption className="flex flex-col gap-3 border-t bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <Segmented
          className="shrink-0 self-start"
          label="Choose a new use"
          options={USES.map((u) => ({ value: u.id, label: u.label }))}
          value={use.id}
          onChange={(id) => {
            setIndex(USES.findIndex((u) => u.id === id));
            setPos(50);
          }}
        />
        <p className="text-sm text-muted-foreground sm:text-right">
          Photo from the Matterport scan of {BEFORE.address}.
          {hasAfter && " Drag the handle, or use the arrow keys, to compare."}
        </p>
      </figcaption>
    </figure>
  );
}
