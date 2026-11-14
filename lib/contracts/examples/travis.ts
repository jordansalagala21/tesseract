/**
 * CONTRACT FIXTURES — 2600 Travis St, Houston (CoStar PropertyId 1018657).
 *
 * Purpose: let Frontend (Dev 3) build UI and Agent (Dev 1) design outputs BEFORE the
 * data layer (Dev 2) is live. These are NOT returned by any API route.
 *
 * Verified-fact values below were read from the CoStar kit and the Matterport / Vexcel APIs
 * during the feasibility study (see docs/DATA_SOURCES.md). Values marked FIXTURE-ONLY
 * (room ids, AI observation wording, opportunity scores, scenario assumptions) are
 * illustrative placeholders and must never be shown to users as real analysis output.
 */
import type {
  AerialImagery,
  AnalysisResponse,
  AvailableSpace,
  FinancialScenario,
  MatterportModel,
  Property,
} from "../index";
import { STANDARD_DISCLAIMERS } from "../analysis";

export const FIXTURE_NOTICE = "Contract fixture for development only — not live analysis output.";

const T = "2026-11-14T12:00:00.000Z";

export const travisProperty: Property = {
  id: 1018657,
  name: null,
  address: { street: "2600 Travis St", city: "Houston", state: "TX", postcode: "77006-3540" },
  location: { lat: 29.74587, lon: -95.375417 },
  market: "houston",
  researchMarketId: 14,
  submarketId: 4321,
  propertyType: "GeneralRetail",
  propertySubtype: "GeneralRetail_Freestanding",
  buildingClass: "A",
  buildingRating: 4,
  constructionStatus: "Existing",
  rentableAreaSf: 36932,
  grossAreaSf: 36932,
  stories: 2,
  lot: { value: 0.98, unit: "acres" },
  zoningDescription: "N/Ap Houston",
  yearBuilt: null, // DATA-03 will decode constructionEvents (years 1960, 2018, 2019 present)
  yearRenovated: null,
  parkingRatioPer1000Sf: null,
  retail: {
    glaSf: 36932,
    ceilingHeightFt: 20,
    frontage: [{ street: "Travis St", feet: 203, curbCuts: 4, isPrimary: true }],
  },
  matterportModelIds: ["4H2JSnQ3wSj", "NxYn1owequw"],
  counts: { availableSpaces: 4, currentTenants: 2, saleComps: 3 },
  source: { system: "costar", dataset: "commercial-property", recordId: "1018657" },
};

const space = (
  id: number,
  suite: string,
  sfMin: number,
  sfMax: number,
  rent: number,
  onMarket: string,
  floorPlan: boolean,
  mp: AvailableSpace["matterport"],
): AvailableSpace => ({
  id,
  listingId: 4105591,
  propertyId: 1018657,
  listingType: "PropertyDirectSpaceForLease",
  suite,
  floor: "FirstFloor",
  spaceUse: "Retail",
  spaceType: "Relet",
  sfMin,
  sfMax,
  askingRent: { low: rent, high: rent, basis: "yearly", psfYearLow: rent, psfYearHigh: rent, serviceType: "TripleNet" },
  availabilityStatus: "advertised_available",
  availableOn: null,
  onMarketDate: onMarket,
  floorPlanImageUrl: floorPlan ? "/api/imagery/costar/floorplan?spaceId=" + id : null,
  matterport: mp,
  source: {
    system: "costar",
    dataset: "commercial-listing-summary",
    recordId: "4105591",
    field: `forLeaseSummary.spaces[id=${id}]`,
  },
});

export const travisSpaces: AvailableSpace[] = [
  space(21053094, "100", 9889, 9889, 45, "2026-05-08", true, {
    modelId: "NxYn1owequw",
    linkMethod: "caption_suite_match",
    caption: "Suite 100 - 9,889SF",
  }),
  space(21963212, "104", 2946, 2946, 45, "2026-09-24", true, {
    modelId: "4H2JSnQ3wSj",
    linkMethod: "caption_suite_match",
    caption: "Suite 104 - 2,946SF",
  }),
  space(12873016, "106", 2554, 4681, 37, "2018-08-13", false, null),
  space(18035986, "107", 2127, 4681, 37, "2024-09-17", false, null),
];

export const travisSuite100Model: MatterportModel = {
  id: "NxYn1owequw",
  name: "Suite 100 - 9,889SF",
  propertyId: 1018657,
  costarCaption: "Suite 100 - 9,889SF",
  matchedSuite: "100",
  embedUrl: "https://my.matterport.com/show/?m=NxYn1owequw",
  visibility: "public",
  address: "2600 Travis St, Houston, TX, 77006, US",
  location: { lat: 29.74582727, lon: -95.37531198 },
  scannedAreaSf: 8878.9,
  floors: [{ id: "fixture-floor-1", label: "Floor 1", areaSf: 8878.9 }],
  rooms: [
    // FIXTURE-ONLY ids; dimensions are from the live API sample
    { id: "fixture-room-1", classification: "Other", areaSf: 172.6, widthFt: 10.0, depthFt: 16.3, floorLabel: "Floor 1" },
    { id: "fixture-room-2", classification: "Office", areaSf: 129.5, widthFt: 6.3, depthFt: 19.3, floorLabel: "Floor 1" },
    { id: "fixture-room-3", classification: "Kitchen", areaSf: null, widthFt: null, depthFt: null, floorLabel: "Floor 1" },
  ],
  panoCount: 76,
  photoCount: 16,
  floorplanFormats: ["jpg", "png", "dxf"],
  createdAt: "2026-11-10T00:16:53Z",
  fetchedAt: T,
  source: { system: "matterport", dataset: "model", recordId: "NxYn1owequw" },
};

export const travisOrtho: AerialImagery = {
  id: "vexcel-ortho-1018657",
  propertyId: 1018657,
  provider: "vexcel",
  kind: "ortho",
  direction: null,
  layer: "urban",
  collection: "us-tx-houston-2026",
  captureDate: { first: "2025-12-19", last: "2026-01-02" },
  gsdMeters: { min: 0.0724, max: 0.079 },
  bboxWkt: "POLYGON((-95.3762 29.7452,-95.3746 29.7452,-95.3746 29.7466,-95.3762 29.7466,-95.3762 29.7452))",
  imageUrl: "/api/imagery/vexcel/ortho?propertyId=1018657",
  width: 2387,
  height: 2406,
  attribution: "© Vexcel Imaging US, Inc.",
  fetchedAt: T,
  source: { system: "vexcel", dataset: "ortho/extract", recordId: "us-tx-houston-2026", capturedAt: "2026-01-02" },
};

/** FIXTURE-ONLY assumptions; arithmetic is correct for these inputs. */
export const travisLeaseScenario: FinancialScenario = {
  id: "scn_fixture_lease_100",
  name: "Suite 100 — lease at asking rent (example)",
  input: {
    mode: "lease",
    spaceSf: { value: 9889, origin: "costar", label: "Suite 100 advertised SF", evidenceId: "ev_space_sf" },
    baseRentPsfYear: { value: 45, origin: "costar", label: "Asking rent $/SF/yr NNN", evidenceId: "ev_space_rent" },
    nnnPsfYear: { value: 12, origin: "user", label: "Estimated NNN pass-throughs $/SF/yr (example user input)", evidenceId: "ev_assume_nnn" },
    buildOutCostUsd: { value: 0, origin: "user", label: "Build-out cost (example user input)" },
  },
  output: {
    annualOccupancyCostUsd: 563673, // 9,889 × (45 + 12)
    monthlyOccupancyCostUsd: 46972.75,
    breakEvenMonthlyRevenueUsd: null, // needs revenue/margin inputs
    netOperatingIncomeUsd: null,
    capRatePct: null,
    cashOnCashPct: null,
    paybackYears: null,
  },
  formulas: ["annualOccupancyCost = spaceSf × (baseRentPsfYear + nnnPsfYear)", "monthly = annual / 12"],
  warnings: ["NNN pass-through costs are not published in the listing; value is a user assumption."],
  disclaimer: "Illustrative scenario from labelled assumptions. Not a forecast, appraisal or investment advice.",
};

export const travisAnalysisFixture: AnalysisResponse = {
  id: "ana_fixture_travis_owner",
  status: "completed",
  persona: "owner",
  request: {
    input: { persona: "owner", propertyId: 1018657, spaceId: 21053094, priorities: [], constraints: [] },
    options: { includeInteriorVision: true, includeAerialVision: true, maxAgentSteps: 12, maxCandidates: 5 },
  },
  createdAt: T,
  completedAt: T,
  evidence: [
    {
      kind: "verified_fact",
      id: "ev_ceiling",
      statement: "Ceiling height is recorded as 20 ft",
      value: 20,
      unit: "ft",
      createdAt: T,
      sources: [{ system: "costar", dataset: "commercial-property", recordId: "1018657", field: "propertyRetail.structural.ceilingHeightFeet" }],
    },
    {
      kind: "verified_fact",
      id: "ev_frontage",
      statement: "203 ft of primary frontage on Travis St with 4 curb cuts",
      value: 203,
      unit: "ft",
      createdAt: T,
      sources: [{ system: "costar", dataset: "commercial-property", recordId: "1018657", field: "propertyRetail.frontage[0]" }],
    },
    {
      kind: "verified_fact",
      id: "ev_space_sf",
      statement: "Suite 100 is advertised at 9,889 SF",
      value: 9889,
      unit: "sf",
      createdAt: T,
      sources: [{ system: "costar", dataset: "commercial-listing-summary", recordId: "4105591", field: "forLeaseSummary.spaces[id=21053094].squareFeetMax" }],
    },
    {
      kind: "verified_fact",
      id: "ev_space_rent",
      statement: "Suite 100 asking rent is $45/SF/yr, triple net",
      value: 45,
      unit: "usd_psf_year",
      createdAt: T,
      sources: [{ system: "costar", dataset: "commercial-listing-summary", recordId: "4105591", field: "forLeaseSummary.spaces[id=21053094].rateLow" }],
    },
    {
      kind: "verified_fact",
      id: "ev_scan_area",
      statement: "Matterport scan of Suite 100 measures about 8,879 SF of floor area (scanned area, not leasable area)",
      value: 8878.9,
      unit: "sf",
      createdAt: T,
      sources: [{ system: "matterport", dataset: "model", recordId: "NxYn1owequw", field: "dimensions.areaFloor" }],
    },
    {
      kind: "ai_observation",
      id: "ev_obs_bar",
      statement: "FIXTURE-ONLY: Interior photo appears to show an existing bar counter, banquette seating and floor-to-ceiling storefront glazing",
      createdAt: T,
      model: "claude-opus-5-5",
      confidence: "medium",
      caveat: "Visual/AI observation — not a verified measurement or inspection.",
      sources: [{ system: "matterport", dataset: "model.assets.photos", recordId: "NxYn1owequw" }],
      media: [{ type: "matterport_model", ref: "NxYn1owequw" }],
    },
    {
      kind: "user_assumption",
      id: "ev_assume_nnn",
      statement: "NNN pass-throughs assumed at $12/SF/yr (example user input)",
      value: 12,
      unit: "usd_psf_year",
      origin: "user",
      createdAt: T,
      sources: [],
    },
    {
      kind: "missing",
      id: "ev_missing_use",
      statement: "Permitted uses / deed restrictions for this parcel are not in the sponsor data",
      whyNeeded: "Food & beverage and assembly uses may require permits or be restricted.",
      howToResolve: "Confirm with the landlord and City of Houston permitting.",
      createdAt: T,
      sources: [],
    },
  ],
  evidenceIndex: {
    verifiedFactIds: ["ev_ceiling", "ev_frontage", "ev_space_sf", "ev_space_rent", "ev_scan_area"],
    aiObservationIds: ["ev_obs_bar"],
    userAssumptionIds: ["ev_assume_nnn"],
    missingInfoIds: ["ev_missing_use"],
  },
  opportunities: [
    {
      id: "opp_fixture_1",
      rank: 1,
      title: "FIXTURE-ONLY: Restaurant / bar (second-generation space)",
      useCategory: "restaurant_bar",
      propertyId: 1018657,
      spaceId: 21053094,
      strategy: "lease",
      verdict: "possible",
      summary: "Illustrative opportunity card used for UI development.",
      scores: {
        physical: { score: 80, rationale: "FIXTURE-ONLY", evidenceIds: ["ev_ceiling", "ev_obs_bar", "ev_scan_area"] },
        market: { score: null, rationale: "Insufficient evidence (no demand data in sponsor kit).", evidenceIds: [] },
        access: { score: 70, rationale: "FIXTURE-ONLY", evidenceIds: ["ev_frontage"] },
        economic: { score: 50, rationale: "FIXTURE-ONLY", evidenceIds: ["ev_space_rent", "ev_assume_nnn"] },
        overall: null,
      },
      supportingEvidenceIds: ["ev_ceiling", "ev_frontage", "ev_obs_bar"],
      blockers: [{ description: "Permitted use not verified", evidenceIds: ["ev_missing_use"] }],
      unknowns: ["Hood / grease-trap condition", "Parking allocation for this suite"],
      likelyChanges: ["Verify kitchen exhaust and grease interceptor"],
      nextSteps: ["Ask listing broker for prior-tenant build-out details"],
      financialScenarioIds: ["scn_fixture_lease_100"],
    },
  ],
  marketAnalysis: null,
  financialScenarios: [travisLeaseScenario],
  toolCalls: [
    {
      id: "tc_1",
      step: 1,
      tool: "get_property_profile",
      reason: "Load CoStar facts for the selected property.",
      input: { propertyId: 1018657 },
      status: "succeeded",
      startedAt: T,
      finishedAt: T,
      outputSummary: "Retail, Class A, 36,932 SF, 4 advertised spaces",
      evidenceIds: ["ev_ceiling", "ev_frontage", "ev_space_sf", "ev_space_rent"],
      error: null,
    },
  ],
  disclaimers: [...STANDARD_DISCLAIMERS],
  error: null,
};
