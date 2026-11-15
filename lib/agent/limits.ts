/**
 * Daily limit on live analyses, so a public deployment cannot run up the Claude, Matterport and
 * Vexcel bills. OWNER: Developer 1.
 *
 * ANALYSIS_DAILY_LIMIT (default 50; 0 or less turns the limit off). The day is US Eastern and
 * resets at midnight. Recorded demo runs never count. Uses the shared store when configured
 * (one count for all server instances), else a per-process count (local dev).
 */
import "server-only";
import { upstash, type Kv } from "./kv";

export const DEFAULT_DAILY_LIMIT = 50;

export function dailyLimit(env: Record<string, string | undefined> = process.env): number {
  const raw = env.ANALYSIS_DAILY_LIMIT?.trim();
  if (!raw) return DEFAULT_DAILY_LIMIT;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : DEFAULT_DAILY_LIMIT;
}

/** YYYY-MM-DD in US Eastern time. */
export const easternDay = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const g = globalThis as typeof globalThis & { __tesseractRuns?: Map<string, number> };
const counts = (g.__tesseractRuns ??= new Map());

export type RunAllowance = { ok: boolean; used: number; limit: number };

/** Count one live analysis against today's limit. Over the limit → ok: false (and not started). */
export async function takeDailyRun(opts: { now?: Date; limit?: number; store?: Kv | null } = {}): Promise<RunAllowance> {
  const limit = opts.limit ?? dailyLimit();
  if (limit <= 0) return { ok: true, used: 0, limit };
  const day = easternDay(opts.now ?? new Date());
  const store = opts.store === undefined ? upstash() : opts.store;
  let used: number;
  if (store) {
    used = await store.incr(`tesseract:runs:${day}`, 2 * 24 * 60 * 60);
  } else {
    used = (counts.get(day) ?? 0) + 1;
    counts.clear();
    counts.set(day, used);
  }
  return { ok: used <= limit, used, limit };
}
