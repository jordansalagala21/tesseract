// The one data-fetch module for the property pages (UI-02).
// It calls the live routes (DATA-02, DATA-03). While a route still answers 501 Not Implemented,
// it falls back to the 2600 Travis St contract fixtures and marks the result as sample data.
import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { z } from "zod";
import {
  PropertyDetailResponse,
  PropertySearchResponse,
  PropertySpacesResponse,
  type Market,
  type PropertySummary,
} from "@/lib/contracts";
import { travisOrtho, travisProperty, travisSpaces, travisSuite100Model } from "@/lib/contracts/examples/travis";

export type Loaded<T> = { data: T; sample: boolean };

async function getJson<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S> | null> {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const res = await fetch(origin + path, { cache: "no-store" });
  if (res.status === 501) return null;
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return schema.parse(await res.json());
}

const sampleSummary: PropertySummary = {
  id: travisProperty.id,
  name: travisProperty.name,
  address: travisProperty.address,
  location: travisProperty.location,
  market: travisProperty.market,
  propertyType: travisProperty.propertyType,
  buildingClass: travisProperty.buildingClass,
  rentableAreaSf: travisProperty.rentableAreaSf,
  availableSpaceCount: travisSpaces.length,
  hasMatterport: travisProperty.matterportModelIds.length > 0,
  hasSuiteMatched3d: travisSpaces.some((s) => s.matterport),
};

export type SearchParams = { q?: string; market?: Market };

export async function searchProperties(params: SearchParams): Promise<Loaded<z.infer<typeof PropertySearchResponse>>> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.market) qs.set("market", params.market);
  const live = await getJson(`/api/properties?${qs}`, PropertySearchResponse);
  if (live) return { data: live, sample: false };

  const { name, address, market } = sampleSummary;
  const haystack = `${name ?? ""} ${address.street} ${address.city}`.toLowerCase();
  const hit = (!params.q || haystack.includes(params.q.toLowerCase())) && (!params.market || params.market === market);
  return { data: { items: hit ? [sampleSummary] : [], total: hit ? 1 : 0 }, sample: true };
}

export async function getPropertyPage(id: number) {
  const [detail, spaces] = await Promise.all([
    getJson(`/api/properties/${id}`, PropertyDetailResponse),
    getJson(`/api/properties/${id}/spaces`, PropertySpacesResponse),
  ]);
  if (detail && spaces) return { detail, spaces, sample: false };
  if (id !== travisProperty.id) notFound();

  return {
    detail: detail ?? {
      property: travisProperty,
      matterportModels: [travisSuite100Model],
      aerial: [travisOrtho],
      // The fixture has no tenant rows; the page says so instead of inventing names.
      currentTenants: [],
    },
    spaces: spaces ?? {
      propertyId: id,
      items: travisSpaces,
      availabilityNote: "Advertised availability from CoStar listings — not confirmed physical vacancy." as const,
    },
    sample: true,
  };
}
