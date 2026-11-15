// Which agents the loading screen shows for each customer type, and what state each is in.
// Pure, so it is unit-tested in tests/ui/agent-flow.test.ts. A node only moves on when the real
// agent reports a tool call for it: nothing here is timed or invented.
import type { AgentToolCall, AgentToolName, AnalysisResponse, UserPersona } from "@/lib/contracts";
import type { OrbState } from "./dot-orb-engine";

export type FlowSource = "CoStar" | "Matterport" | "Vexcel" | "Market" | "Search agent" | "Analysis agent";
export type FlowNode = { id: string; source: FlowSource; label: string; tools: AgentToolName[] };
export type FlowState = "waiting" | "running" | "done" | "failed";

export const FLOWS: Record<UserPersona, FlowNode[]> = {
  owner: [
    { id: "costar", source: "CoStar", label: "Live building and listing facts", tools: ["get_property_profile", "search_properties", "search_available_spaces"] },
    { id: "matterport", source: "Matterport", label: "3D scan of the space as it is today", tools: ["get_matterport_model", "analyze_interior"] },
    { id: "vexcel", source: "Vexcel", label: "The block around it, from the air", tools: ["get_aerial_imagery", "analyze_exterior"] },
    { id: "market", source: "Market", label: "Nearby tenants and asking rents", tools: ["get_nearby_context"] },
    { id: "analysis", source: "Analysis agent", label: "Ranking the uses that fit", tools: ["score_uses", "run_financial_scenario"] },
  ],
  entrepreneur: [
    { id: "search", source: "Search agent", label: "Spaces that match your size, budget and city", tools: ["search_available_spaces", "search_properties"] },
    { id: "costar", source: "CoStar", label: "Facts on each candidate building", tools: ["get_property_profile", "get_nearby_context"] },
    { id: "matterport", source: "Matterport", label: "3D tours of the best fits", tools: ["get_matterport_model", "analyze_interior"] },
    { id: "vexcel", source: "Vexcel", label: "Frontage and access, from the air", tools: ["get_aerial_imagery", "analyze_exterior"] },
    { id: "analysis", source: "Analysis agent", label: "Scoring each space for your business", tools: ["score_uses", "run_financial_scenario"] },
  ],
  investor: [
    { id: "search", source: "Search agent", label: "Available buildings and businesses", tools: ["search_properties", "search_available_spaces"] },
    { id: "costar", source: "CoStar", label: "Building facts and the nearby market", tools: ["get_property_profile", "get_nearby_context"] },
    { id: "matterport", source: "Matterport", label: "3D of the top picks", tools: ["get_matterport_model", "analyze_interior"] },
    { id: "vexcel", source: "Vexcel", label: "The surroundings, from the air", tools: ["get_aerial_imagery", "analyze_exterior"] },
    { id: "analysis", source: "Analysis agent", label: "Returns from your own assumptions", tools: ["run_financial_scenario", "score_uses"] },
  ],
};

export type FlowRow = FlowNode & { state: FlowState; detail: string | null };

/** Each node's state from the agent's tool calls, with the agent's own words for what it is doing. */
export function flowRows(persona: UserPersona, calls: AgentToolCall[]): FlowRow[] {
  return FLOWS[persona].map((node) => {
    const mine = calls.filter((c) => node.tools.includes(c.tool));
    const running = [...mine].reverse().find((c) => c.status === "running" || c.status === "pending");
    const state: FlowState = running
      ? "running"
      : mine.length === 0
        ? "waiting"
        : mine.every((c) => c.status === "failed" || c.status === "skipped")
          ? "failed"
          : "done";
    const latestDone = [...mine].reverse().find((c) => c.status === "succeeded");
    const detail = running ? running.reason : (latestDone?.outputSummary ?? null);
    return { ...node, state, detail };
  });
}

/**
 * The orb's status for a running analysis: working while any tool runs, thinking while the model
 * reasons between tools (or the run is queued), success when it completes, stuck when it fails.
 */
export function orbStatus(status: AnalysisResponse["status"], calls: AgentToolCall[]): OrbState {
  if (status === "completed") return "success";
  if (status === "failed") return "stuck";
  return calls.some((c) => c.status === "running" || c.status === "pending") ? "working" : "thinking";
}
