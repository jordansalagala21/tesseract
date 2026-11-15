// AI concept images for "See the space and its potential" (visual results page).
//
// Tesseract has no image-generation API, so concepts are images made offline (for example in
// ChatGPT from the space's own scan photo) and added here. Two kinds, never confused:
//   - SPACE_CONCEPTS: made from THIS space's scan photo, keyed by subject ("p<property>-s<space>").
//   - GENERIC_CONCEPTS: one per use, made from a different space (the home-page shell at
//     19350 SH-249, Suite 500), labelled as not generated from this scan.
// Anything else shows "Concept preview coming soon".
//
// To add one: save a 16:9 WebP under public/concepts/<subject>/<use>.webp and list it below.
import type { Opportunity } from "@/lib/contracts";
import type { UseCategory } from "@/lib/market/uses";

export type Concept = { src: string; scope: "space" | "generic" };

const SPACE_CONCEPTS: Record<string, Partial<Record<UseCategory, string>>> = {
  // "p1018657-s21053094": { restaurant_bar: "/concepts/p1018657-s21053094/restaurant_bar.webp" },
};

const GENERIC_CONCEPTS: Partial<Record<UseCategory, string>> = {
  fitness_studio: "/hero/gym.webp",
  cafe: "/hero/cafe.webp",
};

const subjectOf = (o: Pick<Opportunity, "propertyId" | "spaceId">) => (o.spaceId ? `p${o.propertyId}-s${o.spaceId}` : `p${o.propertyId}`);

/** The concept for an idea: one made from this space first, then a generic one for the use. */
export function conceptFor(o: Pick<Opportunity, "propertyId" | "spaceId" | "useCategory">): Concept | null {
  const use = o.useCategory as UseCategory;
  const own = SPACE_CONCEPTS[subjectOf(o)]?.[use];
  if (own) return { src: own, scope: "space" };
  const generic = GENERIC_CONCEPTS[use];
  return generic ? { src: generic, scope: "generic" } : null;
}
