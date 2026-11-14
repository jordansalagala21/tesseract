import type { Opportunity, UserPersona } from "@/lib/contracts";

export const VERDICTS: Record<Opportunity["verdict"], { label: string; tone: string }> = {
  promising: { label: "Promising", tone: "bg-primary/12 text-primary" },
  possible: { label: "Possible", tone: "bg-warning/12 text-warning-foreground" },
  unlikely: { label: "Unlikely", tone: "bg-muted text-muted-foreground" },
  insufficient_evidence: { label: "Not enough evidence", tone: "border border-dashed border-muted-foreground/50 text-muted-foreground" },
};

export const STRATEGIES: Record<Opportunity["strategy"], string> = {
  lease: "Lease and operate",
  acquisition: "Buy the property",
  reposition: "Reposition",
};

export const SCORE_PARTS = [
  ["physical", "Physical fit"],
  ["market", "Market"],
  ["access", "Access"],
  ["economic", "Economics"],
] as const;

/** A score as text. Never turns a missing score into a number. */
export function scoreText(score: number | null): string {
  return score == null ? "Insufficient evidence" : String(Math.round(score));
}

export type OpportunityGroup = { title: string | null; items: Opportunity[] };

/**
 * Investors see acquisition and lease/reposition ideas in separate groups (never blended);
 * owners and entrepreneurs see one ranked list.
 */
export function groupOpportunities(opps: Opportunity[], persona: UserPersona): OpportunityGroup[] {
  const ranked = [...opps].sort((a, b) => a.rank - b.rank);
  if (persona !== "investor") return [{ title: null, items: ranked }];
  return [
    { title: "Buy the property", items: ranked.filter((o) => o.strategy === "acquisition") },
    { title: "Lease or reposition", items: ranked.filter((o) => o.strategy !== "acquisition") },
  ].filter((g) => g.items.length > 0);
}
