"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SubmitStatus } from "./fields";
import { checkInvestor } from "./form-logic";
import { AnswerInput, fromPreset, Hidden, LABEL, ORDER, reducedMotion, STEPS, type Answers } from "./GuidedInvest";
import { InvestorForm, type InvestorDefaults } from "./InvestorForm";
import { useAnalyzeForm } from "./use-analyze-form";

const EXAMPLES: { id: string; title: string; values: InvestorDefaults }[] = [
  { id: "buy", title: "Buy for income · $7.5M · Houston · 8%", values: { capitalUsd: "7,500,000", riskTolerance: "medium", horizonYears: "7", strategy: "acquire", markets: ["houston"], targetPct: "8" } },
  { id: "lease", title: "Lease and operate · $500K · Houston", values: { capitalUsd: "500,000", riskTolerance: "medium", horizonYears: "5", strategy: "lease", markets: ["houston"] } },
  { id: "either", title: "Open to both · $3M · Los Angeles · 7%", values: { capitalUsd: "3,000,000", riskTolerance: "low", horizonYears: "10", strategy: "either", markets: ["los_angeles"], targetPct: "7" } },
];

/** How long Tess takes to slide in, and to "type" before each question. */
const ENTER_MS = 950;
const TYPE_MS = 650;

/**
 * The investor page as a stage: it starts empty, Tess slides in from the side and asks one
 * question at a time in a speech bubble. Answers go through the same validation and request
 * as the full form. Examples and the full form stay one tap away.
 */
export function StageInvest() {
  const [view, setView] = useState<"stage" | "form">("stage");
  const [preset, setPreset] = useState<(typeof EXAMPLES)[number] | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  if (view === "form") {
    return (
      <div className="mx-auto flex w-full max-w-form flex-col gap-4">
        <InvestorForm key={preset?.id ?? "blank"} defaults={preset?.values} />
        <button type="button" onClick={() => setView("stage")} className="min-h-11 self-start text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to Tess
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Stage key={preset?.id ?? "blank"} preset={preset?.values} />
      <div className="flex flex-col items-center gap-3 text-sm">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          <button type="button" onClick={() => setShowExamples(!showExamples)} aria-expanded={showExamples} className="min-h-11 font-medium text-primary underline-offset-4 hover:underline">
            Try an example
          </button>
          <button type="button" onClick={() => setView("form")} className="min-h-11 font-medium text-primary underline-offset-4 hover:underline">
            Use the full form
          </button>
        </div>
        {showExamples && (
          <div className="animate-tess-rise flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setPreset(e);
                  setShowExamples(false);
                }}
                className="min-h-11 rounded-full border bg-card px-4 text-sm font-medium hover:border-primary hover:bg-primary/[0.04]"
              >
                {e.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stage({ preset }: { preset?: InvestorDefaults }) {
  const [answers, setAnswers] = useState<Answers>(() => fromPreset(preset));
  const [step, setStep] = useState(() => (preset ? ORDER.length : 0));
  const [entered, setEntered] = useState(false);
  const [typing, setTyping] = useState(true);
  const { errors, state, onSubmit } = useAnalyzeForm(checkInvestor);
  const done = step >= ORDER.length;
  const id = ORDER[step];

  // Tess slides in first; then, for every question, she "types" for a moment.
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), reducedMotion() ? 0 : ENTER_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!entered) return;
    const t1 = setTimeout(() => setTyping(true), 0);
    const t2 = setTimeout(() => setTyping(false), reducedMotion() ? 0 : TYPE_MS);
    return () => [t1, t2].forEach(clearTimeout);
  }, [step, entered]);

  const answer = (patch: Answers) => {
    const next = { ...answers, ...patch };
    setAnswers(next);
    const open = ORDER.findIndex((k) => next[k] === undefined);
    setStep(open === -1 ? ORDER.length : open);
  };

  const question = done ? "Here’s what I’ll look for. Ready?" : STEPS[id].ask(answers);

  return (
    <section aria-label="Questions from Tess" className="mx-auto flex min-h-[62vh] w-full max-w-4xl flex-col items-center justify-center gap-6 md:flex-row md:items-center md:gap-10">
      <div className="animate-stage-enter shrink-0">
        <div className={cn(entered && "animate-stage-bob")}>
          {/* key: a small hop each time a new question comes up */}
          <div key={step} className={cn(entered && step > 0 && "animate-stage-hop")}>
            <Tess />
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-xl flex-col gap-5">
        <div role="status" aria-live="polite" className={cn("relative min-h-24 rounded-3xl border bg-card px-5 py-4 text-lg leading-snug shadow-sm transition-opacity sm:text-xl", !entered && "opacity-0")}>
          {/* speech-bubble tail, pointing at Tess */}
          <span aria-hidden="true" className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-t border-l bg-card md:top-1/2 md:-left-2 md:-translate-y-1/2 md:translate-x-0 md:border-t-0 md:border-r-0 md:border-b md:border-l" />
          {typing ? (
            <span className="flex h-7 items-center gap-1.5" aria-label="Tess is typing">
              {[0, 1, 2].map((d) => (
                <span key={d} className="animate-tess-dot size-2.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </span>
          ) : (
            <span key={step} className="animate-tess-rise block">
              {question}
            </span>
          )}
        </div>

        {entered && !typing && (
          <div key={step} className="animate-tess-rise">
            {done ? (
              <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
                <Hidden answers={answers} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-3">
                  {ORDER.map((k, i) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{LABEL[k]}</dt>
                      <dd>
                        <button type="button" onClick={() => setStep(i)} className="text-left font-semibold underline-offset-4 hover:text-primary hover:underline">
                          {STEPS[k].reply(answers)}
                        </button>
                      </dd>
                    </div>
                  ))}
                </dl>
                {Object.keys(errors).length > 0 && <p className="text-sm font-medium text-destructive">{Object.values(errors)[0]}</p>}
                <SubmitStatus state={state} />
                <Button type="submit" disabled={state.kind === "sending"} className="self-start sm:min-w-56">
                  {state.kind === "sending" ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
                  Find buildings that fit
                </Button>
              </form>
            ) : (
              <AnswerInput id={id} answers={answers} onAnswer={answer} />
            )}
          </div>
        )}

        {entered && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground disabled:invisible"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={ORDER.length} aria-valuenow={Math.min(step, ORDER.length)} aria-label="Questions answered">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(Math.min(step, ORDER.length) / ORDER.length) * 100}%` }} />
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">{done ? "Done" : `${step + 1} of ${ORDER.length}`}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/** Tess: an illustrated guide (not a likeness of a real person). */
function Tess() {
  return (
    <svg viewBox="0 0 160 190" className="h-36 w-auto md:h-56" role="img" aria-label="Tess, your guide">
      {/* body */}
      <path d="M28 190c3-38 24-60 52-60s49 22 52 60z" className="fill-primary" />
      <path d="M66 132l14 18 14-18" fill="#fff" opacity="0.9" />
      {/* waving arm */}
      <g className="animate-stage-wave">
        <path d="M118 150c10-14 16-30 18-48" stroke="#f2c9a5" strokeWidth="11" strokeLinecap="round" fill="none" />
        <circle cx="137" cy="98" r="8" fill="#f2c9a5" />
      </g>
      {/* neck and head */}
      <rect x="71" y="108" width="18" height="18" rx="6" fill="#e9b892" />
      <ellipse cx="80" cy="78" rx="34" ry="38" fill="#f2c9a5" />
      {/* hair */}
      <path d="M45 76c-2-26 14-44 36-44s37 16 35 42c-8-10-20-16-35-16-15 0-27 6-36 18z" fill="#3b2a20" />
      <path d="M46 74c-6 10-6 26 2 36" stroke="#3b2a20" strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* eyes */}
      <g className="animate-stage-blink">
        <ellipse cx="68" cy="82" rx="3.6" ry="4.4" fill="#2a2018" />
        <ellipse cx="92" cy="82" rx="3.6" ry="4.4" fill="#2a2018" />
      </g>
      {/* cheeks and smile */}
      <circle cx="60" cy="94" r="5" fill="#ef9a8a" opacity="0.45" />
      <circle cx="100" cy="94" r="5" fill="#ef9a8a" opacity="0.45" />
      <path d="M70 97c6 6 14 6 20 0" stroke="#2a2018" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
