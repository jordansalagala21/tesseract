import { describe, expect, test } from "vitest";
import { linkSuiteToModel, normalizeSuite, suiteFromCaption } from "@/lib/data/matching";

describe("suiteFromCaption", () => {
  test("extracts the suite number from a CoStar caption", () => {
    expect(suiteFromCaption("Suite 100 - 9,889SF")).toBe("100");
    expect(suiteFromCaption("Suite 104 - 2,946SF")).toBe("104");
  });

  test("extracts an alphanumeric suite", () => {
    expect(suiteFromCaption("Suite I - 1,200SF")).toBe("I");
  });

  test("ignores captions that name no suite", () => {
    expect(suiteFromCaption("2600 Travis Site Plan")).toBeNull();
    expect(suiteFromCaption("View Site Plan")).toBeNull();
  });
});

describe("linkSuiteToModel", () => {
  test("links suite 100 to its model and records the method", () => {
    const link = linkSuiteToModel("100", [
      { videoKey: "1oJZ2OYf", caption: "2600 Travis Site Plan", videoExternalReferenceType: 60 },
      { videoKey: "NxYn1owequw", caption: "Suite 100 - 9,889SF", videoExternalReferenceType: 36 },
    ]);
    expect(link).toEqual({
      modelId: "NxYn1owequw",
      caption: "Suite 100 - 9,889SF",
      matchedSuite: "100",
      linkMethod: "caption_suite_match",
    });
  });

  test("ignores attachments that are not Matterport reference types", () => {
    expect(
      linkSuiteToModel("100", [
        { videoKey: "7JIRF77e", caption: "Suite 100 Floor Plan 2600 Travis", videoExternalReferenceType: 60 },
      ]),
    ).toBeNull();
  });

  test("matches case-insensitively and ignores leading zeros", () => {
    expect(
      linkSuiteToModel("100", [{ videoKey: "M", caption: "SUITE 0100 - 1SF", videoExternalReferenceType: 36 }])
        ?.modelId,
    ).toBe("M");
  });

  test("returns null when the space has no suite", () => {
    expect(linkSuiteToModel(null, [{ videoKey: "M", caption: "Suite 100", videoExternalReferenceType: 36 }])).toBeNull();
  });

  test("accepts reference type 234 as well as 36", () => {
    expect(
      linkSuiteToModel("A1", [{ videoKey: "M234", caption: "Suite A1 - 500SF", videoExternalReferenceType: 234 }])
        ?.modelId,
    ).toBe("M234");
  });

  test("does not link a different suite at the same property", () => {
    expect(
      linkSuiteToModel("106", [
        { videoKey: "NxYn1owequw", caption: "Suite 100 - 9,889SF", videoExternalReferenceType: 36 },
        { videoKey: "4H2JSnQ3wSj", caption: "Suite 104 - 2,946SF", videoExternalReferenceType: 36 },
      ]),
    ).toBeNull();
  });

  test("skips attachments with no videoKey", () => {
    expect(
      linkSuiteToModel("100", [{ videoKey: null, caption: "Suite 100 - 1SF", videoExternalReferenceType: 36 }]),
    ).toBeNull();
  });
});

describe("normalizeSuite", () => {
  test("upper-cases and strips leading zeros so both sides of a join agree", () => {
    expect(normalizeSuite("0100")).toBe("100");
    expect(normalizeSuite("a1")).toBe("A1");
    expect(normalizeSuite(" 104 ")).toBe("104");
  });

  test("returns null for a missing or empty suite", () => {
    expect(normalizeSuite(null)).toBeNull();
    expect(normalizeSuite("   ")).toBeNull();
  });

  test("keeps a suite that is all zeros from becoming empty", () => {
    expect(normalizeSuite("0")).toBe("0");
  });
});
