// AI concept images for "See the space and its potential" (visual results page).
//
// Concepts are generated OFFLINE, never during an analysis: `npm run concepts:generate` edits one
// of the space's own scan photos per use with OpenAI and writes public/concepts/manifest.json
// ({ "<subject>": { "<use>": "/concepts/<subject>/<use>.webp" } }), which the page fetches.
// Only concepts made from THIS space's own scan photo are shown: an image of a different building
// must never stand in for this one. Anything else shows "Concept preview coming soon".
import type { Opportunity } from "@/lib/contracts";
import type { UseCategory } from "@/lib/market/uses";

export type Concept = { src: string; scope: "space" };

/** public/concepts/manifest.json, as written by scripts/generate-concepts.ts. */
export type ConceptManifest = Record<string, Partial<Record<string, string>>>;

/** Only our own /concepts/ files, whatever the manifest says. */
const SAFE = /^\/concepts\/[A-Za-z0-9_-]+\/[a-z_]+\.webp$/;

const subjectOf = (o: Pick<Opportunity, "propertyId" | "spaceId">) => (o.spaceId ? `p${o.propertyId}-s${o.spaceId}` : `p${o.propertyId}`);

/** The concept for an idea, made from this space's own scan photo, or null. */
export function conceptFor(o: Pick<Opportunity, "propertyId" | "spaceId" | "useCategory">, manifest: ConceptManifest = {}): Concept | null {
  const use = o.useCategory as UseCategory;
  const own = manifest[subjectOf(o)]?.[use];
  return own && SAFE.test(own) ? { src: own, scope: "space" } : null;
}

/**
 * The AI "furniture removed" view of a space (empty.webp, same scan photo as the concepts), or
 * null. Shown first when scan photos of the space were hidden for showing furniture.
 */
export function emptyViewFor(o: Pick<Opportunity, "propertyId" | "spaceId">, manifest: ConceptManifest = {}): string | null {
  const src = manifest[subjectOf(o)]?.empty;
  return src && SAFE.test(src) ? src : null;
}
