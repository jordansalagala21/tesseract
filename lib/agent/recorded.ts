/**
 * Recorded demo runs (INT-07). OWNER: Developer 1.
 *
 * A real analysis captured earlier with `npm run demo:check -- --capture`, replayed if the live
 * agent is slow on venue Wi-Fi. The file lives in data/demo/ (gitignored: it holds sponsor
 * data) and is served only under a `rec_` id, with a disclaimer saying when it was captured,
 * so it can never pass as a live run.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AnalysisResponse } from "@/lib/contracts";

const ID = /^rec_[a-z0-9_-]{1,60}$/;

export const recordedPath = (id: string) => path.join(process.cwd(), "data", "demo", `${id}.json`);

export function isRecordedId(id: string): boolean {
  return ID.test(id);
}

/** The recorded run for `id`, marked as recorded, or null if there isn't one. */
export async function loadRecorded(id: string): Promise<AnalysisResponse | null> {
  if (!isRecordedId(id)) return null; // also keeps the id from walking out of data/demo
  let raw: string;
  try {
    raw = await readFile(recordedPath(id), "utf8");
  } catch {
    return null;
  }
  const parsed = AnalysisResponse.safeParse(JSON.parse(raw));
  if (!parsed.success) return null;
  const a = parsed.data;
  const when = (a.completedAt ?? a.createdAt).slice(0, 16).replace("T", " ");
  return {
    ...a,
    id,
    disclaimers: [`Recorded run captured ${when} UTC from live data, replayed here. It is not running now.`, ...a.disclaimers],
  };
}
