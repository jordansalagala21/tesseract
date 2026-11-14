import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
    // `server-only` exports a module that throws unless the importer resolves the "react-server"
    // condition. Next does; vitest's node environment does not, which would make every
    // server-only module (lib/data/duckdb.ts, lib/config/env.ts) impossible to unit-test.
    // Resolving the condition keeps the REAL package in play rather than stubbing the guard out.
    conditions: ["react-server", "node", "import", "module", "default"],
  },
  ssr: {
    resolve: { conditions: ["react-server", "node", "import", "module", "default"] },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
