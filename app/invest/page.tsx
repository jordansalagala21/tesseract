import type { Metadata } from "next";
import { InvestorForm } from "@/components/forms/InvestorForm";
import { PageHeader, PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "I have capital | Tesseract" };

export default function InvestPage() {
  return (
    <PageShell>
      <div className="flex w-full max-w-form flex-col gap-10">
        <PageHeader
          title="I have capital"
          description="Tell us what you can invest. The agent screens buildings with advertised space in Houston and Los Angeles and pairs them with uses that could pay, with buying and leasing kept separate."
        />
        <InvestorForm />
      </div>
    </PageShell>
  );
}
