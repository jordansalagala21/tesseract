// AI concept images for "See the space and its potential" (visual results page).
//
// Concepts are generated OFFLINE, never during an analysis: `npm run concepts:generate` edits one
// of the space's own scan photos per use with OpenAI and writes public/concepts/manifest.json
// ({ "<subject>": { "<use>": "/concepts/<subject>/<use>.webp" } }), which the page fetches.
// Two kinds, never confused:
//   - space concepts: made from THIS space's scan photo (from the manifest).
//   - generic concepts: one per use, made from a different space (the home-page shell at
//     19350 SH-249, Suite 500), labelled as not generated from this scan.
// Anything else shows "Concept preview coming soon".
import type { Opportunity } from "@/lib/contracts";
import type { UseCategory } from "@/lib/market/uses";

export type Concept = { src: string; scope: "space" | "generic" };

/** public/concepts/manifest.json, as written by scripts/generate-concepts.ts. */
export type ConceptManifest = Record<string, Partial<Record<string, string>>>;

/** Only our own /concepts/ files, whatever the manifest says. */
const SAFE = /^\/concepts\/[A-Za-z0-9_-]+\/[a-z_]+\.webp$/;

const GENERIC_CONCEPTS: Partial<Record<UseCategory, string>> = {
  fitness_studio: "/hero/gym.webp",
  cafe: "/hero/cafe.webp",
};

const subjectOf = (o: Pick<Opportunity, "propertyId" | "spaceId">) => (o.spaceId ? `p${o.propertyId}-s${o.spaceId}` : `p${o.propertyId}`);

/** The concept for an idea: one made from this space first, then a generic one for the use. */
export function conceptFor(o: Pick<Opportunity, "propertyId" | "spaceId" | "useCategory">, manifest: ConceptManifest = {}): Concept | null {
  const use = o.useCategory as UseCategory;
  const own = manifest[subjectOf(o)]?.[use];
  if (own && SAFE.test(own)) return { src: own, scope: "space" };
  const generic = GENERIC_CONCEPTS[use];
  return generic ? { src: generic, scope: "generic" } : null;
}
