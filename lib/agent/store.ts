/**
 * In-memory analysis store (AI-01). OWNER: Developer 1.
 * No persistence by design (CLAUDE.md §11). Kept on globalThis so dev hot-reloads don't drop it.
 * Old analyses are evicted so memory stays bounded.
 */
import type { AnalysisResponse } from "@/lib/contracts";

const MAX_ENTRIES = 200;
const g = globalThis as typeof globalThis & { __tesseractAnalyses?: Map<string, AnalysisResponse> };
const store = (g.__tesseractAnalyses ??= new Map());

export function saveAnalysis(a: AnalysisResponse): void {
  store.delete(a.id);
  store.set(a.id, a);
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
}

export function getAnalysis(id: string): AnalysisResponse | undefined {
  return store.get(id);
}
