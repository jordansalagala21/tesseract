/**
 * The agent's get_nearby_context tool on top of DATA-07 + lib/market (AI-04). OWNER: Developer 1.
 *
 * Data access is injected so the tool is testable without the kit: pass DATA-07's
 * getNearbyContext and, when available, DATA-03's space lookup for the subject's serviceType and
 * spaceUse. Without that lookup a space's comparable rent is recorded as missing, never guessed.
 */
import type { NearbyContext } from "@/lib/data/nearby";
import { analyzeNearby } from "@/lib/market/analyze";
import { ratedGroups, roundRange, type SubjectBasis } from "@/lib/market/rent";
import { subjectKey, type DataDeps } from "./tools";

/** Same default as POST /api/market/analyze, so the agent and the dashboard agree. */
export const DEFAULT_RADIUS_M = 1500;

export interface NearbySources {
  getNearbyContext(propertyId: number, radiusMeters: number): Promise<NearbyContext>;
  /** The subject space's CoStar serviceType and spaceUse (DATA-03), or null if unknown. */
  getSpaceBasis?(propertyId: number, spaceId: number): Promise<SubjectBasis | null>;
}

export function nearbyContextDep(sources: NearbySources): DataDeps["getNearbyContext"] {
  return async ({ propertyId, spaceId, radiusMeters, useCategories }) => {
    const radius = radiusMeters ?? DEFAULT_RADIUS_M;
    const [nearby, basis] = await Promise.all([
      sources.getNearbyContext(propertyId, radius),
      spaceId && sources.getSpaceBasis ? sources.getSpaceBasis(propertyId, spaceId) : Promise.resolve(null),
    ]);
    const result = analyzeNearby(nearby, {
      subject: spaceId ? (basis ?? {}) : undefined,
      spaceUse: basis?.spaceUse ?? undefined,
      uses: useCategories,
    });

    return {
      summary: result.summary,
      evidence: result.evidence,
      market: { [subjectKey(propertyId, spaceId)]: result.signals },
      marketAnalysis: result.analysis,
      // Kept small: the model sees evidence statements already; this is for its reasoning.
      data: {
        rentGroupsWithRates: ratedGroups(nearby.comparableSpaces.rentGroups).slice(0, 6).map((g) => ({
          serviceType: g.serviceType,
          spaceUse: g.spaceUse,
          n: g.withPublishedRate,
          ...roundRange(g.askingRentPsfYear),
        })),
        topIndustries: nearby.nearbyTenants.byIndustry.slice(0, 6),
        limitations: result.analysis.limitations,
      },
    };
  };
}
