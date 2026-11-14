/**
 * Current tenants of a property, from the CoStar occupancy + company datasets (DATA-03).
 * OWNER: Developer 2.
 *
 * "Current" means the tenancy has no end date, or an end date still in the future — see the
 * tenants_current table in scripts/build-db.ts. A tenant list is evidence of what the building
 * actually supports today, which is why the reuse analysis leans on it.
 */
import "server-only";
import { queryRows } from "./duckdb";

export interface CurrentTenant {
  name: string | null;
  industry: string | null;
  suite: string | null;
  squareFeet: number | null;
  since: string | null;
}

interface TenantRow {
  name: string | null;
  industry: string | null;
  suite: string | null;
  square_feet: number | null;
  since: string | null;
}

/**
 * Tenants currently in the building, newest lease first.
 * Tenancies whose `tenantLocationId` resolves to no company still appear, with a null name —
 * 1,835 kit tenancies name no company at all and one points at a company that does not exist,
 * and dropping them would under-report how full a building is.
 */
export async function getCurrentTenants(propertyId: number): Promise<CurrentTenant[]> {
  const rows = await queryRows<TenantRow>(
    `SELECT tenant_name AS name,
            industry_type AS industry,
            tenant_suite AS suite,
            NULL::DOUBLE AS square_feet,
            from_date::VARCHAR AS since
     FROM tenants_current
     WHERE property_id = ?
     ORDER BY from_date DESC NULLS LAST, tenant_name`,
    [propertyId] as never,
  );

  return rows.map((row) => ({
    name: row.name,
    industry: row.industry,
    suite: row.suite,
    // shortcut: occupied area is not imported; location-occupancy.spaces[].squareFeetOccupied
    // would fill it — add in DATA-07, which is where occupied area is actually consumed.
    squareFeet: row.square_feet,
    since: row.since,
  }));
}
