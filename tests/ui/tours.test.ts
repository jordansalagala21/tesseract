import { describe, expect, it } from "vitest";
import { safeEmbedUrl, toTourOptions } from "@/components/viewer/tours";
import { travisProperty, travisSpaces, travisSuite100Model } from "@/lib/contracts/examples/travis";

describe("Matterport tour list", () => {
  it("builds one tour per model, listed suites first", () => {
    const tours = toTourOptions([travisSuite100Model], travisSpaces, travisProperty.matterportModelIds);
    expect(tours.map((t) => t.modelId)).toEqual(["NxYn1owequw", "4H2JSnQ3wSj"]);
    expect(tours[0]).toMatchObject({ title: "Suite 100", suiteListed: true, scannedAreaSf: 8878.9, advertisedSf: 9889 });
    expect(tours[1]).toMatchObject({ title: "Suite 104", suiteListed: true, scannedAreaSf: null });
  });

  it("flags a scan of a suite that is not advertised", () => {
    const tours = toTourOptions([{ ...travisSuite100Model, matchedSuite: "322" }], travisSpaces);
    expect(tours.find((t) => t.modelId === "NxYn1owequw")?.suiteListed).toBe(false);
    // Listed suites sort first, so the unlisted scan drops behind Suite 104
    expect(tours[0].title).toBe("Suite 104");
  });

  it("treats unmatched model ids as building scans", () => {
    const [tour] = toTourOptions([], [], ["AbCdEf12345"]);
    expect(tour).toMatchObject({ title: "Building scan", matchedSuite: null, suiteListed: false });
  });

  it("only embeds Matterport's own Showcase page", () => {
    expect(safeEmbedUrl("NxYn1owequw")).toBe("https://my.matterport.com/show/?m=NxYn1owequw");
    expect(safeEmbedUrl("x\"><script>")).toBeNull();
    expect(toTourOptions([], [], ["../../evil"])).toEqual([]);
  });
});
