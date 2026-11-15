// The one data-fetch module for the property pages (UI-02, INT-01).
// Every page reads live CoStar data through the property routes (DATA-02, DATA-03). There is no
// fixture fallback: if a route fails, the page says the data is unavailable instead of showing
// sample data that could be mistaken for live output (CLAUDE.md §6.8).
import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { PropertyDetailResponse, PropertySearchResponse, PropertySpacesResponse, type Market } from "@/lib/contracts";

/**
 * Why a page has no data. "not_set_up" means this server has no CoStar database yet
 * (`npm run db:build`); "unavailable" covers every other failure.
 */
export type Unavailable = { ok: false; reason: "not_set_up" | "unavailable" };
export type Loaded<T> = { ok: true; data: T } | Unavailable;

// This same app. Fixed on purpose, never derived from the Host header, which would let a forged
// request make the server fetch any host (SSRF). Locally: loopback. On Vercel there is no
// loopback between functions, so use the site's own URL from Vercel's system variables.
const ORIGIN =
  process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://127.0.0.1:${process.env.PORT ?? 3000}`;

async function getJson<S extends z.ZodType>(path: string, schema: S): Promise<Loaded<z.infer<S>>> {
  // Property data is per request (live listings, signed imagery). Without this, Next 16's
  // prerender check reaches fetch(), which reads the clock, and logs "unstable value Date.now()".
  await connection();
  let res: Response;
  try {
    res = await fetch(ORIGIN + path, { cache: "no-store" });
  } catch (error) {
    console.error(`[property-data] ${path} did not answer:`, error instanceof Error ? error.message : error);
    return { ok: false, reason: "unavailable" };
  }
  if (res.status === 404) notFound();
  if (!res.ok) {
    // The route's own message says when the database has not been built. Log the status only:
    // the body is for developers and is not shown to the user.
    const body = await res.text().catch(() => "");
    console.error(`[property-data] ${path} answered ${res.status}`);
    return { ok: false, reason: body.includes("db:build") ? "not_set_up" : "unavailable" };
  }
  const parsed = schema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    console.error(`[property-data] ${path} returned data that doesn't match the contract:\n${z.prettifyError(parsed.error)}`);
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, data: parsed.data };
}

export type SearchParams = { q?: string; market?: Market };

export function searchProperties(params: SearchParams) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.market) qs.set("market", params.market);
  return getJson(`/api/properties?${qs}`, PropertySearchResponse);
}

/** Detail and spaces load in parallel; the page needs both, so either failing makes it unavailable. */
export async function getPropertyPage(
  id: number,
): Promise<Loaded<{ detail: z.infer<typeof PropertyDetailResponse>; spaces: z.infer<typeof PropertySpacesResponse> }>> {
  const [detail, spaces] = await Promise.all([
    getJson(`/api/properties/${id}`, PropertyDetailResponse),
    getJson(`/api/properties/${id}/spaces`, PropertySpacesResponse),
  ]);
  if (!detail.ok) return detail;
  if (!spaces.ok) return spaces;
  return { ok: true, data: { detail: detail.data, spaces: spaces.data } };
}
