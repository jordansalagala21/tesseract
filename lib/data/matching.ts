/**
 * CoStar suite <-> Matterport model linking (DATA-01; extended by DATA-06).
 * OWNER: Developer 2.
 *
 * The CoStar kit has no official property-to-Matterport link. Two signals exist:
 *
 *  1. `property.attachments[]` whose `videoExternalReferenceType` is 36 or 234 carry a
 *     `videoKey` (the Matterport model id) and a human-written `caption` that often names
 *     the suite, e.g. "Suite 100 - 9,889SF". Matching that caption text to a space's
 *     `suite` is a HEURISTIC, not an official link — hence `linkMethod` on every result.
 *  2. `space.floorPlan.videoKey` (same reference types) is a direct, unambiguous link, but
 *     it is present on only 20 of the kit's 3,955 advertised spaces. Where both signals
 *     exist (7 spaces) they agree, which is what justifies trusting signal 1.
 *
 * DATA-06 adds coordinate checks on top of these exports — keep them stable.
 */

/** CoStar `videoExternalReferenceType` values that mean "this videoKey is a Matterport model". */
export const MATTERPORT_REFERENCE_TYPES = [36, 234] as const;

/** How a suite came to be linked to a model. Recorded on every link so the UI can caveat it. */
export type SuiteLinkMethod = "caption_suite_match" | "space_floorplan_videokey";

export interface SuiteModelLink {
  modelId: string;
  caption: string;
  matchedSuite: string | null;
  linkMethod: SuiteLinkMethod;
}

/** One `attachments[]` / `floorPlan` entry, as it appears in the kit. */
export interface MatterportAttachment {
  videoKey?: string | null;
  caption?: string | null;
  videoExternalReferenceType?: number | null;
}

const SUITE_IN_CAPTION = /\bsuite\s+([A-Za-z0-9-]+)/i;

/**
 * Canonical form used on BOTH sides of a suite join: upper-cased, trimmed, leading zeros
 * stripped ("0100" and "100" are the same suite). Returns null for a missing/blank suite.
 */
export function normalizeSuite(suite: string | null | undefined): string | null {
  const trimmed = suite?.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const stripped = upper.replace(/^0+/, "");
  // "0" (and "000") must not normalize to the empty string.
  return stripped === "" ? "0" : stripped;
}

/** Pull the suite out of a CoStar attachment caption, e.g. "Suite 100 - 9,889SF" -> "100". */
export function suiteFromCaption(caption: string | null | undefined): string | null {
  if (!caption) return null;
  return SUITE_IN_CAPTION.exec(caption)?.[1] ?? null;
}

function isMatterportAttachment(a: MatterportAttachment): boolean {
  return (
    !!a.videoKey &&
    a.videoExternalReferenceType !== null &&
    a.videoExternalReferenceType !== undefined &&
    (MATTERPORT_REFERENCE_TYPES as readonly number[]).includes(a.videoExternalReferenceType)
  );
}

/**
 * Find the Matterport model whose caption names this suite.
 * Returns null when the space has no suite, no attachment is a Matterport reference,
 * or no caption names this suite.
 */
export function linkSuiteToModel(
  suite: string | null,
  attachments: MatterportAttachment[],
): SuiteModelLink | null {
  const target = normalizeSuite(suite);
  if (!target) return null;

  for (const attachment of attachments) {
    if (!isMatterportAttachment(attachment)) continue;
    const captionSuite = normalizeSuite(suiteFromCaption(attachment.caption));
    if (captionSuite !== null && captionSuite === target) {
      return {
        modelId: attachment.videoKey as string,
        caption: attachment.caption ?? "",
        matchedSuite: target,
        linkMethod: "caption_suite_match",
      };
    }
  }
  return null;
}

/* --------------------------------------------------- DATA-06: coordinate checks */

export interface LatLonPair {
  lat: number;
  lon: number;
}

/** Mean Earth radius in metres. */
const EARTH_RADIUS_M = 6_371_000;

/**
 * Great-circle distance in metres between two WGS-84 points.
 *
 * Used to sanity-check a CoStar↔Matterport link: a scan whose own geocoordinates sit far from
 * the CoStar address is evidence the caption match is wrong, even when the suite text agrees.
 * Matterport omits geocoordinates on some models, so callers must handle a null distance.
 */
export function distanceMeters(a: LatLonPair, b: LatLonPair): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(h));
}

/** How far apart a CoStar address and a Matterport scan may sit before the link looks wrong. */
export const COORDINATE_TOLERANCE_M = 150;

export interface CoordinateCheck {
  distanceMeters: number | null;
  withinTolerance: boolean | null;
}

/**
 * Compare a CoStar address against a Matterport scan's own coordinates.
 * A null `costar` or `matterport` yields nulls — "not reported", never a passing check.
 */
export function checkCoordinates(
  costar: LatLonPair | null | undefined,
  matterport: LatLonPair | null | undefined,
): CoordinateCheck {
  if (!costar || !matterport) return { distanceMeters: null, withinTolerance: null };
  const distance = distanceMeters(costar, matterport);
  return { distanceMeters: distance, withinTolerance: distance <= COORDINATE_TOLERANCE_M };
}
