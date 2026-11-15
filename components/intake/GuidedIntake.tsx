"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Search } from "lucide-react";
import { PropertySearchResponse, PropertySpacesResponse, type UserPersona } from "@/lib/contracts";
import { startAnalysis } from "@/components/analysis/start-analysis";
import { inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildInput, fillAsk, nextOpen, parseNumber, skipped } from "./intake-logic";
import { SCRIPTS, type Answer, type Answers, type Question } from "./questions";
import { TesseractCube } from "./TesseractCube";

const ENTER_MS = 900;
const TYPE_MS = 600;
const GLIDE_MS = 700;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const chip =
  "min-h-11 rounded-full border bg-card px-4 text-base font-medium outline-none transition-colors hover:border-primary hover:bg-primary/[0.04] focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";
const link = "inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground";

/**
 * The guided questions for one customer type: the Tesseract cube slides in on the side and asks
 * the questions in `questions.ts` one at a time. The summary sends the answers to the agent, the
 * cube glides to the centre, and the page moves on to the live analysis (the agent loading screen).
 * `alternative` is a link or button shown under the stage, e.g. the full form.
 */
export function GuidedIntake({ persona, alternative }: { persona: UserPersona; alternative?: React.ReactNode }) {
  const script = SCRIPTS[persona];
  const questions = script.questions;
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [entered, setEntered] = useState(false);
  const [typing, setTyping] = useState(true);
  const [sending, setSending] = useState(false);
  const [gliding, setGliding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const done = step >= questions.length;
  const q = questions[step];

  // The cube slides in first; then it "thinks" for a moment before each question.
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

  const answer = (id: string, a: Answer) => {
    const next = { ...answers, [id]: a };
    // A new property clears the suite picked for the old one.
    for (const dep of questions.filter((x) => x.dependsOn === id)) delete next[dep.id];
    setAnswers(next);
    setProblem(null);
    setStep(nextOpen(questions, next));
  };

  async function start() {
    const built = buildInput(script, answers);
    if ("error" in built) return setProblem(built.error);
    setSending(true);
    setProblem(null);
    const r = await startAnalysis({ input: built.input });
    if ("error" in r) {
      setSending(false);
      return setProblem(r.error);
    }
    // The cube glides to the centre, where the agent loading screen picks it up.
    setGliding(true);
    setTimeout(() => router.push(`/analysis/${r.id}`), reducedMotion() ? 0 : GLIDE_MS);
  }

  const say = done ? script.outro : fillAsk(q.ask, answers);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Questions from the Tesseract" className="relative mx-auto flex min-h-[62vh] w-full max-w-5xl flex-col-reverse items-center justify-center gap-8 md:flex-row md:gap-14">
        <div className={cn("flex w-full max-w-xl flex-col gap-5 transition-opacity duration-500", gliding && "opacity-0")}>
          <div role="status" aria-live="polite" className={cn("relative min-h-24 rounded-3xl border bg-card px-5 py-4 text-lg leading-snug shadow-sm sm:text-xl", !entered && "opacity-0")}>
            {/* speech-bubble tail, pointing at the cube */}
            <span aria-hidden="true" className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-t border-l bg-card md:top-1/2 md:-right-2 md:left-auto md:-translate-y-1/2 md:translate-x-0 md:border-l-0 md:border-r" />
            {typing ? (
              <span className="flex h-7 items-center gap-1.5" aria-label="The Tesseract is thinking">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="animate-tess-dot size-2.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 0.15}s` }} />
                ))}
              </span>
            ) : (
              <span key={step} className="animate-tess-rise block">
                {say}
              </span>
            )}
          </div>

          {entered && !typing && (
            <div key={step} className="animate-tess-rise">
              {done ? (
                <Summary answers={answers} questions={questions} onEdit={setStep} />
              ) : (
                <AnswerInput key={q.id} q={q} answers={answers} onAnswer={(a) => answer(q.id, a)} />
              )}
            </div>
          )}

          {problem && (
            <p role="alert" className="text-base font-medium text-destructive">
              {problem}
            </p>
          )}

          {entered && done && !typing && (
            <Button onClick={start} disabled={sending} className="self-start sm:min-w-64">
              {sending ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
              {sending ? "Starting the agents…" : script.submitLabel}
            </Button>
          )}

          {entered && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className={cn(link, "disabled:invisible")}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
              <div
                role="progressbar"
                aria-label="Questions answered"
                aria-valuemin={0}
                aria-valuemax={questions.length}
                aria-valuenow={Math.min(step, questions.length)}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(Math.min(step, questions.length) / questions.length) * 100}%` }} />
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">{done ? "Done" : `${step + 1} of ${questions.length}`}</span>
              {!done && q.optional && (
                <button type="button" onClick={() => answer(q.id, skipped())} className={link}>
                  Skip
                </button>
              )}
            </div>
          )}
        </div>

        {/* The cube on the side; when the agents start it glides to the centre of the stage. */}
        <div
          // Padding: a turning cube's corners reach past its box, so keep them off the bubble.
          className="animate-intake-enter shrink-0 p-8 transition-transform ease-in-out motion-reduce:transition-none md:p-12"
          style={{ transitionDuration: `${GLIDE_MS}ms`, transform: gliding ? "translateX(calc(-50% - 7rem)) scale(1.25)" : undefined }}
        >
          <TesseractCube size={150} mode={gliding ? "work" : typing ? "talk" : "idle"} className="md:hidden" />
          <TesseractCube size={240} mode={gliding ? "work" : typing ? "talk" : "idle"} className="hidden md:block" />
        </div>
      </section>

      <div className="flex flex-col items-center gap-3 text-sm">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          {script.examples.length > 0 && (
            <button type="button" onClick={() => setShowExamples(!showExamples)} aria-expanded={showExamples} className="min-h-11 font-medium text-primary underline-offset-4 hover:underline">
              Try an example
            </button>
          )}
          {alternative}
        </div>
        {showExamples && (
          <div className="animate-tess-rise flex flex-wrap justify-center gap-2">
            {script.examples.map((e) => (
              <button
                key={e.title}
                type="button"
                className={chip}
                onClick={() => {
                  setAnswers(e.answers);
                  setStep(nextOpen(questions, e.answers));
                  setShowExamples(false);
                  setProblem(null);
                }}
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

/** The answers read back; tap one to change it. */
function Summary({ answers, questions, onEdit }: { answers: Answers; questions: Question[]; onEdit: (i: number) => void }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
      {questions.map((q, i) => (
        <div key={q.id} className="min-w-0">
          <dt className="text-sm text-muted-foreground">{fillAsk(q.ask, answers).replace(/^Hi, I’m the Tesseract\.\s*/, "")}</dt>
          <dd>
            <button type="button" onClick={() => onEdit(i)} className="min-h-11 text-left text-base font-semibold underline-offset-4 hover:text-primary hover:underline">
              {answers[q.id]?.label || "Not answered"}
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The answer controls for one question, by its kind. */
function AnswerInput({ q, answers, onAnswer }: { q: Question; answers: Answers; onAnswer: (a: Answer) => void }) {
  if (q.kind === "property") return <PropertyPicker q={q} onAnswer={onAnswer} />;
  if (q.kind === "space") return <SpacePicker propertyId={String(answers[q.dependsOn ?? ""]?.value ?? "")} onAnswer={onAnswer} />;
  if (q.kind === "choice" || q.kind === "multi") return <ChoicePicker q={q} current={answers[q.id]} onAnswer={onAnswer} />;
  if (q.kind === "money" || q.kind === "number") return <NumberAnswer q={q} current={answers[q.id]} onAnswer={onAnswer} />;
  return <TextAnswer q={q} current={answers[q.id]} onAnswer={onAnswer} />;
}

function ChoicePicker({ q, current, onAnswer }: { q: Question; current?: Answer; onAnswer: (a: Answer) => void }) {
  const multi = q.kind === "multi";
  const [picked, setPicked] = useState<string[]>(() => (Array.isArray(current?.value) ? current.value : current?.value ? [current.value] : []));
  const [other, setOther] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const options = q.options ?? [];
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const finish = (values: string[]) => onAnswer({ value: multi ? values : values[0], label: values.map(labelOf).join(", ") });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Options">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={picked.includes(o.value)}
            className={chip}
            onClick={() => (multi ? setPicked(picked.includes(o.value) ? picked.filter((p) => p !== o.value) : [...picked, o.value]) : finish([o.value]))}
          >
            {multi && picked.includes(o.value) && <Check className="mr-1.5 inline size-4" aria-hidden="true" />}
            {o.label}
          </button>
        ))}
        {q.allowOther && (
          <button type="button" aria-expanded={otherOpen} className={chip} onClick={() => setOtherOpen(!otherOpen)}>
            Something else…
          </button>
        )}
      </div>
      {otherOpen && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (other.trim()) finish([...picked, other.trim()]);
          }}
        >
          <label className="sr-only" htmlFor={`${q.id}-other`}>
            Your own answer
          </label>
          <input id={`${q.id}-other`} value={other} onChange={(e) => setOther(e.target.value)} className={inputClass} placeholder="Type your own" autoFocus />
          <Button type="submit" disabled={!other.trim()}>
            Add
          </Button>
        </form>
      )}
      {multi && (
        <Button className="self-start" disabled={picked.length === 0} onClick={() => finish(picked)}>
          Continue
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

function NumberAnswer({ q, current, onAnswer }: { q: Question; current?: Answer; onAnswer: (a: Answer) => void }) {
  const [raw, setRaw] = useState(typeof current?.value === "string" ? current.value : "");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const r = parseNumber(q, raw);
        if ("error" in r) setError(r.error);
        else onAnswer(r);
      }}
    >
      <label htmlFor={q.id} className="sr-only">
        {q.ask}
      </label>
      <div className="flex items-center gap-2">
        {q.kind === "money" && <span className="text-lg text-muted-foreground">$</span>}
        <input
          id={q.id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={q.placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${q.id}-error` : undefined}
          className={cn(inputClass, "max-w-56")}
        />
        {q.unit && <span className="text-base text-muted-foreground">{q.unit}</span>}
        <Button type="submit">
          OK
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {error && (
        <p id={`${q.id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function TextAnswer({ q, current, onAnswer }: { q: Question; current?: Answer; onAnswer: (a: Answer) => void }) {
  const [text, setText] = useState(typeof current?.value === "string" ? current.value : "");
  const send = (t: string) => t.trim() && onAnswer({ value: t.trim(), label: t.trim() });
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label htmlFor={q.id} className="sr-only">
          {q.ask}
        </label>
        <input id={q.id} value={text} onChange={(e) => setText(e.target.value)} placeholder={q.placeholder} autoFocus autoComplete="off" className={inputClass} />
        <Button type="submit" disabled={!text.trim()}>
          OK
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </form>
      {q.examples && (
        <div className="flex flex-wrap gap-2">
          {q.examples.map((ex) => (
            <button key={ex} type="button" className={chip} onClick={() => send(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Found = { id: number; street: string; city: string; name: string | null; spaces: number };

/** Search the CoStar buildings (GET /api/properties) and pick one. */
function PropertyPicker({ q, onAnswer }: { q: Question; onAnswer: (a: Answer) => void }) {
  const [term, setTerm] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [state, setState] = useState<"idle" | "searching" | "error">("idle");

  useEffect(() => {
    if (term.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setState("searching");
      try {
        const res = await fetch(`/api/properties?q=${encodeURIComponent(term.trim())}&limit=6`, { signal: ctrl.signal });
        const parsed = PropertySearchResponse.safeParse(await res.json());
        if (!res.ok || !parsed.success) throw new Error();
        setFound(parsed.data.items.map((p) => ({ id: p.id, street: p.address.street, city: p.address.city, name: p.name, spaces: p.availableSpaceCount })));
        setState("idle");
      } catch {
        if (!ctrl.signal.aborted) setState("error");
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={q.id} className="sr-only">
        Building name or street
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input id={q.id} value={term} onChange={(e) => setTerm(e.target.value)} placeholder={q.placeholder} autoFocus autoComplete="off" className={cn(inputClass, "pl-11")} />
      </div>
      {state === "searching" && <p className="text-sm text-muted-foreground">Searching CoStar…</p>}
      {state === "error" && <p className="text-sm font-medium text-destructive">The property search didn’t answer. Try again in a moment.</p>}
      {found && state === "idle" && term.trim().length >= 2 && (
        found.length === 0 ? (
          <p className="text-sm text-muted-foreground">No commercial buildings match “{term.trim()}” in Houston or Los Angeles.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {found.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onAnswer({ value: String(p.id), label: p.name ?? p.street })}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-left outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.name ?? p.street}</span>
                    <span className="block text-sm text-muted-foreground">
                      {p.name ? `${p.street}, ` : ""}
                      {p.city}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">{p.spaces} advertised</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/** Pick one advertised suite of the chosen property (GET /api/properties/[id]/spaces), or the whole building. */
function SpacePicker({ propertyId, onAnswer }: { propertyId: string; onAnswer: (a: Answer) => void }) {
  const [spaces, setSpaces] = useState<{ id: number; label: string }[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    const ctrl = new AbortController();
    fetch(`/api/properties/${encodeURIComponent(propertyId)}/spaces`, { signal: ctrl.signal })
      .then(async (res) => {
        const parsed = PropertySpacesResponse.safeParse(await res.json());
        if (!res.ok || !parsed.success) throw new Error();
        setSpaces(
          parsed.data.items.map((s) => ({
            id: s.id,
            label: [s.suite ? `Suite ${s.suite}` : `Space ${s.id}`, s.sfMax ? `${s.sfMax.toLocaleString("en-US")} SF` : null, s.matterport ? "3D tour" : null].filter(Boolean).join(" · "),
          })),
        );
      })
      .catch(() => !ctrl.signal.aborted && setFailed(true));
    return () => ctrl.abort();
  }, [propertyId]);

  const whole = (
    <button type="button" className={chip} onClick={() => onAnswer({ value: "", label: "The whole building" })}>
      The whole building
    </button>
  );
  if (failed) return <div className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">The suites didn’t load, so I’ll look at the whole building.</p>{whole}</div>;
  if (!spaces) return <p className="text-sm text-muted-foreground">Loading the advertised suites…</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {spaces.map((s) => (
          <button key={s.id} type="button" className={chip} onClick={() => onAnswer({ value: String(s.id), label: s.label.split(" · ")[0] })}>
            {s.label}
          </button>
        ))}
        {whole}
      </div>
      <p className="text-sm text-muted-foreground">Advertised availability from CoStar listings, not confirmed vacancy.</p>
    </div>
  );
}
