import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResponse } from "@/lib/contracts";
import { kvConfig, upstash, type Kv } from "@/lib/agent/kv";
import { dailyLimit, easternDay, takeDailyRun } from "@/lib/agent/limits";
import { getAnalysis, saveAnalysis, setSharedStoreForTests } from "@/lib/agent/store";

vi.mock("server-only", () => ({}));

/** A fake shared store with a controllable delay per write. */
function fakeKv(delays: number[] = []): Kv & { data: Map<string, string> } {
  const data = new Map<string, string>();
  let n = 0;
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => {
      await new Promise((r) => setTimeout(r, delays[n++] ?? 0));
      data.set(k, v);
    },
    incr: async (k) => {
      const v = Number(data.get(k) ?? 0) + 1;
      data.set(k, String(v));
      return v;
    },
  };
}
const analysis = (id: string, status: AnalysisResponse["status"]) => ({ id, status }) as AnalysisResponse;

afterEach(() => setSharedStoreForTests(undefined));

describe("shared analysis store", () => {
  it("is used only when Upstash is configured, under either env name", () => {
    expect(kvConfig({})).toBeNull();
    expect(kvConfig({ KV_REST_API_URL: "https://x.upstash.io/", KV_REST_API_TOKEN: "t" })).toEqual({ url: "https://x.upstash.io", token: "t" });
    expect(kvConfig({ UPSTASH_REDIS_REST_URL: "https://y.upstash.io", UPSTASH_REDIS_REST_TOKEN: "u" })?.url).toBe("https://y.upstash.io");
  });

  it("lets another server instance read an analysis, and keeps writes in order", async () => {
    const kv = fakeKv([30, 0]); // the first (older) write is slow
    setSharedStoreForTests(kv);
    void saveAnalysis(analysis("ana_order", "running"));
    await saveAnalysis(analysis("ana_order", "completed"));
    expect(JSON.parse(kv.data.get("tesseract:analysis:ana_order")!).status).toBe("completed");

    kv.data.set("tesseract:analysis:ana_elsewhere", JSON.stringify(analysis("ana_elsewhere", "running")));
    expect((await getAnalysis("ana_elsewhere"))?.status).toBe("running");
    expect(await getAnalysis("ana_missing")).toBeUndefined();
  });

  it("never fails a save or a read when the shared store is down", async () => {
    const broken: Kv = { get: () => Promise.reject(new Error("down")), set: () => Promise.reject(new Error("down")), incr: () => Promise.reject(new Error("down")) };
    setSharedStoreForTests(broken);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(saveAnalysis(analysis("ana_down", "running"))).resolves.toBeUndefined();
    expect((await getAnalysis("ana_down"))?.status).toBe("running"); // memory copy
    expect(await getAnalysis("ana_other")).toBeUndefined();
    err.mockRestore();
  });

  it("talks to Upstash's REST pipeline with a bearer token and never leaks it in errors", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify([{ result: 3 }, { result: 1 }]));
    }) as unknown as typeof fetch;
    const kv = upstash({ url: "https://x.upstash.io", token: "secret-token" }, ok)!;
    expect(await kv.incr("k", 60)).toBe(3);
    expect(calls[0].url).toBe("https://x.upstash.io/pipeline");
    expect(JSON.parse(String(calls[0].init.body))).toEqual([["INCR", "k"], ["EXPIRE", "k", 60]]);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");

    const denied = (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    await expect(upstash({ url: "https://x.upstash.io", token: "secret-token" }, denied)!.get("k")).rejects.toThrow(/^Shared store answered 401\.$/);
  });
});

describe("daily limit", () => {
  it("reads ANALYSIS_DAILY_LIMIT, defaulting to 50", () => {
    expect(dailyLimit({})).toBe(50);
    expect(dailyLimit({ ANALYSIS_DAILY_LIMIT: "12" })).toBe(12);
    expect(dailyLimit({ ANALYSIS_DAILY_LIMIT: "lots" })).toBe(50);
  });

  it("uses the US Eastern day, so it resets at midnight in New Jersey", () => {
    expect(easternDay(new Date("2026-11-16T03:30:00Z"))).toBe("2026-11-15"); // 10:30 pm ET
    expect(easternDay(new Date("2026-11-16T05:30:00Z"))).toBe("2026-11-16");
  });

  it("allows up to the limit per day across instances, then refuses; a new day starts over", async () => {
    const store = fakeKv();
    const day1 = new Date("2026-11-15T15:00:00Z");
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await takeDailyRun({ now: day1, limit: 2, store }));
    expect(results.map((r) => r.ok)).toEqual([true, true, false]);
    expect((await takeDailyRun({ now: new Date("2026-11-16T15:00:00Z"), limit: 2, store })).ok).toBe(true);
  });

  it("is off at 0, and counts in memory without a shared store", async () => {
    expect(await takeDailyRun({ limit: 0, store: null })).toEqual({ ok: true, used: 0, limit: 0 });
    const now = new Date("2030-01-01T15:00:00Z");
    expect((await takeDailyRun({ now, limit: 1, store: null })).ok).toBe(true);
    expect((await takeDailyRun({ now, limit: 1, store: null })).ok).toBe(false);
  });
});
