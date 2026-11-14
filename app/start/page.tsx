import type { Metadata } from "next";
import { EntrepreneurForm } from "@/components/forms/EntrepreneurForm";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = { title: "I have an idea | Tesseract" };

export default function StartPage() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 sm:px-8">
      <SiteHeader />
      <main className="flex flex-col gap-8 pt-6 pb-16 sm:pt-10">
        <div>
          <h1 className="font-heading text-[34px] leading-tight font-bold tracking-tight [font-stretch:112%]">I have an idea</h1>
          <p className="mt-2 text-[17px] leading-relaxed text-muted-foreground">
            Describe the business and your budget. The agent searches advertised spaces and ranks the ones that fit, with
            3D tours where they exist.
          </p>
        </div>
        <EntrepreneurForm />
      </main>
    </div>
  );
}
