/**
 * Property search and lookup over the imported CoStar kit (DATA-02, DATA-03).
 * OWNER: Developer 2.
 *
 * Reads the DuckDB built by `npm run db:build`. Returns contract types only — callers never
 * see raw column names. Availability is always ADVERTISED, never confirmed vacancy.
 */
import "server-only";
import { z } from "zod";
import {
  AvailableSpace as AvailableSpaceContract,
  Property as PropertyContract,
  PropertySearchQuery,
  RESEARCH_MARKET_IDS,
  type PropertySummary,
} from "@/lib/contracts";
import { queryRows } from "./duckdb";

// PropertySearchQuery is exported only as a schema, so the input type is inferred here.
// PropertySummary already ships as a type, so it is imported rather than re-derived.
export type PropertySearchQuery = z.infer<typeof PropertySearchQuery>;
export interface PropertySearchResult {
  items: PropertySummary[];
  total: number;
}

/** Row shape returned by the search SQL below. */
interface SummaryRow {
  id: number;
  name: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  lat: number;
  lon: number;
  research_market_id: number;
  property_type: string | null;
  building_class: string | null;
  rentable_area_sf: number | null;
  available_space_count: number;
  has_matterport: boolean;
  has_suite_matched_3d: boolean;
}

/**
 * Long form → the short form CoStar actually stores. Verified against the kit: `st` 764,
 * `ave` 682, `dr` 548, `blvd` 456, `rd` 380, `pky` 96, `ln` 69, `fwy` 56 — note `pky`, not
 * `pkwy`. One map drives both sides of the match, so they cannot drift apart.
 */
const SUFFIX_CANONICAL: Record<string, string> = {
  street: "st",
  avenue: "ave",
  boulevard: "blvd",
  drive: "dr",
  road: "rd",
  lane: "ln",
  parkway: "pky",
  freeway: "fwy",
  highway: "hwy",
  place: "pl",
  court: "ct",
  circle: "cir",
  trail: "trl",
  terrace: "ter",
  square: "sq",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
};

/**
 * The text a query is matched against: name, street, city, state and postcode, lower-cased,
 * with punctuation flattened and long suffix forms canonicalized.
 *
 * The canonicalization is word-bounded on purpose. "Broadway" contains "road", so an unbounded
 * replace would store it as "brdway" and lose every Broadway building.
 */
const SEARCH_HAYSTACK_SQL = Object.entries(SUFFIX_CANONICAL).reduce(
  (expr, [long, short]) => `regexp_replace(${expr}, '\b${long}\b', '${short}', 'g')`,
  "regexp_replace(lower(concat_ws(' ', name, street, city, state, postcode)), '[^a-z0-9]+', ' ', 'g')",
);

/**
 * Split a user's query into match tokens: lower-cased, punctuation dropped, suffixes
 * canonicalized, and `%`/`_`/`\` escaped so they are literal rather than wildcards.
 * Every token must match, so word order and extra words like the city do not matter.
 */
export function searchTokens(q: string): string[] {
  return q
    .toLowerCase()
    // Keep % and _ inside the token: they are escaped below so they match literally.
    // Stripping them instead would quietly turn "travis%" into a successful "travis" search.
    .replace(/[^a-z0-9%_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => SUFFIX_CANONICAL[token] ?? token)
    // A backslash cannot survive the step above, so only % and _ need escaping here.
    .map((token) => token.replace(/[%_]/g, (char) => "\\" + char));
}

const MARKET_BY_RESEARCH_ID = new Map<number, keyof typeof RESEARCH_MARKET_IDS>(
  Object.entries(RESEARCH_MARKET_IDS).map(([market, id]) => [id, market as keyof typeof RESEARCH_MARKET_IDS]),
);

/**
 * Per-property aggregates used by every search. Grouped once rather than as correlated
 * subqueries so the whole search stays a single scan over 3,339 rows.
 */
const AGGREGATES = `
  WITH space_counts AS (
    SELECT property_id, count(*)::INT AS available_space_count
    FROM spaces GROUP BY property_id
  ),
  model_flags AS (
    SELECT property_id,
           true AS has_matterport,
           -- A model matched to a suite that is actually advertised, which is what lets the UI
           -- promise a walkthrough of the space on offer.
           coalesce(bool_or(m.matched_suite IS NOT NULL AND EXISTS (
             SELECT 1 FROM spaces s WHERE s.property_id = m.property_id AND s.suite_norm = m.matched_suite
           )), false) AS has_suite_matched_3d
    FROM matterport_models m GROUP BY property_id
  ),
  base AS (
    SELECT p.*,
           coalesce(sc.available_space_count, 0) AS available_space_count,
           coalesce(mf.has_matterport, false)    AS has_matterport,
           coalesce(mf.has_suite_matched_3d, false) AS has_suite_matched_3d
    FROM properties p
    LEFT JOIN space_counts sc ON sc.property_id = p.id
    LEFT JOIN model_flags  mf ON mf.property_id = p.id
  )`;

/** Haversine distance in metres. DuckDB has no built-in, and this keeps it one expression. */
const HAVERSINE = `
  6371000 * 2 * asin(sqrt(
    pow(sin(radians(? - lat) / 2), 2) +
    cos(radians(lat)) * cos(radians(?)) * pow(sin(radians(? - lon) / 2), 2)
  ))`;

function toSummary(row: SummaryRow): PropertySummary {
  const market = MARKET_BY_RESEARCH_ID.get(row.research_market_id);
  if (!market) {
    // Every kit property is Houston (14) or LA (20); a new market would need a contract change.
    throw new Error(`Property ${row.id} has unmapped researchMarketId ${row.research_market_id}`);
  }
  return {
    id: row.id,
    name: row.name,
    address: {
      street: row.street ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
      postcode: row.postcode,
    },
    location: { lat: row.lat, lon: row.lon },
    market,
    propertyType: row.property_type ?? "Unknown",
    buildingClass: (row.building_class as PropertySummary["buildingClass"]) ?? null,
    rentableAreaSf: row.rentable_area_sf,
    availableSpaceCount: row.available_space_count,
    hasMatterport: row.has_matterport,
    hasSuiteMatched3d: row.has_suite_matched_3d,
  };
}

/**
 * Text search, filters and paging over the kit's commercial properties.
 * Multifamily is excluded unless `includeMultifamily` is set — 83% of the kit is apartments
 * and Tesseract is about commercial space.
 */
export async function searchProperties(query: PropertySearchQuery): Promise<PropertySearchResult> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (!query.includeMultifamily) where.push("NOT is_multifamily");

  if (query.market) {
    where.push("research_market_id = ?");
    params.push(RESEARCH_MARKET_IDS[query.market]);
  }
  if (query.propertyType) {
    where.push("property_type = ?");
    params.push(query.propertyType);
  }
  if (query.q) {
    // Every token must appear, in any order. Still fully parameterized, so a quote in the
    // search text is data and not SQL, and ESCAPE makes a typed % or _ literal.
    for (const token of searchTokens(query.q)) {
      where.push(`${SEARCH_HAYSTACK_SQL} ILIKE ? ESCAPE '\'`);
      params.push(`%${token}%`);
    }
  }
  if (query.hasAvailableSpace !== undefined) {
    where.push(query.hasAvailableSpace ? "available_space_count > 0" : "available_space_count = 0");
  }
  if (query.hasMatterport !== undefined) {
    where.push(query.hasMatterport ? "has_matterport" : "NOT has_matterport");
  }
  if (query.near) {
    const [lat, lon, radius] = query.near.split(",").map(Number);
    where.push(`${HAVERSINE} <= ?`);
    params.push(lat, lat, lon, radius);
  }

  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [{ total }] = await queryRows<{ total: number }>(
    `${AGGREGATES} SELECT count(*)::INT AS total FROM base ${filter}`,
    params as never,
  );
  if (total === 0) return { items: [], total: 0 };

  const rows = await queryRows<SummaryRow>(
    `${AGGREGATES}
     SELECT id, name, street, city, state, postcode, lat, lon, research_market_id,
            property_type, building_class, rentable_area_sf,
            available_space_count, has_matterport, has_suite_matched_3d
     FROM base ${filter}
     ORDER BY available_space_count DESC, id
     LIMIT ? OFFSET ?`,
    [...params, query.limit, query.offset] as never,
  );

  return { items: rows.map(toSummary), total };
}

/* -------------------------------------------------------------- DATA-03: detail */

export type Property = z.infer<typeof PropertyContract>;
export type AvailableSpace = z.infer<typeof AvailableSpaceContract>;

interface PropertyRow extends SummaryRow {
  property_subtype: string | null;
  building_rating: number | null;
  construction_status: string | null;
  gross_area_sf: number | null;
  stories: number | null;
  lot_value: number | null;
  lot_unit: string | null;
  zoning_description: string | null;
  year_built: number | null;
  year_renovated: number | null;
  parking_ratio_per_1000_sf: number | null;
  retail_gla_sf: number | null;
  retail_ceiling_height_ft: number | null;
  retail_frontage: { street: string | null; feet: number | null; curb_cuts: number | null; is_primary: boolean | null }[] | null;
  submarket_id: number | null;
  model_ids: string[] | null;
  current_tenant_count: number;
  sale_comp_count: number;
}

/** Full profile for one property. Returns null when the id is not in the kit. */
export async function getProperty(id: number): Promise<Property | null> {
  const rows = await queryRows<PropertyRow>(
    `${AGGREGATES},
     detail AS (
       SELECT b.*,
         (SELECT count(*)::INT FROM tenants_current t WHERE t.property_id = b.id) AS current_tenant_count,
         (SELECT count(*)::INT FROM comps c WHERE c.property_id = b.id)           AS sale_comp_count,
         (SELECT list(DISTINCT m.model_id) FROM matterport_models m WHERE m.property_id = b.id) AS model_ids
       FROM base b WHERE b.id = ?
     )
     SELECT * FROM detail`,
    [id] as never,
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const summary = toSummary(row);

  return {
    ...summary,
    researchMarketId: row.research_market_id,
    submarketId: row.submarket_id,
    propertySubtype: row.property_subtype,
    buildingRating: row.building_rating,
    constructionStatus: row.construction_status ?? "Unknown",
    grossAreaSf: row.gross_area_sf,
    stories: row.stories,
    lot:
      row.lot_value !== null && (row.lot_unit === "acres" || row.lot_unit === "sqft")
        ? { value: row.lot_value, unit: row.lot_unit }
        : null,
    zoningDescription: row.zoning_description,
    yearBuilt: row.year_built,
    yearRenovated: row.year_renovated,
    parkingRatioPer1000Sf: row.parking_ratio_per_1000_sf,
    retail:
      row.retail_gla_sf !== null || row.retail_ceiling_height_ft !== null
        ? {
            glaSf: row.retail_gla_sf,
            ceilingHeightFt: row.retail_ceiling_height_ft,
            frontage: (row.retail_frontage ?? []).map((f) => ({
              street: f.street ?? "",
              feet: f.feet,
              curbCuts: f.curb_cuts,
              isPrimary: f.is_primary,
            })),
          }
        : null,
    matterportModelIds: row.model_ids ?? [],
    counts: {
      availableSpaces: row.available_space_count,
      currentTenants: row.current_tenant_count,
      saleComps: row.sale_comp_count,
    },
    source: {
      system: "costar",
      dataset: "commercial-property",
      recordId: String(row.id),
      retrievedAt: new Date().toISOString(),
    },
  };
}

interface SpaceRow {
  id: number;
  listing_id: number;
  property_id: number;
  listing_type: string | null;
  suite: string | null;
  floor: string | null;
  space_use: string | null;
  space_type: string | null;
  sf_min: number | null;
  sf_max: number | null;
  rate_low: number | null;
  rate_high: number | null;
  rate_basis: string;
  psf_year_low: number | null;
  psf_year_high: number | null;
  service_type: string | null;
  availability_status: string;
  available_on: string | null;
  on_market_date: string | null;
  model_id: string | null;
  model_caption: string | null;
  link_method: "space_floorplan_videokey" | "caption_suite_match" | null;
}

/**
 * Advertised spaces at a property. ADVERTISED AVAILABILITY, never confirmed vacancy.
 *
 * Matterport links come from two signals, and #53 lets us report both:
 *   - `space_floorplan_videokey` — the space's own floorPlan names the model. Unambiguous, so
 *     it wins when both signals exist. 20 spaces kit-wide.
 *   - `caption_suite_match` — a property attachment caption names this suite. A text heuristic.
 * Together they cover 125 spaces; caption alone covered 112. Where both exist they never
 * disagree about the model (0 conflicts kit-wide), so precedence is about reporting provenance
 * honestly rather than resolving a dispute.
 *
 * The caption shown prefers the suite-naming attachment text ("Suite 100 - 9,889SF") over the
 * space's generic floorPlan caption ("View the Floor Plan"), because that is what a person
 * reads; `linkMethod` still records how the link was actually established.
 *
 * One row per space is guaranteed. A property can hold two scans captioned for the same suite
 * (space 21903500 / suite 1950 has two), which a plain join would return as a duplicate space.
 */
export async function getSpaces(propertyId: number): Promise<AvailableSpace[]> {
  const rows = await queryRows<SpaceRow>(
    // DuckDB DATE comes back as a JS Date; the contract's IsoDate wants YYYY-MM-DD.
    `SELECT s.* EXCLUDE (available_on, on_market_date),
            s.available_on::VARCHAR   AS available_on,
            s.on_market_date::VARCHAR AS on_market_date,
            coalesce(s.floor_plan_video_key, m.model_id)                 AS model_id,
            coalesce(m.caption, s.floor_plan_caption)                    AS model_caption,
            CASE
              WHEN s.floor_plan_video_key IS NOT NULL THEN 'space_floorplan_videokey'
              WHEN m.model_id IS NOT NULL             THEN 'caption_suite_match'
            END                                                          AS link_method
     FROM spaces s
     LEFT JOIN matterport_models m
       ON m.property_id = s.property_id
      AND m.matched_suite = s.suite_norm
      AND m.link_method = 'caption_suite_match'
     WHERE s.property_id = ?
     QUALIFY row_number() OVER (PARTITION BY s.id ORDER BY m.model_id NULLS LAST) = 1
     ORDER BY s.suite NULLS LAST, s.id`,
    [propertyId] as never,
  );

  return rows.map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    propertyId: row.property_id,
    listingType: row.listing_type ?? "Unknown",
    suite: row.suite,
    floor: row.floor,
    spaceUse: row.space_use ?? "Unknown",
    spaceType: row.space_type,
    sfMin: row.sf_min,
    sfMax: row.sf_max,
    askingRent: {
      low: row.rate_low,
      high: row.rate_high,
      basis: row.rate_basis as "monthly" | "yearly" | "unknown",
      psfYearLow: row.psf_year_low,
      psfYearHigh: row.psf_year_high,
      serviceType: row.service_type,
    },
    availabilityStatus: row.availability_status as "advertised_available" | "lease_pending",
    availableOn: row.available_on,
    onMarketDate: row.on_market_date,
    // CoStar's CDN rejects server-side requests, so the UI goes through our own proxy route.
    floorPlanImageUrl: null,
    matterport:
      row.model_id && row.link_method
        ? { modelId: row.model_id, linkMethod: row.link_method, caption: row.model_caption ?? "" }
        : null,
    source: {
      system: "costar",
      dataset: "commercial-listing-summary",
      recordId: String(row.id),
      retrievedAt: new Date().toISOString(),
    },
  }));
}
