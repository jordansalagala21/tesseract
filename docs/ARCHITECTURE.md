# Architecture

## Principles
- **One Next.js 16 app.** Route handlers form the backend. No separate services.
- **Contracts first.** `lib/contracts` (Zod + TypeScript) is the only interface between workstreams.
- **Server owns secrets.** All sponsor and LLM calls run in route handlers or server modules.
- **Evidence everywhere.** Every data function attaches a `SourceRef`, and every agent claim references an `Evidence` id.

## Component diagram

```
Browser (Dev 3)
  app/(pages) ── components/ ── Matterport iframe (my.matterport.com/show/?m=ID)
      │  fetch JSON (contract types)
      ▼
Route handlers  app/api/**
  properties/* (Dev 2)   imagery/* (Dev 2)   analyze, analysis/[id], market/analyze, finance/scenario (Dev 1)
      │
      ▼
lib/agent (Dev 1) ── Claude API (tool use + vision)
  tools ──► lib/data (Dev 2) ──► DuckDB (CoStar kit) │ Matterport GraphQL │ Vexcel v2
        ──► lib/market (Dev 1) ──► uses lib/data queries
        ──► lib/finance (Dev 1) (pure functions)
```

## Runtime stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.4 App Router, React 19, TypeScript strict |
| UI | Tailwind v4 + shadcn/ui (`components/ui`), lucide icons |
| Validation | Zod 4 (`lib/contracts`) |
| CoStar | `@duckdb/node-api` (in `serverExternalPackages`). The DB file is built by `scripts/build-db.ts`. |
| Matterport | GraphQL Model API (server) + Showcase iframe (client). Showcase SDK is optional and works on localhost only. |
| Vexcel | REST v2 with an `x-api-key` header, proxied by `app/api/imagery/vexcel/*` |
| AI | `@anthropic-ai/sdk`. Orchestrator and vision: `claude-opus-5-5`. Fast extraction: `claude-haiku-5-5`. |
| Tests | Vitest (`tests/**/*.test.ts`) |
| CI | GitHub Actions: lint, typecheck, test, build |

## Internal API (contracts in `lib/contracts/api.ts`)

| Route | Request | Response | Owner / issue |
|---|---|---|---|
| `GET /api/properties` | `PropertySearchQuery` (query string) | `PropertySearchResponse` | Dev 2 / DATA-02 |
| `GET /api/properties/[id]` | — | `PropertyDetailResponse` | Dev 2 / DATA-03 |
| `GET /api/properties/[id]/spaces` | — | `PropertySpacesResponse` | Dev 2 / DATA-03 |
| `POST /api/analyze` | `AnalysisRequest` | `AnalyzeAcceptedResponse` | Dev 1 / AI-01 |
| `GET /api/analysis/[id]` | — | `AnalysisResponse` | Dev 1 / AI-01 |
| `POST /api/market/analyze` | `MarketAnalyzeRequest` | `MarketAnalysis` | Dev 1 / AI-04 |
| `POST /api/finance/scenario` | `FinanceScenarioRequest` | `FinancialScenario` | Dev 1 / AI-06 |
| `GET /api/imagery/vexcel/{ortho,oblique}?propertyId=&dir=` | — | `image/jpeg` (proxied) | Dev 2 / DATA-05 (planned; not in the initial stub set) |

These are Tesseract endpoints, not CoStar endpoints. Every route currently returns **501** with `{error:{code:"not_implemented", issue}}` until its issue lands.

All errors use the `ApiError` envelope.

### Example: `GET /api/properties?q=travis&market=houston&limit=5`
```json
{ "items": [{ "id": 1018657, "name": null, "address": {"street":"2600 Travis St","city":"Houston","state":"TX","postcode":"77006-3540"},
  "location": {"lat":29.74587,"lon":-95.375417}, "market":"houston", "propertyType":"GeneralRetail", "buildingClass":"A",
  "rentableAreaSf":36932, "availableSpaceCount":4, "hasMatterport":true, "hasSuiteMatched3d":true }], "total": 1 }
```

### Example: `POST /api/analyze`
```json
{ "input": { "persona": "owner", "propertyId": 1018657, "spaceId": 21053094 } }
→ 202 { "analysisId": "ana_…", "status": "queued", "pollUrl": "/api/analysis/ana_…" }
```

### Example: `POST /api/finance/scenario`
```json
{ "name": "Suite 100 at asking", "input": { "mode": "lease",
  "spaceSf": {"value":9889,"origin":"costar","label":"Advertised SF"},
  "baseRentPsfYear": {"value":45,"origin":"costar","label":"Asking rent NNN"},
  "nnnPsfYear": {"value":12,"origin":"user","label":"NNN estimate"},
  "buildOutCostUsd": {"value":0,"origin":"user","label":"Build-out"} } }
```

Full typed examples: `lib/contracts/examples/travis.ts`.

## Agent design (AI-01..07)

- **One orchestrator** (Claude tool use) with a step limit (default 12). Tool names are fixed by `AgentToolName`.
- Tools:
  - `search_properties`, `search_available_spaces`, `get_property_profile`, `get_nearby_context`
  - `get_matterport_model`, `analyze_interior`, `get_aerial_imagery`, `analyze_exterior`
  - `score_uses`, `run_financial_scenario`
- Each tool call is recorded as an `AgentToolCall`. The `reason` field is shown in the investigation timeline.
- Tools return data plus new `Evidence` items. The evidence registry assigns ids. The final model output may only cite registered ids, and `AnalysisResponse` validation rejects unknown ids.
- **Deterministic scoring** (`lib/market/scoring.ts`) computes the physical, market, access and economic components. The LLM explains the scores; it does not invent them.
- **Analysis store:** an in-memory `Map` keyed by `analysisId` (hackathon scope). Optional SSE streaming of tool calls.

## Data layer (DATA-01..07)

DuckDB tables built from the kit:
- `properties`: non-apartment by default; flag column for multifamily
- `spaces`: active and on-market only, rent normalized to $/SF/yr
- `tenants_current`
- `comps`
- `matterport_models`: with `matched_suite`
- `sale_listings`

Matterport and Vexcel are fetched on demand, and their metadata is cached in memory. Licensed image bytes are only cached under gitignored `.cache/`, pending sponsor terms.

## Deployment

The local demo (`npm run dev` on localhost) is the primary target, because the Matterport SDK key is localhost-only.

Vercel deployment is optional. DuckDB's native binary and the kit data are not in the repo, so it would need a hosted DB file. Not P0.
