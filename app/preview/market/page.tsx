// Component preview for the Market Intelligence dashboard (UI-07) until POST /api/market/analyze (AI-04) is live.
// The numbers below are a hand-made example for checking the design. They are not from any dataset.
import type { Metadata } from "next";
import type { MarketAnalysis } from "@/lib/contracts";
import { MarketDashboard } from "@/components/analysis/MarketDashboard";
import { SiteHeader } from "@/components/site/SiteHeader";

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
    <div className="mx-auto flex w-full max-w-[960px] flex-1 flex-col px-4 sm:px-8">
      <SiteHeader />
      <main className="flex flex-col gap-8 pt-6 pb-16 sm:pt-10">
        <div>
          <h1 className="font-heading text-[34px] leading-tight font-bold tracking-tight">Market preview</h1>
          <p className="mt-2 max-w-[40rem] text-[17px] leading-relaxed text-muted-foreground">
            Shows how market context will look before the market analysis is connected.
          </p>
        </div>
        <p role="note" className="rounded-2xl border border-dashed border-muted-foreground/40 px-4 py-3 text-[15px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Made-up example numbers.</span> Every figure on this page was
          typed in by hand to check the design. None of it comes from CoStar or any other data.
        </p>
        <MarketDashboard analysis={exampleMarket} />
        <div className="flex flex-col gap-3 border-t pt-8">
          <p className="text-[15px] font-medium text-muted-foreground">When nothing is nearby</p>
          <MarketDashboard analysis={emptyMarket} />
        </div>
      </main>
    </div>
  );
}
