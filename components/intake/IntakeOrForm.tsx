import Link from "next/link";
import type { UserPersona } from "@/lib/contracts";
import { GuidedIntake } from "./GuidedIntake";

const linkClass = "inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline";

/**
 * The Tesseract's questions, or the plain form for people who prefer one (`?form=1`).
 * Both send the same request to the agent.
 */
export async function IntakeOrForm({ persona, path, searchParams, form }: { persona: UserPersona; path: string; searchParams: Promise<Record<string, string | string[] | undefined>>; form: React.ReactNode }) {
  const sp = await searchParams;
  if (sp.form === "1") {
    return (
      <div className="mx-auto flex w-full max-w-form flex-col gap-4">
        {form}
        <Link href={path} className={linkClass}>
          Back to the Tesseract
        </Link>
      </div>
    );
  }
  return (
    <GuidedIntake
      persona={persona}
      alternative={
        <Link href={`${path}?form=1`} className={linkClass}>
          Use the full form
        </Link>
      }
    />
  );
}
