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
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
