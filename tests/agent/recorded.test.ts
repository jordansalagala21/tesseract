import { mkdir, rm, writeFile } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import { travisAnalysisFixture } from "@/lib/contracts/examples/travis";
import { isRecordedId, loadRecorded, recordedPath } from "@/lib/agent/recorded";

const ID = "rec_vitest_fixture";
afterAll(async () => {
  await rm(recordedPath(ID), { force: true });
});

describe("recorded demo runs", () => {
  it("accepts only rec_ ids, so a request can't read outside data/demo", () => {
    expect(isRecordedId("rec_travis_owner")).toBe(true);
    for (const bad of ["ana_123", "rec_../../.env.local", "rec_a/b", "../rec_x", "rec_"]) expect(isRecordedId(bad)).toBe(false);
  });

  it("returns null when there is no recording", async () => {
    expect(await loadRecorded("rec_does_not_exist")).toBeNull();
    expect(await loadRecorded("rec_../../package")).toBeNull();
  });

  it("serves a recording under its rec_ id, marked as recorded with its capture time", async () => {
    await mkdir(recordedPath(ID).replace(/[^/]+$/, ""), { recursive: true });
    await writeFile(recordedPath(ID), JSON.stringify({ ...travisAnalysisFixture, completedAt: "2026-11-15T01:58:00.000Z" }));
    const r = await loadRecorded(ID);
    expect(r?.id).toBe(ID);
    expect(r?.disclaimers[0]).toBe("Recorded run captured 2026-11-15 01:58 UTC from live data, replayed here. It is not running now.");
  });
});
