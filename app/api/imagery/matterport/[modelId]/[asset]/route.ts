// Streams one Matterport scan photo or floor plan through our server (results-page thumbnails).
// The signed asset URLs Matterport returns expire in ~1 h and must never reach the browser, so
// the browser asks for /api/imagery/matterport/<modelId>/photos-3 and we fetch the bytes.
// OWNER: Developer 2 (imagery routes). Written by Developer 1 for the visual results page.
import { getModelImages, type ModelImage } from "@/lib/data/matterport";
import { apiError } from "@/lib/http";

const MODEL_ID = /^[A-Za-z0-9]{11}$/;
const ASSET = /^(photos|floorplans)-(\d{1,3})$/;
/** Signed URLs live about an hour; keep the list well inside that, on the server only. */
const LIST_TTL_MS = 45 * 60 * 1000;
const lists = new Map<string, { images: ModelImage[]; expiresAt: number }>();

async function assetsFor(modelId: string): Promise<ModelImage[]> {
  const hit = lists.get(modelId);
  if (hit && hit.expiresAt > Date.now()) return hit.images;
  const images = await getModelImages(modelId, 200);
  lists.set(modelId, { images, expiresAt: Date.now() + LIST_TTL_MS });
  return images;
}

export async function GET(_request: Request, ctx: RouteContext<"/api/imagery/matterport/[modelId]/[asset]">) {
  const { modelId, asset } = await ctx.params;
  const m = ASSET.exec(asset);
  if (!MODEL_ID.test(modelId) || !m) return apiError(400, "bad_request", "Expected /api/imagery/matterport/<modelId>/photos-<n> or floorplans-<n>.");

  try {
    const field = `assets.${m[1]}[${Number(m[2])}]`;
    const image = (await assetsFor(modelId)).find((i) => i.source.field === field);
    if (!image) return apiError(404, "not_found", `Scan ${modelId} has no ${m[1].slice(0, -1)} ${m[2]}.`);

    let upstream = await fetch(image.url, { cache: "no-store" });
    if (upstream.status === 403 || upstream.status === 401) {
      // The signed URL expired early: refresh the list once.
      lists.delete(modelId);
      const fresh = (await assetsFor(modelId)).find((i) => i.source.field === field);
      if (fresh) upstream = await fetch(fresh.url, { cache: "no-store" });
    }
    if (!upstream.ok || !upstream.body) return apiError(502, "upstream_error", `Matterport photo unavailable for ${modelId}.`);

    return new Response(upstream.body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
        // Private, short: the browser may reuse it within a session; nothing is stored server-side.
        "cache-control": "private, max-age=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("MATTERPORT_API")) return apiError(503, "upstream_error", "Matterport imagery is not configured on this server.");
    // Never forward the upstream body or URL: the URL is signed.
    return apiError(502, "upstream_error", `Matterport photo unavailable for ${modelId}.`);
  }
}
