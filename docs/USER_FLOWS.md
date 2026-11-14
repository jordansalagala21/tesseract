# User Flows

All three flows end in the same **results workspace**:

- **Left:** a 3D, floor plan, aerial and oblique tab set.
- **Right:** the agent timeline and Opportunity Reveal.
- **Drawer:** the Evidence Trail.

## Shared rules

- Wherever spaces appear, show "Advertised availability (CoStar listings), not confirmed vacancy."
- Evidence is grouped into four labelled buckets: Verified facts · AI observations · Your assumptions · Missing info.
- Every financial number shows its inputs and lets the user edit them.

## 1. Property owner (P0)

1. Home → **"I have a property"**.
2. Search by address or name (`GET /api/properties?q=`). For the demo, pick 2600 Travis St.
3. Property page (`GET /api/properties/1018657`, `/spaces`):
   - facts card, advertised suites list, current tenants
   - 3D viewer (Suite 100 model), aerial tab
4. Pick a suite (optional) and priorities or constraints, then click **Analyze** (`POST /api/analyze` with `persona: owner`).
5. Investigation timeline streams tool calls with reasons. For example:
   - "Load CoStar facts"
   - "Open Suite 100's 3D model"
   - "Vision on 8 interior photos"
   - "Aerial and oblique context"
   - "Nearby kit tenants and spaces"
   - "Score 5 candidate uses"
6. **Opportunity Reveal:** 3 to 5 ranked uses, each with:
   - verdict and component scores (null shown as "insufficient evidence")
   - blockers, unknowns, likely changes, next steps
   - a "Why?" link that opens the evidence: a photo crop, aerial view, or CoStar field
7. What-if: change rent, NNN or build-out → `POST /api/finance/scenario`. Change a constraint (for example "needs parking") → re-analyze.
8. (BONUS) Export the Opportunity Blueprint.

## 2. Investor with capital (P1, simplified)

1. Home → **"I have capital"**.
2. Form: capital, risk tolerance, markets (Houston/LA), horizon, strategy (lease, acquire, either), optional target return.
3. `POST /api/analyze` with `persona: investor`. The agent screens:
   - active non-apartment sale listings (56, 30 priced) for **acquisition**
   - high-availability buildings with 3D coverage for **lease / reposition** ideas
4. Results come in two separate sections:
   - **Acquisition:** scenarios use the asking price where it exists, or a user-entered price. NOI and cap rate come from labelled assumptions.
   - **Lease / operate:** advertised space plus a plausible use, with occupancy-cost scenarios.
5. Drill into any property, which opens the owner-style workspace.

## 3. Starting a business (P1)

1. Home → **"I have an idea"**.
2. Form: business concept, SF range, max rent ($/SF/yr or monthly, normalized by the UI), market, must-haves.
3. `POST /api/analyze` with `persona: entrepreneur`. The agent:
   - calls `search_available_spaces`
   - ranks candidates by physical fit, rent fit, 3D availability and nearby kit tenants
   - runs interior and exterior analysis on the top 2 or 3
4. Results: compare 3 candidate spaces side by side, tour each in 3D, and see the occupancy cost at asking rent.
5. Output: a shortlist plus questions to ask the broker or landlord.

## Error and empty states

- No 3D model for the suite → show the building-level model with the label "Model shows another part of the building", or no viewer.
- No rate published → "Rate not published (call for rate)".
- Vexcel unavailable → fall back to the CoStar aerial attachment if allowed. Otherwise show "Aerial unavailable".
- Agent step fails → mark the tool call as failed, continue with what we have, and add a `missing` evidence item.
