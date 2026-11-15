/**
 * Analysis store (AI-01). OWNER: Developer 1.
 * In memory by default (CLAUDE.md §11), kept on globalThis so dev hot-reloads don't drop it.
 * On a deployment with Upstash configured (lib/agent/kv.ts), analyses are also written there for
 * a day, so any server instance can answer a poll. Old in-memory analyses are evicted.
 */
import type { AnalysisResponse } from "@/lib/contracts";
import { upstash, type Kv } from "./kv";

const MAX_ENTRIES = 200;
const TTL_SECONDS = 24 * 60 * 60;
const g = globalThis as typeof globalThis & { __tesseractAnalyses?: Map<string, AnalysisResponse>; __tesseractWrites?: Map<string, Promise<void>> };
const memory = (g.__tesseractAnalyses ??= new Map());
const writes = (g.__tesseractWrites ??= new Map());
const key = (id: string) => `tesseract:analysis:${id}`;

let shared: Kv | null | undefined;
const kv = () => (shared === undefined ? (shared = upstash()) : shared);
/** Tests only: swap the shared store (null = memory only). */
export function setSharedStoreForTests(store: Kv | null | undefined) {
  shared = store;
}

/**
 * Save an analysis. Writes for one analysis are applied in order, so a slow progress update can
 * never overwrite the final result. Never throws: a shared-store failure keeps the memory copy.
 */
export function saveAnalysis(a: AnalysisResponse): Promise<void> {
  memory.delete(a.id);
  memory.set(a.id, a);
  while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value as string);
  const store = kv();
  if (!store) return Promise.resolve();
  const body = JSON.stringify(a);
  const next = (writes.get(a.id) ?? Promise.resolve())
    .then(() => store.set(key(a.id), body, TTL_SECONDS))
    .catch((e: unknown) => console.error(`Could not save analysis ${a.id} to the shared store: ${e instanceof Error ? e.message : e}`));
  writes.set(a.id, next);
  void next.then(() => writes.get(a.id) === next && writes.delete(a.id));
  return next;
}

/** This instance's copy first, then the shared store. */
export async function getAnalysis(id: string): Promise<AnalysisResponse | undefined> {
  const local = memory.get(id);
  if (local) return local;
  const store = kv();
  if (!store) return undefined;
  try {
    const raw = await store.get(key(id));
    return raw ? (JSON.parse(raw) as AnalysisResponse) : undefined;
  } catch (e) {
    console.error(`Could not read analysis ${id} from the shared store: ${e instanceof Error ? e.message : e}`);
    return undefined;
  }
}
