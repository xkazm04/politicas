/**
 * What every lane shares: module resolution, and nothing else.
 *
 * Deliberately NOT here: timeouts, worker caps, includes, reporters. Those are the
 * things that differ per lane, and test-harness/suite-partitioning is explicit that
 * a shared config with per-lane overrides inside it is the drift machine that
 * per-suite files exist to avoid. If you find yourself adding a budget here, you
 * are re-merging the lanes.
 */

import { fileURLToPath } from "node:url";

export const sharedResolve = {
  alias: {
    // `server-only` throws outside a React Server environment; tests that import
    // feature loaders get an empty stub instead.
    "server-only": fileURLToPath(new URL("./lib/testing/server-only-stub.ts", import.meta.url)),
    "@": fileURLToPath(new URL(".", import.meta.url)),
  },
};
