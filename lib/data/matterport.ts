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
import { serverEnv } from "@/lib/config/env";
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
      photos { url }
      floorplans(formats: ["png", "jpg", "dxf"]) { url flags }
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
    photos?: { url?: string | null }[] | null;
    floorplans?: { url?: string | null; flags?: string[] | null }[] | null;
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
  model: MatterportModel;
  expiresAt: number;
}
const metadataCache = new Map<string, CacheEntry>();

/** For tests, and for a long-running dev server that wants a fresh read. */
export function clearModelCache(): void {
  metadataCache.clear();
}

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
    // Formats come from the flags, never from the signed URLs, which must not be stored.
    floorplanFormats: [
      ...new Set((raw.assets?.floorplans ?? []).flatMap((plan) => plan.flags ?? [])),
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
  const env = serverEnv();
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
    errors?: { message?: string }[];
  };
  if (body.errors?.length) {
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
  if (cached && cached.expiresAt > Date.now()) return cached.model;

  const raw = await queryModel(modelId);
  if (!raw) return null;

  const model = toMatterportModel(raw, costar);
  metadataCache.set(modelId, { model, expiresAt: Date.now() + METADATA_TTL_MS });
  return model;
}

/**
 * Freshly signed image URLs for server-side vision (AI-02), photos first then floorplans.
 * Never cached: Matterport signs these for about an hour, so a cached URL is a broken image.
 * The `SourceRef.field` records exactly which asset an observation came from.
 */
export async function getModelImages(modelId: string, limit = 6): Promise<ModelImage[]> {
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
    .map((photo, index) => ({ url: photo.url, index }))
    .filter((p): p is { url: string; index: number } => typeof p.url === "string")
    .map(({ url, index }) => ({ url, kind: "photo" as const, source: ref(`assets.photos[${index}]`) }));

  const floorplans: ModelImage[] = (raw.assets?.floorplans ?? [])
    .map((plan, index) => ({ url: plan.url, index }))
    .filter((p): p is { url: string; index: number } => typeof p.url === "string")
    .map(({ url, index }) => ({
      url,
      kind: "floorplan" as const,
      source: ref(`assets.floorplans[${index}]`),
    }));

  return [...photos, ...floorplans].slice(0, limit);
}
