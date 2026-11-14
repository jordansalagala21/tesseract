import { ExternalLink } from "lucide-react";
import type { Evidence } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { safeEmbedUrl } from "@/components/viewer/tours";
import { EVIDENCE_KINDS } from "./EvidenceChip";
import { Notice } from "@/components/ui/notice";
import { bucketEvidence, cleanStatement, formatValue, sourceLabel, sourceRows, systemLabel } from "./evidence-format";

type Index = Parameters<typeof bucketEvidence>[1];

function Item({ e, selected }: { e: Evidence; selected: boolean }) {
  const value = formatValue(e.value, e.unit);
  return (
    <li
      id={`evidence-${e.id}`}
      aria-current={selected ? "true" : undefined}
      className={cn("scroll-mt-4 rounded-2xl border p-4 transition-colors", selected ? "border-primary bg-primary/[0.06]" : "bg-card")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base leading-snug font-medium">{cleanStatement(e.statement)}</p>
        {value && <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold tabular-nums">{value}</span>}
      </div>

      {e.kind === "ai_observation" && (
        <Notice tone="warning" title="AI observation, not an inspection" className="mt-3">
          {e.caveat} Seen by {e.model}, {e.confidence} confidence.
        </Notice>
      )}

      {e.kind === "user_assumption" && (
        <p className="mt-2 text-sm text-muted-foreground">{e.origin === "user" ? "Entered by you." : "A default you accepted."}</p>
      )}

      {e.kind === "missing" && (
        <dl className="mt-3 flex flex-col gap-2 text-sm leading-snug">
          <div>
            <dt className="font-semibold">Why it matters</dt>
            <dd className="text-muted-foreground">{e.whyNeeded}</dd>
          </div>
          {e.howToResolve && (
            <div>
              <dt className="font-semibold">How to find out</dt>
              <dd className="text-muted-foreground">{e.howToResolve}</dd>
            </div>
          )}
        </dl>
      )}

      {e.media && e.media.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {e.media.map((m) => {
            const href = m.type === "matterport_model" || m.type === "matterport_pano" ? safeEmbedUrl(m.ref.split("#")[0]) : null;
            const label = m.caption ?? (m.type.startsWith("matterport") ? "View in the 3D tour" : `Open ${m.type.replace("_", " ")}`);
            return (
              <li key={`${m.type}-${m.ref}`}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {label}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="inline-flex rounded-full border px-3 py-1 text-sm text-muted-foreground">{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 border-t pt-3 text-sm">
        <p>
          <span className="text-muted-foreground">Source: </span>
          <span className="font-medium">{sourceLabel(e)}</span>
          {e.sources[0]?.recordId && <span className="text-muted-foreground"> {e.sources[0].recordId}</span>}
        </p>
        {e.sources.some((s) => sourceRows(s).length > 0) && (
          <details className="mt-1.5">
            <summary className="-mx-1 flex h-11 w-fit cursor-pointer items-center rounded-md px-1 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Technical reference
            </summary>
            {e.sources.map((s, i) => (
              <dl key={i} className="mt-1 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-muted-foreground">
                <dt>System</dt>
                <dd className="text-foreground">{systemLabel(s.system)}</dd>
                {sourceRows(s).map((r) => (
                  <div key={r.label} className="contents">
                    <dt>{r.label}</dt>
                    <dd className="font-mono text-xs leading-5 break-words text-foreground">{r.value}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </details>
        )}
        {e.sources.length === 0 && e.kind !== "user_assumption" && (
          <p className="mt-1 text-muted-foreground">No data source: this is a gap, not a finding.</p>
        )}
      </div>
    </li>
  );
}

/**
 * Every statement behind an analysis, grouped into four labelled buckets. Each item has the
 * anchor id evidence-<id>, so a chip in the timeline or an opportunity card can jump to it.
 */
export function EvidenceTrail({ evidence, evidenceIndex, selectedId }: { evidence: Evidence[]; evidenceIndex?: Index; selectedId?: string | null }) {
  const buckets = bucketEvidence(evidence, evidenceIndex);
  return (
    <div className="flex flex-col gap-8">
      {buckets.map((b) => (
        <section key={b.kind} aria-labelledby={`bucket-${b.kind}`}>
          <h3 id={`bucket-${b.kind}`} className="flex items-center gap-2 text-lg font-semibold">
            <span className={cn("size-2.5 rounded-full", EVIDENCE_KINDS[b.kind].dot)} aria-hidden="true" />
            {b.title}
            <span className="text-base font-normal text-muted-foreground tabular-nums">{b.items.length}</span>
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{b.blurb}</p>
          {b.items.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">None for this analysis.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {b.items.map((e) => (
                <Item key={e.id} e={e} selected={e.id === selectedId} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
