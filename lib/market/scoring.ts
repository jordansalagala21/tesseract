/**
 * Deterministic suitability scoring (AI-05). OWNER: Developer 1.
 * Method: docs/MARKET_ANALYSIS.md §4. The LLM explains these scores; it never sets them.
 *
 * Rules:
 *  - Every input is a cited fact ({ value, evidenceId }). Unknown facts are simply absent.
 *  - A factor is scored only when its fact is known. Unknown is never treated as bad (or as 0).
 *  - A component with no usable factors is `null` ("insufficient evidence").
 *  - `overall` is a weighted mean of the non-null components, and only when physical AND economic
 *    are both known. Weights are re-normalized over the components used, and the result says so.
 *    Exception (`economicOptional`, used for owners): an owner has no budget, so when no comparable
 *    rent exists either, overall is formed without economics, the gap is stated, and the verdict
 *    is capped at "possible": nothing is called promising without the numbers.
 *  - Hard blockers (e.g. a use that needs a ground floor on an upper floor) cap the verdict.
 */
import type { Opportunity } from "@/lib/contracts";
import { USES, type BuildOutTag, type Importance, type UseCategory, type UseRequirements } from "./uses";

/* ------------------------------------------------------------------ inputs */

export interface Fact<T> {
  value: T;
  evidenceId: string;
}

/** What we know about the site, each fact traceable to an Evidence item. */
export interface SiteFacts {
  spaceSf?: Fact<number>;
  ceilingFt?: Fact<number>;
  isGroundFloor?: Fact<boolean>;
  frontageFt?: Fact<number>;
  curbCuts?: Fact<number>;
  parkingPer1000Sf?: Fact<number>;
  isCorner?: Fact<boolean>;
  buildOut?: Fact<BuildOutTag>[];
  askingRentPsfYear?: Fact<number>;
  serviceType?: Fact<string>;
  /** The sale listing's own asking cap rate, in percent (acquisition only). */
  askingCapRatePct?: Fact<number>;
}

/** Market context from the kit (AI-04). Counts cover kit buildings only, not a census. */
export interface MarketSignals {
  comparableRent?: Fact<{ medianPsfYear: number; n: number; serviceType: string | null }>;
  /** Exact same-category businesses nearby (needs tenant names; not produced from industry groups). */
  sameCategoryNearby?: Fact<number>;
  /**
   * Tenants in this use's broad CoStar industry group (lib/market/uses.ts peerIndustries), out of
   * nearby tenants with a known industry. A group share, not a competitor count.
   */
  sameIndustryNearby?: Fact<{ count: number; knownTotal: number; industries: string[] }>;
  complementaryNearby?: Fact<number>;
  sameCategoryInBuilding?: Fact<{ count: number; names: string[] }>;
}

export interface UserPreferences {
  maxRentPsfYear?: Fact<number>;
  /** The investor's target annual return, in percent (a user assumption, not a promise). */
  targetReturnPct?: Fact<number>;
}

export interface Weights {
  physical: number;
  market: number;
  access: number;
  economic: number;
}

export const DEFAULT_WEIGHTS: Weights = { physical: 35, market: 25, access: 20, economic: 20 };

export interface ScoreInput {
  use: UseCategory;
  site: SiteFacts;
  market?: MarketSignals;
  preferences?: UserPreferences;
  weights?: Partial<Weights>;
  /** Allow an overall score without economic evidence (owners). The verdict is then capped at "possible". */
  economicOptional?: boolean;
}

/* ----------------------------------------------------------------- outputs */

export type ScoreComponent = Opportunity["scores"]["physical"];

export interface Blocker {
  description: string;
  evidenceIds: string[];
  /** Hard blockers cap the verdict; soft ones are shown but don't change it. */
  hard: boolean;
}

export interface ScoreResult {
  use: UseCategory;
  scores: Opportunity["scores"];
  verdict: Opportunity["verdict"];
  blockers: Blocker[];
  /** How the overall was formed, e.g. re-normalized weights. */
  notes: string[];
  weightsUsed: Weights;
}

/* ----------------------------------------------------------------- helpers */

interface Factor {
  label: string;
  score: number;
  evidenceIds: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const lerp = (x: number, x0: number, x1: number, y0: number, y1: number) =>
  x1 === x0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
const round = (n: number) => Math.round(n);

function component(factors: Factor[], emptyReason: string): ScoreComponent {
  if (factors.length === 0) return { score: null, rationale: `Insufficient evidence: ${emptyReason}`, evidenceIds: [] };
  const score = round(factors.reduce((s, f) => s + f.score, 0) / factors.length);
  return {
    score: clamp(score),
    rationale: factors.map((f) => `${f.label} (${round(f.score)})`).join("; ") + ".",
    evidenceIds: [...new Set(factors.flatMap((f) => f.evidenceIds))],
  };
}

const weightFor = (importance: Importance) =>
  importance === "required" || importance === "important" ? 1 : importance === "helpful" ? 0.5 : 0;

/* ------------------------------------------------------------- components */

export function sizeFitScore(sf: number, req: UseRequirements["sf"]): number {
  if (sf >= req.idealMin && sf <= req.idealMax) return 100;
  if (sf >= req.min && sf < req.idealMin) return lerp(sf, req.min, req.idealMin, 60, 100);
  if (sf > req.idealMax && sf <= req.max) return lerp(sf, req.idealMax, req.max, 100, 60);
  if (sf < req.min) return clamp((sf / req.min) * 40);
  return clamp(60 - (sf / req.max - 1) * 60);
}

function physical(req: UseRequirements, site: SiteFacts, blockers: Blocker[]): ScoreComponent {
  const f: Factor[] = [];

  // Size is the core physical fact: without it the component is not scored at all.
  if (!site.spaceSf) return component([], "space size is unknown.");
  const sf = site.spaceSf.value;
  f.push({
    label: `${sf.toLocaleString("en-US")} SF vs a ${req.sf.idealMin.toLocaleString("en-US")}–${req.sf.idealMax.toLocaleString("en-US")} SF heuristic range`,
    score: sizeFitScore(sf, req.sf),
    evidenceIds: [site.spaceSf.evidenceId],
  });
  if (sf < req.sf.min * 0.5) {
    blockers.push({ description: `Space is far below the size a ${req.label.toLowerCase()} usually needs.`, evidenceIds: [site.spaceSf.evidenceId], hard: true });
  }

  if (site.ceilingFt && req.ceilingFt) {
    const h = site.ceilingFt.value;
    const { hard, preferred } = req.ceilingFt;
    const score = h >= preferred ? 100 : h >= hard ? lerp(h, hard, preferred, 60, 100) : 20;
    f.push({ label: `${h} ft ceiling (heuristic preference ${preferred} ft)`, score, evidenceIds: [site.ceilingFt.evidenceId] });
    if (h < hard) {
      blockers.push({ description: `Ceiling of ${h} ft is below the ~${hard} ft this use typically needs.`, evidenceIds: [site.ceilingFt.evidenceId], hard: true });
    }
  }

  if (site.isGroundFloor && req.groundFloor !== "irrelevant") {
    const ground = site.isGroundFloor.value;
    const score = ground ? 100 : req.groundFloor === "required" ? 0 : req.groundFloor === "important" ? 30 : 60;
    f.push({ label: ground ? "Ground floor" : "Upper floor", score, evidenceIds: [site.isGroundFloor.evidenceId] });
    if (!ground && req.groundFloor === "required") {
      blockers.push({ description: `${req.label} needs a ground-floor space.`, evidenceIds: [site.isGroundFloor.evidenceId], hard: true });
    }
  }

  // Existing build-out only ever helps; its absence from the evidence is not a penalty.
  const helpful = (site.buildOut ?? []).filter((b) => req.benefitsFrom.includes(b.value));
  if (helpful.length > 0) {
    f.push({
      label: `Existing build-out that suits this use: ${helpful.map((b) => b.value.replace(/_/g, " ")).join(", ")}`,
      score: 100,
      evidenceIds: helpful.map((b) => b.evidenceId),
    });
  }

  return component(f, "space size is unknown.");
}

function access(req: UseRequirements, site: SiteFacts): ScoreComponent {
  const f: Factor[] = [];
  const frontageW = weightFor(req.frontage);
  const parkingW = weightFor(req.parking);

  if (site.frontageFt && frontageW > 0) {
    const ft = site.frontageFt.value;
    const score = ft >= 100 ? 100 : ft >= 50 ? lerp(ft, 50, 100, 60, 100) : lerp(ft, 0, 50, 20, 60);
    f.push({ label: `${ft} ft of street frontage`, score: frontageW === 1 ? score : 50 + score / 2, evidenceIds: [site.frontageFt.evidenceId] });
  }
  if (site.curbCuts && frontageW > 0) {
    const n = site.curbCuts.value;
    f.push({ label: `${n} curb cut${n === 1 ? "" : "s"}`, score: n >= 2 ? 100 : n === 1 ? 70 : 40, evidenceIds: [site.curbCuts.evidenceId] });
  }
  if (site.parkingPer1000Sf && parkingW > 0) {
    const r = site.parkingPer1000Sf.value;
    const score = r >= 4 ? 100 : r >= 2 ? lerp(r, 2, 4, 60, 100) : lerp(r, 0, 2, 20, 60);
    f.push({ label: `Parking ratio ${r}/1,000 SF`, score: parkingW === 1 ? score : 50 + score / 2, evidenceIds: [site.parkingPer1000Sf.evidenceId] });
  }
  if (site.isCorner?.value && frontageW > 0) {
    f.push({ label: "Corner location", score: 100, evidenceIds: [site.isCorner.evidenceId] });
  }

  return component(f, "no frontage, curb-cut, parking or corner evidence relevant to this use.");
}

/** Below this many tenants with a known industry, a group share says nothing. */
export const MIN_INDUSTRY_SAMPLE = 10;

/** "AccommodationAndFoodServices" → "Accommodation and food services". */
export function industryLabel(industry: string): string {
  const words = industry.replace(/([a-z])([A-Z])/g, "$1 $2");
  return words.charAt(0) + words.slice(1).toLowerCase();
}

function market(req: UseRequirements, signals: MarketSignals | undefined, blockers: Blocker[]): ScoreComponent {
  const f: Factor[] = [];
  const s = signals ?? {};
  const scope = "kit buildings only, not a full competitor census";

  if (s.sameCategoryNearby) {
    const n = s.sameCategoryNearby.value;
    // Some nearby peers suggest proven demand; many suggest saturation. A heuristic, labelled as such.
    const score = n === 0 ? 65 : n <= 2 ? 85 : n <= 5 ? 60 : 35;
    f.push({ label: `${n} similar business${n === 1 ? "" : "es"} nearby (${scope})`, score, evidenceIds: [s.sameCategoryNearby.evidenceId] });
  }
  if (s.sameIndustryNearby && s.sameIndustryNearby.value.knownTotal >= MIN_INDUSTRY_SAMPLE) {
    const { count, knownTotal, industries } = s.sameIndustryNearby.value;
    const share = count / knownTotal;
    // Some presence suggests the area supports this kind of business; a large share suggests a
    // crowded cluster. Heuristic thresholds over a broad group, labelled as such.
    const score = share === 0 ? 55 : share <= 0.15 ? 80 : share <= 0.3 ? 65 : 45;
    f.push({
      label: `${count} of ${knownTotal} nearby tenants with a known industry are in ${industries.map(industryLabel).join(" / ")} (a broad industry group, not exact competitors; ${scope}; heuristic)`,
      score,
      evidenceIds: [s.sameIndustryNearby.evidenceId],
    });
  }
  if (s.complementaryNearby) {
    const n = s.complementaryNearby.value;
    f.push({ label: `${n} complementary neighbour${n === 1 ? "" : "s"} (${scope})`, score: n >= 3 ? 90 : n >= 1 ? 70 : 50, evidenceIds: [s.complementaryNearby.evidenceId] });
  }
  if (s.sameCategoryInBuilding && s.sameCategoryInBuilding.value.count > 0) {
    const { count, names } = s.sameCategoryInBuilding.value;
    f.push({ label: `Same-category tenant already in the building (${names.join(", ") || count})`, score: 35, evidenceIds: [s.sameCategoryInBuilding.evidenceId] });
    blockers.push({
      description: `A ${req.label.toLowerCase()} competitor already operates in this building (${names.join(", ") || `${count} tenant(s)`}).`,
      evidenceIds: [s.sameCategoryInBuilding.evidenceId],
      hard: false,
    });
  }

  return component(f, "no nearby tenant data for this use in the CoStar kit.");
}

function economic(site: SiteFacts, signals: MarketSignals | undefined, prefs: UserPreferences | undefined): ScoreComponent {
  const f: Factor[] = [];

  // Acquisition: the listing's asking cap rate against the investor's own target. Both are
  // stated figures (the seller's and the user's), so the label says neither is underwritten.
  if (site.askingCapRatePct && prefs?.targetReturnPct) {
    const cap = site.askingCapRatePct.value;
    const target = prefs.targetReturnPct.value;
    const score = cap >= target ? 90 : cap >= target - 1 ? 60 : 30;
    f.push({
      label: `Asking cap rate ${cap}% vs your ${target}% target (the seller's figure, not an underwritten return)`,
      score,
      evidenceIds: [site.askingCapRatePct.evidenceId, prefs.targetReturnPct.evidenceId],
    });
  }

  const rent = site.askingRentPsfYear;
  if (!rent) return component(f, "no asking rent is published for this space, and no asking cap rate with a target return.");

  if (prefs?.maxRentPsfYear) {
    const ratio = rent.value / prefs.maxRentPsfYear.value;
    const score = ratio <= 1 ? 100 : ratio <= 1.15 ? 60 : 20;
    f.push({
      label: `Asking $${rent.value}/SF/yr vs your $${prefs.maxRentPsfYear.value}/SF/yr budget`,
      score,
      evidenceIds: [rent.evidenceId, prefs.maxRentPsfYear.evidenceId],
    });
  }

  const comp = signals?.comparableRent;
  const sameBasis = comp && (!comp.value.serviceType || !site.serviceType || comp.value.serviceType === site.serviceType.value);
  if (comp && comp.value.n >= 3 && sameBasis) {
    const ratio = rent.value / comp.value.medianPsfYear;
    const score = ratio <= 0.9 ? 90 : ratio <= 1.1 ? 70 : ratio <= 1.3 ? 50 : 30;
    f.push({
      label: `Asking $${rent.value} vs nearby advertised median $${comp.value.medianPsfYear}/SF/yr (n=${comp.value.n}, asking not achieved)`,
      score,
      evidenceIds: [rent.evidenceId, comp.evidenceId, ...(site.serviceType ? [site.serviceType.evidenceId] : [])],
    });
  }

  return component(f, "no budget and too few comparable asking rents (need 3+ on the same service type).");
}

/* ---------------------------------------------------------------- overall */

export function normalizeWeights(partial?: Partial<Weights>): Weights {
  const w = { ...DEFAULT_WEIGHTS, ...partial };
  for (const k of Object.keys(w) as (keyof Weights)[]) {
    if (!Number.isFinite(w[k]) || w[k] < 0) throw new Error(`Weight "${k}" must be a non-negative number.`);
  }
  const total = w.physical + w.market + w.access + w.economic;
  if (total <= 0) throw new Error("At least one weight must be greater than zero.");
  return { physical: (w.physical / total) * 100, market: (w.market / total) * 100, access: (w.access / total) * 100, economic: (w.economic / total) * 100 };
}

export function verdictFor(overall: number | null, blockers: Blocker[], opts: { economicKnown?: boolean } = {}): Opportunity["verdict"] {
  if (overall === null) return "insufficient_evidence";
  const hard = blockers.some((b) => b.hard);
  // Without economic evidence nothing is "promising": the best it can be is "possible".
  if (overall >= 70 && !hard) return opts.economicKnown === false ? "possible" : "promising";
  if (overall >= 50 && !hard) return "possible";
  if (overall >= 70 && hard) return "possible";
  return "unlikely";
}

export function scoreUse(input: ScoreInput): ScoreResult {
  const req = USES[input.use];
  const weightsUsed = normalizeWeights(input.weights);
  const blockers: Blocker[] = [];
  const notes: string[] = [];

  const comps = {
    physical: physical(req, input.site, blockers),
    market: market(req, input.market, blockers),
    access: access(req, input.site),
    economic: economic(input.site, input.market, input.preferences),
  };

  let overall: number | null = null;
  const economicKnown = comps.economic.score !== null;
  if (comps.physical.score === null) {
    notes.push("Overall not scored: physical fit is required.");
  } else if (!economicKnown && !input.economicOptional) {
    notes.push("Overall not scored: physical fit and economic fit are both required.");
  } else {
    if (!economicKnown) notes.push(`Economics not assessed (${comps.economic.rationale.replace(/^Insufficient evidence: /, "")}), so the verdict is capped at "possible".`);
    const used = (Object.keys(comps) as (keyof Weights)[]).filter((k) => comps[k].score !== null && weightsUsed[k] > 0);
    const totalW = used.reduce((s, k) => s + weightsUsed[k], 0);
    overall = totalW > 0 ? round(used.reduce((s, k) => s + (comps[k].score as number) * weightsUsed[k], 0) / totalW) : null;
    const skipped = (Object.keys(comps) as (keyof Weights)[]).filter((k) => comps[k].score === null);
    if (skipped.length > 0) notes.push(`Weights re-normalized over ${used.join(", ")}; ${skipped.join(", ")} had insufficient evidence.`);
  }

  return {
    use: input.use,
    scores: { ...comps, overall },
    verdict: verdictFor(overall, blockers, { economicKnown }),
    blockers,
    notes,
    weightsUsed,
  };
}
