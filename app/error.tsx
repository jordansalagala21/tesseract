"use client";

import { useEffect } from "react";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);

  return (
    <div className="mx-auto w-full max-w-page px-4 py-16 sm:px-8">
      <EmptyState role="alert" icon={CloudOff} title="Something didn’t load" action={<Button onClick={() => retry()}>Try again</Button>}>
        Part of this page couldn’t load. Try again in a moment.
      </EmptyState>
    </div>
  );
}
