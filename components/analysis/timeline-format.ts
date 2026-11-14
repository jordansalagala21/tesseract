import type { AgentToolCall, AgentToolName } from "@/lib/contracts";

const TOOL_LABELS: Record<AgentToolName, string> = {
  search_properties: "Search properties",
  search_available_spaces: "Search advertised spaces",
  get_property_profile: "Read the CoStar property profile",
  get_nearby_context: "Check nearby tenants and spaces",
  get_matterport_model: "Open the Matterport 3D model",
  analyze_interior: "Look at the interior",
  get_aerial_imagery: "Fetch aerial imagery",
  analyze_exterior: "Look at the exterior",
  score_uses: "Score candidate uses",
  run_financial_scenario: "Run a financial scenario",
};

export const toolLabel = (tool: AgentToolName) => TOOL_LABELS[tool];

/** "0.8 s", "12 s", "1 min 5 s"; null while the step hasn't finished. */
export function formatDuration(call: Pick<AgentToolCall, "startedAt" | "finishedAt">): string | null {
  if (!call.finishedAt) return null;
  const ms = Math.max(0, Date.parse(call.finishedAt) - Date.parse(call.startedAt));
  if (ms < 1000) return `${(ms / 1000).toFixed(1)} s`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
