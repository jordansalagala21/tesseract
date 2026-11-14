import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/forms/fields";
import type { Market, PropertySummary } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Chip } from "./Chip";
import { formatNumber, formatSf, humanize } from "./format";

export function PropertySearchForm({ q, market }: { q?: string; market?: Market }) {
  return (
    <form action="/properties" role="search" className="flex flex-col gap-3 sm:flex-row">
      <label className="relative flex-1">
        <span className="sr-only">Address or building name</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Address or building name"
          autoComplete="off"
          className={cn(inputClass, "pl-11")}
        />
      </label>
      <div className="flex gap-3">
        <label className="relative flex-1 sm:flex-none">
          <span className="sr-only">Market</span>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <select name="market" defaultValue={market ?? ""} className={cn(inputClass, "appearance-none pr-10 sm:w-44")}>
            <option value="">All markets</option>
            <option value="houston">Houston</option>
            <option value="los_angeles">Los Angeles</option>
          </select>
        </label>
        <Button type="submit">
          Search
        </Button>
      </div>
    </form>
  );
}

export function PropertyResults({ items, total, q }: { items: PropertySummary[]; total: number; q?: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-5 py-8 text-center">
        <p className="text-lg font-semibold">{q ? `No properties match “${q}”` : "No properties found"}</p>
        <p className="mt-1 text-base text-muted-foreground">Try a street or building name, or search all markets.</p>
        <Link href="/properties" className="mt-4 inline-block rounded-md text-lg font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Show all properties
        </Link>
      </div>
    );
  }

  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading" className="mb-3 text-base font-medium text-muted-foreground">
        {total === 1 ? "1 property" : `${formatNumber(total)} properties`}
      </h2>
      <ul className="overflow-hidden rounded-2xl border bg-card">
        {items.map((p, i) => (
          <li key={p.id}>
            {i > 0 && <div className="ml-4 h-px bg-border sm:ml-5" />}
            <Link
              href={`/properties/${p.id}`}
              className="flex items-center gap-4 px-4 py-4 transition-colors outline-none hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-muted sm:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-lg leading-snug font-semibold">{p.name ?? p.address.street}</span>
                <span className="mt-0.5 block text-base leading-snug text-muted-foreground">
                  {p.name ? `${p.address.street}, ` : ""}
                  {p.address.city}, {p.address.state}
                </span>
                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  <Chip>{humanize(p.propertyType)}</Chip>
                  {p.buildingClass && <Chip>Class {p.buildingClass}</Chip>}
                  {p.rentableAreaSf != null && <Chip>{formatSf(p.rentableAreaSf)}</Chip>}
                  <Chip>
                    {p.availableSpaceCount} advertised {p.availableSpaceCount === 1 ? "space" : "spaces"}
                  </Chip>
                  {p.hasSuiteMatched3d ? (
                    <Chip tone="accent">3D of a listed suite</Chip>
                  ) : (
                    p.hasMatterport && <Chip tone="accent">3D tour</Chip>
                  )}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
