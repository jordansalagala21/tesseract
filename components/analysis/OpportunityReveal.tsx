import { useId } from "react";
import type { Evidence, Opportunity, UserPersona } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { cleanStatement } from "./evidence-format";
import { EvidenceChip } from "./EvidenceChip";
import { SCORE_PARTS, STRATEGIES, VERDICTS, groupOpportunities, scoreText } from "./opportunity-format";

type ChipProps = { byId: Map<string, Evidence>; onEvidenceSelect?: (id: string) => void };

function Chips({ ids, byId, onEvidenceSelect }: ChipProps & { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <ul className="-mx-2.5 grid gap-0.5 sm:grid-cols-2">
      {ids.map((id) => (
        <li key={id} className="min-w-0">
          <EvidenceChip id={id} evidence={byId.get(id)} onSelect={onEvidenceSelect} />
        </li>
      ))}
    </ul>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
      <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-base leading-snug marker:text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function OpportunityCard({ opp, titleId, ...chipProps }: ChipProps & { opp: Opportunity; titleId: string }) {
  const verdict = VERDICTS[opp.verdict];
  return (
    <article aria-labelledby={titleId} className="rounded-2xl border bg-card">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <header className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-heading text-lg font-bold tabular-nums [font-stretch:112%]">
            <span className="sr-only">Rank </span>
            {opp.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <h3 id={titleId} className="text-xl leading-snug font-semibold">
                {cleanStatement(opp.title)}
              </h3>
              <Badge variant={verdict.variant} className="shrink-0">{verdict.label}</Badge>
            </div>
            <p className="mt-0.5 text-base text-muted-foreground">{STRATEGIES[opp.strategy]}</p>
            <p className="mt-2 text-base leading-relaxed">{opp.summary}</p>
          </div>
        </header>

        <div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {SCORE_PARTS.map(([key, label]) => {
              const { score } = opp.scores[key];
              return (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className={score == null ? "mt-1 text-sm leading-5 text-muted-foreground" : "mt-0.5 text-xl font-semibold tabular-nums"}>
                    {scoreText(score)}
                    {score != null && <span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span>}
                  </dd>
                  {score != null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
                      <div className="h-full rounded-sm bg-primary" style={{ width: `${score}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </dl>
          <p className="mt-4 text-base">
            <span className="text-muted-foreground">Overall: </span>
            {opp.scores.overall == null ? (
              <span className="text-muted-foreground">not scored, because a required score has insufficient evidence</span>
            ) : (
              <span className="font-semibold tabular-nums">{Math.round(opp.scores.overall)} of 100</span>
            )}
          </p>
        </div>

        {opp.blockers.length > 0 && (
          <Notice tone="danger" title={opp.blockers.length === 1 ? "Blocker" : `${opp.blockers.length} blockers`}>
            <ul className="mt-1 flex flex-col gap-3">
              {opp.blockers.map((b) => (
                <li key={b.description} className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">{b.description}</span>
                  <Chips ids={b.evidenceIds} {...chipProps} />
                </li>
              ))}
            </ul>
          </Notice>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <ListBlock title="Unknowns" items={opp.unknowns} />
          <ListBlock title="Likely changes" items={opp.likelyChanges} />
          <ListBlock title="Next steps" items={opp.nextSteps} />
        </div>
      </div>

      <footer className="flex flex-col gap-3 border-t px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <h4 className="shrink-0 pt-2 text-base font-semibold">Evidence</h4>
          {opp.supportingEvidenceIds.length > 0 ? (
            <Chips ids={opp.supportingEvidenceIds} {...chipProps} />
          ) : (
            <p className="pt-1 text-base text-muted-foreground">No supporting evidence was found for this idea.</p>
          )}
        </div>
        <details className="group text-base">
          <summary className="cursor-pointer rounded-md text-primary outline-none select-none focus-visible:ring-2 focus-visible:ring-ring">
            How each score was set
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {SCORE_PARTS.map(([key, label]) => {
              const part = opp.scores[key];
              return (
                <li key={key} className="flex flex-col gap-1.5">
                  <p className="leading-snug">
                    <span className="font-semibold">{label}: </span>
                    <span className="text-muted-foreground">{part.rationale}</span>
                  </p>
                  <Chips ids={part.evidenceIds} {...chipProps} />
                </li>
              );
            })}
          </ul>
        </details>
      </footer>
    </article>
  );
}

/**
 * Ranked opportunities with their verdict, component scores, blockers, unknowns, next steps and
 * the evidence behind them. Investors get acquisition and lease ideas in separate groups.
 */
export function OpportunityReveal({
  opportunities,
  evidence,
  persona,
  onEvidenceSelect,
}: {
  opportunities: Opportunity[];
  evidence: Evidence[];
  persona: UserPersona;
  onEvidenceSelect?: (evidenceId: string) => void;
}) {
  const uid = useId();
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const groups = groupOpportunities(opportunities, persona);

  return (
    <section aria-labelledby={`${uid}-heading`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`${uid}-heading`} className="text-xl font-semibold tracking-tight">
          {persona === "entrepreneur" ? "Spaces that fit" : "What this space could become"}
        </h2>
        <span className="text-base text-muted-foreground tabular-nums">
          {opportunities.length} {opportunities.length === 1 ? "idea" : "ideas"}, ranked
        </span>
      </div>

      {opportunities.length === 0 ? (
        <p className="rounded-2xl border bg-card p-5 text-base text-muted-foreground sm:p-6">
          The agent didn’t find a use the evidence supports. Check the missing information in the Evidence Trail.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <div key={g.title ?? "all"} className="flex flex-col gap-4">
              {g.title && <h3 className="text-lg font-semibold text-muted-foreground">{g.title}</h3>}
              {g.items.map((opp) => (
                <OpportunityCard key={opp.id} titleId={`${uid}-${opp.id}`} opp={opp} byId={byId} onEvidenceSelect={onEvidenceSelect} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
