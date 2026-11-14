import { EntryPoints } from "@/components/home/EntryPoints";
import { ExampleOpportunity } from "@/components/home/ExampleOpportunity";
import { HeroTransformations } from "@/components/home/HeroTransformations";
import { SiteHeader } from "@/components/site/SiteHeader";

// Counts verified from the CoStar hackathon kit (docs/DATA_SOURCES.md).
const proofPoints = [
  { value: "3,955", label: "advertised lease spaces" },
  { value: "122", label: "suites with a matched 3D scan" },
  { value: "2", label: "markets, Houston and Los Angeles" },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 sm:px-8">
      <SiteHeader />

      <main className="flex flex-1 flex-col gap-20 py-10 lg:gap-28 lg:py-16">
        <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <h1 className="font-heading text-[clamp(2.6rem,4.6vw+1rem,4.75rem)] leading-[0.98] font-bold tracking-[-0.03em] text-balance [font-stretch:112%]">
              Discover what spaces could become.
            </h1>
            <p className="mt-5 max-w-[33rem] text-[17px] leading-relaxed text-muted-foreground">
              Tesseract reads CoStar listings, walks the Matterport 3D scan and studies Vexcel aerial images, then
              ranks the uses that fit a space, with the evidence for each one.
            </p>
            <dl className="mt-8 grid max-w-[33rem] grid-cols-3 gap-4 border-t pt-5">
              {proofPoints.map((p) => (
                <div key={p.label}>
                  <dt className="sr-only">{p.label}</dt>
                  <dd className="font-heading text-[28px] leading-none font-bold tabular-nums [font-stretch:112%]">{p.value}</dd>
                  <dd className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{p.label}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-muted-foreground">Counts from the CoStar hackathon dataset.</p>
          </div>

          <HeroTransformations />
        </section>

        <EntryPoints />
        <ExampleOpportunity />
      </main>

      <footer className="border-t py-6 text-[13px] leading-relaxed text-muted-foreground">
        Covers advertised space in Houston and Los Angeles from the CoStar hackathon dataset. Advertised availability
        is not confirmed vacancy.
      </footer>
    </div>
  );
}
