// Component preview for the Market Intelligence dashboard (UI-07) until POST /api/market/analyze (AI-04) is live.
// The numbers below are a hand-made example for checking the design. They are not from any dataset.
import type { Metadata } from "next";
import type { MarketAnalysis } from "@/lib/contracts";
import { MarketDashboard } from "@/components/analysis/MarketDashboard";
import { PageHeader, PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "Market preview | Tesseract", robots: { index: false } };

const exampleMarket: MarketAnalysis = {
  propertyId: 1018657,
  radiusMeters: 1500,
  comparableSpaces: {
    count: 14,
    askingRentPsfYear: { min: 28, median: 36, max: 48 },
    serviceTypes: [
      { serviceType: "TripleNet", count: 9 },
      { serviceType: "FullServiceGross", count: 3 },
      { serviceType: "ModifiedGross", count: 2 },
    ],
    spaceUses: [
      { spaceUse: "Retail", count: 8 },
      { spaceUse: "Office", count: 4 },
      { spaceUse: "OfficeRetail", count: 2 },
    ],
  },
  nearbyTenants: {
    count: 46,
    byIndustry: [
      { industry: "ProfessionalServices", count: 14 },
      { industry: "FoodAndAccommodation", count: 11 },
      { industry: "Healthcare", count: 9 },
      { industry: "PersonalServices", count: 7 },
      { industry: "RetailTrade", count: 5 },
    ],
  },
  saleComps: { count: 6, withDisclosedPrice: 3 },
  limitations: [
    "Covers only properties in the CoStar hackathon kit, not the whole market.",
    "No demographic, foot-traffic or competitor data.",
    "Asking rents are not achieved rents.",
  ],
  evidenceIds: [],
};

const emptyMarket: MarketAnalysis = {
  ...exampleMarket,
  radiusMeters: 800,
  comparableSpaces: { count: 0, askingRentPsfYear: { min: null, median: null, max: null }, serviceTypes: [], spaceUses: [] },
  nearbyTenants: { count: 0, byIndustry: [] },
  saleComps: { count: 0, withDisclosedPrice: 0 },
};

export default function MarketPreviewPage() {
  return (
    <PageShell>
        <PageHeader title="Market preview" description="Shows how market context will look before the market analysis is connected." />
        <p role="note" className="rounded-2xl border border-dashed border-muted-foreground/40 px-4 py-3 text-base leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Made-up example numbers.</span> Every figure on this page was
          typed in by hand to check the design. None of it comes from CoStar or any other data.
        </p>
        <MarketDashboard analysis={exampleMarket} />
        <div className="flex flex-col gap-3 border-t pt-8">
          <p className="text-base font-medium text-muted-foreground">When nothing is nearby</p>
          <MarketDashboard analysis={emptyMarket} />
        </div>
    </PageShell>
  );
}
