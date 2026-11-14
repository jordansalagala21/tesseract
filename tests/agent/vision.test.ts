import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { Evidence } from "@/lib/contracts";
import {
  MAX_EDGE_PX,
  analyzeExteriorImages,
  analyzeInteriorImages,
  prepareImage,
  violatesVisionRules,
  visionDeps,
  type VisionImage,
} from "@/lib/agent/vision";

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 180, b: 160 } } }).png().toBuffer();

async function images(n: number, kind: VisionImage["kind"] = "photo"): Promise<VisionImage[]> {
  const data = await png(64, 48);
  return Array.from({ length: n }, (_, i) => ({ data, kind, source: { system: "matterport" as const, recordId: "NxYn1owequw", field: `assets.photos[${i}]` }, mediaRef: "NxYn1owequw" }));
}

/** A fake model that returns `result` as its JSON text and records the request. */
function fakeModel(result: unknown, stop_reason: BetaMessage["stop_reason"] = "end_turn") {
  const calls: MessageCreateParamsNonStreaming[] = [];
  const createMessage = async (params: MessageCreateParamsNonStreaming) => {
    calls.push(params);
    return { content: [{ type: "text", text: JSON.stringify(result) }], stop_reason } as unknown as BetaMessage;
  };
  return { createMessage, calls };
}

const opts = (createMessage: ReturnType<typeof fakeModel>["createMessage"]) => ({ createMessage, model: "claude-opus-5-5", idPrefix: "ev_int1" });

describe("prepareImage", () => {
  it("downscales the long edge to at most 1568 px and keeps the aspect ratio", async () => {
    const out = await prepareImage(await png(4000, 2000));
    expect(out.width).toBe(MAX_EDGE_PX);
    expect(out.height).toBe(784);
  });
  it("never upscales a small image", async () => {
    const out = await prepareImage(await png(640, 480));
    expect([out.width, out.height]).toEqual([640, 480]);
  });
});

describe("violatesVisionRules", () => {
  it.each([
    "The ceiling is about 14 ft high",
    "Roughly 2,000 sq ft of open floor",
    "The space appears to be ADA compliant",
    "Zoning looks commercial",
    "The restrooms seem up to code",
    "Structurally sound slab",
  ])("rejects %j", (s) => expect(violatesVisionRules(s)).toBe(true));
  it.each(["A long bar counter with back-bar shelving", "Floor-to-ceiling windows along the front", "Two sinks in the restroom"])(
    "allows %j",
    (s) => expect(violatesVisionRules(s)).toBe(false),
  );
});

describe("analyzeInteriorImages", () => {
  const result = {
    observations: [
      { statement: "A built-out bar counter with back-bar shelving", tag: "bar_counter", confidence: "high", imageIndexes: [0] },
      { statement: "Ceiling is roughly 16 ft high", tag: "high_open_ceiling", confidence: "high", imageIndexes: [1] },
      { statement: "Possibly a small kitchen pass-through", tag: "commercial_kitchen", confidence: "low", imageIndexes: [1] },
      { statement: "Finished restrooms", tag: "restrooms", confidence: "medium", imageIndexes: [9] },
    ],
    notObserved: ["No cooking line or exhaust hood visible"],
  };

  it("returns valid ai_observation evidence with model, confidence, caveat and sources", async () => {
    const { createMessage } = fakeModel(result);
    const out = await analyzeInteriorImages(await images(2), "p1018657-s21053094", opts(createMessage));
    for (const e of out.evidence) {
      const parsed = Evidence.parse({ ...e, id: e.id ?? "x", createdAt: "2026-11-14T00:00:00Z" });
      expect(parsed.kind).toBe("ai_observation");
      if (parsed.kind === "ai_observation") {
        expect(parsed.model).toBe("claude-opus-5-5");
        expect(parsed.caveat).toMatch(/Not a measurement/);
        expect(parsed.sources[0].system).toBe("matterport");
      }
    }
  });

  it("drops measurement claims and out-of-range image indexes", async () => {
    const { createMessage } = fakeModel(result);
    const out = await analyzeInteriorImages(await images(2), "s", opts(createMessage));
    const statements = out.evidence.map((e) => e.statement);
    expect(statements).not.toContain("Ceiling is roughly 16 ft high");
    expect(statements).not.toContain("Finished restrooms"); // image 9 does not exist
    expect(out.summary).toMatch(/2 dropped/);
  });

  it("turns only medium/high build-out observations into scoring facts", async () => {
    const { createMessage } = fakeModel(result);
    const out = await analyzeInteriorImages(await images(2), "p1018657-s21053094", opts(createMessage));
    expect(out.facts).toEqual({ "p1018657-s21053094": { buildOut: [{ value: "bar_counter", evidenceId: "ev_int1_1" }] } });
  });

  it("records what it could not see as low-confidence observations with an extra caveat", async () => {
    const { createMessage } = fakeModel(result);
    const out = await analyzeInteriorImages(await images(2), "s", opts(createMessage));
    const none = out.evidence.find((e) => e.statement.startsWith("No cooking line"));
    expect(none && none.kind === "ai_observation" && none.confidence).toBe("low");
    expect(none && none.kind === "ai_observation" && none.caveat).toMatch(/does not mean it is absent/);
  });

  it("sends downscaled base64 images, a JSON schema and the refusal fallback", async () => {
    const { createMessage, calls } = fakeModel({ observations: [], notObserved: [] });
    await analyzeInteriorImages(await images(3), "s", opts(createMessage));
    const req = calls[0];
    const content = req.messages[0].content as { type: string }[];
    expect(content.filter((b) => b.type === "image")).toHaveLength(3);
    expect(req.output_config?.format?.type).toBe("json_schema");
    expect(req.fallbacks).toBe("default");
  });

  it("caps the number of images sent", async () => {
    const { createMessage, calls } = fakeModel({ observations: [], notObserved: [] });
    await analyzeInteriorImages(await images(12), "s", opts(createMessage));
    expect((calls[0].messages[0].content as { type: string }[]).filter((b) => b.type === "image")).toHaveLength(8);
  });

  it("fails clearly with no images, on a refusal, or on a cut-off response", async () => {
    await expect(analyzeInteriorImages([], "s", opts(fakeModel({}).createMessage))).rejects.toThrow(/No interior images/);
    await expect(analyzeInteriorImages(await images(1), "s", opts(fakeModel({}, "refusal").createMessage))).rejects.toThrow(/declined/);
    await expect(analyzeInteriorImages(await images(1), "s", opts(fakeModel({}, "max_tokens").createMessage))).rejects.toThrow(/cut off/);
  });
});

describe("analyzeExteriorImages", () => {
  it("adds a corner fact only when seen with confidence", async () => {
    const aerial = await images(2, "aerial_ortho");
    const seen = fakeModel({ observations: [{ statement: "The building sits on a street corner", tag: "corner_location", confidence: "high", imageIndexes: [0] }], notObserved: [] });
    const out = await analyzeExteriorImages(aerial, ["p1018657"], { ...opts(seen.createMessage), idPrefix: "ev_ext1" });
    expect(out.facts).toEqual({ p1018657: { isCorner: { value: true, evidenceId: "ev_ext1_1" } } });

    const unsure = fakeModel({ observations: [{ statement: "Maybe a corner lot", tag: "corner_location", confidence: "low", imageIndexes: [0] }], notObserved: [] });
    const out2 = await analyzeExteriorImages(aerial, ["p1018657"], { ...opts(unsure.createMessage), idPrefix: "ev_ext1" });
    expect(out2.facts).toEqual({ p1018657: {} });
  });
});

describe("visionDeps", () => {
  it("wires image sources into the agent's vision tools with unique id prefixes", async () => {
    const imgs = await images(1);
    const { createMessage } = fakeModel({ observations: [{ statement: "Open floor", tag: "open_floor", confidence: "high", imageIndexes: [0] }], notObserved: [] });
    const deps = visionDeps({ interiorImages: async () => imgs, exteriorImages: async () => imgs }, { createMessage, model: "m" });
    const a = await deps.analyzeInterior({ propertyId: 1, spaceId: 2 });
    const b = await deps.analyzeInterior({ propertyId: 1, spaceId: 2 });
    expect(Object.keys(a.facts!)).toEqual(["p1-s2"]);
    expect(a.evidence[0].id).not.toBe(b.evidence[0].id);
  });
});
