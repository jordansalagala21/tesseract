// Copy and data for the main page. Kept apart from the markup so the wording rules can be tested
// (CLAUDE.md §6: no "vacant", four labelled evidence kinds, formulas shown with their inputs).
import type { Evidence } from "@/lib/contracts";
import { BUCKETS } from "@/components/analysis/evidence-format";
import { toolLabel } from "@/components/analysis/timeline-format";

export type EvidenceKind = Evidence["kind"];

/** One screen of the main page. `ground` and `accent` tint the page and the scroll spine. */
export const SECTIONS = [
  { id: "top", label: "Introduction", ground: "#f4f5f3", accent: "#1d6a56" },
  { id: "tour", label: "3D tour", ground: "#d9e9f5", accent: "#0b78b6" },
  { id: "search", label: "Search agent", ground: "#f6e7c9", accent: "#b06d09" },
  { id: "aerial", label: "Aerial views", ground: "#d5eded", accent: "#0e7c86" },
  { id: "analysis", label: "Analysis agent", ground: "#e4dff7", accent: "#5a4fb3" },
  { id: "numbers", label: "Numbers", ground: "#d6dad5", accent: "#16201d" },
  { id: "start-here", label: "Paths", ground: "#d8eee4", accent: "#1d6a56" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

/** How often a section's animation replays while it stays on screen. Analysis runs longer. */
export const replayMs = (id: SectionId) => (id === "analysis" ? 9000 : 5000);

export const SOURCES = [
  { name: "CoStar", text: "Property data for 3,339 properties in Houston and Los Angeles." },
  { name: "Matterport", text: "3D tours of the interior as it stands today." },
  { name: "Vexcel", text: "Aerial imagery of the block around the building." },
  { name: "Claude agent", text: "Reads all three, ranks possible uses and labels its evidence." },
];

/** Demo suite, 2600 Travis St, Houston (CoStar PropertyId 1018657). */
export const SUITE = { address: "2600 Travis St", suite: "Suite 100", city: "Houston", advertisedSf: 9889, scannedSf: 8879, rentPsfYear: 45 };

export const baseRentPerYear = SUITE.advertisedSf * SUITE.rentPsfYear;

export const KIND_LABEL: Record<EvidenceKind, string> = {
  verified_fact: "Verified fact",
  ai_observation: "AI observation",
  user_assumption: "Your assumption",
  missing: "Missing information",
};

export const KIND_LEGEND = BUCKETS.map((b) => ({ kind: b.kind, label: KIND_LABEL[b.kind], blurb: b.blurb }));

/** Each agent step paired with the kind of result it produces. Statements are example output. */
export const ANALYSIS_ROWS: { kind: EvidenceKind; step: string; claim: string; source: string }[] = [
  {
    kind: "verified_fact",
    step: toolLabel("get_property_profile"),
    claim: "Suite 100 is advertised at 9,889 SF at $45/SF/yr, triple net.",
    source: "CoStar listing",
  },
  {
    kind: "verified_fact",
    step: toolLabel("get_matterport_model"),
    claim: "The scan measures about 8,879 SF of floor. Scanned area, not leasable area.",
    source: "Matterport scan",
  },
  {
    kind: "ai_observation",
    step: toolLabel("analyze_interior"),
    claim: "The interior photo appears to show floor-to-ceiling storefront glazing.",
    source: "Matterport photo",
  },
  {
    kind: "user_assumption",
    step: toolLabel("run_financial_scenario"),
    claim: "Triple-net pass-through costs are a number you enter.",
    source: "Your input",
  },
  {
    kind: "missing",
    step: toolLabel("score_uses"),
    claim: "Permitted uses and deed restrictions for this parcel are not in the data.",
    source: "Not in the data",
  },
];

export const PATHS = [
  {
    id: "owner",
    caption: "The owner's suite",
    name: "Property owner",
    start: "Start with a property and, if you like, one advertised suite.",
    get: "Get ranked reuse ideas with evidence, risks and a 3D walkthrough.",
    action: "Explore my property",
    href: "/explore",
  },
  {
    id: "founder",
    caption: "The founder's need",
    name: "Business founder",
    start: "Start with a business idea, a size and a budget.",
    get: "Get advertised spaces that fit, with 3D tours and the reasons they fit.",
    action: "Find my business space",
    href: "/start",
  },
  {
    id: "investor",
    caption: "The investor's capital",
    name: "Investor",
    start: "Start with capital, risk, markets and a time horizon.",
    get: "Get property and business screens, with leasing and buying analysed separately.",
    action: "Build my investment brief",
    href: "/invest",
  },
] as const;

export const FOOTER_NOTE =
  "Covers advertised space in Houston and Los Angeles from the CoStar hackathon dataset. Advertised availability is not confirmed vacancy.";
