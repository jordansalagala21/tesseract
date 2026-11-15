import type { Metadata } from "next";
import { LiveAnalysis } from "@/components/analysis/LiveAnalysis";
import { PageHeader, PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "Analysis · Tesseract" };

// The live analysis page (INT-04). The agent runs on the server; this page polls its progress.
export default async function AnalysisPage({ params }: PageProps<"/analysis/[id]">) {
  const { id } = await params;
  return (
    <PageShell>
      <PageHeader title="What this space could become" description="The agent checks CoStar, the 3D scan, aerial images and the nearby market, and cites every claim." />
      <LiveAnalysis id={id} />
    </PageShell>
  );
}
