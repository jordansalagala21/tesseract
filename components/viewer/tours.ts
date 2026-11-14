import type { AvailableSpace, MatterportModel } from "@/lib/contracts";

export type TourOption = {
  modelId: string;
  embedUrl: string;
  title: string;
  /** Suite named by the CoStar photo caption, or null for a building-level scan */
  matchedSuite: string | null;
  caption: string | null;
  /** True when matchedSuite is one of the currently advertised spaces */
  suiteListed: boolean;
  scannedAreaSf: number | null;
  advertisedSf: number | null;
};

const MODEL_ID = /^[A-Za-z0-9]{6,20}$/;
const EMBED_PREFIX = "https://my.matterport.com/show/?m=";

/** Only ever iframe Matterport's own Showcase page, whatever URL the data carries. */
export function safeEmbedUrl(modelId: string): string | null {
  return MODEL_ID.test(modelId) ? EMBED_PREFIX + modelId : null;
}

/**
 * One entry per Matterport model on the property: full model metadata first, then models
 * known only from a space's caption match, then any other model id on the property.
 * Scans of advertised suites come first.
 */
export function toTourOptions(
  models: MatterportModel[],
  spaces: AvailableSpace[],
  propertyModelIds: string[] = [],
): TourOption[] {
  const bySuite = new Map(spaces.filter((s) => s.suite).map((s) => [s.suite as string, s]));
  const tours = new Map<string, TourOption>();
  const add = (t: Omit<TourOption, "embedUrl" | "suiteListed" | "advertisedSf">) => {
    const embedUrl = safeEmbedUrl(t.modelId);
    if (!embedUrl || tours.has(t.modelId)) return;
    const space = t.matchedSuite ? bySuite.get(t.matchedSuite) : undefined;
    tours.set(t.modelId, { ...t, embedUrl, suiteListed: !!space, advertisedSf: space?.sfMax ?? null });
  };

  for (const m of models) {
    add({
      modelId: m.id,
      title: m.matchedSuite ? `Suite ${m.matchedSuite}` : m.name,
      matchedSuite: m.matchedSuite,
      caption: m.costarCaption,
      scannedAreaSf: m.scannedAreaSf,
    });
  }
  for (const s of spaces) {
    if (!s.matterport) continue;
    add({
      modelId: s.matterport.modelId,
      title: s.suite ? `Suite ${s.suite}` : s.matterport.caption,
      matchedSuite: s.suite,
      caption: s.matterport.caption,
      scannedAreaSf: null,
    });
  }
  for (const id of propertyModelIds) {
    add({ modelId: id, title: "Building scan", matchedSuite: null, caption: null, scannedAreaSf: null });
  }

  return [...tours.values()].sort((a, b) => Number(b.suiteListed) - Number(a.suiteListed));
}
