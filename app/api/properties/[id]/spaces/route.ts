// OWNER: Developer 2 — DATA-03. Contract: PropertySpacesResponse (lib/contracts/api.ts)
import { getProperty, getSpaces } from "@/lib/data/properties";
import { apiError } from "@/lib/http";

/** The UI renders this next to every space list. CoStar availability is advertised, not vacancy. */
const AVAILABILITY_NOTE =
  "Advertised availability from CoStar listings — not confirmed physical vacancy." as const;

export async function GET(_request: Request, ctx: RouteContext<"/api/properties/[id]/spaces">) {
  const { id } = await ctx.params;
  const propertyId = Number(id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return apiError(400, "bad_request", `"${id}" is not a CoStar PropertyId.`);
  }

  // A property with no advertised space returns an empty list; an unknown id is a 404, so the
  // UI can tell "nothing on the market" apart from "no such property".
  if (!(await getProperty(propertyId))) {
    return apiError(404, "not_found", `No property ${propertyId} in the CoStar kit.`);
  }

  return Response.json({
    propertyId,
    items: await getSpaces(propertyId),
    availabilityNote: AVAILABILITY_NOTE,
  });
}
