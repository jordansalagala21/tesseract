<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Tesseract — agent context

**Read `CLAUDE.md` first and follow it.** It is the shared contract for every agent and human on
this repo: product, architecture, ownership, data-integrity rules, git workflow. This file adds
only what `CLAUDE.md` does not cover: how two AI agents work this repo at the same time.

## Non-negotiables (the ones most often broken)

- **Stay inside your assigned files.** `CLAUDE.md` §5 assigns every path to one developer. Two
  agents editing one file is a guaranteed conflict and wasted work.
- **Never label a space "vacant".** CoStar gives *advertised availability*. Status values are
  `advertised_available` and `lease_pending`, and nothing else.
- **Never fabricate** demographics, foot traffic, competitor counts, rents or returns. If the kit
  does not have it, emit `missing` evidence or `score: null`.
- **Never commit** sponsor data (`*.jsonl`, the kit folder), `*.duckdb`, downloaded imagery, or
  `.env.local`. Never paste any of those into a chat window or a third-party service either —
  the CoStar kit is sponsor-licensed.
- **Secrets** live only in `.env.local`. Read them through `serverEnv()`. Never print one.
- Rate `0` means "no rate" → `null`. Rents normalize to $/SF/yr and always carry `serviceType`.

## Working alongside another agent

The repo is the shared memory. There is no chat channel between agents, so:

| Need | Mechanism |
|---|---|
| What to build | The GitHub issue (`gh issue view <n>`) |
| The interface between workstreams | `lib/contracts/*.ts` + `lib/contracts/examples/travis.ts` |
| Reasoning, questions, disagreement | **Comments on the PR or issue.** Durable and visible to the humans. |
| Collision detection | One issue per PR, CI, and the `main` ruleset (PR + 1 approval) |
| What is already done | `gh pr list`, `gh issue list`, and `git log origin/main` |

**Split work by file, never by phase.** "You write it, I review it" and "you take these files, I
take those" both work. "We both edit `lib/data/properties.ts`" does not.

Before starting, check nobody else has the issue: `gh issue view <n>` (assignee) and
`gh pr list --state all --search <ISSUE-ID>`.

## Verified API facts (probed live on 2026-11-14 — do not re-derive)

**Matterport** — `POST https://api.matterport.com/api/models/graph`, HTTP Basic
`MATTERPORT_API_KEY:MATTERPORT_API_TOKEN`. Working query shape and real values for
`NxYn1owequw`: `name` "Suite 100 - 9,889SF", `visibility` "public",
`address{address}` "2600 Travis St, Houston, TX, 77006, US",
`geocoordinates` 29.745827/-95.375312, `dimensions(units: imperial){areaFloor}` **8878.9**,
`floors` 1 ("Floor 1"), `rooms` 22, `panoLocations` 76, `assets{photos}` 16,
`assets{floorplans(formats:["png"])}` 3, `publication{published}` true.
Rooms classified `Void` have **no** dimensions. Scanned area ≠ leasable area (8,879 scanned vs
9,889 advertised) — never present one as the other. Asset URLs are signed and expire in ~1 h.
**Never mutate a model.**

**Vexcel** — `https://api.vexcelgroup.com/v2/`, header **`x-api-key`** (`?token=` and `Bearer`
both 401). `GET ortho/collections?wkt=POINT(lon lat)&srid=4326&layer=urban` returns GeoJSON;
for the demo property it gives collection `us-tx-houston-2026`, product-type `final-ortho`.
`ortho/extract` and `oriented/extract` (`product-type=oblique-north|south|east|west`) take a
POLYGON WKT and return JPEG. A POINT to `extract` is a 404. The API sends
`X-Frame-Options: DENY`, so **always proxy through our own route** — never hand a Vexcel URL or
the key to the browser. Images carry a "© Vexcel Imaging US, Inc." watermark: keep attribution.
Unknown routes return 500, not 404.

**CoStar kit** — see `scripts/README.md` for the field paths and the kit facts that differ from
`docs/DATA_SOURCES.md` (`dateOffMarket` is absent, not null; rates are `rateLow`/`rateHigh`;
geocoding is on `primaryAddress`; `toDate` is absent rather than null on current tenancies).

## Current state (2026-11-14)

- **Merged:** DATA-01 (#51) — `npm run db:build` builds six DuckDB tables from the kit.
- **In review:** DATA-02 (#55), DATA-03 (#56, stacked on #55), DATA-07 (#58).
- **Open, unblocked:** DATA-04 (Matterport client), DATA-05 (Vexcel client), DATA-06 (cross-source
  verification, needs 04 and 05).
- **Not started:** AI-01…AI-07 (Dev 1) and the INT issues that wire the agent to the data.

Run `npm run db:build` once locally before touching anything that reads the database; DB-dependent
tests skip themselves when `$DUCKDB_PATH` is absent, which is how CI stays green without the kit.
