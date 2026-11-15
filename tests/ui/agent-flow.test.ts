import { describe, expect, it } from "vitest";
import { AgentToolName, UserPersona, type AgentToolCall } from "@/lib/contracts";
import { FLOWS, flowRows, orbStatus } from "@/components/intake/agent-flow";

const call = (tool: AgentToolCall["tool"], status: AgentToolCall["status"], extra: Partial<AgentToolCall> = {}): AgentToolCall => ({
  id: `${tool}-${status}`,
  step: 1,
  tool,
  reason: `Reason for ${tool}`,
  input: {},
  status,
  startedAt: "2026-11-15T12:00:00.000Z",
  finishedAt: null,
  outputSummary: null,
  evidenceIds: [],
  error: null,
  ...extra,
});

describe("agent loading screen", () => {
  it("has a flow for every customer type, built only from real agent tools", () => {
    for (const persona of UserPersona.options) {
      expect(FLOWS[persona].length).toBeGreaterThan(0);
      for (const node of FLOWS[persona]) for (const t of node.tools) expect(AgentToolName.options).toContain(t);
    }
  });

  it("moves a node only when the agent reports its step", () => {
    const rows = flowRows("owner", [
      call("get_property_profile", "succeeded", { outputSummary: "2600 Travis St: Class A, 36,932 SF" }),
      call("get_matterport_model", "running"),
      call("get_aerial_imagery", "failed"),
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.costar).toMatchObject({ state: "done", detail: "2600 Travis St: Class A, 36,932 SF" });
    expect(by.matterport).toMatchObject({ state: "running", detail: "Reason for get_matterport_model" });
    expect(by.vexcel).toMatchObject({ state: "failed", detail: null });
    expect(by.market).toMatchObject({ state: "waiting", detail: null });
    expect(by.analysis.state).toBe("waiting");
  });

  it("starts with every node waiting", () => {
    expect(flowRows("investor", []).every((r) => r.state === "waiting")).toBe(true);
  });

  it("maps the agent's real state onto the orb's four states", () => {
    expect(orbStatus("queued", [])).toBe("thinking");
    expect(orbStatus("running", [call("get_property_profile", "succeeded")])).toBe("thinking");
    expect(orbStatus("running", [call("get_property_profile", "succeeded"), call("get_matterport_model", "running")])).toBe("working");
    expect(orbStatus("completed", [call("score_uses", "succeeded")])).toBe("success");
    expect(orbStatus("failed", [call("get_matterport_model", "running")])).toBe("stuck");
  });
});
