/**
 * Market feasibility from nearby kit data (AI-04). OWNER: Developer 1.
 * Method: docs/MARKET_ANALYSIS.md §1. Input: DATA-07's getNearbyContext().
 *
 * What this can honestly say: what the CoStar kit holds near a building. Comparable ADVERTISED
 * rents (asking, not achieved) within one serviceType × spaceUse, the industry mix of current
 * tenants in kit buildings, and how many sale comps exist. It is not a market census, and it has
 * no demographics, foot traffic, spending or zoning, so `limitations` always says so.
 *
 * Pure: no I/O. The caller fetches the nearby context; this turns it into
 *  - a `MarketAnalysis` for the dashboard,
 *  - cited evidence (verified facts over kit counts, `missing` for the gaps), and
 *  - per-use market signals for lib/market/scoring.
 */
import type { z } from "zod";
import type { Evidence, MarketAnalysis } from "@/lib/contracts";
import type { NearbyContext } from "@/lib/data/nearby";
import { industryLabel, MIN_INDUSTRY_SAMPLE, type MarketSignals } from "./scoring";
import { comparableRentFor, describeRange, groupLabel, ratedGroups, roundRange, type SubjectBasis } from "./rent";
import { USE_CATEGORIES, USES, type UseCategory } from "./uses";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Evidence as produced here: the agent's registry stamps createdAt (and may re-key the id). */
export type MarketEvidence = DistributiveOmit<z.input<typeof Evidence>, "createdAt">;

/** Signals for scoring, kept per use so one use's counts never leak into another's. */
export interface MarketSignalSet {
  comparableRent?: MarketSignals["comparableRent"];
  byUse: Partial<Record<UseCategory, Omit<MarketSignals, "comparableRent">>>;
}

export interface AnalyzeOptions {
  /** Restrict the headline rent range to one CoStar spaceUse (e.g. "Retail"). */
  spaceUse?: string;
  /** The space being evaluated, for the comparable-rent signal. */
  subject?: SubjectBasis;
  /** Uses to build signals for (default: all). */
  uses?: UseCategory[];
  retrievedAt?: string;
}

export interface MarketResult {
  analysis: MarketAnalysis;
  evidence: MarketEvidence[];
  signals: MarketSignalSet;
  /** One line for the investigation timeline. */
  summary: string;
}

/** Rent groups listed as their own evidence; the rest are still counted in the analysis. */
const MAX_RENT_EVIDENCE = 6;

export function analyzeNearby(nearby: NearbyContext, opts: AnalyzeOptions = {}): MarketResult {
  const { propertyId, radiusMeters } = nearby;
  const cs = nearby.comparableSpaces;
  const retrievedAt = opts.retrievedAt ?? new Date().toISOString();
  const evidence: MarketEvidence[] = [];
  const limitations: string[] = [];

  /** Every figure here is an aggregate over kit records near the subject. */
  const source = (dataset: string, field: string) => [
    { system: "costar" as const, dataset, recordId: `nearby:${propertyId}:${radiusMeters}m`, field, retrievedAt },
  ];
  const fact = (id: string, statement: string, value: number, unit: string | undefined, dataset: string, field: string) => {
    evidence.push({ id, kind: "verified_fact", statement, value, ...(unit ? { unit } : {}), sources: source(dataset, field) });
    return id;
  };
  const within = `within ${radiusMeters.toLocaleString("en-US")} m`;

  limitations.push(
    `Covers only the ${nearby.propertiesInRadius} CoStar kit propert${nearby.propertiesInRadius === 1 ? "y" : "ies"} ${within}, not a full market census.`,
    "No demographics, foot traffic, consumer spending or zoning data is in the sponsor dataset, so demand is not measured.",
  );

  /* ------------------------------------------------------------ sample */
  fact(
    "ev_mkt_sample",
    `${nearby.propertiesInRadius} CoStar kit properties lie ${within} of property ${propertyId} (kit buildings only, not a market census)`,
    nearby.propertiesInRadius,
    "properties",
    "commercial-property",
    "primaryAddress.latitude/longitude",
  );

  /* ------------------------------------------------------------- rents */
  const rated = ratedGroups(cs.rentGroups);
  const rentEvidence = new Map<string, string>();
  rated.slice(0, MAX_RENT_EVIDENCE).forEach((g, i) => {
    const id = fact(
      `ev_mkt_rent_${i + 1}`,
      `Nearby ${groupLabel(g)} asking rents ${within}: ${describeRange(g)}. Advertised asking rents, not achieved rents.`,
      roundRange(g.askingRentPsfYear).median!,
      "$/SF/yr",
      "commercial-listing-summary",
      "rateLow (normalized to $/SF/yr)",
    );
    rentEvidence.set(groupLabel(g), id);
  });
  if (cs.count > 0) {
    limitations.push(
      `Rents are advertised asking rents, not signed leases: ${cs.withPublishedRate} of ${cs.count} comparable spaces publish a rate, and spaces without one are excluded from every range.`,
    );
  }

  let headline = roundRange(cs.askingRentPsfYear);
  if (opts.spaceUse) {
    const forUse = rated.filter((g) => g.spaceUse === opts.spaceUse);
    if (forUse.length === 1) {
      headline = roundRange(forUse[0].askingRentPsfYear);
    } else {
      headline = { min: null, median: null, max: null };
      limitations.push(
        forUse.length === 0
          ? `No nearby ${opts.spaceUse} space publishes an asking rent, so there is no ${opts.spaceUse} rent range.`
          : `Nearby ${opts.spaceUse} rents are quoted on ${forUse.length} different service types (${forUse.map((g) => g.serviceType).join(", ")}); they are not blended into one range.`,
      );
    }
  } else if (new Set(rated.map(groupLabel)).size > 1) {
    limitations.push(
      `The overall rent range mixes ${new Set(rated.map(groupLabel)).size} service type × space use groups (${rated.map(groupLabel).join(", ")}); compare a space only with its own group.`,
    );
  }

  /* ---------------------------------------------------- comparable rent */
  const signals: MarketSignalSet = { byUse: {} };
  if (opts.subject) {
    const comp = comparableRentFor(cs.rentGroups, opts.subject);
    const basis = `${opts.subject.serviceType ?? "unknown service type"} ${opts.subject.spaceUse ?? "unknown use"}`;
    if (comp.status === "matched") {
      const evidenceId = rentEvidence.get(groupLabel(comp.group)) ??
        fact(
          `ev_mkt_rent_${groupLabel(comp.group).replace(/\W+/g, "_").toLowerCase()}`,
          `Nearby ${groupLabel(comp.group)} asking rents ${within}: ${describeRange(comp.group)}. Advertised asking rents, not achieved rents.`,
          roundRange(comp.group.askingRentPsfYear).median!,
          "$/SF/yr",
          "commercial-listing-summary",
          "rateLow (normalized to $/SF/yr)",
        );
      signals.comparableRent = {
        value: { medianPsfYear: roundRange(comp.group.askingRentPsfYear).median!, n: comp.group.withPublishedRate, serviceType: comp.group.serviceType },
        evidenceId,
      };
      if (comp.group.withPublishedRate < 3) {
        limitations.push(`Only ${comp.group.withPublishedRate} nearby ${basis} space(s) publish a rent; too few to judge the asking rent against.`);
      }
    } else {
      const why =
        comp.status === "unknown_subject"
          ? "The space's service type or use is unknown, so no nearby rent can be called comparable."
          : comp.status === "no_published_rate"
            ? `${comp.group.count} nearby ${basis} space(s) are advertised but none publishes a rate.`
            : `No nearby advertised space is ${basis}.`;
      evidence.push({
        id: "ev_mkt_missing_comparable_rent",
        kind: "missing",
        statement: `No comparable ${basis} asking rent is published ${within}`,
        whyNeeded: `To judge whether the asking rent is in line with similar nearby listings. ${why}`,
        howToResolve: "Ask the listing broker for recent lease comps for this use and lease type; the kit only holds advertised listings in kit buildings.",
      });
      limitations.push(`No comparable ${basis} rent ${within}: ${why} Rents for other uses or lease types are not substituted.`);
    }
  }

  /* ----------------------------------------------------------- tenants */
  const tenants = nearby.nearbyTenants;
  const unknownIndustry = tenants.byIndustry.find((r) => r.industry === "Unknown")?.count ?? 0;
  const knownTotal = tenants.count - unknownIndustry;
  if (tenants.count > 0) {
    fact(
      "ev_mkt_tenants",
      `${tenants.count} current tenants in kit buildings ${within}; ${knownTotal} have a known CoStar industry`,
      tenants.count,
      "tenants",
      "location-occupancy",
      "company-detail.profile.industryType",
    );
    limitations.push(
      `Tenant industries are broad CoStar groups (hotels and restaurants share one), and ${unknownIndustry} of ${tenants.count} nearby tenants have no known industry.`,
    );
  }
  if (knownTotal < MIN_INDUSTRY_SAMPLE) {
    limitations.push(`Only ${knownTotal} nearby tenants have a known industry, too few to read the area's business mix.`);
  }

  const countIn = (industries: string[]) =>
    tenants.byIndustry.filter((r) => industries.includes(r.industry)).reduce((n, r) => n + r.count, 0);
  const groupEvidence = new Map<string, string>();
  /** One evidence item per distinct industry set (restaurant and café share theirs). */
  const industryFact = (kind: "peer" | "complement", industries: string[], statement: (n: number) => string) => {
    const key = `${kind}:${[...industries].sort().join(",")}`;
    const n = countIn(industries);
    if (!groupEvidence.has(key)) {
      groupEvidence.set(key, fact(`ev_mkt_${kind}_${groupEvidence.size + 1}`, statement(n), n, "tenants", "location-occupancy", "company-detail.profile.industryType"));
    }
    return { n, evidenceId: groupEvidence.get(key)! };
  };

  const uses = opts.uses ?? USE_CATEGORIES;
  if (knownTotal > 0) {
    for (const use of uses) {
      const req = USES[use];
      const s: Omit<MarketSignals, "comparableRent"> = {};
      if (req.peerIndustries.length > 0) {
        const { n, evidenceId } = industryFact(
          "peer",
          req.peerIndustries,
          (count) => `${count} of ${knownTotal} nearby tenants with a known industry are in ${req.peerIndustries.map(industryLabel).join(" / ")} (a broad CoStar industry group, kit buildings only)`,
        );
        s.sameIndustryNearby = { value: { count: n, knownTotal, industries: req.peerIndustries }, evidenceId };
      }
      if (req.complementIndustries.length > 0) {
        const { n, evidenceId } = industryFact(
          "complement",
          req.complementIndustries,
          (count) => `${count} nearby tenants are in industries whose staff or visitors are likely customers of a ${req.label.toLowerCase()} (${req.complementIndustries.length} CoStar industry groups, kit buildings only)`,
        );
        s.complementaryNearby = { value: n, evidenceId };
      }
      signals.byUse[use] = s;
    }
    if (uses.includes("coworking")) {
      limitations.push("Coworking operators share CoStar's Real estate industry group with brokers and landlords, so nearby coworking supply is not counted.");
    }
  }

  /* -------------------------------------------------------- sale comps */
  if (nearby.saleComps.count > 0) {
    fact(
      "ev_mkt_sale_comps",
      `${nearby.saleComps.count} sale comps for kit properties ${within}, ${nearby.saleComps.withDisclosedPrice} with a disclosed price`,
      nearby.saleComps.count,
      "comps",
      "sale-comp",
      "soldForPrice",
    );
  }

  if (nearby.propertiesInRadius === 0) {
    limitations.push(`No kit property lies ${within}; widen the radius or treat the market as unknown.`);
  }

  const analysis: MarketAnalysis = {
    propertyId,
    radiusMeters,
    comparableSpaces: {
      count: cs.count,
      askingRentPsfYear: headline,
      serviceTypes: cs.serviceTypes,
      spaceUses: cs.spaceUses,
    },
    nearbyTenants: { count: tenants.count, byIndustry: tenants.byIndustry },
    saleComps: nearby.saleComps,
    limitations,
    evidenceIds: evidence.map((e) => e.id),
  };

  const topRent = rated[0] ? `${groupLabel(rated[0])} median $${roundRange(rated[0].askingRentPsfYear).median}/SF/yr` : "no published rents";
  const summary =
    `${nearby.propertiesInRadius} kit properties ${within} · ${cs.withPublishedRate} of ${cs.count} comparable spaces publish a rent (${topRent})` +
    ` · ${tenants.count} tenants · ${nearby.saleComps.count} sale comps`;

  return { analysis, evidence, signals, summary };
}
