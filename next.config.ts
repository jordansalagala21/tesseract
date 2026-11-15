import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Hide the dev-only badge: it sits over page content in the bottom-left corner during demos.
  devIndicators: false,
  // DuckDB ships a native binary; keep it out of the server bundle.
  serverExternalPackages: ["@duckdb/node-api"],
  // Files loaded at runtime by path, which the bundler cannot see:
  //  - the CoStar DuckDB database and the recorded demo runs (gitignored sponsor data, uploaded
  //    with `vercel deploy`);
  //  - DuckDB's native library, libduckdb.so, which duckdb.node loads on Linux servers.
  outputFileTracingIncludes: {
    "/**": ["./data/tesseract.duckdb", "./data/demo/*.json", "./node_modules/@duckdb/node-bindings-linux-*/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        // Tailwind processes global stylesheets only. Re-labelling a *.module.css file as plain
        // "*.css" would strip its CSS-module behaviour (unhashed classes, empty imports).
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
