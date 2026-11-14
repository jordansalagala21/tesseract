import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PropertyFacts, SpaceList, TenantList } from "@/components/property/PropertyDetail";
import { SampleDataBanner } from "@/components/property/SampleDataBanner";
import { getPropertyPage } from "../property-data";

export default async function PropertyPage({ params }: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const propertyId = Number(id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) notFound();

  const { detail, spaces, sample } = await getPropertyPage(propertyId);
  const p = detail.property;

  return (
    <>
      <div>
        <Link
          href="/properties"
          className="-ml-1 inline-flex items-center gap-0.5 rounded-md pr-1 text-[17px] text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
          Properties
        </Link>
        <h1 className="mt-4 font-heading text-[34px] leading-tight font-bold tracking-tight text-balance">
          {p.name ?? p.address.street}
        </h1>
        <p className="mt-1 text-[17px] text-muted-foreground">
          {p.name ? `${p.address.street}, ` : ""}
          {p.address.city}, {p.address.state} {p.address.postcode}
        </p>
      </div>
      {sample && <SampleDataBanner />}
      <PropertyFacts property={p} />
      <SpaceList spaces={spaces.items} note={spaces.availabilityNote} />
      <TenantList tenants={detail.currentTenants} recorded={p.counts.currentTenants} sample={sample} />
    </>
  );
}
