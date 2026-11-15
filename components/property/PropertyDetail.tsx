import Link from "next/link";
import { DoorClosed, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import type { AvailableSpace, Property } from "@/lib/contracts";
import { PropertyDetailResponse } from "@/lib/contracts";
import type { z } from "zod";
import { Chip } from "./Chip";
import { formatDate, formatNumber, formatRent, formatSf, humanize, subtypeLabel } from "./format";

type Tenant = z.infer<typeof PropertyDetailResponse>["currentTenants"][number];

function SectionHeading({ id, children, detail }: { id: string; children: React.ReactNode; detail?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {children}
      </h2>
      {detail && <span className="text-base text-muted-foreground tabular-nums">{detail}</span>}
    </div>
  );
}

export function PropertyFacts({ property: p }: { property: Property }) {
  const frontage = p.retail?.frontage.find((f) => f.isPrimary) ?? p.retail?.frontage[0];
  const subtype = subtypeLabel(p.propertySubtype);
  const facts: [string, string | null][] = [
    ["Property type", [humanize(p.propertyType), subtype && subtype !== humanize(p.propertyType) ? `(${subtype.toLowerCase()})` : null].filter(Boolean).join(" ") || null],
    ["Building class", p.buildingClass && `Class ${p.buildingClass}`],
    ["CoStar rating", p.buildingRating != null ? `${p.buildingRating} of 5` : null],
    ["Rentable area", formatSf(p.rentableAreaSf)],
    ["Stories", p.stories != null ? String(p.stories) : null],
    ["Lot", p.lot && `${formatNumber(p.lot.value)} ${p.lot.unit === "acres" ? "acres" : "SF"}`],
    ["Year built", p.yearBuilt != null ? String(p.yearBuilt) : null],
    ["Parking ratio", p.parkingRatioPer1000Sf != null ? `${p.parkingRatioPer1000Sf} per 1,000 SF` : null],
    ["Ceiling height", p.retail?.ceilingHeightFt != null ? `${p.retail.ceilingHeightFt} ft` : null],
    [
      "Frontage",
      frontage?.feet != null
        ? `${formatNumber(frontage.feet)} ft on ${frontage.street}${frontage.curbCuts != null ? `, ${frontage.curbCuts} curb cuts` : ""}`
        : null,
    ],
    ["Zoning", p.zoningDescription],
  ];

  return (
    <section aria-labelledby="facts-heading" className="@container">
      <SectionHeading id="facts-heading">Building</SectionHeading>
      <div className="rounded-2xl border bg-card">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 @xl:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className={value ? "mt-0.5 text-lg font-semibold tabular-nums" : "mt-0.5 text-base text-muted-foreground"}>
                {value ?? "Not recorded"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">Source: CoStar property record {p.id}</p>
      </div>
    </section>
  );
}

export function SpaceList({ spaces, note }: { spaces: AvailableSpace[]; note: string }) {
  return (
    <section aria-labelledby="spaces-heading">
      <SectionHeading id="spaces-heading" detail={`${spaces.length} advertised`}>
        Advertised spaces
      </SectionHeading>
      <p className="mb-3 text-base text-muted-foreground">{note}</p>
      {spaces.length === 0 ? (
        <EmptyState title="No advertised spaces" icon={DoorClosed}>
          The current CoStar listings have no space advertised in this building.
        </EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-card">
          {spaces.map((s, i) => {
            const rent = formatRent(s.askingRent);
            const details = [formatSf(s.sfMin, s.sfMax), humanize(s.floor), s.onMarketDate && `on market since ${formatDate(s.onMarketDate)}`]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={s.id}>
                {i > 0 && <div className="ml-4 h-px bg-border sm:ml-5" />}
                <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-lg leading-snug">
                      <span className="font-semibold">{s.suite ? `Suite ${s.suite}` : "Unnamed space"}</span>{" "}
                      <span className="text-muted-foreground">{humanize(s.spaceUse)}</span>
                    </p>
                    {details && <p className="mt-0.5 text-base leading-snug text-muted-foreground">{details.charAt(0).toUpperCase() + details.slice(1)}</p>}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {s.matterport && (
                        <Link
                          href={`?model=${encodeURIComponent(s.matterport.modelId)}#tour`}
                          scroll={false}
                          className="-my-2.5 flex h-11 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Chip tone="accent">View 3D tour of this suite</Chip>
                        </Link>
                      )}
                      {s.floorPlanImageUrl && <Chip>Floor plan</Chip>}
                      {s.availabilityStatus === "lease_pending" && <Chip>Lease pending</Chip>}
                    </div>
                  </div>
                  <p className={rent ? "shrink-0 text-lg font-semibold tabular-nums" : "shrink-0 text-base text-muted-foreground"}>
                    {rent ?? "Rate not published"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function TenantList({ tenants, recorded, sample }: { tenants: Tenant[]; recorded: number; sample: boolean }) {
  return (
    <section aria-labelledby="tenants-heading">
      <SectionHeading id="tenants-heading" detail={`${recorded} recorded`}>
        Current tenants
      </SectionHeading>
      {tenants.length === 0 ? (
        <EmptyState title={sample ? "Tenant names not shown yet" : "No current tenants"} icon={Users}>
          {sample
            ? `CoStar records ${recorded} current ${recorded === 1 ? "tenant" : "tenants"} here. Names appear once the property API is connected.`
            : "CoStar records no current tenants for this property."}
        </EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-card">
          {tenants.map((t, i) => (
            <li key={`${t.name}-${t.suite}-${i}`}>
              {i > 0 && <div className="ml-4 h-px bg-border sm:ml-5" />}
              <div className="flex items-baseline justify-between gap-4 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{t.name ?? "Name not recorded"}</p>
                  <p className="text-base text-muted-foreground">
                    {[humanize(t.industry), t.suite && `Suite ${t.suite}`].filter(Boolean).join(", ") || "Industry not recorded"}
                  </p>
                </div>
                {t.squareFeet != null && <p className="shrink-0 text-base text-muted-foreground tabular-nums">{formatSf(t.squareFeet)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
