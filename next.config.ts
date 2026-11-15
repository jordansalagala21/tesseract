import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Hide the dev-only badge: it sits over page content in the bottom-left corner during demos.
  devIndicators: false,
  // DuckDB ships a native binary; keep it out of the server bundle.
  serverExternalPackages: ["@duckdb/node-api"],
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
