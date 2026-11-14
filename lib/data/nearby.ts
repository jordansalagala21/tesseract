/**
 * Nearby context for a property: what else the kit knows within a radius (DATA-07).
 * OWNER: Developer 2. Feeds AI-04's market feasibility (lib/market, Dev 1).
 *
 * This is NOT a market census. It is "what the CoStar hackathon kit holds near this building",
 * which for Houston and LA is roughly 3,339 properties in total. Every figure here is a count
 * over that sample, and every count is returned so the caller can say how thin the evidence is
 * rather than implying a market statistic. Nothing is extrapolated.
 */
import "server-only";
import { queryRows } from "./duckdb";

/**
 * Haversine distance in metres between a bound point and each row's lat/lon.
 * Parameters bind in order: lat, lat, lon. DuckDB has no built-in geodesic distance and the
 * spatial extension is more than this needs.
 */
export const DISTANCE_METERS_SQL = `
  6371000 * 2 * asin(sqrt(
    pow(sin(radians(lat - ?) / 2), 2) +
    cos(radians(?)) * cos(radians(lat)) * pow(sin(radians(lon - ?) / 2), 2)
  ))`;

export interface NumericRange {
  min: number | null;
  median: number | null;
  max: number | null;
}

export interface RentGroup {
  serviceType: string;
  spaceUse: string;
  count: number;
  withPublishedRate: number;
  askingRentPsfYear: NumericRange;
}

export interface NearbyContext {
  propertyId: number;
  radiusMeters: number;
  /** Sample size: kit properties within the radius, excluding the subject. */
  propertiesInRadius: number;
  propertyIds: number[];
  comparableSpaces: {
    count: number;
    /** Of those, how many published a rate — the denominator behind every range below. */
    withPublishedRate: number;
    /**
     * Overall range across all comparable spaces, kept for the MarketAnalysis contract.
     * It MIXES space uses, so do not compare a subject's retail rent against it — use the
     * matching entry in `rentGroups` instead.
     */
    askingRentPsfYear: NumericRange;
    /**
     * Rent by serviceType x spaceUse. A TripleNet retail rent and a FullService office rent
     * are not comparable (CLAUDE.md §6.6), and near 2600 Travis the blended median is mostly
     * office, which would understate retail by more than half.
     */
    rentGroups: RentGroup[];
    serviceTypes: { serviceType: string; count: number }[];
    spaceUses: { spaceUse: string; count: number }[];
    /** The non-multifamily properties these spaces came from. */
    propertyIds: number[];
  };
  nearbyTenants: {
    count: number;
    byIndustry: { industry: string; count: number }[];
  };
  saleComps: {
    count: number;
    withDisclosedPrice: number;
  };
}

const EMPTY_RANGE: NumericRange = { min: null, median: null, max: null };

function emptyContext(propertyId: number, radiusMeters: number): NearbyContext {
  return {
    propertyId,
    radiusMeters,
    propertiesInRadius: 0,
    propertyIds: [],
    comparableSpaces: {
      count: 0,
      withPublishedRate: 0,
      askingRentPsfYear: EMPTY_RANGE,
      rentGroups: [],
      serviceTypes: [],
      spaceUses: [],
      propertyIds: [],
    },
    nearbyTenants: { count: 0, byIndustry: [] },
    saleComps: { count: 0, withDisclosedPrice: 0 },
  };
}

/**
 * Everything the kit knows within `radiusMeters` of a property, excluding the property itself.
 * An unknown subject id, or a radius that catches nothing, returns zeroed counts and null
 * ranges — never a fabricated figure.
 */
export async function getNearbyContext(
  propertyId: number,
  radiusMeters: number,
): Promise<NearbyContext> {
  const subject = await queryRows<{ lat: number; lon: number }>(
    "SELECT lat, lon FROM properties WHERE id = ?",
    [propertyId] as never,
  );
  if (subject.length === 0) return emptyContext(propertyId, radiusMeters);
  const { lat, lon } = subject[0];
  const geo = [lat, lat, lon];

  const neighbours = await queryRows<{ id: number }>(
    `SELECT id FROM properties
     WHERE id != ? AND ${DISTANCE_METERS_SQL} <= ?
     ORDER BY id`,
    [propertyId, ...geo, radiusMeters] as never,
  );
  if (neighbours.length === 0) return emptyContext(propertyId, radiusMeters);
  const propertyIds = neighbours.map((r) => r.id);
  const idList = propertyIds.join(",");

  // Comparable spaces come from NON-MULTIFAMILY properties only: 83% of the kit is apartments,
  // and an apartment asking rent is not a comparable for commercial space.
  const COMPARABLE = `FROM spaces s
     JOIN properties p ON p.id = s.property_id
     WHERE NOT p.is_multifamily AND s.property_id IN (${idList})`;

  // One rate basis throughout: psf_year_low for min, median AND max, so the three numbers
  // describe the same thing. Mixing low for min/median with high for max did not.
  const [spaceStats] = await queryRows<{
    count: number;
    with_rate: number;
    min: number | null;
    median: number | null;
    max: number | null;
  }>(
    `SELECT count(*)::INT AS count,
            count(s.psf_year_low)::INT AS with_rate,
            min(s.psf_year_low) AS min,
            median(s.psf_year_low) AS median,
            max(s.psf_year_low) AS max
     ${COMPARABLE}`,
  );

  const comparablePropertyIds = (
    await queryRows<{ property_id: number }>(
      `SELECT DISTINCT s.property_id ${COMPARABLE} ORDER BY s.property_id`,
    )
  ).map((row) => row.property_id);

  interface GroupRow {
    serviceType: string;
    spaceUse: string;
    count: number;
    with_rate: number;
    min: number | null;
    median: number | null;
    max: number | null;
  }
  const groupRows = await queryRows<GroupRow>(
    `SELECT coalesce(s.service_type, 'Unknown') AS "serviceType",
            coalesce(s.space_use, 'Unknown')    AS "spaceUse",
            count(*)::INT AS count,
            count(s.psf_year_low)::INT AS with_rate,
            min(s.psf_year_low) AS min,
            median(s.psf_year_low) AS median,
            max(s.psf_year_low) AS max
     ${COMPARABLE}
     GROUP BY 1, 2
     ORDER BY count DESC, 1, 2`,
  );
  const rentGroups: RentGroup[] = groupRows.map((row) => ({
    serviceType: row.serviceType,
    spaceUse: row.spaceUse,
    count: row.count,
    withPublishedRate: row.with_rate,
    askingRentPsfYear:
      row.with_rate > 0 ? { min: row.min, median: row.median, max: row.max } : EMPTY_RANGE,
  }));

  // Service type and space use are coalesced rather than dropped, so the breakdowns always
  // add up to `count` and no space goes silently missing from the evidence.
  const serviceTypes = await queryRows<{ serviceType: string; count: number }>(
    `SELECT coalesce(s.service_type, 'Unknown') AS "serviceType", count(*)::INT AS count
     ${COMPARABLE} GROUP BY 1 ORDER BY count DESC, 1`,
  );
  const spaceUses = await queryRows<{ spaceUse: string; count: number }>(
    `SELECT coalesce(s.space_use, 'Unknown') AS "spaceUse", count(*)::INT AS count
     ${COMPARABLE} GROUP BY 1 ORDER BY count DESC, 1`,
  );
  const byIndustry = await queryRows<{ industry: string; count: number }>(
    `SELECT coalesce(industry_type, 'Unknown') AS industry, count(*)::INT AS count
     FROM tenants_current WHERE property_id IN (${idList})
     GROUP BY 1 ORDER BY count DESC, 1`,
  );
  const [comps] = await queryRows<{ count: number; with_price: number }>(
    // sold_for_price is per-property by construction; a portfolio total is not a property's
    // sale price, so it is not counted as a disclosed price here.
    `SELECT count(*)::INT AS count, count(sold_for_price)::INT AS with_price
     FROM comps WHERE property_id IN (${idList})`,
  );

  return {
    propertyId,
    radiusMeters,
    propertiesInRadius: propertyIds.length,
    propertyIds,
    comparableSpaces: {
      count: spaceStats.count,
      withPublishedRate: spaceStats.with_rate,
      askingRentPsfYear:
        spaceStats.with_rate > 0
          ? { min: spaceStats.min, median: spaceStats.median, max: spaceStats.max }
          : EMPTY_RANGE,
      rentGroups,
      serviceTypes,
      spaceUses,
      propertyIds: comparablePropertyIds,
    },
    nearbyTenants: {
      count: byIndustry.reduce((n, row) => n + row.count, 0),
      byIndustry,
    },
    saleComps: { count: comps.count, withDisclosedPrice: comps.with_price },
  };
}
