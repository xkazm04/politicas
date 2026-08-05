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
    // `packages/*/src/**/*.test.ts` joined 2026-07-30 (moonshot 6A): the
    // czech-civic-data extraction moved the UNL/cp1250/zip/fold suite into the
    // package; including it here keeps `npm test` covering the whole repo (the
    // package also runs standalone via its own vitest.config.ts).
    include: [
      "lib/**/*.test.ts",
      "features/**/*.test.ts",
      "scripts/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
    ],
    // Five test files boot a real PGlite (WASM Postgres) in parallel workers;
    // the boots contend and any first-in-file test can blow the 5s default.
    // (Raised 30s -> 60s 2026-08-05: the sentinel fixture-store tests were
    // observed at ~33s under full-suite parallel load in pre-push runs.)
    testTimeout: 60_000,
    // Same contention hits the beforeAll hooks that `await open()` a PGlite —
    // the default 10s hookTimeout flakes under full-suite parallel load
    // (observed in pre-push runs: review/weights/kg-money-reingest suites).
    hookTimeout: 60_000,
  },
});
