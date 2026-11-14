# lib/data — Data integrations (OWNER: Developer 2)

Everything that touches a sponsor source lives here. Nothing outside `lib/data` may read the CoStar kit,
call Matterport, or call Vexcel directly — other workstreams call the functions exported from here.

| Planned module | Issue | Responsibility |
|---|---|---|
| `duckdb.ts` | DATA-01 | Singleton DuckDB connection (`serverEnv().DUCKDB_PATH`), read-only at runtime |
| `properties.ts` | DATA-02, DATA-03 | `searchProperties(query)`, `getProperty(id)`, `getSpaces(propertyId)` → contract types |
| `tenants.ts` / `nearby.ts` | DATA-07 | Current tenants, nearby kit properties/spaces/comps by radius |
| `matterport.ts` | DATA-04 | GraphQL client (`POST https://api.matterport.com/api/models/graph`, Basic auth) → `MatterportModel`; fresh signed asset URLs |
| `vexcel.ts` | DATA-05 | `GET https://api.vexcelgroup.com/v2/ortho/extract` & `/oriented/extract` with `x-api-key`; returns image bytes + XMP metadata → `AerialImagery` |
| `matching.ts` | DATA-06 | Suite ↔ Matterport caption matching; coordinate checks |
| `enums.ts` | DATA-01 | Decode integer enums using the kit's `schemas/enums.json` |

Rules: return contract types from `@/lib/contracts`; attach a `SourceRef` to every record; map CoStar rate `0` → `null`;
never call anything "vacant"; never return a third-party URL that contains a key.
