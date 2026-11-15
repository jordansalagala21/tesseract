import { Suspense } from "react";
import type { Metadata } from "next";
import { InvestorForm } from "@/components/forms/InvestorForm";
import { IntakeOrForm } from "@/components/intake/IntakeOrForm";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "Build my investment brief | Tesseract" };

// The investor's page: the Tesseract asks about capital, strategy and risk, then starts the agents.
export default function InvestPage({ searchParams }: PageProps<"/invest">) {
  return (
    <PageShell>
      <h1 className="sr-only">Build my investment brief: buildings to buy and spaces to lease</h1>
      <Suspense>
        <IntakeOrForm persona="investor" path="/invest" searchParams={searchParams} form={<InvestorForm />} />
      </Suspense>
    </PageShell>
  );
}
