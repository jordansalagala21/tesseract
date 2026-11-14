/**
 * Property & AvailableSpace — normalized from the CoStar static kit.
 * Producer: Developer 2 (lib/data). Consumers: Dev 1 (agent), Dev 3 (UI).
 * OWNER of this contract file: Developer 1 (changes need team review).
 *
 * Source datasets: data/commercial-property.jsonl, data/commercial-listing-summary.jsonl
 * Field meanings: costar-hackathon-kit/models/*.md
 */
import { z } from "zod";
import { IsoDate, LatLon, Market, SourceRef } from "./common";

export const PropertyAddress = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  postcode: z.string().nullable(),
});

export const RetailFrontage = z.object({
  street: z.string(),
  feet: z.number().nullable(),
  curbCuts: z.number().int().nullable(),
  isPrimary: z.boolean().nullable(),
});

/** Full property profile (GET /api/properties/[id]). */
export const Property = z.object({
  /** CoStar PropertyId (commercial-property.id) */
  id: z.number().int(),
  name: z.string().nullable(),
  address: PropertyAddress,
  location: LatLon,
  market: Market,
  researchMarketId: z.number().int(),
  submarketId: z.number().int().nullable(),
  /** Decoded enum names via schemas/enums.json, e.g. "GeneralRetail" */
  propertyType: z.string(),
  propertySubtype: z.string().nullable(),
  buildingClass: z.enum(["A", "B", "C", "F"]).nullable(),
  /** CoStar Building Rating 1–5 */
  buildingRating: z.number().int().min(1).max(5).nullable(),
  constructionStatus: z.string(),
  rentableAreaSf: z.number().nullable(),
  grossAreaSf: z.number().nullable(),
  stories: z.number().int().nullable(),
  lot: z.object({ value: z.number(), unit: z.enum(["acres", "sqft"]) }).nullable(),
  zoningDescription: z.string().nullable(),
  yearBuilt: z.number().int().nullable(),
  yearRenovated: z.number().int().nullable(),
  parkingRatioPer1000Sf: z.number().nullable(),
  retail: z
    .object({
      glaSf: z.number().nullable(),
      ceilingHeightFt: z.number().nullable(),
      frontage: z.array(RetailFrontage),
    })
    .nullable(),
  /** Matterport model ids attached to this property (commercial-properties.csv) */
  matterportModelIds: z.array(z.string()),
  /** Counts that help the UI decide what to show */
  counts: z.object({
    availableSpaces: z.number().int(),
    currentTenants: z.number().int(),
    saleComps: z.number().int(),
  }),
  source: SourceRef,
});
export type Property = z.infer<typeof Property>;

/** Lightweight row for search results (GET /api/properties). */
export const PropertySummary = Property.pick({
  id: true,
  name: true,
  address: true,
  location: true,
  market: true,
  propertyType: true,
  buildingClass: true,
  rentableAreaSf: true,
}).extend({
  availableSpaceCount: z.number().int(),
  hasMatterport: z.boolean(),
  /** True when at least one available space has a suite-matched Matterport model */
  hasSuiteMatched3d: z.boolean(),
});
export type PropertySummary = z.infer<typeof PropertySummary>;

/**
 * Availability is ADVERTISED, never confirmed vacant.
 * CoStar: "Available is not vacant" (models/commercial-listing-summary.md).
 * There is intentionally no "vacant" value here.
 */
export const AvailabilityStatus = z.enum(["advertised_available", "lease_pending"]);

export const AskingRent = z.object({
  /** Raw values as published; 0 in source means "no rate" and is mapped to null */
  low: z.number().nullable(),
  high: z.number().nullable(),
  basis: z.enum(["monthly", "yearly", "unknown"]),
  /** Normalized $/SF/year (monthly × 12). null when no rate was published. */
  psfYearLow: z.number().nullable(),
  psfYearHigh: z.number().nullable(),
  /** e.g. "TripleNet", "FullServiceGross", "PlusElectric" — rents are not comparable across service types */
  serviceType: z.string().nullable(),
});

export const AvailableSpace = z.object({
  /** forLeaseSummary.spaces[].id */
  id: z.number().int(),
  listingId: z.number().int(),
  propertyId: z.number().int(),
  listingType: z.string(),
  suite: z.string().nullable(),
  floor: z.string().nullable(),
  /** Office | Retail | OfficeRetail | Medical | OfficeMedical | Flex | Industrial | Unknown */
  spaceUse: z.string(),
  /** Relet | New | Sublet | Assignment */
  spaceType: z.string().nullable(),
  sfMin: z.number().nullable(),
  sfMax: z.number().nullable(),
  askingRent: AskingRent,
  availabilityStatus: AvailabilityStatus,
  availableOn: IsoDate.nullable(),
  onMarketDate: IsoDate.nullable(),
  floorPlanImageUrl: z.string().nullable(),
  /** Matterport model linked to THIS suite, if any */
  matterport: z
    .object({
      modelId: z.string(),
      /**
       * How the model was linked to this suite:
       * - space_floorplan_videokey: the space's own CoStar floorPlan record carries the model id
       *   (a direct link; ~20 spaces kit-wide). Prefer this when both signals exist.
       * - caption_suite_match: a CoStar property attachment caption names this suite
       *   (a text match, not an official link). Where both exist in the kit, they agree.
       */
      linkMethod: z.enum(["space_floorplan_videokey", "caption_suite_match"]),
      caption: z.string(),
    })
    .nullable(),
  source: SourceRef,
});
export type AvailableSpace = z.infer<typeof AvailableSpace>;
