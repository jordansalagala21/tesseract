"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { AnalysisResponse } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { ResultsOverview } from "./ResultsOverview";
import { AgentFlow } from "@/components/intake/AgentFlow";
import { startAnalysis } from "./start-analysis";

const POLL_MS = 1500;

type Load =
  | { kind: "loading" }
  | { kind: "ready"; analysis: AnalysisResponse }
  | { kind: "gone" }
  | { kind: "error"; message: string };

/** "Suite 100" from the profile's own evidence, else the CoStar space id. */
const spaceName = (a: AnalysisResponse, spaceId: number) =>
  /^(Suite \S+|Space \d+)/.exec(a.evidence.find((e) => e.id === `ev_s${spaceId}_status`)?.statement ?? "")?.[1] ?? `space ${spaceId}`;

const isDone = (a: AnalysisResponse) => a.status === "completed" || a.status === "failed";
const seconds = (from: string, to: string | number) => Math.max(0, Math.round(((typeof to === "number" ? to : Date.parse(to)) - Date.parse(from)) / 1000));

/**
 * Live view of one analysis (INT-04). Polls GET /api/analysis/[id] while the agent works, so the
 * investigation timeline fills in step by step, then shows the ranked opportunities, the market
 * panel and the financial scenarios. Analyses live in server memory, so a 404 means "expired".
 */
export function LiveAnalysis({ id }: { id: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const [retrying, setRetrying] = useState(false);
  const failures = useRef(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api/analysis/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (stopped) return;
        if (res.status === 404) return setLoad({ kind: "gone" });
        const parsed = AnalysisResponse.safeParse(await res.json());
        if (!res.ok || !parsed.success) throw new Error(`The analysis service answered ${res.status}.`);
        failures.current = 0;
        setLoad({ kind: "ready", analysis: parsed.data });
        if (!isDone(parsed.data)) timer = setTimeout(poll, POLL_MS);
      } catch (e) {
        if (stopped) return;
        // A blip while the agent works shouldn't end the page: retry a few times first.
        if (++failures.current < 4) timer = setTimeout(poll, POLL_MS * 2);
        else setLoad({ kind: "error", message: e instanceof Error ? e.message : "The analysis couldn’t be loaded." });
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  // Tick the elapsed-time counter while the agent works.
  const running = load.kind === "ready" && !isDone(load.analysis);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  async function retry(a: AnalysisResponse) {
    setRetrying(true);
    const r = await startAnalysis({ input: a.request.input, options: a.request.options });
    if ("id" in r) router.push(`/analysis/${r.id}`);
    else {
      setRetrying(false);
      setLoad({ kind: "error", message: r.error });
    }
  }

  if (load.kind === "loading") {
    return (
      <div role="status" aria-label="Loading analysis" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (load.kind === "gone") {
    return (
      <EmptyState
        title="This analysis has expired"
        role="alert"
        action={
          <Link href="/properties" className="font-medium text-primary underline underline-offset-4">
            Find a property
          </Link>
        }
      >
        Analyses are kept in server memory and reset when the server restarts. Start a new one from the property page.
      </EmptyState>
    );
  }
  if (load.kind === "error") {
    return (
      <Notice tone="danger" title="Couldn’t load the analysis">
        {load.message}
      </Notice>
    );
  }

  const a = load.analysis;
  const input = a.request.input;
  const profile = a.toolCalls.find((c) => c.tool === "get_property_profile" && c.outputSummary);
  const steps = a.toolCalls.filter((c) => c.status !== "skipped").length;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        {input.persona === "owner" && (
          <p className="text-base text-muted-foreground">
            <Link href={`/properties/${input.propertyId}`} className="font-medium text-primary underline-offset-4 hover:underline">
              {profile?.outputSummary?.split(":")[0] ?? `Property ${input.propertyId}`}
            </Link>
            {input.spaceId ? ` · ${spaceName(a, input.spaceId)}` : ""}
          </p>
        )}

        {!isDone(a) && (
          <Notice tone="info" title={a.status === "queued" ? "Starting the agent…" : "The agent is investigating"}>
            <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {steps} step{steps === 1 ? "" : "s"} so far · {seconds(a.createdAt, now)} s. A full run usually takes about a minute.
            </span>
          </Notice>
        )}
        {id.startsWith("rec_") && (
          <Notice tone="warning" title="Recorded run">
            {a.disclaimers[0]}
          </Notice>
        )}
        {a.status === "completed" && (
          <p className="text-base text-muted-foreground" role="status">
            Finished in {seconds(a.createdAt, a.completedAt ?? now)} s · {a.opportunities.length} idea{a.opportunities.length === 1 ? "" : "s"} · {a.evidence.length} pieces of evidence.
          </p>
        )}
        {a.status === "failed" && (
          <Notice tone="danger" title="The analysis didn’t finish">
            <span className="flex flex-col items-start gap-3">
              <span>{a.error ?? "Something went wrong while the agent was working."} Anything it found before stopping is shown below.</span>
              <Button variant="outline" onClick={() => retry(a)} disabled={retrying}>
                <RotateCcw className="size-4" aria-hidden="true" />
                {retrying ? "Starting…" : "Try again"}
              </Button>
            </span>
          </Notice>
        )}
      </div>

      {/* The agent loading screen is for the waiting minute; finished runs go straight to the result. */}
      {!isDone(a) && <AgentFlow persona={input.persona} toolCalls={a.toolCalls} />}

      <ResultsOverview analysis={a} />

      <ul className="flex flex-col gap-1 border-t pt-4 text-sm text-muted-foreground">
        {a.disclaimers.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
