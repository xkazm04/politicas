/**
 * eslint-plugin-civic-transparency — the politicas lint doctrine as a plugin.
 *
 * Eight flat-config rules that make editorial guarantees machine-enforced:
 * no swallowed errors, no silent loader degradation, a hard server/client
 * boundary, keyboard operability, WCAG 2.3.3 motion safety, design-token
 * color discipline, and the two provenance doctrine rules (every rendered
 * number carries its source; formatting happens once, in one chokepoint).
 *
 * Consumption (flat config):
 *
 *   const civic = require("eslint-plugin-civic-transparency");
 *   export default [
 *     ...civic.configs.recommended,   // the generic discipline, adoptable as-is
 *     // ...civic.configs.strict,     // adds the provenance doctrine at error
 *   ];
 *
 * Or register the plugin under your own prefix and pick severities yourself —
 * the politicas repo registers it as `custom` to keep its historical rule IDs
 * (see the repo's eslint.config.mjs).
 *
 * Per-rule docs live in docs/rules/<rule>.md (when it fires, escape hatches,
 * why it exists). The adoption guide is README.md.
 */

const pkg = require("./package.json");

const plugin = {
  meta: {
    name: pkg.name,
    version: pkg.version,
  },
  rules: {
    "no-silent-catch": require("./rules/no-silent-catch.cjs"),
    "no-silent-null-catch": require("./rules/no-silent-null-catch.cjs"),
    "no-server-import-in-client": require("./rules/no-server-import-in-client.cjs"),
    "role-button-requires-keydown": require("./rules/role-button-requires-keydown.cjs"),
    "enforce-reduced-motion-fallback": require("./rules/enforce-reduced-motion-fallback.cjs"),
    "no-hardcoded-colors": require("./rules/no-hardcoded-colors.cjs"),
    "require-source-citation": require("./rules/require-source-citation.cjs"),
    "no-raw-number-display": require("./rules/no-raw-number-display.cjs"),
  },
  configs: {},
};

// Flat-config presets. Each is an ARRAY of config objects (spread it into your
// config), self-referencing the plugin under the canonical prefix
// `civic-transparency`.
//
// `recommended` — the generic discipline, adoptable by any TS/React repo:
//   the five portable rules at `error`, plus the two rules whose fix paths
//   name project-specific conventions at `warn` (no-hardcoded-colors expects
//   a design-token layer; no-silent-null-catch expects a reportLoaderFailure
//   helper — see their docs for how to map those onto your project).
//
// `strict` — everything at `error`, including the provenance doctrine rules
//   (require-source-citation, no-raw-number-display). Only adopt these two if
//   your project has a formatting chokepoint shaped like lib/format.ts and
//   provenance components shaped like SourceNote — they are the politicas
//   doctrine made portable, not a generic best practice.
plugin.configs.recommended = [
  {
    name: "civic-transparency/recommended",
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: { "civic-transparency": plugin },
    rules: {
      "civic-transparency/no-silent-catch": "error",
      "civic-transparency/no-server-import-in-client": "error",
      "civic-transparency/role-button-requires-keydown": "error",
      "civic-transparency/enforce-reduced-motion-fallback": "error",
      "civic-transparency/no-hardcoded-colors": "warn",
      "civic-transparency/no-silent-null-catch": "warn",
    },
  },
];

plugin.configs.strict = [
  {
    name: "civic-transparency/strict",
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: { "civic-transparency": plugin },
    rules: {
      "civic-transparency/no-silent-catch": "error",
      "civic-transparency/no-server-import-in-client": "error",
      "civic-transparency/role-button-requires-keydown": "error",
      "civic-transparency/enforce-reduced-motion-fallback": "error",
      "civic-transparency/no-hardcoded-colors": "error",
      "civic-transparency/no-silent-null-catch": "error",
      "civic-transparency/require-source-citation": "error",
      "civic-transparency/no-raw-number-display": "error",
    },
  },
];

module.exports = plugin;
