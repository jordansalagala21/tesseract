"use client";

// Main page. Each feature is one full-screen section inside a snapping scroller, so a visitor stops
// on one idea at a time. Every animation shows a real mechanism of the product and replays while
// its section is on screen; with reduced motion everything rests in its finished state.
//
// Stand-ins, to be replaced with live imagery: the tour slider uses the Suite 500 shell and gym
// render already in public/hero, and the two aerial tiles are drawings (the real ones come from
// /api/imagery/vexcel/ortho and /oblique). The analysis rows are labelled as example output.

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, ChevronsLeftRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import shellImg from "@/public/hero/shell.webp";
import gymImg from "@/public/hero/gym.webp";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ANALYSIS_ROWS,
  FOOTER_NOTE,
  KIND_LABEL,
  KIND_LEGEND,
  PATHS,
  SECTIONS,
  SOURCES,
  SUITE,
  baseRentPerYear,
  replayMs,
  type EvidenceKind,
} from "./home-content";
import s from "./home-sections.module.css";

const REDUCED = "(prefers-reduced-motion: reduce)";
const prefersReduced = () => typeof window !== "undefined" && window.matchMedia(REDUCED).matches;
const delay = (seconds: number) => ({ animationDelay: `${seconds}s` });
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const sf = (n: number) => `${n.toLocaleString("en-US")} SF`;

const KIND_COLOR: Record<EvidenceKind, string> = {
  verified_fact: "#1d6a56",
  ai_observation: "#0b78b6",
  user_assumption: "#16201d",
  missing: "#55605b",
};

const h2 = "text-3xl font-bold tracking-tight text-balance";
const lead = "text-lg text-[#3a4541]";
const note = "border-t border-foreground/15 pt-4 font-mono text-sm leading-relaxed text-muted-foreground";
const mono = "font-mono text-xs";
const SUITE_OUTLINE = "M8 10 H206 V56 H308 V140 H8 Z";

export function HomeSections() {
  const scroller = useRef<HTMLDivElement>(null);
  const pages = useRef<(HTMLElement | null)[]>([]);
  const glideRun = useRef(0);
  const swept = useRef(false);
  const userTookSlider = useRef(false);
  const [cur, setCur] = useState(0);
  const [run, setRun] = useState(0);
  const [progress, setProgress] = useState(0);
  const [pos, setPos] = useState(50);

  const section = SECTIONS[cur];
  const last = cur === SECTIONS.length - 1;

  // Which section is on screen: the one crossing the middle of the viewport.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setCur(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root, rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    pages.current.forEach((p) => p && io.observe(p));
    const onScroll = () => {
      const max = root.scrollHeight - root.clientHeight;
      setProgress(max > 0 ? Math.min(1, (root.scrollTop + root.clientHeight * 0.6) / root.scrollHeight) : 0);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      root.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Replay the current section's animation while the visitor stays on it.
  useEffect(() => {
    if (prefersReduced()) return;
    const id = window.setInterval(() => setRun((r) => r + 1), replayMs(SECTIONS[cur].id));
    return () => window.clearInterval(id);
  }, [cur]);

  // The first time the tour is reached, the divider crosses the picture once and settles in the
  // middle. After that it only moves when the visitor moves it.
  useEffect(() => {
    if (SECTIONS[cur].id !== "tour" || swept.current || prefersReduced()) return;
    swept.current = true;
    const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    const wait = 600, out = 2200, back = 1000;
    let start: number | null = null;
    let done = false;
    let frame = requestAnimationFrame(function step(t) {
      if (userTookSlider.current) return;
      start ??= t + wait;
      const dt = t - start;
      setPos(dt <= 0 ? 100 : dt < out ? 100 - 100 * ease(dt / out) : dt < out + back ? 50 * ease((dt - out) / back) : 50);
      if (dt < out + back) frame = requestAnimationFrame(step);
      else done = true;
    });
    return () => {
      cancelAnimationFrame(frame);
      // Interrupted (the visitor moved on, or a dev-mode remount): let it run on the next visit.
      if (!done && !userTookSlider.current) swept.current = false;
    };
  }, [cur]);

  // A slow eased glide for clicks. Wheel and touch keep the browser's own snapping.
  const glideTo = useCallback((index: number) => {
    const root = scroller.current;
    const target = pages.current[index];
    if (!root || !target) return;
    const from = root.scrollTop;
    const to = from + target.getBoundingClientRect().top - root.getBoundingClientRect().top;
    if (prefersReduced()) {
      root.scrollTop = to;
      return;
    }
    const screens = Math.max(1, Math.abs(to - from) / root.clientHeight);
    const duration = Math.min(2600, 1300 + (screens - 1) * 350);
    const mine = ++glideRun.current;
    const ease = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
    let start: number | null = null;
    root.style.scrollSnapType = "none";
    requestAnimationFrame(function step(t) {
      if (glideRun.current !== mine) return;
      start ??= t;
      const k = Math.min(1, (t - start) / duration);
      root.scrollTop = from + (to - from) * ease(k);
      if (k < 1) requestAnimationFrame(step);
      else root.style.scrollSnapType = "";
    });
  }, []);

  const page = (index: number) => ({
    index,
    cur,
    run,
    setRef: (el: HTMLElement | null) => {
      pages.current[index] = el;
    },
  });

  return (
    <div className={cn(s.shell, "relative h-dvh overflow-hidden")} style={{ backgroundColor: section.ground }}>
      <div ref={scroller} className={s.scroller}>
        <div className="relative">
          {/* Dimension spine: a rule down the left margin that fills as the page is read. */}
          <div aria-hidden="true" className="absolute top-16 bottom-28 left-[calc(50%-39rem)] hidden w-px bg-foreground/30 min-[1300px]:block">
            <div className={cn(s.prog, "absolute top-0 -left-px w-[3px]")} style={{ height: `${progress * 100}%`, backgroundColor: section.accent }} />
          </div>

          <header className={cn(s.shell, "sticky top-0 z-10 -mb-16 border-b border-foreground/15 px-4 sm:px-8")} style={{ backgroundColor: section.ground }}>
            <div className="mx-auto flex h-16 w-full max-w-page items-center justify-between gap-4">
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  glideTo(0);
                }}
                className="-mx-2 flex h-11 items-center gap-2.5 rounded-lg px-2 text-lg font-semibold tracking-tight"
              >
                <BrandMark />
                Tesseract
              </a>
              <a
                href="#start-here"
                onClick={(e) => {
                  e.preventDefault();
                  glideTo(SECTIONS.length - 1);
                }}
                className={cn(buttonVariants(), "h-11 px-4")}
              >
                Choose your path
              </a>
            </div>
          </header>

          <Page {...page(0)}>
            <div className="flex flex-wrap items-start gap-x-16 gap-y-10">
              <div className={cn(s.rv, "flex min-w-0 flex-[1.25_1_340px] flex-col gap-7")}>
                <h1 className="font-heading text-4xl font-bold tracking-tight text-balance [font-stretch:112%]">
                  Discover what spaces could become.
                </h1>
                <p className={cn(lead, "max-w-measure")}>
                  Tesseract reads a commercial space the way an analyst would. It suggests alternative uses for the
                  space and shows the evidence behind every claim.
                </p>
                <div className="mt-3">
                  <p className="mb-3 text-base font-semibold">How it works</p>
                  <dl className="border-b border-foreground/15">
                    {SOURCES.map((src) => (
                      <div key={src.name} className="flex flex-wrap gap-x-6 gap-y-0.5 border-t border-foreground/15 py-3">
                        <dt className="w-28 shrink-0 pt-0.5 font-mono text-sm text-primary">{src.name}</dt>
                        <dd className="flex-[1_1_220px] text-base">{src.text}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              <div className={cn(s.rv, s.rv2, "flex min-w-0 flex-[1_1_320px] flex-col gap-10")}>
                <Replay {...page(0)}>
                  <figure className="flex flex-col gap-2.5">
                    <div className="relative aspect-[456/300] w-full border bg-card">
                      <svg viewBox="0 0 456 300" role="img" aria-label="Plan outline of Suite 100 with example uses attached" className="absolute inset-0 size-full">
                        <path d="M36 28 H420 M36 23 V33 M420 23 V33" stroke="var(--plan-ink)" fill="none" />
                        <path className={s.draw} pathLength={1} d="M36 56 H310 V120 H420 V250 H36 Z" stroke="currentColor" strokeWidth={2.5} fill="none" style={delay(0.3)} />
                        <path className={s.draw} pathLength={1} d="M52 72 H294 V136 H404 V234 H52 Z" stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="0.012 0.008" fill="none" style={delay(0.8)} />
                      </svg>
                      <span className={cn(mono, "absolute top-[6%] left-1/2 -translate-x-1/2 -translate-y-1/3 bg-card px-2 whitespace-nowrap")}>
                        {sf(SUITE.advertisedSf)} advertised
                      </span>
                      {[
                        { label: "Gym", at: "top-[28%] left-[15%]", t: 1.5 },
                        { label: "Café", at: "top-[28%] left-[33%]", t: 1.9 },
                        { label: "Restaurant or bar", at: "top-[42%] left-[15%]", t: 2.3 },
                      ].map((use) => (
                        <span key={use.label} style={delay(use.t)} className={cn(s.rise, use.at, "absolute inline-flex h-7 items-center rounded-full bg-foreground px-3 text-sm font-medium whitespace-nowrap text-background")}>
                          {use.label}
                        </span>
                      ))}
                      <span style={delay(2.7)} className={cn(s.rise, "absolute top-[56%] left-[15%] inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs whitespace-nowrap")}>
                        <Glyph kind="verified_fact" />
                        {KIND_LABEL.verified_fact}
                      </span>
                      <span className={cn(mono, "absolute top-[69%] left-[15%] whitespace-nowrap text-primary")}>{sf(SUITE.scannedSf)} scanned</span>
                    </div>
                    <figcaption className={cn(mono, "text-muted-foreground")}>
                      {SUITE.suite}, {SUITE.address}, {SUITE.city}. Uses shown are examples.
                    </figcaption>
                  </figure>
                </Replay>

                <figure className="flex flex-col gap-4">
                  <div className="dimension-line" aria-hidden="true" />
                  <blockquote className="font-heading text-2xl leading-tight font-semibold tracking-tight [font-stretch:112%]">
                    “Available space isn’t the same as a space without a future.”
                  </blockquote>
                  <figcaption className="text-base text-muted-foreground">Tesseract</figcaption>
                </figure>
              </div>
            </div>
          </Page>

          <Page {...page(1)}>
            <Feature
              heading="Walk the space as it is. Then see what it could hold."
              body="Suites with a Matterport scan open as a 3D tour. Drag the divider to compare the real interior with a furnished concept for one suggested use."
              note={`Scanned area is not leasable area. ${SUITE.suite} scans at ${sf(SUITE.scannedSf)} against ${sf(SUITE.advertisedSf)} advertised.`}
              label={SECTIONS[1].label}
            >
              <figure className="flex flex-col gap-3">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                  <Image src={shellImg} alt="Bare-shell office floor in Houston with an exposed ceiling grid, concrete floor and a wall of windows." fill sizes="(min-width: 1024px) 650px, 92vw" className="object-cover" />
                  <Image src={gymImg} alt="The same floor shown as a gym. AI-generated illustration." fill sizes="(min-width: 1024px) 650px, 92vw" className="object-cover" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
                  <div aria-hidden="true" className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white" style={{ left: `${pos}%` }}>
                    <span className="absolute top-[42%] left-1/2 grid size-11 -translate-1/2 place-items-center rounded-full bg-white text-foreground shadow-sm">
                      <ChevronsLeftRight className="size-5" />
                    </span>
                  </div>
                  <span className="absolute top-2.5 left-2.5 rounded-full bg-scrim px-3 py-1.5 text-sm leading-4 font-medium text-scrim-foreground">Real photo</span>
                  <span className="absolute right-2.5 bottom-2.5 rounded-full bg-scrim px-3 py-1.5 text-sm leading-4 font-medium text-scrim-foreground">
                    Illustrative concept, AI-generated
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(pos)}
                    onChange={(e) => {
                      userTookSlider.current = true;
                      setPos(Number(e.target.value));
                    }}
                    aria-label="Compare the real photo with the furnished concept"
                    className="absolute inset-0 size-full cursor-ew-resize opacity-0"
                  />
                </div>
                <figcaption className={cn(mono, "leading-relaxed text-muted-foreground")}>
                  Matterport scan, Suite 500, 19350 State Highway 249, Houston. Concept shown: gym. Drag or use the arrow keys.
                </figcaption>
              </figure>
            </Feature>
          </Page>

          <Page {...page(2)}>
            <Feature
              flip
              heading="A search agent that reads the listings for you."
              body="Describe a property, a budget or a business. The agent queries CoStar data and returns advertised spaces that match, with rent shown in one unit: dollars per square foot per year."
              note="Listings are advertised availability, not confirmed vacancy."
              label={SECTIONS[2].label}
            >
              <Replay {...page(2)}>
                <div className="flex flex-col border bg-background">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-b px-5 py-3.5 font-mono text-sm">
                    <span>Search advertised spaces</span>
                    <span className="text-muted-foreground">3,339 properties read</span>
                  </div>
                  <div className="relative m-5 h-48" aria-hidden="true">
                    <div className={cn(s.dim, s.dots, "absolute inset-0 opacity-20")} style={delay(0.4)} />
                    <div className={cn(s.pop, "absolute top-20 left-[60%] size-3 bg-primary outline-2 outline-offset-4 outline-primary")} style={delay(1.4)} />
                    <div className={cn(s.growY, "absolute top-[6.25rem] bottom-0 left-[60%] ml-1.5 w-px bg-primary")} style={delay(1.7)} />
                  </div>
                  <div className={cn(s.rise, "flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-primary bg-card px-5 py-4")} style={delay(2)}>
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-semibold">
                        {SUITE.address}, {SUITE.suite}
                      </span>
                      <span className="font-mono text-sm text-[#3a4541]">
                        {sf(SUITE.advertisedSf)} · ${SUITE.rentPsfYear}/SF/yr NNN · {SUITE.city}
                      </span>
                    </div>
                    <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-primary px-3 text-sm font-medium text-primary">Advertised available</span>
                  </div>
                </div>
              </Replay>
            </Feature>
          </Page>

          <Page {...page(3)}>
            <Feature
              heading="See what surrounds the building."
              body="Vexcel aerial imagery shows the block from above and from an angle: frontage, parking, neighbours and access. The agent looks at the same pictures you do and labels what it sees as an AI observation."
              note="Oblique views face north, south, east or west."
              label={SECTIONS[3].label}
            >
              <Replay {...page(3)}>
                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                  <AerialTile caption="Top-down" label="Top-down aerial view placeholder with the property outlined" />
                  <AerialTile caption="Oblique, facing north" label="Oblique aerial view placeholder facing north with the property outlined" oblique />
                </div>
              </Replay>
            </Feature>
          </Page>

          <Page {...page(4)}>
            <Feature
              flip
              top
              heading="An analysis you can check."
              body="The analysis agent shows each step as it works, ranks the uses it found and links every claim to its evidence. When the data can’t support a score, the score stays blank."
              label={SECTIONS[4].label}
              extra={
                <dl className="mt-1 border-b border-foreground/15">
                  {KIND_LEGEND.map((k) => (
                    <div key={k.kind} className="flex gap-3 border-t border-foreground/15 py-3 text-base">
                      <span className="mt-1.5">
                        <Glyph kind={k.kind} />
                      </span>
                      <div>
                        <dt className="inline font-semibold">{k.label}. </dt>
                        <dd className="inline">{k.blurb}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              }
            >
              <Replay {...page(4)}>
                <div className="plan-dots flex flex-col gap-3.5 rounded-2xl border bg-card p-3.5 sm:p-5">
                  <div className={cn(mono, "flex justify-between gap-3 text-muted-foreground")}>
                    <span className="basis-[38%]">Agent step</span>
                    <span className="basis-[52%]">What it found</span>
                  </div>
                  <ol className="relative flex flex-col gap-2.5">
                    <li aria-hidden="true" className="absolute top-5 bottom-5 left-[18px] w-0.5 bg-border" />
                    {ANALYSIS_ROWS.map((row, i) => {
                      const t = 0.4 + i * 0.8;
                      const color = KIND_COLOR[row.kind];
                      return (
                        <li key={row.step} className="relative flex items-center">
                          <div style={delay(t)} className={cn(s.rise, "flex min-w-0 basis-[38%] items-center gap-2 rounded-[18px] border bg-background py-2 pr-3 pl-2 text-sm leading-tight font-medium")}>
                            <span aria-hidden="true" className="grid size-[22px] shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: color }}>
                              <Check className="size-3.5" strokeWidth={3.5} />
                            </span>
                            {row.step}
                          </div>
                          <div aria-hidden="true" className="relative h-2.5 min-w-3 flex-1">
                            <div
                              className={cn(s.growX, "absolute inset-x-0 top-1")}
                              style={{ ...delay(t + 0.3), ...(row.kind === "missing" ? { borderTop: `2px dashed ${color}` } : { height: 2, backgroundColor: color }) }}
                            />
                            <span className={cn(s.pop, "absolute top-px -right-1 size-2 rounded-full")} style={{ ...delay(t + 0.6), backgroundColor: color }} />
                          </div>
                          <div style={{ ...delay(t + 0.6), borderColor: color }} className={cn(s.rise, "flex min-w-0 basis-[52%] flex-col items-start gap-1.5 rounded-[14px] border bg-card px-3 py-2.5")}>
                            <span className="text-sm leading-snug">{row.claim}</span>
                            <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-background px-2.5 text-xs">
                              <Glyph kind={row.kind} />
                              {KIND_LABEL[row.kind]} · {row.source}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <div style={delay(4.9)} className={cn(s.rise, "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-foreground px-4 py-3 text-background")}>
                    <div className="flex min-w-0 items-baseline gap-2.5">
                      <span className="font-mono text-sm text-[#7fd0b5]">Ranked 1</span>
                      <h3 className="text-base leading-snug font-semibold">Restaurant or bar, second-generation space</h3>
                    </div>
                    <span className="inline-flex min-h-6 items-center rounded-full border border-background/40 px-2.5 text-xs">Example output, not a real analysis</span>
                  </div>
                </div>
              </Replay>
            </Feature>
          </Page>

          <Page {...page(5)}>
            <div className="flex flex-wrap items-start gap-x-16 gap-y-6">
              <div className={cn(s.rv, "flex min-w-0 flex-[1_1_300px] flex-col gap-3.5")}>
                <SectionLabel>{SECTIONS[5].label}</SectionLabel>
                <h2 className="text-2xl font-bold tracking-tight text-balance">Change the numbers. The maths stays visible.</h2>
                <p className="text-base text-[#3a4541]">
                  Leasing and buying are worked out separately. Every figure is labelled with where it came from, next to
                  nearby advertised rents for market context.
                </p>
                <p className="text-sm text-muted-foreground">Illustrative scenario from labelled assumptions. Not a forecast, appraisal or investment advice.</p>
              </div>
              <div className={cn(s.rv, s.rv2, "min-w-0 flex-[2_1_320px]")}>
                <Replay {...page(5)}>
                  <div className="flex flex-wrap gap-x-6 gap-y-4">
                    <div className="flex min-w-0 flex-[1_1_260px] flex-col border bg-card p-5 text-sm">
                      <h3 className="mb-2 text-lg font-semibold">Lease</h3>
                      <Row label="Space" origin="CoStar" value={sf(SUITE.advertisedSf)} />
                      <Row label="Asking rent" origin="CoStar" value={`$${SUITE.rentPsfYear}/SF/yr NNN`} />
                      <Field id="home-nnn" label="Pass-through costs" placeholder="$/SF/yr" />
                      <div style={delay(0.7)} className={cn(s.rise, "flex flex-col gap-0.5 border-t-2 border-foreground pt-3")}>
                        <span className="text-muted-foreground">
                          Base rent per year = {sf(SUITE.advertisedSf)} × ${SUITE.rentPsfYear}
                        </span>
                        <span className="font-mono text-xl font-medium">{usd(baseRentPerYear)}</span>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-[1_1_260px] flex-col border bg-card p-5 text-sm">
                      <h3 className="mb-2 text-lg font-semibold">Buy</h3>
                      <Field id="home-price" label="Purchase price" placeholder="$" />
                      <div className="flex items-center justify-between gap-3 border-t py-2">
                        <span>Asking sale price</span>
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Glyph kind="missing" />
                          {KIND_LABEL.missing}
                        </span>
                      </div>
                      <div style={delay(1)} className={cn(s.rise, "mt-auto flex flex-col gap-0.5 border-t-2 border-foreground pt-3")}>
                        <span className="text-muted-foreground">Result</span>
                        <span className="text-base">Stays blank until you enter a price.</span>
                      </div>
                    </div>
                  </div>
                </Replay>
              </div>
            </div>
          </Page>

          <Page {...page(6)}>
            <div className={cn(s.rv, "mt-auto flex max-w-[40rem] flex-col gap-3.5")}>
              <SectionLabel>{SECTIONS[6].label}</SectionLabel>
              <h2 className={h2}>One property. Three ways in.</h2>
              <p className={lead}>
                Start with a property, an idea or your capital. Each path runs the same agent on the same data and shows
                the same evidence.
              </p>
            </div>
            <div className={cn(s.rv, s.rv2, "mt-6 mb-auto flex flex-col")}>
              <p className={cn(mono, "border-t border-[var(--plan-ink)] py-2 leading-normal")}>
                {SUITE.address}, {SUITE.city} · {SUITE.suite} · {sf(SUITE.advertisedSf)} advertised
              </p>
              <Replay {...page(6)}>
                <div className="flex flex-wrap gap-px border border-foreground bg-foreground">
                  {PATHS.map((p) => {
                    const dark = p.id === "investor";
                    return (
                      <article key={p.id} className={cn("flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 p-6", dark ? "bg-foreground text-background" : p.id === "founder" ? "bg-muted" : "bg-card")}>
                        <PathDrawing id={p.id} />
                        <p className={cn(mono, dark ? "text-[#7fd0b5]" : "text-primary")}>{p.caption}</p>
                        <h3 className="font-heading text-2xl leading-tight font-bold tracking-tight [font-stretch:112%]">{p.name}</h3>
                        <p className="text-base">{p.start}</p>
                        <p className={cn("mb-2 text-base", dark ? "text-background/75" : "text-muted-foreground")}>{p.get}</p>
                        <Link href={p.href} className={cn(buttonVariants(), "mt-auto h-11 w-fit px-4", dark && "bg-background text-foreground hover:bg-background/90")}>
                          {p.action}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </Replay>
            </div>
            <footer className="mt-6 border-t border-foreground/15 pt-4">
              <p className="max-w-[40rem] text-sm text-muted-foreground">{FOOTER_NOTE}</p>
            </footer>
          </Page>
        </div>
      </div>

      <button
        type="button"
        onClick={() => glideTo(last ? 0 : cur + 1)}
        aria-label={last ? "Back to the top" : "Go to the next section"}
        className={cn(s.bob, "absolute bottom-4 left-1/2 z-10 -ml-6 grid size-12 place-items-center rounded-full text-foreground")}
      >
        <ArrowDown className={cn("size-7", last && "rotate-180")} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

type PageProps = { index: number; cur: number; run: number; setRef: (el: HTMLElement | null) => void };

/** One full-screen section, with its tick and label on the spine. */
function Page({ index, cur, setRef, children }: PageProps & { children: React.ReactNode }) {
  const { id, label, accent } = SECTIONS[index];
  const on = index === cur;
  return (
    <section id={id} ref={setRef} data-index={index} data-cur={on} className={cn(s.page, "relative flex min-h-dvh flex-col justify-center px-4 pt-24 pb-14 sm:px-8")}>
      <div aria-hidden="true" className="absolute top-0 left-[calc(50%-39.5rem)] hidden min-[1300px]:block">
        <div className={cn(s.tick, "h-px")} style={{ width: on ? 29 : 17, backgroundColor: on ? accent : "var(--plan-ink)" }} />
        <p className={cn(mono, "mt-4 -ml-6 rotate-180 text-muted-foreground [writing-mode:vertical-rl]")}>{label}</p>
      </div>
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col justify-center">{children}</div>
    </section>
  );
}

/** Remounts its children each time the section's animation should start again. */
function Replay({ index, cur, run, children }: Omit<PageProps, "setRef"> & { children: React.ReactNode }) {
  return <div key={index === cur ? `run-${run}` : "rest"}>{children}</div>;
}

/** Section name for widths where the spine is hidden. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className={cn(mono, "text-muted-foreground min-[1300px]:hidden")}>{children}</p>;
}

/** Text on one side, the feature's animation on the other. They stack on narrow screens. */
function Feature({
  heading,
  body,
  note: footnote,
  label,
  flip,
  top,
  extra,
  children,
}: {
  heading: string;
  body: string;
  note?: string;
  label: string;
  flip?: boolean;
  top?: boolean;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-16 gap-y-7", flip && "flex-row-reverse", top ? "items-start" : "items-center")}>
      <div className={cn(s.rv, "flex min-w-0 flex-[1_1_340px] flex-col gap-5")}>
        <SectionLabel>{label}</SectionLabel>
        <h2 className={h2}>{heading}</h2>
        <p className={lead}>{body}</p>
        {footnote && <p className={note}>{footnote}</p>}
        {extra}
      </div>
      <div className={cn(s.rv, s.rv2, "min-w-0 flex-[1.6_1_320px]")}>{children}</div>
    </div>
  );
}

/** Evidence kinds differ by shape as well as colour, and are always named in text beside this. */
function Glyph({ kind }: { kind: EvidenceKind }) {
  const shape = {
    verified_fact: "size-2.5 rounded-[3px] bg-primary",
    ai_observation: "size-2.5 rounded-full border-2 border-info",
    user_assumption: "size-2.5 rotate-45 border-2 border-foreground",
    missing: "size-2.5 rounded-[2px] border-2 border-dashed border-muted-foreground",
  }[kind];
  return <span aria-hidden="true" className={cn("block shrink-0", shape)} />;
}

function Row({ label, origin, value }: { label: string; origin: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t py-2">
      <span>
        {label} <span className="text-muted-foreground">· {origin}</span>
      </span>
      <span className="font-mono whitespace-nowrap">{value}</span>
    </div>
  );
}

function Field({ id, label, placeholder }: { id: string; label: string; placeholder: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t py-1">
      <label htmlFor={id}>
        {label} <span className="text-muted-foreground">· {KIND_LABEL.user_assumption}</span>
      </label>
      <input id={id} type="text" inputMode="decimal" placeholder={placeholder} className="h-11 w-24 shrink-0 rounded-lg border border-muted-foreground bg-card px-2.5 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </div>
  );
}

/** The same suite outline, read three ways. */
function PathDrawing({ id }: { id: (typeof PATHS)[number]["id"] }) {
  const stroke = id === "investor" ? "var(--background)" : "currentColor";
  const label =
    id === "owner"
      ? "Suite 100 plan with the whole suite filled"
      : id === "founder"
        ? "Suite 100 plan with a dashed box for the space a business needs"
        : "Suite 100 plan divided into a lease half and a buy half";
  return (
    <svg viewBox="0 0 316 150" role="img" aria-label={label} className="h-auto w-full max-w-60">
      {id === "owner" && <path className={s.growX} d={SUITE_OUTLINE} fill="var(--primary)" fillOpacity={0.2} style={{ ...delay(0.5), transformBox: "fill-box" }} />}
      <path d={SUITE_OUTLINE} stroke={stroke} strokeWidth={2} fill="none" />
      {id === "founder" && (
        <rect className={s.slideIn} x={24} y={66} width={150} height={62} fill="var(--primary)" fillOpacity={0.2} stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" style={{ ...delay(1.1), transformBox: "fill-box" }} />
      )}
      {id === "investor" && (
        <>
          <path className={s.draw} pathLength={1} d="M158 10 V140" stroke="#7fd0b5" strokeWidth={2} fill="none" style={delay(1.8)} />
          <text className={cn(s.rise, "font-mono text-[13px]")} x={83} y={82} textAnchor="middle" fill={stroke} style={delay(2.4)}>
            Lease
          </text>
          <text className={cn(s.rise, "font-mono text-[13px]")} x={232} y={104} textAnchor="middle" fill={stroke} style={delay(2.6)}>
            Buy
          </text>
        </>
      )}
    </svg>
  );
}

/** Drawn stand-in for a Vexcel image. The credit line stays on it, as it must on the real one. */
function AerialTile({ caption, label, oblique }: { caption: string; label: string; oblique?: boolean }) {
  return (
    <figure className="flex flex-col gap-2.5">
      <div className="relative aspect-square overflow-hidden bg-[#c9d0cb]">
        <div className={cn("size-full", oblique && s.tilt)} style={oblique ? { ...delay(0.5), transformOrigin: "center 70%", transform: "perspective(900px) rotateX(54deg) scale(1.5)" } : undefined}>
          <svg viewBox="0 0 316 316" role="img" aria-label={label} className="block size-full">
            <rect width={316} height={316} fill="#dfe3df" />
            <path d="M0 104H316M0 212H316M104 0V316M212 0V316" stroke="#f4f5f3" strokeWidth={18} />
            <path fill="#b9c1bb" d="M14 14h74v40H14zM14 62h34v26H14zM228 16h70v72h-70zM16 126h72v70H16zM228 124h34v74h-34zM270 124h30v40h-30zM16 230h40v70H16zM122 232h74v34h-74zM230 232h68v68h-68zM122 16h74v30h-74z" />
            <rect x={122} y={122} width={72} height={72} fill="var(--primary)" fillOpacity={0.18} stroke="var(--primary)" strokeWidth={3} />
          </svg>
        </div>
        <span className="absolute inset-x-0 bottom-0 bg-scrim px-2 py-1 text-[11px] leading-[14px] text-scrim-foreground">© Vexcel Imaging US, Inc.</span>
      </div>
      <figcaption className="text-sm font-medium">{caption}</figcaption>
    </figure>
  );
}

// A tesseract drawn as two offset squares joined at the corners (same mark as SiteHeader).
function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 text-primary" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <rect x="3" y="7" width="13" height="13" rx="1.5" />
      <rect x="8" y="3" width="13" height="13" rx="1.5" />
      <path d="M3 7 8 3M16 7l5-4M3 20l5-4M16 20l5-4" />
    </svg>
  );
}
