"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PropertiesError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);

  return (
    <div role="alert" className="rounded-[20px] border bg-card px-5 py-8 text-center">
      <p className="text-[17px] font-semibold">Property data didn’t load</p>
      <p className="mx-auto mt-1 max-w-sm text-[15px] text-muted-foreground">
        The property service returned an error. Check that the dev server and data API are running, then try again.
      </p>
      <Button onClick={() => retry()} className="mt-4 h-11 rounded-xl px-5 text-[17px]">
        Try again
      </Button>
    </div>
  );
}
