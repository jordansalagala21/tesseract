import { EntryPoints } from "@/components/home/EntryPoints";
import { HeroPlan } from "@/components/home/HeroPlan";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 sm:px-8">
      <header className="flex h-16 items-center">
        <span className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
          <BrandMark />
          Tesseract
        </span>
      </header>

      <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-16">
        <div className="flex flex-col gap-10">
          <div>
            <h1 className="font-heading text-[clamp(2.5rem,4.2vw+1rem,4.25rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">
              Discover what spaces could become.
            </h1>
            <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-muted-foreground">
              Tesseract reads CoStar listings, walks the Matterport 3D scan and studies Vexcel aerial images, then
              ranks the uses that fit a space. Every claim links to its source.
            </p>
          </div>
          <EntryPoints />
        </div>

        <HeroPlan />
      </main>

      <footer className="border-t py-6 text-[13px] leading-relaxed text-muted-foreground">
        Covers advertised space in Houston and Los Angeles from the CoStar hackathon dataset. Advertised availability
        is not confirmed vacancy.
      </footer>
    </div>
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
