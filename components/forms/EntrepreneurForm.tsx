"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormSection, MarketChoice, Segmented, SubmitStatus, describe, inputClass } from "./fields";
import { checkEntrepreneur, rentFormula } from "./form-logic";
import { useAnalyzeForm } from "./use-analyze-form";

const toNum = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").replace(/[$,\s]/g, "");
  return t === "" ? undefined : Number(t);
};

export function EntrepreneurForm() {
  const { errors, state, onChange, onSubmit } = useAnalyzeForm(checkEntrepreneur);
  // Mirrors the rent fields so the monthly conversion can be shown as the user types.
  const [rent, setRent] = useState<{ mode: string; amount?: number; sfMax?: number }>({ mode: "monthly" });

  function handleChange(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    setRent({ mode: String(fd.get("rentMode")), amount: toNum(fd.get("rentAmount")), sfMax: toNum(fd.get("sfMax")) });
    onChange(e);
  }

  const formula = rent.mode === "monthly" ? rentFormula(rent.amount, rent.sfMax) : null;

  return (
    <form noValidate onSubmit={onSubmit} onChange={handleChange} className="flex flex-col gap-6">
      <FormSection title="Your business">
        <Field
          name="businessConcept"
          label="What are you opening?"
          hint="A few words, for example “specialty coffee shop with seating”."
          error={errors.businessConcept}
        >
          <input {...describe("businessConcept", errors.businessConcept, true)} autoComplete="off" className={inputClass} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="sfMin" label="Smallest size" hint="Square feet." error={errors.sfMin}>
            <input {...describe("sfMin", errors.sfMin, true)} inputMode="numeric" placeholder="1,500" className={inputClass} />
          </Field>
          <Field name="sfMax" label="Largest size" hint="Square feet." error={errors.sfMax}>
            <input {...describe("sfMax", errors.sfMax, true)} inputMode="numeric" placeholder="2,500" className={inputClass} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Budget and location">
        <Segmented
          name="rentMode"
          legend="How you think about rent"
          defaultValue="monthly"
          options={[
            { value: "monthly", label: "Total per month" },
            { value: "psf", label: "Per SF per year" },
          ]}
        />
        <Field
          name="rentAmount"
          label={rent.mode === "monthly" ? "Most you’d pay per month" : "Most you’d pay per SF per year"}
          optional
          hint={
            rent.mode === "monthly" ? (
              formula ? (
                <>
                  Listings quote rent per SF per year: <span className="font-medium text-foreground tabular-nums">{formula}</span>
                </>
              ) : (
                "Listings quote rent per SF per year. Enter the largest size and we’ll convert it."
              )
            ) : (
              "Asking rent as listed, for example 40."
            )
          }
          error={errors.maxRentPsfYear}
        >
          <div className="relative max-w-56">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-lg text-muted-foreground">$</span>
            <input {...describe("rentAmount", errors.maxRentPsfYear, true)} inputMode="decimal" className={`${inputClass} pl-7`} />
          </div>
        </Field>
        <MarketChoice error={errors.markets} />
        <Field name="mustHaves" label="Must-haves" optional hint="One per line, for example “parking” or “street frontage”.">
          <textarea {...describe("mustHaves", undefined, true)} rows={3} className={`${inputClass} h-auto py-2.5`} />
        </Field>
      </FormSection>

      <SubmitStatus state={state} />
      <div className="flex justify-end">
        <Button type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
          Find spaces that fit
        </Button>
      </div>
    </form>
  );
}
