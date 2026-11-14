/**
 * Matterport Model API client (DATA-04).
 * OWNER: Developer 2. Consumers: Dev 1 (AI-02 vision), Dev 3 (3D explorer).
 *
 * READ ONLY. This module never mutates a model — no Mattertag, label or publication writes
 * (CLAUDE.md §11). Credentials stay server-side: the only Matterport URL that reaches the
 * browser is the public Showcase embed.
 *
 * Two caching rules, and they differ on purpose:
 *   - model METADATA is cached in memory (it changes rarely and a scan is ~30 KB of JSON);
 *   - signed ASSET URLs are never cached — they expire in about an hour, so a cached one is a
 *     broken image later. getModelImages() always re-signs.
 */
import "server-only";
import { matterportEnv } from "@/lib/config/env";
import type { MatterportModel, SourceRef } from "@/lib/contracts";

const ENDPOINT = "https://api.matterport.com/api/models/graph";
/** The Showcase embed is public and safe for the client. */
const EMBED_BASE = "https://my.matterport.com/show/?m=";
/** Metadata is stable; an hour keeps a demo responsive without serving stale scans. */
const METADATA_TTL_MS = 60 * 60 * 1000;

/** Field set verified against the live API on 2026-11-14. Imperial, because the contract is in feet. */
export const MODEL_QUERY = `query GetModel($id: ID!) {
  model(id: $id) {
    id
    name
    visibility
    created
    address { address }
    geocoordinates { latitude longitude }
    dimensions(units: imperial) { areaFloor }
    floors { id label dimensions(units: imperial) { areaFloor } }
    rooms {
      id
      classifications { label confidence }
      dimensions(units: imperial) { areaFloor width depth }
    }
    panoLocations { id }
    assets {
      photos { resizeUrl(resolution: web) }
      floorplans(formats: ["png", "jpg", "dxf"]) { url filename flags }
    }
    publication { published url }
  }
}`;

/** The raw GraphQL shape. Everything is optional: Matterport omits what a scan lacks. */
export interface RawMatterportModel {
  id: string;
  name?: string | null;
  visibility?: string | null;
  created?: string | null;
  address?: { address?: string | null } | null;
  geocoordinates?: { latitude?: number | null; longitude?: number | null } | null;
  dimensions?: { areaFloor?: number | null } | null;
  floors?: { id: string; label?: string | null; dimensions?: { areaFloor?: number | null } | null }[] | null;
  rooms?:
    | {
        id: string;
        classifications?: { label?: string | null; confidence?: number | null }[] | null;
        dimensions?: { areaFloor?: number | null; width?: number | null; depth?: number | null } | null;
      }[]
    | null;
  panoLocations?: { id: string }[] | null;
  assets?: {
    /** `resizeUrl(resolution: web)` — 1280x720. The original is ~7 MB per photo. */
    photos?: { resizeUrl?: string | null }[] | null;
    /** `flags` are render styles (photogramy/alpha/schematic), NOT formats. Format is in `filename`. */
    floorplans?: { url?: string | null; filename?: string | null; flags?: string[] | null }[] | null;
  } | null;
  publication?: { published?: boolean | null; url?: string | null } | null;
}

/** The CoStar half of the contract — the API knows nothing about PropertyIds or suites. */
export interface CostarLink {
  propertyId: number;
  caption?: string | null;
  matchedSuite?: string | null;
}

export interface ModelImage {
  url: string;
  kind: "photo" | "floorplan";
  source: SourceRef;
}

interface CacheEntry {
  /** The RAW API response. Never the mapped model: that embeds the caller's CoStar
   *  association, so a second caller asking about a different property would be handed
   *  the first caller's propertyId, caption and matchedSuite. */
  raw: RawMatterportModel;
  expiresAt: number;
}
const metadataCache = new Map<string, CacheEntry>();

/** For tests, and for a long-running dev server that wants a fresh read. */
export function clearModelCache(): void {
  metadataCache.clear();
}

/** Lower-cased file extension without the dot, or null when there isn't one. */
function extensionOf(filename: string | null | undefined): string | null {
  const match = /\.([A-Za-z0-9]+)$/.exec(filename ?? "");
  return match ? match[1].toLowerCase() : null;
}

/** Vision can read raster images only; DXF is a CAD drawing and is never offered to it. */
const VISION_IMAGE_FORMATS = new Set(["png", "jpg", "jpeg"]);

function highestConfidenceLabel(
  classifications: { label?: string | null; confidence?: number | null }[] | null | undefined,
): string | null {
  if (!classifications?.length) return null;
  const best = [...classifications].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  return best.label ?? null;
}

/** Map a raw response onto the contract. Pure — unit-tested without a network or credentials. */
export function toMatterportModel(raw: RawMatterportModel, costar: CostarLink): MatterportModel {
  const latitude = raw.geocoordinates?.latitude;
  const longitude = raw.geocoordinates?.longitude;

  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    propertyId: costar.propertyId,
    costarCaption: costar.caption ?? null,
    matchedSuite: costar.matchedSuite ?? null,
    embedUrl: `${EMBED_BASE}${raw.id}`,
    visibility: raw.visibility ?? null,
    address: raw.address?.address ?? null,
    location:
      typeof latitude === "number" && typeof longitude === "number"
        ? { lat: latitude, lon: longitude }
        : null,
    // Scanned floor area, NOT leasable area: suite 100 scans at 8,879 SF and is advertised at
    // 9,889 SF. The field name is deliberately not "area" so nobody quotes it as leasable.
    scannedAreaSf: raw.dimensions?.areaFloor ?? null,
    floors: (raw.floors ?? []).map((floor) => ({
      id: floor.id,
      label: floor.label ?? null,
      areaSf: floor.dimensions?.areaFloor ?? null,
    })),
    rooms: (raw.rooms ?? []).map((room) => ({
      id: room.id,
      classification: highestConfidenceLabel(room.classifications),
      // "Void" rooms carry no dimensions at all; null is the honest answer, not 0.
      areaSf: room.dimensions?.areaFloor ?? null,
      widthFt: room.dimensions?.width ?? null,
      depthFt: room.dimensions?.depth ?? null,
      floorLabel: null,
    })),
    panoCount: raw.panoLocations?.length ?? 0,
    photoCount: raw.assets?.photos?.length ?? 0,
    // Format comes from the FILENAME extension. `flags` look tempting but are render styles
    // ("photogramy", "alpha", "colored_rooms", "measurements", "schematic"), so reading formats
    // from them yields nonsense and cannot drive the PNG/JPG-only filter vision needs.
    floorplanFormats: [
      ...new Set(
        (raw.assets?.floorplans ?? [])
          .map((plan) => extensionOf(plan.filename))
          .filter((ext): ext is string => ext !== null),
      ),
    ],
    createdAt: raw.created ?? null,
    fetchedAt: new Date().toISOString(),
    source: {
      system: "matterport",
      dataset: "model",
      recordId: raw.id,
      retrievedAt: new Date().toISOString(),
    },
  };
}

async function queryModel(modelId: string): Promise<RawMatterportModel | null> {
  const env = matterportEnv();
  const auth = Buffer.from(`${env.MATTERPORT_API_KEY}:${env.MATTERPORT_API_TOKEN}`).toString("base64");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ query: MODEL_QUERY, variables: { id: modelId } }),
    cache: "no-store",
  });

  if (!response.ok) {
    // Never echo the response body: it can contain the request, and the request carries auth.
    throw new Error(`Matterport API returned ${response.status} for model ${modelId}.`);
  }

  const body = (await response.json()) as {
    data?: { model?: RawMatterportModel | null };
    errors?: { message?: string; extensions?: { code?: string; httpCode?: number } }[];
  };
  if (body.errors?.length) {
    // A missing or invisible model answers HTTP 200 with a GraphQL error carrying
    // extensions.code "not.found" (httpCode 404). That is an absent model, not a failure.
    const notFound = body.errors.some(
      (error) => error.extensions?.code === "not.found" || error.extensions?.httpCode === 404,
    );
    if (notFound) return null;
    throw new Error(`Matterport API rejected the query for ${modelId}: ${body.errors[0]?.message}`);
  }
  return body.data?.model ?? null;
}

/**
 * Model metadata for one Matterport scan, as a contract `MatterportModel`.
 * Returns null when the model does not exist or is not visible to our key.
 * Cached in memory for an hour; `clearModelCache()` resets it.
 */
export async function getMatterportModel(
  modelId: string,
  costar: CostarLink,
): Promise<MatterportModel | null> {
  const cached = metadataCache.get(modelId);
  if (cached && cached.expiresAt > Date.now()) {
    // Mapped per call, so the association and fetchedAt belong to THIS caller.
    return toMatterportModel(cached.raw, costar);
  }

  const raw = await queryModel(modelId);
  if (!raw) return null;

  metadataCache.set(modelId, { raw, expiresAt: Date.now() + METADATA_TTL_MS });
  return toMatterportModel(raw, costar);
}

/**
 * Freshly signed image URLs for server-side vision (AI-02), photos first then floorplans.
 *
 * Never cached: Matterport signs these for about an hour, so a cached URL is a broken image.
 * The `SourceRef.field` records exactly which asset an observation came from.
 *
 * Selection rules:
 *  - photos use `resizeUrl(resolution: web)` (1280x720). Originals are ~7 MB each, so six of
 *    them would move ~40 MB per analysis only to be downscaled for vision anyway.
 *  - one slot is reserved for a floor plan when an eligible one exists, because the plan is
 *    what shows layout and circulation; without the reservation `slice()` returns photos only.
 *  - at `limit` 1 the single slot goes to a photo: interior condition is what vision reads best.
 *  - floor plans are offered only as PNG/JPG. DXF is a CAD drawing no vision model can read.
 */
export async function getModelImages(modelId: string, limit = 6): Promise<ModelImage[]> {
  if (limit <= 0) return [];
  const raw = await queryModel(modelId);
  if (!raw) return [];

  const ref = (field: string): SourceRef => ({
    system: "matterport",
    dataset: "model",
    recordId: modelId,
    field,
    retrievedAt: new Date().toISOString(),
  });

  const photos: ModelImage[] = (raw.assets?.photos ?? [])
    .map((photo, index) => ({ url: photo.resizeUrl, index }))
    .filter((photo): photo is { url: string; index: number } => typeof photo.url === "string")
    .map(({ url, index }) => ({ url, kind: "photo" as const, source: ref(`assets.photos[${index}]`) }));

  const floorplans: ModelImage[] = (raw.assets?.floorplans ?? [])
    .map((plan, index) => ({ url: plan.url, index, ext: extensionOf(plan.filename) }))
    .filter(
      (plan): plan is { url: string; index: number; ext: string } =>
        typeof plan.url === "string" && plan.ext !== null && VISION_IMAGE_FORMATS.has(plan.ext),
    )
    .map(({ url, index }) => ({
      url,
      kind: "floorplan" as const,
      source: ref(`assets.floorplans[${index}]`),
    }));

  // Reserve one slot for a floor plan when there is both room for it and one to use.
  const floorplanSlots = limit >= 2 && floorplans.length > 0 ? 1 : 0;
  const selected = [
    ...photos.slice(0, limit - floorplanSlots),
    ...floorplans.slice(0, floorplanSlots),
  ];

  // If there were fewer photos than slots, backfill from the remaining floor plans.
  if (selected.length < limit) {
    for (const plan of floorplans) {
      if (selected.length >= limit) break;
      if (!selected.includes(plan)) selected.push(plan);
    }
  }
  return selected.slice(0, limit);
}
