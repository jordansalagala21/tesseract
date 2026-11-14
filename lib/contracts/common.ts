/**
 * Shared primitives used by every contract.
 * OWNER: Developer 1 (Tech Lead). Changes require a PR reviewed by all three devs.
 */
import { z } from "zod";

/** ISO-8601 timestamp string. */
export const IsoDateTime = z.iso.datetime({ offset: true });
/** ISO date (YYYY-MM-DD). */
export const IsoDate = z.iso.date();

/** The two markets covered by the CoStar hackathon kit. */
export const Market = z.enum(["houston", "los_angeles"]);
export type Market = z.infer<typeof Market>;

/** CoStar research market ids used in the kit: 14 = Houston, 20 = Los Angeles. */
export const RESEARCH_MARKET_IDS = { houston: 14, los_angeles: 20 } as const;

export const LatLon = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type LatLon = z.infer<typeof LatLon>;

/** Where a piece of information came from. */
export const SourceSystem = z.enum([
  "costar", // static sponsor kit (data/*.jsonl)
  "matterport", // Matterport Model API / Showcase
  "vexcel", // Vexcel API v2 imagery
  "census", // optional third-party (BONUS-02)
  "user", // supplied by the person using Tesseract
  "ai", // produced by a model (vision or reasoning)
  "derived", // deterministic calculation over other sources
]);
export type SourceSystem = z.infer<typeof SourceSystem>;

/**
 * A pointer back to the exact record / field / image that supports a claim.
 * Every Evidence item carries at least one SourceRef.
 */
export const SourceRef = z.object({
  system: SourceSystem,
  /** e.g. "commercial-property", "commercial-listing-summary", "model", "ortho/extract" */
  dataset: z.string().optional(),
  /** CoStar PropertyId / listing id / space id, Matterport model id, Vexcel collection, ... */
  recordId: z.string().optional(),
  /** Dotted field path inside the record, e.g. "propertyRetail.structural.ceilingHeightFeet" */
  field: z.string().optional(),
  /** Internal app URL (never a signed third-party URL, never a URL containing a key) */
  url: z.string().optional(),
  /** When the underlying data was captured (scan date, aerial capture date) */
  capturedAt: z.string().optional(),
  /** When Tesseract fetched it */
  retrievedAt: IsoDateTime.optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

/** Standard error envelope for every internal API route. */
export const ApiError = z.object({
  error: z.object({
    code: z.enum([
      "bad_request",
      "not_found",
      "not_implemented",
      "upstream_error",
      "rate_limited",
      "internal",
    ]),
    message: z.string(),
    /** GitHub issue that will implement this, for not_implemented */
    issue: z.string().optional(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
