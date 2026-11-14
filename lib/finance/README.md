# lib/finance — Financial scenarios (OWNER: Developer 1)

| Module | Responsibility |
|---|---|
| `index.ts` | `runScenario(input, meta)`: dispatches on `mode`; re-exports everything below |
| `lease.ts` | Occupancy cost, break-even revenue and payback for `LeaseScenarioInput` |
| `acquisition.ts` | NOI, cap rate, debt service and cash-on-cash for `AcquisitionScenarioInput` |
| `defaults.ts` | Labelled app defaults (`origin: "default"`), each with a rationale. Not market data |
| `shared.ts` | Validation, rounding, the fixed disclaimer, default-use warnings |

Rules:
- Pure functions only (no I/O).
- An output is `null` when an input it needs is missing or impossible, and a warning says why.
- Every result lists the formulas it actually used. The formulas are in `docs/MARKET_ANALYSIS.md` §5.
- Leasing and acquisition are never blended: a lease scenario never fills acquisition outputs, and vice versa.
- No defaults for NNN, rent, price, opex, interest rate, revenue or build-out cost, because a guess would look like a fact.

Route: `POST /api/finance/scenario` (`FinanceScenarioRequest` → `FinancialScenario`).
