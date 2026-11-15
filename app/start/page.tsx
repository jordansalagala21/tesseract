import type { Metadata } from "next";
import { EntrepreneurForm } from "@/components/forms/EntrepreneurForm";
import { PageHeader, PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "I have an idea | Tesseract" };

export default function StartPage() {
  return (
    <PageShell>
      <div className="flex w-full max-w-form flex-col gap-10">
        <PageHeader
          title="I have an idea"
          description="Describe the business and your budget. The agent searches advertised spaces and ranks the ones that fit, with 3D tours where they exist."
        />
        <EntrepreneurForm />
      </div>
    </PageShell>
  );
}
