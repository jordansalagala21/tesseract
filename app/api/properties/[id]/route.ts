// OWNER: Developer 2 — DATA-03. Contract: PropertyDetailResponse (lib/contracts/api.ts)
import type { AerialImagery, MatterportModel } from "@/lib/contracts";
import { getMatterportModel } from "@/lib/data/matterport";
import { getProperty, getSpaces } from "@/lib/data/properties";
import { getCurrentTenants } from "@/lib/data/tenants";
import { getAerialImagery } from "@/lib/data/vexcel";
import { apiError } from "@/lib/http";

/**
 * Both enrichments are best-effort and must never fail the page: a missing credential, an
 * unshared model or a market Vexcel has not flown is a smaller response, not a 500. The CoStar
 * facts in `property` and `currentTenants` come from our own DuckDB and always answer.
 */
async function bestEffort<T>(label: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    // The message, never the upstream body: a Vexcel error can echo the request, which
    // carries the key.
    console.warn(`[properties/:id] ${label} unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

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

  // DATA-04 + DATA-05 enrichment. The CoStar-side model links live on
  // property.matterportModelIds; Matterport supplies scanned area, floors and rooms, and model
  // metadata is cached for an hour. Vexcel is one upstream call per view, in parallel with the
  // models and with each other, because the imagery is the slow part and the viewer needs the
  // capture date and GSD to label it honestly.
  // Each scan keeps its CoStar association (which advertised suite, which caption), so the tour
  // says "Scan of advertised Suite 100" instead of calling it an unmatched building scan.
  const links = new Map(
    (await getSpaces(propertyId)).flatMap((space) =>
      space.matterport ? [[space.matterport.modelId, { caption: space.matterport.caption, matchedSuite: space.suite }] as const] : [],
    ),
  );
  const [models, ortho, oblique, currentTenants] = await Promise.all([
    Promise.all(
      property.matterportModelIds.map((modelId) =>
        bestEffort(`matterport ${modelId}`, () => getMatterportModel(modelId, { propertyId, ...links.get(modelId) })),
      ),
    ),
    bestEffort("vexcel ortho", () =>
      getAerialImagery(propertyId, property.location.lat, property.location.lon, "ortho", null),
    ),
    bestEffort("vexcel oblique", () =>
      getAerialImagery(propertyId, property.location.lat, property.location.lon, "oblique", "north"),
    ),
    getCurrentTenants(propertyId),
  ]);

  return Response.json({
    property,
    // Advertised suites first, in suite order (Suite 100 before 104), then unmatched building scans.
    matterportModels: models
      .filter((model): model is MatterportModel => model !== null)
      .sort((a, b) =>
        a.matchedSuite === b.matchedSuite
          ? 0
          : a.matchedSuite === null
            ? 1
            : b.matchedSuite === null
              ? -1
              : a.matchedSuite.localeCompare(b.matchedSuite, "en", { numeric: true }),
      ),
    aerial: [ortho, oblique].filter((image): image is AerialImagery => image !== null),
    currentTenants,
  });
}
