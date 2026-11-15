/**
 * Evidence audit for a finished analysis (INT-03). OWNER: Developer 1.
 *
 * The AnalysisResponse schema already rejects unknown evidence ids in opportunities, tool calls
 * and the market analysis. This goes further, over everything the UI renders:
 *  - ids inside financial scenarios (assumption evidenceIds) and scenario ids on opportunities
 *  - every verified fact names a dataset and a record id, so the Evidence Trail can link back
 *  - every CoStar-origin assumption cites a verified fact
 *  - AI observations carry a caveat and a source
 *  - media points at our own proxy or a Matterport model id, never a signed third-party URL
 *  - no "vacant" wording anywhere a user can read it
 *  - every opportunity rests on at least one verified fact
 *
 * Pure: returns findings and never throws, so it can gate tests and be logged after live runs.
 */
import type { AnalysisResponse, Evidence } from "@/lib/contracts";

export interface AuditFinding {
  rule:
    | "unknown_evidence_id"
    | "unknown_scenario_id"
    | "fact_without_record"
    | "costar_assumption_uncited"
    | "observation_without_caveat"
    | "unsafe_media_url"
    | "vacancy_wording"
    | "opportunity_without_fact";
  where: string;
  detail: string;
}

/** "vacant" / "vacancy", except where we say availability is NOT confirmed vacancy. */
const VACANCY = /\bvacan(t|cy)\b/i;
const NEGATED_VACANCY = /not (?:confirmed |physical )*(?:physical )?vacan(?:t|cy)|not confirmed vacan|≠ vacan|not vacant/i;
/** Matterport model ids are 11 url-safe characters. */
const MATTERPORT_ID = /^[A-Za-z0-9]{11}$/;

export function auditAnalysis(r: AnalysisResponse): AuditFinding[] {
  const out: AuditFinding[] = [];
  const byId = new Map<string, Evidence>(r.evidence.map((e) => [e.id, e]));
  const scenarioIds = new Set(r.financialScenarios.map((s) => s.id));
  const need = (id: string, where: string) => {
    if (!byId.has(id)) out.push({ rule: "unknown_evidence_id", where, detail: id });
  };

  /* -- references the schema doesn't cover */
  for (const s of r.financialScenarios) {
    for (const [key, a] of Object.entries(s.input) as [string, unknown][]) {
      if (!a || typeof a !== "object" || !("origin" in a)) continue;
      const { origin, evidenceId, label } = a as { origin: string; evidenceId?: string; label: string };
      if (evidenceId) need(evidenceId, `financialScenarios.${s.id}.input.${key}`);
      if (origin === "costar" && (!evidenceId || byId.get(evidenceId)?.kind !== "verified_fact")) {
        out.push({ rule: "costar_assumption_uncited", where: `financialScenarios.${s.id}.input.${key}`, detail: label });
      }
    }
  }
  for (const o of r.opportunities) {
    for (const id of o.financialScenarioIds) {
      if (!scenarioIds.has(id)) out.push({ rule: "unknown_scenario_id", where: `opportunities.${o.id}`, detail: id });
    }
    for (const id of [...o.supportingEvidenceIds, ...o.blockers.flatMap((b) => b.evidenceIds)]) need(id, `opportunities.${o.id}`);
    if (!o.supportingEvidenceIds.some((id) => byId.get(id)?.kind === "verified_fact")) {
      out.push({ rule: "opportunity_without_fact", where: `opportunities.${o.id}`, detail: o.title });
    }
  }
  for (const id of r.marketAnalysis?.evidenceIds ?? []) need(id, "marketAnalysis");
  for (const t of r.toolCalls) for (const id of t.evidenceIds) need(id, `toolCalls.${t.id}`);

  /* -- each evidence item */
  for (const e of r.evidence) {
    const where = `evidence.${e.id}`;
    if (e.kind === "verified_fact") {
      for (const s of e.sources) {
        if (s.system !== "derived" && (!s.dataset || !s.recordId)) {
          out.push({ rule: "fact_without_record", where, detail: `${s.system} source lacks ${!s.dataset ? "dataset" : "recordId"}` });
        }
      }
    }
    if (e.kind === "ai_observation" && (!e.caveat.trim() || e.sources.length === 0)) {
      out.push({ rule: "observation_without_caveat", where, detail: e.statement });
    }
    for (const m of e.media ?? []) {
      const safe = m.ref.startsWith("/api/") || (m.type.startsWith("matterport") && MATTERPORT_ID.test(m.ref));
      if (!safe) out.push({ rule: "unsafe_media_url", where, detail: m.ref.slice(0, 80) });
    }
    for (const s of e.sources) {
      if (s.url && !s.url.startsWith("/")) out.push({ rule: "unsafe_media_url", where: `${where}.sources`, detail: s.url.slice(0, 80) });
    }
  }

  /* -- wording the user reads */
  const texts: [string, string][] = [
    ...r.evidence.map((e): [string, string] => [`evidence.${e.id}`, e.statement]),
    ...r.opportunities.flatMap((o): [string, string][] => [
      [`opportunities.${o.id}.title`, o.title],
      [`opportunities.${o.id}.summary`, o.summary],
      ...[...o.unknowns, ...o.likelyChanges, ...o.nextSteps, ...o.blockers.map((b) => b.description)].map((t): [string, string] => [`opportunities.${o.id}`, t]),
    ]),
    ...(r.marketAnalysis?.limitations ?? []).map((t): [string, string] => ["marketAnalysis.limitations", t]),
    ...r.toolCalls.map((t): [string, string] => [`toolCalls.${t.id}`, `${t.reason} ${t.outputSummary ?? ""}`]),
  ];
  for (const [where, text] of texts) {
    if (VACANCY.test(text) && !NEGATED_VACANCY.test(text)) out.push({ rule: "vacancy_wording", where, detail: text.slice(0, 120) });
  }
  return out;
}
