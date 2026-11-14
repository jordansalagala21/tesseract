// A static example of what an analysis returns, built from the contract fixture and labelled as an example.
import type { Evidence } from "@/lib/contracts";
import { travisAnalysisFixture } from "@/lib/contracts/examples/travis";
import { cn } from "@/lib/utils";

const KINDS: { kind: Evidence["kind"]; label: string; dot: string }[] = [
  { kind: "verified_fact", label: "Verified fact", dot: "bg-primary" },
  { kind: "ai_observation", label: "AI observation", dot: "bg-amber-500" },
  { kind: "user_assumption", label: "Your assumption", dot: "bg-sky-500" },
  { kind: "missing", label: "Missing info", dot: "bg-muted-foreground" },
];

const SCORE_LABELS = { physical: "Physical fit", market: "Market", access: "Access", economic: "Economics" } as const;

/** Fixture text carries a FIXTURE-ONLY marker for developers; the card itself is labelled as an example. */
const clean = (s: string) => s.replace(/^FIXTURE-ONLY:\s*/, "");

export function ExampleOpportunity() {
  const a = travisAnalysisFixture;
  const opp = a.opportunities[0];
  const firstOfKind = (kind: Evidence["kind"]) => a.evidence.find((e) => e.kind === kind);

  return (
    <section aria-labelledby="example-heading" className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
      <div>
        <h2 id="example-heading" className="font-heading text-[28px] leading-tight font-bold tracking-tight [font-stretch:112%]">
          Every claim shows where it came from.
        </h2>
        <p className="mt-3 max-w-[30rem] text-[17px] leading-relaxed text-muted-foreground">
          Each idea is scored only on evidence the agent found. Facts, AI observations, your assumptions and missing
          information are labelled separately, and a score stays blank when the data can’t support one.
        </p>
      </div>

      <article className="rounded-[24px] border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-dashed border-muted-foreground/50 px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground">
            Example output, not a real analysis
          </span>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[13px] font-semibold text-amber-800 capitalize dark:text-amber-300">
            {opp.verdict.replace("_", " ")}
          </span>
        </div>
        <h3 className="mt-4 text-[20px] leading-snug font-semibold">{clean(opp.title)}</h3>
        <p className="mt-1 text-[15px] text-muted-foreground">2600 Travis St, Suite 100, Houston</p>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {(Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).map((k) => {
            const score = opp.scores[k].score;
            return (
              <div key={k}>
                <dt className="text-[13px] text-muted-foreground">{SCORE_LABELS[k]}</dt>
                <dd className={cn("mt-0.5 tabular-nums", score == null ? "text-[13px] leading-5 text-muted-foreground" : "text-[20px] font-semibold")}>
                  {score ?? "Not enough evidence"}
                </dd>
              </div>
            );
          })}
        </dl>

        <ul className="mt-5 flex flex-col gap-2 border-t pt-4">
          {KINDS.map(({ kind, label, dot }) => {
            const ev = firstOfKind(kind);
            if (!ev) return null;
            return (
              <li key={kind} className="flex gap-3 text-[15px] leading-snug">
                <span className="mt-1.5 flex w-32 shrink-0 items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                  <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />
                  {label}
                </span>
                <span className="min-w-0">{clean(ev.statement)}</span>
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
