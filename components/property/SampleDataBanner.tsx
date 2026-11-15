import { Notice } from "@/components/ui/notice";

// Shown whenever a page falls back to the contract fixtures, so sample data is never mistaken for live output.
export function SampleDataBanner() {
  return (
    <Notice title="Sample data">
      The property API isn’t connected yet, so this page shows the 2600 Travis St development fixture, not live CoStar
      output.
    </Notice>
  );
}
