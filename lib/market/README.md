# lib/market — Market intelligence & scoring (OWNER: Developer 1)

| Planned module | Issue | Responsibility |
|---|---|---|
| `analyze.ts` | AI-04 ✅ | `analyzeNearby()`: DATA-07 nearby context → `MarketAnalysis`, cited evidence, per-use market signals; always returns `limitations` |
| `rent.ts` | AI-04 ✅ | Comparable rent = same serviceType **and** spaceUse, or none (recorded as `missing`). Rates arrive normalized to $/SF/yr from DATA-07 |
| `scoring.ts` | AI-05 ✅ | `scoreUse()`: cited site facts + market signals → 4 `ScoreComponent`s, overall, blockers (hard/soft), verdict; `null` when evidence is missing |
| `uses.ts` | AI-05 ✅ | 6 candidate uses and their requirements (planning heuristics, labelled as such) |

See `docs/MARKET_ANALYSIS.md`.
