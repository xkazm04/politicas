/**
 * Runs every RuleTester suite in this directory, plus the plugin surface
 * checks (index.cjs shape + preset parity). Exits non-zero on the first
 * failure. Plain node, no runner dependency:
 *
 *   node packages/eslint-plugin-civic-transparency/__tests__/run-all.mjs
 */

import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── 1. Every *.test.mjs suite (each throws on failure, prints its own PASS) ──
const suites = readdirSync(here)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

for (const suite of suites) {
  await import(pathToFileURL(join(here, suite)).href);
}

// ── 2. Plugin surface: every rule exported, every preset resolvable ──────────
const plugin = require("../index.cjs");

const EXPECTED_RULES = [
  "enforce-reduced-motion-fallback",
  "no-hardcoded-colors",
  "no-raw-number-display",
  "no-server-import-in-client",
  "no-silent-catch",
  "no-silent-null-catch",
  "require-source-citation",
  "role-button-requires-keydown",
];

assert.deepEqual(Object.keys(plugin.rules).sort(), EXPECTED_RULES, "plugin.rules exports all 8 rules");
for (const [name, rule] of Object.entries(plugin.rules)) {
  assert.equal(typeof rule.create, "function", `${name} has a create()`);
  assert.ok(rule.meta && rule.meta.docs && rule.meta.docs.description, `${name} has meta.docs.description`);
}
assert.ok(plugin.meta.name === "eslint-plugin-civic-transparency", "plugin meta.name");

for (const presetName of ["recommended", "strict"]) {
  const preset = plugin.configs[presetName];
  assert.ok(Array.isArray(preset) && preset.length > 0, `configs.${presetName} is a flat-config array`);
  for (const block of preset) {
    assert.equal(block.plugins["civic-transparency"], plugin, `${presetName} self-references the plugin`);
    for (const ruleId of Object.keys(block.rules)) {
      const bare = ruleId.replace(/^civic-transparency\//, "");
      assert.ok(plugin.rules[bare], `${presetName} rule ${ruleId} resolves to an exported rule`);
    }
  }
}
// strict covers every rule; recommended covers everything except the doctrine pair.
const strictRules = Object.keys(plugin.configs.strict[0].rules).map((r) => r.split("/")[1]).sort();
assert.deepEqual(strictRules, EXPECTED_RULES, "strict preset enables all 8 rules");

// ── 3. Shim equivalence: the eslint-rules/ compat shims re-export these ──────
// (skipped gracefully if the shims are absent, e.g. when the package is
// consumed standalone outside the politicas repo)
try {
  for (const name of EXPECTED_RULES) {
    const shim = require(`../../../eslint-rules/${name}.cjs`);
    assert.equal(shim, plugin.rules[name], `eslint-rules/${name}.cjs shim re-exports the package rule`);
  }
  console.log("PASS shim equivalence (eslint-rules/*.cjs === plugin.rules)");
} catch (err) {
  if (err && err.code === "MODULE_NOT_FOUND") {
    console.log("SKIP shim equivalence (standalone package checkout)");
  } else {
    throw err;
  }
}

console.log(`PASS run-all (${suites.length} suites + plugin surface checks)`);
