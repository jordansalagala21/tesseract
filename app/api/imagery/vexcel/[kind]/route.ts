// OWNER: Developer 2 — DATA-05. Streams Vexcel imagery through our own server.
//
// This route exists because Vexcel sends `X-Frame-Options: DENY` and `cache-control: no-store`,
// so an upstream URL cannot be used by the browser at all — and because the API key must never
// reach the client. The response carries the image bytes plus the provenance the UI needs to
// show attribution, and nothing that identifies Vexcel's endpoint or our key.
import { AerialKind, ObliqueDirection } from "@/lib/contracts";
import { queryRows } from "@/lib/data/duckdb";
import { fetchVexcelImage } from "@/lib/data/vexcel";
import { apiError } from "@/lib/http";

export async function GET(request: Request, ctx: RouteContext<"/api/imagery/vexcel/[kind]">) {
  const { kind: rawKind } = await ctx.params;
  const kind = AerialKind.safeParse(rawKind);
  if (!kind.success) {
    return apiError(400, "bad_request", `Unknown imagery kind "${rawKind}". Use ortho or oblique.`);
  }

  const params = new URL(request.url).searchParams;
  const propertyId = Number(params.get("propertyId"));
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return apiError(400, "bad_request", "propertyId is required and must be a CoStar PropertyId.");
  }

  // Oblique needs a direction; north is the default because it is the one verified for the
  // demo property and the only one the acceptance criteria require.
  let direction: "north" | "south" | "east" | "west" | null = null;
  if (kind.data === "oblique") {
    const raw = params.get("direction") ?? "north";
    const parsed = ObliqueDirection.safeParse(raw);
    if (!parsed.success) {
      return apiError(400, "bad_request", `Unknown direction "${raw}". Use north, south, east or west.`);
    }
    direction = parsed.data;
  }

  const located = await queryRows<{ lat: number; lon: number }>(
    "SELECT lat, lon FROM properties WHERE id = ?",
    [propertyId] as never,
  );
  if (located.length === 0) {
    return apiError(404, "not_found", `No property ${propertyId} in the CoStar kit.`);
  }
  const { lat, lon } = located[0];

  try {
    const { bytes, contentType, xmp, bboxWkt } = await fetchVexcelImage({
      lat,
      lon,
      kind: kind.data,
      direction,
    });

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-length": String(bytes.length),
        // Provenance for the UI. Attribution is mandatory — the image is watermarked and the
        // licence requires the credit to travel with it.
        "x-vexcel-attribution": "© Vexcel Imaging US, Inc.",
        "x-vexcel-collection": xmp?.collection ?? "unknown",
        "x-vexcel-capture-first": xmp?.firstCaptureDate ?? "",
        "x-vexcel-capture-last": xmp?.lastCaptureDate ?? "",
        "x-vexcel-gsd-min": xmp?.minGsd === null || xmp?.minGsd === undefined ? "" : String(xmp.minGsd),
        "x-vexcel-gsd-max": xmp?.maxGsd === null || xmp?.maxGsd === undefined ? "" : String(xmp.maxGsd),
        "x-imagery-bbox-wkt": bboxWkt,
        // Storage and ML terms are unconfirmed with the sponsor, so nothing caches this.
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("VEXCEL_API_KEY")) {
      return apiError(503, "upstream_error", "Vexcel imagery is not configured on this server.");
    }
    if (message.includes("npm run db:build")) {
      return apiError(503, "upstream_error", message);
    }
    // Never forward the upstream body: it can echo the request, and the request carries the key.
    return apiError(502, "upstream_error", `Vexcel imagery is unavailable for property ${propertyId}.`);
  }
}
