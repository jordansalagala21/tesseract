import type { AerialImagery } from "@/lib/contracts";

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Top-down" or "Looking north" */
export function aerialLabel(a: Pick<AerialImagery, "kind" | "direction">): string {
  if (a.kind === "ortho") return "Top-down";
  return a.direction ? `Looking ${a.direction}` : "Angled";
}

/** "Dec 19, 2025 – Jan 2, 2026", or a single day when first and last match. */
export function formatCaptureRange({ first, last }: AerialImagery["captureDate"]): string {
  const a = day.format(new Date(first));
  const b = day.format(new Date(last));
  return a === b ? a : `${a} – ${b}`;
}

/** Ground sample distance in cm per pixel: "7.2–7.9 cm per pixel". */
export function formatGsd({ min, max }: AerialImagery["gsdMeters"]): string {
  const cm = (m: number) => (Math.round(m * 1000) / 10).toString();
  return min === max ? `${cm(min)} cm per pixel` : `${cm(min)}–${cm(max)} cm per pixel`;
}
