import { describe, expect, it } from "vitest";
import type { Evidence, Opportunity } from "@/lib/contracts";
import { heroImageFor, imagesFor, observationsWithImages, reasonsFor, scanPhotoUrl } from "@/components/analysis/result-images";

const NOW = "2026-11-14T00:00:00.000Z";
const obs = (id: string, photo: number, statement = `seen ${id}`): Evidence => ({
  id, kind: "ai_observation", statement, model: "m", confidence: "high", caveat: "AI", createdAt: NOW,
  sources: [{ system: "matterport", dataset: "model", recordId: "NxYn1owequw", field: `assets.photos[${photo}]` }],
});
const fact = (id: string, statement: string): Evidence => ({ id, kind: "verified_fact", statement, createdAt: NOW, sources: [{ system: "costar", dataset: "d", recordId: "1" }] });
const opp = (ids: string[]): Opportunity => ({ id: "o", rank: 1, title: "t", useCategory: "cafe", propertyId: 1018657, spaceId: 1, strategy: "lease", verdict: "possible", summary: "", scores: {} as Opportunity["scores"], supportingEvidenceIds: ids, blockers: [], unknowns: [], likelyChanges: [], nextSteps: [], financialScenarioIds: [] });

describe("result images", () => {
  it("maps a scan photo source to our proxy, never a signed URL", () => {
    expect(scanPhotoUrl({ system: "matterport", recordId: "NxYn1owequw", field: "assets.photos[3]" })).toBe("/api/imagery/matterport/NxYn1owequw/photos-3");
    expect(scanPhotoUrl({ system: "matterport", recordId: "NxYn1owequw", field: "rooms" })).toBeNull();
    expect(scanPhotoUrl({ system: "costar", recordId: "1", field: "assets.photos[0]" })).toBeNull();
  });

  it("uses aerial media only when it points at our proxy", () => {
    const aerial: Evidence = { ...fact("a", "aerial"), media: [{ type: "aerial", ref: "/api/imagery/vexcel/ortho?propertyId=1" }, { type: "aerial", ref: "https://evil.example/x.jpg" }] };
    expect(imagesFor(aerial).map((i) => i.src)).toEqual(["/api/imagery/vexcel/ortho?propertyId=1"]);
  });

  it("gallery: one entry per picture, skipping 'not seen' notes", () => {
    const rows = observationsWithImages([obs("ev_int1_1", 0), obs("ev_int1_2", 0), obs("ev_int1_3", 1), obs("ev_int1_none_1", 2)]);
    expect(rows.map((r) => r.e.id)).toEqual(["ev_int1_1", "ev_int1_3"]);
  });

  it("gives each idea a different photo, preferring one its own evidence cites", () => {
    const byId = new Map([obs("a", 0), obs("b", 1), obs("c", 2)].map((e) => [e.id, e]));
    const pool = observationsWithImages([...byId.values()]).map((r) => r.image);
    const used = new Set<string>();
    expect(heroImageFor(opp(["b"]), byId, pool, used)?.src).toMatch(/photos-1$/);
    expect(heroImageFor(opp(["b"]), byId, pool, used)?.src).toMatch(/photos-0$/); // b's photo is taken
    expect(heroImageFor(opp([]), new Map(), [], new Set())?.src).toBe("/api/imagery/vexcel/ortho?propertyId=1018657");
  });

  it("reasons mix one AI observation with CoStar facts", () => {
    const byId = new Map([obs("a", 0), obs("b", 1), fact("f1", "Ceiling 20 ft"), fact("f2", "9,889 SF advertised")].map((e) => [e.id, e]));
    expect(reasonsFor(opp(["a", "b", "f1", "f2"]), byId).map((e) => e.id)).toEqual(["a", "f1", "f2"]);
  });
});
