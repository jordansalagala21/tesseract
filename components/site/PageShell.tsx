import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "./SiteHeader";

/** Every page's frame: header, one content width with the same gutters, and the data footer. */
export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col px-4 sm:px-8">
        <main className={cn("flex flex-1 flex-col gap-10 pt-8 pb-16 sm:pt-12", className)}>{children}</main>
      </div>
      <SiteFooter />
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <p className="mx-auto w-full max-w-page px-4 py-6 text-sm text-muted-foreground sm:px-8">
        Covers advertised space in Houston and Los Angeles from the CoStar hackathon dataset. Advertised availability is
        not confirmed vacancy.
      </p>
    </footer>
  );
}

/** Page title block: optional back link, title, one-line description, and room for actions. */
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {back && (
        <Link
          href={back.href}
          className="-ml-1.5 inline-flex h-11 w-fit items-center gap-1 rounded-lg pr-2 pl-0.5 text-base font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance [font-stretch:112%]">{title}</h1>
          {description && <p className="mt-2 max-w-measure text-lg text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="dimension-line" aria-hidden="true" />
    </div>
  );
}
