/**
 * Vexcel aerial imagery client (DATA-05).
 * OWNER: Developer 2. Consumers: Dev 3 (exterior viewer), Dev 1 (AI-02 exterior vision).
 *
 * Three rules this module exists to enforce:
 *  1. The API key never leaves the server. Callers get our own proxy path
 *     (/api/imagery/vexcel/...), never a vexcelgroup.com URL and never the key.
 *  2. Vexcel sends `X-Frame-Options: DENY` and `cache-control: no-store`, so an upstream URL
 *     cannot be used in an <img> or iframe at all — proxying is required, not a preference.
 *  3. Images are watermarked "© Vexcel Imaging US, Inc." and the attribution travels with the
 *     metadata so the UI cannot lose it.
 *
 * Metadata vs bytes: `fetchVexcelImage` returns both (one upstream call) and is what the proxy
 * route uses. `getAerialImagery` returns only the contract record and discards the bytes, for
 * server-side callers that need provenance before the browser asks for the picture.
 *
 * Storage and ML terms are unconfirmed with the sponsor, so nothing here writes an image to
 * disk or caches one (docs/DATA_SOURCES.md §3).
 */
import "server-only";
import { z } from "zod";
import { vexcelEnv } from "@/lib/config/env";
import type { AerialImagery, AerialKind, ObliqueDirection, SourceRef } from "@/lib/contracts";

type Kind = z.infer<typeof AerialKind>;
type Direction = z.infer<typeof ObliqueDirection>;

const BASE = "https://api.vexcelgroup.com/v2";
/** The only layer the hackathon kit's two markets are covered by. */
const DEFAULT_LAYER = "urban";
const ATTRIBUTION = "© Vexcel Imaging US, Inc.";
/** Metres of half-width around a property. ~80 m shows the building and its parking/frontage. */
const DEFAULT_BOX_METERS = 80;

/** Metres per degree of latitude. Longitude shrinks by cos(latitude). */
const METERS_PER_DEGREE_LAT = 111_320;

export interface VexcelXmp {
  collection: string | null;
  layer: string | null;
  productType: string | null;
  /** ISO-8601, or null when the packet does not report it. */
  firstCaptureDate: string | null;
  lastCaptureDate: string | null;
  minGsd: number | null;
  maxGsd: number | null;
  width: number | null;
  height: number | null;
  geometry: string | null;
  cameraTechnology: string | null;
}

/**
 * A closed EPSG:4326 polygon around a point.
 *
 * `extract` rejects a bare POINT with HTTP 400 ("requires either 'bbox-dimensions',
 * 'buffer-meter'…"), so a polygon is built here rather than relying on a server-side buffer,
 * and the same WKT is reported back in `AerialImagery.bboxWkt`.
 */
export function buildBboxWkt(lat: number, lon: number, meters: number = DEFAULT_BOX_METERS): string {
  const dLat = meters / METERS_PER_DEGREE_LAT;
  const dLon = meters / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  const ring = [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat],
    [lon - dLon, lat + dLat],
    [lon - dLon, lat - dLat],
  ];
  return `POLYGON((${ring.map(([x, y]) => `${x} ${y}`).join(",")}))`;
}

function tag(xmp: string, name: string): string | null {
  const match = new RegExp(`<Vexcel:${name}>([^<]*)</Vexcel:${name}>`).exec(xmp);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function numberTag(xmp: string, name: string): number | null {
  const raw = tag(xmp, name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Normalize the two date formats Vexcel emits:
 *   ortho:   "Fri Dec 19 16:38:26 UTC 2025"  (Java Date.toString)
 *   oblique: "2025-12-31 17:36:59.0"         (no zone marker)
 * The bare form is read as UTC, which is what every zoned field in these packets reports.
 */
function isoDate(raw: string | null): string | null {
  if (!raw) return null;
  const bare = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(raw);
  const parsed = new Date(bare ? `${bare[1]}T${bare[2]}Z` : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Pull the Vexcel XMP packet out of a JPEG (or a bare XMP string) and read the fields we use.
 * Returns null when there is no packet — a caller must then report metadata as missing rather
 * than guess at a collection or a capture date.
 */
export function parseVexcelXmp(image: Buffer | string): VexcelXmp | null {
  const text = typeof image === "string" ? image : image.toString("latin1");
  const start = text.indexOf("<x:xmpmeta");
  if (start < 0) return null;
  const end = text.indexOf("</x:xmpmeta>", start);
  const xmp = end < 0 ? text.slice(start) : text.slice(start, end + "</x:xmpmeta>".length);

  // Ortho reports a first/last pair; oblique reports one capture-date, which stands for both
  // ends rather than being padded into an invented range.
  const single = isoDate(tag(xmp, "capture-date"));
  const first = isoDate(tag(xmp, "first-capture-date")) ?? single;
  const last = isoDate(tag(xmp, "last-capture-date")) ?? single;

  // pixel-bbox is "x,y,width,height"; the last two are the extracted image's dimensions.
  const pixelBbox = tag(xmp, "pixel-bbox")?.split(",").map(Number);
  const dimensions =
    pixelBbox?.length === 4 && pixelBbox.every(Number.isFinite)
      ? { width: pixelBbox[2], height: pixelBbox[3] }
      : { width: null, height: null };

  return {
    collection: tag(xmp, "collection"),
    layer: tag(xmp, "layer"),
    productType: tag(xmp, "product-type"),
    firstCaptureDate: first,
    lastCaptureDate: last,
    minGsd: numberTag(xmp, "min-gsd"),
    maxGsd: numberTag(xmp, "max-gsd"),
    width: dimensions.width,
    height: dimensions.height,
    geometry: tag(xmp, "geometry"),
    cameraTechnology: tag(xmp, "camera-technology"),
  };
}

/** The internal path the browser uses. Never a Vexcel URL, never the key. */
export function proxyPath(propertyId: number, kind: Kind, direction: Direction | null): string {
  const query = new URLSearchParams({ propertyId: String(propertyId) });
  if (kind === "oblique" && direction) query.set("direction", direction);
  return `/api/imagery/vexcel/${kind}?${query.toString()}`;
}

export interface ToAerialImageryInput {
  propertyId: number;
  kind: Kind;
  direction: Direction | null;
  bboxWkt: string;
  xmp: VexcelXmp;
}

/** Map a parsed packet onto the contract. Pure — unit-tested without a key. */
export function toAerialImagery(input: ToAerialImageryInput): AerialImagery {
  const { propertyId, kind, direction, bboxWkt, xmp } = input;
  const dataset = kind === "ortho" ? "ortho/extract" : "oriented/extract";

  return {
    id: `vexcel:${xmp.collection ?? "unknown"}:${xmp.productType ?? kind}:${propertyId}`,
    propertyId,
    provider: "vexcel",
    kind,
    direction,
    layer: xmp.layer ?? DEFAULT_LAYER,
    collection: xmp.collection ?? "unknown",
    // The contract wants strings; "" reports "not stated by the packet" without inventing a date.
    captureDate: { first: xmp.firstCaptureDate ?? "", last: xmp.lastCaptureDate ?? "" },
    gsdMeters: { min: xmp.minGsd ?? 0, max: xmp.maxGsd ?? 0 },
    bboxWkt,
    imageUrl: proxyPath(propertyId, kind, direction),
    width: xmp.width,
    height: xmp.height,
    attribution: ATTRIBUTION,
    fetchedAt: new Date().toISOString(),
    source: {
      system: "vexcel",
      dataset,
      recordId: xmp.collection ?? "unknown",
      capturedAt: xmp.firstCaptureDate ?? undefined,
      retrievedAt: new Date().toISOString(),
    } satisfies SourceRef,
  };
}

export interface FetchImageInput {
  lat: number;
  lon: number;
  kind: Kind;
  direction: Direction | null;
  layer?: string;
  meters?: number;
}

export interface FetchedImage {
  bytes: Buffer;
  contentType: string;
  xmp: VexcelXmp | null;
  bboxWkt: string;
}

/**
 * Fetch one image and its metadata in a single upstream call.
 * Throws with a message safe to log: the upstream body can echo the request, which carries
 * the key, so only the status is reported.
 */
export async function fetchVexcelImage(input: FetchImageInput): Promise<FetchedImage> {
  const { VEXCEL_API_KEY } = vexcelEnv();
  const layer = input.layer ?? DEFAULT_LAYER;
  const bboxWkt = buildBboxWkt(input.lat, input.lon, input.meters);

  const query = new URLSearchParams({ layer, srid: "4326", wkt: bboxWkt });
  let path: string;
  if (input.kind === "ortho") {
    path = "ortho/extract";
  } else {
    path = "oriented/extract";
    query.set("product-type", `oblique-${input.direction ?? "north"}`);
  }

  const response = await fetch(`${BASE}/${path}?${query.toString()}`, {
    headers: { "x-api-key": VEXCEL_API_KEY },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Vexcel ${path} returned ${response.status} for property at ${input.lat},${input.lon}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    contentType: response.headers.get("content-type") ?? "image/jpeg",
    xmp: parseVexcelXmp(bytes),
    bboxWkt,
  };
}

/**
 * Contract metadata for one image. Costs one upstream call and discards the bytes, so prefer
 * the proxy route when the browser is going to request the picture anyway.
 */
export async function getAerialImagery(
  propertyId: number,
  lat: number,
  lon: number,
  kind: Kind,
  direction: Direction | null,
): Promise<AerialImagery> {
  const { xmp, bboxWkt } = await fetchVexcelImage({ lat, lon, kind, direction });
  return toAerialImagery({
    propertyId,
    kind,
    direction,
    bboxWkt,
    xmp: xmp ?? {
      collection: null,
      layer: null,
      productType: null,
      firstCaptureDate: null,
      lastCaptureDate: null,
      minGsd: null,
      maxGsd: null,
      width: null,
      height: null,
      geometry: null,
      cameraTechnology: null,
    },
  });
}
