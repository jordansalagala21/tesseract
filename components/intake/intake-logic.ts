// Pure helpers for the guided intake: no React, so they are unit-tested in tests/ui/intake-logic.test.ts.
import { PersonaInput } from "@/lib/contracts";
import type { Answer, Answers, IntakeScript, Question } from "./questions";

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** "Nice, {capitalUsd}." → "Nice, $7,500,000." Unknown or unanswered ids read as "that". */
export const fillAsk = (ask: string, answers: Answers) => ask.replace(/\{(\w+)\}/g, (_, id: string) => answers[id]?.label || "that");

/** The first question without an answer, or `questions.length` when all are answered (the summary). */
export const nextOpen = (questions: Question[], answers: Answers) => {
  const i = questions.findIndex((q) => answers[q.id] === undefined);
  return i === -1 ? questions.length : i;
};

/** A typed money or number answer → its answer, or a plain-English problem. */
export function parseNumber(q: Question, raw: string): Answer | { error: string } {
  const text = raw.replace(/[$,%\s]/g, "");
  if (text === "") return { error: "Enter a number." };
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: "Enter a number, for example 1,500." };
  if (n < 0) return { error: "This can’t be negative." };
  if (q.min !== undefined && n < q.min) return { error: `Enter at least ${whole.format(q.min)}.` };
  if (q.max !== undefined && n > q.max) return { error: `Enter at most ${whole.format(q.max)}.` };
  const shown = whole.format(n);
  const label = q.kind === "money" ? `$${shown}${q.unit ?? ""}` : `${shown}${q.unit ? (q.unit.startsWith("%") ? q.unit : ` ${q.unit}`) : ""}`;
  return { value: String(n), label };
}

/** How a skipped optional question reads back. Its empty value is never sent to the agent. */
export const skipped = (): Answer => ({ value: "", label: "Skipped" });

/**
 * Answers → the request the agent reads, checked against the contract. Questions `toInput`
 * doesn't use are added to the script's free-text list as "question answer".
 */
export function buildInput(script: IntakeScript, answers: Answers): { input: PersonaInput } | { error: string } {
  const base = script.toInput(answers);
  if (typeof base.sfMin === "number" && typeof base.sfMax === "number" && base.sfMin > base.sfMax) {
    return { error: "Check the sizes: the largest should be at least the smallest." };
  }
  const extras = script.questions
    .filter((q) => !script.used.includes(q.id) && answers[q.id] && answers[q.id].value !== "" && answers[q.id].value.length !== 0)
    .map((q) => `${fillAsk(q.ask, answers)} ${answers[q.id].label}`);
  const current = Array.isArray(base[script.extrasField]) ? (base[script.extrasField] as string[]) : [];
  const parsed = PersonaInput.safeParse({ ...base, [script.extrasField]: [...current, ...extras] });
  if (parsed.success) return { input: parsed.data };

  // Name the answer to fix in plain words, not only the contract's field name.
  const field = String(parsed.error.issues[0]?.path[0] ?? "");
  return { error: `One answer doesn’t work yet (${field || "an answer"}). Tap it below to change it.` };
}
