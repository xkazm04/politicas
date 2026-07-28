import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The unit suite runs over lib/**/*.test.ts (domain data + the data layer) and
// scripts/**/*.test.ts (pure-function regression tests for data-analysis/case-loop
// scripts, e.g. kg-promote.test.ts — batch 004, D-gap-1). The `@/` alias mirrors
// tsconfig `paths` so a test can import a module the same way the app does; without
// it, only relative imports resolve under vitest.
export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws outside a React Server environment; tests that
      // import feature loaders get an empty stub instead.
      "server-only": fileURLToPath(new URL("./lib/testing/server-only-stub.ts", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // `features/**/*.test.ts` joined the suite 2026-07-28: the Velín graph slice
    // is a PURE builder that lives beside the feature that owns it (it consumes
    // the money/law projections, so lib/ is the wrong home) — and an invariant
    // test that never runs is not an invariant.
    include: ["lib/**/*.test.ts", "features/**/*.test.ts", "scripts/**/*.test.ts"],
    // Five test files boot a real PGlite (WASM Postgres) in parallel workers;
    // the boots contend and any first-in-file test can blow the 5s default.
    testTimeout: 30_000,
  },
});
