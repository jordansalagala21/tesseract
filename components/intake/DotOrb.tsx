"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { createDotOrb, type OrbState } from "./dot-orb-engine";

/**
 * The AI status indicator: a dot-matrix orb of latitude rows (spec: orb-reference/orb-reference-notes.md).
 * thinking = rows bubble outward in a rising wave, working = fast tumble with a sweeping scan band,
 * success = slow turn with a stronger teal glow, stuck = snaps into an 8×8 dot-grid cube, turns
 * corner-on and waits. With reduced motion it draws one still frame per status.
 * Decorative: the text beside it carries the meaning. Pass size="css" to size it with className.
 */
export function DotOrb({
  status,
  size = 160,
  color = "#16201d",
  glow = "#1d6a56",
  className,
}: {
  status: OrbState;
  size?: number | "css";
  color?: string;
  glow?: string;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const orb = useRef<ReturnType<typeof createDotOrb> | null>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    orb.current = createDotOrb(canvas.current, { color, glow, still });
    return () => {
      orb.current?.destroy();
      orb.current = null;
    };
  }, [color, glow]);

  // Runs after the effect above on mount, so the orb starts in the right status.
  useEffect(() => {
    orb.current?.setState(status);
  }, [status, color, glow]);

  return <canvas ref={canvas} aria-hidden="true" className={cn("block shrink-0", className)} style={size === "css" ? undefined : { width: size, height: size }} />;
}
