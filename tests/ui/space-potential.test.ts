import { describe, expect, it } from "vitest";
import type { AnalysisResponse, Evidence, Opportunity } from "@/lib/contracts";
import { travisAnalysisFixture } from "@/lib/contracts/examples/travis";
import { conceptFor } from "@/components/analysis/concepts";
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
    expect(spaceImagesFor(opp(3, 33), a)).toEqual({ images: [], modelId: null });
  });
});
