import { Box, Building2, Calculator, Check, Loader2, MapPinned, Plane, X } from "lucide-react";
import type { AgentToolCall, AgentToolName, AnalysisResponse } from "@/lib/contracts";
import { cn } from "@/lib/utils";

/** The investigation as five stages instead of a long list. */
const STAGES: { label: string; Icon: typeof Box; tools: AgentToolName[] }[] = [
  { label: "CoStar", Icon: Building2, tools: ["search_properties", "search_available_spaces", "get_property_profile"] },
  { label: "3D scan", Icon: Box, tools: ["get_matterport_model", "analyze_interior"] },
  { label: "Aerial", Icon: Plane, tools: ["get_aerial_imagery", "analyze_exterior"] },
  { label: "Nearby", Icon: MapPinned, tools: ["get_nearby_context"] },
  { label: "Scores", Icon: Calculator, tools: ["score_uses", "run_financial_scenario"] },
];

type State = "waiting" | "running" | "done" | "failed";

function stateOf(calls: AgentToolCall[]): State {
  if (calls.some((c) => c.status === "running" || c.status === "pending")) return "running";
  if (calls.length === 0) return "waiting";
  if (calls.every((c) => c.status === "failed" || c.status === "skipped")) return "failed";
  return "done";
}

export function StepStrip({ toolCalls, status }: { toolCalls: AgentToolCall[]; status: AnalysisResponse["status"] }) {
  const finished = status === "completed" || status === "failed";
  const latest = [...toolCalls].reverse().find((c) => c.status === "running") ?? toolCalls.at(-1);

  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-5 gap-1.5 sm:gap-3" aria-label="Investigation progress">
        {STAGES.map(({ label, Icon, tools }) => {
          const calls = toolCalls.filter((c) => tools.includes(c.tool));
          const state = stateOf(calls);
          const Mark = state === "running" ? Loader2 : state === "done" ? Check : state === "failed" ? X : Icon;
          return (
            <li key={label} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border-2 sm:size-12",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "running" && "border-primary text-primary",
                  state === "failed" && "border-destructive/60 text-destructive",
                  state === "waiting" && "border-border text-muted-foreground",
                )}
              >
                <Mark className={cn("size-5", state === "running" && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
              </span>
              <span className="text-xs leading-tight font-medium sm:text-sm">{label}</span>
              <span className="sr-only">{state}</span>
            </li>
          );
        })}
      </ol>
      {!finished && latest && (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {latest.reason}
        </p>
      )}
    </div>
  );
}
