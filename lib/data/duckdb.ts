/**
 * Read-only DuckDB connection for request-time readers (DATA-01).
 * OWNER: Developer 2.
 *
 * The database is built offline by `npm run db:build` (scripts/build-db.ts), which is the only
 * writer. Everything at request time opens it READ_ONLY, so a route handler cannot mutate the
 * sponsor-derived data even by accident.
 *
 * The connection is a module-level singleton: DuckDB opens the file once per process and the
 * cached promise means concurrent callers share one connection rather than racing to create
 * several.
 */
import "server-only";
import { existsSync } from "node:fs";
import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from "@duckdb/node-api";

/**
 * Default matches `DUCKDB_PATH` in lib/config/env.ts, which is the source of truth.
 * Read straight from process.env rather than through serverEnv(): the DB path is not a secret,
 * and serverEnv() validates every API key, which would make local data reads impossible in
 * tests, in CI, and in the import script — none of which have Matterport or Vexcel credentials.
 */
function resolveDbPath(): string {
  return process.env.DUCKDB_PATH?.trim() || "./data/tesseract.duckdb";
}

let connectionPromise: Promise<DuckDBConnection> | undefined;
let instanceCloser: (() => void) | undefined;

async function open(): Promise<DuckDBConnection> {
  const dbPath = resolveDbPath();
  if (!existsSync(dbPath)) {
    throw new Error(
      `No DuckDB database at ${dbPath}. Run \`npm run db:build\` (it reads $COSTAR_KIT_DIR and writes $DUCKDB_PATH).`,
    );
  }
  const instance = await DuckDBInstance.create(dbPath, { access_mode: "READ_ONLY" });
  instanceCloser = () => instance.closeSync();
  return instance.connect();
}

/** The shared read-only connection. Opens on first use. */
export function getDb(): Promise<DuckDBConnection> {
  if (!connectionPromise) {
    connectionPromise = open().catch((error: unknown) => {
      // Never cache a failed open: the next call should retry (e.g. after db:build runs).
      connectionPromise = undefined;
      throw error;
    });
  }
  return connectionPromise;
}

/** Run a query and return its rows as plain objects. */
export async function queryRows<T>(sql: string, params?: DuckDBValue[]): Promise<T[]> {
  const connection = await getDb();
  const reader = await connection.runAndReadAll(sql, params);
  return reader.getRowObjectsJS() as T[];
}

/** Close the shared connection. For tests and script teardown. */
export async function closeDb(): Promise<void> {
  const pending = connectionPromise;
  connectionPromise = undefined;
  if (pending) {
    const connection = await pending.catch(() => undefined);
    connection?.closeSync();
  }
  instanceCloser?.();
  instanceCloser = undefined;
}
