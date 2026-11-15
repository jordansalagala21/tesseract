import type { Opportunity, UserPersona } from "@/lib/contracts";

export const VERDICTS: Record<Opportunity["verdict"], { label: string; variant: "accent" | "warning" | "neutral" | "outline" }> = {
  promising: { label: "Promising", variant: "accent" },
  possible: { label: "Possible", variant: "warning" },
  unlikely: { label: "Unlikely", variant: "neutral" },
  insufficient_evidence: { label: "Not enough evidence", variant: "outline" },
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
