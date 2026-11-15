import type { Metadata } from "next";
import { InvestPlanner } from "@/components/forms/InvestPlanner";
import { PageHeader, PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "I have capital | Tesseract" };

export default function InvestPage() {
  return (
    <PageShell>
      <PageHeader
        title="I have capital"
        description="Find buildings to buy and spaces to lease in Houston and Los Angeles, with the evidence for each one."
      />
      <InvestPlanner />
    </PageShell>
  );
}
