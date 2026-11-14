"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PropertiesError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);

  return (
    <div role="alert" className="rounded-2xl border bg-card px-5 py-8 text-center">
      <p className="text-lg font-semibold">Property data didn’t load</p>
      <p className="mx-auto mt-1 max-w-sm text-base text-muted-foreground">
        The property service returned an error. Check that the dev server and data API are running, then try again.
      </p>
      <Button onClick={() => retry()} className="mt-4 h-11 rounded-xl px-5 text-lg">
        Try again
      </Button>
    </div>
  );
}
