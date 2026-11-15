import { describe, expect, it } from "vitest";
import { ANALYSIS_ROWS, FOOTER_NOTE, KIND_LEGEND, PATHS, SECTIONS, SOURCES, SUITE, baseRentPerYear, replayMs } from "@/components/home/home-content";

const allCopy = JSON.stringify({ ANALYSIS_ROWS, FOOTER_NOTE, KIND_LEGEND, PATHS, SECTIONS, SOURCES });

describe("main page content", () => {
  it("never calls advertised space vacant", () => {
    expect(allCopy.replace(/not confirmed vacancy/g, "")).not.toMatch(/vacan/i);
  });

  it("labels the four evidence kinds by name, in the Evidence Trail order", () => {
    expect(KIND_LEGEND.map((k) => k.label)).toEqual(["Verified fact", "AI observation", "Your assumption", "Missing information"]);
    expect(new Set(ANALYSIS_ROWS.map((r) => r.kind)).size).toBe(4);
  });

  it("derives base rent from the advertised size and asking rent", () => {
    expect(baseRentPerYear).toBe(445005);
    expect(SUITE.scannedSf).toBeLessThan(SUITE.advertisedSf);
  });

  it("sends each path to its own route", () => {
    expect(PATHS.map((p) => p.href)).toEqual(["/properties", "/start", "/invest"]);
  });

  it("replays animations every 5 s, and the longer analysis sequence every 9 s", () => {
    expect(replayMs("tour")).toBe(5000);
    expect(replayMs("analysis")).toBe(9000);
  });
});
