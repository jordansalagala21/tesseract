import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

let dir: string;
let dbPath: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "tesseract-duckdb-"));
  dbPath = path.join(dir, "fixture.duckdb");
  // A read-only open needs an existing database, so seed one with a single table.
  const instance = await DuckDBInstance.create(dbPath);
  const connection = await instance.connect();
  await connection.run("CREATE TABLE seeded (x INTEGER)");
  await connection.run("INSERT INTO seeded VALUES (7)");
  connection.closeSync();
  instance.closeSync();
  process.env.DUCKDB_PATH = dbPath;
});

afterAll(async () => {
  const { closeDb } = await import("@/lib/data/duckdb");
  await closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("read-only DuckDB connection", () => {
  test("queryRows returns typed rows from a query", async () => {
    const { queryRows } = await import("@/lib/data/duckdb");
    const rows = await queryRows<{ n: number }>("SELECT 42 AS n");
    expect(rows).toEqual([{ n: 42 }]);
  });

  test("queryRows reads the seeded table", async () => {
    const { queryRows } = await import("@/lib/data/duckdb");
    expect(await queryRows<{ x: number }>("SELECT x FROM seeded")).toEqual([{ x: 7 }]);
  });

  test("queryRows binds parameters", async () => {
    const { queryRows } = await import("@/lib/data/duckdb");
    expect(await queryRows<{ x: number }>("SELECT x FROM seeded WHERE x = ?", [7])).toEqual([{ x: 7 }]);
  });

  test("getDb returns the same connection on repeated calls", async () => {
    const { getDb } = await import("@/lib/data/duckdb");
    expect(await getDb()).toBe(await getDb());
  });

  test("a write to the read-only connection is rejected", async () => {
    const { queryRows } = await import("@/lib/data/duckdb");
    await expect(queryRows("CREATE TABLE nope (x INT)")).rejects.toThrow();
  });
});

describe("a missing database file", () => {
  test("fails with a message naming the path and the build command", async () => {
    const { closeDb, queryRows } = await import("@/lib/data/duckdb");
    await closeDb();
    const missing = path.join(dir, "absent.duckdb");
    process.env.DUCKDB_PATH = missing;
    await expect(queryRows("SELECT 1")).rejects.toThrow(missing);
    await expect(queryRows("SELECT 1")).rejects.toThrow("npm run db:build");
    process.env.DUCKDB_PATH = dbPath;
    await closeDb();
  });
});
