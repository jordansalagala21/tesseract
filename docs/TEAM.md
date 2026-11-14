# Team & Ownership

| Dev | Role | GitHub | Owns |
|---|---|---|---|
| **Dev 1** | Tech Lead / AI & Market Intelligence | `@jordansalagala21` | `lib/agent/`, `lib/market/`, `lib/finance/`, `lib/contracts/`, `lib/config/`, `lib/http.ts`, `app/api/{analyze,analysis,market,finance}`, docs, CI |
| **Dev 2** | Data Engineer | _TBD_ | `lib/data/`, `scripts/`, `app/api/properties/**`, `app/api/imagery/**` |
| **Dev 3** | Frontend Engineer | _TBD_ | `app/` (except `app/api`), `components/`, `app/globals.css` |

Fill in the GitHub usernames once confirmed. After that, issues get assigned and `.github/CODEOWNERS` gets enabled.

> **Do not modify files owned by another developer unless explicitly instructed. Do not implement duplicate functionality that belongs to another workstream.**

## Responsibilities

### Dev 1: Tech Lead / AI & Market
- Architecture, integration and contract stewardship
- Agent orchestration and tool calling (AI-01, AI-02)
- Evidence-grounded recommendations (AI-03)
- Market feasibility (AI-04) and deterministic scoring (AI-05)
- Financial what-if calculations (AI-06) and persona logic (AI-07)
- PR reviews, merge coordination, and the final demo

### Dev 2: Data Engineer
- DuckDB import of the CoStar kit (DATA-01)
- Property search and lookup (DATA-02, DATA-03)
- Matterport metadata and viewer references (DATA-04)
- Vexcel imagery proxy (DATA-05)
- Cross-dataset matching (DATA-06) and nearby queries (DATA-07)
- Census, if time allows (BONUS-02)

### Dev 3: Frontend
- Homepage with three entry points (UI-01) and property search (UI-02)
- Matterport explorer (UI-03) and aerial viewer (UI-04)
- Agent timeline (UI-05), Opportunity Reveal (UI-06), Market dashboard (UI-07), Evidence Trail (UI-08)
- Investor and entrepreneur forms (UI-09) and financial controls (UI-10)

## Interfaces between workstreams

| From → To | Interface | Unblocked by |
|---|---|---|
| Dev 2 → Dev 3 | `GET /api/properties*` returning `PropertySummary`, `Property`, `AvailableSpace`, `MatterportModel` | Fixtures in `lib/contracts/examples/travis.ts` |
| Dev 2 → Dev 1 | `lib/data` functions returning contract types | Same fixtures (mock them in tests) |
| Dev 1 → Dev 3 | `POST /api/analyze`, `GET /api/analysis/[id]` → `AnalysisResponse`; `/api/finance/scenario`; `/api/market/analyze` | `travisAnalysisFixture` |

## Communication

- Status lives on the GitHub Project board. Move your own cards.
- Blocked? Comment on the issue, tag the owner, and put the card in "Ready" with a `blocked` label.
- Contract changes: post in team chat, then open a small `contracts` PR.
- Integration checkpoints:
  - **H+8:** data APIs live
  - **H+16:** agent end to end on Travis St
  - **H+22:** UI wired to real data
  - **H+28:** feature freeze
