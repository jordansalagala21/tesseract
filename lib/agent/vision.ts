/**
 * Vision analysis (AI-02). OWNER: Developer 1.
 *
 * Turns interior photos / floor plans (Matterport) and aerial images (Vexcel) into AI observations.
 * Image ACQUISITION is not here: DATA-04 / DATA-05 supply the bytes and their SourceRefs. This module
 * only looks at what it is given.
 *
 * Rules (CLAUDE.md §6.4):
 *  - every output is an `ai_observation` with the model id, a confidence, a caveat and source refs;
 *  - never a measurement, inspection, or code / ADA / zoning finding. The prompt forbids them and a
 *    post-filter drops any observation that slips one through;
 *  - images are downscaled to at most 1568 px on the long edge before upload.
 */
import sharp from "sharp";
import { z } from "zod";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { SourceRef } from "@/lib/contracts";
import type { SiteFacts } from "@/lib/market/scoring";
import type { BuildOutTag } from "@/lib/market/uses";
import type { EvidenceDraft } from "./evidence";
import type { ToolOutput } from "./tools";

export const MAX_EDGE_PX = 1568;
const MAX_IMAGES = 8;

export type CreateMessage = (params: MessageCreateParamsNonStreaming) => Promise<BetaMessage>;

export interface VisionImage {
  data: Buffer;
  /** Where the image came from, e.g. { system: "matterport", recordId: "<modelId>", field: "assets.photos[3]" } */
  source: SourceRef;
  kind: "photo" | "floorplan" | "aerial_ortho" | "aerial_oblique";
  /** Optional short label shown in the prompt, e.g. "oblique, looking north" */
  label?: string;
  /** Optional media reference for the Evidence Trail (internal proxy URL or Matterport id) */
  mediaRef?: string;
}

export interface VisionOptions {
  createMessage: CreateMessage;
  model: string;
  /** Prefix for evidence ids, so several runs in one analysis never collide. */
  idPrefix: string;
}

/* ------------------------------------------------------------- images */

/** Downscale to ≤ MAX_EDGE_PX on the long edge and re-encode as JPEG. Never upscales. */
export async function prepareImage(data: Buffer): Promise<{ base64: string; width: number; height: number }> {
  const out = await sharp(data)
    .rotate()
    .resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { base64: out.data.toString("base64"), width: out.info.width, height: out.info.height };
}

/* ------------------------------------------------------------ schemas */

const INTERIOR_TAGS = [
  "commercial_kitchen",
  "bar_counter",
  "open_floor",
  "private_offices",
  "exam_rooms",
  "restrooms",
  "storefront_glazing",
  "high_open_ceiling",
] as const satisfies readonly BuildOutTag[];

const Confidence = z.enum(["high", "medium", "low"]);

const InteriorResult = z.object({
  observations: z.array(
    z.object({
      statement: z.string().describe("One plain sentence about what is visible. No numbers, sizes or code/zoning judgements."),
      tag: z.enum([...INTERIOR_TAGS, "other"]).describe("The build-out feature this shows, or other"),
      confidence: Confidence,
      imageIndexes: z.array(z.number()).describe("Which images (0-based) show it"),
    }),
  ),
  notObserved: z.array(z.string()).describe("Notable features you looked for but could not see, e.g. 'No commercial kitchen visible'"),
});

const EXTERIOR_TAGS = ["surface_parking", "corner_location", "street_frontage", "adjacent_retail", "adjacent_residential", "adjacent_office", "rooftop_equipment", "other"] as const;

const ExteriorResult = z.object({
  observations: z.array(
    z.object({
      statement: z.string().describe("One plain sentence about what is visible from above. No distances, counts of spaces or code/zoning judgements."),
      tag: z.enum(EXTERIOR_TAGS),
      confidence: Confidence,
      imageIndexes: z.array(z.number()),
    }),
  ),
  notObserved: z.array(z.string()),
});

/* ------------------------------------------------------------- guard */

/** Claims vision must never make: dimensions, areas, counts with units, code/zoning/ADA/permits. */
const FORBIDDEN = [
  /\b\d+(\.\d+)?\s*(ft|feet|foot|'|in|inch|inches|m|meters?|metres?|sf|sq\.?\s*ft|square\s*(feet|foot|meters?))\b/i,
  /\b(zoning|zoned|permit(ted|s)?|code[- ]compliant|building code|fire code|ada\b|ada[- ]compliant|up to code|compliance)\b/i,
  /\b(inspect(ed|ion)|structurally sound|load[- ]bearing)\b/i,
];

export function violatesVisionRules(statement: string): boolean {
  return FORBIDDEN.some((re) => re.test(statement));
}

/* ------------------------------------------------------------- prompts */

const INTERIOR_PROMPT = `You are looking at photos (and possibly a floor plan) of an advertised commercial space, to help judge what businesses could use it.
Report only what is clearly visible: existing build-out (kitchen equipment, hood, bar counter, restrooms, private offices, exam rooms), the layout (open floor or partitioned), the ceiling (exposed and high-looking, or dropped), storefront glazing, and condition in plain words.
Rules: no measurements, sizes, distances or counts with units; no code, ADA, zoning, permit or structural judgements; do not guess what you cannot see. Use low confidence when unsure. List important features you looked for but could not see under notObserved. Never use the word "vacant" (say "empty" or "unoccupied-looking" for rooms): Tesseract never calls space vacant.`;

const EXTERIOR_PROMPT = `You are looking at aerial images (top-down and/or oblique) of a commercial property, to judge site access for new businesses.
Report only what is clearly visible: surface parking next to the building, whether it sits on a street corner, street frontage, and what kinds of buildings are next to it (retail, residential, office).
Rules: no distances, areas or parking-space counts; no code, zoning or permit judgements; do not guess what you cannot see. Use low confidence when unsure. List important things you looked for but could not see under notObserved. Never use the word "vacant" (say "undeveloped lot" or "empty lot"): Tesseract never calls space vacant.`;

/* ------------------------------------------------------------- core */

async function askVision<S extends z.ZodType>(
  images: VisionImage[],
  prompt: string,
  schema: S,
  opts: VisionOptions,
): Promise<z.infer<S>> {
  const prepared = await Promise.all(images.map((i) => prepareImage(i.data)));
  const content = images.flatMap((img, i) => [
    { type: "text" as const, text: `Image ${i} (${img.kind}${img.label ? `, ${img.label}` : ""}):` },
    { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: prepared[i].base64 } },
  ]);
  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _drop;

  const response = await opts.createMessage({
    model: opts.model,
    max_tokens: 16000,
    system: prompt,
    messages: [{ role: "user", content: [...content, { type: "text", text: "Return your observations." }] }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: jsonSchema } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (response.stop_reason === "refusal") throw new Error("The vision model declined these images.");
  if (response.stop_reason === "max_tokens") throw new Error("The vision response was cut off.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return schema.parse(JSON.parse(text));
}

interface RawObservation {
  statement: string;
  tag: string;
  confidence: "high" | "medium" | "low";
  imageIndexes: number[];
}

/** Tesseract never calls space vacant; if the model slips, reword ("vacant lot" → "empty lot"). */
export const noVacant = (text: string) => text.replace(/\bvacant\b/gi, (w) => (w[0] === "V" ? "Empty" : "empty"));

/** Build ai_observation drafts, dropping rule-breaking statements and out-of-range image indexes. */
function toEvidence(raw: RawObservation[], images: VisionImage[], opts: VisionOptions, caveat: string) {
  const kept: { draft: EvidenceDraft; tag: string; confidence: RawObservation["confidence"] }[] = [];
  let dropped = 0;
  raw.forEach((o) => {
    const idx = [...new Set(o.imageIndexes.filter((i) => Number.isInteger(i) && i >= 0 && i < images.length))];
    if (violatesVisionRules(o.statement) || idx.length === 0) {
      dropped++;
      return;
    }
    // Interior refs are Matterport model ids (the UI opens the tour), aerial refs are our proxy
    // URLs. One entry per distinct ref: six photos from one scan are one tour, not six images.
    const media = [
      ...new Map(
        idx.flatMap((i) => {
          const ref = images[i].mediaRef;
          if (!ref) return [];
          const type = images[i].kind.startsWith("aerial") ? ("aerial" as const) : ("matterport_model" as const);
          return [[`${type}:${ref}`, { type, ref }] as const];
        }),
      ).values(),
    ];
    kept.push({
      tag: o.tag,
      confidence: o.confidence,
      draft: {
        kind: "ai_observation",
        id: `${opts.idPrefix}_${kept.length + 1}`,
        statement: noVacant(o.statement),
        model: opts.model,
        confidence: o.confidence,
        caveat,
        sources: idx.map((i) => images[i].source),
        ...(media.length ? { media } : {}),
      },
    });
  });
  return { kept, dropped };
}

function notObservedEvidence(notes: string[], images: VisionImage[], opts: VisionOptions, caveat: string): EvidenceDraft[] {
  return notes
    .filter((n) => !violatesVisionRules(n))
    .slice(0, 5)
    .map((statement, i) => ({
      kind: "ai_observation" as const,
      id: `${opts.idPrefix}_none_${i + 1}`,
      statement: noVacant(statement),
      model: opts.model,
      confidence: "low" as const,
      caveat: `${caveat} Not seeing something in these images does not mean it is absent.`,
      sources: images.map((im) => im.source),
    }));
}

const INTERIOR_CAVEAT = "AI observation from Matterport imagery. Not a measurement, inspection, or code, ADA or zoning determination.";
const EXTERIOR_CAVEAT = "AI observation from Vexcel aerial imagery. Not a survey, measurement, or code or zoning determination.";

/** Interior: photos and floor plans → observations and build-out facts for scoring. */
export async function analyzeInteriorImages(images: VisionImage[], subject: string, opts: VisionOptions): Promise<ToolOutput> {
  if (images.length === 0) throw new Error("No interior images were available to analyze.");
  const used = images.slice(0, MAX_IMAGES);
  const result = await askVision(used, INTERIOR_PROMPT, InteriorResult, opts);
  const { kept, dropped } = toEvidence(result.observations, used, opts, INTERIOR_CAVEAT);

  // Only medium/high-confidence build-out observations become scoring facts.
  const buildOut = kept
    .filter((k) => (INTERIOR_TAGS as readonly string[]).includes(k.tag) && k.confidence !== "low")
    .map((k) => ({ value: k.tag as BuildOutTag, evidenceId: k.draft.id! }));
  const facts: SiteFacts = buildOut.length ? { buildOut } : {};

  const tags = [...new Set(buildOut.map((b) => b.value.replace(/_/g, " ")))];
  return {
    summary: `${kept.length} observation${kept.length === 1 ? "" : "s"} from ${used.length} image${used.length === 1 ? "" : "s"}${tags.length ? `: ${tags.join(", ")}` : ""}${dropped ? ` (${dropped} dropped by the vision rules)` : ""}`,
    evidence: [...kept.map((k) => k.draft), ...notObservedEvidence(result.notObserved, used, opts, INTERIOR_CAVEAT)],
    facts: { [subject]: facts },
  };
}

/** Exterior: aerial images → observations, plus a corner-location fact when seen with confidence. */
export async function analyzeExteriorImages(images: VisionImage[], subjects: string[], opts: VisionOptions): Promise<ToolOutput> {
  if (images.length === 0) throw new Error("No aerial images were available to analyze.");
  const used = images.slice(0, MAX_IMAGES);
  const result = await askVision(used, EXTERIOR_PROMPT, ExteriorResult, opts);
  const { kept, dropped } = toEvidence(result.observations, used, opts, EXTERIOR_CAVEAT);

  const corner = kept.find((k) => k.tag === "corner_location" && k.confidence !== "low");
  const facts: SiteFacts = corner ? { isCorner: { value: true, evidenceId: corner.draft.id! } } : {};

  const tags = [...new Set(kept.filter((k) => k.tag !== "other").map((k) => k.tag.replace(/_/g, " ")))];
  return {
    summary: `${kept.length} aerial observation${kept.length === 1 ? "" : "s"}${tags.length ? `: ${tags.join(", ")}` : ""}${dropped ? ` (${dropped} dropped by the vision rules)` : ""}`,
    evidence: [...kept.map((k) => k.draft), ...notObservedEvidence(result.notObserved, used, opts, EXTERIOR_CAVEAT)],
    facts: Object.fromEntries(subjects.map((s) => [s, facts])),
  };
}

/* --------------------------------------------------------- dependency wiring */

/** Image sources supplied by the data layer (DATA-04 Matterport, DATA-05 Vexcel). */
export interface ImageSources {
  interiorImages(input: { propertyId: number; spaceId?: number }): Promise<VisionImage[]>;
  exteriorImages(input: { propertyId: number }): Promise<VisionImage[]>;
  /** Subjects that should receive the exterior facts (the property and any of its spaces being scored). */
  subjectsFor?(propertyId: number): string[];
}

/** Build the agent's `analyzeInterior` / `analyzeExterior` deps from image sources. */
export function visionDeps(sources: ImageSources, opts: Omit<VisionOptions, "idPrefix">) {
  let run = 0;
  return {
    analyzeInterior: async (input: { propertyId: number; spaceId?: number }) => {
      const subject = input.spaceId ? `p${input.propertyId}-s${input.spaceId}` : `p${input.propertyId}`;
      return analyzeInteriorImages(await sources.interiorImages(input), subject, { ...opts, idPrefix: `ev_int${++run}` });
    },
    analyzeExterior: async (input: { propertyId: number }) => {
      const subjects = sources.subjectsFor?.(input.propertyId) ?? [`p${input.propertyId}`];
      return analyzeExteriorImages(await sources.exteriorImages(input), subjects, { ...opts, idPrefix: `ev_ext${++run}` });
    },
  };
}
