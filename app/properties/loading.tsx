import { Skeleton } from "@/components/ui/states";

// Shown while the property search loads. Mirrors the real page so nothing jumps when it arrives.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading properties" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2.5 border-b p-5 last:border-0">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
