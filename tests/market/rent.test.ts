import { describe, expect, it } from "vitest";
import { comparableRentFor, describeRange, ratedGroups, roundRange } from "@/lib/market/rent";
import { LA_GROUPS, TRAVIS_1000 } from "./nearby-fixtures";

const travis = TRAVIS_1000.comparableSpaces.rentGroups;

describe("comparableRentFor", () => {
  it("matches only the same serviceType AND spaceUse", () => {
    const r = comparableRentFor(LA_GROUPS, { serviceType: "ModifiedGross", spaceUse: "Retail" });
    expect(r.status).toBe("matched");
    expect(r.status === "matched" && r.group.askingRentPsfYear.median).toBeCloseTo(28.2);
  });

  it("does not borrow an office rent for a retail space (2600 Travis, real kit groups)", () => {
    expect(comparableRentFor(travis, { serviceType: "TripleNet", spaceUse: "Retail" })).toEqual({ status: "no_matching_group" });
  });

  it("reports a matching group that publishes no rate", () => {
    const r = comparableRentFor(travis, { serviceType: "ToBeDetermined", spaceUse: "Retail" });
    expect(r.status).toBe("no_published_rate");
    expect(r.status === "no_published_rate" && r.group.count).toBe(3);
  });

  it("refuses to pick a comparable when the subject's basis is unknown", () => {
    expect(comparableRentFor(travis, { spaceUse: "Retail" })).toEqual({ status: "unknown_subject" });
    expect(comparableRentFor(travis, {})).toEqual({ status: "unknown_subject" });
  });
});

describe("rent helpers", () => {
  it("keeps only groups with a published rate, largest sample first", () => {
    expect(ratedGroups(travis).map((g) => `${g.serviceType} ${g.spaceUse}`)).toEqual(["TripleNet Office"]);
    expect(ratedGroups(LA_GROUPS).map((g) => g.withPublishedRate)).toEqual([20, 15, 1, 1]);
  });

  it("rounds DuckDB float noise to cents", () => {
    expect(roundRange(LA_GROUPS[0].askingRentPsfYear)).toEqual({ min: 15, median: 17.7, max: 19.8 });
  });

  it("always states the sample size", () => {
    expect(describeRange(travis[1])).toBe("$18/SF/yr (median $18, 14 of 14 spaces publish a rate)");
    expect(describeRange(LA_GROUPS[0])).toBe("$15–$19.8/SF/yr (median $17.7, 20 of 20 spaces publish a rate)");
  });
});
