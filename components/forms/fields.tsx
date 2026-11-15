// Small form building blocks: labelled fields with hints and inline errors, a segmented choice,
// and market checkboxes. Errors are tied to inputs with aria-invalid and aria-describedby.
import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-xl border bg-card px-3.5 text-lg outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/25";

/** Props that link an input to its hint and error text. */
export function describe(name: string, error?: string, hint?: boolean) {
  const ids = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ");
  return { id: name, name, "aria-invalid": error ? true : undefined, "aria-describedby": ids || undefined };
}

export function Field({
  name,
  label,
  hint,
  error,
  optional,
  children,
}: {
  name: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-base font-semibold">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted-foreground">Optional</span>}
      </label>
      {children}
      {hint && (
        <p id={`${name}-hint`} className="text-sm leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-sm leading-snug font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** A radio group drawn as a segmented control. */
export function Segmented({
  name,
  legend,
  options,
  defaultValue,
  error,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  error?: string;
}) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined} className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-base font-semibold">{legend}</legend>
      <div className={cn("flex gap-1 rounded-xl bg-muted p-1", error && "ring-2 ring-destructive/40")}>
        {options.map((o) => (
          <label
            key={o.value}
            className="relative flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-base font-medium text-muted-foreground transition-colors has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function MarketChoice({ error, defaults = ["houston"] }: { error?: string; defaults?: string[] }) {
  const markets = [
    { value: "houston", label: "Houston" },
    { value: "los_angeles", label: "Los Angeles" },
  ];
  return (
    <fieldset aria-describedby={error ? "markets-error" : undefined} className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-base font-semibold">Markets</legend>
      <div className="flex flex-wrap gap-2">
        {markets.map((m) => (
          <label
            key={m.value}
            className={cn(
              "flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-4 text-lg has-checked:border-primary has-checked:bg-primary/[0.06] has-focus-visible:ring-2 has-focus-visible:ring-ring",
              error && "border-destructive",
            )}
          >
            <input type="checkbox" name="markets" value={m.value} defaultChecked={defaults.includes(m.value)} className="size-4 accent-primary" />
            {m.label}
          </label>
        ))}
      </div>
      {error && (
        <p id="markets-error" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** What happened after submit, in the interface's voice. */
export function SubmitStatus({ state }: { state: import("./use-analyze-form").SubmitState }) {
  if (state.kind === "idle" || state.kind === "sending") return null;
  const tone = state.kind === "started" ? "border-primary/40 bg-primary/[0.06]" : state.kind === "failed" ? "border-destructive/40 bg-destructive/[0.06]" : "border-dashed border-muted-foreground/40";
  return (
    <div role="status" className={cn("rounded-2xl border px-4 py-3 text-base leading-snug", tone)}>
      {state.kind === "started" && (
        <p>
          <span className="font-semibold">Analysis started.</span> Reference {state.analysisId}.
        </p>
      )}
      {state.kind === "not_ready" && (
        <p>
          <span className="font-semibold">Your answers are valid.</span> The analysis service isn’t switched on yet (
          {state.issue}), so nothing ran. Try again once it is live.
        </p>
      )}
      {state.kind === "failed" && (
        <p>
          <span className="font-semibold text-destructive">The analysis didn’t start.</span> {state.message}
        </p>
      )}
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
