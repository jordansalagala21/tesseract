import { describe, expect, it } from "vitest";
import { formatDuration, toolLabel } from "@/components/analysis/timeline-format";

const at = (s: number) => new Date(Date.UTC(2026, 10, 14, 12, 0, 0) + s * 1000).toISOString();

describe("agent timeline formatting", () => {
  it("names tools in plain words", () => {
    expect(toolLabel("get_property_profile")).toBe("Read the CoStar property profile");
    expect(toolLabel("score_uses")).toBe("Score candidate uses");
  });

  it("formats step duration and leaves running steps blank", () => {
    expect(formatDuration({ startedAt: at(0), finishedAt: at(0.8) })).toBe("0.8 s");
    expect(formatDuration({ startedAt: at(0), finishedAt: at(12) })).toBe("12 s");
    expect(formatDuration({ startedAt: at(0), finishedAt: at(65) })).toBe("1 min 5 s");
    expect(formatDuration({ startedAt: at(0), finishedAt: null })).toBeNull();
  });
});
