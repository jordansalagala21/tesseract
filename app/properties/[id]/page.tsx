import { notFound } from "next/navigation";
import { PropertyFacts, SpaceList, TenantList } from "@/components/property/PropertyDetail";
import { PageHeader } from "@/components/site/PageShell";
import { SampleDataBanner } from "@/components/property/SampleDataBanner";
import { AerialViewer } from "@/components/viewer/AerialViewer";
import { MatterportViewer } from "@/components/viewer/MatterportViewer";
import { toTourOptions } from "@/components/viewer/tours";
import { getPropertyPage } from "../property-data";

export default async function PropertyPage({ params, searchParams }: PageProps<"/properties/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const propertyId = Number(id);
  if (!Number.isInteger(propertyId) || propertyId <= 0) notFound();

  const { detail, spaces, sample } = await getPropertyPage(propertyId);
  const p = detail.property;
  const tours = toTourOptions(detail.matterportModels, spaces.items, p.matterportModelIds);

  return (
    <>
      <PageHeader
        back={{ href: "/properties", label: "Properties" }}
        title={p.name ?? p.address.street}
        description={`${p.name ? `${p.address.street}, ` : ""}${p.address.city}, ${p.address.state} ${p.address.postcode ?? ""}`.trim()}
      />
      {sample && <SampleDataBanner />}
      {/* Tour and the building facts side by side on wide screens, so both are in the first view. */}
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        {/* key: a suite's "View 3D tour" link changes ?model=, which remounts the viewer on that scan */}
        <MatterportViewer key={String(sp.model)} tours={tours} initialModelId={typeof sp.model === "string" ? sp.model : undefined} />
        <PropertyFacts property={p} />
      </div>
      <SpaceList spaces={spaces.items} note={spaces.availabilityNote} />
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-8">
        <AerialViewer images={detail.aerial} />
        <TenantList tenants={detail.currentTenants} recorded={p.counts.currentTenants} sample={sample} />
      </div>
    </>
  );
}
