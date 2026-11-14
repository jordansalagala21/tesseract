import type { Metadata } from "next";
import { InvestorForm } from "@/components/forms/InvestorForm";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = { title: "I have capital | Tesseract" };

export default function InvestPage() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 sm:px-8">
      <SiteHeader />
      <main className="flex flex-col gap-8 pt-6 pb-16 sm:pt-10">
        <div>
          <h1 className="font-heading text-[34px] leading-tight font-bold tracking-tight [font-stretch:112%]">I have capital</h1>
          <p className="mt-2 text-[17px] leading-relaxed text-muted-foreground">
            Tell us what you can invest. The agent screens listed buildings in Houston and Los Angeles and pairs them with
            uses that could pay, with buying and leasing kept separate.
          </p>
        </div>
        <InvestorForm />
      </main>
    </div>
  );
}
