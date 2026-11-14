import { cn } from "@/lib/utils";

export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-sm leading-5 font-medium",
        tone === "accent" ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
