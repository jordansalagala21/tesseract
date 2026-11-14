// OWNER: Developer 2 — DATA-03. Contract: PropertyDetailResponse (lib/contracts/api.ts)
import { getProperty } from "@/lib/data/properties";
import { getCurrentTenants } from "@/lib/data/tenants";
import { apiError } from "@/lib/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/properties/[id]">) {
  const { id } = await ctx.params;
  const propertyId = Number(id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return apiError(400, "bad_request", `"${id}" is not a CoStar PropertyId.`);
  }

  const property = await getProperty(propertyId);
  if (!property) {
    return apiError(404, "not_found", `No property ${propertyId} in the CoStar kit.`);
  }

  return Response.json({
    property,
    // Enriched by DATA-04: the CoStar-side links live on property.matterportModelIds, and the
    // Matterport Model API supplies scanned area, floors and rooms.
    matterportModels: [],
    // The UI requests aerial imagery lazily through /api/imagery/vexcel (DATA-05).
    aerial: [],
    currentTenants: await getCurrentTenants(propertyId),
  });
}
