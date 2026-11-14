"use client";

// Concept clips: a real bare-shell frame of 2600 Travis St, Suite 100 (Matterport scan NxYn1owequw)
// turning into a new use. Drop the files into public/hero/ with these names:
//   shell-to-gym.mp4, shell-to-gym.webm, shell-to-gym.jpg (poster)
//   shell-to-cafe.mp4, shell-to-cafe.webm, shell-to-cafe.jpg (poster)
// Keep each under about 3 MB and around 1280 px wide. Until they land, the posters are neutral placeholders.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const CLIPS = [
  { id: "gym", label: "Bare shell → Gym", short: "Gym", base: "/hero/shell-to-gym" },
  { id: "cafe", label: "Bare shell → Café", short: "Café", base: "/hero/shell-to-cafe" },
] as const;

/** How long a clip that can't play (missing file) stays up before the cycle moves on. */
const FALLBACK_MS = 6000;

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const pill = "inline-block rounded-full bg-black/65 px-2.5 py-1 text-[11px] leading-4 font-medium text-white backdrop-blur-sm sm:text-[12px]";

export function HeroTransformations() {
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Only clips that have been shown are mounted, so the second clip loads lazily.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const playing = !reduced && !paused;

  const show = useCallback((i: number) => {
    setIndex(i);
    setSeen((s) => (s.has(i) ? s : new Set(s).add(i)));
  }, []);
  const next = useCallback(() => show((index + 1) % CLIPS.length), [index, show]);

  // Play only the visible clip; pause the rest.
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === index && playing) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
    if (!playing) return;
    // Watchdog: a clip that can't play (file missing or not loaded yet) still takes its turn,
    // so the labels keep cycling. Checked by state, since a source error can fire before hydration.
    const t = setTimeout(() => {
      const v = videos.current[index];
      if (!v || v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) next();
    }, FALLBACK_MS);
    return () => clearTimeout(t);
  }, [index, playing, seen, next]);

  const clip = CLIPS[index];

  return (
    <figure className="relative overflow-hidden rounded-[28px] border bg-muted">
      {/* figcaption below holds the clip controls; the evidence labels sit on the video itself */}
      <div className="relative aspect-[16/10]">
        {CLIPS.map((c, i) =>
          seen.has(i) ? (
            <video
              key={c.id}
              ref={(el) => {
                videos.current[i] = el;
              }}
              muted
              playsInline
              preload="metadata"
              poster={`${c.base}.jpg`}
              onEnded={next}
              aria-hidden={i !== index}
              aria-label={`Concept clip of the bare shell at 2600 Travis St, Suite 100 turning into a ${c.short.toLowerCase()}. AI-generated illustration.`}
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-500 motion-reduce:transition-none",
                i === index ? "opacity-100" : "opacity-0",
              )}
            >
              <source src={`${c.base}.webm`} type="video/webm" />
              <source src={`${c.base}.mp4`} type="video/mp4" />
            </video>
          ) : null,
        )}

        {/* Evidence rule: the render is a concept, never presented as a real fit-out. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <span className={cn(pill, "text-[13px] font-semibold")}>{clip.label}</span>
          <span className={pill}>Illustrative concept, AI-generated</span>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-3">
          <span className={pill}>Starting frame: Matterport scan, 2600 Travis St, Suite 100</span>
        </div>
      </div>
      <figcaption className="flex items-center justify-between gap-3 border-t bg-card px-3 py-2.5 sm:px-4">
        <div role="group" aria-label="Choose a concept clip" className="flex gap-1 rounded-xl bg-muted p-1">
          {CLIPS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={i === index}
              onClick={() => show(i)}
              className={cn(
                "h-8 rounded-lg px-3 text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === index ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.short}
            </button>
          ))}
        </div>
        {!reduced && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play concept clips" : "Pause concept clips"}
            className="grid size-10 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {paused ? <Play className="size-5" aria-hidden="true" /> : <Pause className="size-5" aria-hidden="true" />}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
