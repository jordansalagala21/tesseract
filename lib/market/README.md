# lib/market — Market intelligence & scoring (OWNER: Developer 1)

| Planned module | Issue | Responsibility |
|---|---|---|
| `analyze.ts` | AI-04 | `MarketAnalysis` from nearby kit spaces, tenants and comps (via `lib/data`) — always returns `limitations` |
| `rent.ts` | AI-04 | Rent normalization to $/SF/yr; never mix service types silently (see kit `concepts/metrics-and-formulas.md`) |
| `scoring.ts` | AI-05 ✅ | `scoreUse()`: cited site facts + market signals → 4 `ScoreComponent`s, overall, blockers (hard/soft), verdict; `null` when evidence is missing |
| `uses.ts` | AI-05 ✅ | 6 candidate uses and their requirements (planning heuristics, labelled as such) |

See `docs/MARKET_ANALYSIS.md`.
