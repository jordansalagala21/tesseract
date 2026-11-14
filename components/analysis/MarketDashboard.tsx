import { useId } from "react";
import type { Evidence, MarketAnalysis } from "@/lib/contracts";
import { humanize } from "@/components/property/format";
import { Notice } from "@/components/ui/notice";
import { EvidenceChip } from "./EvidenceChip";
import { barRows, formatRadius, money, rentRange } from "./market-format";

const SERVICE_TYPES: Record<string, string> = {
  TripleNet: "Triple net (NNN)",
  FullServiceGross: "Full service gross",
  ModifiedGross: "Modified gross",
  PlusElectric: "Plus electric",
  IndustrialGross: "Industrial gross",
};

function Card({ title, n, unit, children }: { title: string; n: number; unit: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        {/* Sample size on every chart: these are counts from kit properties only, not the whole market. */}
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          n = {n} {unit}
        </span>
      </header>
      {children}
    </section>
  );
}

function BarList({ items, total, unit, empty }: { items: { label: string; count: number }[]; total: number; unit: string; empty: string }) {
  const rows = barRows(items, total);
  if (rows.length === 0) return <p className="text-base text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.count} of ${total} ${unit} (${r.sharePct}%)`}>
          <div className="flex items-baseline justify-between gap-3 text-base">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{r.count}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-muted" aria-hidden="true">
            <div className="h-full min-w-1 rounded-full bg-primary" style={{ width: `${r.widthPct}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Market context for one property, drawn only from values in the MarketAnalysis response.
 * Every chart shows its sample size and the limitations are always visible.
 */
export function MarketDashboard({
  analysis: m,
  evidence = [],
  onEvidenceSelect,
}: {
  analysis: MarketAnalysis;
  evidence?: Evidence[];
  onEvidenceSelect?: (evidenceId: string) => void;
}) {
  const headingId = useId();
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const rent = rentRange(m.comparableSpaces.askingRentPsfYear);
  const mixedService = m.comparableSpaces.serviceTypes.length > 1;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight">
          Market context
        </h2>
        <span className="text-base text-muted-foreground">Within {formatRadius(m.radiusMeters)} of the property</span>
      </div>

      {/* Limitations first and always visible, so the numbers below are read with them in mind. */}
      <Notice title="What this can’t tell you">
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
          {m.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        </Notice>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Asking rent nearby" n={m.comparableSpaces.count} unit="advertised spaces">
          {rent ? (
            <div>
              <p className="text-base text-muted-foreground">
                {rent.median != null ? (
                  <>
                    Median <span className="text-2xl leading-none font-semibold text-foreground tabular-nums">{money(rent.median)}</span> per SF per year
                  </>
                ) : (
                  "Median not available"
                )}
              </p>
              <div
                className="relative mt-5 h-2 rounded-full bg-primary/25"
                role="img"
                aria-label={`Asking rent ranges from ${money(rent.min)} to ${money(rent.max)} per square foot per year${rent.median != null ? `, median ${money(rent.median)}` : ""}.`}
              >
                {rent.medianPct != null && (
                  <span
                    className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
                    style={{ left: `${rent.medianPct}%` }}
                    title={`Median ${money(rent.median!)}/SF/yr`}
                  />
                )}
              </div>
              <div className="mt-2 flex justify-between text-sm text-muted-foreground tabular-nums">
                <span>Low {money(rent.min)}</span>
                <span>High {money(rent.max)}</span>
              </div>
              <p className="mt-3 text-sm leading-snug text-muted-foreground">
                Asking rents, not achieved rents, and only from spaces that publish a rate.
              </p>
            </div>
          ) : (
            <p className="text-base text-muted-foreground">None of these spaces publish an asking rate.</p>
          )}
          {mixedService && (
            <Notice tone="warning" title="Mixed lease types">
              This range combines triple net and gross rents, which aren’t directly comparable.
            </Notice>
          )}
        </Card>

        <Card title="Lease types" n={m.comparableSpaces.count} unit="advertised spaces">
          <BarList
            items={m.comparableSpaces.serviceTypes.map((s) => ({ label: SERVICE_TYPES[s.serviceType] ?? humanize(s.serviceType) ?? s.serviceType, count: s.count }))}
            total={m.comparableSpaces.count}
            unit="spaces"
            empty="No lease types recorded."
          />
        </Card>

        <Card title="What’s being advertised" n={m.comparableSpaces.count} unit="advertised spaces">
          <BarList
            items={m.comparableSpaces.spaceUses.map((s) => ({ label: humanize(s.spaceUse) ?? s.spaceUse, count: s.count }))}
            total={m.comparableSpaces.count}
            unit="spaces"
            empty="No advertised spaces within this radius."
          />
        </Card>

        <Card title="Who’s already nearby" n={m.nearbyTenants.count} unit="current tenants">
          <BarList
            items={m.nearbyTenants.byIndustry.map((t) => ({ label: humanize(t.industry) ?? t.industry, count: t.count }))}
            total={m.nearbyTenants.count}
            unit="tenants"
            empty="No current tenants recorded within this radius."
          />
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sale comps</h3>
          <p className="mt-0.5 text-base text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{m.saleComps.count}</span> recorded,{" "}
            <span className="font-semibold text-foreground tabular-nums">{m.saleComps.withDisclosedPrice}</span> with a disclosed price.
          </p>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">n = {m.saleComps.count} sales</span>
      </div>

      {m.evidenceIds.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <h3 className="shrink-0 pt-1 text-base font-semibold">Sources</h3>
          <ul className="flex flex-wrap gap-1.5">
            {m.evidenceIds.map((id) => (
              <li key={id} className="max-w-full">
                <EvidenceChip id={id} evidence={byId.get(id)} onSelect={onEvidenceSelect} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
