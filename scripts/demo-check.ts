/**
 * Pre-demo check for 2600 Travis St (INT-07). OWNER: Developer 1.
 * (In scripts/ because it is run like the import scripts. It only reads from a running app.)
 *
 * Start the app (`npm run dev`), then:
 *   npm run demo:check                  data, tours, imagery, market, page timings, secrets
 *   npm run demo:check -- --analysis    plus one live owner analysis of Suite 100 (~1 min, uses Claude)
 *   npm run demo:check -- --capture     the same, and saves it as the recorded fallback
 *                                       (data/demo/rec_travis_owner.json, gitignored)
 *   --base http://localhost:3001        if the app is not on port 3000
 *
 * Running it also pre-warms the caches (Matterport metadata, Vexcel metadata), so run it right
 * before presenting. Exit code 1 if any check fails.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AnalysisResponse, MarketAnalysis, PropertyDetailResponse, PropertySearchResponse, PropertySpacesResponse } from "@/lib/contracts";
import { auditAnalysis } from "@/lib/agent/audit";

const PID = 1018657;
const SUITE_100 = 21053094;
const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const baseAt = args.indexOf("--base");
const BASE = (baseAt >= 0 ? args[baseAt + 1] : (process.env.DEMO_BASE_URL ?? "http://localhost:3000")).replace(/\/$/, "");
const PAGE_BUDGET_MS = 3000;

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const bodies: { where: string; text: string }[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}: ${detail}`);
};

async function get(pathname: string, init?: RequestInit) {
  const t0 = Date.now();
  const res = await fetch(BASE + pathname, { cache: "no-store", ...init });
  const ms = Date.now() - t0;
  const type = res.headers.get("content-type") ?? "";
  const text = type.includes("image") ? "" : await res.text();
  bodies.push({ where: pathname, text: text + "\n" + [...res.headers].map(([k, v]) => `${k}: ${v}`).join("\n") });
  return { res, ms, text, type };
}
const json = (t: string) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};

async function main() {
  console.log(`Demo check against ${BASE}\n`);
  try {
    await fetch(BASE, { cache: "no-store" });
  } catch {
    console.error(`❌ The app isn't answering at ${BASE}. Start it with \`npm run dev\` first.`);
    process.exit(1);
  }

  // --- data ------------------------------------------------------------------------------
  const search = await get(`/api/properties?q=${encodeURIComponent("2600 travis street")}`);
  const s = PropertySearchResponse.safeParse(json(search.text));
  check("Search finds 2600 Travis", s.success && s.data.items.some((p) => p.id === PID), s.success ? `${s.data.total} result(s)` : `HTTP ${search.res.status}`);

  const detail = await get(`/api/properties/${PID}`);
  const d = PropertyDetailResponse.safeParse(json(detail.text));
  if (d.success) {
    const suites = d.data.matterportModels.map((m) => m.matchedSuite).sort().join(", ");
    check("Property profile is live", d.data.property.id === PID, `${d.data.property.propertyType}, ${d.data.property.rentableAreaSf?.toLocaleString("en-US")} SF, ${d.data.currentTenants.length} tenants`);
    check("3D scans linked to suites", suites === "100, 104", `suites ${suites || "none"}`);
    check("Aerial images (ortho + oblique)", d.data.aerial.map((a) => a.kind).join(",") === "ortho,oblique", d.data.aerial.map((a) => `${a.kind} ${a.collection}`).join("; ") || "none (is VEXCEL_API_KEY set?)");
  } else {
    check("Property profile is live", false, `HTTP ${detail.res.status}`);
  }

  const spaces = await get(`/api/properties/${PID}/spaces`);
  const sp = PropertySpacesResponse.safeParse(json(spaces.text));
  const s100 = sp.success ? sp.data.items.find((x) => x.id === SUITE_100) : undefined;
  check("Suite 100 advertised with its scan", !!s100 && s100.matterport?.modelId === "NxYn1owequw" && s100.askingRent.psfYearLow === 45, s100 ? `${s100.sfMax?.toLocaleString("en-US")} SF, $${s100.askingRent.psfYearLow} ${s100.askingRent.serviceType}, scan ${s100.matterport?.modelId}` : "missing");

  const ortho = await get(`/api/imagery/vexcel/ortho?propertyId=${PID}`);
  check("Vexcel image through our proxy", ortho.res.ok && ortho.type.startsWith("image/") && !!ortho.res.headers.get("x-vexcel-attribution"), `HTTP ${ortho.res.status}, ${ortho.type}, ${ortho.res.headers.get("x-vexcel-attribution") ?? "no attribution"}`);

  // The Matterport tour is checked in a real browser (see docs/DEMO.md): Matterport answers 403
  // to server-side requests to Showcase, and faking a browser user agent is not something we do.

  const market = await get("/api/market/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propertyId: PID, radiusMeters: 1500, spaceUse: "Retail" }) });
  const m = MarketAnalysis.safeParse(json(market.text));
  check("Market analysis", m.success && m.data.limitations.length > 0, m.success ? `${m.data.comparableSpaces.count} comparable spaces, ${m.data.limitations.length} limitations` : `HTTP ${market.res.status}`);

  // --- pages (warm: the data calls above filled the caches) -----------------------------
  for (const page of ["/", "/properties?q=travis", `/properties/${PID}`, "/start", "/invest"]) {
    const p = await get(page);
    check(`Page ${page} < ${PAGE_BUDGET_MS / 1000} s`, p.res.ok && p.ms < PAGE_BUDGET_MS, `HTTP ${p.res.status} in ${p.ms} ms`);
  }

  // --- live analysis (opt-in) ------------------------------------------------------------
  if (flag("--analysis") || flag("--capture")) {
    const start = await get("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: { persona: "owner", propertyId: PID, spaceId: SUITE_100 } }) });
    const id = json(start.text)?.analysisId as string | undefined;
    if (!id) {
      check("Live owner analysis", false, `could not start: HTTP ${start.res.status}`);
    } else {
      const t0 = Date.now();
      let a: AnalysisResponse | null = null;
      while (Date.now() - t0 < 180_000) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await fetch(`${BASE}/api/analysis/${id}`, { cache: "no-store" });
        const parsed = AnalysisResponse.safeParse(await poll.json());
        if (parsed.success && (parsed.data.status === "completed" || parsed.data.status === "failed")) {
          a = parsed.data;
          break;
        }
      }
      const secs = Math.round((Date.now() - t0) / 1000);
      bodies.push({ where: `/api/analysis/${id}`, text: JSON.stringify(a) });
      if (!a) check("Live owner analysis", false, `no result after ${secs} s`);
      else {
        check("Live owner analysis < 90 s", a.status === "completed" && secs < 90, `${a.status} in ${secs} s, ${a.opportunities.length} ideas, ${a.evidence.length} evidence${a.error ? `, error: ${a.error}` : ""}`);
        check("At least 3 ranked ideas", a.opportunities.length >= 3, a.opportunities.map((o) => `${o.rank}. ${o.useCategory} (${o.verdict})`).join(", "));
        const findings = auditAnalysis(a);
        check("Evidence audit (INT-03)", findings.length === 0, findings.length ? findings.slice(0, 3).map((f) => `${f.rule} @ ${f.where}`).join("; ") : "0 findings");
        if (flag("--capture") && a.status === "completed") {
          const file = path.join(process.cwd(), "data", "demo", "rec_travis_owner.json");
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, JSON.stringify(a, null, 2));
          check("Recorded fallback saved", true, `${path.relative(process.cwd(), file)}; open ${BASE}/analysis/rec_travis_owner`);
        }
      }
    }
  }

  // --- secrets ---------------------------------------------------------------------------
  // Everything the browser could receive: API bodies and headers, and page HTML.
  const secrets = ["ANTHROPIC_API_KEY", "MATTERPORT_API_KEY", "MATTERPORT_API_TOKEN", "VEXCEL_API_KEY"]
    .map((k) => process.env[k]?.trim())
    .filter((v): v is string => !!v && v.length >= 8);
  const hosts = ["vexcelgroup.com", "api.matterport.com", "x-api-key"];
  const leaks = bodies.flatMap((b) => [
    ...secrets.filter((v) => b.text.includes(v)).map(() => `a key value in ${b.where}`),
    ...hosts.filter((h) => b.text.toLowerCase().includes(h)).map((h) => `"${h}" in ${b.where}`),
  ]);
  check("No secrets or upstream hosts sent to the browser", leaks.length === 0 && secrets.length > 0, leaks.length ? leaks.slice(0, 4).join("; ") : `scanned ${bodies.length} responses for ${secrets.length} keys and ${hosts.length} upstream markers`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

main();
