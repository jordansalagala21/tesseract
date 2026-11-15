import Link from "next/link";
import { CloudOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import type { Unavailable } from "@/app/properties/property-data";

/**
 * Shown in place of a property page or search results when the CoStar data didn't load.
 * The page never falls back to sample data, so this is the only thing a failed load shows.
 * The setup hint is for teammates running the app locally and never appears in production.
 */
export function DataUnavailable({ reason, retryHref }: { reason: Unavailable["reason"]; retryHref: string }) {
  return (
    <EmptyState
      role="alert"
      icon={CloudOff}
      title="Property data isn’t available right now"
      action={
        <Link href={retryHref} prefetch={false} className={buttonVariants({ variant: "outline" })}>
          Try again
        </Link>
      }
    >
      The CoStar property data didn’t load, so there is nothing to show yet. Try again in a moment.
      {reason === "not_set_up" && process.env.NODE_ENV !== "production" && (
        <span className="mt-3 block text-sm">
          Setup: this server has no CoStar database. Set <code>COSTAR_KIT_DIR</code> and run <code>npm run db:build</code>.
        </span>
      )}
    </EmptyState>
  );
}
