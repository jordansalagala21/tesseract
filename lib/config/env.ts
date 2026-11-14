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
