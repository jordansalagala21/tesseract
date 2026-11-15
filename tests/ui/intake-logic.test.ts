import { describe, expect, it } from "vitest";
import { buildInput, fillAsk, nextOpen, parseNumber, skipped } from "@/components/intake/intake-logic";
import { SCRIPTS, type IntakeScript, type Question } from "@/components/intake/questions";

const scripts = Object.values(SCRIPTS) as IntakeScript[];

describe("the question lists in questions.ts (checks Jordan's edits)", () => {
  it.each(scripts.map((s) => [s.persona, s] as const))("%s questions are well formed", (_, s) => {
    const ids = s.questions.map((q) => q.id);
    expect(new Set(ids).size, "every question id must be unique").toBe(ids.length);
    for (const q of s.questions) {
      if (q.kind === "choice" || q.kind === "multi") expect(q.options?.length, `${q.id} needs options`).toBeGreaterThan(0);
      if (q.kind === "space") expect(ids, `${q.id} dependsOn must name a question`).toContain(q.dependsOn);
      for (const [, ref] of q.ask.matchAll(/\{(\w+)\}/g)) expect(ids.slice(0, ids.indexOf(q.id)), `${q.id} refers to {${ref}}, which must be asked before it`).toContain(ref);
    }
    for (const used of s.used) expect(ids, `"used" names ${used}, which is not a question`).toContain(used);
  });

  it.each(scripts.map((s) => [s.persona, s] as const))("the %s example answers make a valid agent request", (_, s) => {
    for (const ex of s.examples) {
      const r = buildInput(s, ex.answers);
      expect(r, ex.title).toHaveProperty("input");
    }
  });
});

describe("intake helpers", () => {
  const money: Question = { id: "capital", kind: "money", ask: "How much?" };
  const years: Question = { id: "years", kind: "number", unit: "years", min: 1, max: 30, ask: "How long?" };

  it("fills earlier answers into a question", () => {
    expect(fillAsk("Nice, {capital}. And {missing}?", { capital: { value: "5", label: "$5" } })).toBe("Nice, $5. And that?");
  });

  it("moves to the first unanswered question, or the summary", () => {
    const qs = [money, years];
    expect(nextOpen(qs, {})).toBe(0);
    expect(nextOpen(qs, { capital: { value: "1", label: "$1" } })).toBe(1);
    expect(nextOpen(qs, { capital: { value: "1", label: "$1" }, years: { value: "2", label: "2 years" } })).toBe(2);
  });

  it("reads money and numbers the way people type them, and explains problems", () => {
    expect(parseNumber(money, "$7,500,000")).toEqual({ value: "7500000", label: "$7,500,000" });
    expect(parseNumber(years, "7")).toEqual({ value: "7", label: "7 years" });
    expect(parseNumber({ ...years, unit: "% a year", min: 0, max: 100 }, "8%")).toEqual({ value: "8", label: "8% a year" });
    expect(parseNumber(years, "")).toEqual({ error: "Enter a number." });
    expect(parseNumber(years, "abc")).toHaveProperty("error");
    expect(parseNumber(years, "-2")).toEqual({ error: "This can’t be negative." });
    expect(parseNumber(years, "40")).toEqual({ error: "Enter at most 30." });
  });

  it("sends a question toInput doesn't use as a free-text line", () => {
    const s: IntakeScript = { ...SCRIPTS.investor, questions: [...SCRIPTS.investor.questions, { id: "sector", kind: "text", ask: "Any sector?" }] };
    const r = buildInput(s, { ...SCRIPTS.investor.examples[0].answers, sector: { value: "Retail", label: "Retail" } });
    expect("input" in r && r.input.persona === "investor" && r.input.goals).toEqual(["Any sector? Retail"]);
  });

  it("never sends a skipped answer, and catches answers the agent can't use", () => {
    const founder = SCRIPTS.entrepreneur;
    const ok = buildInput(founder, { ...founder.examples[0].answers, rent: skipped(), mustHaves: skipped() });
    expect("input" in ok && ok.input.persona === "entrepreneur" && ok.input.maxRentPsfYear).toBeUndefined();
    expect(buildInput(founder, { ...founder.examples[0].answers, sfMin: { value: "9000", label: "9,000 SF" }, sfMax: { value: "100", label: "100 SF" } })).toEqual({
      error: "Check the sizes: the largest should be at least the smallest.",
    });
    expect(buildInput(founder, {})).toHaveProperty("error");
  });
});
