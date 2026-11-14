import { describe, expect, it } from "vitest";
import {
  AerialImagery,
  AnalysisRequest,
  AnalysisResponse,
  AvailableSpace,
  Evidence,
  FinancialScenario,
  MatterportModel,
  Property,
  PropertySearchQuery,
} from "@/lib/contracts";
import {
  travisAnalysisFixture,
  travisLeaseScenario,
  travisOrtho,
  travisProperty,
  travisSpaces,
  travisSuite100Model,
} from "@/lib/contracts/examples/travis";

describe("contract fixtures validate", () => {
  it("Property", () => expect(Property.parse(travisProperty).id).toBe(1018657));
  it("AvailableSpace", () => travisSpaces.forEach((s) => AvailableSpace.parse(s)));
  it("MatterportModel", () => MatterportModel.parse(travisSuite100Model));
  it("AerialImagery", () => AerialImagery.parse(travisOrtho));
  it("FinancialScenario", () => FinancialScenario.parse(travisLeaseScenario));
  it("AnalysisResponse", () => AnalysisResponse.parse(travisAnalysisFixture));
});

describe("data-integrity rules are enforced by schemas", () => {
  it("has no 'vacant' availability status", () => {
    const bad = { ...travisSpaces[0], availabilityStatus: "vacant" };
    expect(AvailableSpace.safeParse(bad).success).toBe(false);
  });

  it("rejects a verified_fact sourced from the AI or the user", () => {
    const bad = {
      kind: "verified_fact",
      id: "x",
      statement: "s",
      createdAt: "2026-11-14T00:00:00.000Z",
      sources: [{ system: "ai" }],
    };
    expect(Evidence.safeParse(bad).success).toBe(false);
  });

  it("rejects an analysis referencing unknown evidence", () => {
    const bad = structuredClone(travisAnalysisFixture);
    bad.opportunities[0].supportingEvidenceIds.push("ev_does_not_exist");
    expect(AnalysisResponse.safeParse(bad).success).toBe(false);
  });

  it("rejects an evidence id placed in the wrong bucket", () => {
    const bad = structuredClone(travisAnalysisFixture);
    bad.evidenceIndex.verifiedFactIds.push("ev_obs_bar");
    expect(AnalysisResponse.safeParse(bad).success).toBe(false);
  });

  it("accepts both Matterport suite link methods and rejects unknown ones", () => {
    const base = travisSpaces.find((s) => s.matterport)!;
    for (const linkMethod of ["space_floorplan_videokey", "caption_suite_match"] as const) {
      expect(AvailableSpace.safeParse({ ...base, matterport: { ...base.matterport!, linkMethod } }).success).toBe(true);
    }
    expect(
      AvailableSpace.safeParse({ ...base, matterport: { ...base.matterport!, linkMethod: "address_guess" } }).success,
    ).toBe(false);
  });
  it("aerial imageUrl must be an internal proxy path", () => {
    expect(AerialImagery.safeParse({ ...travisOrtho, imageUrl: "https://api.vexcelgroup.com/x" }).success).toBe(false);
  });

  it("fixture lease arithmetic is correct", () => {
    const i = travisLeaseScenario.input;
    if (i.mode !== "lease") throw new Error("expected lease");
    expect(i.spaceSf.value * (i.baseRentPsfYear.value + i.nnnPsfYear.value)).toBe(
      travisLeaseScenario.output.annualOccupancyCostUsd,
    );
  });
});

describe("request parsing", () => {
  it("applies analysis defaults", () => {
    const r = AnalysisRequest.parse({ input: { persona: "owner", propertyId: 1018657 } });
    expect(r.options.maxAgentSteps).toBe(12);
  });
  it("coerces search query strings", () => {
    const q = PropertySearchQuery.parse({ limit: "5", hasMatterport: "true" });
    expect(q.limit).toBe(5);
    expect(q.hasMatterport).toBe(true);
  });
  it('treats the string "false" as false', () => {
    expect(PropertySearchQuery.parse({ includeMultifamily: "false" }).includeMultifamily).toBe(false);
  });
});
