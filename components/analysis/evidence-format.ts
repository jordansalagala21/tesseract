import type { Evidence, SourceRef } from "@/lib/contracts";

export type EvidenceKind = Evidence["kind"];

export const BUCKETS: { kind: EvidenceKind; title: string; blurb: string }[] = [
  { kind: "verified_fact", title: "Verified facts", blurb: "Read directly from CoStar, Matterport or Vexcel data." },
  { kind: "ai_observation", title: "AI observations", blurb: "What a model saw in imagery. Preliminary, not a measurement." },
  { kind: "user_assumption", title: "Your assumptions", blurb: "Numbers you entered or accepted as defaults." },
  { kind: "missing", title: "Missing info", blurb: "What the decision needs that the data doesn't have." },
];

export type EvidenceBucket = (typeof BUCKETS)[number] & { items: Evidence[] };

/**
 * Splits evidence into the four labelled buckets, in a fixed order. Uses the response's
 * evidenceIndex when given (the contract guarantees it matches each item's kind), otherwise the kind.
 */
export function bucketEvidence(
  evidence: Evidence[],
  index?: { verifiedFactIds: string[]; aiObservationIds: string[]; userAssumptionIds: string[]; missingInfoIds: string[] },
): EvidenceBucket[] {
  const ids: Record<EvidenceKind, Set<string> | null> = index
    ? {
        verified_fact: new Set(index.verifiedFactIds),
        ai_observation: new Set(index.aiObservationIds),
        user_assumption: new Set(index.userAssumptionIds),
        missing: new Set(index.missingInfoIds),
      }
    : { verified_fact: null, ai_observation: null, user_assumption: null, missing: null };
  return BUCKETS.map((b) => ({
    ...b,
    items: evidence.filter((e) => (ids[b.kind] ? ids[b.kind]!.has(e.id) : e.kind === b.kind)),
  }));
}

const SYSTEMS: Record<SourceRef["system"], string> = {
  costar: "CoStar",
  matterport: "Matterport",
  vexcel: "Vexcel",
  census: "Census",
  user: "You",
  ai: "AI model",
  derived: "Calculated",
};

export const systemLabel = (s: SourceRef["system"]) => SYSTEMS[s];

/** A source reference as readable rows: dataset, record, field. Skips what the reference doesn't carry. */
export function sourceRows(ref: SourceRef): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (ref.dataset) rows.push({ label: "Dataset", value: ref.dataset });
  if (ref.recordId) rows.push({ label: "Record", value: ref.recordId });
  if (ref.field) rows.push({ label: "Field", value: ref.field });
  if (ref.capturedAt) rows.push({ label: "Captured", value: ref.capturedAt });
  return rows;
}

const UNITS: Record<string, string> = { sf: "SF", ft: "ft", usd_psf_year: "$/SF/yr", usd: "$" };

/** "20 ft", "9,889 SF", "45 $/SF/yr"; null when there is no machine value. */
export function formatValue(value: Evidence["value"], unit?: string): string | null {
  if (value == null) return null;
  const v = typeof value === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value) : String(value);
  return unit ? `${v} ${UNITS[unit] ?? unit}` : v;
}

/** Fixture text carries a FIXTURE-ONLY marker for developers; sample pages say so in a banner instead. */
export const cleanStatement = (s: string) => s.replace(/^FIXTURE-ONLY:\s*/, "");
