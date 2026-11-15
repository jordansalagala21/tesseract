/**
 * Generate AI concept images for "See the space and its potential". OWNER: Developer 1.
 * (In scripts/ because it runs offline like the import scripts; the app never calls OpenAI.)
 *
 *   npm run concepts:generate                                   Travis Suite 100, all six uses
 *   npm run concepts:generate -- --subject p1018657-s21963212   another space (Suite 104)
 *   npm run concepts:generate -- --uses restaurant_bar,cafe     only some uses
 *   npm run concepts:generate -- --photo 2 --quality high --force
 *
 * For each use it sends ONE photo from the space's own Matterport scan to OpenAI's image edit
 * endpoint with a prompt that keeps the room (camera angle, windows, ceiling) and changes only
 * the fit-out, then saves public/concepts/<subject>/<use>.webp and registers it in
 * public/concepts/manifest.json, which the results page reads. The page labels every image
 * "AI concept — illustrative only, not an architectural plan".
 *
 * public/concepts/ is gitignored: the images are derived from sponsor imagery.
 * Cost: one image per use, about 5–10¢ each at medium quality.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { imageGenEnv } from "@/lib/config/env";
import { getModelImages } from "@/lib/data/matterport";
import { getSpaces } from "@/lib/data/properties";
import { USES, USE_CATEGORIES, type UseCategory } from "@/lib/market/uses";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const SUBJECT = opt("subject") ?? "p1018657-s21053094";
const USES_WANTED = (opt("uses")?.split(",") ?? USE_CATEGORIES) as UseCategory[];
const PHOTO = Number(opt("photo") ?? 0);
const QUALITY = opt("quality") ?? "medium";
const FORCE = args.includes("--force");

/** What each use looks like. The room itself must not change. */
const LOOKS: Record<UseCategory, string> = {
  restaurant_bar: "a refreshed contemporary restaurant and bar: dining tables, warm pendant lighting, an updated bar counter with back-bar display",
  cafe: "a bright specialty coffee shop: an espresso bar counter with pastry display, communal and small tables, plants and warm wood finishes",
  fitness_studio: "a boutique fitness studio: rubber training floor, functional training racks, free weights, rowing machines and mirrors",
  medical_office: "a calm medical clinic reception and waiting area: a reception desk, comfortable seating and soft, clean clinical finishes",
  specialty_retail: "an experiential retail showroom: display tables, lit wall shelving with products and an open browsing layout",
  coworking: "a hospitality-style coworking lounge: shared desks, soft seating, phone booths and a coffee point",
};
const KEEP =
  "Keep this exact room: the same camera angle, the same windows, ceiling, columns, walls and proportions. Change only the furniture, finishes and fit-out. Photorealistic interior photograph, natural daylight, no people, no text, no logos.";

const OUT_DIR = path.join(process.cwd(), "public", "concepts");
const MANIFEST = path.join(OUT_DIR, "manifest.json");

async function sourcePhoto(): Promise<{ bytes: Buffer; modelId: string }> {
  const m = /^p(\d+)-s(\d+)$/.exec(SUBJECT);
  if (!m) throw new Error(`--subject must look like p<propertyId>-s<spaceId>, got "${SUBJECT}".`);
  const space = (await getSpaces(Number(m[1]))).find((s) => s.id === Number(m[2]));
  if (!space) throw new Error(`Space ${m[2]} is not advertised at property ${m[1]}.`);
  if (!space.matterport) throw new Error(`${space.suite ? `Suite ${space.suite}` : `Space ${space.id}`} has no Matterport scan, so there is no photo to start from.`);
  const modelId = space.matterport.modelId;
  const photo = (await getModelImages(modelId, 200)).find((i) => i.source.field === `assets.photos[${PHOTO}]`);
  if (!photo) throw new Error(`Scan ${modelId} has no photo ${PHOTO}.`);
  const res = await fetch(photo.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not download the scan photo (${res.status}).`);
  return { bytes: Buffer.from(await res.arrayBuffer()), modelId };
}

async function edit(photo: Buffer, use: UseCategory, key: string, model: string): Promise<Buffer> {
  const form = new FormData();
  form.append("model", model);
  form.append("image", new Blob([new Uint8Array(photo)], { type: "image/jpeg" }), "space.jpg");
  form.append("prompt", `Redesign this space as ${LOOKS[use]}. ${KEEP}`);
  form.append("size", "1536x1024");
  form.append("quality", QUALITY);
  const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  const json = (await res.json()) as { data?: { b64_json?: string }[]; error?: { message?: string } };
  // Report OpenAI's message only: it never contains the key.
  if (!res.ok || !json.data?.[0]?.b64_json) throw new Error(`OpenAI answered ${res.status}: ${json.error?.message ?? "no image returned"}`);
  return Buffer.from(json.data[0].b64_json, "base64");
}

async function main() {
  const { OPENAI_API_KEY, OPENAI_IMAGE_MODEL } = imageGenEnv();
  const unknown = USES_WANTED.filter((u) => !USES[u]);
  if (unknown.length) throw new Error(`Unknown use(s): ${unknown.join(", ")}. Use: ${USE_CATEGORIES.join(", ")}.`);

  const { bytes, modelId } = await sourcePhoto();
  const photo = await sharp(bytes).rotate().resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  console.log(`Source: ${SUBJECT}, Matterport scan ${modelId}, photo ${PHOTO}. Model ${OPENAI_IMAGE_MODEL}, ${QUALITY} quality.\n`);

  await mkdir(path.join(OUT_DIR, SUBJECT), { recursive: true });
  const manifest: Record<string, Record<string, string>> = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : {};
  let made = 0;
  for (const use of USES_WANTED) {
    const file = path.join(OUT_DIR, SUBJECT, `${use}.webp`);
    const url = `/concepts/${SUBJECT}/${use}.webp`;
    if (existsSync(file) && !FORCE) {
      console.log(`· ${use}: already there (use --force to regenerate)`);
      (manifest[SUBJECT] ??= {})[use] = url;
      continue;
    }
    const t0 = Date.now();
    try {
      const image = await edit(photo, use, OPENAI_API_KEY, OPENAI_IMAGE_MODEL);
      await writeFile(file, await sharp(image).webp({ quality: 82 }).toBuffer());
      (manifest[SUBJECT] ??= {})[use] = url;
      made++;
      console.log(`✅ ${use}: ${url} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    } catch (e) {
      console.log(`❌ ${use}: ${e instanceof Error ? e.message : e}`);
      if (e instanceof Error && /credits|billing|quota/i.test(e.message)) break;
    }
  }
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n${made} new concept image(s). The results page picks them up on reload.`);
}

main().catch((e) => {
  console.error(`❌ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
