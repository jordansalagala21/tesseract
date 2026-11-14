# lib/agent — Claude orchestrator (OWNER: Developer 1)

| Module | Responsibility |
|---|---|
| `orchestrator.ts` | `runAnalysis()`: manual Claude tool-use loop with a step limit; records every `AgentToolCall` (reason, status, timing, evidence); failed tools are recorded and the run continues; builds the `AnalysisResponse` |
| `tools.ts` | The 10 `AgentToolName` tools (Zod input → JSON Schema), `submit_report`, and handlers. Data access is injected as `DataDeps` |
| `evidence.ts` | `EvidenceRegistry`: assigns ids, validates every item, builds the four-bucket index, drops unknown ids |
| `store.ts` | In-memory analysis store (no persistence by design) |
| `run.ts` | Server entry: real Anthropic client + store; never throws |

**Who decides what:**
- Claude chooses what to investigate and writes the explanations.
- `lib/market` sets scores and verdicts.
- `lib/finance` computes the money figures.
- Opportunities are ranked by score, never by the model's order.

**Data tools** fail honestly (`UNAVAILABLE_DEPS`) until their modules land:

| Tools | Unblocked by |
|---|---|
| property search, space search | DATA-02 |
| property profile | DATA-03 |
| Matterport metadata | DATA-04 |
| Vexcel imagery | DATA-05 |
| nearby context | DATA-07 |
| interior and exterior vision | AI-02 |

INT-02 wires the real implementations into `executeAnalysis(id, request, deps)`.

**Model:** `ANTHROPIC_MODEL_ORCHESTRATOR` (default `claude-opus-5-5`), effort `medium`, server-side refusal fallback (`fallbacks: "default"`).

Routes: `POST /api/analyze` → 202 `{ analysisId, pollUrl }`, then poll `GET /api/analysis/[id]`.
