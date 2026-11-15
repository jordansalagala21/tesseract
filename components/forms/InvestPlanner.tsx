"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2, FileCheck2, KeyRound, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuidedInvest } from "./GuidedInvest";
import { InvestorForm, type InvestorDefaults } from "./InvestorForm";

/** Example setups that work well with the CoStar data (Houston and Los Angeles). */
const EXAMPLES: { id: string; title: string; detail: string; values: InvestorDefaults }[] = [
  {
    id: "buy",
    title: "Buy for income",
    detail: "$7.5M · Houston · 8% target",
    values: { capitalUsd: "7,500,000", riskTolerance: "medium", horizonYears: "7", strategy: "acquire", markets: ["houston"], targetPct: "8", goals: "steady income" },
  },
  {
    id: "lease",
    title: "Lease and operate",
    detail: "$500K · Houston · lease",
    values: { capitalUsd: "500,000", riskTolerance: "medium", horizonYears: "5", strategy: "lease", markets: ["houston"], goals: "ground-floor retail" },
  },
  {
    id: "either",
    title: "Open to both",
    detail: "$3M · Los Angeles · either",
    values: { capitalUsd: "3,000,000", riskTolerance: "low", horizonYears: "10", strategy: "either", markets: ["los_angeles"], targetPct: "7" },
  },
];

const OUTPUTS = [
  { Icon: Building2, title: "Buildings for sale", text: "Asking price and the seller’s stated cap rate, compared with your target." },
  { Icon: KeyRound, title: "Spaces to lease", text: "Advertised spaces ranked by how well they meet each use’s needs." },
  { Icon: Sparkles, title: "Before and after", text: "The real 3D scan next to an AI concept of what it could become." },
  { Icon: FileCheck2, title: "Every claim cited", text: "Each reason links to its CoStar record, scan photo or aerial image." },
];

/**
 * The investor entry page: the form (optionally pre-filled from an example) beside a panel that
 * shows what the analysis returns, so the page explains itself before anyone types.
 */
export function InvestPlanner() {
  const [example, setExample] = useState<string | null>(null);
  const [mode, setMode] = useState<"guided" | "form">("guided");
  const chosen = EXAMPLES.find((e) => e.id === example);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{mode === "guided" ? "Answer Tess’s questions below, or start from an example" : "Start from an example"}</p>
          <div role="group" aria-label="Example investor setups" className="grid gap-2 sm:grid-cols-3">
            {EXAMPLES.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={e.id === example}
                onClick={() => setExample(e.id)}
                className={cn(
                  "flex min-h-11 flex-col items-start rounded-xl border px-3.5 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  e.id === example ? "border-primary bg-primary/[0.06]" : "bg-card hover:bg-muted",
                )}
              >
                <span className="text-sm font-semibold">{e.title}</span>
                <span className="text-xs text-muted-foreground">{e.detail}</span>
              </button>
            ))}
          </div>
        </div>
        {/* key: picking an example remounts with its values; everything stays editable. */}
        {mode === "guided" ? (
          <GuidedInvest key={example ?? "blank"} preset={chosen?.values} onUseForm={() => setMode("form")} />
        ) : (
          <>
            <InvestorForm key={example ?? "blank"} defaults={chosen?.values} />
            <button type="button" onClick={() => setMode("guided")} className="min-h-11 self-start text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              Prefer a conversation? Answer one question at a time
            </button>
          </>
        )}
      </div>

      <aside aria-labelledby="get-heading" className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6 lg:sticky lg:top-6">
        <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-xl">
          {[
            { src: "/hero/shell.webp", label: "Today" },
            { src: "/hero/gym.webp", label: "Could become" },
          ].map((p, i) => (
            <div key={p.src} className="relative aspect-[4/3] bg-muted">
              <Image src={p.src} alt={i === 0 ? "An empty commercial space from a Matterport scan" : "AI concept of the same space as a gym"} fill sizes="(min-width: 1024px) 260px, 50vw" className="object-cover" />
              <span className={cn("absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold backdrop-blur", i === 0 ? "bg-scrim text-scrim-foreground" : "bg-amber-500/90 text-white")}>{p.label}</span>
            </div>
          ))}
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">Example from another space. The concept is AI-generated and illustrative.</p>

        <div>
          <h2 id="get-heading" className="text-lg font-semibold">
            What you’ll get
          </h2>
          <ul className="mt-3 flex flex-col gap-3.5">
            {OUTPUTS.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-sm leading-snug text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          Covers CoStar listings in Houston and Los Angeles. Prices are asking figures, not appraisals; buying and leasing are always kept separate.
        </p>
      </aside>
    </div>
  );
}
