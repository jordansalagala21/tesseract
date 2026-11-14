/**
 * MatterportModel & AerialImagery.
 * Producer: Developer 2 (lib/data/matterport, lib/data/vexcel). Consumers: Dev 1, Dev 3.
 * OWNER of this contract file: Developer 1.
 */
import { z } from "zod";
import { IsoDateTime, LatLon, SourceRef } from "./common";

export const MatterportRoom = z.object({
  id: z.string(),
  /** Matterport room classification label, e.g. "Office", "Kitchen", "Bathroom", "Other", "Void" */
  classification: z.string().nullable(),
  areaSf: z.number().nullable(),
  widthFt: z.number().nullable(),
  depthFt: z.number().nullable(),
  floorLabel: z.string().nullable(),
});

export const MatterportModel = z.object({
  /** Matterport model id == CoStar attachment videoKey == CSV MatterportModelId */
  id: z.string(),
  name: z.string(),
  propertyId: z.number().int(),
  /** CoStar attachment caption, e.g. "Suite 100 - 9,889SF" */
  costarCaption: z.string().nullable(),
  /** Suite this model is matched to (caption text match), or null if building-level / unknown */
  matchedSuite: z.string().nullable(),
  /** https://my.matterport.com/show/?m=<id> — safe for the client */
  embedUrl: z.string(),
  visibility: z.string().nullable(),
  address: z.string().nullable(),
  location: LatLon.nullable(),
  /** Scanned floor area — NOT leasable area. Can differ from listing SF by ~10%. */
  scannedAreaSf: z.number().nullable(),
  floors: z.array(z.object({ id: z.string(), label: z.string().nullable(), areaSf: z.number().nullable() })),
  rooms: z.array(MatterportRoom),
  panoCount: z.number().int(),
  photoCount: z.number().int(),
  floorplanFormats: z.array(z.string()),
  createdAt: IsoDateTime.nullable(),
  fetchedAt: IsoDateTime,
  source: SourceRef,
});
export type MatterportModel = z.infer<typeof MatterportModel>;

export const AerialKind = z.enum(["ortho", "oblique"]);
export const ObliqueDirection = z.enum(["north", "south", "east", "west"]);

export const AerialImagery = z.object({
  id: z.string(),
  propertyId: z.number().int(),
  provider: z.literal("vexcel"),
  kind: AerialKind,
  direction: ObliqueDirection.nullable(),
  /** Vexcel layer, e.g. "urban" */
  layer: z.string(),
  /** Vexcel collection, e.g. "us-tx-houston-2026" */
  collection: z.string(),
  captureDate: z.object({ first: z.string(), last: z.string() }),
  gsdMeters: z.object({ min: z.number(), max: z.number() }),
  /** WKT polygon (EPSG:4326) requested */
  bboxWkt: z.string(),
  /** INTERNAL proxy path, e.g. /api/imagery/vexcel/ortho?propertyId=1018657 — never a URL with the key */
  imageUrl: z.string().startsWith("/api/"),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  attribution: z.string().default("© Vexcel Imaging US, Inc."),
  fetchedAt: IsoDateTime,
  source: SourceRef,
});
export type AerialImagery = z.infer<typeof AerialImagery>;
