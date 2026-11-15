// Plain facts about an idea's space for the simplified results page: address, suite, size, rent,
// sale figures, risks and market insights. Everything is read from the analysis's own evidence
// (ids follow lib/agent/data-deps: ev_p<property>_*, ev_s<space>_*, ev_mkt_*), so each fact
// keeps its citation. Nothing here is estimated.
import type { AnalysisResponse, Evidence, Opportunity } from "@/lib/contracts";
import { cleanStatement } from "./evidence-format";

/** Evidence by its id, tolerating the registry's "_2" suffix when a tool ran twice. */
function find(evidence: Evidence[], id: string): Evidence | undefined {
  const re = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(_\\d+)?$`);
  return evidence.find((e) => re.test(e.id));
}
const num = (e?: Evidence) => (e && typeof e.value === "number" ? e.value : null);
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export interface SpaceFacts {
  address: string;
  /** "Suite 100", or null for a whole property. */
  suite: string | null;
  /** "9,889 SF" or "2,554–4,681 SF". */
  size: string | null;
  sizeSf: number | null;
  /** "$45/SF/yr TripleNet" or "Rent not published". */
  rent: string | null;
  rentPsfYear: number | null;
  serviceType: string | null;
  askingPriceUsd: number | null;
  capRatePct: number | null;
  noiUsd: number | null;
  /** Evidence behind each fact, for citations. */
  ids: { size?: string; rent?: string; price?: string; cap?: string };
}

export function factsFor(o: Pick<Opportunity, "propertyId" | "spaceId">, evidence: Evidence[]): SpaceFacts {
  const p = o.propertyId;
  const s = o.spaceId;
  const type = find(evidence, `ev_p${p}_type`);
  const searched = s ? find(evidence, `ev_search_s${s}`) : undefined;
  const sale = find(evidence, `ev_p${p}_sale_price`);
  const address =
    type?.statement.split(" is a ")[0] ??
    searched?.statement.match(/ at ([^:]+):/)?.[1] ??
    `Property ${p}`;

  const status = s ? find(evidence, `ev_s${s}_status`) : undefined;
  const suite = status?.statement.match(/^(Suite \S+|Space \d+)/)?.[1] ?? null;

  const sfFact = s ? find(evidence, `ev_s${s}_sf`) : find(evidence, `ev_p${p}_sale_sf`);
  const range = sfFact?.statement.match(/([\d,]+–[\d,]+|[\d,]+) SF/)?.[1];
  const sizeSf = num(sfFact);

  const rentFact = s ? find(evidence, `ev_s${s}_rent`) : undefined;
  const rentMissing = s ? find(evidence, `ev_s${s}_rent_missing`) : undefined;
  const service = s ? find(evidence, `ev_s${s}_service`) : undefined;
  const rentPsfYear = num(rentFact);
  const serviceType = typeof service?.value === "string" ? service.value : null;

  const cap = find(evidence, `ev_p${p}_sale_cap`);
  return {
    address,
    suite,
    size: range ? `${range} SF` : sizeSf ? `${sizeSf.toLocaleString("en-US")} SF` : null,
    sizeSf,
    rent: rentPsfYear !== null ? `$${rentPsfYear}/SF/yr${serviceType ? ` ${humanService(serviceType)}` : ""}` : rentMissing ? "Rent not published" : null,
    rentPsfYear,
    serviceType,
    askingPriceUsd: num(sale),
    capRatePct: num(cap),
    noiUsd: num(find(evidence, `ev_p${p}_sale_noi`)),
    ids: { size: sfFact?.id, rent: rentFact?.id ?? rentMissing?.id, price: sale?.id, cap: cap?.id },
  };
}

/** "TripleNet" → "NNN (tenant also pays taxes, insurance, upkeep)" is too long for a line: "NNN". */
export function humanService(t: string): string {
  const map: Record<string, string> = { TripleNet: "NNN", FullService: "full service", ModifiedGross: "modified gross", PlusElectric: "plus electric", IndustrialGross: "industrial gross", Negotiable: "negotiable", ToBeDetermined: "TBD" };
  return map[t] ?? t;
}

/* ------------------------------------------------------------------ risks */

export interface Risk {
  text: string;
  evidenceId?: string;
}

/**
 * What to watch out for, most important first: blockers the scoring found, the unverified
 * permitted use, an unchecked rent, then the agent's own top unknown. At most three.
 */
export function risksFor(o: Opportunity, evidence: Evidence[], opts: { specific?: boolean } = {}): Risk[] {
  const out: Risk[] = o.blockers.map((b) => ({ text: firstSentence(b.description), evidenceId: b.evidenceIds[0] }));
  const zoning = find(evidence, "ev_missing_permitted_use");
  // On a card, the risk that applies to every idea (zoning) would just repeat; show the idea's own.
  if (zoning && !opts.specific) out.push({ text: "Permitted use and zoning aren’t verified. Confirm with the city before committing.", evidenceId: zoning.id });
  if (opts.specific) {
    const own = o.unknowns.find((u) => !u.startsWith("Economics not assessed"));
    if (own) out.push({ text: firstSentence(own) });
  }
  if (o.scores.economic.score === null) {
    const noComps = find(evidence, "ev_mkt_missing_comparable_rent");
    out.push({ text: noComps ? "We couldn’t check if the rent is competitive: no similar spaces nearby publish a rent." : "We couldn’t check the economics: no budget or comparable rents to compare against.", evidenceId: noComps?.id });
  }
  const own = o.unknowns.find((u) => !u.startsWith("Economics not assessed"));
  if (own && !opts.specific) out.push({ text: firstSentence(own) });
  return out.slice(0, 3);
}

const firstSentence = (t: string) => {
  const s = t.split(/(?<=\.)\s/)[0].trim();
  return /[.!?]$/.test(s) ? s : `${s}.`;
};

/* ---------------------------------------------------------------- market */

export interface Insight {
  text: string;
  evidenceId?: string;
  /** "missing" insights say what we couldn't check. */
  tone: "fact" | "missing";
}

/**
 * Three short market insights for an idea, in plain words, each from a cited kit count. Never a
 * demand claim: counts cover kit buildings only, and the gaps are said out loud.
 */
export function insightsFor(o: Opportunity, a: AnalysisResponse): Insight[] {
  const ev = a.evidence;
  const out: Insight[] = [];
  const market = o.scores.market.evidenceIds.map((id) => ev.find((e) => e.id === id)).filter((e): e is Evidence => !!e);

  // 1. Rent: comparable or not.
  const missingRent = find(ev, "ev_mkt_missing_comparable_rent");
  const rentGroup = ev.find((e) => /^ev_mkt_rent_/.test(e.id));
  if (missingRent) out.push({ text: "No similar spaces nearby publish an asking rent, so the rent can’t be compared yet. Ask the broker for recent lease deals.", evidenceId: missingRent.id, tone: "missing" });
  else if (rentGroup) out.push({ text: cleanStatement(rentGroup.statement).replace(/ Advertised asking rents, not achieved rents\.$/, " (asking rents, not signed leases)."), evidenceId: rentGroup.id, tone: "fact" });

  // 2. Same kind of business nearby / in the building.
  const inBuilding = market.find((e) => e.id.includes("_same_"));
  const peers = market.find((e) => e.id.startsWith("ev_mkt_peer"));
  if (inBuilding) out.push({ text: cleanStatement(inBuilding.statement).replace(/^Already in the building, same category as [^:]+: /, "Already in this building and similar: ") + ".", evidenceId: inBuilding.id, tone: "fact" });
  else if (peers) {
    const m = peers.statement.match(/^(\d+) of (\d+)/);
    out.push({ text: m ? `${m[1]} of ${m[2]} nearby businesses we know of are in the same broad category.` : cleanStatement(peers.statement), evidenceId: peers.id, tone: "fact" });
  }

  // 3. Likely customers nearby.
  const complement = market.find((e) => e.id.startsWith("ev_mkt_complement"));
  if (complement && typeof complement.value === "number") {
    out.push({ text: `${complement.value} nearby businesses have staff or visitors who could be customers (offices, clinics and similar).`, evidenceId: complement.id, tone: "fact" });
  }
  return out.slice(0, 3);
}

/** What the market data can't tell, in one line. */
export const MARKET_GAP = "No foot-traffic, demographic or spending data is in the dataset, so demand isn’t measured. Counts cover nearby CoStar buildings only.";

/* ----------------------------------------------------------------- money */

export interface Money {
  headline: { label: string; value: string }[];
  sentence: string;
  /** How the numbers were worked out. */
  basis: string;
  scenarioId?: string;
}

/**
 * The financial summary in plain words: the agent's lease or purchase scenario when there is one
 * for this space, else simple arithmetic on the cited CoStar facts (shown as a formula), else an
 * honest "not published".
 */
export function moneyFor(o: Opportunity, a: AnalysisResponse, f: SpaceFacts): Money | null {
  const scenario =
    a.financialScenarios.find((s) => o.financialScenarioIds.includes(s.id)) ??
    a.financialScenarios.find((s) => s.input.mode === (o.strategy === "acquisition" ? "acquisition" : "lease") && sameSpace(s, f));
  if (scenario?.input.mode === "lease") {
    const out = scenario.output;
    const head = [];
    if (out.monthlyOccupancyCostUsd != null) head.push({ label: "Rent + building costs / month", value: money(out.monthlyOccupancyCostUsd) });
    if (out.annualOccupancyCostUsd != null) head.push({ label: "Per year", value: money(out.annualOccupancyCostUsd) });
    if (out.breakEvenMonthlyRevenueUsd != null) head.push({ label: "Sales needed / month", value: money(out.breakEvenMonthlyRevenueUsd) });
    return {
      headline: head,
      sentence: out.breakEvenMonthlyRevenueUsd != null ? `To keep rent at a healthy share of sales, a business here would need about ${money(out.breakEvenMonthlyRevenueUsd)} a month in sales.` : "Monthly cost of leasing this space, from labelled assumptions.",
      basis: "From the scenario below. Every number is labelled CoStar, your input or an app default.",
      scenarioId: scenario.id,
    };
  }
  if (scenario?.input.mode === "acquisition") {
    const out = scenario.output;
    return {
      headline: [
        ...(out.netOperatingIncomeUsd != null ? [{ label: "Net operating income / yr", value: money(out.netOperatingIncomeUsd) }] : []),
        ...(out.capRatePct != null ? [{ label: "Cap rate", value: `${out.capRatePct}%` }] : []),
      ],
      sentence: "Purchase scenario from labelled assumptions; not an appraisal.",
      basis: "From the scenario below.",
      scenarioId: scenario.id,
    };
  }
  if (o.strategy === "acquisition" && f.askingPriceUsd) {
    return {
      headline: [{ label: "Asking price", value: money(f.askingPriceUsd) }, ...(f.capRatePct ? [{ label: "Stated cap rate", value: `${f.capRatePct}%` }] : [])],
      sentence: f.capRatePct ? `The seller states a ${f.capRatePct}% cap rate. That’s their figure, not an underwritten return.` : "The listing doesn’t state a cap rate or income, so returns can’t be estimated.",
      basis: "From the CoStar sale listing.",
    };
  }
  if (f.rentPsfYear !== null && f.sizeSf) {
    const yearly = f.rentPsfYear * f.sizeSf;
    const nnn = f.serviceType === "TripleNet";
    return {
      headline: [
        { label: "Base rent / month", value: money(yearly / 12) },
        { label: "Base rent / year", value: money(yearly) },
      ],
      sentence: nnn ? "Taxes, insurance and upkeep come on top (NNN lease) and aren’t published." : "At the advertised asking rent.",
      basis: `${f.sizeSf.toLocaleString("en-US")} SF × $${f.rentPsfYear}/SF/yr asking rent (CoStar).`,
    };
  }
  return f.rent === "Rent not published" ? { headline: [], sentence: "The listing doesn’t publish a rent, so costs can’t be shown. Ask the broker.", basis: "CoStar listing." } : null;
}

const sameSpace = (s: AnalysisResponse["financialScenarios"][number], f: SpaceFacts) =>
  s.input.mode === "lease" ? s.input.spaceSf.value === f.sizeSf : s.input.mode === "acquisition" && f.askingPriceUsd !== null && s.input.purchasePriceUsd.value === f.askingPriceUsd;
