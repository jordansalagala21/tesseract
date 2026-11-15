/**
 * Properties listed for sale (INT-05). OWNER: Developer 2. Written by Developer 1 on the lead's
 * call while DATA was unavailable; reads only the `sale_listings` table DATA-01 already builds.
 *
 * Rules, matching the rest of lib/data:
 *  - An asking price of 0 means "not disclosed" (CoStar convention), never free: it becomes null.
 *  - Cap rate is an ASKING cap rate as the listing states it, in percent (4.6 = 4.6%). It is
 *    the seller's figure, not an underwritten return.
 *  - Listings under contract or in escrow are not available to buy, so they are excluded unless
 *    asked for, and every result carries its status.
 *  - Multifamily is excluded by default, like property search: Tesseract is about commercial space.
 */
import "server-only";
import { RESEARCH_MARKET_IDS, type Market, type SourceRef } from "@/lib/contracts";
import { queryRows } from "./duckdb";

export interface SaleListing {
  listingId: number;
  propertyId: number;
  name: string | null;
  street: string | null;
  city: string | null;
  market: Market | null;
  propertyType: string;
  /** Null when the listing does not disclose a price. */
  askingPriceLowUsd: number | null;
  askingPriceHighUsd: number | null;
  /** The listing's own asking cap rate, in percent. */
  askingCapRatePct: number | null;
  /** The listing's stated net operating income, $/yr. */
  netOperatingIncomeUsd: number | null;
  /** Square feet the listing offers (may be part of a building). */
  availableSf: number | null;
  saleStatus: string | null;
  saleType: string | null;
  source: SourceRef;
}

export interface SaleListingQuery {
  market?: Market;
  /** Only listings with a disclosed asking price at or below this. */
  maxAskingPriceUsd?: number;
  includeMultifamily?: boolean;
  /** Also return listings under contract or in escrow (default false). */
  includeUnavailable?: boolean;
  limit?: number;
}

interface Row {
  listing_id: number;
  property_id: number;
  name: string | null;
  street: string | null;
  city: string | null;
  research_market_id: number | null;
  property_type: string | null;
  asking_price_low: number | null;
  asking_price_high: number | null;
  capitalization_rate: number | null;
  net_operating_income: number | null;
  total_available_sf: number | null;
  sale_status: string | null;
  sale_type: string | null;
}

const MARKET_BY_ID = new Map<number, Market>(Object.entries(RESEARCH_MARKET_IDS).map(([m, id]) => [id, m as Market]));
/** CoStar uses 0 for "not stated". */
const stated = (n: number | null) => (n === null || n === 0 ? null : n);
const UNAVAILABLE = ["UnderContract", "Escrow", "Sold", "OffMarket"];

const SELECT = `
  SELECT s.listing_id, s.property_id, p.name, p.street, p.city, p.research_market_id, p.property_type,
         s.asking_price_low, s.asking_price_high, s.capitalization_rate, s.net_operating_income,
         s.total_available_sf::DOUBLE AS total_available_sf, s.sale_status, s.sale_type
  FROM sale_listings s JOIN properties p ON p.id = s.property_id`;

function toListing(r: Row): SaleListing {
  const low = stated(r.asking_price_low);
  return {
    listingId: r.listing_id,
    propertyId: r.property_id,
    name: r.name,
    street: r.street,
    city: r.city,
    market: r.research_market_id === null ? null : (MARKET_BY_ID.get(r.research_market_id) ?? null),
    propertyType: r.property_type ?? "Unknown",
    askingPriceLowUsd: low,
    askingPriceHighUsd: stated(r.asking_price_high) ?? low,
    askingCapRatePct: stated(r.capitalization_rate),
    netOperatingIncomeUsd: stated(r.net_operating_income),
    availableSf: stated(r.total_available_sf),
    saleStatus: r.sale_status,
    saleType: r.sale_type,
    source: { system: "costar", dataset: "commercial-listing-summary", recordId: String(r.listing_id), field: "forSaleSummary", retrievedAt: new Date().toISOString() },
  };
}

/** Listings for sale, priced ones first (cheapest first), then undisclosed prices. */
export async function searchSaleListings(q: SaleListingQuery = {}): Promise<{ items: SaleListing[]; total: number }> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (!q.includeMultifamily) where.push("NOT p.is_multifamily");
  if (!q.includeUnavailable) {
    where.push(`coalesce(s.sale_status, '') NOT IN (${UNAVAILABLE.map(() => "?").join(", ")})`);
    params.push(...UNAVAILABLE);
  }
  if (q.market) {
    where.push("p.research_market_id = ?");
    params.push(RESEARCH_MARKET_IDS[q.market]);
  }
  if (q.maxAskingPriceUsd !== undefined) {
    where.push("s.asking_price_low > 0 AND s.asking_price_low <= ?");
    params.push(q.maxAskingPriceUsd);
  }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [{ total }] = await queryRows<{ total: number }>(`SELECT count(*)::INT AS total FROM sale_listings s JOIN properties p ON p.id = s.property_id ${filter}`, params as never);
  const rows = await queryRows<Row>(
    `${SELECT} ${filter}
     ORDER BY (s.asking_price_low IS NULL OR s.asking_price_low = 0), s.asking_price_low, s.listing_id
     LIMIT ?`,
    [...params, Math.min(Math.max(q.limit ?? 20, 1), 100)] as never,
  );
  return { items: rows.map(toListing), total };
}

/** Every sale listing on one property (any status), newest listing id first. */
export async function getSaleListings(propertyId: number): Promise<SaleListing[]> {
  const rows = await queryRows<Row>(`${SELECT} WHERE s.property_id = ? ORDER BY s.listing_id DESC`, [propertyId] as never);
  return rows.map(toListing);
}
