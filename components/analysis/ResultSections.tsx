"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Calculator, Check, ChevronDown, HelpCircle, MapPinned } from "lucide-react";
import type { AnalysisResponse, Evidence, Opportunity } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarketDashboard } from "./MarketDashboard";
import { VERDICTS } from "./opportunity-format";
import { labelOf } from "./Recommendation";
import { factsFor, insightsFor, MARKET_GAP, moneyFor, risksFor } from "./result-facts";
import { reasonsFor, type ResultImage } from "./result-images";

/* ------------------------------------------------------------ the numbers */

/** The money in plain words, with how it was worked out. Detailed scenarios sit further down. */
export function MoneySummary({ o, a, onEvidence }: { o: Opportunity; a: AnalysisResponse; onEvidence: (id: string) => void }) {
  const f = factsFor(o, a.evidence);
  const m = moneyFor(o, a, f);
  if (!m) return null;
  return (
    <section aria-labelledby="money-heading" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-6">
      <h2 id="money-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Calculator className="size-5 text-primary" aria-hidden="true" />
        The numbers
      </h2>
      {m.headline.length > 0 && (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {m.headline.map((h) => (
            <div key={h.label}>
              <dt className="text-sm text-muted-foreground">{h.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{h.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-base">{m.sentence}</p>
      <p className="text-sm text-muted-foreground">
        {m.basis}{" "}
        {f.ids.rent && (
          <button type="button" onClick={() => onEvidence(f.ids.rent!)} className="font-medium text-primary underline-offset-4 hover:underline">
            Source
          </button>
        )}
        {a.financialScenarios.length > 0 && (
          <>
            {" · "}
            <a href="#details-financial" onClick={() => openDetails("details-financial")} className="font-medium text-primary underline-offset-4 hover:underline">
              Adjust the numbers
            </a>
          </>
        )}
      </p>
    </section>
  );
}

/** Open a collapsed details section and bring it into view. */
export function openDetails(id: string) {
  const el = document.getElementById(id);
  if (el instanceof HTMLDetailsElement) el.open = true;
}

/* -------------------------------------------------------- the neighbourhood */

/** Three plain market insights; every raw statistic is one click away. */
export function MarketInsights({ o, a, onEvidence }: { o: Opportunity; a: AnalysisResponse; onEvidence: (id: string) => void }) {
  const insights = insightsFor(o, a);
  if (insights.length === 0 && !a.marketAnalysis) return null;
  return (
    <section aria-labelledby="market-heading" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-6">
      <h2 id="market-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <MapPinned className="size-5 text-primary" aria-hidden="true" />
        The neighbourhood
      </h2>
      <ul className="flex flex-col gap-3">
        {insights.map((i) => (
          <li key={i.text}>
            <button
              type="button"
              disabled={!i.evidenceId}
              onClick={() => i.evidenceId && onEvidence(i.evidenceId)}
              className="flex w-full items-start gap-2.5 text-left text-base leading-snug outline-none enabled:hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              {i.tone === "missing" ? <HelpCircle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" /> : <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />}
              <span>{i.text}</span>
            </button>
          </li>
        ))}
        <li className="flex items-start gap-2.5 text-sm leading-snug text-muted-foreground">
          <HelpCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{MARKET_GAP}</span>
        </li>
      </ul>
      {a.marketAnalysis && (
        <details className="group rounded-xl border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium">
            Explore market data
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t p-4">
            <MarketDashboard analysis={a.marketAnalysis} evidence={a.evidence} />
          </div>
        </details>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ more matches */

/**
 * The other ideas (one space) or other spaces (business starters, investors) as simple cards:
 * picture, where, size and price, the key reason it matches and one limitation. Three first.
 */
export function MatchCards({
  a,
  images,
  selected,
  onSelect,
  onEvidence,
}: {
  a: AnalysisResponse;
  images: (ResultImage | null)[];
  selected: number;
  onSelect: (index: number) => void;
  onEvidence: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const byId = new Map(a.evidence.map((e) => [e.id, e]));
  const others = a.opportunities.map((o, i) => ({ o, i })).filter(({ i }) => i !== selected);
  if (others.length === 0) return null;
  const oneSpace = new Set(a.opportunities.map((o) => `${o.propertyId}-${o.spaceId}`)).size === 1;
  const shown = all ? others : others.slice(0, 3);

  return (
    <section aria-labelledby="matches-heading" className="flex flex-col gap-4">
      <h2 id="matches-heading" className="text-xl font-semibold tracking-tight">
        {oneSpace ? "Other ideas for this space" : "More matches"}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(({ o, i }) => (
          <li key={o.id}>
            <MatchCard o={o} image={images[i]} byId={byId} a={a} oneSpace={oneSpace} onShow={() => onSelect(i)} onEvidence={onEvidence} />
          </li>
        ))}
      </ul>
      {others.length > 3 && (
        <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="inline-flex min-h-11 items-center gap-1 self-start rounded-lg border px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          {all ? "Show fewer" : `View all results (${a.opportunities.length})`}
          <ChevronDown className={cn("size-4 transition-transform", all && "rotate-180")} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

function MatchCard({ o, image, byId, a, oneSpace, onShow, onEvidence }: { o: Opportunity; image: ResultImage | null; byId: Map<string, Evidence>; a: AnalysisResponse; oneSpace: boolean; onShow: () => void; onEvidence: (id: string) => void }) {
  const f = factsFor(o, a.evidence);
  const reason = reasonsFor(o, byId)[0];
  const risk = risksFor(o, a.evidence, { specific: true })[0];
  const verdict = VERDICTS[o.verdict];
  const price = o.strategy === "acquisition" && f.askingPriceUsd ? `$${f.askingPriceUsd.toLocaleString("en-US")} asking` : f.rent;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-[16/10] bg-muted">
        {image && <Image src={image.src} alt={image.alt} fill unoptimized sizes="(min-width: 1024px) 400px, 100vw" className="object-cover" />}
        <span className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-full bg-card text-sm font-semibold shadow">{o.rank}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={verdict.variant}>{verdict.label}</Badge>
          <span className="text-sm text-muted-foreground">Requirements match {o.scores.overall ?? "–"}/100</span>
        </div>
        <h3 className="line-clamp-2 text-base leading-snug font-semibold">{oneSpace ? labelOf(o.useCategory) : `${f.address}${f.suite ? `, ${f.suite}` : ""}`}</h3>
        <p className="text-sm text-muted-foreground">{[oneSpace ? null : labelOf(o.useCategory), f.size, price].filter(Boolean).join(" · ")}</p>
        {reason && (
          <button type="button" onClick={() => onEvidence(reason.id)} className="flex items-start gap-2 text-left text-sm leading-snug outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="line-clamp-3">{reason.statement}</span>
          </button>
        )}
        {risk && (
          <p className="flex items-start gap-2 text-sm leading-snug text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span className="line-clamp-2">{risk.text}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            onShow();
            document.getElementById("recommendation")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="mt-auto inline-flex min-h-11 items-center justify-center rounded-lg border text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          See before and after
        </button>
      </div>
    </article>
  );
}
