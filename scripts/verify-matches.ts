/**
 * DATA-06 — verify the CoStar ↔ Matterport ↔ Vexcel links for the demo properties.
 * OWNER: Developer 2.
 *
 * Run (no npm script: package.json is Dev 1's, per CLAUDE.md §5):
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs \
 *     --tsconfig scripts/tsconfig.verify.json scripts/verify-matches.ts
 *
 * Why those flags:
 *   --tsconfig scripts/tsconfig.verify.json
 *       lib/data/* modules import "server-only", which throws outside a framework server build.
 *       This config points that specifier at an empty stub. `--conditions=react-server` does
 *       NOT work in its place: tsx compiles the imported .ts files to CJS, and export
 *       conditions only apply to ESM resolution. Scoping it to this one script is also what
 *       keeps app code bound to the real module, which is the actual guarantee that these
 *       files never reach a client bundle.
 *   --env-file=.env.local
 *       tsx does not read it, and the Matterport and Vexcel calls need credentials.
 *       Nothing from that file is printed.
 *
 * This script REPORTS. It never asserts a link that the data does not support: an unmatched
 * suite prints as unmatched, and a missing coordinate prints as unknown rather than passing.
 */
import { queryRows } from "@/lib/data/duckdb";
import { checkCoordinates, COORDINATE_TOLERANCE_M } from "@/lib/data/matching";
import { getMatterportModel } from "@/lib/data/matterport";
import { getAerialImagery } from "@/lib/data/vexcel";
import { getSpaces } from "@/lib/data/properties";

/** The three properties verified at all three layers in docs/DATA_SOURCES.md §4. */
const DEMO_PROPERTY_IDS = [1018657, 353482, 5528958];

interface PropertyRow {
  id: number;
  street: string | null;
  city: string | null;
  lat: number;
  lon: number;
  property_type: string | null;
}

interface ModelRow {
  model_id: string;
  matched_suite: string | null;
  link_method: string;
  caption: string | null;
}

function line(char = "─", width = 78): string {
  return char.repeat(width);
}

async function verifyProperty(propertyId: number): Promise<void> {
  const [property] = await queryRows<PropertyRow>(
    "SELECT id, street, city, lat, lon, property_type FROM properties WHERE id = ?",
    [propertyId] as never,
  );

  console.log(`\n${line("━")}`);
  if (!property) {
    console.log(`PropertyId ${propertyId} — NOT IN THE KIT`);
    return;
  }
  console.log(`PropertyId ${property.id} — ${property.street}, ${property.city} (${property.property_type})`);
  console.log(`CoStar coordinates: ${property.lat}, ${property.lon}`);
  console.log(line());

  // ---------------------------------------------------------------- CoStar layer
  const spaces = await getSpaces(propertyId);
  console.log(`\nCoStar · ${spaces.length} advertised space(s)`);
  for (const space of spaces) {
    const sf = space.sfMax === null ? "SF not stated" : `${space.sfMax.toLocaleString("en-US")} SF`;
    const rent =
      space.askingRent.psfYearLow === null
        ? "no published rate"
        // toFixed(2) because a monthly rate x 12 lands on values like 16.919999999999998.
        : `$${space.askingRent.psfYearLow.toFixed(2)}/SF/yr ${space.askingRent.serviceType ?? ""}`.trim();
    const link = space.matterport
      ? `3D ${space.matterport.modelId} (${space.matterport.linkMethod})`
      : "no 3D";
    console.log(`  suite ${String(space.suite ?? "—").padEnd(22)} ${sf.padEnd(16)} ${rent.padEnd(30)} ${link}`);
  }

  const models = await queryRows<ModelRow>(
    `SELECT DISTINCT model_id, matched_suite, link_method, caption
     FROM matterport_models WHERE property_id = ? ORDER BY matched_suite NULLS LAST, model_id`,
    [propertyId] as never,
  );
  const suiteMatched = models.filter((m) => m.matched_suite !== null);
  const advertisedSuites = new Set(
    spaces.map((s) => (s.suite ?? "").trim().toUpperCase().replace(/^0+/, "")).filter(Boolean),
  );
  const orphanModels = suiteMatched.filter((m) => !advertisedSuites.has(m.matched_suite!));

  console.log(
    `\nMatterport · ${models.length} link row(s), ${suiteMatched.length} suite-matched, ` +
      `${orphanModels.length} matched to a suite that is NOT advertised`,
  );

  // ----------------------------------------------------------- Matterport layer
  const checkedModels = [...new Set(suiteMatched.map((m) => m.model_id))];
  for (const modelId of checkedModels) {
    const row = suiteMatched.find((m) => m.model_id === modelId)!;
    const model = await getMatterportModel(modelId, {
      propertyId,
      caption: row.caption,
      matchedSuite: row.matched_suite,
    });
    if (!model) {
      console.log(`  ${modelId}  suite ${row.matched_suite}  — NOT ACCESSIBLE with our key`);
      continue;
    }
    const check = checkCoordinates(
      { lat: property.lat, lon: property.lon },
      model.location ? { lat: model.location.lat, lon: model.location.lon } : null,
    );
    const distance =
      check.distanceMeters === null
        ? "distance unknown (model reports no coordinates)"
        : `${check.distanceMeters.toFixed(1)} m from the CoStar point ` +
          `(${check.withinTolerance ? "within" : "OUTSIDE"} ${COORDINATE_TOLERANCE_M} m)`;
    const advertised = advertisedSuites.has(row.matched_suite ?? "")
      ? "advertised"
      : "NOT an advertised suite";
    console.log(`  ${modelId}  suite ${String(row.matched_suite).padEnd(10)} ${advertised}`);
    console.log(`      name: ${model.name}`);
    console.log(`      scanned ${model.scannedAreaSf?.toFixed(0) ?? "?"} SF · ${model.rooms.length} rooms · ${model.panoCount} panos`);
    console.log(`      ${distance}`);
    console.log(`      methods: ${suiteMatched.filter((m) => m.model_id === modelId).map((m) => m.link_method).join(", ")}`);
  }
  if (checkedModels.length === 0) {
    console.log("  no suite-matched models for this property");
  }

  // --------------------------------------------------------------- Vexcel layer
  try {
    const ortho = await getAerialImagery(propertyId, property.lat, property.lon, "ortho", null);
    console.log(
      `\nVexcel · ortho ${ortho.collection} · GSD ${ortho.gsdMeters.min.toFixed(3)}–${ortho.gsdMeters.max.toFixed(3)} m` +
        ` · captured ${ortho.captureDate.first || "not stated"} → ${ortho.captureDate.last || "not stated"}` +
        ` · ${ortho.width ?? "?"}×${ortho.height ?? "?"}`,
    );
    const oblique = await getAerialImagery(propertyId, property.lat, property.lon, "oblique", "north");
    console.log(
      `           oblique-north ${oblique.collection} · ${oblique.width ?? "?"}×${oblique.height ?? "?"}` +
        ` · ${oblique.attribution}`,
    );
  } catch (error) {
    console.log(`\nVexcel · unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  console.log("DATA-06 · CoStar ↔ Matterport ↔ Vexcel verification");
  console.log(`Run at ${new Date().toISOString()}`);
  for (const propertyId of DEMO_PROPERTY_IDS) {
    await verifyProperty(propertyId);
  }
  console.log(`\n${line("━")}`);
  console.log("A suite with no 3D, or a model matched to a suite that is not advertised, is");
  console.log("reported as such. Nothing here asserts a link the data does not support.");

  const { closeDb } = await import("@/lib/data/duckdb");
  await closeDb();
}

main().catch((error: unknown) => {
  console.error(`
verify-matches failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
