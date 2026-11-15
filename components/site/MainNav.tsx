"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/properties", label: "Properties" },
  { href: "/invest", label: "Invest" },
  { href: "/start", label: "Start a business" },
];

export function NavLinks({ active }: { active: string | null }) {
  return (
    <nav aria-label="Main" className="-mx-2 flex items-center sm:mx-0">
      {NAV.map((item) => {
        const current = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-11 items-center rounded-lg px-2 text-base font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3",
              current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("border-b-2 py-1", current ? "border-primary" : "border-transparent")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Main navigation with the current section marked. */
export function MainNav() {
  const path = usePathname();
  const active = NAV.find((n) => path === n.href || path.startsWith(`${n.href}/`))?.href ?? null;
  return <NavLinks active={active} />;
}
