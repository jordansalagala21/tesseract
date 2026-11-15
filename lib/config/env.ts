/**
 * Server-only environment access. Importing this from a Client Component fails the build.
 * OWNER: Developer 1. Add new variables here AND to .env.example.
 */
import "server-only";
import { z } from "zod";

const ServerEnv = z.object({
  COSTAR_KIT_DIR: z.string().min(1),
  DUCKDB_PATH: z.string().default("./data/tesseract.duckdb"),
  MATTERPORT_API_KEY: z.string().min(1),
  MATTERPORT_API_TOKEN: z.string().min(1),
  VEXCEL_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL_ORCHESTRATOR: z.string().default("claude-opus-5-5"),
  ANTHROPIC_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  /** Optional: only `npm run concepts:generate` uses it (offline concept images). */
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
});
export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | undefined;

/** Call lazily inside handlers (not at module top level) so builds work without secrets. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = ServerEnv.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Missing/invalid server env vars: ${missing}. See .env.example.`);
    }
    cached = parsed.data;
  }
  return cached;
}

/**
 * Just what the agent needs. Narrower than serverEnv() so a missing Matterport or Vexcel key
 * cannot stop an analysis; those tools fail on their own and the analysis records the gap.
 */
const AgentEnv = ServerEnv.pick({ ANTHROPIC_API_KEY: true, ANTHROPIC_MODEL_ORCHESTRATOR: true, ANTHROPIC_MODEL_FAST: true });
export type AgentEnv = z.infer<typeof AgentEnv>;

export function agentEnv(): AgentEnv {
  const parsed = AgentEnv.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).");
  }
  return parsed.data;
}

/**
 * Narrow accessors for single integrations. Each validates only its own variables, so a missing
 * key for one service (e.g. Vexcel) never breaks another (e.g. Matterport).
 */
const MatterportEnv = ServerEnv.pick({ MATTERPORT_API_KEY: true, MATTERPORT_API_TOKEN: true });
export type MatterportEnv = z.infer<typeof MatterportEnv>;

export function matterportEnv(): MatterportEnv {
  const parsed = MatterportEnv.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("MATTERPORT_API_KEY / MATTERPORT_API_TOKEN are not set. Add them to .env.local (see .env.example).");
  }
  return parsed.data;
}

const VexcelEnv = ServerEnv.pick({ VEXCEL_API_KEY: true });
export type VexcelEnv = z.infer<typeof VexcelEnv>;

export function vexcelEnv(): VexcelEnv {
  const parsed = VexcelEnv.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("VEXCEL_API_KEY is not set. Add it to .env.local (see .env.example).");
  }
  return parsed.data;
}

/** Concept-image generation (scripts/generate-concepts.ts). Never used by the running app. */
const ImageGenEnv = z.object({ OPENAI_API_KEY: z.string().min(1), OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2") });
export type ImageGenEnv = z.infer<typeof ImageGenEnv>;

export function imageGenEnv(): ImageGenEnv {
  const parsed = ImageGenEnv.safeParse(process.env);
  if (!parsed.success) throw new Error("OPENAI_API_KEY is not set. Add it to .env.local (see .env.example).");
  return parsed.data;
}
