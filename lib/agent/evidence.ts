/**
 * Evidence registry for one analysis (AI-01). OWNER: Developer 1.
 *
 * Tools add evidence here; everything else refers to it by id. The registry assigns unique ids,
 * validates every item against the contract, and builds the four-bucket index.
 */
import type { z } from "zod";
import { Evidence, type AnalysisResponse } from "@/lib/contracts";

type EvidenceInput = z.input<typeof Evidence>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Evidence as a tool produces it: the registry fills id (if absent) and createdAt. */
export type EvidenceDraft = DistributiveOmit<EvidenceInput, "id" | "createdAt"> & { id?: string };

export class EvidenceRegistry {
  private readonly items = new Map<string, Evidence>();
  private counter = 0;

  constructor(private readonly now: () => string) {}

  /** Add one item; returns its (possibly de-duplicated) id. Throws if it breaks the contract. */
  add(draft: EvidenceDraft): string {
    let id = draft.id ?? `ev_${++this.counter}`;
    while (this.items.has(id)) id = `${draft.id ?? "ev"}_${++this.counter}`;
    const item = Evidence.parse({ ...draft, id, createdAt: this.now() });
    this.items.set(id, item);
    return id;
  }

  addAll(drafts: EvidenceDraft[]): string[] {
    return drafts.map((d) => this.add(d));
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  get(id: string): Evidence | undefined {
    return this.items.get(id);
  }

  /** Keep only ids that exist, so a model typo can never reference phantom evidence. */
  known(ids: string[]): string[] {
    return [...new Set(ids.filter((id) => this.items.has(id)))];
  }

  all(): Evidence[] {
    return [...this.items.values()];
  }

  index(): AnalysisResponse["evidenceIndex"] {
    const of = (kind: Evidence["kind"]) => this.all().filter((e) => e.kind === kind).map((e) => e.id);
    return {
      verifiedFactIds: of("verified_fact"),
      aiObservationIds: of("ai_observation"),
      userAssumptionIds: of("user_assumption"),
      missingInfoIds: of("missing"),
    };
  }

  /** Compact view for the model: id, kind and statement only. */
  summaryFor(ids: string[]): { id: string; kind: Evidence["kind"]; statement: string }[] {
    return ids.flatMap((id) => {
      const e = this.items.get(id);
      return e ? [{ id, kind: e.kind, statement: e.statement }] : [];
    });
  }
}
