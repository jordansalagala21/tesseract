import type { Metadata } from "next";
import Link from "next/link";
import { GuidedIntake } from "@/components/intake/GuidedIntake";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "Explore my property | Tesseract" };

// The owner's page: the Tesseract asks which building and what matters, then starts the agents.
export default function ExplorePage() {
  return (
    <PageShell>
      <h1 className="sr-only">Explore my property: what could this space become?</h1>
      <GuidedIntake
        persona="owner"
        alternative={
          <Link href="/properties" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
            Browse all properties instead
          </Link>
        }
      />
    </PageShell>
  );
}
