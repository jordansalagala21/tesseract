"use client";

import { cn } from "@/lib/utils";

/**
 * One segmented control for every switcher (tour scans, aerial views, before/after uses).
 * Buttons with aria-pressed; 44 px tall so they are easy to tap.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 shrink-0 rounded-lg px-4 text-base font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
            o.value === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
