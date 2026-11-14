import { describe, expect, it } from "vitest";
import { aerialLabel, formatCaptureRange, formatGsd } from "@/components/viewer/aerial-format";
import { travisOrtho } from "@/lib/contracts/examples/travis";

describe("aerial imagery labels", () => {
  it("names the view", () => {
    expect(aerialLabel(travisOrtho)).toBe("Top-down");
    expect(aerialLabel({ kind: "oblique", direction: "north" })).toBe("Looking north");
    expect(aerialLabel({ kind: "oblique", direction: null })).toBe("Angled");
  });

  it("formats the capture window and resolution", () => {
    expect(formatCaptureRange(travisOrtho.captureDate)).toBe("Dec 19, 2025 – Jan 2, 2026");
    expect(formatCaptureRange({ first: "2026-01-02", last: "2026-01-02" })).toBe("Jan 2, 2026");
    expect(formatGsd(travisOrtho.gsdMeters)).toBe("7.2–7.9 cm per pixel");
    expect(formatGsd({ min: 0.056, max: 0.056 })).toBe("5.6 cm per pixel");
  });
});
