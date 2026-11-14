"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormSection, MarketChoice, Segmented, SubmitStatus, describe, inputClass } from "./fields";
import { checkInvestor } from "./form-logic";
import { useAnalyzeForm } from "./use-analyze-form";

export function InvestorForm() {
  const { errors, state, onChange, onSubmit } = useAnalyzeForm(checkInvestor);

  return (
    <form noValidate onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-6">
      <FormSection title="Your capital">
        <Field name="capitalUsd" label="Capital to invest" hint="Equity you can put in, in US dollars." error={errors.capitalUsd}>
          <input {...describe("capitalUsd", errors.capitalUsd, true)} inputMode="decimal" autoComplete="off" placeholder="500,000" className={inputClass} />
        </Field>
        <Segmented
          name="riskTolerance"
          legend="Risk you’re comfortable with"
          defaultValue="medium"
          error={errors.riskTolerance}
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
        />
        <Field name="horizonYears" label="How long you’ll hold it" hint="In years, from 1 to 30." error={errors.horizonYears}>
          <input {...describe("horizonYears", errors.horizonYears, true)} inputMode="numeric" defaultValue="5" className={`${inputClass} max-w-40`} />
        </Field>
      </FormSection>

      <FormSection title="What to look for">
        <Segmented
          name="strategy"
          legend="Strategy"
          defaultValue="either"
          error={errors.strategy}
          options={[
            { value: "lease", label: "Lease" },
            { value: "acquire", label: "Buy" },
            { value: "either", label: "Either" },
          ]}
        />
        <p className="-mt-3 text-sm text-muted-foreground">Leasing and buying are always analysed and shown separately.</p>
        <MarketChoice error={errors.markets} />
        <Field
          name="targetPct"
          label="Target yearly return"
          optional
          hint="A percentage, for example 8. It’s your goal, not a promise from the analysis."
          error={errors.targetAnnualReturn}
        >
          <div className="relative max-w-40">
            <input
              {...describe("targetPct", errors.targetAnnualReturn, true)}
              inputMode="decimal"
              placeholder="8"
              className={`${inputClass} pr-9`}
            />
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-lg text-muted-foreground">%</span>
          </div>
        </Field>
        <Field name="goals" label="Other goals" optional hint="One per line, for example “steady income”.">
          <textarea {...describe("goals", undefined, true)} rows={3} className={`${inputClass} h-auto py-2.5`} />
        </Field>
      </FormSection>

      <SubmitStatus state={state} />
      <div className="flex justify-end">
        <Button type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
          Find opportunities
        </Button>
      </div>
    </form>
  );
}
