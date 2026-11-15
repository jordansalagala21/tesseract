import { describe, expect, it } from "vitest";
import { formatRent, formatSf, humanize, subtypeLabel, formatPostcode } from "@/components/property/format";

const rent = (low: number | null, high: number | null, serviceType: string | null = "TripleNet") => ({
  low,
  high,
  basis: "yearly" as const,
  psfYearLow: low,
  psfYearHigh: high,
  serviceType,
});

describe("property formatting", () => {
  it("labels enums for people", () => {
    expect(humanize("GeneralRetail")).toBe("General retail");
    expect(humanize("FirstFloor")).toBe("First floor");
    expect(subtypeLabel("GeneralRetail_Freestanding")).toBe("Freestanding");
    expect(humanize(null)).toBeNull();
  });

  it("formats square footage as a value or a range", () => {
    expect(formatSf(9889)).toBe("9,889 SF");
    expect(formatSf(2554, 4681)).toBe("2,554–4,681 SF");
    expect(formatSf(null, null)).toBeNull();
  });

  it("keeps the service type and never invents a rate", () => {
    expect(formatRent(rent(45, 45))).toBe("$45/SF/yr NNN");
    expect(formatRent(rent(37, 45))).toBe("$37–45/SF/yr NNN");
    expect(formatRent(rent(30.5, 30.5, "FullServiceGross"))).toBe("$30.5/SF/yr full service gross");
    expect(formatRent(rent(null, null))).toBeNull();
  });
});

describe("postcode", () => {
  it("adds the ZIP+4 hyphen and leaves other codes alone", () => {
    expect([formatPostcode("770063540"), formatPostcode("77006"), formatPostcode(null)]).toEqual(["77006-3540", "77006", ""]);
  });
});
