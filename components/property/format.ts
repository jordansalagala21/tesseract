import type { AvailableSpace } from "@/lib/contracts";

const num = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** CoStar stores ZIP+4 as nine digits: "770063540" → "77006-3540". Anything else is shown as given. */
export const formatPostcode = (code: string | null | undefined) => (code && /^\d{9}$/.test(code) ? `${code.slice(0, 5)}-${code.slice(5)}` : (code ?? ""));

/** "GeneralRetail" → "General retail", "FirstFloor" → "First floor" */
export function humanize(value: string | null | undefined): string | null {
  if (!value) return null;
  const words = value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "GeneralRetail_Freestanding" → "Freestanding" */
export function subtypeLabel(subtype: string | null): string | null {
  return humanize(subtype?.split("_").pop());
}

export function formatSf(min: number | null, max: number | null = min): string | null {
  if (min == null && max == null) return null;
  if (min == null || max == null || min === max) return `${num.format(Math.round((min ?? max)!))} SF`;
  return `${num.format(Math.round(min))}–${num.format(Math.round(max))} SF`;
}

export function formatDate(iso: string | null): string | null {
  return iso ? date.format(new Date(iso)) : null;
}

const SERVICE_TYPES: Record<string, string> = {
  TripleNet: "NNN",
  FullServiceGross: "full service gross",
  ModifiedGross: "modified gross",
  PlusElectric: "plus electric",
  IndustrialGross: "industrial gross",
};

/** "$45/SF/yr NNN", "$37–45/SF/yr NNN", or null when no rate was published. */
export function formatRent(rent: AvailableSpace["askingRent"]): string | null {
  const { psfYearLow: low, psfYearHigh: high } = rent;
  if (low == null && high == null) return null;
  const money = (n: number) => num.format(Math.round(n * 100) / 100);
  const value = low != null && high != null && low !== high ? `$${money(low)}–${money(high)}` : `$${money((low ?? high)!)}`;
  const service = rent.serviceType ? ` ${SERVICE_TYPES[rent.serviceType] ?? humanize(rent.serviceType)}` : "";
  return `${value}/SF/yr${service}`;
}

export const formatNumber = (n: number) => num.format(n);
