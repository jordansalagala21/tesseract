import { Suspense } from "react";
import Link from "next/link";
import { MainNav, NavLinks } from "./MainNav";

/** Full-width bar with the brand and the three ways into Tesseract. */
export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-16 w-full max-w-page flex-wrap items-center justify-between gap-x-6 px-4 sm:px-8">
        <Link
          href="/"
          className="-mx-2 flex h-11 items-center gap-2.5 rounded-lg px-2 text-lg font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark />
          Tesseract
        </Link>
        {/* The current-page marker needs the URL, which streams in; the links themselves render at once. */}
        <Suspense fallback={<NavLinks active={null} />}>
          <MainNav />
        </Suspense>
      </div>
    </header>
  );
}

// A tesseract drawn as two offset squares joined at the corners.
function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 text-primary" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <rect x="3" y="7" width="13" height="13" rx="1.5" />
      <rect x="8" y="3" width="13" height="13" rx="1.5" />
      <path d="M3 7 8 3M16 7l5-4M3 20l5-4M16 20l5-4" />
    </svg>
  );
}
