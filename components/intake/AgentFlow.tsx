import { Box, Building2, Check, Circle, ListChecks, Loader2, MapPinned, Plane, Search, X } from "lucide-react";
import type { AgentToolCall, UserPersona } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { flowRows, type FlowRow, type FlowSource } from "./agent-flow";
import { TesseractCube } from "./TesseractCube";

const ICONS: Record<FlowSource, typeof Box> = {
  CoStar: Building2,
  Matterport: Box,
  Vexcel: Plane,
  Market: MapPinned,
  "Search agent": Search,
  "Analysis agent": ListChecks,
};

const STATE_TEXT = { waiting: "Waiting", running: "Working", done: "Done", failed: "Didn’t finish" } as const;

/**
 * The agent loading screen: the Tesseract works in the centre and the agents for this customer
 * type sit around it, joined by lines that carry data in while each one works. Every node moves
 * only when the real agent reports that step (see agent-flow.ts).
 */
export function AgentFlow({ persona, toolCalls }: { persona: UserPersona; toolCalls: AgentToolCall[] }) {
  const rows = flowRows(persona, toolCalls);
  const half = Math.ceil(rows.length / 2);

  return (
    <section aria-label="The agents at work" className="rounded-3xl border bg-card/60 px-4 py-8 sm:px-8">
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-0">
        <div className="flex justify-center p-8 md:order-2 md:px-10">
          {/* Padding: a turning cube's corners reach past its box. */}
          <TesseractCube size={200} mode="work" />
        </div>
        <ol className="flex flex-col gap-4 md:order-1">
          {rows.slice(0, half).map((r) => (
            <Node key={r.id} row={r} side="left" />
          ))}
        </ol>
        <ol className="flex flex-col gap-4 md:order-3">
          {rows.slice(half).map((r) => (
            <Node key={r.id} row={r} side="right" />
          ))}
        </ol>
      </div>
    </section>
  );
}

function Node({ row, side }: { row: FlowRow; side: "left" | "right" }) {
  const Icon = ICONS[row.source];
  const Mark = row.state === "running" ? Loader2 : row.state === "done" ? Check : row.state === "failed" ? X : Circle;
  const line = <span aria-hidden="true" data-state={row.state} className={cn("flow-line hidden md:block", side === "right" && "flow-line-in")} />;

  return (
    <li className="flex items-center">
      {side === "right" && line}
      <div
        className={cn(
          "flex min-w-0 flex-1 gap-3 rounded-2xl border bg-card p-3.5 transition-colors",
          row.state === "running" && "border-[var(--cube)]",
          row.state === "waiting" && "opacity-70",
        )}
      >
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-muted", row.state !== "waiting" && "text-[var(--cube)]")}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center justify-between gap-2">
            <span className="font-semibold">{row.source}</span>
            <span className={cn("inline-flex items-center gap-1 text-sm", row.state === "failed" ? "text-destructive" : "text-muted-foreground")}>
              <Mark className={cn("size-3.5", row.state === "running" && "motion-safe:animate-spin")} aria-hidden="true" />
              {STATE_TEXT[row.state]}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">{row.label}</p>
          {row.detail && <p className="mt-1 line-clamp-2 text-sm">{row.detail}</p>}
        </div>
      </div>
      {side === "left" && line}
    </li>
  );
}
