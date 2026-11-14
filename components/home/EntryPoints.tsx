import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// Each card previews what that path gives you. The previews are drawings, not data.

function TourPreview() {
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 200 110" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M30 78 L100 40 L170 78 L100 104 Z" className="fill-primary/10 stroke-primary" strokeWidth="1.5" />
        <path d="M30 78 V40 L100 6 V40 M100 6 L170 40 V78" className="stroke-foreground/40" strokeWidth="1.5" />
        <path d="M100 40 V104" className="stroke-foreground/25" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
      <span className="absolute right-3 bottom-3 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">3D tour</span>
    </div>
  );
}

function CapitalPreview() {
  const bars = [
    { label: "Lease", heights: [40, 58, 46] },
    { label: "Buy", heights: [70, 52, 84] },
  ];
  return (
    <div className="flex h-full w-full items-end justify-center gap-8 px-6 pb-3" aria-hidden="true">
      {bars.map((b) => (
        <div key={b.label} className="flex flex-col items-center gap-1.5">
          <div className="flex h-20 items-end gap-1">
            {b.heights.map((h, i) => (
              <span key={i} className={i === 1 ? "w-3 rounded-t bg-primary" : "w-3 rounded-t bg-foreground/20"} style={{ height: `${h}%` }} />
            ))}
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function MatchPreview() {
  const rows = [
    { w: "w-24", fit: "bg-primary" },
    { w: "w-20", fit: "bg-primary/60" },
    { w: "w-16", fit: "bg-foreground/25" },
  ];
  return (
    <ul className="flex h-full w-full flex-col justify-center gap-2.5 px-6" aria-hidden="true">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-2.5 rounded-lg bg-card/80 px-3 py-2 shadow-sm">
          <span className={`size-2.5 shrink-0 rounded-full ${r.fit}`} />
          <span className={`h-2 rounded-full bg-foreground/20 ${r.w}`} />
          <span className="ml-auto h-2 w-6 rounded-full bg-foreground/10" />
        </li>
      ))}
    </ul>
  );
}

const entries = [
  {
    href: "/properties",
    title: "I have a property",
    detail: "See what a space could become, with the evidence behind each idea and a 3D walkthrough.",
    Preview: TourPreview,
  },
  {
    href: "/invest",
    title: "I have capital",
    detail: "Find listed buildings and uses that could pay. Leasing and buying are compared separately.",
    Preview: CapitalPreview,
  },
  {
    href: "/start",
    title: "I have an idea",
    detail: "Describe the business and budget. Get advertised spaces that fit, ranked, with 3D tours.",
    Preview: MatchPreview,
  },
];

// Routes match docs/USER_FLOWS.md: owner (UI-02), investor and entrepreneur forms (UI-09).
export function EntryPoints() {
  return (
    <nav aria-labelledby="entry-heading">
      <h2 id="entry-heading" className="font-heading text-2xl leading-tight font-bold tracking-tight [font-stretch:112%]">
        Start where you are.
      </h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {entries.map(({ href, title, detail, Preview }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-colors outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/60"
            >
              <div className="plan-dots h-36 border-b bg-muted/60">
                <Preview />
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-5">
                <span className="flex items-center justify-between gap-2 text-xl leading-snug font-semibold">
                  {title}
                  <ArrowUpRight
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-base leading-snug text-muted-foreground">{detail}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
