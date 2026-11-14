/**
 * CoStar integer-enum decoding (DATA-01).
 * OWNER: Developer 2.
 *
 * The kit stores every enum as an integer and ships the maps in
 * `$COSTAR_KIT_DIR/schemas/enums.json` (161 enums, each a flat `{"<int>": "Name"}` object).
 * An integer we cannot resolve decodes to `null` — we never guess a label.
 *
 * Deliberately free of `server-only` so the unit tests can import it directly under Node.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

/** `{ EnumName: { "<int>": "MemberName" } }`, as shipped in schemas/enums.json. */
export type EnumMap = Record<string, Record<string, string>>;

/**
 * Nearly every kit enum uses this as its zero member. It carries no information,
 * so it decodes to `null` rather than the literal string.
 */
const UNKNOWN_MEMBER = "Unknown";

/** Read and parse `<kitDir>/schemas/enums.json`. Throws an Error naming the path if unreadable. */
export function loadKitEnums(kitDir: string): EnumMap {
  const file = path.join(kitDir, "schemas", "enums.json");
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (cause) {
    throw new Error(
      `Cannot read the CoStar enum maps at ${file}. Check COSTAR_KIT_DIR points at the unzipped sponsor kit.`,
      { cause },
    );
  }
  return JSON.parse(raw) as EnumMap;
}

/**
 * Decode one integer enum value to its member name.
 * Returns `null` for a null/undefined value, an unknown enum name, an integer that is not in
 * the map, or the enum's `Unknown` member.
 */
export function decodeEnum(
  enums: EnumMap,
  enumName: string,
  value: number | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const member = enums[enumName]?.[String(value)];
  if (member === undefined || member === UNKNOWN_MEMBER) return null;
  return member;
}
