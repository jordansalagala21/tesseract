import { describe, expect, it } from "vitest";
import { groupOpportunities, scoreText } from "@/components/analysis/opportunity-format";
import { travisAnalysisFixture } from "@/lib/contracts/examples/travis";

const lease = travisAnalysisFixture.opportunities[0];
const buy = { ...lease, id: "opp_buy", rank: 2, strategy: "acquisition" as const };

describe("opportunity reveal rules", () => {
  it("never shows a number for a missing score", () => {
    expect(scoreText(null)).toBe("Insufficient evidence");
    expect(scoreText(0)).toBe("0");
    expect(scoreText(79.6)).toBe("80");
  });

  it("keeps acquisition and lease apart for investors", () => {
    const groups = groupOpportunities([lease, buy], "investor");
    expect(groups.map((g) => g.title)).toEqual(["Buy the property", "Lease or reposition"]);
    expect(groups[0].items.map((o) => o.id)).toEqual(["opp_buy"]);
  });

  it("shows one ranked list for owners and entrepreneurs", () => {
    for (const persona of ["owner", "entrepreneur"] as const) {
      const [group, ...rest] = groupOpportunities([buy, lease], persona);
      expect(rest).toEqual([]);
      expect(group.title).toBeNull();
      expect(group.items.map((o) => o.rank)).toEqual([1, 2]);
    }
  });
});
