import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/finance/scenario/route";
import { travisLeaseScenario } from "@/lib/contracts/examples/travis";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/finance/scenario", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/finance/scenario", () => {
  it("returns a scenario for a valid lease input", async () => {
    const res = await post({ name: "Suite 100", input: travisLeaseScenario.input });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toMatch(/^scn_/);
    expect(json.name).toBe("Suite 100");
    expect(json.output.annualOccupancyCostUsd).toBe(563_673);
  });

  it("rejects an invalid body with 400", async () => {
    const res = await post({ input: { mode: "lease" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_request");
  });

  it("rejects non-JSON with 400", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
  });
});
