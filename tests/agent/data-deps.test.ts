import { describe, expect, it, vi } from "vitest";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AnalysisRequest, AnalysisResponse, Evidence } from "@/lib/contracts";
import { travisOrtho, travisProperty, travisSpaces, travisSuite100Model } from "@/lib/contracts/examples/travis";
import { groundFloorOf, liveDataDeps, profileOutput, sameCategoryTenants, type DataModules } from "@/lib/agent/data-deps";
import { runAnalysis, type CreateMessage } from "@/lib/agent/orchestrator";
import { ToolUnavailableError } from "@/lib/agent/tools";
import type { SaleListing } from "@/lib/data/sale-listings";
import { TRAVIS_1000 } from "../market/nearby-fixtures";

const NOW = "2026-11-14T12:00:00.000Z";
const SUITE_100 = travisSpaces.find((s) => s.suite === "100")!;
const TENANTS = [
  { name: "Warehouse Live", industry: null, suite: null, squareFeet: null, since: "2023-12-29" },
  { name: "F45 Training, Inc.", industry: null, suite: "103", squareFeet: null, since: "2019-07-04" },
];
const valid = (e: object) => Evidence.safeParse({ ...e, createdAt: NOW }).success;

function modules(over: Partial<DataModules> = {}): DataModules {
  return {
    searchProperties: async () => ({ items: [], total: 0 }),
    getProperty: async (id) => (id === travisProperty.id ? travisProperty : null),
    getSpaces: async () => travisSpaces,
    getCurrentTenants: async () => TENANTS,
    searchSaleListings: async () => ({ items: [], total: 0 }),
    getSaleListings: async () => [],
    getNearbyContext: async () => TRAVIS_1000,
    getMatterportModel: async (_id, link) => ({ ...travisSuite100Model, costarCaption: link.caption ?? null, matchedSuite: link.matchedSuite ?? null }),
    getModelImages: async () => [],
    getAerialImagery: async () => travisOrtho,
    fetchVexcelImage: async () => { throw new Error("not used"); },
    download: async () => Buffer.from(""),
    ...over,
  };
}
const noClaude: CreateMessage = async () => { throw new Error("Claude is not called in these tests"); };
const deps = (over?: Partial<DataModules>) => liveDataDeps(modules(over), { createMessage: noClaude, visionModel: "test" });

describe("helpers", () => {
  it.each([
    ["FirstFloor", true],
    ["Ground", true],
    ["SecondFloor", false],
    ["Basement", false],
    [null, null],
    ["Penthouse", null],
  ] as const)("floor %s → ground %s", (floor, expected) => expect(groundFloorOf(floor)).toBe(expected));

  it("finds same-category tenants by whole word", () => {
    expect(sameCategoryTenants(TENANTS, "fitness_studio")).toEqual(["F45 Training, Inc."]);
    expect(sameCategoryTenants([{ ...TENANTS[0], name: "Barnes Consulting" }], "restaurant_bar")).toEqual([]); // "bar" inside "Barnes"
  });
});

describe("profileOutput (2600 Travis, Suite 100)", () => {
  const out = profileOutput(travisProperty, travisSpaces, TENANTS, SUITE_100.id);
  const space = `p${travisProperty.id}-s${SUITE_100.id}`;

  it("produces only contract-valid evidence", () => {
    expect(out.evidence.every(valid)).toBe(true);
  });

  it("cites every scoring fact", () => {
    const ids = new Set(out.evidence.map((e) => e.id));
    for (const f of Object.values(out.facts!)) for (const v of Object.values(f)) expect(ids.has((v as { evidenceId: string }).evidenceId)).toBe(true);
  });

  it("gives the space its size, rent, lease type and floor; the building its ceiling and frontage", () => {
    expect(out.facts![space]).toMatchObject({ spaceSf: { value: SUITE_100.sfMax }, askingRentPsfYear: { value: SUITE_100.askingRent.psfYearLow } });
    expect(out.facts![`p${travisProperty.id}`].ceilingFt?.value).toBe(travisProperty.retail!.ceilingHeightFt);
  });

  it("never calls a listing vacant, and says availability is advertised", () => {
    const text = out.evidence.map((e) => e.statement).join(" ");
    expect(text).not.toMatch(/\bvacant\b/i);
    expect(text).toMatch(/advertised availability is not confirmed vacancy/);
  });

  it("flags F45 as a same-category tenant for a gym, in the building and on the space", () => {
    expect(out.market![space].byUse?.fitness_studio?.sameCategoryInBuilding?.value).toEqual({ count: 1, names: ["F45 Training, Inc."] });
  });

  it("records a missing rent as missing, not as zero", () => {
    const noRent = { ...SUITE_100, askingRent: { ...SUITE_100.askingRent, psfYearLow: null, psfYearHigh: null } };
    const o = profileOutput(travisProperty, [noRent], [], SUITE_100.id);
    expect(o.facts![space].askingRentPsfYear).toBeUndefined();
    expect(o.evidence.find((e) => e.id === `ev_s${SUITE_100.id}_rent_missing`)?.kind).toBe("missing");
  });

  it("records an unknown space as missing", () => {
    const o = profileOutput(travisProperty, travisSpaces, [], 999);
    expect(o.evidence.some((e) => e.kind === "missing" && /999/.test(e.statement))).toBe(true);
  });
});

describe("liveDataDeps", () => {
  it("fails clearly for a property outside the kit", async () => {
    await expect(deps().getPropertyProfile({ propertyId: 42 })).rejects.toThrow(/not in the CoStar kit/);
  });

  it("links the scan to its advertised suite", async () => {
    const out = await deps().getMatterportModel({ propertyId: travisProperty.id, spaceId: SUITE_100.id });
    expect(out.evidence[0].statement).toMatch(/linked to advertised suite 100/);
    expect(out.evidence.find((e) => e.id?.endsWith("_area"))?.statement).toMatch(/scanned area, not leasable area/);
    expect(out.evidence.every(valid)).toBe(true);
  });

  it("does not pass a building scan off as a space without one", async () => {
    const noScan = travisSpaces.find((s) => !s.matterport);
    if (!noScan) return;
    await expect(deps().getMatterportModel({ propertyId: travisProperty.id, spaceId: noScan.id })).rejects.toBeInstanceOf(ToolUnavailableError);
  });

  it("describes aerial images with collection, capture date and attribution, linked through our proxy", async () => {
    const out = await deps().getAerialImagery({ propertyId: travisProperty.id });
    expect(out.evidence[0].statement).toMatch(/© Vexcel Imaging US, Inc\./);
    expect((out.evidence[0] as { media?: { ref: string }[] }).media?.[0].ref.startsWith("/api/imagery/vexcel/")).toBe(true);
  });

  it("uses the space's own lease type and use for the comparable rent", async () => {
    const out = await deps().getNearbyContext({ propertyId: travisProperty.id, spaceId: SUITE_100.id, radiusMeters: 1000 });
    const gap = out.evidence.find((e) => e.id === "ev_mkt_missing_comparable_rent");
    expect(gap?.statement).toBe(`No comparable ${SUITE_100.askingRent.serviceType} ${SUITE_100.spaceUse} asking rent is published within 1,000 m`);
  });

  it("filters advertised spaces by size, rent and use, and never says vacant", async () => {
    const searchProperties = vi.fn(async () => ({ items: [{ ...travisProperty, availableSpaceCount: 4, hasMatterport: true, hasSuiteMatched3d: true }], total: 1 }));
    const out = await deps({ searchProperties: searchProperties as never }).searchAvailableSpaces({ market: "houston", sfMin: 2000, sfMax: 5000, spaceUses: ["Retail"] });
    const sizes = (out.data as { sfMin: number | null; sfMax: number | null; use: string }[]).map((d) => d);
    expect(sizes.every((d) => d.use === "Retail" && (d.sfMax ?? 0) >= 2000 && (d.sfMin ?? d.sfMax ?? 0) <= 5000)).toBe(true);
    expect(out.evidence.map((e) => e.statement).join(" ")).toMatch(/not confirmed vacancy/);
  });
});

/* ------------------------------------------------- one full agent run */

let n = 0;
const toolUse = (name: string, input: Record<string, unknown>) => ({ type: "tool_use" as const, id: `tu_${++n}`, name, input });
const message = (content: unknown[]) =>
  ({ id: `m_${++n}`, type: "message", role: "assistant", model: "t", content, stop_reason: "tool_use", stop_sequence: null, usage: {} }) as unknown as BetaMessage;

describe("owner analysis on the live deps (scripted model)", () => {
  it("scores Suite 100 from cited CoStar, Matterport and market facts", async () => {
    const pid = travisProperty.id;
    const subject = `p${pid}-s${SUITE_100.id}`;
    const responses = [
      message([
        toolUse("get_property_profile", { reason: "Facts.", propertyId: pid, spaceId: SUITE_100.id }),
        toolUse("get_matterport_model", { reason: "Scan.", propertyId: pid, spaceId: SUITE_100.id }),
        toolUse("get_aerial_imagery", { reason: "Aerial.", propertyId: pid }),
        toolUse("get_nearby_context", { reason: "Market.", propertyId: pid, spaceId: SUITE_100.id, radiusMeters: 1000 }),
      ]),
      message([toolUse("score_uses", { reason: "Score.", subject, useCategories: ["fitness_studio", "restaurant_bar"] })]),
      message([
        toolUse("submit_report", {
          opportunities: [
            { subject, useCategory: "restaurant_bar", title: "Restaurant", summary: "s", strategy: "lease", supportingEvidenceIds: [`ev_s${SUITE_100.id}_sf`], unknowns: [], likelyChanges: [], nextSteps: [], financialScenarioIds: [] },
            { subject, useCategory: "fitness_studio", title: "Gym", summary: "s", strategy: "lease", supportingEvidenceIds: [], unknowns: [], likelyChanges: [], nextSteps: [], financialScenarioIds: [] },
          ],
          missing: [],
        }),
      ]),
    ];
    const r = await runAnalysis({
      id: "live-deps",
      request: AnalysisRequest.parse({ input: { persona: "owner", propertyId: pid, spaceId: SUITE_100.id } }),
      model: "t",
      deps: deps(),
      createMessage: async () => responses.shift()!,
    });
    expect(r.status).toBe("completed");
    expect(() => AnalysisResponse.parse(r)).not.toThrow();
    expect(r.toolCalls.every((c) => c.status === "succeeded")).toBe(true);
    const gym = r.opportunities.find((o) => o.useCategory === "fitness_studio")!;
    expect(gym.scores.physical.score).not.toBeNull();
    expect(gym.scores.market.score).not.toBeNull();
    // F45 already in the building is a soft blocker, shown to the owner.
    expect(gym.scores.market.rationale).toMatch(/F45/);
    expect(r.marketAnalysis?.propertyId).toBe(pid);
  });
});

/* --------------------------------------------------------- acquisition */

/** A listing shaped like the kit's (Houston office, priced, with a stated cap rate and NOI). */
const LISTING: SaleListing = {
  listingId: 4242,
  propertyId: travisProperty.id,
  name: null,
  street: "2600 Travis St",
  city: "Houston",
  market: "houston",
  propertyType: "GeneralRetail",
  askingPriceLowUsd: 9_500_000,
  askingPriceHighUsd: 9_500_000,
  askingCapRatePct: 7.25,
  netOperatingIncomeUsd: 688_750,
  availableSf: 36_932,
  saleStatus: "Active",
  saleType: "Investment",
  source: { system: "costar", dataset: "commercial-listing-summary", recordId: "4242", field: "forSaleSummary" },
};

describe("acquisition data", () => {
  it("adds the listing's price, cap rate and NOI to the property, as asking figures", () => {
    const out = profileOutput(travisProperty, travisSpaces, [], undefined, [LISTING]);
    const text = out.evidence.map((e) => e.statement).join(" | ");
    expect(text).toMatch(/asking price of \$9,500,000 \(active, investment\) for 36,932 SF \(an asking price, not a valuation\)/);
    expect(text).toMatch(/asking cap rate of 7.25% \(the seller's figure, not an underwritten return\)/);
    expect(out.facts![`p${travisProperty.id}`].askingCapRatePct?.value).toBe(7.25);
    expect(out.evidence.every(valid)).toBe(true);
  });

  it("records an undisclosed price as missing, never as a value", () => {
    const out = profileOutput(travisProperty, travisSpaces, [], undefined, [{ ...LISTING, askingPriceLowUsd: null, askingPriceHighUsd: null }]);
    expect(out.evidence.find((e) => e.id === `ev_p${travisProperty.id}_sale_price_missing`)?.kind).toBe("missing");
    expect(out.evidence.some((e) => e.id === `ev_p${travisProperty.id}_sale_price`)).toBe(false);
  });

  it("search_properties with forSale lists sale listings with their asking figures", async () => {
    const searchSaleListings = vi.fn(async () => ({ items: [LISTING], total: 1 }));
    const out = await deps({ searchSaleListings }).searchProperties({ forSale: true, market: "houston", maxAskingPriceUsd: 10_000_000 });
    expect(searchSaleListings).toHaveBeenCalledWith({ market: "houston", maxAskingPriceUsd: 10_000_000, limit: 10 });
    expect(out.evidence[0].statement).toMatch(/listed for sale at \$9,500,000, asking cap rate 7.25%/);
    expect((out.data as { subject: string }[])[0].subject).toBe(`p${travisProperty.id}`);
  });
});
