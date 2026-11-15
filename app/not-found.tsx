import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageShell } from "@/components/site/PageShell";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <PageShell>
      <EmptyState
        icon={SearchX}
        title="This page doesn’t exist"
        action={
          <Link href="/" className={buttonVariants()}>
            Go to the home page
          </Link>
        }
      >
        Check the address, or start again from the home page.
      </EmptyState>
    </PageShell>
  );
}
