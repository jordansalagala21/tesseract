import { describe, expect, it } from "vitest";
import type { AnalysisResponse, Evidence, Opportunity } from "@/lib/contracts";
import { travisAnalysisFixture } from "@/lib/contracts/examples/travis";
import { conceptFor, emptyViewFor } from "@/components/analysis/concepts";
import { spaceImagesFor } from "@/components/analysis/result-images";

const NOW = "2026-11-14T00:00:00.000Z";
const obs = (id: string, model: string, photo: number): Evidence => ({
  id, kind: "ai_observation", statement: id, model: "m", confidence: "high", caveat: "AI", createdAt: NOW,
  sources: [{ system: "matterport", dataset: "model", recordId: model, field: `assets.photos[${photo}]` }],
});
const call = (n: number, propertyId: number, spaceId: number, evidenceIds: string[]): AnalysisResponse["toolCalls"][number] => ({
  id: `tc_${n}`, step: n, tool: "analyze_interior", reason: "r", input: { propertyId, spaceId }, status: "succeeded", startedAt: NOW, finishedAt: NOW, outputSummary: null, evidenceIds, error: null,
});
const opp = (propertyId: number, spaceId: number | null, useCategory = "restaurant_bar") => ({ propertyId, spaceId, useCategory }) as Opportunity;

describe("concepts", () => {
  it("never shows a concept made from a different building", () => {
    // The home-page gym and café renders come from another property, so they are not used here.
    expect(conceptFor(opp(1018657, 21053094, "fitness_studio"))).toBeNull();
    expect(conceptFor(opp(1018657, 21053094, "cafe"))).toBeNull();
  });
  it("has no concept (placeholder) for uses without one", () => {
    expect(conceptFor(opp(1018657, 21053094, "medical_office"))).toBeNull();
  });
  it("prefers a concept generated from this space, and only from our own /concepts/ path", () => {
    const manifest = { "p1018657-s21053094": { fitness_studio: "/concepts/p1018657-s21053094/fitness_studio.webp", medical_office: "https://evil.example/x.webp" } };
    expect(conceptFor(opp(1018657, 21053094, "fitness_studio"), manifest)).toEqual({ src: "/concepts/p1018657-s21053094/fitness_studio.webp", scope: "space" });
    expect(conceptFor(opp(1018657, 21053094, "medical_office"), manifest)).toBeNull();
  });
});

describe("spaceImagesFor", () => {
  // Two properties, each scanned: an idea shows its own property's interior, never the other's.
  const a = {
    ...travisAnalysisFixture,
    evidence: [obs("a1", "AAAAAAAAAAA", 0), obs("a2", "AAAAAAAAAAA", 1), obs("b1", "BBBBBBBBBBB", 0)],
    toolCalls: [call(1, 1, 11, ["a1", "a2"]), call(2, 2, 22, ["b1"])],
  } as AnalysisResponse;

  it("returns the interior photos of the idea's own space, and its model for the 3D tour", () => {
    const r = spaceImagesFor(opp(1, 11), a);
    expect(r.images.map((i) => i.src)).toEqual(["/api/imagery/matterport/AAAAAAAAAAA/photos-0", "/api/imagery/matterport/AAAAAAAAAAA/photos-1"]);
    expect(r.modelId).toBe("AAAAAAAAAAA");
    expect(spaceImagesFor(opp(2, 22), a).modelId).toBe("BBBBBBBBBBB");
  });

  it("returns nothing for a space that was never scanned, so the page falls back to the aerial", () => {
    expect(spaceImagesFor(opp(3, 33), a)).toEqual({ images: [], hidden: 0, modelId: null });
  });

  it("hides photos the vision step saw furniture in, but keeps the 3D tour", () => {
    const furnished = { ...obs("ev_int1_furnished", "AAAAAAAAAAA", 0), sources: [obs("x", "AAAAAAAAAAA", 0).sources[0]] };
    const some = { ...a, evidence: [...a.evidence, furnished], toolCalls: [call(1, 1, 11, ["a1", "a2", "ev_int1_furnished"])] } as AnalysisResponse;
    expect(spaceImagesFor(opp(1, 11), some)).toEqual({ images: [expect.objectContaining({ src: "/api/imagery/matterport/AAAAAAAAAAA/photos-1" })], hidden: 1, modelId: "AAAAAAAAAAA" });

    const all = { ...some, evidence: [...some.evidence, { ...furnished, id: "ev_int2_furnished", sources: [obs("y", "AAAAAAAAAAA", 1).sources[0]] }] } as AnalysisResponse;
    expect(spaceImagesFor(opp(1, 11), all)).toEqual({ images: [], hidden: 2, modelId: "AAAAAAAAAAA" });
  });
});

describe("emptyViewFor", () => {
  it("returns this space's own furniture-removed view, only from our /concepts/ path", () => {
    expect(emptyViewFor(opp(1, 11), { p1: {}, "p1-s11": { empty: "/concepts/p1-s11/empty.webp" } })).toBe("/concepts/p1-s11/empty.webp");
    expect(emptyViewFor(opp(1, 11), { "p1-s11": { empty: "https://evil.example/e.webp" } })).toBeNull();
    expect(emptyViewFor(opp(1, 12), { "p1-s11": { empty: "/concepts/p1-s11/empty.webp" } })).toBeNull();
  });
});
