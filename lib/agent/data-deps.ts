/**
 * Live data dependencies for the agent (INT-02). OWNER: Developer 1.
 *
 * Turns DATA-02…07 (lib/data) into the agent's tools: every number becomes a cited evidence item
 * with a SourceRef back to the CoStar record, Matterport model or Vexcel collection, and every
 * scoring fact points at that evidence. Gaps become `missing` evidence, never guesses:
 * - an unpublished rent is missing, not $0;
 * - "advertised available" is never "vacant";
 * - scanned area is never presented as leasable area.
 *
 * Data access is injected (`DataModules`) so this file is testable without the kit or network.
 */
import type { AerialImagery, MatterportModel, SourceRef } from "@/lib/contracts";
import type { CostarLink, ModelImage } from "@/lib/data/matterport";
import type { NearbyContext } from "@/lib/data/nearby";
import type { AvailableSpace, Property, PropertySearchQuery, PropertySearchResult } from "@/lib/data/properties";
import type { SaleListing, SaleListingQuery } from "@/lib/data/sale-listings";
import type { CurrentTenant } from "@/lib/data/tenants";
import type { FetchImageInput, FetchedImage } from "@/lib/data/vexcel";
import type { SiteFacts } from "@/lib/market/scoring";
import { USE_CATEGORIES, USES, type UseCategory } from "@/lib/market/uses";
import type { EvidenceDraft } from "./evidence";
import { nearbyContextDep } from "./market-tool";
import { subjectKey, ToolUnavailableError, type DataDeps, type MarketContext, type ToolOutput } from "./tools";
import { visionDeps, type CreateMessage, type VisionImage } from "./vision";

/** The lib/data functions this module uses. Production passes the real ones (see run.ts). */
export interface DataModules {
  searchProperties(query: PropertySearchQuery): Promise<PropertySearchResult>;
  getProperty(id: number): Promise<Property | null>;
  getSpaces(propertyId: number): Promise<AvailableSpace[]>;
  getCurrentTenants(propertyId: number): Promise<CurrentTenant[]>;
  searchSaleListings(query: SaleListingQuery): Promise<{ items: SaleListing[]; total: number }>;
  getSaleListings(propertyId: number): Promise<SaleListing[]>;
  getNearbyContext(propertyId: number, radiusMeters: number): Promise<NearbyContext>;
  getMatterportModel(modelId: string, costar: CostarLink): Promise<MatterportModel | null>;
  getModelImages(modelId: string, limit?: number): Promise<ModelImage[]>;
  getAerialImagery(propertyId: number, lat: number, lon: number, kind: "ortho" | "oblique", direction: "north" | "south" | "east" | "west" | null): Promise<AerialImagery>;
  fetchVexcelImage(input: FetchImageInput): Promise<FetchedImage>;
  /** Download a signed Matterport asset URL. Never logged, never returned to the browser. */
  download(url: string): Promise<Buffer>;
}

export interface LiveDepsOptions {
  createMessage: CreateMessage;
  /** Model for interior/aerial vision. */
  visionModel: string;
}

/** Max spaces given scoring facts per profile call, and max spaces scanned per space search. */
const MAX_SPACES_PER_PROFILE = 12;
const MAX_SEARCH_PROPERTIES = 300;

/* ------------------------------------------------------------------ helpers */

const now = () => new Date().toISOString();
const costar = (dataset: string, recordId: number | string, field: string): SourceRef[] => [
  { system: "costar", dataset, recordId: String(recordId), field, retrievedAt: now() },
];
/** "GeneralRetail" → "general retail", "Freestanding" → "freestanding". */
const humanize = (code: string) => code.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** "FirstFloor"/"Ground" → true, other floors → false, anything else → unknown. */
export function groundFloorOf(floor: string | null): boolean | null {
  if (!floor) return null;
  if (floor === "FirstFloor" || floor === "Ground") return true;
  if (/Floor$|^Basement$|^Mezzanine$/.test(floor)) return false;
  return null;
}

/** Same-category tenants already in the building, by keyword on the tenant name (word-bounded). */
export function sameCategoryTenants(tenants: CurrentTenant[], use: UseCategory): string[] {
  const words = USES[use].competitorKeywords;
  return tenants
    .map((t) => t.name)
    .filter((name): name is string => !!name && words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(name)));
}

/** Which Matterport scan belongs to a space (direct link or caption match), or to the building. */
function modelFor(property: Property, spaces: AvailableSpace[], spaceId?: number): { modelId: string; link: CostarLink } | null {
  if (spaceId) {
    const space = spaces.find((s) => s.id === spaceId);
    if (space?.matterport) {
      return { modelId: space.matterport.modelId, link: { propertyId: property.id, caption: space.matterport.caption, matchedSuite: space.suite } };
    }
    return null; // a building scan is not this space's interior
  }
  const linked = spaces.find((s) => s.matterport);
  if (linked?.matterport) return { modelId: linked.matterport.modelId, link: { propertyId: property.id, caption: linked.matterport.caption, matchedSuite: linked.suite } };
  const first = property.matterportModelIds[0];
  return first ? { modelId: first, link: { propertyId: property.id } } : null;
}

/** "9,889 SF", or "2,000–6,303 SF" for a space that can be divided. */
const sfText = (s: AvailableSpace) =>
  s.sfMin && s.sfMax && s.sfMin !== s.sfMax ? `${fmt(s.sfMin)}–${fmt(s.sfMax)} SF` : s.sfMax ?? s.sfMin ? `${fmt((s.sfMax ?? s.sfMin)!)} SF` : "size not published";

/** Listings that can no longer be bought. */
const UNAVAILABLE_SALE = ["UnderContract", "Escrow", "Sold", "OffMarket"];

const spaceLabel = (s: AvailableSpace) => (s.suite ? `Suite ${s.suite}` : `Space ${s.id}`);

/* --------------------------------------------------------------- profiles */

/** CoStar facts for one property and its advertised spaces, as evidence + scoring facts. */
export function profileOutput(
  property: Property,
  spaces: AvailableSpace[],
  tenants: CurrentTenant[],
  spaceId?: number,
  saleListings: SaleListing[] = [],
): ToolOutput {
  const evidence: EvidenceDraft[] = [];
  const facts: Record<string, SiteFacts> = {};
  const market: Record<string, MarketContext> = {};
  const pid = property.id;
  const prop = subjectKey(pid);
  const P = "commercial-property";
  const add = (d: EvidenceDraft) => (evidence.push(d), d.id!);
  const where = [property.address.street, property.address.city].filter(Boolean).join(", ");

  const subtype = property.propertySubtype?.replace(new RegExp(`^${property.propertyType}_?`), "");
  add({ id: `ev_p${pid}_type`, kind: "verified_fact", statement: `${where} is a ${humanize(property.propertyType)}${subtype ? ` (${humanize(subtype)})` : ""} building in CoStar`, value: property.propertyType, sources: costar(P, pid, "propertyType") });
  if (property.rentableAreaSf) add({ id: `ev_p${pid}_rba`, kind: "verified_fact", statement: `Building rentable area is ${fmt(property.rentableAreaSf)} SF`, value: property.rentableAreaSf, unit: "SF", sources: costar(P, pid, "rentableBuildingArea") });
  if (property.yearBuilt) add({ id: `ev_p${pid}_built`, kind: "verified_fact", statement: `Built in ${property.yearBuilt}${property.yearRenovated ? `, renovated ${property.yearRenovated}` : ""}`, value: property.yearBuilt, sources: costar(P, pid, "yearBuilt") });
  if (property.zoningDescription) add({ id: `ev_p${pid}_zoning`, kind: "verified_fact", statement: `CoStar's zoning field reads "${property.zoningDescription}" (a record, not a permitted-use determination)`, value: property.zoningDescription, sources: costar(P, pid, "zoningDescription") });

  const propFacts: SiteFacts = {};
  const ceiling = property.retail?.ceilingHeightFt;
  if (ceiling) propFacts.ceilingFt = { value: ceiling, evidenceId: add({ id: `ev_p${pid}_ceiling`, kind: "verified_fact", statement: `Retail ceiling height is recorded as ${fmt(ceiling)} ft`, value: ceiling, unit: "ft", sources: costar(P, pid, "propertyRetail.structural.ceilingHeightFeet") }) };
  const front = property.retail?.frontage.find((f) => f.isPrimary) ?? property.retail?.frontage[0];
  if (front?.feet) {
    const id = add({ id: `ev_p${pid}_frontage`, kind: "verified_fact", statement: `${fmt(front.feet)} ft of frontage on ${front.street || "the primary street"}${front.curbCuts !== null ? `, ${front.curbCuts} curb cut${front.curbCuts === 1 ? "" : "s"}` : ""}`, value: front.feet, unit: "ft", sources: costar(P, pid, "propertyRetail.frontage") });
    propFacts.frontageFt = { value: front.feet, evidenceId: id };
    if (front.curbCuts !== null) propFacts.curbCuts = { value: front.curbCuts, evidenceId: id };
  }
  if (property.parkingRatioPer1000Sf !== null) {
    propFacts.parkingPer1000Sf = { value: property.parkingRatioPer1000Sf, evidenceId: add({ id: `ev_p${pid}_parking`, kind: "verified_fact", statement: `Parking ratio is ${fmt(property.parkingRatioPer1000Sf)} per 1,000 SF`, value: property.parkingRatioPer1000Sf, sources: costar(P, pid, "parkingRatio") }) };
  } else {
    add({ id: `ev_p${pid}_parking_missing`, kind: "missing", statement: "Parking is not recorded for this property", whyNeeded: "Gyms, clinics and some restaurants depend on customer parking.", howToResolve: "Ask the listing broker about on-site and nearby parking." });
  }
  /* sale listing (acquisition): the listing's own figures, never an estimated value */
  const sale = saleListings.find((l) => !UNAVAILABLE_SALE.includes(l.saleStatus ?? "")) ?? saleListings[0];
  if (sale) {
    const L = (field: string) => [{ ...sale.source, field: `forSaleSummary.${field}` }];
    const status = sale.saleStatus ? ` (${humanize(sale.saleStatus)}${sale.saleType ? `, ${humanize(sale.saleType)}` : ""})` : "";
    if (sale.askingPriceLowUsd !== null) {
      const range = sale.askingPriceHighUsd && sale.askingPriceHighUsd !== sale.askingPriceLowUsd ? `–$${fmt(sale.askingPriceHighUsd)}` : "";
      add({ id: `ev_p${pid}_sale_price`, kind: "verified_fact", statement: `Listed for sale at an asking price of $${fmt(sale.askingPriceLowUsd)}${range}${status}${sale.availableSf ? ` for ${fmt(sale.availableSf)} SF` : ""} (an asking price, not a valuation)`, value: sale.askingPriceLowUsd, unit: "USD", sources: L("askingPriceLow") });
    } else {
      add({ id: `ev_p${pid}_sale_price_missing`, kind: "missing", statement: `Listed for sale${status}, but the listing does not disclose an asking price`, whyNeeded: "An acquisition scenario needs a real price; Tesseract never estimates a property value.", howToResolve: "Ask the listing broker for the asking price and the offering memorandum." });
    }
    // For an acquisition the "space" is what the listing sells, so its SF drives the size fit.
    if (sale.availableSf) {
      propFacts.spaceSf = { value: sale.availableSf, evidenceId: add({ id: `ev_p${pid}_sale_sf`, kind: "verified_fact", statement: `The sale listing offers ${fmt(sale.availableSf)} SF`, value: sale.availableSf, unit: "SF", sources: L("totalAvailableSquareFeet") }) };
    }
    if (sale.askingCapRatePct !== null) {
      propFacts.askingCapRatePct = { value: sale.askingCapRatePct, evidenceId: add({ id: `ev_p${pid}_sale_cap`, kind: "verified_fact", statement: `The listing states an asking cap rate of ${sale.askingCapRatePct}% (the seller's figure, not an underwritten return)`, value: sale.askingCapRatePct, unit: "%", sources: L("capitalizationRate") }) };
    }
    if (sale.netOperatingIncomeUsd !== null) {
      add({ id: `ev_p${pid}_sale_noi`, kind: "verified_fact", statement: `The listing states net operating income of $${fmt(sale.netOperatingIncomeUsd)}/yr (as stated by the seller)`, value: sale.netOperatingIncomeUsd, unit: "USD/yr", sources: L("netOperatingIncome") });
    }
  }
  facts[prop] = propFacts;

  /* tenants */
  const named = tenants.filter((t) => t.name);
  if (tenants.length > 0) {
    add({
      id: `ev_p${pid}_tenants`,
      kind: "verified_fact",
      statement: `${tenants.length} current tenant${tenants.length === 1 ? "" : "s"} recorded${named.length ? `: ${named.slice(0, 8).map((t) => `${t.name}${t.suite ? ` (suite ${t.suite})` : ""}`).join(", ")}` : ""}`,
      value: tenants.length,
      sources: costar("location-occupancy", pid, "tenants"),
    });
  }
  const byUse: MarketContext["byUse"] = {};
  for (const use of USE_CATEGORIES) {
    const names = sameCategoryTenants(tenants, use);
    if (names.length === 0) continue;
    const id = add({ id: `ev_p${pid}_same_${use}`, kind: "verified_fact", statement: `Already in the building, same category as ${USES[use].label.toLowerCase()}: ${names.join(", ")}`, value: names.length, sources: costar("location-occupancy", pid, "tenantName") });
    byUse[use] = { sameCategoryInBuilding: { value: { count: names.length, names }, evidenceId: id } };
  }

  /* spaces */
  const wanted = spaceId ? spaces.filter((s) => s.id === spaceId) : spaces.slice(0, MAX_SPACES_PER_PROFILE);
  if (spaceId && wanted.length === 0) {
    add({ id: `ev_s${spaceId}_missing`, kind: "missing", statement: `Space ${spaceId} is not an advertised space at this property in the CoStar kit`, whyNeeded: "Space facts (size, rent, floor) come from the listing.", howToResolve: "Pick one of the property's advertised spaces." });
  }
  for (const s of wanted) {
    const subject = subjectKey(pid, s.id);
    const L = "commercial-listing-summary";
    const label = spaceLabel(s);
    const f: SiteFacts = {};
    add({ id: `ev_s${s.id}_status`, kind: "verified_fact", statement: `${label} (${s.spaceUse}) is ${s.availabilityStatus === "lease_pending" ? "lease pending" : "advertised as available"}; advertised availability is not confirmed vacancy`, value: s.availabilityStatus, sources: costar(L, s.id, "availabilityStatus") });
    const sf = s.sfMax ?? s.sfMin;
    if (sf) f.spaceSf = { value: sf, evidenceId: add({ id: `ev_s${s.id}_sf`, kind: "verified_fact", statement: `${label} is advertised at ${s.sfMin && s.sfMax && s.sfMin !== s.sfMax ? `${fmt(s.sfMin)}–${fmt(s.sfMax)}` : fmt(sf)} SF`, value: sf, unit: "SF", sources: costar(L, s.id, "squareFeetMax") }) };
    const rent = s.askingRent.psfYearLow;
    if (rent !== null) {
      f.askingRentPsfYear = { value: rent, evidenceId: add({ id: `ev_s${s.id}_rent`, kind: "verified_fact", statement: `${label} asking rent is $${fmt(rent)}/SF/yr${s.askingRent.psfYearHigh && s.askingRent.psfYearHigh !== rent ? `–$${fmt(s.askingRent.psfYearHigh)}` : ""}${s.askingRent.serviceType ? ` ${s.askingRent.serviceType}` : ""} (advertised, not achieved)`, value: rent, unit: "$/SF/yr", sources: costar(L, s.id, "rateLow") }) };
    } else {
      add({ id: `ev_s${s.id}_rent_missing`, kind: "missing", statement: `${label} does not publish an asking rent`, whyNeeded: "Rent is needed to judge affordability and run a lease scenario.", howToResolve: "Ask the listing broker for the asking rent and lease type." });
    }
    if (s.askingRent.serviceType) f.serviceType = { value: s.askingRent.serviceType, evidenceId: add({ id: `ev_s${s.id}_service`, kind: "verified_fact", statement: `${label} is quoted on a ${s.askingRent.serviceType} basis`, value: s.askingRent.serviceType, sources: costar(L, s.id, "serviceType") }) };
    const ground = groundFloorOf(s.floor);
    if (ground !== null) f.isGroundFloor = { value: ground, evidenceId: add({ id: `ev_s${s.id}_floor`, kind: "verified_fact", statement: `${label} is on the ${s.floor === "Ground" ? "ground floor" : s.floor!.replace(/Floor$/, " floor").toLowerCase()}`, value: ground, sources: costar(L, s.id, "floor") }) };
    facts[subject] = f;
    if (Object.keys(byUse).length) market[subject] = { byUse };
  }
  if (Object.keys(byUse).length) market[prop] = { byUse };

  return {
    summary: `${where}: ${humanize(property.propertyType)}, ${spaces.length} advertised space${spaces.length === 1 ? "" : "s"}, ${tenants.length} tenant${tenants.length === 1 ? "" : "s"}`,
    evidence,
    facts,
    market,
    data: {
      propertyId: pid,
      subject: prop,
      matterportModelIds: property.matterportModelIds,
      forSale: sale ? { askingPriceUsd: sale.askingPriceLowUsd, askingCapRatePct: sale.askingCapRatePct, netOperatingIncomeUsd: sale.netOperatingIncomeUsd, availableSf: sale.availableSf, status: sale.saleStatus } : null,
      spaces: spaces.slice(0, MAX_SPACES_PER_PROFILE).map((s) => ({
        spaceId: s.id,
        subject: subjectKey(pid, s.id),
        suite: s.suite,
        floor: s.floor,
        use: s.spaceUse,
        sf: s.sfMax ?? s.sfMin,
        rentPsfYear: s.askingRent.psfYearLow,
        serviceType: s.askingRent.serviceType,
        has3dScan: !!s.matterport,
      })),
    },
  };
}

/* ------------------------------------------------------------------ deps */

export function liveDataDeps(m: DataModules, opts: LiveDepsOptions): DataDeps {
  const loadProperty = async (propertyId: number) => {
    const property = await m.getProperty(propertyId);
    if (!property) throw new Error(`Property ${propertyId} is not in the CoStar kit.`);
    return property;
  };

  const vision = visionDeps(
    {
      async interiorImages({ propertyId, spaceId }) {
        const property = await loadProperty(propertyId);
        const found = modelFor(property, await m.getSpaces(propertyId), spaceId);
        if (!found) throw new ToolUnavailableError(spaceId ? `No Matterport scan is linked to space ${spaceId}.` : `No Matterport scan is linked to property ${propertyId}.`);
        // Eight photos (the vision limit) so a scan with some furnished rooms still yields bare ones.
        const assets = await m.getModelImages(found.modelId, 8);
        if (assets.length === 0) throw new ToolUnavailableError(`Matterport scan ${found.modelId} returned no photos.`);
        const images = await Promise.all(
          assets.map(async (a): Promise<VisionImage> => ({ data: await m.download(a.url), source: a.source, kind: a.kind, mediaRef: found.modelId })),
        );
        return images;
      },
      async exteriorImages({ propertyId }) {
        const property = await loadProperty(propertyId);
        const { lat, lon } = property.location;
        const views = [
          { kind: "ortho" as const, direction: null, label: "top-down (ortho)" },
          { kind: "oblique" as const, direction: "north" as const, label: "oblique, looking north" },
        ];
        const fetched = await Promise.all(views.map((v) => m.fetchVexcelImage({ lat, lon, kind: v.kind, direction: v.direction })));
        return fetched.map((img, i): VisionImage => ({
          data: img.bytes,
          kind: views[i].kind === "ortho" ? "aerial_ortho" : "aerial_oblique",
          label: views[i].label,
          source: { system: "vexcel", dataset: views[i].kind === "ortho" ? "ortho/extract" : "oriented/extract", recordId: img.xmp?.collection ?? "unknown", capturedAt: img.xmp?.firstCaptureDate ?? undefined, retrievedAt: now() },
          mediaRef: `/api/imagery/vexcel/${views[i].kind}?propertyId=${propertyId}${views[i].direction ? `&direction=${views[i].direction}` : ""}`,
        }));
      },
    },
    { createMessage: opts.createMessage, model: opts.visionModel },
  );

  return {
    async searchProperties({ query, market, hasAvailableSpace, forSale, maxAskingPriceUsd, limit }) {
      if (forSale) {
        const s = await m.searchSaleListings({ market: market as SaleListingQuery["market"], maxAskingPriceUsd, limit: limit ?? 10 });
        return {
          summary: `${s.total} commercial listing${s.total === 1 ? "" : "s"} for sale${maxAskingPriceUsd ? ` at or under $${fmt(maxAskingPriceUsd)}` : ""}; showing ${s.items.length}`,
          evidence: s.items.map((l) => ({
            id: `ev_sale_${l.listingId}`,
            kind: "verified_fact" as const,
            statement: `${[l.street, l.city].filter(Boolean).join(", ")} (${humanize(l.propertyType)}) is listed for sale${l.askingPriceLowUsd !== null ? ` at $${fmt(l.askingPriceLowUsd)}` : " with no disclosed price"}${l.askingCapRatePct !== null ? `, asking cap rate ${l.askingCapRatePct}%` : ""}${l.availableSf ? `, ${fmt(l.availableSf)} SF` : ""} (asking figures, not a valuation)`,
            value: l.askingPriceLowUsd,
            sources: [l.source],
          })),
          data: s.items.map((l) => ({
            propertyId: l.propertyId,
            subject: subjectKey(l.propertyId),
            street: l.street,
            type: l.propertyType,
            askingPriceUsd: l.askingPriceLowUsd,
            askingCapRatePct: l.askingCapRatePct,
            netOperatingIncomeUsd: l.netOperatingIncomeUsd,
            availableSf: l.availableSf,
            status: l.saleStatus,
          })),
        };
      }
      const r = await m.searchProperties({ q: query, market: market as PropertySearchQuery["market"], hasAvailableSpace, includeMultifamily: false, limit: limit ?? 10, offset: 0 });
      return {
        summary: `${r.total} commercial propert${r.total === 1 ? "y" : "ies"} match; showing ${r.items.length}`,
        evidence: r.items.map((p) => ({
          id: `ev_search_p${p.id}`,
          kind: "verified_fact" as const,
          statement: `${[p.address.street, p.address.city].filter(Boolean).join(", ")} (${p.propertyType}${p.rentableAreaSf ? `, ${fmt(p.rentableAreaSf)} SF` : ""}) is in the CoStar kit`,
          value: p.id,
          sources: costar("commercial-property", p.id, "id"),
        })),
        data: r.items.map((p) => ({
          propertyId: p.id,
          name: p.name,
          street: p.address.street,
          city: p.address.city,
          type: p.propertyType,
          rentableAreaSf: p.rentableAreaSf,
          advertisedSpaces: p.availableSpaceCount,
          has3dScan: p.hasSuiteMatched3d,
        })),
      };
    },

    async searchAvailableSpaces({ market, sfMin, sfMax, maxRentPsfYear, spaceUses, limit }) {
      const max = limit ?? 10;
      const hits: { property: { id: number; street: string | null; city: string }; space: AvailableSpace }[] = [];
      let scanned = 0;
      for (let offset = 0; offset < MAX_SEARCH_PROPERTIES; offset += 100) {
        const page = await m.searchProperties({ market: market as PropertySearchQuery["market"], hasAvailableSpace: true, includeMultifamily: false, limit: 100, offset });
        for (const p of page.items) {
          scanned++;
          for (const s of await m.getSpaces(p.id)) {
            const sf = s.sfMax ?? s.sfMin;
            if (spaceUses?.length && !spaceUses.includes(s.spaceUse)) continue;
            if (sfMin && (sf === null || sf < sfMin)) continue;
            if (sfMax && (s.sfMin ?? sf) !== null && (s.sfMin ?? sf)! > sfMax) continue;
            if (maxRentPsfYear && s.askingRent.psfYearLow !== null && s.askingRent.psfYearLow > maxRentPsfYear) continue;
            hits.push({ property: { id: p.id, street: p.address.street, city: p.address.city }, space: s });
          }
        }
        if (offset + 100 >= page.total) break;
      }
      // Spaces with a 3D scan and a published rent first: they can be evaluated most fully.
      hits.sort((a, b) => Number(!!b.space.matterport) - Number(!!a.space.matterport) || Number(b.space.askingRent.psfYearLow !== null) - Number(a.space.askingRent.psfYearLow !== null));
      const shown = hits.slice(0, max);
      return {
        summary: `${hits.length} advertised space${hits.length === 1 ? "" : "s"} match across ${scanned} properties; showing ${shown.length}`,
        evidence: shown.map(({ property, space }) => ({
          id: `ev_search_s${space.id}`,
          kind: "verified_fact" as const,
          statement: `${spaceLabel(space)} at ${[property.street, property.city].filter(Boolean).join(", ")}: ${space.spaceUse}, ${sfText(space)}, ${space.askingRent.psfYearLow !== null ? `$${fmt(space.askingRent.psfYearLow)}/SF/yr ${space.askingRent.serviceType ?? ""}`.trim() : "no published rent"} (advertised availability, not confirmed vacancy)`,
          value: space.id,
          sources: costar("commercial-listing-summary", space.id, "id"),
        })),
        data: shown.map(({ property, space }) => ({
          propertyId: property.id,
          spaceId: space.id,
          subject: subjectKey(property.id, space.id),
          street: property.street,
          suite: space.suite,
          use: space.spaceUse,
          sfMin: space.sfMin,
          sfMax: space.sfMax,
          rentPsfYear: space.askingRent.psfYearLow,
          serviceType: space.askingRent.serviceType,
          has3dScan: !!space.matterport,
        })),
      };
    },

    async getPropertyProfile({ propertyId, spaceId }) {
      const property = await loadProperty(propertyId);
      const [spaces, tenants, sale] = await Promise.all([m.getSpaces(propertyId), m.getCurrentTenants(propertyId), m.getSaleListings(propertyId)]);
      return profileOutput(property, spaces, tenants, spaceId, sale);
    },

    getNearbyContext: nearbyContextDep({
      getNearbyContext: m.getNearbyContext,
      async getSpaceBasis(propertyId, spaceId) {
        const s = (await m.getSpaces(propertyId)).find((x) => x.id === spaceId);
        return s ? { serviceType: s.askingRent.serviceType, spaceUse: s.spaceUse } : null;
      },
    }),

    async getMatterportModel({ propertyId, spaceId }) {
      const property = await loadProperty(propertyId);
      const found = modelFor(property, await m.getSpaces(propertyId), spaceId);
      if (!found) throw new ToolUnavailableError(spaceId ? `No Matterport scan is linked to space ${spaceId}.` : `No Matterport scan is linked to property ${propertyId}.`);
      const model = await m.getMatterportModel(found.modelId, found.link);
      if (!model) throw new ToolUnavailableError(`Matterport scan ${found.modelId} is not available to this account.`);
      const roomTypes = [...new Set(model.rooms.map((r) => r.classification).filter((l): l is string => !!l && l !== "Void" && l !== "Other"))];
      const media = [{ type: "matterport_model" as const, ref: model.id, caption: model.costarCaption ?? model.name }];
      const src: SourceRef[] = [{ system: "matterport", dataset: "model", recordId: model.id, field: "dimensions.areaFloor", retrievedAt: now() }];
      const evidence: EvidenceDraft[] = [
        { id: `ev_mp_${model.id}_link`, kind: "verified_fact", statement: `Matterport scan ${model.id} ${model.matchedSuite ? `is linked to advertised suite ${model.matchedSuite}` : "covers this building (not matched to an advertised suite)"}${model.costarCaption ? `, captioned "${model.costarCaption}"` : ""}`, value: model.id, media, sources: [{ ...src[0], field: "id" }] },
      ];
      if (model.scannedAreaSf) evidence.push({ id: `ev_mp_${model.id}_area`, kind: "verified_fact", statement: `The scan measures ${fmt(Math.round(model.scannedAreaSf))} SF of floor (scanned area, not leasable area)`, value: Math.round(model.scannedAreaSf), unit: "SF", media, sources: src });
      evidence.push({ id: `ev_mp_${model.id}_rooms`, kind: "verified_fact", statement: `The scan has ${model.rooms.length} rooms on ${model.floors.length} floor${model.floors.length === 1 ? "" : "s"}${roomTypes.length ? `, labelled by Matterport as: ${roomTypes.slice(0, 8).join(", ")}` : ""}`, value: model.rooms.length, media, sources: [{ ...src[0], field: "rooms" }] });
      return {
        summary: `Scan ${model.id}${model.matchedSuite ? ` (suite ${model.matchedSuite})` : ""}: ${model.scannedAreaSf ? `${fmt(Math.round(model.scannedAreaSf))} SF scanned, ` : ""}${model.rooms.length} rooms, ${model.photoCount} photos`,
        evidence,
        data: { modelId: model.id, matchedSuite: model.matchedSuite, photoCount: model.photoCount, floorplanFormats: model.floorplanFormats },
      };
    },

    analyzeInterior: vision.analyzeInterior,

    async getAerialImagery({ propertyId }) {
      const property = await loadProperty(propertyId);
      const { lat, lon } = property.location;
      const images = await Promise.all([
        m.getAerialImagery(propertyId, lat, lon, "ortho", null),
        m.getAerialImagery(propertyId, lat, lon, "oblique", "north"),
      ]);
      return {
        summary: images.map((a) => `${a.kind}${a.direction ? `-${a.direction}` : ""} ${a.collection}`).join(", "),
        evidence: images.map((a) => ({
          id: `ev_vx_${propertyId}_${a.kind}${a.direction ? `_${a.direction}` : ""}`,
          kind: "verified_fact" as const,
          statement: `Vexcel ${a.kind === "ortho" ? "top-down" : `oblique (looking ${a.direction})`} image from collection ${a.collection}${a.captureDate.first ? `, captured ${a.captureDate.first.slice(0, 10)}${a.captureDate.last && a.captureDate.last !== a.captureDate.first ? ` to ${a.captureDate.last.slice(0, 10)}` : ""}` : ""}. ${a.attribution}`,
          value: a.collection,
          media: [{ type: "aerial" as const, ref: a.imageUrl, caption: a.attribution }],
          sources: [a.source],
        })),
        data: images.map((a) => ({ kind: a.kind, direction: a.direction, collection: a.collection, captured: a.captureDate, gsdMeters: a.gsdMeters })),
      };
    },

    analyzeExterior: vision.analyzeExterior,
  };
}
