"use client";

// Small motion helpers for the results page. Styles: motion.module.css (off under reduced motion).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import m from "./motion.module.css";

export { m as motion };

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A stagger delay for the nth item, as the --d custom property the CSS reads. */
export const delay = (n: number, step = 70): CSSProperties => ({ ["--d" as string]: `${n * step}ms` });

/**
 * Rises into view when scrolled to. Content is visible on the first render and without
 * IntersectionObserver; it is only hidden once the browser can reveal it again.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "waiting" | "shown">("static");
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || typeof IntersectionObserver === "undefined") return;
    // Already on screen: leave it as it is.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setState(entry.isIntersecting ? "shown" : (s) => (s === "shown" ? s : "waiting"));
        if (entry.isIntersecting) io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn(state !== "static" && m.reveal, state === "shown" && m.shown, className)}>
      {children}
    </div>
  );
}

/** Counts up from 0 to `to` when the component mounts. Null stays null. */
export function useCountUp(to: number | null, ms = 900): number | null {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (to === null) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = reduced() ? 1 : Math.min(1, (t - t0) / ms);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return to === null ? null : value;
}

/** False on the first paint, true right after: lets a bar transition from 0 to its width. */
export function useMounted(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  return on;
}
