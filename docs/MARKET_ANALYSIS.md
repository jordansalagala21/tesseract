# Market Analysis & Scoring Methodology

Owner: Dev 1 (`lib/market`, `lib/finance`). This is a transparent prototype heuristic, **not** a validated underwriting model.

## 1. What "market analysis" can mean with our data

| Signal | Source | Caveat |
|---|---|---|
| Comparable advertised spaces within radius R | `spaces` table (kit properties only) | A subset of the market, so show the sample size `n` |
| Asking-rent range ($/SF/yr), by `spaceUse` and `serviceType` | `forLeaseSummary.spaces[]` | Asking ≠ achieved. Don't mix NNN with gross. Exclude zero rates. Weight by SF when averaging. |
| Lease deal rents (askingRate / rateActual / effectiveRate) | `location-occupancy.leaseDeal` | Sparse (rateActual on about 2k records). Label the rent type. |
| Nearby tenants by industry | `location-occupancy` + `company-detail.profile.industryType` | Only tenants of kit buildings. Not a competitor census. |
| Sale comps | `commercial-sale-comp` | Always carry `salePriceStatus`. Many prices are undisclosed. |
| Subject building tenants | occupancies on the subject property | Possible synergy or conflict (e.g. F45 already at 2600 Travis) |

Every `MarketAnalysis` includes `limitations`, for example "Kit covers CoStar's Matterport-list properties only; no demographic or foot-traffic data."

## 2. Rent normalization (see kit `concepts/metrics-and-formulas.md`)

```
psfYear = rateBasis == Monthly ? rate × 12 : rate        (rate = rateLow / rateHigh; 0 → null; unknown basis → null)
```

- Keep `serviceType` with every value.
- Present ranges per service type.
- Never convert NNN to gross without a user-supplied NNN estimate, labelled as an assumption.

## 3. Candidate uses (`lib/market/uses.ts`)

Starter catalogue:

- restaurant / bar
- café / coffee
- fitness / boutique studio
- coworking
- specialty retail
- medical / dental office
- creative office / studio
- event or entertainment space

Each use defines requirements with an evidence type:

| Requirement | Evidence |
|---|---|
| SF range | CoStar `sfMin` / `sfMax` (fact) |
| Ground floor / street frontage | `floorName`, `frontageInFeet` (fact) |
| Ceiling height minimum | `ceilingHeightFt` (fact), or vision (observation) |
| Plumbing / kitchen evidence | Matterport room class "Kitchen"/"Bathroom" (fact), vision (observation) |
| Open floor plate | room count, room dimensions, vision |
| Parking / access | `parkingRatio` and frontage curb cuts (facts), Vexcel vision (observation) |
| Rent tolerance | user budget or the use's typical tolerance. The default is labelled; we never claim it as market data. |

## 4. Deterministic score (`lib/market/scoring.ts`)

Four components, each 0–100 or **null**:

| Component | Default weight | Inputs |
|---|---|---|
| Physical fit | 35% | SF fit, floor, ceiling, room types, open area, existing build-out |
| Market context | 25% | Comparable rents vs asking, nearby tenant mix, subject tenancy. **Often null or "limited"** given the data. |
| Access / site | 20% | Frontage, curb cuts, parking ratio, aerial observations (corner, surface lot) |
| Economic fit | 20% | Asking rent vs budget or use tolerance, occupancy cost from the lease scenario |

- `overall` = weighted mean, **only if** physical and economic are non-null. Re-normalize the weights over the non-null components and say so.
- **Blockers** (e.g. permitted use unverified, no ground floor for retail) sit outside the score and are always shown.
- `verdict`:
  - `promising` if overall ≥ 70 with no hard blockers
  - `possible` if 50–69
  - `unlikely` if below 50
  - `insufficient_evidence` if overall is null
- Weights are user-adjustable in the UI (UI-10). The LLM explains scores and never sets them.

## 5. Financial scenarios (`lib/finance`)

**Lease** (operator or tenant):
```
annualOccupancyCost = SF × (baseRentPsfYear + nnnPsfYear)
monthlyOccupancyCost = annualOccupancyCost / 12
breakEvenMonthlyRevenue = (monthlyOccupancyCost + otherMonthlyOpex) / targetOccupancyCostRatio   // ratio is a labelled assumption
paybackYears = buildOutCost / (annual operating profit)        // only if revenue assumptions are given
```

**Acquisition** (investor):
```
GPI = rentableSf × marketRentPsfYear
EGI = GPI × (1 − vacancyAllowancePct)
NOI = EGI − rentableSf × operatingExpensePsfYear
capRate = NOI / purchasePrice
annualDebtService = standard amortization(loan = purchasePrice + capex − equity, rate, years)
cashOnCash = (NOI − annualDebtService) / equity
```

- Every input is an `Assumption` with `origin` (`user` | `costar` | `default`).
- Missing input → that output is `null`, plus a warning.
- The disclaimer is fixed by the schema.

## 6. Persona emphasis (AI-07)

| Persona | Emphasis |
|---|---|
| Owner | Best uses for this property or suite. Physical and access weight up. Tenant-profile suggestions. |
| Investor | Separate acquisition vs lease/reposition sections. Economic weight up. Risks first. |
| Entrepreneur | Space ranking for one concept. Rent fit and physical fit first. Shortlist with broker questions. |
