import type { Metadata } from "next";
import { Market } from "@/lib/contracts";
import { PropertyResults, PropertySearchForm } from "@/components/property/PropertySearch";
import { DataUnavailable } from "@/components/property/DataUnavailable";
import { PageHeader } from "@/components/site/PageShell";
import { searchProperties } from "./property-data";

export const metadata: Metadata = { title: "Find a property | Tesseract" };

export default async function PropertiesPage({ searchParams }: PageProps<"/properties">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const parsedMarket = Market.safeParse(sp.market);
  const market = parsedMarket.success ? parsedMarket.data : undefined;
  const result = await searchProperties({ q, market });
  const retry = new URLSearchParams({ ...(q && { q }), ...(market && { market }) }).toString();

  return (
    <>
      <PageHeader
        title="Find a property"
        description="Search commercial buildings in Houston and Los Angeles, then open one to see its advertised spaces."
      />
      <PropertySearchForm q={q} market={market} />
      {result.ok ? (
        <PropertyResults items={result.data.items} total={result.data.total} q={q} />
      ) : (
        <DataUnavailable reason={result.reason} retryHref={`/properties${retry ? `?${retry}` : ""}`} />
      )}
    </>
  );
}
