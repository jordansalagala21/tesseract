import type { Evidence } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { cleanStatement, sourceLabel } from "./evidence-format";

export const EVIDENCE_KINDS: Record<Evidence["kind"], { label: string; dot: string }> = {
  verified_fact: { label: "Verified fact", dot: "bg-primary" },
  ai_observation: { label: "AI observation", dot: "bg-warning" },
  user_assumption: { label: "Your assumption", dot: "bg-info" },
  missing: { label: "Missing info", dot: "bg-muted-foreground" },
};

/**
 * One piece of evidence: its kind and source ("Verified fact, CoStar listing") above the full
 * statement, so a list of them can be scanned. Opens the Evidence Trail on that item: calls
 * onSelect when given, otherwise links to #evidence-<id>.
 */
export function EvidenceChip({
  id,
  evidence,
  onSelect,
}: {
  id: string;
  evidence?: Evidence;
  onSelect?: (evidenceId: string) => void;
}) {
  const kind = evidence ? EVIDENCE_KINDS[evidence.kind] : undefined;
  const cls =
    "flex min-h-11 w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";
  const body = (
    <>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", kind?.dot ?? "bg-muted-foreground")} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">
          {kind?.label ?? "Evidence"}
          {evidence && <>, {sourceLabel(evidence)}</>}
        </span>
        <span className="block text-base leading-snug text-foreground">{evidence ? cleanStatement(evidence.statement) : id}</span>
      </span>
    </>
  );
  return onSelect ? (
    <button type="button" onClick={() => onSelect(id)} className={cls}>
      {body}
    </button>
  ) : (
    <a href={`#evidence-${id}`} className={cls}>
      {body}
    </a>
  );
}
