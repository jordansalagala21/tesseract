/**
 * DATA-01 — build the Tesseract DuckDB from the static CoStar kit.
 * OWNER: Developer 2.  Run with `npm run db:build`.
 *
 * Reads `$COSTAR_KIT_DIR/data/*.jsonl` and writes normalized tables to `$DUCKDB_PATH`.
 * This script is the only writer; everything at request time opens the file READ_ONLY
 * (lib/data/duckdb.ts).
 *
 * Field paths here were verified against the kit on 2026-11-14. Three of them differ from
 * docs/DATA_SOURCES.md, which abbreviates names that do not exist in the data:
 *   - geocoding lives on `primaryAddress` / `addresses[]`, not at the top level;
 *   - a space's rate is `rateLow`/`rateHigh`, not `rate`;
 *   - a space's area is `squareFeetMin`/`squareFeetMax`, not `availableSpaceSquareFeet`.
 * And `dateOffMarket` is null on all 3,955 spaces, so "active" comes from the parent
 * listing's `listingStatus = 1` instead. Filtering on dateOffMarket would be a silent no-op.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { decodeEnum, loadKitEnums, type EnumMap } from "@/lib/data/enums";

export interface BuildDbOptions {
  kitDir: string;
  dbPath: string;
  log?: (message: string) => void;
}

export interface BuildDbResult {
  tables: Record<string, number>;
  elapsedMs: number;
}

/** CoStar `videoExternalReferenceType` values that mean "this videoKey is a Matterport model". */
const MATTERPORT_REFERENCE_TYPES = [36, 234];

/** A single-quoted SQL string literal. */
function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** DuckDB reads paths with forward slashes on every platform. */
function sqlPath(...parts: string[]): string {
  return lit(path.join(...parts).replace(/\\/g, "/"));
}

/**
 * A CASE expression that decodes one integer enum column.
 *
 * Built by mapping every member through `decodeEnum`, so the "Unknown member and unmapped
 * integers both become NULL" rule has exactly one implementation (lib/data/enums.ts) even
 * though the bulk decode happens in SQL.
 */
function sqlEnum(enums: EnumMap, enumName: string, expr: string): string {
  const members = Object.keys(enums[enumName] ?? {});
  const whens = members
    .map((key) => ({ key: Number(key), label: decodeEnum(enums, enumName, Number(key)) }))
    .filter((m): m is { key: number; label: string } => m.label !== null)
    .map((m) => `WHEN ${m.key} THEN ${lit(m.label)}`);
  return whens.length === 0 ? "NULL" : `CASE ${expr} ${whens.join(" ")} ELSE NULL END`;
}

/** Canonical suite form, mirroring normalizeSuite() in lib/data/matching.ts. */
function sqlNormalizeSuite(expr: string): string {
  return `CASE
      WHEN ${expr} IS NULL OR trim(${expr}) = '' THEN NULL
      ELSE coalesce(nullif(regexp_replace(upper(trim(${expr})), '^0+', ''), ''), '0')
    END`;
}

function jsonSource(kitDir: string, dataset: string): string {
  return `read_json_auto(${sqlPath(kitDir, "data", `${dataset}.jsonl`)}, format='newline_delimited', sample_size=-1)`;
}

async function countRows(connection: DuckDBConnection, table: string): Promise<number> {
  const reader = await connection.runAndReadAll(`SELECT count(*)::INT AS n FROM ${table}`);
  return (reader.getRowObjectsJS()[0] as { n: number }).n;
}

export async function buildDb(options: BuildDbOptions): Promise<BuildDbResult> {
  const started = Date.now();
  const log = options.log ?? (() => {});

  const dataDir = path.join(options.kitDir, "data");
  if (!existsSync(dataDir)) {
    throw new Error(
      `No CoStar datasets at ${dataDir}. Point COSTAR_KIT_DIR at the unzipped sponsor kit (the folder holding data/, models/ and schemas/).`,
    );
  }
  const enums = loadKitEnums(options.kitDir);

  mkdirSync(path.dirname(path.resolve(options.dbPath)), { recursive: true });
  const instance = await DuckDBInstance.create(options.dbPath);
  const connection = await instance.connect();
  const tables: Record<string, number> = {};

  try {
    // ---------------------------------------------------------------- properties
    log("building properties…");
    await connection.run(`
      CREATE OR REPLACE TABLE properties AS
      SELECT
        p.id::INT                                            AS id,
        p.buildingName                                       AS name,
        nullif(trim(concat_ws(' ', p.primaryAddress.streetNumber, p.primaryAddress.streetName,
                              p.primaryAddress.streetType)), '')        AS street,
        coalesce(p.primaryAddress.city, p.addresses[1].city)             AS city,
        coalesce(p.primaryAddress.state, p.addresses[1].state)           AS state,
        coalesce(p.primaryAddress.postcode, p.addresses[1].postcode)     AS postcode,
        coalesce(p.primaryAddress.latitude, p.addresses[1].latitude)     AS lat,
        coalesce(p.primaryAddress.longitude, p.addresses[1].longitude)   AS lon,
        coalesce(p.primaryAddress.researchMarketId,
                 p.addresses[1].researchMarketId)::INT                   AS research_market_id,
        p.primarySubmarketId::INT                            AS submarket_id,
        ${sqlEnum(enums, "PropertyType", "p.propertyType")}  AS property_type,
        p.propertyType = 11                                  AS is_multifamily,
        ${sqlEnum(enums, "PropertySubtype", "p.propertySubtype")}        AS property_subtype,
        ${sqlEnum(enums, "BuildingClass", "p.buildingClass")}            AS building_class,
        p.buildingRating::INT                                AS building_rating,
        ${sqlEnum(enums, "ConstructionStatus", "p.constructionStatus")}  AS construction_status,
        p.rentableBuildingAreaSquareFeet                     AS rentable_area_sf,
        p.grossBuildingAreaSquareFeet                        AS gross_area_sf,
        p.numStoriesAboveGrade::INT                          AS stories,
        p.lotSize                                            AS lot_value,
        -- MeasurementUnit2: 1 = SquareFeet, 2 = Acres. SquareMeters has no contract value.
        CASE p.lotSizeMeasurementType WHEN 1 THEN 'sqft' WHEN 2 THEN 'acres' ELSE NULL END AS lot_unit,
        -- ConstructionEventType 2 = ConstructionComplete, 4 = RenovationFinished.
        list_filter(p.constructionEvents, lambda e: e.eventType = 2)[1].year::INT AS year_built,
        list_filter(p.constructionEvents, lambda e: e.eventType = 4)[1].year::INT AS year_renovated,
        p.parkingRatio                                       AS parking_ratio_per_1000_sf,
        -- A zoning code string only. Never a zoning determination (CLAUDE.md §6.4).
        p.zoningDescription                                  AS zoning_description,
        p.propertyRetail.grossLeasableAreaSquareFeet         AS retail_gla_sf,
        p.propertyRetail.structural.ceilingHeightFeet        AS retail_ceiling_height_ft,
        list_transform(p.propertyRetail.frontage, lambda f: {
          'street': f.streetName,
          'feet': f.frontageInFeet,
          'curb_cuts': f.numCurbCuts::INT,
          'is_primary': f.isPrimaryFrontage
        })                                                   AS retail_frontage,
        'commercial-property'                                AS source_dataset
      FROM ${jsonSource(options.kitDir, "commercial-property")} p
    `);
    tables.properties = await countRows(connection, "properties");

    // ------------------------------------------------------------------- spaces
    // "Advertised available", never "vacant" (CLAUDE.md §6.3). Active comes from the parent
    // listing's status; dateOffMarket is null on every space in the kit.
    log("building spaces…");
    await connection.run(`
      CREATE OR REPLACE TABLE spaces AS
      WITH active_listings AS (
        SELECT * FROM ${jsonSource(options.kitDir, "commercial-listing-summary")}
        WHERE listingStatus = 1 AND forLeaseSummary IS NOT NULL
      ),
      flat AS (
        SELECT
          l.id          AS listing_id,
          l.listingType AS listing_type_raw,
          unnest(l.forLeaseSummary.spaces) AS s
        FROM active_listings l
      )
      SELECT
        s.id::INT                                             AS id,
        listing_id::INT                                       AS listing_id,
        s.propertyId::INT                                     AS property_id,
        ${sqlEnum(enums, "ListingType", "listing_type_raw")}  AS listing_type,
        s.suite,
        ${sqlNormalizeSuite("s.suite")}                       AS suite_norm,
        CAST(s.floorName AS VARCHAR)                          AS floor,
        ${sqlEnum(enums, "SpaceUse", "s.spaceUse")}           AS space_use,
        ${sqlEnum(enums, "SpaceType", "s.spaceType")}         AS space_type,
        s.squareFeetMin                                       AS sf_min,
        s.squareFeetMax                                       AS sf_max,
        -- A rate of 0 means "no rate recorded" and must never surface as 0 (CLAUDE.md §6.6).
        nullif(s.rateLow, 0)                                  AS rate_low,
        nullif(s.rateHigh, 0)                                 AS rate_high,
        CASE s.rateBasis WHEN 1 THEN 'monthly' WHEN 2 THEN 'yearly' ELSE 'unknown' END AS rate_basis,
        -- Normalized to $/SF/yr: monthly x 12, yearly x 1, unknown basis cannot be normalized.
        nullif(s.rateLow, 0) * CASE s.rateBasis WHEN 1 THEN 12 WHEN 2 THEN 1 ELSE NULL END AS psf_year_low,
        nullif(s.rateHigh, 0) * CASE s.rateBasis WHEN 1 THEN 12 WHEN 2 THEN 1 ELSE NULL END AS psf_year_high,
        -- Rents are not comparable across service types, so this always travels with the rate.
        ${sqlEnum(enums, "ServiceType", "s.serviceType")}     AS service_type,
        s.commonAreaMaintenanceAmount                         AS cam_amount,
        CASE WHEN s.isLeasePending THEN 'lease_pending' ELSE 'advertised_available' END AS availability_status,
        try_cast(s.availableOnDate AS DATE)                   AS available_on,
        try_cast(s.dateOnMarket AS DATE)                      AS on_market_date,
        s.floorPlan.attachmentUri                             AS floor_plan_uri,
        -- A direct, unambiguous Matterport link when present (20 spaces kit-wide).
        CASE WHEN s.floorPlan.videoExternalReferenceType IN (${MATTERPORT_REFERENCE_TYPES.join(", ")})
             THEN s.floorPlan.videoKey END                    AS floor_plan_video_key,
        s.floorPlan.caption                                   AS floor_plan_caption,
        list_filter(s.notes, lambda n: n.noteType = 8)[1].value     AS marketing_note,
        'commercial-listing-summary'                          AS source_dataset
      FROM flat
    `);
    tables.spaces = await countRows(connection, "spaces");

    // ----------------------------------------------------------- tenants_current
    // A tenancy is current when `toDate` IS NULL — which covers the 11,179 records that omit
    // the key entirely. It is never literally null when present, so a JS `=== null` filter
    // would classify every current tenancy as expired.
    log("building tenants_current…");
    await connection.run(`
      CREATE OR REPLACE TABLE tenants_current AS
      WITH occupancy AS (
        SELECT * FROM ${jsonSource(options.kitDir, "location-occupancy")} WHERE toDate IS NULL
      ),
      companies AS (
        SELECT id, name, suite, numEmployees FROM ${jsonSource(options.kitDir, "company-detail")}
      )
      SELECT
        o.id::INT                                             AS occupancy_id,
        o.propertyId::INT                                     AS property_id,
        o.tenantLocationId::INT                               AS tenant_location_id,
        -- LEFT JOIN: only 9,344 of the 11,179 current tenancies name a tenant location.
        c.name                                                AS tenant_name,
        c.suite                                               AS tenant_suite,
        ${sqlEnum(enums, "IndustryType", "o.industryType")}   AS industry_type,
        ${sqlEnum(enums, "LeaseType", "o.leaseType")}         AS lease_type,
        try_cast(o.fromDate AS DATE)                          AS from_date,
        try_cast(o.moveInDate AS DATE)                        AS move_in_date,
        c.numEmployees::INT                                   AS num_employees,
        o.toDate                                              AS to_date,
        'location-occupancy'                                  AS source_dataset
      FROM occupancy o
      LEFT JOIN companies c ON c.id = o.tenantLocationId
    `);
    tables.tenants_current = await countRows(connection, "tenants_current");

    // -------------------------------------------------------------------- comps
    // One row per (comp, property entity). `salePriceStatus` always travels with the price:
    // the raw id is kept because 125 priced comps carry Unknown (0), which has no label.
    log("building comps…");
    await connection.run(`
      CREATE OR REPLACE TABLE comps AS
      WITH flat AS (
        SELECT
          id, soldForPrice, soldDate, salePriceStatus, saleType, tenure, isLandValueSale,
          unnest(entities) AS e
        FROM ${jsonSource(options.kitDir, "commercial-sale-comp")}
        WHERE entities IS NOT NULL
      )
      SELECT
        id::INT                                                   AS comp_id,
        e.propertyId::INT                                         AS property_id,
        soldForPrice                                              AS sold_for_price,
        try_cast(soldDate AS DATE)                                AS sold_date,
        salePriceStatus::INT                                      AS sale_price_status_id,
        ${sqlEnum(enums, "SalePriceStatus", "salePriceStatus")}   AS sale_price_status,
        ${sqlEnum(enums, "SaleType", "saleType")}                 AS sale_type,
        ${sqlEnum(enums, "Tenure", "tenure")}                     AS tenure,
        isLandValueSale                                           AS is_land_value_sale,
        'commercial-sale-comp'                                    AS source_dataset
      FROM flat
      WHERE e.propertyId IS NOT NULL
    `);
    tables.comps = await countRows(connection, "comps");

    // ------------------------------------------------------------- sale_listings
    // capitalizationRate and netOperatingIncome are the SELLER's marketed figures — often
    // pro forma, and present on only 32 / 31 of the 107 active sale listings.
    log("building sale_listings…");
    await connection.run(`
      CREATE OR REPLACE TABLE sale_listings AS
      SELECT
        l.id::INT                                                 AS listing_id,
        l.propertyId::INT                                         AS property_id,
        l.forSaleSummary.askingPriceLow                           AS asking_price_low,
        l.forSaleSummary.askingPriceHigh                          AS asking_price_high,
        l.forSaleSummary.capitalizationRate                       AS capitalization_rate,
        l.forSaleSummary.netOperatingIncome                       AS net_operating_income,
        l.forSaleSummary.totalAvailableSquareFeet                 AS total_available_sf,
        ${sqlEnum(enums, "SaleStatus", "l.forSaleSummary.saleStatus")}  AS sale_status,
        ${sqlEnum(enums, "SaleType", "l.forSaleSummary.saleType")}      AS sale_type,
        'commercial-listing-summary'                              AS source_dataset
      FROM ${jsonSource(options.kitDir, "commercial-listing-summary")} l
      WHERE l.listingStatus = 1 AND l.forSaleSummary IS NOT NULL
    `);
    tables.sale_listings = await countRows(connection, "sale_listings");

    // -------------------------------------------------------- matterport_models
    // Two signals, each recorded with its own link_method so the UI can caveat the heuristic:
    //   caption_suite_match     — property attachment caption names the suite (110 spaces)
    //   space_floorplan_videokey — the space's own floorPlan carries the model id (20 spaces)
    // Where both exist they agree, which is what justifies trusting the caption match.
    log("building matterport_models…");
    await connection.run(`
      CREATE OR REPLACE TABLE matterport_models AS
      WITH attachments AS (
        SELECT p.id::INT AS property_id, unnest(p.attachments) AS a
        FROM ${jsonSource(options.kitDir, "commercial-property")} p
        WHERE p.attachments IS NOT NULL
      ),
      caption_links AS (
        SELECT
          property_id,
          a.videoKey AS model_id,
          a.caption  AS caption,
          ${sqlNormalizeSuite("regexp_extract(a.caption, '(?i)\\bsuite\\s+([A-Za-z0-9-]+)', 1)")} AS matched_suite
        FROM attachments
        WHERE a.videoKey IS NOT NULL
          AND a.videoExternalReferenceType IN (${MATTERPORT_REFERENCE_TYPES.join(", ")})
      ),
      from_captions AS (
        -- One row per (property, model, suite). The kit both repeats whole attachments
        -- (1018657 lists each of its two models twice) and attaches one model under several
        -- captions, either of which would otherwise surface the same 3D tour twice for a
        -- suite. min(caption) picks one deterministically.
        SELECT
          property_id,
          NULL::INT          AS space_id,
          model_id,
          min(caption)       AS caption,
          matched_suite,
          'caption_suite_match' AS link_method
        FROM caption_links
        GROUP BY property_id, model_id, matched_suite
      ),
      from_spaces AS (
        SELECT
          property_id,
          id                   AS space_id,
          floor_plan_video_key AS model_id,
          floor_plan_caption   AS caption,
          suite_norm           AS matched_suite,
          'space_floorplan_videokey' AS link_method
        FROM spaces
        WHERE floor_plan_video_key IS NOT NULL
      )
      SELECT *, 'commercial-property' AS source_dataset FROM from_captions
      UNION ALL
      SELECT *, 'commercial-listing-summary' AS source_dataset FROM from_spaces
    `);
    tables.matterport_models = await countRows(connection, "matterport_models");

    log(`done in ${Date.now() - started} ms`);
    return { tables, elapsedMs: Date.now() - started };
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}
