// Standalone runner: `npm test` inside packages/czech-civic-data runs only the
// package's own suite. The politicas root vitest config ALSO includes these
// files, so the same tests gate the app's `npm run check`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
