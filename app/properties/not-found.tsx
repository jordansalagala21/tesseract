import Link from "next/link";

export default function PropertyNotFound() {
  return (
    <div className="rounded-2xl border bg-card px-5 py-8 text-center">
      <p className="text-lg font-semibold">No property with that ID</p>
      <p className="mt-1 text-base text-muted-foreground">It isn’t in the CoStar dataset Tesseract covers.</p>
      <Link href="/properties" className="mt-4 inline-block rounded-md text-lg font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Search properties
      </Link>
    </div>
  );
}
