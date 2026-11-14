import { Skeleton } from "@/components/ui/states";

// Shown while one property loads. Same layout as the page: tour and facts, then the spaces list.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading property" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        <Skeleton className="aspect-[4/3] w-full rounded-2xl sm:aspect-video" />
        <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-2 gap-6">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex justify-between gap-6 border-b p-5 last:border-0">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <Skeleton className="h-5 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
