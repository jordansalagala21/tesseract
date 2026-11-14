"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Evidence } from "@/lib/contracts";
import { EvidenceTrail } from "./EvidenceTrail";

/**
 * The Evidence Trail as a side drawer (a native modal dialog: focus is trapped, Escape closes it).
 * The trail renders only while open, so element ids never repeat when a page has several drawers.
 */
export function EvidenceDrawer({
  open,
  onClose,
  evidence,
  evidenceIndex,
  selectedId,
}: {
  open: boolean;
  onClose: () => void;
  evidence: Evidence[];
  evidenceIndex?: Parameters<typeof EvidenceTrail>[0]["evidenceIndex"];
  selectedId?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Bring the chosen item into view once the trail has rendered.
  useEffect(() => {
    if (!open || !selectedId) return;
    document.getElementById(`evidence-${selectedId}`)?.scrollIntoView({ block: "center" });
  }, [open, selectedId]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="evidence-drawer-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-xl overflow-hidden border-l bg-background p-0 text-foreground backdrop:bg-scrim sm:rounded-l-2xl"
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <h2 id="evidence-drawer-title" className="text-xl font-semibold tracking-tight">
                Evidence Trail
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{evidence.length} statements, each with its source.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Evidence Trail"
              className="grid size-11 shrink-0 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <EvidenceTrail evidence={evidence} evidenceIndex={evidenceIndex} selectedId={selectedId} />
          </div>
        </div>
      )}
    </dialog>
  );
}
