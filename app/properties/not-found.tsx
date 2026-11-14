import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function PropertyNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="We couldn’t find that property"
      action={
        <Link href="/properties" className={buttonVariants({ variant: "outline" })}>
          Search properties
        </Link>
      }
    >
      It isn’t in the CoStar dataset Tesseract covers (Houston and Los Angeles).
    </EmptyState>
  );
}
