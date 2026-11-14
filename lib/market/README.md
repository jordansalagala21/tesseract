# lib/market — Market intelligence & scoring (OWNER: Developer 1)

| Planned module | Issue | Responsibility |
|---|---|---|
| `analyze.ts` | AI-04 | `MarketAnalysis` from nearby kit spaces, tenants and comps (via `lib/data`) — always returns `limitations` |
| `rent.ts` | AI-04 | Rent normalization to $/SF/yr; never mix service types silently (see kit `concepts/metrics-and-formulas.md`) |
| `scoring.ts` | AI-05 | Deterministic per-use requirement tables → `ScoreComponent`s; `null` when evidence is missing |
| `uses.ts` | AI-03, AI-05 | Catalogue of candidate business uses and their physical/market requirements |

See `docs/MARKET_ANALYSIS.md`.
