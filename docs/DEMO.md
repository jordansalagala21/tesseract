# Demo Plan — 2600 Travis St, Houston

## Verified integration test property

| Item | Value |
|---|---|
| CoStar PropertyId | **1018657**: GeneralRetail / Freestanding, Class A, 4-star, 36,932 SF GLA, 2 storeys, 0.98 ac |
| Location | 29.74587, −95.375417 (Houston, submarket 4321) |
| Retail facts | Ceiling 20 ft · 203 ft frontage on Travis St · 4 curb cuts |
| Listing | 4105591, Direct lease, Active |
| Suite 100 (space 21053094) | 9,889 SF retail, **$45/SF/yr NNN**, floor plan. Matterport **NxYn1owequw** ("Suite 100 - 9,889SF", 8,879 SF scanned, 76 panos, 16 photos) |
| Suite 104 (space 21963212) | 2,946 SF, $45 NNN, floor plan. Matterport **4H2JSnQ3wSj** (2,721 SF scanned, 24 panos) |
| Suites 106 / 107 | 2,554–4,681 / 2,127–4,681 SF, $37 NNN, no 3D |
| Current tenants | F45 Training (Suite 103, fitness), Warehouse Live (entertainment) |
| Vexcel | Ortho `us-tx-houston-2026` (7.5 cm, captured Dec 2025 / Jan 2026) and oblique-north. Shows the corner site, adjacent surface lot, and glazed barrel-vault roof. |
| Observed in 3D (feasibility vision check) | Existing bar counter, banquette seating, storefront glazing onto a patio. This is an AI observation, not an inspection. |

**Backups:**
- 6003 Bellaire Blvd, Houston (353482, Suite I, model BoqDzrD8JLh). A budget storefront contrast case.
- 800 E 12th St, LA (5528958). LA coverage.

## Two-minute storyline

| Time | Beat |
|---|---|
| 0:00–0:15 | Problem: "Available space isn't the same as a space without a future." Introduce Tesseract and the three personas. |
| 0:15–0:30 | Owner → search "Travis" → 2600 Travis St → Suite 100 page: CoStar facts, 3D twin, aerial. Point out the "advertised ≠ vacant" label. |
| 0:30–1:05 | Click **Analyze**. The timeline streams: CoStar profile → 3D model → interior vision (finds the existing bar and kitchen) → aerial and oblique (corner, surface lot) → nearby tenants (F45 in the building; the agent flags a fitness-overlap risk on its own) → scoring. |
| 1:05–1:35 | Opportunity Reveal: top 3 uses with evidence chips. Click "Why?" to jump the 3D view and show the photo and CoStar field. Show the blockers (permitted use unverified) and the missing-info bucket. |
| 1:35–1:50 | What-if: cap rent at $35 → the agent re-runs and pivots to Suites 106/107 ($37), noting they have no 3D model. Edit NNN → the cost updates with its formula. |
| 1:50–2:00 | Flip to Investor and Idea entry points (same engine). Close: "Real estate platforms find buildings. Tesseract shows what they could become." |

## Demo reliability checklist

- [ ] Run on **localhost** (SDK key restriction). Check the iframe works offline from the SDK.
- [ ] Re-sign Matterport photo URLs just before the demo. They expire in about 1 h.
- [ ] Record a fallback video of a full run.
- [ ] Keep a fallback `AnalysisResponse` (a real captured run, clearly marked) in case the LLM API is slow.
- [ ] All tabs load within 3 s on venue Wi-Fi (pre-warm the cache).
- [ ] No secrets visible in the browser devtools network tab (Vexcel is proxied).
