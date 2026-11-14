/**
 * Property search and lookup over the imported CoStar kit (DATA-02, DATA-03).
 * OWNER: Developer 2.
 *
 * Reads the DuckDB built by `npm run db:build`. Returns contract types only — callers never
 * see raw column names. Availability is always ADVERTISED, never confirmed vacancy.
 */
import "server-only";
import { z } from "zod";
import { PropertySearchQuery, RESEARCH_MARKET_IDS, type PropertySummary } from "@/lib/contracts";
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
    .map((token) => token.replace(/[\%_]/g, (char) => `\${char}`));
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
