/**
 * Compatibility forwarder — the suite moved with the rule into the in-repo
 * package (moonshot batch-6, 6B). Running this path still works:
 *
 *   node eslint-rules/__tests__/no-raw-number-display.test.mjs
 *
 * Canonical suite:
 *   packages/eslint-plugin-civic-transparency/__tests__/no-raw-number-display.test.mjs
 */

import "../../packages/eslint-plugin-civic-transparency/__tests__/no-raw-number-display.test.mjs";
