# lib/agent — Agent orchestration (OWNER: Developer 1)

| Planned module | Issue | Responsibility |
|---|---|---|
| `orchestrator.ts` | AI-01 | Claude tool-use loop (max steps), emits `AgentToolCall` events, builds `AnalysisResponse` |
| `tools.ts` | AI-01, AI-02 | Tool definitions (names = `AgentToolName`) wrapping `lib/data`, `lib/market`, `lib/finance` |
| `vision.ts` | AI-02 | Interior (Matterport photos/floor plan) and exterior (Vexcel) vision → `ai_observation` evidence |
| `evidence.ts` | AI-03 | Evidence registry; guarantees every claim references an existing evidence id |
| `personas.ts` | AI-07 | Persona-specific goals/prompts for owner / investor / entrepreneur |
| `store.ts` | AI-01 | In-memory analysis store for `GET /api/analysis/[id]` (hackathon scope) |

The agent never reads sponsor data directly — only through `lib/data` functions.
