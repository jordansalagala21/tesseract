import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/analysis/[id]/route";
import { POST } from "@/app/api/analyze/route";
import { executeAnalysis } from "@/lib/agent/run";
import { getAnalysis } from "@/lib/agent/store";
import { AnalysisRequest } from "@/lib/contracts";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as Parameters<typeof GET>[1];

describe("analysis routes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("POST /api/analyze rejects an invalid body with 400", async () => {
    const res = await POST(new Request("http://x/api/analyze", { method: "POST", body: JSON.stringify({ input: { persona: "owner" } }) }));
    expect(res.status).toBe(400);
  });

  it("GET /api/analysis/[id] returns 404 for an unknown id", async () => {
    const res = await GET(new Request("http://x"), ctx("ana_nope"));
    expect(res.status).toBe(404);
  });

  it("records a failed analysis, not a crash, when the API key is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const request = AnalysisRequest.parse({ input: { persona: "owner", propertyId: 1018657 } });
    await executeAnalysis("ana_nokey", request);
    const saved = getAnalysis("ana_nokey")!;
    expect(saved.status).toBe("failed");
    expect(saved.error).toMatch(/ANTHROPIC_API_KEY/);
    const res = await GET(new Request("http://x"), ctx("ana_nokey"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("failed");
  });
});
