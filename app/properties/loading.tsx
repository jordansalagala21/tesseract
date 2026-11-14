// Skeleton shown while property data loads (search and detail pages).
export default function Loading() {
  const bar = "rounded-lg bg-muted motion-safe:animate-pulse";
  return (
    <div role="status" aria-label="Loading property data" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className={`${bar} h-9 w-64`} />
        <div className={`${bar} h-5 w-full max-w-md`} />
      </div>
      <div className="flex flex-col overflow-hidden rounded-[20px] border bg-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 border-b px-5 py-5 last:border-0">
            <div className={`${bar} h-5 w-48`} />
            <div className={`${bar} h-4 w-72 max-w-full`} />
          </div>
        ))}
      </div>
    </div>
  );
}
