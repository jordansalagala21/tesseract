import Link from "next/link";
import { Building2, ChevronRight, Landmark, Lightbulb, type LucideIcon } from "lucide-react";

type Entry = { href: string; title: string; detail: string; Icon: LucideIcon };

// Routes match docs/USER_FLOWS.md: owner (UI-02), investor and entrepreneur forms (UI-09).
const entries: Entry[] = [
  {
    href: "/properties",
    title: "I have a property",
    detail: "See what a space could become, with the evidence behind each idea.",
    Icon: Building2,
  },
  {
    href: "/invest",
    title: "I have capital",
    detail: "Find listed buildings and the uses that could pay. Leasing and buying stay separate.",
    Icon: Landmark,
  },
  {
    href: "/start",
    title: "I have an idea",
    detail: "Describe the business and budget. Get spaces that fit, with 3D tours.",
    Icon: Lightbulb,
  },
];

export function EntryPoints() {
  return (
    <nav aria-labelledby="entry-heading">
      <h2 id="entry-heading" className="mb-3 text-[15px] font-medium text-muted-foreground">
        Where do you want to start?
      </h2>
      <ul className="overflow-hidden rounded-[20px] border bg-card">
        {entries.map(({ href, title, detail, Icon }, i) => (
          <li key={href}>
            {/* Inset separator, aligned with the text like a grouped list */}
            {i > 0 && <div className="ml-[72px] h-px bg-border sm:ml-[76px]" />}
            <Link
              href={href}
              className="flex min-h-[76px] items-center gap-4 px-4 py-4 transition-colors outline-none hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-muted sm:px-5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-primary/12 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] leading-snug font-semibold">{title}</span>
                <span className="mt-0.5 block text-[15px] leading-snug text-muted-foreground">{detail}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
