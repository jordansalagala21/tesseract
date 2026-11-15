"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { FinancialScenario } from "@/lib/contracts";
import { describe, inputClass } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";
import { FIELDS, MODES, ORIGINS, OUTPUTS, UNITS, blankReason, buildInput, defaultDraft, formatOutput, initialDrafts, withUnit, type Drafts } from "./scenario-format";

const linkButton =
  "inline-flex min-h-11 items-center rounded-lg text-left text-base font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring";

/**
 * One what-if scenario (UI-10): editable assumptions, each labelled with where its number came
 * from, and the outputs lib/finance returns for them. Every edit is sent to
 * POST /api/finance/scenario; this component never does the maths itself.
 */
export function ScenarioControls({ scenario, onEvidenceSelect }: { scenario: FinancialScenario; onEvidenceSelect?: (evidenceId: string) => void }) {
  const mode = scenario.input.mode;
  const [drafts, setDrafts] = useState<Drafts>(() => initialDrafts(scenario.input));
  const [result, setResult] = useState(scenario);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const request = useRef<AbortController>(undefined);

  const cancel = () => {
    clearTimeout(timer.current);
    request.current?.abort();
  };
  useEffect(() => cancel, []);

  const { assumptions, errors } = buildInput(scenario.input, drafts);
  const hasErrors = Object.keys(errors).length > 0;
  const changed = FIELDS[mode].some((f) => drafts[f.key].text !== initialDrafts(scenario.input)[f.key].text);

  function update(next: Drafts) {
    setDrafts(next);
    cancel();
    setStatus("idle");
    const input = buildInput(scenario.input, next).input;
    if (!input) return;
    // Wait for a pause in typing, then ask the server to recalculate.
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      setStatus("loading");
      try {
        const res = await fetch("/api/finance/scenario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: scenario.name, input }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Scenario request failed (${res.status})`);
        setResult(FinancialScenario.parse(await res.json()));
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 350);
  }

  function reset() {
    cancel();
    setDrafts(initialDrafts(scenario.input));
    setResult(scenario);
    setStatus("idle");
  }

  return (
    <section aria-labelledby={`${scenario.id}-title`} className="@container rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${scenario.id}-title`} className="text-xl font-semibold text-balance">
            {result.name}
          </h3>
          <p className="mt-1 text-base text-muted-foreground">Change any number and the results update.</p>
        </div>
        <Badge variant="outline">{MODES[mode]}</Badge>
      </div>

      <div className="mt-6 grid gap-8 @3xl:grid-cols-[1.25fr_1fr]">
        <form noValidate onSubmit={(e) => e.preventDefault()} className="grid content-start gap-x-4 gap-y-5 @md:grid-cols-2">
          {FIELDS[mode].map((f) => {
            const name = `${scenario.id}-${f.key}`;
            const a = assumptions[f.key];
            const origin = a ? ORIGINS[a.origin] : null;
            return (
              <div key={f.key} className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <label htmlFor={name} className="text-base font-semibold">
                    {f.label} <span className="font-normal whitespace-nowrap text-muted-foreground">({UNITS[f.unit]})</span>
                  </label>
                  <Badge variant={origin?.variant ?? "outline"} className="shrink-0">
                    <span className="sr-only">Source of this number: </span>
                    {origin?.label ?? (f.optional ? "Not set" : "Needed")}
                  </Badge>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={drafts[f.key].text}
                  onChange={(e) => update({ ...drafts, [f.key]: { text: e.target.value } })}
                  className={inputClass}
                  {...describe(name, errors[f.key], Boolean(f.hint))}
                />
                {f.hint && (
                  <p id={`${name}-hint`} className="text-sm leading-snug text-muted-foreground">
                    {f.hint}
                  </p>
                )}
                {errors[f.key] && (
                  <p id={`${name}-error`} className="text-sm leading-snug font-medium text-destructive">
                    {errors[f.key]}
                  </p>
                )}
                {f.defaultKey && a?.origin !== "default" && (
                  <button type="button" className={linkButton} onClick={() => update({ ...drafts, [f.key]: defaultDraft(f.defaultKey!) })}>
                    Use the app default ({withUnit(defaultDraft(f.defaultKey).text, f.unit)})
                  </button>
                )}
                {a?.evidenceId && onEvidenceSelect && (
                  <button type="button" className={linkButton} onClick={() => onEvidenceSelect(a.evidenceId!)}>
                    See where this number comes from
                  </button>
                )}
              </div>
            );
          })}
          {changed && (
            <div className="@md:col-span-2">
              <Button type="button" variant="outline" onClick={reset}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset to the starting numbers
              </Button>
            </div>
          )}
        </form>

        <div className="flex flex-col gap-4">
          <dl aria-live="polite" aria-busy={status === "loading"} className={cn("grid gap-4", (hasErrors || status !== "idle") && "opacity-60")}>
            {OUTPUTS[mode].map((o) => {
              const value = result.output[o.key];
              return (
                <div key={o.key} className="border-b pb-4 last:border-b-0 last:pb-0">
                  <dt className="text-base text-muted-foreground">{o.label}</dt>
                  {value === null ? (
                    <dd className="mt-1">
                      <span className="text-lg font-semibold">Not calculated</span>
                      <span className="mt-0.5 block text-base text-muted-foreground">{blankReason(o, result.input)}</span>
                    </dd>
                  ) : (
                    <dd className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums">{formatOutput(value, o.unit)}</dd>
                  )}
                </div>
              );
            })}
          </dl>
          <p role="status" className="text-base text-muted-foreground empty:hidden">
            {status === "loading" ? "Recalculating…" : hasErrors ? "Fix the marked fields to recalculate. The results above are from your last valid numbers." : null}
          </p>
          {status === "error" && (
            <Notice tone="danger" title="Couldn't recalculate">
              The results above are from your last valid numbers. Change a number to try again.
            </Notice>
          )}
        </div>
      </div>

      {result.warnings.length > 0 && (
        <Notice tone="warning" title="Read before relying on these numbers" className="mt-6">
          <ul className="list-disc space-y-1 pl-5">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}

      {result.formulas.length > 0 && (
        <div className="mt-6">
          <h4 className="text-base font-semibold">How each number is calculated</h4>
          <ul className="mt-2 space-y-1.5 font-mono text-sm text-muted-foreground">
            {result.formulas.map((formula) => (
              <li key={formula} className="break-words">
                {formula}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">{result.disclaimer}</p>
    </section>
  );
}
