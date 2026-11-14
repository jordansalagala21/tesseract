# Product — Tesseract

**Tagline:** Discover what spaces could become.

## Problem

Commercial space often sits underused because finding its best use means stitching together fragmented research: market conditions, physical layout, neighbourhood context, financial feasibility and likely tenants. Owners, investors and entrepreneurs each do this research separately, if at all.

## Solution

Tesseract is an agentic AI platform. It investigates a property, or searches for one, using three sponsor data layers:

| Layer | Role | Example evidence |
|---|---|---|
| **CoStar** (static kit) | Property and market facts | Type, class, size, ceiling height, frontage, advertised suites, asking rent, tenants, sale comps |
| **Matterport** | The inside view | Interactive 3D twin, photos, panoramas, floor plans, room labels and dimensions, scanned area |
| **Vexcel** | The outside view | 7.5 cm top-down and angled aerial images: parking, access, corner exposure, neighbours |

A Claude orchestrator agent chooses which tools to call, reads the results, notices gaps, and produces **ranked opportunities**. Every claim is linked to evidence.

## Personas

### 1. Property owner
- Has a commercial property but doesn't know its most promising alternative use.
- Selects a property (and optionally one advertised suite).
- The agent evaluates physical suitability, the market context we actually have, plausible business uses, financial assumptions and risks.
- **Output:** ranked opportunities, an Evidence Trail, an embedded 3D walkthrough, and aerial context.

### 2. Investor with capital
- Has capital but no property or business idea.
- Enters capital, risk preference, target market(s), horizon and goals.
- The agent screens kit properties with advertised availability or active sale listings, then pairs promising properties with plausible uses.
- **Leasing and acquisition are analysed separately.** A lease strategy is about occupancy cost and an operator's break-even. An acquisition strategy is about price, NOI and cap rate, built from labelled assumptions.

### 3. Starting a business
- Has a business idea but doesn't know where to put it.
- Enters the business type, size range, rent budget and must-haves.
- The agent searches advertised spaces, then evaluates physical fit, asking rent, neighbourhood context and nearby kit tenants where the data supports it.
- **Output:** recommended spaces, with 3D tours where available.

All three personas share one engine. They differ in how the analysis request is framed and in which results are emphasised.

## What makes it credible

- **Four kinds of statements, always labelled:** verified facts, AI observations, user assumptions, and missing information.
- **No fabricated numbers.** No invented demographics, foot traffic, competitor counts, values or returns.
- **Availability ≠ vacancy.** CoStar listings show advertised availability, never confirmed vacancy.
- **Transparent maths.** Every financial output shows its inputs, where each came from, and the formula.

## Scope boundaries

Tesseract is preliminary decision support. It does not certify zoning, code compliance, structural condition, accessibility, valuation or business success.

Coverage is limited to the ~3,339 properties in the CoStar hackathon kit, all in Houston and Los Angeles.

## Success criteria for the demo

1. A real property (2600 Travis St, Suite 100) analysed end to end, using live data from all three layers.
2. Visible agent reasoning: the tool-call timeline, at least one follow-up the agent decided on itself, and a what-if re-run.
3. Every top-recommendation claim is clickable through to its evidence.
4. All three personas can start from their own goal on the same engine.
