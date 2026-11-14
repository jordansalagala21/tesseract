/**
 * Evidence: the atomic unit of the Evidence Trail.
 *
 * Every statement Tesseract shows the user is one of four kinds:
 *   1. verified_fact     — read directly from a sponsor dataset / API (CoStar, Matterport, Vexcel) or Census
 *   2. ai_observation    — produced by a model looking at sources (e.g. vision on a Matterport photo)
 *   3. user_assumption   — provided (or accepted as a default) by the user
 *   4. missing           — information we need but do not have
 *
 * OWNER: Developer 1.
 */
import { z } from "zod";
import { IsoDateTime, SourceRef } from "./common";

export const EvidenceKind = z.enum([
  "verified_fact",
  "ai_observation",
  "user_assumption",
  "missing",
]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

/** Optional media that lets the UI show the evidence (photo, aerial crop, 3D sweep). */
export const EvidenceMedia = z.object({
  type: z.enum(["image", "matterport_model", "matterport_pano", "aerial", "floorplan"]),
  /** Internal proxy URL (e.g. /api/imagery/...) or Matterport model / pano id */
  ref: z.string(),
  caption: z.string().optional(),
});

const EvidenceBase = z.object({
  /** Stable id within one analysis, e.g. "ev_costar_ceiling" */
  id: z.string().min(1),
  /** Human-readable statement, e.g. "Clear ceiling height is 20 ft" */
  statement: z.string().min(1),
  /** Machine value when there is one */
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  unit: z.string().optional(),
  media: z.array(EvidenceMedia).optional(),
  createdAt: IsoDateTime,
});

export const VerifiedFact = EvidenceBase.extend({
  kind: z.literal("verified_fact"),
  sources: z
    .array(SourceRef)
    .min(1)
    .refine(
      (s) => s.every((r) => ["costar", "matterport", "vexcel", "census", "derived"].includes(r.system)),
      "verified_fact sources must be costar | matterport | vexcel | census | derived",
    ),
});

export const AiObservation = EvidenceBase.extend({
  kind: z.literal("ai_observation"),
  /** The inputs the model looked at (at least one) */
  sources: z.array(SourceRef).min(1),
  /** Model id that produced it */
  model: z.string(),
  confidence: Confidence,
  /** Always shown in UI next to the observation */
  caveat: z.string().default("Visual/AI observation — not a verified measurement or inspection."),
});

export const UserAssumption = EvidenceBase.extend({
  kind: z.literal("user_assumption"),
  /** "user" if typed by the user, "default" if the user accepted a labelled default */
  origin: z.enum(["user", "default"]),
  sources: z.array(SourceRef).default([]),
});

export const MissingInfo = EvidenceBase.extend({
  kind: z.literal("missing"),
  /** Why this matters for the decision */
  whyNeeded: z.string(),
  /** How the user could obtain it (e.g. "Confirm with City of Houston permitting") */
  howToResolve: z.string().optional(),
  sources: z.array(SourceRef).default([]),
});

export const Evidence = z.discriminatedUnion("kind", [
  VerifiedFact,
  AiObservation,
  UserAssumption,
  MissingInfo,
]);
export type Evidence = z.infer<typeof Evidence>;
