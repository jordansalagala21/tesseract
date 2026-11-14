// Test stub for the `server-only` package, which throws unless the importer resolves React's
// "react-server" condition — vitest's node environment does not. Aliased in vitest.config.mts
// so server-only modules (lib/data/duckdb.ts, lib/config/env.ts) stay unit-testable.
//
// Deliberately narrow: resolving the react-server condition globally would make every test
// import React's server build, breaking any future client-component test that uses hooks.
// The real guard is unaffected in the Next build.
export {};
