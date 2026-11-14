# DATA-01 — CoStar → DuckDB Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run db:build` turns the static CoStar kit into a queryable DuckDB file with six normalized tables, decoded enums and rents normalized to $/SF/yr, so every other workstream can stop using fixtures.

**Architecture:** Pure, unit-testable transform modules in `lib/data/` (enum decoding, rent normalization, suite↔Matterport matching) plus one IO script `scripts/build-db.ts` that reads `$COSTAR_KIT_DIR/data/*.jsonl` with DuckDB's `read_json_auto`, projects each dataset into a normalized table with SQL, and writes `$DUCKDB_PATH`. Runtime readers get a read-only singleton connection from `lib/data/duckdb.ts`. The script is the only writer; nothing at request time mutates the DB.

**Tech Stack:** TypeScript (strict), `@duckdb/node-api` ^2.0.0-r.1, `tsx` for the script, Zod 4 contracts from `@/lib/contracts`, Vitest 4 (`tests/**/*.test.ts`, `@` alias configured).

**Spec:** GitHub issue [#6 `DATA-01`](https://github.com/jordansalagala21/tesseract/issues/6) (description + acceptance criteria), `docs/DATA_SOURCES.md` §1, `CLAUDE.md` §4/§6, and the kit's `models/*.md`. Every count and field path below was verified against `E:\CoStar_Unit` on 2026-11-14.

## Global Constraints

- TypeScript strict; no `any` in exported APIs. Shared types come from `@/lib/contracts`.
- `lib/data/duckdb.ts` reads `serverEnv()` and therefore starts with `import "server-only"`. The pure transform modules (`enums.ts`, `rent.ts`, `matching.ts`) must NOT import `server-only` — the unit tests import them directly under Node.
- CoStar rate `0` means "no rate" → `null`. Never `0`.
- Rents normalized to **$/SF/yr**: `rateBasis` 1 = Monthly (× 12), 2 = Yearly (× 1), 0 = Unknown (→ `null` for the normalized value, raw value preserved).
- `serviceType` is carried on every space, decoded to its enum name. Rents are not comparable across service types.
- Availability is **advertised**, never vacancy. Allowed status values are exactly `advertised_available` and `lease_pending`. The string "vacant" must not appear in code, column names, or comments.
- Every table carries the columns needed to rebuild a `SourceRef` (`dataset`, `recordId`, and the field path where the value came from).
- Enums are decoded via `$COSTAR_KIT_DIR/schemas/enums.json` (161 enums, each a flat `{"<int>": "Name"}` map). An unknown integer decodes to `null`, never to a guessed label.
- Never commit sponsor data, the `.duckdb` file, or API dumps. `.gitignore` already covers `*.jsonl`, `/data/*`, `*.duckdb`.
- Node >= 20.9. The DB build must finish in under 2 minutes from a clean kit.
- Kit-dependent tests use `it.skipIf(!process.env.COSTAR_KIT_DIR)` — CI has no sponsor data.

## Review Focus

Five conditions the spec implies that no task's own happy-path tests would catch. Each has a test assigned to the task that owns the code.

- **A monthly rate silently treated as yearly** — 1,149 of 3,955 spaces have `rateBasis: 1`. Missing the ×12 is a 12× error in every downstream rent, scenario and score, and nothing would visibly fail. *(Task 2)*
- **A non-zero rate with `rateBasis: 0` (Unknown)** — 14 spaces. The normalized value must be `null` (we cannot say what period it is) while the raw low/high survive, rather than defaulting to yearly. *(Task 2)*
- **`COSTAR_KIT_DIR` unset, wrong, or pointing at a folder with no `data/`** — the most likely first-run failure for a teammate. Must fail with one actionable message naming the missing path, not a DuckDB parse error or a stack trace. *(Task 5)*
- **An integer enum value absent from `enums.json`** — e.g. `LotSizeMeasurementType` is not in the file at all, and `propertyType` 10/13 are rare. Decoding must yield `null` and keep importing, never crash and never invent a label. *(Task 1)*
- **`toDate` absent rather than null on occupancy records** — 11,179 of 74,093 records omit the key entirely and it is *never* literally null when present. A JS `=== null` test would classify every current tenancy as expired; the SQL `IS NULL` test is correct. Pin the count so a future refactor to JS filtering fails loudly. *(Task 6)*

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/data/enums.ts` | Load `schemas/enums.json`; decode `(enumName, value) → string \| null`. Pure. |
| `lib/data/rent.ts` | `normalizeAskingRent()` → the contract's `AskingRent` shape. Pure. |
| `lib/data/matching.ts` | Suite ↔ Matterport model linking (caption text + direct `floorPlan.videoKey`). Pure. DATA-06 extends this file. |
| `lib/data/duckdb.ts` | Read-only singleton connection for request-time readers. |
| `scripts/build-db.ts` | The importer: read kit JSONL → six normalized tables → `$DUCKDB_PATH`. |
| `tests/data/enums.test.ts`, `rent.test.ts`, `matching.test.ts`, `duckdb.test.ts`, `build-db.test.ts` | One test file per module; `build-db.test.ts` is the kit-gated integration test. |

## Verified Field Map

The implementer must use these paths. Several differ from the abbreviations in `docs/DATA_SOURCES.md`, which do not exist in the data.

**`commercial-property.jsonl` → `properties`**

| Column | Source path | Notes |
|---|---|---|
| `id` | `id` | CoStar PropertyId |
| `name` | `buildingName` | null for 1018657 |
| `street` | `primaryAddress.{streetNumber, streetName, streetType}` | join with spaces |
| `city`, `state`, `postcode` | `primaryAddress.{city, state, postcode}` | |
| `lat`, `lon` | `primaryAddress.{latitude, longitude}` | **not** top-level; `addresses[]` is the fallback |
| `research_market_id` | `primaryAddress.researchMarketId` | 14 = houston, 20 = los_angeles |
| `submarket_id` | `primarySubmarketId` | `primarySubmarketName` is always empty — ids only |
| `property_type` | `propertyType` → `PropertyType` | 11 = Multifamily (flag these) |
| `property_subtype` | `propertySubtype` → `PropertySubtype` | 14 = GeneralRetail_Freestanding |
| `building_class` | `buildingClass` → `BuildingClass` | `{1:A, 2:B, 3:C, 4:F}`, 0 = Unknown → null |
| `building_rating` | `buildingRating` | 1–5 |
| `construction_status` | `constructionStatus` → `ConstructionStatus` | |
| `rentable_area_sf`, `gross_area_sf` | `rentableBuildingAreaSquareFeet`, `grossBuildingAreaSquareFeet` | |
| `stories` | `numStoriesAboveGrade` | |
| `lot_value`, `lot_unit` | `lotSize`, `lotSizeMeasurementType` → `MeasurementUnit2` | `LotSizeMeasurementType` is absent from `enums.json`; 2 = Acres |
| `year_built` | `constructionEvents[]` where `eventType` = 2 (`ConstructionComplete`) → `year` | 1960 for 1018657 |
| `year_renovated` | `constructionEvents[]` where `eventType` = 4 (`RenovationFinished`) → `year` | 2019 for 1018657 |
| `parking_ratio_per_1000_sf` | `parkingRatio` | top-level, nullable; absent for 1018657 |
| `zoning_description` | `zoningDescription` | a string only — never a zoning determination |
| `retail_gla_sf` | `propertyRetail.grossLeasableAreaSquareFeet` | 36,932 for 1018657 |
| `retail_ceiling_height_ft` | `propertyRetail.structural.ceilingHeightFeet` | 20 for 1018657 |
| `retail_frontage` | `propertyRetail.frontage[]{streetName, frontageInFeet, numCurbCuts, isPrimaryFrontage}` | keep as a STRUCT list |

**`commercial-listing-summary.jsonl` → `spaces`** (one row per `forLeaseSummary.spaces[]`)

| Column | Source path | Notes |
|---|---|---|
| `id` | `spaces[].id` | 21053094 for suite 100 |
| `listing_id`, `property_id` | listing `id`, `spaces[].propertyId` | listing 4105591 for 1018657 |
| `listing_type` | listing `listingType` → `ListingType` | 14 on the Travis listing |
| `suite` | `spaces[].suite` | |
| `floor` | `spaces[].floorName` cast to text | numeric in source |
| `space_use` | `spaces[].spaceUse` → `SpaceUse` | 5 = Retail |
| `space_type` | `spaces[].spaceType` → `SpaceType` | 1 = Relet |
| `sf_min`, `sf_max` | `squareFeetMin`, `squareFeetMax` | **not** `availableSpaceSquareFeet` |
| `rate_low`, `rate_high`, `rate_basis` | `rateLow`, `rateHigh`, `rateBasis` | **not** `rate` |
| `service_type` | `serviceType` → `ServiceType` | 13 = TripleNet |
| `cam_amount` | `commonAreaMaintenanceAmount` | 7.95 for suite 100 — feeds AI-06 |
| `availability_status` | `isLeasePending` | true → `lease_pending` (6 spaces kit-wide), else `advertised_available` |
| `available_on` | `availableOnDate` | **not** `availableOn` |
| `on_market_date` | `dateOnMarket` | **not** `onMarketDate` |
| `floor_plan_uri` | `floorPlan.attachmentUri` | CoStar CDN 403s to server requests; store, don't fetch |
| `marketing_note` | `notes[]` where `noteType` = 8 → `value` | the listing's own copy; `verified_fact` with a CoStar SourceRef |

Filter: keep spaces whose parent listing has `listingStatus` = 1 (`Active`). **Do not filter on `dateOffMarket`** — it is null on all 3,955 spaces, so that filter is a silent no-op.

**Other tables**

- `tenants_current` ← `location-occupancy.jsonl` where `toDate IS NULL` (11,179 rows), LEFT JOIN `company-detail.jsonl` on `tenantLocationId = company.id`. Only 9,344 of the 11,179 carry a `tenantLocationId`, so the join must be a LEFT JOIN and the unresolved ones kept with a null name. Columns: `occupancy_id`, `property_id`, `tenant_location_id`, `tenant_name` (`company.name`), `tenant_suite` (`company.suite`), `industry_type` (occupancy `industryType`, decoded), `lease_type`, `from_date`, `move_in_date`, `num_employees`.
- `comps` ← `commercial-sale-comp.jsonl`, unnested on `entities[]` to get `propertyId`. Columns: `comp_id`, `property_id` (`entities[].propertyId`), `sold_for_price`, `sold_date`, `sale_price_status` (decoded — always carry it), `sale_type`, `tenure`, `is_land_value_sale`.
- `sale_listings` ← `commercial-listing-summary.jsonl` `forSaleSummary` on Active listings. Columns: `listing_id`, `property_id`, `asking_price`, `capitalization_rate`, `net_operating_income`, with a comment that cap rate and NOI are the seller's marketed figures.
- `matterport_models` ← property `attachments[]` where `videoExternalReferenceType` IN (36, 234), plus the direct space links. Columns: `property_id`, `model_id` (`videoKey`), `caption`, `matched_suite`, `link_method`.

**Contract gap to flag, not to fix here:** 20 spaces carry a direct, unambiguous Matterport link at `spaces[].floorPlan.videoKey` with `videoExternalReferenceType: 36` (suite 100 → `NxYn1owequw`). Where both signals exist (7 spaces) the direct key and the caption match agree 100%, which is good validation of the caption heuristic — but the contract's `AvailableSpace.matterport.linkMethod` enum admits only `caption_suite_match`. Store `link_method` in the DB with both values (`space_floorplan_videokey` | `caption_suite_match`) and open a `contracts`-labelled issue asking Dev 1 to extend the enum. DATA-03 will surface only what the contract can express until then.

---

### Task 1: Enum decoding

**Files:**
- Create: `lib/data/enums.ts`
- Test: `tests/data/enums.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type EnumMap = Record<string, Record<string, string>>`; `loadKitEnums(kitDir: string): EnumMap`; `decodeEnum(enums: EnumMap, enumName: string, value: number | null | undefined): string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
const FIXTURE: EnumMap = {
  PropertyType: { "0": "Unknown", "6": "GeneralRetail", "11": "Multifamily" },
  BuildingClass: { "0": "Unknown", "1": "A", "2": "B", "3": "C", "4": "F" },
};

test("decodes a known integer to its name", () => {
  expect(decodeEnum(FIXTURE, "PropertyType", 6)).toBe("GeneralRetail");
});
test("decodes BuildingClass 1 to A", () => {
  expect(decodeEnum(FIXTURE, "BuildingClass", 1)).toBe("A");
});
test("returns null for the Unknown member", () => {
  expect(decodeEnum(FIXTURE, "BuildingClass", 0)).toBeNull();
});
test("returns null for an integer absent from the map", () => {
  expect(decodeEnum(FIXTURE, "PropertyType", 999)).toBeNull();
});
test("returns null for an enum name absent from the file", () => {
  expect(decodeEnum(FIXTURE, "LotSizeMeasurementType", 2)).toBeNull();
});
test("returns null for null and undefined values", () => {
  expect(decodeEnum(FIXTURE, "PropertyType", null)).toBeNull();
  expect(decodeEnum(FIXTURE, "PropertyType", undefined)).toBeNull();
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run tests/data/enums.test.ts`
Expected: FAIL — cannot find module `@/lib/data/enums`.

- [ ] **Step 3: Implement `loadKitEnums` and `decodeEnum` in `lib/data/enums.ts`**

`loadKitEnums` reads `<kitDir>/schemas/enums.json` with `node:fs` and throws an `Error` naming the full path if it is missing. `decodeEnum` treats the literal name `"Unknown"` as `null`, since the kit uses it as the zero member of nearly every enum.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run tests/data/enums.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/enums.ts tests/data/enums.test.ts
git commit -m "feat(data): decode CoStar integer enums from the kit's enums.json"
```

---

### Task 2: Rent normalization

**Files:**
- Create: `lib/data/rent.ts`
- Test: `tests/data/rent.test.ts`

**Interfaces:**
- Consumes: `AskingRent` from `@/lib/contracts`.
- Produces: `normalizeAskingRent(input: { rateLow: number | null; rateHigh: number | null; rateBasis: number | null; serviceType: string | null }): AskingRent`.

- [ ] **Step 1: Write the failing tests**

```ts
test("yearly rate passes through to psfYear", () => {
  const r = normalizeAskingRent({ rateLow: 45, rateHigh: 45, rateBasis: 2, serviceType: "TripleNet" });
  expect(r).toEqual({ low: 45, high: 45, basis: "yearly", psfYearLow: 45, psfYearHigh: 45, serviceType: "TripleNet" });
});
test("monthly rate is multiplied by 12", () => {
  const r = normalizeAskingRent({ rateLow: 2.5, rateHigh: 3, rateBasis: 1, serviceType: "FullService" });
  expect(r.basis).toBe("monthly");
  expect(r.psfYearLow).toBe(30);
  expect(r.psfYearHigh).toBe(36);
});
test("rate 0 becomes null, not zero", () => {
  const r = normalizeAskingRent({ rateLow: 0, rateHigh: 0, rateBasis: 2, serviceType: "TripleNet" });
  expect(r.low).toBeNull();
  expect(r.high).toBeNull();
  expect(r.psfYearLow).toBeNull();
  expect(r.psfYearHigh).toBeNull();
});
test("unknown basis keeps the raw rate but cannot normalize it", () => {
  const r = normalizeAskingRent({ rateLow: 20, rateHigh: 20, rateBasis: 0, serviceType: null });
  expect(r.basis).toBe("unknown");
  expect(r.low).toBe(20);
  expect(r.psfYearLow).toBeNull();
});
test("serviceType is preserved verbatim", () => {
  expect(normalizeAskingRent({ rateLow: 1, rateHigh: 1, rateBasis: 1, serviceType: "PlusElectric" }).serviceType).toBe("PlusElectric");
});
test("output satisfies the AskingRent contract", () => {
  const r = normalizeAskingRent({ rateLow: 45, rateHigh: 45, rateBasis: 2, serviceType: "TripleNet" });
  expect(() => AskingRent.parse(r)).not.toThrow();
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run tests/data/rent.test.ts`
Expected: FAIL — cannot find module `@/lib/data/rent`.

- [ ] **Step 3: Implement `normalizeAskingRent` in `lib/data/rent.ts`**

Map `rateBasis` 1 → `"monthly"`, 2 → `"yearly"`, anything else → `"unknown"`. Treat a falsy or zero rate as `null` before any arithmetic, so a zero never reaches the multiplication.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run tests/data/rent.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/rent.ts tests/data/rent.test.ts
git commit -m "feat(data): normalize CoStar asking rents to dollars per SF per year"
```

---

### Task 3: Suite ↔ Matterport matching

**Files:**
- Create: `lib/data/matching.ts`
- Test: `tests/data/matching.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type SuiteModelLink = { modelId: string; caption: string; matchedSuite: string | null; linkMethod: "caption_suite_match" | "space_floorplan_videokey" }`; `suiteFromCaption(caption: string): string | null`; `linkSuiteToModel(suite: string | null, attachments: { videoKey?: string | null; caption?: string | null; videoExternalReferenceType?: number | null }[]): SuiteModelLink | null`.

DATA-06 extends this module with coordinate checks — keep these exports stable.

- [ ] **Step 1: Write the failing tests**

```ts
test("extracts the suite number from a CoStar caption", () => {
  expect(suiteFromCaption("Suite 100 - 9,889SF")).toBe("100");
  expect(suiteFromCaption("Suite 104 - 2,946SF")).toBe("104");
});
test("extracts an alphanumeric suite", () => {
  expect(suiteFromCaption("Suite I - 1,200SF")).toBe("I");
});
test("ignores captions that name no suite", () => {
  expect(suiteFromCaption("2600 Travis Site Plan")).toBeNull();
  expect(suiteFromCaption("View Site Plan")).toBeNull();
});
test("links suite 100 to its model and records the method", () => {
  const link = linkSuiteToModel("100", [
    { videoKey: "1oJZ2OYf", caption: "2600 Travis Site Plan", videoExternalReferenceType: 60 },
    { videoKey: "NxYn1owequw", caption: "Suite 100 - 9,889SF", videoExternalReferenceType: 36 },
  ]);
  expect(link).toEqual({
    modelId: "NxYn1owequw",
    caption: "Suite 100 - 9,889SF",
    matchedSuite: "100",
    linkMethod: "caption_suite_match",
  });
});
test("ignores attachments that are not Matterport reference types", () => {
  expect(
    linkSuiteToModel("100", [
      { videoKey: "7JIRF77e", caption: "Suite 100 Floor Plan 2600 Travis", videoExternalReferenceType: 60 },
    ]),
  ).toBeNull();
});
test("matches case-insensitively and ignores leading zeros", () => {
  expect(linkSuiteToModel("100", [{ videoKey: "M", caption: "SUITE 0100 - 1SF", videoExternalReferenceType: 36 }])?.modelId).toBe("M");
});
test("returns null when the space has no suite", () => {
  expect(linkSuiteToModel(null, [{ videoKey: "M", caption: "Suite 100", videoExternalReferenceType: 36 }])).toBeNull();
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run tests/data/matching.test.ts`
Expected: FAIL — cannot find module `@/lib/data/matching`.

- [ ] **Step 3: Implement `suiteFromCaption` and `linkSuiteToModel` in `lib/data/matching.ts`**

Accept only `videoExternalReferenceType` 36 or 234. Normalize both sides by upper-casing and stripping leading zeros before comparing. The caption regex is `/\bsuite\s+([A-Za-z0-9-]+)/i`. Document in a comment that this is a text heuristic over CoStar captions, not an official CoStar↔Matterport link, which is why `linkMethod` is recorded on every link.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run tests/data/matching.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/matching.ts tests/data/matching.test.ts
git commit -m "feat(data): link CoStar suites to Matterport models by caption"
```

---

### Task 4: Read-only DuckDB connection

**Files:**
- Create: `lib/data/duckdb.ts`
- Test: `tests/data/duckdb.test.ts`

**Interfaces:**
- Consumes: `serverEnv()` from `@/lib/config/env`.
- Produces: `getDb(): Promise<DuckDBConnection>` (read-only singleton over `serverEnv().DUCKDB_PATH`); `queryRows<T>(sql: string, params?: unknown[]): Promise<T[]>`; `closeDb(): Promise<void>` for tests.

- [ ] **Step 1: Write the failing tests**

```ts
test("queryRows returns typed rows from a query", async () => {
  const rows = await queryRows<{ n: number }>("SELECT 42 AS n");
  expect(rows).toEqual([{ n: 42 }]);
});
test("getDb returns the same connection on repeated calls", async () => {
  expect(await getDb()).toBe(await getDb());
});
test("a write to the read-only connection is rejected", async () => {
  await expect(queryRows("CREATE TABLE nope (x INT)")).rejects.toThrow();
});
```

Point the suite at a temporary DB by setting `process.env.DUCKDB_PATH` in a `beforeAll`, and build a one-table fixture file first so the read-only open has something to attach; call `closeDb()` in `afterAll`.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run tests/data/duckdb.test.ts`
Expected: FAIL — cannot find module `@/lib/data/duckdb`.

- [ ] **Step 3: Implement the connection module in `lib/data/duckdb.ts`**

Starts with `import "server-only"`. Open the instance with `@duckdb/node-api`'s `DuckDBInstance.create(path, { access_mode: "READ_ONLY" })`, cache the promise (not the resolved value) in a module-level variable so concurrent callers share one connection, and throw an `Error` naming `$DUCKDB_PATH` and `npm run db:build` when the file does not exist.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run tests/data/duckdb.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/duckdb.ts tests/data/duckdb.test.ts
git commit -m "feat(data): add read-only DuckDB singleton connection"
```

---

### Task 5: Importer — `properties` and `spaces`

**Files:**
- Create: `scripts/build-db.ts`
- Test: `tests/data/build-db.test.ts`

**Interfaces:**
- Consumes: `loadKitEnums`, `decodeEnum` (Task 1); `normalizeAskingRent` (Task 2).
- Produces: `buildDb(opts: { kitDir: string; dbPath: string; log?: (msg: string) => void }): Promise<{ tables: Record<string, number>; elapsedMs: number }>` — exported from the script module so the test can call it without spawning a process. The module's CLI entry calls `buildDb` with `serverEnv()` values when run directly.

The six tables are created across this task and Task 6; `buildDb` returns a row count per table.

- [ ] **Step 1: Write the failing tests**

`rows<T>(sql)` below is a local helper in this test file that opens `tmpDbPath` directly — `queryRows` from Task 4 is bound to `$DUCKDB_PATH` and read-only, so it cannot see the temporary build.

```ts
const kitDir = process.env.COSTAR_KIT_DIR;
const describeKit = describe.skipIf(!kitDir);

describeKit("buildDb (requires the sponsor kit)", () => {
  let result: Awaited<ReturnType<typeof buildDb>>;
  beforeAll(async () => { result = await buildDb({ kitDir: kitDir!, dbPath: tmpDbPath }); }, 180_000);

  test("properties has one row per kit property", () => {
    expect(result.tables.properties).toBe(3339);
  });
  test("spaces has one row per advertised space on an Active listing", () => {
    expect(result.tables.spaces).toBe(3955);
  });
  test("multifamily is flagged, not dropped", async () => {
    const [{ n }] = await rows<{ n: number }>("SELECT count(*) n FROM properties WHERE is_multifamily");
    expect(n).toBe(2765);
  });
  test("every property is geocoded", async () => {
    const [{ n }] = await rows<{ n: number }>("SELECT count(*) n FROM properties WHERE lat IS NULL OR lon IS NULL");
    expect(n).toBe(0);
  });
  test("1018657 imports as the Travis St retail property", async () => {
    const [p] = await rows("SELECT * FROM properties WHERE id = 1018657");
    expect(p).toMatchObject({
      city: "Houston", state: "TX", research_market_id: 14,
      property_type: "GeneralRetail", building_class: "A",
      retail_gla_sf: 36932, retail_ceiling_height_ft: 20,
      year_built: 1960, year_renovated: 2019,
    });
    expect(p.lat).toBeCloseTo(29.74587, 5);
  });
  test("1018657 has its four advertised suites with normalized NNN rents", async () => {
    const s = await rows(
      "SELECT suite, sf_max, psf_year_low, service_type, availability_status FROM spaces WHERE property_id = 1018657 ORDER BY suite",
    );
    expect(s).toEqual([
      { suite: "100", sf_max: 9889, psf_year_low: 45, service_type: "TripleNet", availability_status: "advertised_available" },
      { suite: "104", sf_max: 2946, psf_year_low: 45, service_type: "TripleNet", availability_status: "advertised_available" },
      { suite: "106", sf_max: 4681, psf_year_low: 37, service_type: "TripleNet", availability_status: "advertised_available" },
      { suite: "107", sf_max: 4681, psf_year_low: 37, service_type: "TripleNet", availability_status: "advertised_available" },
    ]);
  });
  test("a rate of 0 is stored as null", async () => {
    const [{ n }] = await rows<{ n: number }>(
      "SELECT count(*) n FROM spaces WHERE rate_low = 0 OR rate_high = 0 OR psf_year_low = 0",
    );
    expect(n).toBe(0);
  });
  test("spaces with a published rate match the verified count", async () => {
    const [{ n }] = await rows<{ n: number }>("SELECT count(*) n FROM spaces WHERE psf_year_low IS NOT NULL");
    expect(n).toBe(2196);
  });
  test("availability_status admits only the two advertised values", async () => {
    const v = await rows<{ availability_status: string }>("SELECT DISTINCT availability_status FROM spaces ORDER BY 1");
    expect(v.map((r) => r.availability_status)).toEqual(["advertised_available", "lease_pending"]);
  });
  test("exactly the six lease-pending spaces are flagged", async () => {
    const [{ n }] = await rows<{ n: number }>("SELECT count(*) n FROM spaces WHERE availability_status = 'lease_pending'");
    expect(n).toBe(6);
  });
  test("the build finishes inside the two-minute budget", () => {
    expect(result.elapsedMs).toBeLessThan(120_000);
  });
});

test("a missing kit directory fails with an actionable message", async () => {
  await expect(buildDb({ kitDir: "/no/such/kit", dbPath: tmpDbPath })).rejects.toThrow(/\/no\/such\/kit/);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run tests/data/build-db.test.ts`
Expected: FAIL — cannot find module `@/scripts/build-db`. With `COSTAR_KIT_DIR` set the kit-gated block runs; without it only the missing-directory test runs, and it still fails.

- [ ] **Step 3: Implement `buildDb` in `scripts/build-db.ts` for `properties` and `spaces`**

Validate `<kitDir>/data` and `<kitDir>/schemas/enums.json` up front and throw one `Error` naming the path that is missing. Open the target DB read-write, `CREATE OR REPLACE TABLE` each table so a rebuild is idempotent, and read each dataset with `read_json_auto('<kitDir>/data/<file>.jsonl', format='newline_delimited')`.

Build `properties` in SQL using the Verified Field Map, with a `list_filter` over `constructionEvents` for the two year columns and an `is_multifamily` boolean from `propertyType = 11`. Decode enums by building a small lookup table in TS from `loadKitEnums` (enum name, int value, label), registering it in DuckDB, and LEFT JOINing it — so decoding lives in one place and an unknown integer yields `NULL` by construction.

Build `spaces` by `UNNEST`-ing `forLeaseSummary.spaces` for listings with `listingStatus = 1`, then applying the same three rent rules as Task 2 in SQL: 0 → NULL, basis 1 → × 12, basis 0 → NULL normalized value with the raw low/high preserved.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `COSTAR_KIT_DIR=E:/CoStar_Unit npx vitest run tests/data/build-db.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-db.ts tests/data/build-db.test.ts
git commit -m "feat(data): import CoStar properties and advertised spaces into DuckDB"
```

---

### Task 6: Importer — `tenants_current`, `comps`, `sale_listings`, `matterport_models`

**Files:**
- Modify: `scripts/build-db.ts`
- Modify: `tests/data/build-db.test.ts`

**Interfaces:**
- Consumes: `buildDb` (Task 5); `linkSuiteToModel`, `suiteFromCaption` (Task 3).
- Produces: the same `buildDb` signature, with four more keys in `tables`.

- [ ] **Step 1: Write the failing tests**

```ts
test("tenants_current holds the current tenancies", () => {
  expect(result.tables.tenants_current).toBe(11179);
});
test("a tenancy is current when toDate is absent, not literally null", async () => {
  const [{ n }] = await rows<{ n: number }>("SELECT count(*) n FROM tenants_current WHERE to_date IS NOT NULL");
  expect(n).toBe(0);
});
test("tenancies without a tenantLocationId survive with a null name", async () => {
  const [{ n }] = await rows<{ n: number }>("SELECT count(*) n FROM tenants_current WHERE tenant_name IS NULL");
  expect(n).toBe(11179 - 9344);
});
test("1018657 resolves its two current tenants", async () => {
  const t = await rows<{ tenant_name: string }>(
    "SELECT tenant_name FROM tenants_current WHERE property_id = 1018657 ORDER BY tenant_name",
  );
  expect(t.map((r) => r.tenant_name)).toEqual(["F45 Training, Inc.", "Warehouse Live"]);
});
test("comps keep salePriceStatus wherever there is a price", async () => {
  const [{ n }] = await rows<{ n: number }>(
    "SELECT count(*) n FROM comps WHERE sale_price_status IS NULL AND sold_for_price IS NOT NULL",
  );
  expect(n).toBe(0);
});
test("matterport_models links suite 100 and 104 to their models", async () => {
  const m = await rows(
    "SELECT matched_suite, model_id, link_method FROM matterport_models WHERE property_id = 1018657 AND matched_suite IS NOT NULL ORDER BY matched_suite",
  );
  expect(m).toEqual([
    { matched_suite: "100", model_id: "NxYn1owequw", link_method: "caption_suite_match" },
    { matched_suite: "104", model_id: "4H2JSnQ3wSj", link_method: "caption_suite_match" },
  ]);
});
test("the direct floorPlan.videoKey links are recorded with their own method", async () => {
  const [{ n }] = await rows<{ n: number }>(
    "SELECT count(*) n FROM matterport_models WHERE link_method = 'space_floorplan_videokey'",
  );
  expect(n).toBe(20);
});
test("suite-matched 3D coverage matches the verified count", async () => {
  const [{ n }] = await rows<{ n: number }>(`
    SELECT count(*) n FROM spaces s
    JOIN properties p ON p.id = s.property_id
    JOIN matterport_models m ON m.property_id = s.property_id AND m.matched_suite = upper(s.suite)
    WHERE NOT p.is_multifamily AND m.link_method = 'caption_suite_match'`);
  expect(n).toBe(110);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `COSTAR_KIT_DIR=E:/CoStar_Unit npx vitest run tests/data/build-db.test.ts`
Expected: FAIL — `Table with name tenants_current does not exist`.

- [ ] **Step 3: Implement the four remaining tables in `scripts/build-db.ts`**

`tenants_current`: filter `toDate IS NULL`, which also catches the 11,179 records that omit the key, then LEFT JOIN company detail on `tenantLocationId`. `comps`: `UNNEST(entities)` to get `propertyId`, keeping `salePriceStatus` decoded on every row. `sale_listings`: project `forSaleSummary` from Active listings. `matterport_models`: union the property-attachment captions (via the Task 3 matcher) with the direct `spaces[].floorPlan.videoKey` links, each row carrying its `link_method`; `matched_suite` is upper-cased with leading zeros stripped so the join in the last test resolves.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `COSTAR_KIT_DIR=E:/CoStar_Unit npx vitest run tests/data/build-db.test.ts`
Expected: PASS (20 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-db.ts tests/data/build-db.test.ts
git commit -m "feat(data): import tenants, comps, sale listings and Matterport links"
```

---

### Task 7: `npm run db:build` end to end

**Files:**
- Modify: `scripts/build-db.ts` (CLI entry)
- Modify: `lib/data/README.md`, `scripts/README.md`

**Interfaces:**
- Consumes: `buildDb` (Tasks 5–6), `serverEnv()`.
- Produces: the `npm run db:build` command; no new exports.

- [ ] **Step 1: Run the real command against the real kit**

Run: `npm run db:build`
Expected: a per-table row-count summary and a total elapsed time under 2 minutes, writing `$DUCKDB_PATH`.

- [ ] **Step 2: Run it a second time to confirm a rebuild is idempotent**

Run: `npm run db:build`
Expected: the same row counts, with no error about existing tables or a locked file.

- [ ] **Step 3: Confirm nothing sponsor-derived is staged**

Run: `git status --porcelain` then `git check-ignore -v data/tesseract.duckdb`
Expected: no `.jsonl`, `.duckdb` or `data/` payload in the status output; `check-ignore` names the matching `.gitignore` rule.

- [ ] **Step 4: Run the full gate, then the CI shape**

Run: `npm run check`
Expected: lint, typecheck and the whole Vitest suite pass.
Run: `COSTAR_KIT_DIR= npx vitest run`
Expected: the kit-gated block reports as skipped rather than failing — this is what CI does, since CI has no sponsor data.

- [ ] **Step 5: Update the two READMEs**

In `lib/data/README.md` and `scripts/README.md`, mark the DATA-01 rows as implemented and record the three field-level corrections: active spaces come from `listingStatus = 1` and not `dateOffMarket`; the real rate, area and geo field paths; and `link_method` plus the pending contracts change for `space_floorplan_videokey`.

- [ ] **Step 6: Commit and open the PR**

```bash
git add scripts/build-db.ts lib/data/README.md scripts/README.md
git commit -m "feat(data): wire npm run db:build and document the kit field corrections"
gh pr create --title "DATA-01: Import CoStar datasets into DuckDB" --body "Closes #6 ..."
```

The PR body uses the repo template, pastes the (sanitized) row-count summary, and calls out two things for review: the three documented-versus-actual corrections, and the request for a `contracts` PR extending `AvailableSpace.matterport.linkMethod`.
