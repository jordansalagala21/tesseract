import type { Evidence } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export const EVIDENCE_KINDS: Record<Evidence["kind"], { label: string; dot: string }> = {
  verified_fact: { label: "Verified fact", dot: "bg-primary" },
  ai_observation: { label: "AI observation", dot: "bg-amber-500" },
  user_assumption: { label: "Your assumption", dot: "bg-sky-500" },
  missing: { label: "Missing info", dot: "bg-muted-foreground" },
};

/**
 * One piece of evidence as a chip, coloured by kind. Links to #evidence-<id> (the Evidence Trail,
 * UI-08) unless onSelect is given.
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
    "inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[13px] leading-4 font-medium text-foreground transition-colors outline-none hover:bg-primary/12 focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[22rem]";
  const body = (
    <>
      <span className={cn("size-1.5 shrink-0 rounded-full", kind?.dot ?? "bg-muted-foreground")} aria-hidden="true" />
      {kind && <span className="sr-only">{kind.label}: </span>}
      <span className="truncate">{evidence?.statement ?? id}</span>
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
