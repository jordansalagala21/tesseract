import type { Metadata } from "next";
import { StageInvest } from "@/components/forms/StageInvest";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "I have capital | Tesseract" };

// A deliberately empty page: Tess slides in and asks the questions one at a time.
export default function InvestPage() {
  return (
    <PageShell>
      <h1 className="sr-only">I have capital: find buildings to buy and spaces to lease</h1>
      <StageInvest />
    </PageShell>
  );
}
