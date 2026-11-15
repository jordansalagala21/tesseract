/**
 * Shared key-value store for deployments (Upstash Redis over its REST API). OWNER: Developer 1.
 *
 * On Vercel, the request that starts an analysis and the requests that poll it can land on
 * different server instances, so in-memory state is not enough. When Upstash is configured
 * (Vercel's Upstash integration sets KV_REST_API_URL / KV_REST_API_TOKEN, or the
 * UPSTASH_REDIS_REST_* names), the analysis store and the daily limit use it. Without it
 * (local dev, tests, CI) everything stays in memory, as before.
 */
import "server-only";

export interface Kv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Increment a counter and (re)set its expiry. Returns the new value. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

export function kvConfig(env: Record<string, string | undefined> = process.env): { url: string; token: string } | null {
  const url = (env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL)?.trim();
  const token = (env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN)?.trim();
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

/** An Upstash REST client, or null when none is configured. */
export function upstash(config = kvConfig(), fetchImpl: typeof fetch = fetch): Kv | null {
  if (!config) return null;
  const call = async <T>(commands: (string | number)[][]): Promise<T[]> => {
    const res = await fetchImpl(`${config.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    // Never echo the token: report the status only.
    if (!res.ok) throw new Error(`Shared store answered ${res.status}.`);
    const out = (await res.json()) as { result?: T; error?: string }[];
    const failed = out.find((r) => r.error);
    if (failed) throw new Error(`Shared store error: ${failed.error}`);
    return out.map((r) => r.result as T);
  };
  return {
    async get(key) {
      const [v] = await call<string | null>([["GET", key]]);
      return v ?? null;
    },
    async set(key, value, ttl) {
      await call([["SET", key, value, "EX", ttl]]);
    },
    async incr(key, ttl) {
      const [n] = await call<number>([["INCR", key], ["EXPIRE", key, ttl]]);
      return Number(n);
    },
  };
}
