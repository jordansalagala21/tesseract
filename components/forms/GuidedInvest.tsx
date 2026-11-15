"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SubmitStatus, inputClass } from "./fields";
import { checkInvestor } from "./form-logic";
import type { InvestorDefaults } from "./InvestorForm";
import { useAnalyzeForm } from "./use-analyze-form";

/* ------------------------------------------------------------------ data */

type Answers = {
  capitalUsd?: string;
  strategy?: "acquire" | "lease" | "either";
  markets?: string[];
  /** "" means the user chose no target. */
  targetPct?: string;
  riskTolerance?: "low" | "medium" | "high";
  horizonYears?: string;
};

type StepId = keyof Answers;
const ORDER: StepId[] = ["capitalUsd", "strategy", "markets", "targetPct", "riskTolerance", "horizonYears"];

const money = (v: string) => `$${Number(v.replace(/[$,\s]/g, "")).toLocaleString("en-US")}`;
const STRATEGY = { acquire: "Buy a building", lease: "Lease a space", either: "Open to both" } as const;
const MARKET = (m: string[]) => (m.length === 2 ? "Houston and Los Angeles" : m[0] === "los_angeles" ? "Los Angeles" : "Houston");
const RISK = { low: "Low risk", medium: "Medium risk", high: "High risk" } as const;

/** What the guide asks, and how an answer reads back as the user's reply. */
const STEPS: Record<StepId, { ask: (a: Answers) => string; reply: (a: Answers) => string }> = {
  capitalUsd: { ask: () => "Hi, I’m Tess. I’ll find buildings and spaces your money could work in. How much capital can you put in?", reply: (a) => money(a.capitalUsd!) },
  strategy: { ask: (a) => `Nice, ${money(a.capitalUsd!)}. Do you want to buy a building, lease a space to run a business, or see both?`, reply: (a) => STRATEGY[a.strategy!] },
  markets: { ask: () => "Which city should I look in?", reply: (a) => MARKET(a.markets!) },
  targetPct: { ask: () => "Do you have a yearly return in mind? It’s your goal, not a promise.", reply: (a) => (a.targetPct ? `${a.targetPct}% a year` : "No target") },
  riskTolerance: { ask: () => "How much risk are you comfortable with?", reply: (a) => RISK[a.riskTolerance!] },
  horizonYears: { ask: () => "Last one: how many years would you hold it?", reply: (a) => `${a.horizonYears} years` },
};

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- guide */

/**
 * The investor questions as a conversation: a guide pops in and asks one thing at a time, the
 * answers read back as replies (click one to change it), then a summary sends exactly the same
 * request as the full form, through the same validation.
 */
export function GuidedInvest({ preset, onUseForm }: { preset?: InvestorDefaults; onUseForm: () => void }) {
  const [answers, setAnswers] = useState<Answers>(() => fromPreset(preset));
  const [step, setStep] = useState<number>(() => (preset ? ORDER.length : 0));
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const { errors, state, onSubmit } = useAnalyzeForm(checkInvestor);

  // The guide "types" briefly before each new question, then the newest message scrolls into view.
  useEffect(() => {
    const t1 = setTimeout(() => setTyping(true), 0);
    const t2 = setTimeout(() => setTyping(false), reducedMotion() ? 0 : 650);
    const t3 = setTimeout(() => end.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest" }), reducedMotion() ? 0 : 700);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [step]);

  const answer = (patch: Answers) => {
    const next = { ...answers, ...patch };
    setAnswers(next);
    // Continue with the first unanswered question, or the summary if everything is answered.
    const open = ORDER.findIndex((id) => next[id] === undefined);
    setStep(open === -1 ? ORDER.length : open);
  };
  const edit = (id: StepId) => setStep(ORDER.indexOf(id));

  const asked = ORDER.slice(0, Math.min(step, ORDER.length) + 1);
  const current = ORDER[step];

  return (
    <div className="flex flex-col gap-4">
      <div role="log" aria-live="polite" aria-label="Questions from Tess" className="flex flex-col gap-4">
        {asked.map((id, i) => {
          const isCurrent = id === current;
          const done = answers[id] !== undefined && !isCurrent;
          return (
            <div key={id} className="flex flex-col gap-3">
              <GuideBubble first={i === 0} typing={isCurrent && typing}>
                {STEPS[id].ask(answers)}
              </GuideBubble>
              {done && (
                <button
                  type="button"
                  onClick={() => edit(id)}
                  className="group animate-tess-rise inline-flex max-w-[85%] items-center gap-2 self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-base font-medium text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${STEPS[id].reply(answers)}. Change this answer`}
                >
                  {STEPS[id].reply(answers)}
                  <Pencil className="size-3.5 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                </button>
              )}
              {isCurrent && !typing && (
                <div className="animate-tess-rise pl-12 sm:pl-14">
                  <AnswerInput id={id} answers={answers} onAnswer={answer} />
                </div>
              )}
            </div>
          );
        })}

        {step >= ORDER.length && (
          <div className="flex flex-col gap-3">
            <GuideBubble typing={typing}>Here’s what I’ll look for. Change anything by tapping your answer above.</GuideBubble>
            {!typing && (
              <form noValidate onSubmit={onSubmit} className="animate-tess-rise flex flex-col gap-4 pl-12 sm:pl-14">
                <Hidden answers={answers} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-3">
                  {ORDER.map((id) => (
                    <div key={id}>
                      <dt className="text-xs text-muted-foreground">{LABEL[id]}</dt>
                      <dd className="font-semibold">{STEPS[id].reply(answers)}</dd>
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
            )}
          </div>
        )}
        <div ref={end} />
      </div>

      <button type="button" onClick={onUseForm} className="min-h-11 self-start text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
        Prefer a form? Use the full form instead
      </button>
    </div>
  );
}

const LABEL: Record<StepId, string> = { capitalUsd: "Capital", strategy: "Strategy", markets: "City", targetPct: "Target return", riskTolerance: "Risk", horizonYears: "Hold for" };

function fromPreset(p?: InvestorDefaults): Answers {
  if (!p) return {};
  return { capitalUsd: p.capitalUsd, strategy: p.strategy, markets: p.markets, targetPct: p.targetPct ?? "", riskTolerance: p.riskTolerance, horizonYears: p.horizonYears };
}

/** The same field names as the full form, so the same validation and request apply. */
function Hidden({ answers: a }: { answers: Answers }) {
  return (
    <>
      <input type="hidden" name="capitalUsd" value={a.capitalUsd ?? ""} />
      <input type="hidden" name="strategy" value={a.strategy ?? ""} />
      {(a.markets ?? []).map((m) => (
        <input key={m} type="hidden" name="markets" value={m} />
      ))}
      <input type="hidden" name="targetPct" value={a.targetPct ?? ""} />
      <input type="hidden" name="riskTolerance" value={a.riskTolerance ?? ""} />
      <input type="hidden" name="horizonYears" value={a.horizonYears ?? ""} />
      <input type="hidden" name="goals" value="" />
    </>
  );
}

/* ------------------------------------------------------------- the guide */

function GuideBubble({ children, typing, first }: { children: React.ReactNode; typing?: boolean; first?: boolean }) {
  return (
    <div className="flex items-end gap-2.5">
      <Avatar wave={first} />
      <div className="animate-tess-rise max-w-[85%] rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-base leading-snug shadow-sm">
        {typing ? (
          <span className="flex h-6 items-center gap-1" aria-label="Tess is typing">
            {[0, 1, 2].map((d) => (
              <span key={d} className="animate-tess-dot size-2 rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 0.15}s` }} />
            ))}
          </span>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** Tess: an illustrated guide (not a photo of a real person). */
function Avatar({ wave }: { wave?: boolean }) {
  return (
    <span className="animate-tess-pop relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 sm:size-12" aria-hidden="true">
      <svg viewBox="0 0 48 48" className="size-10 sm:size-12">
        <circle cx="24" cy="24" r="24" className="fill-primary/15" />
        <path d="M10 44c1.5-8 7.2-12 14-12s12.5 4 14 12" className="fill-primary" />
        <circle cx="24" cy="20" r="9" fill="#f2c9a5" />
        <path d="M15 19c0-6 4.2-10 9-10s9 4 9 9c-2.5-1.8-6-2.6-9-2.6-3.8 0-6.6 1.3-9 3.6z" fill="#3b2a20" />
        <circle cx="20.8" cy="21" r="1.2" fill="#2a2018" />
        <circle cx="27.2" cy="21" r="1.2" fill="#2a2018" />
        <path d="M21 25.2c1.8 1.5 4.2 1.5 6 0" stroke="#2a2018" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
      {wave && <span className="animate-tess-wave absolute -top-1 -right-1 text-base">👋</span>}
    </span>
  );
}

/* --------------------------------------------------------------- answers */

function Chip({ children, onClick, hint }: { children: React.ReactNode; onClick: () => void; hint?: string }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-11 flex-col items-start justify-center rounded-xl border bg-card px-4 py-2 text-left outline-none hover:border-primary hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-ring">
      <span className="text-base font-medium">{children}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}

function AnswerInput({ id, answers, onAnswer }: { id: StepId; answers: Answers; onAnswer: (a: Answers) => void }) {
  switch (id) {
    case "capitalUsd":
      return <NumberAnswer label="Capital in US dollars" placeholder="e.g. 2,000,000" initial={answers.capitalUsd} chips={["500,000", "2,000,000", "7,500,000"]} format={money} onDone={(v) => onAnswer({ capitalUsd: v })} />;
    case "strategy":
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          <Chip onClick={() => onAnswer({ strategy: "acquire" })} hint="Buildings listed for sale">Buy a building</Chip>
          <Chip onClick={() => onAnswer({ strategy: "lease" })} hint="Advertised spaces">Lease a space</Chip>
          <Chip onClick={() => onAnswer({ strategy: "either" })} hint="Shown separately">Open to both</Chip>
        </div>
      );
    case "markets":
      return (
        <div className="flex flex-wrap gap-2">
          <Chip onClick={() => onAnswer({ markets: ["houston"] })}>Houston</Chip>
          <Chip onClick={() => onAnswer({ markets: ["los_angeles"] })}>Los Angeles</Chip>
          <Chip onClick={() => onAnswer({ markets: ["houston", "los_angeles"] })}>Both</Chip>
        </div>
      );
    case "targetPct":
      return <NumberAnswer label="Target yearly return in percent" placeholder="e.g. 8" suffix="%" initial={answers.targetPct || undefined} chips={["6", "8", "10"]} format={(v) => `${v}%`} onDone={(v) => onAnswer({ targetPct: v })} skip={{ label: "No target", onSkip: () => onAnswer({ targetPct: "" }) }} />;
    case "riskTolerance":
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          <Chip onClick={() => onAnswer({ riskTolerance: "low" })} hint="Proven, steady">Low</Chip>
          <Chip onClick={() => onAnswer({ riskTolerance: "medium" })} hint="Some repositioning">Medium</Chip>
          <Chip onClick={() => onAnswer({ riskTolerance: "high" })} hint="Bigger changes">High</Chip>
        </div>
      );
    case "horizonYears":
      return (
        <div className="flex flex-wrap gap-2">
          {["3", "5", "7", "10"].map((y) => (
            <Chip key={y} onClick={() => onAnswer({ horizonYears: y })}>
              {y} years
            </Chip>
          ))}
        </div>
      );
  }
}

function NumberAnswer({
  label,
  placeholder,
  suffix,
  initial,
  chips,
  format,
  onDone,
  skip,
}: {
  label: string;
  placeholder: string;
  suffix?: string;
  initial?: string;
  chips: string[];
  format: (v: string) => string;
  onDone: (v: string) => void;
  skip?: { label: string; onSkip: () => void };
}) {
  const [value, setValue] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const submit = (v: string) => {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    if (!v.trim() || !Number.isFinite(n) || n <= 0) return setError("Enter a number above zero.");
    setError(null);
    onDone(v.replace(/[$%\s]/g, ""));
  };
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c} onClick={() => submit(c)}>
            {format(c)}
          </Chip>
        ))}
        {skip && <Chip onClick={skip.onSkip}>{skip.label}</Chip>}
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex max-w-sm gap-2"
      >
        <div className="relative flex-1">
          <input
            aria-label={label}
            aria-invalid={error ? true : undefined}
            inputMode="decimal"
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={cn(inputClass, suffix && "pr-9")}
          />
          {suffix && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-lg text-muted-foreground">{suffix}</span>}
        </div>
        <Button type="submit" variant="outline" aria-label="Next">
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </form>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
