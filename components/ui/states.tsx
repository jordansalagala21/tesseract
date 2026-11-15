import { cn } from "@/lib/utils";

/** A grey placeholder block that pulses while content loads (holds still with reduced motion). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-lg bg-muted motion-safe:animate-pulse", className)} />;
}

/**
 * The one look for "nothing here" and "something went wrong": a short title, one plain sentence
 * on why or what to do, and an optional action.
 */
export function EmptyState({
  title,
  children,
  action,
  icon: Icon,
  role,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  role?: "alert" | "status";
  className?: string;
}) {
  return (
    <div role={role} className={cn("flex flex-col items-center rounded-2xl border bg-card px-5 py-10 text-center", className)}>
      {Icon && (
        <span className="mb-3 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <p className="text-lg font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-base text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
