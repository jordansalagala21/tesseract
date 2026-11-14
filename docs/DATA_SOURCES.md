# Data Sources

This file summarizes the feasibility study (`costar-hackathon-kit/feasibility-report/01–07`, kept locally and not committed). Every fact was checked against the kit or a live API on 2026-11-14.

## 1. CoStar hackathon kit (static)

- **Location:** outside the repo. Set `COSTAR_KIT_DIR` to the unzipped `costar-hackathon-kit/`.
- **Licence:** sponsor-provided. Never commit it.
- **Not an API:** `schemas/openapi.yaml` has `paths: {}`. There are no endpoints, auth, or rate limits.
- **Field docs:** `models/<dataset>.md` (meanings, enums, usage caveats), `concepts/*.md` (formulas, leasing, tenants, comps).
- **Enums** are stored as integers. Decode them with `schemas/enums.json`.

| Dataset | File | Records | Key |
|---|---|---|---|
| Commercial property | `data/commercial-property.jsonl` | 3,339 | `id` (PropertyId) |
| Commercial listing summary | `data/commercial-listing-summary.jsonl` | 1,022 (741 Active) | `id` |
| Location occupancy (tenancies) | `data/location-occupancy.jsonl` | 74,093 | `id`; current = no `toDate` key, or `toDate` after today (the key is absent, not null, on open tenancies) |
| Company detail (tenants) | `data/company-detail.jsonl` | 49,575 | `id` = `tenantLocationId` |
| Commercial sale comp | `data/commercial-sale-comp.jsonl` | 6,120 | `id` |
| Apartment listing | `data/apartment-listing.jsonl` | 1,747 | `propertyId` |
| Residential listings / features | `data/residential-*.jsonl` | 2,120 / 1,899 | out of scope |
| Starter list | `commercial-properties.csv` | 13,147 rows | `PropertyId, MatterportModelId, Address, City, State` |

**Joins:**
- `listing.propertyId` → `property.id`
- `listing.forLeaseSummary.spaces[].propertyId` → `property.id`
- `occupancy.propertyId` → `property.id`
- `occupancy.tenantLocationId` → `company.id`
- `comp.entities[].propertyId` → `property.id`
- `property.attachments[].videoKey` (when `videoExternalReferenceType` is 36 or 234) = Matterport model id = CSV `MatterportModelId`

**Coverage:**

| | Count |
|---|---|
| Multifamily | 2,765 (83%) |
| Office | 289 |
| Industrial | 122 |
| Retail | 65 |
| Hospitality | 55 |
| Flex | 31 |

- All 3,339 properties are geocoded.
- Active on-market lease spaces (parent listing `listingStatus = 1`): 3,955, of which 3,610 are non-apartment. 2,196 have a rate and 1,400 have a floor-plan image.
- Advertised non-apartment spaces with a suite-matched Matterport caption: **110, across 78 properties** (count from `lib/data/matching.ts`, pinned by `tests/data/build-db.test.ts`; an earlier hand count said 122 / 85).
- A further direct link exists on 20 spaces: the space's own `floorPlan.videoKey`. Where both signals exist (7 spaces) they always agree. Contract value: `space_floorplan_videokey`.
- Active non-apartment sale listings: 56 (30 with an asking price, 4 with a cap rate).
- Sale comps on non-apartment properties: 1,270 (639 with a price). Always carry `salePriceStatus`.

**Field gotchas:**
- Available is not vacant (`models/commercial-listing-summary.md`).
- A rate of `0` means no rate recorded.
- **Real field paths** (verified in DATA-01, #51):
  - geocoding: `primaryAddress.latitude/longitude` (fallback `addresses[0]`), not top level
  - space rate: `rateLow` / `rateHigh`, not `rate`
  - space area: `squareFeetMin` / `squareFeetMax`, not `availableSpaceSquareFeet`
  - floor: `floorName` is an integer `FloorName` enum (24 = FirstFloor), not a floor number
- **Active status:** `dateOffMarket` doesn't exist on spaces, so don't filter on it. Use the parent listing's `listingStatus = 1`. `isLeasePending` is the only source of `lease_pending`.
- **Portfolio sales:** when a comp has several `entities`, `soldForPrice` is the whole sale. Never show it as one property's price (DuckDB keeps it in `portfolio_sold_for_price`).
- **Duplicates:** the kit repeats some attachments and comp entities. The DuckDB build deduplicates them.
- `rateBasis`: 1 = Monthly, 2 = Yearly. Normalize to $/SF/yr.
- Always keep `serviceType` (TripleNet, FullServiceGross, PlusElectric, …). Rents are not comparable across service types.
- Retail area is `propertyRetail.grossLeasableAreaSquareFeet`.
- Retail extras: `propertyRetail.structural.ceilingHeightFeet` and `propertyRetail.frontage[]{frontageInFeet, numCurbCuts}`.
- `primarySubmarketName` is always empty. Use ids only.
- Emails and phones are fake. Broker names are real.
- `attachmentUri` CoStar CDN links returned HTTP 403 to a plain server request. Browser loading has not been verified.

**Not available:** demographics, foot traffic, POI census, zoning rules (only a code string), submarket statistics, construction costs.

## 2. Matterport

- **Model API:** `POST https://api.matterport.com/api/models/graph`
  - Auth: HTTP Basic `MATTERPORT_API_KEY:MATTERPORT_API_TOKEN`.
  - The org holds 14,944 models. 25 of 25 sampled CoStar model ids were accessible (public, active).
- **Useful `Model` fields:**
  - Identity and location: `name`, `address{address}`, `geocoordinates{latitude, longitude}` (missing on some models)
  - Size and layout: `dimensions(units: imperial){areaFloor}`, `floors{label, dimensions, rooms}`, `rooms{classifications{label, confidence}, dimensions(units: imperial){areaFloor, width, depth}}` ("Void" rooms have no dimensions)
  - Imagery: `panoLocations{id, position, resolutions, skybox(resolution:"2k"){children}}` (6 cube faces)
  - Assets: `assets{photos{url, downloadUrl, width, height}, floorplans(formats:["png"]){url, flags}}` (formats include jpg, png and **dxf**)
  - Publishing: `publication{published, url}`
  - Possibly useful but untested: `generatedDescription`, `objectAnnotations`, `propertyClassifications`
- **Asset URLs** are signed and expire after about 1 hour. Re-sign them server-side when needed.
- **Embed:** `https://my.matterport.com/show/?m=<id>` returns 200 with no `X-Frame-Options`, so it can go in an iframe.
- **SDK key:** the allowed domain is `localhost` only. Treat it as public (`NEXT_PUBLIC_MATTERPORT_SDK_KEY`).
- **Never mutate models.** No Mattertag or label writes.

## 3. Vexcel API v2

- **Base:** `https://api.vexcelgroup.com/v2/`. Header: `x-api-key: $VEXCEL_API_KEY`. (`?token=` returns 401. `Bearer` returns 401.)
- **Coverage lookup:** `GET ortho/collections?wkt=POINT(lon lat)&srid=4326&layer=urban` returns GeoJSON with `{collection, product-type}`. `oriented/collections` works the same way and adds `nadir` plus `oblique-*`. `dsm/collections` and `3d/collections` also exist.
- **Top-down image:** `GET ortho/extract?layer=urban&srid=4326&wkt=POLYGON((...))` returns a JPEG with XMP metadata: geometry, collection, capture dates, GSD, camera.
- **Angled image:** `GET oriented/extract?layer=urban&srid=4326&wkt=POLYGON((...))&product-type=oblique-north` returns a JPEG. A POINT returns 404 "No image matching".
- `format`, `dst_width` and `dst_height` were ignored in testing (output stayed a full-resolution JPEG).
- **Coverage:**
  - Houston: `us-tx-houston-2026`, urban, captured 2025-12-19 to 2026-01-02, GSD about 7.2–7.9 cm.
  - LA: `us-ca-losangeles-2025`, min GSD 5.6 cm.
- **Unknown routes return 500**, not 404.
- **Constraints:**
  - The API sends `X-Frame-Options: DENY` and `cache-control: no-store`, so always proxy through our server.
  - Images carry a "© Vexcel Imaging US, Inc." watermark. Keep attribution.
  - Storage, caching and ML terms are **unconfirmed**. Ask the sponsor before persisting images or putting them in exports.
- **No property id.** Match by building a polygon from CoStar lat/lon (about ±80 m).

## 4. Cross-dataset linking

```
CoStar PropertyId ──videoKey──► Matterport model id      (exact)
CoStar space.suite ──caption text──► Matterport model     (heuristic: "Suite 100 - 9,889SF")
CoStar lat/lon ──WKT polygon──► Vexcel extract            (spatial)
```

**Verified at all three layers:**

| Property | PropertyId | Notes |
|---|---|---|
| **2600 Travis St, Houston** | 1018657 | Suites 100 and 104 matched to their 3D models |
| 6003 Bellaire Blvd, Houston | 353482 | Suite I matched |
| 800 E 12th St, LA | 5528958 | 3D shows suites 322–325, which aren't in the active listing |

## 5. Optional third-party (BONUS only, labelled as non-sponsor)

- **Census ACS 5-year** (tract-level population, income, age). Free API. BONUS-02.
- **POI / competitors** (Google Places or Overture). BONUS-03.
