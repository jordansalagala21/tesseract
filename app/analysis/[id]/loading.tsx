import { PageShell } from "@/components/site/PageShell";
import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <PageShell>
      <div role="status" aria-label="Loading analysis" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </PageShell>
  );
}
