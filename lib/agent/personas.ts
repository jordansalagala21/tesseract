/**
 * Persona-specific analysis logic (AI-07). OWNER: Developer 1.
 * Method: docs/MARKET_ANALYSIS.md §6.
 *
 * One engine, three personas. A persona changes:
 *  - the goal and tool strategy given to the agent,
 *  - the score weights (what matters most to this person),
 *  - which strategies an opportunity may have (leasing and acquisition are never blended).
 * It never changes the facts, the scoring rules or the integrity rules.
 */
import type { AnalysisRequest, Opportunity, PersonaInput } from "@/lib/contracts";
import type { Weights } from "@/lib/market/scoring";
import { USES } from "@/lib/market/uses";
import { subjectKey } from "./tools";

type Strategy = Opportunity["strategy"];

/** Score weights per persona (normalized by lib/market). */
export const PERSONA_WEIGHTS: Record<PersonaInput["persona"], Weights> = {
  // Owners care most about what the building physically supports and how it is reached.
  owner: { physical: 40, market: 20, access: 25, economic: 15 },
  // Investors care most about economics; risks are listed first in the output.
  investor: { physical: 25, market: 25, access: 15, economic: 35 },
  // Business starters care about rent fit and physical fit first.
  entrepreneur: { physical: 35, market: 15, access: 15, economic: 35 },
};

export function personaWeights(input: PersonaInput): Weights {
  return PERSONA_WEIGHTS[input.persona];
}

/** Which opportunity strategies this persona may receive. */
export function allowedStrategies(input: PersonaInput): Strategy[] {
  switch (input.persona) {
    case "owner":
      return ["lease", "reposition"]; // the owner already holds the property
    case "entrepreneur":
      return ["lease"]; // a business starter leases a space
    case "investor":
      return input.strategy === "acquire" ? ["acquisition"] : input.strategy === "lease" ? ["lease", "reposition"] : ["acquisition", "lease", "reposition"];
  }
}

/** How many of the four components have evidence. */
const coverage = (o: Opportunity) =>
  [o.scores.physical, o.scores.market, o.scores.access, o.scores.economic].filter((c) => c.score !== null).length;

/**
 * Ranking: ideas backed by more evidence first, then by overall score. The overall re-normalizes
 * over known components, so without this an idea with an empty component (coworking ignores
 * frontage, so its access score is often empty) would outrank better-evidenced ideas.
 * Investors see acquisition and lease/reposition as separate groups, each ranked the same way.
 */
export function orderForPersona(input: PersonaInput, opportunities: Opportunity[]): Opportunity[] {
  const byScore = (a: Opportunity, b: Opportunity) =>
    coverage(b) - coverage(a) || (b.scores.overall ?? -1) - (a.scores.overall ?? -1);
  if (input.persona !== "investor") return [...opportunities].sort(byScore);
  const acquisition = opportunities.filter((o) => o.strategy === "acquisition").sort(byScore);
  const leasing = opportunities.filter((o) => o.strategy !== "acquisition").sort(byScore);
  return [...acquisition, ...leasing];
}

const usesLine = () =>
  `Use categories you can score: ${Object.values(USES).map((u) => `${u.id} (${u.label})`).join(", ")}.`;

/** The persona section of the agent's first message: goal, inputs and tool strategy. */
export function personaPrompt(request: AnalysisRequest): string {
  const i = request.input;
  const max = request.options.maxCandidates;
  const allowed = allowedStrategies(i).join(", ");
  const lines: (string | false)[] = [];

  switch (i.persona) {
    case "owner":
      lines.push(
        `Persona: property owner. Find the best alternative uses for CoStar property ${i.propertyId}${i.spaceId ? `, advertised space ${i.spaceId}` : ""}.`,
        `Scoring subject: ${subjectKey(i.propertyId, i.spaceId)}.`,
        i.priorities.length > 0 && `Owner priorities: ${i.priorities.join("; ")}.`,
        i.constraints.length > 0 && `Owner constraints: ${i.constraints.join("; ")}.`,
        "Strategy: get_property_profile → get_matterport_model → analyze_interior → get_aerial_imagery → analyze_exterior → get_nearby_context → score_uses for every use that could plausibly fit → run_financial_scenario (lease) for the top idea when rent and size are known → submit_report.",
        "Emphasis: what the building physically supports, its access, and tenant profiles that fit. Suggest the kind of tenant, not a named business.",
      );
      break;
    case "investor":
      lines.push(
        `Persona: investor. Capital $${i.capitalUsd.toLocaleString("en-US")}, ${i.riskTolerance} risk tolerance, ${i.horizonYears}-year horizon, markets: ${i.markets.join(", ")}. Preference: ${i.strategy}.`,
        i.targetAnnualReturn !== undefined && `User's target annual return: ${(i.targetAnnualReturn * 100).toFixed(1)}% (a user assumption, not a promise).`,
        i.goals.length > 0 && `Goals: ${i.goals.join("; ")}.`,
        "Strategy: search_properties (and search_available_spaces for leasing) in the markets → get_property_profile and get_nearby_context for the most promising candidates → score_uses per candidate → run_financial_scenario: acquisition scenarios only with a CoStar asking price or a user figure, lease scenarios separately → submit_report.",
        "Emphasis: economics and risks first. Acquisition and lease/reposition are separate opportunities with separate scenarios; never blend them. If no asking price exists, say so instead of estimating a value.",
      );
      break;
    case "entrepreneur":
      lines.push(
        `Persona: business starter. Concept: "${i.businessConcept}". Needs ${i.sfMin.toLocaleString("en-US")}–${i.sfMax.toLocaleString("en-US")} SF in ${i.markets.join(", ")}.`,
        i.maxRentPsfYear ? `Budget: up to $${i.maxRentPsfYear}/SF/yr (user assumption, evidence ev_user_budget).` : "No rent budget given.",
        i.mustHaves.length > 0 && `Must-haves: ${i.mustHaves.join("; ")}.`,
        "Strategy: pick the use category closest to the concept → search_available_spaces → get_property_profile for at least 3 candidate spaces when 3 exist (one subject per space) → score_uses for that one category on each space → run_financial_scenario (lease) for the best fits → submit_report with one opportunity per space.",
        "Emphasis: rent fit and physical fit. For each space, list the questions to ask the listing broker under nextSteps.",
      );
      break;
  }

  lines.push(
    `Allowed strategies for this persona: ${allowed}.`,
    `Interior vision allowed: ${request.options.includeInteriorVision}. Aerial vision allowed: ${request.options.includeAerialVision}.`,
    usesLine(),
    `Present at most ${max} opportunities.`,
  );
  return lines.filter(Boolean).join("\n");
}
