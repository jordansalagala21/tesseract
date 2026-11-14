# lib/finance — Financial scenarios (OWNER: Developer 1)

| Planned module | Issue | Responsibility |
|---|---|---|
| `lease.ts` | AI-06 | Occupancy cost, break-even revenue for `LeaseScenarioInput` |
| `acquisition.ts` | AI-06 | NOI, cap rate, cash-on-cash, debt service for `AcquisitionScenarioInput` |
| `defaults.ts` | AI-06 | Labelled default assumptions (origin `"default"`), each with a stated rationale |

Pure functions only (no I/O). Every output field is `null` when a required input is missing. Every result lists its formulas.
Leasing and acquisition are never blended.
