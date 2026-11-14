// Component preview for the analysis UI (UI-05 onwards) until the real analysis flow (INT-04) exists.
// Step 1 is the contract fixture; later steps are UI-state examples only and say so on the page.
import type { Metadata } from "next";
import type { AgentToolCall } from "@/lib/contracts";
import { travisAnalysisFixture } from "@/lib/contracts/examples/travis";
import { AgentTimeline } from "@/components/analysis/AgentTimeline";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = { title: "Analysis preview | Tesseract", robots: { index: false } };

const t = (s: number) => new Date(Date.UTC(2026, 10, 14, 12, 0, 0) + s * 1000).toISOString();

const uiStateSteps: AgentToolCall[] = [
  {
    id: "demo_2",
    step: 2,
    tool: "get_matterport_model",
    reason: "Suite 100 has a scan matched by its CoStar caption, so open it to compare scanned and advertised area.",
    input: { modelId: "NxYn1owequw" },
    status: "succeeded",
    startedAt: t(1),
    finishedAt: t(2.4),
    outputSummary: null,
    evidenceIds: ["ev_scan_area"],
    error: null,
  },
  {
    id: "demo_3",
    step: 3,
    tool: "analyze_interior",
    reason: "Check the interior photos for existing build-out that suits food and drink uses.",
    input: {},
    status: "succeeded",
    startedAt: t(2.4),
    finishedAt: t(14),
    outputSummary: null,
    evidenceIds: ["ev_obs_bar"],
    error: null,
  },
  {
    id: "demo_4",
    step: 4,
    tool: "get_aerial_imagery",
    reason: "Look at parking and street access from above.",
    input: {},
    status: "failed",
    startedAt: t(14),
    finishedAt: t(15),
    outputSummary: null,
    evidenceIds: [],
    error: "The imagery service didn’t respond. The agent continued without aerial evidence.",
  },
  {
    id: "demo_5",
    step: 5,
    tool: "get_nearby_context",
    reason: "See which tenants and advertised spaces are near the property.",
    input: {},
    status: "running",
    startedAt: t(15),
    finishedAt: null,
    outputSummary: null,
    evidenceIds: [],
    error: null,
  },
  {
    id: "demo_6",
    step: 6,
    tool: "score_uses",
    reason: "Score the candidate uses against the evidence collected so far.",
    input: {},
    status: "pending",
    startedAt: t(15),
    finishedAt: null,
    outputSummary: null,
    evidenceIds: [],
    error: null,
  },
  {
    id: "demo_7",
    step: 7,
    tool: "run_financial_scenario",
    reason: "Skipped because no revenue or margin inputs were given.",
    input: {},
    status: "skipped",
    startedAt: t(15),
    finishedAt: null,
    outputSummary: null,
    evidenceIds: [],
    error: null,
  },
];

export default function AnalysisPreviewPage() {
  const a = travisAnalysisFixture;
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-1 flex-col px-4 sm:px-8">
      <SiteHeader />
      <main className="flex flex-col gap-8 pt-6 pb-16 sm:pt-10">
        <div>
          <h1 className="font-heading text-[34px] leading-tight font-bold tracking-tight">Analysis preview</h1>
          <p className="mt-2 max-w-[40rem] text-[17px] leading-relaxed text-muted-foreground">
            Shows how analysis results will look before the agent is connected.
          </p>
        </div>
        <p role="note" className="rounded-2xl border border-dashed border-muted-foreground/40 px-4 py-3 text-[15px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Sample data.</span> Step 1 is the 2600 Travis St development
          fixture. Steps 2 to 7 are example states (done, failed, running, waiting, skipped) for checking the design.
          None of this is live agent output.
        </p>
        <AgentTimeline toolCalls={[...a.toolCalls, ...uiStateSteps]} evidence={a.evidence} status="running" />
      </main>
    </div>
  );
}
