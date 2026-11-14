# scripts — Data import & validation (OWNER: Developer 2)

| Script | Issue | Status | Purpose |
|---|---|---|---|
| `build-db.ts` (`npm run db:build`) | DATA-01 | **done** | Load `$COSTAR_KIT_DIR/data/*.jsonl` into `$DUCKDB_PATH`; build normalized tables (`properties`, `spaces`, `tenants_current`, `comps`, `matterport_models`, `sale_listings`) |
| `verify-matches.ts` | DATA-06 | planned | Check CoStar ↔ Matterport ↔ Vexcel links for the demo properties |

Scripts read the kit from outside the repo and write only to gitignored paths (`data/`, `.cache/`).

## `npm run db:build`

Reads `.env.local` itself (`tsx` does not do it the way `next` does) and falls back to the ambient
environment, so CI and tests can supply `COSTAR_KIT_DIR` in the shell. Rebuilds are idempotent —
every table is `CREATE OR REPLACE`. A clean build takes about 6 seconds and produces:

| Table | Rows |
|---|---|
| `properties` | 3,339 |
| `spaces` | 3,955 |
| `tenants_current` | 11,179 |
| `comps` | 17,339 |
| `sale_listings` | 107 |
| `matterport_models` | 10,521 |

### Kit facts that differ from `docs/DATA_SOURCES.md`

Verified against the kit on 2026-11-14; the importer follows these, not the doc.

- **`dateOffMarket` is null on all 3,955 spaces.** Filtering on it is a silent no-op. "Advertised
  available" comes from the parent listing's `listingStatus = 1`; `isLeasePending` (6 spaces) is
  the only source of `lease_pending`.
- **Field paths**: geocoding is on `primaryAddress` / `addresses[]`, not top level; a space's rate
  is `rateLow`/`rateHigh`, not `rate`; its area is `squareFeetMin`/`squareFeetMax`, not
  `availableSpaceSquareFeet`.
- **`toDate` is absent, never null**, on 11,179 occupancy records. A JS `=== null` filter would
  call every current tenancy expired; the SQL `IS NULL` test is correct.
- **Suite-matched 3D is ~110 spaces / 78 properties**, not the 122 / 85 the doc states. The count
  depends on the matcher, so the test asserts `lib/data/matching.ts`'s own output.
- **Two Matterport link signals**, each recorded in `matterport_models.link_method`:
  `caption_suite_match` (110 spaces, a text heuristic) and `space_floorplan_videokey`
  (20 spaces, direct). Where both exist they agree, which is what justifies the heuristic.
  The contract's `AvailableSpace.matterport.linkMethod` only admits the first — extending it
  needs a `contracts` PR from Dev 1.
- **The kit duplicates attachments** (1018657 lists each of its two models twice, and 189
  property/model/suite groups appear under several captions), so `matterport_models` is
  deduplicated to one row per `(property, model, suite)`.
- **125 priced sale comps carry `salePriceStatus = 0` (Unknown)**, so `comps` keeps both
  `sale_price_status_id` (raw, never null where there is a price) and `sale_price_status`
  (decoded, null for Unknown).
- **One current tenancy has a dangling `tenantLocationId`** (25111053, absent from
  `company-detail`), and 1,835 more have none at all — hence the LEFT JOIN.
