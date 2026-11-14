import { Check, Circle, Loader2, Minus, X } from "lucide-react";
import type { AgentToolCall, AnalysisResponse, Evidence } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { EvidenceChip } from "./EvidenceChip";
import { formatDuration, toolLabel } from "./timeline-format";

type Status = AgentToolCall["status"];

const STATUS: Record<Status, { label: string; Icon: typeof Check; tone: string }> = {
  pending: { label: "Waiting", Icon: Circle, tone: "border-border text-muted-foreground" },
  running: { label: "Running", Icon: Loader2, tone: "border-primary text-primary" },
  succeeded: { label: "Done", Icon: Check, tone: "border-primary bg-primary text-primary-foreground" },
  failed: { label: "Failed", Icon: X, tone: "border-destructive bg-destructive text-destructive-foreground" },
  skipped: { label: "Skipped", Icon: Minus, tone: "border-border bg-muted text-muted-foreground" },
};

const RUN_STATUS: Record<AnalysisResponse["status"], string> = {
  queued: "Queued",
  running: "Investigating",
  completed: "Investigation complete",
  failed: "Investigation stopped",
};

/**
 * The agent's investigation, step by step: which tool it used, why, what came back, and the
 * evidence each step produced. Evidence chips link to #evidence-<id> (the Evidence Trail, UI-08)
 * unless onEvidenceSelect is given.
 */
export function AgentTimeline({
  toolCalls,
  evidence,
  status,
  onEvidenceSelect,
}: {
  toolCalls: AgentToolCall[];
  evidence: Evidence[];
  status: AnalysisResponse["status"];
  onEvidenceSelect?: (evidenceId: string) => void;
}) {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const calls = [...toolCalls].sort((a, b) => a.step - b.step);
  const done = calls.filter((c) => c.status === "succeeded").length;
  const live = status === "queued" || status === "running";

  return (
    <section aria-labelledby="timeline-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="timeline-heading" className="text-xl font-semibold tracking-tight">
          How the agent investigated
        </h2>
        <p aria-live="polite" className="flex items-center gap-1.5 text-base text-muted-foreground tabular-nums">
          {live && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}
          {RUN_STATUS[status]}, {done} of {calls.length} {calls.length === 1 ? "step" : "steps"} done
        </p>
      </div>

      {calls.length === 0 ? (
        <p className="rounded-2xl border bg-card px-5 py-6 text-base text-muted-foreground">
          {live ? "The agent is planning its first step." : "The agent didn’t run any tools for this analysis."}
        </p>
      ) : (
        <ol className="rounded-2xl border bg-card px-4 py-2 sm:px-5">
          {calls.map((call, i) => {
            const s = STATUS[call.status];
            const duration = formatDuration(call);
            const last = i === calls.length - 1;
            return (
              <li key={call.id} className="relative flex gap-4 py-4">
                {!last && <span aria-hidden="true" className="absolute top-12 bottom-0 left-[15px] w-px bg-border" />}
                <span
                  className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2", s.tone)}
                  title={s.label}
                >
                  <s.Icon
                    className={cn("size-4", call.status === "running" && "motion-safe:animate-spin", call.status === "pending" && "size-2.5 fill-current")}
                    aria-hidden="true"
                  />
                  <span className="sr-only">{s.label}</span>
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="text-lg leading-snug font-semibold">
                      <span className="mr-2 text-sm font-medium text-muted-foreground tabular-nums">Step {call.step}</span>
                      {toolLabel(call.tool)}
                    </p>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {call.status === "running" ? "Running…" : call.status === "succeeded" ? duration : s.label}
                    </span>
                  </div>
                  <p className="mt-1 text-base leading-snug text-muted-foreground">{call.reason}</p>
                  {call.outputSummary && <p className="mt-1.5 text-base leading-snug">{call.outputSummary}</p>}
                  {call.error && (
                    <p className="mt-1.5 text-base leading-snug text-destructive">
                      <span className="font-semibold">Error:</span> {call.error}
                    </p>
                  )}
                  {call.evidenceIds.length > 0 && (
                    <ul aria-label="Evidence from this step" className="mt-2.5 flex flex-wrap gap-1.5">
                      {call.evidenceIds.map((id) => (
                        <li key={id} className="max-w-full">
                          <EvidenceChip id={id} evidence={byId.get(id)} onSelect={onEvidenceSelect} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
