"use client";

import { useEffect } from "react";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function PropertiesError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);

  return (
    <EmptyState role="alert" icon={CloudOff} title="This property didn’t load" action={<Button onClick={() => retry()}>Try again</Button>}>
      The property data service didn’t answer. Try again in a moment.
    </EmptyState>
  );
}
