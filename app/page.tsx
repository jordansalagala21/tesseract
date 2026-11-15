import { EntryPoints } from "@/components/home/EntryPoints";
import { ExampleOpportunity } from "@/components/home/ExampleOpportunity";
import { HeroBeforeAfter } from "@/components/home/HeroBeforeAfter";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SiteFooter } from "@/components/site/PageShell";
import { SiteHeader } from "@/components/site/SiteHeader";
import { cn } from "@/lib/utils";

// Counts verified from the CoStar hackathon kit (docs/DATA_SOURCES.md).
const proofPoints = [
  { value: "3,955", label: "advertised lease spaces" },
  { value: "110", label: "suites with a matched 3D scan" },
  { value: "2", label: "markets, Houston and Los Angeles" },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col px-4 sm:px-8">
        <main className="flex flex-1 flex-col gap-20 pt-10 pb-20 sm:pt-14 lg:gap-28">
          {/* First screen: headline and the one action on the left, what it does and the proof points on the
              right, then the before/after full width so the transformation is the biggest thing on the page. */}
          <section className="flex flex-col gap-10 lg:gap-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-14">
              <div className="flex flex-col gap-8">
                <div>
                  <h1 className="font-heading text-4xl font-bold tracking-tight text-balance [font-stretch:112%]">
                    Discover what spaces could become.
                  </h1>
                </div>
                <div className="flex flex-col gap-3">
                  <Link href="/properties" className={cn(buttonVariants(), "w-fit")}>
                    Find a property
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <p className="text-base text-muted-foreground">
                    Or start from{" "}
                    <Link href="/invest" className="relative font-medium text-foreground underline underline-offset-4 after:absolute after:-inset-x-1 after:-inset-y-3 hover:text-primary">
                      your budget
                    </Link>{" "}
                    or{" "}
                    <Link href="/start" className="relative font-medium text-foreground underline underline-offset-4 after:absolute after:-inset-x-1 after:-inset-y-3 hover:text-primary">
                      a business idea
                    </Link>
                    .
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-6">
                <p className="max-w-measure text-lg text-muted-foreground">
                  Tesseract reads CoStar listings, walks the Matterport 3D scan and studies Vexcel aerial images, then
                  ranks the uses that fit a space, with the evidence for each one.
                </p>
                <div>
                  <dl className="grid max-w-measure grid-cols-3 gap-4 border-t pt-5">
                    {proofPoints.map((p) => (
                      <div key={p.label}>
                        <dt className="sr-only">{p.label}</dt>
                        <dd className="font-heading text-2xl font-bold tabular-nums [font-stretch:112%]">{p.value}</dd>
                        <dd className="mt-1.5 text-sm text-muted-foreground">{p.label}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">Counts from the CoStar hackathon dataset.</p>
                </div>
              </div>
            </div>

            <HeroBeforeAfter />
          </section>

          <EntryPoints />
          <ExampleOpportunity />
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
