import path from "node:path";
import { describe, expect, test } from "vitest";
import { decodeEnum, loadKitEnums, type EnumMap } from "@/lib/data/enums";

const FIXTURE: EnumMap = {
  PropertyType: { "0": "Unknown", "6": "GeneralRetail", "11": "Multifamily" },
  BuildingClass: { "0": "Unknown", "1": "A", "2": "B", "3": "C", "4": "F" },
};

describe("decodeEnum", () => {
  test("decodes a known integer to its name", () => {
    expect(decodeEnum(FIXTURE, "PropertyType", 6)).toBe("GeneralRetail");
  });

  test("decodes BuildingClass 1 to A", () => {
    expect(decodeEnum(FIXTURE, "BuildingClass", 1)).toBe("A");
  });

  test("returns null for the Unknown member", () => {
    expect(decodeEnum(FIXTURE, "BuildingClass", 0)).toBeNull();
  });

  test("returns null for an integer absent from the map", () => {
    expect(decodeEnum(FIXTURE, "PropertyType", 999)).toBeNull();
  });

  test("returns null for an enum name absent from the file", () => {
    expect(decodeEnum(FIXTURE, "LotSizeMeasurementType", 2)).toBeNull();
  });

  test("returns null for null and undefined values", () => {
    expect(decodeEnum(FIXTURE, "PropertyType", null)).toBeNull();
    expect(decodeEnum(FIXTURE, "PropertyType", undefined)).toBeNull();
  });
});

describe("loadKitEnums", () => {
  const kitDir = process.env.COSTAR_KIT_DIR;

  test.skipIf(!kitDir)("loads the kit's enum maps", () => {
    const enums = loadKitEnums(kitDir!);
    expect(decodeEnum(enums, "PropertyType", 11)).toBe("Multifamily");
    expect(decodeEnum(enums, "RateBasis", 1)).toBe("Monthly");
    expect(decodeEnum(enums, "ServiceType", 13)).toBe("TripleNet");
  });

  test("throws an error naming the path when the file is missing", () => {
    // path.join is platform-native, so assert the joined path rather than a POSIX-style regex.
    const expected = path.join("/no/such/kit", "schemas", "enums.json");
    expect(() => loadKitEnums("/no/such/kit")).toThrow(expected);
  });
});
