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

Updated after INT-04…07 to what the app actually does. A live owner run takes about 50–65 s, so the timeline is the show.

| Time | Beat |
|---|---|
| 0:00–0:15 | Problem: "Available space isn't the same as a space without a future." Home page: drag the before/after slider (real Matterport photo → AI concept, labelled as such). |
| 0:15–0:30 | **Find a property** → search "2600 Travis" → property page: CoStar facts, the Suite 100 3D tour, Vexcel aerial with capture date and credit, tenants (F45, Warehouse Live). Point out "advertised availability is not confirmed vacancy". |
| 0:30–1:20 | Click **Analyze Suite 100**. The timeline fills in live: CoStar profile → 3D scan → interior vision (bar counter, booths, glazing, patio) → aerial vision (corner site, frontage) → nearby market (no comparable retail rent nearby, which is recorded as missing) → scores. Narrate while it runs. |
| 1:20–1:45 | Results: ranked ideas, restaurant/bar first (existing fit-out), boutique fitness "complements, not duplicates, F45". Open an evidence chip → Evidence Trail with its CoStar field or Matterport scan. Show the first unknown: "Economics not assessed… capped at possible". |
| 1:45–1:55 | **Run the numbers**: change the rent; the lease scenario recalculates with its formula, and each input is labelled CoStar, You or Default. |
| 1:55–2:00 | Flip to **/start** (coffee shop → 4 ranked Houston spaces) or **/invest** (buy Barker Oaks, 10.92% stated cap rate, vs lease ideas). Close: "Real estate platforms find buildings. Tesseract shows what they could become." |

If the live agent is slow on venue Wi-Fi, open **`/analysis/rec_travis_owner`**: a real run captured earlier, shown with a "Recorded run" banner and its capture time.

## Before presenting (5 minutes)

1. `npm run dev`
2. `npm run demo:check -- --capture`. This runs the 17 checks below, pre-warms the Matterport and Vexcel caches, and refreshes the recorded fallback. Every line should be ✅.
3. Open `/properties/1018657` once in the presenting browser, so the 3D tour is cached.

## Demo reliability checklist

Verified 2026-11-14 (INT-07) with `npm run demo:check -- --capture` (17/17) and a recorded browser run.

- [x] **Runs on localhost.** Tours embed Matterport's public Showcase page (`my.matterport.com/show/?m=…`) in an iframe, with no SDK, so the SDK key's localhost restriction doesn't apply. The tour loaded in the browser run. (`demo:check` can't test Showcase itself: Matterport answers 403 to server-side requests, and we don't fake a browser user agent.)
- [x] **Matterport photo URLs are never stale.** Vision downloads freshly signed `resizeUrl(web)` photos on every run (`getModelImages` never caches), and the UI references scans by model id, not by signed URL. Nothing needs re-signing by hand.
- [x] **Fallback video** of a full owner run (home → search → property → Analyze Suite 100 → results, 50 s run): `~/Downloads/tesseract-demo/tesseract-owner-flow-2600-travis.webm` on Jordan's machine. Not committed, because it shows sponsor imagery.
- [x] **Fallback `AnalysisResponse`:** `data/demo/rec_travis_owner.json` (gitignored), served at `/analysis/rec_travis_owner` with a "Recorded run" banner and a capture-time disclaimer. Refresh it with `--capture`.
- [x] **Pages load in under 3 s once warm:** `/` 26 ms, search 55 ms, `/properties/1018657` 68 ms, `/start` 48 ms, `/invest` 33 ms on localhost. The first cold property load is about 1.9 s (Vexcel metadata, then cached for 1 h), which is why `demo:check` runs first.
- [x] **No secrets in the network tab.** The browser contacts only `localhost:3000` and Matterport's public tour hosts (`my`, `static`, `cdn-2`, `events.matterport.com`). There are no `vexcelgroup.com` or `api.matterport.com` calls, and no key value in any request, response or header (checked in the browser and by `demo:check`).

### Also verified live

| Flow | Result |
|---|---|
| Owner, Suite 100 | 49–61 s · 5 ideas · ~70 evidence items · audit 0 findings |
| Business starter (coffee shop, 1,500–4,000 SF, ≤ $45, Houston) | 76 s · 4 ranked spaces, each with a lease scenario |
| Investor ($7.5M, 8% target, either) | 67 s · acquisition (2205 Barker Oaks Dr, 10.92% stated cap rate, promising) plus lease ideas |
