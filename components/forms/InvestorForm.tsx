"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormSection, MarketChoice, Segmented, SubmitStatus, describe, inputClass } from "./fields";
import { checkInvestor } from "./form-logic";
import { useAnalyzeForm } from "./use-analyze-form";

/** Starting values, e.g. from an example preset. Every field stays editable. */
export type InvestorDefaults = {
  capitalUsd?: string;
  riskTolerance?: "low" | "medium" | "high";
  horizonYears?: string;
  strategy?: "lease" | "acquire" | "either";
  markets?: string[];
  targetPct?: string;
  goals?: string;
};

export function InvestorForm({ defaults = {} }: { defaults?: InvestorDefaults }) {
  const { errors, state, onChange, onSubmit } = useAnalyzeForm(checkInvestor);

  return (
    <form noValidate onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <FormSection title="Your capital">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field name="capitalUsd" label="Capital to invest" hint="Equity you can put in, in US dollars." error={errors.capitalUsd}>
            <input {...describe("capitalUsd", errors.capitalUsd, true)} inputMode="decimal" autoComplete="off" placeholder="e.g. 500,000" defaultValue={defaults.capitalUsd} className={inputClass} />
          </Field>
          <Field name="horizonYears" label="Hold for" hint="Years, 1 to 30." error={errors.horizonYears}>
            <input {...describe("horizonYears", errors.horizonYears, true)} inputMode="numeric" defaultValue={defaults.horizonYears ?? "5"} className={inputClass} />
          </Field>
        </div>
        <Segmented
          name="riskTolerance"
          legend="Risk you’re comfortable with"
          defaultValue={defaults.riskTolerance ?? "medium"}
          error={errors.riskTolerance}
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
        />
      </FormSection>

      <FormSection title="What to look for">
        <Segmented
          name="strategy"
          legend="Strategy"
          defaultValue={defaults.strategy ?? "either"}
          error={errors.strategy}
          options={[
            { value: "lease", label: "Lease" },
            { value: "acquire", label: "Buy" },
            { value: "either", label: "Either" },
          ]}
        />
        <p className="-mt-3 text-sm text-muted-foreground">Leasing and buying are always analysed and shown separately.</p>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <MarketChoice error={errors.markets} defaults={defaults.markets} />
          <Field
          name="targetPct"
          label="Target return"
          optional
          hint="Your goal, not a promise."
          error={errors.targetAnnualReturn}
        >
          <div className="relative">
            <input
              {...describe("targetPct", errors.targetAnnualReturn, true)}
              inputMode="decimal"
              placeholder="e.g. 8"
              defaultValue={defaults.targetPct}
              className={`${inputClass} pr-9`}
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-lg text-muted-foreground">%</span>
          </div>
        </Field>
        </div>
        <Field name="goals" label="Other goals" optional hint="One per line, for example “steady income”.">
          <textarea {...describe("goals", undefined, true)} rows={2} defaultValue={defaults.goals} className={`${inputClass} h-auto py-2.5`} />
        </Field>
      </FormSection>

      <SubmitStatus state={state} />
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Takes about a minute. You’ll watch the agent work.</p>
        <Button type="submit" disabled={state.kind === "sending"} className="sm:min-w-56">
          {state.kind === "sending" && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
          Find buildings that fit
        </Button>
      </div>
    </form>
  );
}
