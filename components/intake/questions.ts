/**
 * THE QUESTIONS THE CUBE ASKS — one list per customer type.
 *
 * Jordan: this is the file to edit. Add, remove, reword or reorder questions freely; nothing else
 * needs to change. Every question needs an `id` (unique in its list), `ask` and `kind`.
 *
 *   kind      what the person answers with
 *   choice    one option (chips). `allowOther: true` adds "Something else…" with a text box.
 *   multi     one or more options (chips). `allowOther` works here too.
 *   money     a dollar amount ("$7,500,000" and "7500000" both work)
 *   number    a plain number; `unit` is shown after it, `min`/`max` are checked
 *   text      free text; `examples` become tap-to-fill chips
 *   property  search the CoStar buildings and pick one (owner flow)
 *   space     pick an advertised suite in the property chosen by `dependsOn`, or the whole building
 *
 * `optional: true` adds a Skip button. In `ask`, `{someId}` inserts the earlier answer to
 * question `someId` as the person sees it, for example "Nice, {capitalUsd}."
 *
 * How answers reach the agent: `toInput` turns the answers into the request the agent reads
 * (`PersonaInput` in lib/contracts/persona.ts) and is checked against that contract before sending.
 * Any question `toInput` doesn't use is still sent: its question and answer are added as a line to
 * the free-text list (owner: priorities, founder: mustHaves, investor: goals). So a new question
 * reaches the agent without touching `toInput`.
 */
import type { Market, UserPersona } from "@/lib/contracts";

export type Choice = { value: string; label: string };

export type QuestionKind = "choice" | "multi" | "money" | "number" | "text" | "property" | "space";

export type Question = {
  id: string;
  ask: string;
  kind: QuestionKind;
  options?: Choice[];
  allowOther?: boolean;
  optional?: boolean;
  placeholder?: string;
  unit?: string;
  min?: number;
  max?: number;
  examples?: string[];
  /** For `space`: the id of the `property` question it belongs to. */
  dependsOn?: string;
};

/** One answer: the value sent to the agent, and how it reads back to the person. */
export type Answer = { value: string | string[]; label: string };
export type Answers = Record<string, Answer>;

export type IntakeScript = {
  persona: UserPersona;
  /** What the cube says on the summary screen, before the person starts the agent. */
  outro: string;
  submitLabel: string;
  questions: Question[];
  /** Ready-made answers for a demo: "Try an example". */
  examples: { title: string; answers: Answers }[];
  /** Answers → the agent's request. Return only the fields you set; the free-text list is filled for you. */
  toInput: (a: Answers) => Record<string, unknown>;
  /** Which free-text list unused answers are added to. */
  extrasField: "priorities" | "goals" | "mustHaves";
  /** Ids `toInput` reads; every other answered question goes to `extrasField`. */
  used: string[];
};

const MARKETS: Choice[] = [
  { value: "houston", label: "Houston" },
  { value: "los_angeles", label: "Los Angeles" },
];

const str = (a: Answers, id: string) => (typeof a[id]?.value === "string" ? (a[id].value as string) : undefined);
const list = (a: Answers, id: string) => (Array.isArray(a[id]?.value) ? (a[id].value as string[]) : str(a, id) ? [str(a, id)!] : []);
const num = (a: Answers, id: string) => {
  const s = str(a, id);
  return s === undefined || s === "" ? undefined : Number(s);
};

/* ----------------------------------------------------------------- owner */

const owner: IntakeScript = {
  persona: "owner",
  outro: "Here’s what I’ll investigate. Change anything by tapping it, then I’ll start the agents.",
  submitLabel: "Explore what it could become",
  questions: [
    { id: "property", kind: "property", ask: "Hi, I’m the Tesseract. Which building do you own? Type its name or street.", placeholder: "2600 Travis St" },
    { id: "space", kind: "space", dependsOn: "property", ask: "Should I look at one advertised suite in {property}, or the whole building?" },
    {
      id: "priorities",
      kind: "multi",
      allowOther: true,
      optional: true,
      ask: "What matters most to you for this space?",
      options: [
        { value: "Steady rental income", label: "Steady income" },
        { value: "Fill it quickly", label: "Fill it quickly" },
        { value: "Little build-out cost", label: "Little build-out" },
        { value: "A use that lifts the neighbourhood", label: "Lifts the area" },
      ],
    },
    {
      id: "constraints",
      kind: "text",
      optional: true,
      ask: "Anything I should rule out?",
      placeholder: "No restaurants, no late-night uses",
      examples: ["No restaurants", "No medical uses", "Keep the ground floor retail"],
    },
  ],
  examples: [
    {
      title: "2600 Travis St · Suite 100",
      answers: {
        property: { value: "1018657", label: "2600 Travis St" },
        space: { value: "", label: "The whole building" },
        priorities: { value: ["Steady rental income"], label: "Steady income" },
        constraints: { value: "", label: "Nothing ruled out" },
      },
    },
  ],
  used: ["property", "space", "priorities", "constraints"],
  extrasField: "priorities",
  toInput: (a) => ({
    persona: "owner",
    propertyId: num(a, "property"),
    spaceId: num(a, "space"),
    priorities: list(a, "priorities"),
    constraints: list(a, "constraints").filter(Boolean),
  }),
};

/* --------------------------------------------------------------- founder */

const founder: IntakeScript = {
  persona: "entrepreneur",
  outro: "Here’s the space I’ll look for. Change anything by tapping it, then I’ll start the agents.",
  submitLabel: "Find spaces that fit",
  questions: [
    {
      id: "concept",
      kind: "text",
      ask: "Hi, I’m the Tesseract. What business do you want to open?",
      placeholder: "A boutique fitness studio",
      examples: ["Boutique fitness studio", "Specialty coffee shop", "Small medical clinic"],
    },
    { id: "sfMin", kind: "number", unit: "SF", min: 100, max: 200000, ask: "What’s the smallest space that would work, in square feet?", placeholder: "1,500" },
    { id: "sfMax", kind: "number", unit: "SF", min: 100, max: 200000, ask: "And the largest?", placeholder: "4,000" },
    { id: "rent", kind: "money", optional: true, ask: "What’s the most you’d pay per square foot per year? Skip if you’re not sure.", unit: "/SF/yr", placeholder: "40" },
    { id: "markets", kind: "multi", ask: "Which city?", options: MARKETS },
    {
      id: "mustHaves",
      kind: "multi",
      allowOther: true,
      optional: true,
      ask: "Anything the space must have?",
      options: [
        { value: "Ground floor", label: "Ground floor" },
        { value: "Street frontage", label: "Street frontage" },
        { value: "Parking", label: "Parking" },
        { value: "High ceilings", label: "High ceilings" },
      ],
    },
  ],
  examples: [
    {
      title: "Fitness studio · 2,500–10,000 SF · Houston",
      answers: {
        concept: { value: "Boutique fitness studio", label: "Boutique fitness studio" },
        sfMin: { value: "2500", label: "2,500 SF" },
        sfMax: { value: "10000", label: "10,000 SF" },
        rent: { value: "48", label: "$48/SF/yr" },
        markets: { value: ["houston"], label: "Houston" },
        mustHaves: { value: ["Ground floor"], label: "Ground floor" },
      },
    },
  ],
  used: ["concept", "sfMin", "sfMax", "rent", "markets", "mustHaves"],
  extrasField: "mustHaves",
  toInput: (a) => ({
    persona: "entrepreneur",
    businessConcept: str(a, "concept"),
    sfMin: num(a, "sfMin"),
    sfMax: num(a, "sfMax"),
    maxRentPsfYear: num(a, "rent"),
    markets: list(a, "markets") as Market[],
    mustHaves: list(a, "mustHaves"),
  }),
};

/* -------------------------------------------------------------- investor */

const investor: IntakeScript = {
  persona: "investor",
  outro: "Here’s what I’ll screen for. Change anything by tapping it, then I’ll start the agents.",
  submitLabel: "Build my investment brief",
  questions: [
    { id: "capitalUsd", kind: "money", ask: "Hi, I’m the Tesseract. How much capital can you put in?", placeholder: "7,500,000" },
    {
      id: "strategy",
      kind: "choice",
      ask: "Nice, {capitalUsd}. Do you want to buy a building, lease a space to run a business, or see both?",
      options: [
        { value: "acquire", label: "Buy a building" },
        { value: "lease", label: "Lease a space" },
        { value: "either", label: "Open to both" },
      ],
    },
    { id: "markets", kind: "multi", ask: "Which city should I look in?", options: MARKETS },
    { id: "targetPct", kind: "number", unit: "% a year", min: 0, max: 100, optional: true, ask: "Do you have a yearly return in mind? It’s your goal, not a promise.", placeholder: "8" },
    {
      id: "riskTolerance",
      kind: "choice",
      ask: "How much risk are you comfortable with?",
      options: [
        { value: "low", label: "Low risk" },
        { value: "medium", label: "Medium risk" },
        { value: "high", label: "High risk" },
      ],
    },
    { id: "horizonYears", kind: "number", unit: "years", min: 1, max: 30, ask: "Last one: how many years would you hold it?", placeholder: "7" },
  ],
  examples: [
    {
      title: "Buy for income · $7.5M · Houston · 8%",
      answers: {
        capitalUsd: { value: "7500000", label: "$7,500,000" },
        strategy: { value: "acquire", label: "Buy a building" },
        markets: { value: ["houston"], label: "Houston" },
        targetPct: { value: "8", label: "8% a year" },
        riskTolerance: { value: "medium", label: "Medium risk" },
        horizonYears: { value: "7", label: "7 years" },
      },
    },
  ],
  used: ["capitalUsd", "strategy", "markets", "targetPct", "riskTolerance", "horizonYears"],
  extrasField: "goals",
  toInput: (a) => ({
    persona: "investor",
    capitalUsd: num(a, "capitalUsd"),
    strategy: str(a, "strategy"),
    markets: list(a, "markets") as Market[],
    targetAnnualReturn: num(a, "targetPct") === undefined ? undefined : num(a, "targetPct")! / 100,
    riskTolerance: str(a, "riskTolerance"),
    horizonYears: num(a, "horizonYears"),
  }),
};

export const SCRIPTS = { owner, entrepreneur: founder, investor } satisfies Record<UserPersona, IntakeScript>;
