import { cn } from "@/lib/utils";

const FACES = ["front", "back", "right", "left", "top", "bottom"] as const;

/**
 * The Tesseract: a glass cube with a smaller cube turning inside it, drawn with CSS 3D transforms
 * (no WebGL). `mode` sets its mood: "idle" turns slowly, "talk" pulses when it asks something,
 * "work" spins faster and glows brighter while the agents run. Styles: `.tcube` in globals.css.
 * Decorative: the questions and progress beside it carry the meaning.
 */
export function TesseractCube({ size = 160, mode = "idle", className }: { size?: number; mode?: "idle" | "talk" | "work"; className?: string }) {
  return (
    <div aria-hidden="true" data-mode={mode} className={cn("tcube", className)} style={{ "--s": `${size}px` } as React.CSSProperties}>
      <div className="tcube-glow" />
      <div className="tcube-body">
        {FACES.map((f) => (
          <div key={f} className={`tcube-face tcube-${f}`} />
        ))}
      </div>
      <div className="tcube-inner">
        {FACES.map((f) => (
          <div key={f} className={`tcube-face tcube-${f}`} />
        ))}
      </div>
    </div>
  );
}
