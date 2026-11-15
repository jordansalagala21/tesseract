import { Suspense } from "react";
import type { Metadata } from "next";
import { EntrepreneurForm } from "@/components/forms/EntrepreneurForm";
import { IntakeOrForm } from "@/components/intake/IntakeOrForm";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "Find my business space | Tesseract" };

// The founder's page: the Tesseract asks about the business, size and budget, then starts the agents.
export default function StartPage({ searchParams }: PageProps<"/start">) {
  return (
    <PageShell>
      <h1 className="sr-only">Find my business space: advertised spaces that fit your idea</h1>
      <Suspense>
        <IntakeOrForm persona="entrepreneur" path="/start" searchParams={searchParams} form={<EntrepreneurForm />} />
      </Suspense>
    </PageShell>
  );
}
