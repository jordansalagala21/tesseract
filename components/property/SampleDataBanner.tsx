// Shown whenever a page falls back to the contract fixtures, so sample data is never mistaken for live output.
export function SampleDataBanner() {
  return (
    <p role="note" className="rounded-2xl border border-dashed border-muted-foreground/40 px-4 py-3 text-[15px] leading-snug text-muted-foreground">
      <span className="font-semibold text-foreground">Sample data.</span> The property API isn’t connected yet, so this
      page shows the 2600 Travis St development fixture, not live CoStar output.
    </p>
  );
}
