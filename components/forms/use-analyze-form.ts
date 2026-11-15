"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { AnalyzeAcceptedResponse, type PersonaInput } from "@/lib/contracts";
import type { Checked } from "./form-logic";

export type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "started"; analysisId: string }
  | { kind: "not_ready"; issue: string }
  | { kind: "failed"; message: string };

/**
 * Validates on submit, then again on every change once the first submit has shown errors, so
 * fixed fields clear right away. A valid form is sent to POST /api/analyze as an AnalysisRequest.
 */
export function useAnalyzeForm<T extends PersonaInput>(check: (fd: FormData) => Checked<T>) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const router = useRouter();

  function onChange(e: React.FormEvent<HTMLFormElement>) {
    if (tried) setErrors(check(new FormData(e.currentTarget)).errors);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const { data, errors } = check(new FormData(form));
    // flushSync draws the error markers now, so focus can move to the first one right after.
    flushSync(() => {
      setTried(true);
      setErrors(errors);
    });
    if (!data) {
      // Land keyboard and screen reader users on the first problem.
      (form.querySelector('[aria-invalid="true"], fieldset[aria-describedby] input') as HTMLElement | null)?.focus();
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: data }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 501) return setState({ kind: "not_ready", issue: body?.error?.issue ?? "AI-01" });
      const accepted = AnalyzeAcceptedResponse.safeParse(body);
      if (!res.ok || !accepted.success) {
        return setState({ kind: "failed", message: body?.error?.message ?? `The analysis service answered ${res.status}.` });
      }
      setState({ kind: "started", analysisId: accepted.data.analysisId });
      // Open the live results page (INT-04); the agent keeps working on the server.
      router.push(`/analysis/${accepted.data.analysisId}`);
    } catch {
      setState({ kind: "failed", message: "The analysis service couldn’t be reached. Check your connection and try again." });
    }
  }

  return { errors, state, onChange, onSubmit };
}
