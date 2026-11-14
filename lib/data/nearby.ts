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

export interface NearbyContext {
  propertyId: number;
  radiusMeters: number;
  /** Sample size: kit properties within the radius, excluding the subject. */
  propertiesInRadius: number;
  propertyIds: number[];
  comparableSpaces: {
    count: number;
    /** Of those, how many published a rate — the denominator behind the range. */
    withPublishedRate: number;
    askingRentPsfYear: NumericRange;
    serviceTypes: { serviceType: string; count: number }[];
    spaceUses: { spaceUse: string; count: number }[];
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

  const [spaceStats] = await queryRows<{
    count: number;
    with_rate: number;
    min: number | null;
    median: number | null;
    max: number | null;
  }>(
    `SELECT count(*)::INT AS count,
            count(psf_year_low)::INT AS with_rate,
            min(psf_year_low) AS min,
            median(psf_year_low) AS median,
            max(psf_year_high) AS max
     FROM spaces WHERE property_id IN (${idList})`,
  );

  // Service type and space use are coalesced rather than dropped, so the breakdowns always
  // add up to `count` and no space goes silently missing from the evidence.
  const serviceTypes = await queryRows<{ serviceType: string; count: number }>(
    `SELECT coalesce(service_type, 'Unknown') AS "serviceType", count(*)::INT AS count
     FROM spaces WHERE property_id IN (${idList})
     GROUP BY 1 ORDER BY count DESC, 1`,
  );
  const spaceUses = await queryRows<{ spaceUse: string; count: number }>(
    `SELECT coalesce(space_use, 'Unknown') AS "spaceUse", count(*)::INT AS count
     FROM spaces WHERE property_id IN (${idList})
     GROUP BY 1 ORDER BY count DESC, 1`,
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
      serviceTypes,
      spaceUses,
      propertyIds,
    },
    nearbyTenants: {
      count: byIndustry.reduce((n, row) => n + row.count, 0),
      byIndustry,
    },
    saleComps: { count: comps.count, withDisclosedPrice: comps.with_price },
  };
}
