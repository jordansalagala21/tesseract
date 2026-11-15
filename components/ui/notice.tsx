import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  /** Context the reader should keep in mind (sample data, limitations). */
  info: { box: "border-border bg-muted/50", icon: "text-muted-foreground", Icon: Info },
  /** Read this before trusting the number next to it (mixed lease types, AI caveats). */
  warning: { box: "border-warning/40 bg-warning/10", icon: "text-warning", Icon: AlertTriangle },
  /** Something blocks this idea. */
  danger: { box: "border-destructive/35 bg-destructive/[0.06]", icon: "text-destructive", Icon: ShieldAlert },
} as const;

/** One look for every caveat, limitation and warning: an icon, a short title, then the detail. */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div role="note" className={cn("flex gap-3 rounded-xl border px-4 py-3", t.box, className)}>
      <t.Icon className={cn("mt-0.5 size-4 shrink-0", t.icon)} aria-hidden="true" />
      <div className="min-w-0 text-base">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}
