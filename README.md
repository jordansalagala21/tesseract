# Tesseract

**Discover what spaces could become.** HackPrinceton 2026, CoStar Group track.

Tesseract is an agentic AI platform for finding opportunities in commercial real estate. It combines four sources:

- **CoStar** property and listing data
- **Matterport** 3D digital twins
- **Vexcel** aerial imagery
- a **Claude** agent

Together they suggest evidence-backed alternative uses for commercial space. It serves three users: property owners, investors with capital, and people starting a business.

> **Status:** initial scaffold. The API routes are defined by shared contracts and return `501 Not Implemented` until their issues are done. See the GitHub Project board.

## Quick start

```bash
git clone https://github.com/<owner>/tesseract.git && cd tesseract
npm ci
cp .env.example .env.local      # fill in keys from the team vault, and point COSTAR_KIT_DIR at your sponsor kit
npm run dev                     # http://localhost:3000
npm run check                   # lint + typecheck + tests
```

The sponsor data (the CoStar kit), the DuckDB files, and any downloaded imagery are **never committed**. Each developer keeps a local copy.

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind v4 and shadcn/ui
- Zod
- DuckDB, server-side, for the CoStar kit
- Matterport GraphQL plus the Showcase embed
- Vexcel API v2
- Claude API (tool use and vision)
- Vitest
- GitHub Actions

## Repository map

| Path | What | Owner |
|---|---|---|
| `app/` | Pages (Dev 3) and `app/api/**` route handlers (per route) | Dev 3 / per route |
| `components/` | UI components | Dev 3 |
| `lib/contracts/` | Shared types and Zod schemas, plus fixtures | Dev 1 (team review) |
| `lib/data/`, `scripts/` | CoStar/DuckDB, Matterport, Vexcel, matching | Dev 2 |
| `lib/agent/`, `lib/market/`, `lib/finance/` | Agent, market scoring, financial scenarios | Dev 1 |
| `docs/` | Product, architecture, data sources, team, flows, market method, demo, workflow | Dev 1 |
| `CLAUDE.md` | Shared rules for every Claude Code session | Dev 1 |

## Data integrity

- Advertised availability is **not** confirmed vacancy.
- Every claim is labelled as one of four kinds:
  - **verified fact**
  - **AI observation**
  - **user assumption**
  - **missing information**
- No fabricated demographics, foot traffic, competitor counts, values, or returns.

The full rules are in [CLAUDE.md](CLAUDE.md) and [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Docs

- [Product](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data sources](docs/DATA_SOURCES.md)
- [Team](docs/TEAM.md)
- [User flows](docs/USER_FLOWS.md)
- [Market analysis](docs/MARKET_ANALYSIS.md)
- [Demo](docs/DEMO.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
