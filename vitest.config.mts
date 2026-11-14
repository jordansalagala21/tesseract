import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws unless the bundler resolves the "react-server" condition, which
      // vitest's node environment does not. Point it at the package's own empty.js so
      // server-only modules (lib/data/duckdb.ts, lib/config/env.ts) stay unit-testable.
      // The guard is unaffected in the Next build, which resolves the real module.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
