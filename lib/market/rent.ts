/**
 * Comparable asking rents (AI-04). OWNER: Developer 1.
 *
 * DATA-07 already normalizes every rate to $/SF/yr at import (CoStar rate 0 → null) and groups
 * nearby spaces by serviceType × spaceUse. This module decides which group, if any, is a fair
 * comparable for a subject space. The rule is strict on purpose (CLAUDE.md §6.6): a TripleNet
 * retail rent is compared only with TripleNet retail rents. A FullService office median is not
 * "close enough", so when no matching group publishes a rate we say so instead of borrowing one.
 */

export interface RentRange {
  min: number | null;
  median: number | null;
  max: number | null;
}

/** One serviceType × spaceUse group of nearby advertised spaces (shape of DATA-07's RentGroup). */
export interface RentGroup {
  serviceType: string;
  spaceUse: string;
  count: number;
  /** How many of `count` publish a rate: the sample size behind the range. */
  withPublishedRate: number;
  askingRentPsfYear: RentRange;
}

export interface SubjectBasis {
  serviceType?: string | null;
  spaceUse?: string | null;
}

export type ComparableRent =
  | { status: "matched"; group: RentGroup }
  /** A matching group exists but none of its spaces publishes a rate. */
  | { status: "no_published_rate"; group: RentGroup }
  | { status: "no_matching_group" }
  /** We don't know the subject's serviceType or spaceUse, so nothing is comparable yet. */
  | { status: "unknown_subject" };

/** Cents precision; DuckDB medians arrive as 16.200000000000003. */
export const roundRent = (n: number | null): number | null => (n === null ? null : Math.round(n * 100) / 100);

export const roundRange = (r: RentRange): RentRange => ({ min: roundRent(r.min), median: roundRent(r.median), max: roundRent(r.max) });

/** Groups that publish at least one rate, largest sample first. */
export function ratedGroups(groups: RentGroup[]): RentGroup[] {
  return groups.filter((g) => g.withPublishedRate > 0).sort((a, b) => b.withPublishedRate - a.withPublishedRate);
}

/** The only fair comparable for a subject: same serviceType AND same spaceUse. */
export function comparableRentFor(groups: RentGroup[], subject: SubjectBasis): ComparableRent {
  if (!subject.serviceType || !subject.spaceUse) return { status: "unknown_subject" };
  const group = groups.find((g) => g.serviceType === subject.serviceType && g.spaceUse === subject.spaceUse);
  if (!group) return { status: "no_matching_group" };
  return group.withPublishedRate > 0 ? { status: "matched", group } : { status: "no_published_rate", group };
}

/** "TripleNet Office" → used in statements so the basis is always visible. */
export const groupLabel = (g: Pick<RentGroup, "serviceType" | "spaceUse">) => `${g.serviceType} ${g.spaceUse}`;

/** "$18–$35/SF/yr (median $19.75, 80 of 80 spaces publish a rate)". */
export function describeRange(g: RentGroup): string {
  const r = roundRange(g.askingRentPsfYear);
  const money = (n: number | null) => (n === null ? "n/a" : `$${n}`);
  const span = r.min === r.max ? money(r.median) : `${money(r.min)}–${money(r.max)}`;
  return `${span}/SF/yr (median ${money(r.median)}, ${g.withPublishedRate} of ${g.count} space${g.count === 1 ? "" : "s"} publish a rate)`;
}
