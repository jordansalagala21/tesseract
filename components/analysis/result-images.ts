// Which picture goes with which part of the results (visual results page).
// Every image is served by our own routes: scan photos via /api/imagery/matterport/<model>/<asset>
// (signed Matterport URLs never reach the browser) and aerials via /api/imagery/vexcel/...
import type { Evidence, Opportunity, SourceRef } from "@/lib/contracts";

export type ResultImage = { src: string; alt: string; kind: "scan" | "aerial"; evidenceId: string };

const ASSET_FIELD = /^assets\.(photos|floorplans)\[(\d+)\]$/;

/** Our proxy URL for a Matterport photo or floor-plan source, or null. */
export function scanPhotoUrl(source: SourceRef): string | null {
  if (source.system !== "matterport" || !source.recordId || !source.field) return null;
  const m = ASSET_FIELD.exec(source.field);
  return m ? `/api/imagery/matterport/${encodeURIComponent(source.recordId)}/${m[1]}-${m[2]}` : null;
}

/** The pictures an evidence item was drawn from: aerial proxy refs, then scan photos. */
export function imagesFor(e: Evidence): ResultImage[] {
  const out: ResultImage[] = [];
  for (const m of e.media ?? []) {
    if (m.type === "aerial" && m.ref.startsWith("/api/")) out.push({ src: m.ref, alt: "Vexcel aerial image of the property", kind: "aerial", evidenceId: e.id });
  }
  for (const s of e.sources) {
    const src = scanPhotoUrl(s);
    if (src) out.push({ src, alt: "Photo from the Matterport 3D scan", kind: "scan", evidenceId: e.id });
  }
  return [...new Map(out.map((i) => [i.src, i])).values()];
}

/**
 * AI observations that point at a specific picture, interior first. "Not seen" notes are left
 * out: they cite every image, so no single picture shows them.
 */
export function observationsWithImages(evidence: Evidence[]): { e: Evidence; image: ResultImage }[] {
  const seen = new Set<string>();
  const rows = evidence
    .filter((e) => e.kind === "ai_observation" && !e.id.includes("_none_"))
    .flatMap((e) => {
      const image = imagesFor(e)[0];
      return image ? [{ e, image }] : [];
    })
    .filter(({ image }) => (seen.has(image.src) ? false : (seen.add(image.src), true)));
  return [...rows.filter((r) => r.image.kind === "scan"), ...rows.filter((r) => r.image.kind === "aerial")];
}

/**
 * The picture for an idea card: a photo the idea's own evidence cites (so the restaurant shows
 * the bar, the showroom the glazing), else a different photo from the analysis per rank, else
 * the property's aerial view.
 */
export function heroImageFor(o: Opportunity, byId: Map<string, Evidence>, pool: ResultImage[], used: Set<string>): ResultImage | null {
  const own = o.supportingEvidenceIds.flatMap((id) => {
    const e = byId.get(id);
    return e ? imagesFor(e).filter((i) => i.kind === "scan") : [];
  });
  const pick = own.find((i) => !used.has(i.src)) ?? pool.find((i) => i.kind === "scan" && !used.has(i.src)) ?? own[0] ?? pool[0];
  if (pick) {
    used.add(pick.src);
    return pick;
  }
  return { src: `/api/imagery/vexcel/ortho?propertyId=${o.propertyId}`, alt: "Vexcel aerial image of the property", kind: "aerial", evidenceId: "" };
}

/** Up to three plain reasons for an idea, mixing what the AI saw with CoStar facts. */
export function reasonsFor(o: Opportunity, byId: Map<string, Evidence>): Evidence[] {
  const cited = o.supportingEvidenceIds.map((id) => byId.get(id)).filter((e): e is Evidence => !!e);
  const seen = cited.filter((e) => e.kind === "ai_observation");
  const facts = cited.filter((e) => e.kind === "verified_fact").sort((a, b) => a.statement.length - b.statement.length);
  // One thing the AI saw first (it makes each idea specific), then CoStar facts, then more seen.
  return [...seen.slice(0, 1), ...facts, ...seen.slice(1)].slice(0, 3);
}
