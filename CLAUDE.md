# CLAUDE.md — Tesseract shared context

> Every Claude Code session on this repo (three developers, working in parallel) MUST follow this file.
> Next.js-specific agent rules are in @AGENTS.md. This repo uses **Next.js 16**: read the relevant guide in
> `node_modules/next/dist/docs/` before writing framework code (route handlers use `RouteContext<'/path/[id]'>` and `await ctx.params`).

## 1. Product in one paragraph

**Tesseract — "Discover what spaces could become."** An agentic AI platform for HackPrinceton 2026 (CoStar track).
It combines CoStar commercial real estate data, Matterport 3D digital twins, Vexcel aerial imagery, and a Claude agent
to suggest evidence-backed alternative uses for commercial space. One shared intelligence engine serves three personas:

| Persona | Starts with | Gets |
|---|---|---|
| **Property owner** | A property (and optionally an advertised suite) | Ranked reuse opportunities with evidence, risks, and a 3D walkthrough |
| **Investor with capital** | Capital, risk, markets, horizon | Property + business opportunity screens, with **leasing and acquisition analyzed separately** |
| **Business starter** | Business idea, size, budget | Suitable advertised spaces with 3D tours and fit explanations |

Details: `docs/PRODUCT.md`, `docs/USER_FLOWS.md`. Demo property: **2600 Travis St, Houston — CoStar PropertyId 1018657** (`docs/DEMO.md`).

## 2. Hackathon objectives (judging: data use 30%, agentic depth 30%, usefulness 25%, polish 15%)

P0: real CoStar data · working Matterport 3D viewer · Vexcel imagery · owner analysis · agent tool calling · evidence-backed recommendations · basic market + financial feasibility.
P1: investor flow · business-starter flow · what-if analysis · Market Intelligence dashboard polish.
P2: Census demographics · AI renders · marketplace · advanced forecasting.

## 3. Architecture (one Next.js app — no microservices)

```
app/            UI pages (Dev 3) + app/api/** route handlers (owner per route, see §5)
components/     UI components (Dev 3)
lib/contracts/  Shared TS types + Zod schemas — THE interface between workstreams (Dev 1 owns, team reviews)
lib/data/       CoStar (DuckDB), Matterport, Vexcel, matching, nearby queries (Dev 2)
lib/agent/      Claude orchestrator, tools, vision, evidence registry (Dev 1)
lib/market/     Market analysis, rent normalization, deterministic scoring (Dev 1)
lib/finance/    Pure financial scenario functions (Dev 1)
lib/config/     Server-only env access (Dev 1)
scripts/        DuckDB import + verification scripts (Dev 2)
tests/          Vitest tests (each dev tests their own modules)
docs/           Project documentation
```

Data flow: UI → `app/api/*` → `lib/agent` → tools → `lib/data` / `lib/market` / `lib/finance` → contract types → UI.
Full detail: `docs/ARCHITECTURE.md`. Contracts: `lib/contracts/*.ts`; fixtures for parallel work: `lib/contracts/examples/travis.ts`.

## 4. Real data sources and VERIFIED limitations

Read `docs/DATA_SOURCES.md` before touching data. Key facts:

- **CoStar is a static kit, not an API.** 8 JSONL datasets, ~3,339 properties (Houston 1,758 / LA 1,581), **83% apartments**. Load into DuckDB. Kit path from `COSTAR_KIT_DIR`; field docs in `$COSTAR_KIT_DIR/models/*.md`; enums in `$COSTAR_KIT_DIR/schemas/enums.json`.
- **Availability ≠ vacancy.** Listings are *advertised availability*. **Never label anything "vacant".** UI copy: "Advertised available".
- No demographics, foot traffic, POI census, zoning rules, submarket statistics, or construction costs in sponsor data.
- Only ~110 advertised non-apartment spaces (78 properties) have a suite-matched Matterport model by caption text match, plus 20 with a direct `floorPlan.videoKey` link. Active spaces come from the listing's `listingStatus = 1` (there is no `dateOffMarket`). Field-path gotchas: `docs/DATA_SOURCES.md`.
- **Matterport**: GraphQL `POST https://api.matterport.com/api/models/graph` (HTTP Basic key:token). Embed: `https://my.matterport.com/show/?m=<id>` works in an iframe. SDK key allowed domain = **localhost only**. Asset URLs are signed, expire ~1 h.
- **Vexcel v2**: `https://api.vexcelgroup.com/v2/` with header **`x-api-key`** (not `token=`, not Bearer). Working: `ortho/collections`, `oriented/collections`, `ortho/extract`, `oriented/extract` (POLYGON wkt, `product-type=oblique-north|south|east|west`). API sends `X-Frame-Options: DENY` → always proxy through our server. Images are watermarked "© Vexcel Imaging US, Inc." — keep attribution. Storage/ML terms unconfirmed.
- Scanned Matterport area ≠ leasable area (Suite 100: 8,879 scanned vs 9,889 SF advertised).

## 5. Ownership — who may edit what

| Path | Owner |
|---|---|
| `lib/agent/`, `lib/market/`, `lib/finance/`, `lib/config/`, `lib/http.ts`, `lib/contracts/` | **Dev 1 — Tech Lead / AI & Market** |
| `app/api/analyze`, `app/api/analysis`, `app/api/market`, `app/api/finance` | Dev 1 |
| `lib/data/`, `scripts/` | **Dev 2 — Data Engineer** |
| `app/api/properties/**`, `app/api/imagery/**` | Dev 2 |
| `app/` (everything except `app/api`), `components/`, `app/globals.css` | **Dev 3 — Frontend** |
| `tests/` | Each dev owns tests for their own modules (`tests/<area>/...`) |
| `docs/`, `CLAUDE.md`, `.github/`, `package.json` | Dev 1 (others propose via PR) |

**MANDATORY RULE: Do not modify files owned by another developer unless explicitly instructed. Do not implement duplicate functionality that belongs to another workstream.**

If you need something from another workstream: use the contract type + fixtures, and open/comment on an issue. Do not write a "temporary" version of their module.

## 6. Data integrity rules (non-negotiable)

1. Every user-visible claim is an `Evidence` item of exactly one kind: `verified_fact`, `ai_observation`, `user_assumption`, `missing`. Schemas enforce this (`lib/contracts/evidence.ts`).
2. Never fabricate demographics, foot traffic, competitor counts, property values, rents, or returns. If we don't have it → `missing` evidence or `score: null`.
3. Never call a listing "vacant". Status values are `advertised_available` / `lease_pending` only.
4. AI vision output is always `ai_observation` with a caveat; never a measurement, inspection, code, ADA or zoning determination.
5. Financial outputs come only from labelled `Assumption`s (`origin: user | costar | default`) and show their formulas. Lease and acquisition are separate.
6. CoStar rate `0` means "no rate" → `null`. Normalize rents to $/SF/yr and keep `serviceType`.
7. Carry `SourceRef` (dataset + record id + field) on every fact so the Evidence Trail can link back.
8. Fixtures in `lib/contracts/examples/` are for development only — never shown as real output.

## 7. Security rules

- Secrets only in `.env.local` (gitignored). Add new vars to `.env.example` (names only) and `lib/config/env.ts`.
- Server code reads secrets via `serverEnv()` (imports `server-only`). Never `NEXT_PUBLIC_` a secret. The only public var is `NEXT_PUBLIC_MATTERPORT_SDK_KEY`.
- Never send a URL containing a key to the browser; proxy Vexcel and re-sign Matterport URLs server-side.
- Never commit sponsor data (`*.jsonl`, kit folders), DuckDB files, downloaded imagery, or API response dumps.
- Never print credentials in logs, tests, PRs, or issues.

## 8. Coding conventions

- TypeScript strict; no `any` in exported APIs. Import shared types from `@/lib/contracts`.
- Validate every route input with the contract's Zod schema; return errors via `apiError()` from `lib/http.ts`.
- Route handlers stay thin: parse → call a `lib/*` function → return contract type.
- Server-only modules: add `import "server-only"`.
- Prefer small pure functions; no premature abstraction or refactors of others' code.
- UI: Tailwind + shadcn/ui (`npx shadcn@latest add <component>`), mobile-first, every data panel shows its source and an "advertised availability ≠ vacancy" note where relevant.
- Names: files `kebab-case.ts`, components `PascalCase.tsx`, contract schemas `PascalCase` with same-named type.

## 9. Git & GitHub workflow

- `main` is protected: **all changes via PR**, 1 approving review, CI green.
- Branch per issue: `feat/<ISSUE-ID>-short-name` (e.g. `feat/DATA-01-costar-import`, `fix/UI-03-iframe-height`).
- One issue per PR; title `DATA-01: Import CoStar datasets into DuckDB`; body uses the PR template and `Closes #<n>`.
- `git pull --rebase origin main` often; rebase before opening a PR. Never force-push `main`. Never rewrite another dev's commits.
- Contract changes: separate small PR labelled `contracts`, reviewed by every consuming workstream, merged before dependent work.

Details: `docs/DEVELOPMENT_WORKFLOW.md`, `docs/TEAM.md`.

## 10. Testing requirements

Before every push: `npm run check` (lint + typecheck + vitest). CI runs lint, typecheck, test, build.
- Dev 1: unit tests for finance formulas, scoring, evidence integrity; one orchestrator test with mocked tools.
- Dev 2: tests for enum decoding, rent normalization at import, suite matching, and a `1018657` lookup test (skipped when `COSTAR_KIT_DIR` is unset — CI has no sponsor data).
- Dev 3: components render with fixtures; manual check of the Travis St flow; screenshots in PRs.
- Network tests against Matterport/Vexcel are manual/opt-in only (never in CI; never commit responses).

## 11. What NOT to build

Citywide/national search · Trenton or other markets · marketplace/outreach · user accounts/auth · persistent DB beyond DuckDB + in-memory analysis store ·
construction-cost estimates · zoning/code verification · writing Mattertags or any mutation of Matterport models · microservices · Python services.

## 12. Preventing merge conflicts

- Stay inside your owned directories (§5). Shared files (`package.json`, `lib/contracts/*`, `CLAUDE.md`) change only in small, dedicated PRs.
- Adding a dependency? Mention it in the PR; rebase right before merging to resolve `package-lock.json` cleanly (`npm install` then commit the lockfile).
- If CI fails at `npm ci` with "Missing: @emnapi/… from lock file", a macOS `npm install` dropped Linux-only optional packages. Fix: `rm -rf node_modules package-lock.json && npm install`, run `npm run check`, commit the lockfile.
- Don't reformat files you aren't changing. Don't rename/move others' files.
- New shadcn components go in `components/ui/` (Dev 3 only).

## 13. Before you code (every session)

1. Read the issue you're working on (`gh issue view <n>`), its dependencies, and acceptance criteria.
2. Read the relevant contract in `lib/contracts/` and the fixture in `lib/contracts/examples/travis.ts`.
3. Read the relevant doc in `docs/` and, for data work, the kit's `models/<dataset>.md`.
4. For Next.js APIs, read `node_modules/next/dist/docs/` (Next 16 has breaking changes).
5. Confirm you're on a feature branch: `git switch -c feat/<ISSUE-ID>-name`.
6. Stay in scope; if the task needs another workstream's code, stop and coordinate.
