import { describe, expect, it } from "vitest";
import { bucketEvidence, cleanStatement, formatValue, sourceRows, systemLabel } from "@/components/analysis/evidence-format";
import { travisAnalysisFixture } from "@/lib/contracts/examples/travis";

const { evidence, evidenceIndex } = travisAnalysisFixture;

describe("evidence trail rules", () => {
  it("fills the four buckets in a fixed order from the evidence index", () => {
    const buckets = bucketEvidence(evidence, evidenceIndex);
    expect(buckets.map((b) => b.title)).toEqual(["Verified facts", "AI observations", "Your assumptions", "Missing info"]);
    expect(buckets.map((b) => b.items.length)).toEqual([5, 1, 1, 1]);
    expect(buckets[1].items[0].id).toBe("ev_obs_bar");
  });

  it("falls back to each item's kind when there is no index", () => {
    expect(bucketEvidence(evidence).map((b) => b.items.length)).toEqual([5, 1, 1, 1]);
  });

  it("only lists an item under the bucket its id is indexed in", () => {
    const partial = { ...evidenceIndex, verifiedFactIds: evidenceIndex.verifiedFactIds.slice(1) };
    expect(bucketEvidence(evidence, partial)[0].items).toHaveLength(4);
  });

  it("reads a source as dataset, record and field", () => {
    const ref = (evidence[0] as { sources: Parameters<typeof sourceRows>[0][] }).sources[0];
    expect(systemLabel(ref.system)).toBe("CoStar");
    expect(sourceRows(ref)).toEqual([
      { label: "Dataset", value: "commercial-property" },
      { label: "Record", value: "1018657" },
      { label: "Field", value: "propertyRetail.structural.ceilingHeightFeet" },
    ]);
    expect(sourceRows({ system: "user" })).toEqual([]);
  });

  it("formats values with friendly units and leaves missing values blank", () => {
    expect(formatValue(20, "ft")).toBe("20 ft");
    expect(formatValue(9889, "sf")).toBe("9,889 SF");
    expect(formatValue(8878.9, "sf")).toBe("8,878.9 SF");
    expect(formatValue(45, "usd_psf_year")).toBe("45 $/SF/yr");
    expect(formatValue(null)).toBeNull();
    expect(formatValue(undefined)).toBeNull();
  });

  it("strips the developer fixture marker", () => {
    expect(cleanStatement("FIXTURE-ONLY: Interior photo")).toBe("Interior photo");
    expect(cleanStatement("Ceiling height is recorded as 20 ft")).toBe("Ceiling height is recorded as 20 ft");
  });
});
