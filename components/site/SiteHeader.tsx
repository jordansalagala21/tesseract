import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex h-16 items-center">
      <Link
        href="/"
        className="-mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-1 text-[17px] font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BrandMark />
        Tesseract
      </Link>
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
