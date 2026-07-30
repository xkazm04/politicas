/**
 * RuleTester coverage for rules/no-raw-number-display.cjs.
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/no-raw-number-display.test.mjs`
 * (see require-source-citation.test.mjs header for the pack's testing precedent.)
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/no-raw-number-display.cjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-raw-number-display", rule, {
  valid: [
    {
      name: "house formatters are the sanctioned path",
      code: `import { useFormat } from "@/lib/i18n/useFormat";
             export function X({ n }) { const f = useFormat(); return <span>{f.dec(n)}</span>; }`,
    },
    {
      name: "unrelated method names are untouched",
      code: `const s = value.toString(); const t = row.toLocale;`,
    },
    {
      name: "computed access is not a formatter call site",
      code: `const s = n["toFixed"];`,
    },
    {
      name: "raw-format-ok annotation on the line",
      code: `const pct = (w * 100).toFixed(0); // raw-format-ok: build-time static methodology table`,
    },
    {
      name: "raw-format-ok annotation on the line above",
      code: `// raw-format-ok: admin-only console, never server-rendered
             const s = n.toLocaleString("cs-CZ");`,
    },
  ],
  invalid: [
    {
      name: "toFixed",
      code: `const s = n.toFixed(1);`,
      errors: [{ messageId: "rawFormat", data: { method: "toFixed" } }],
    },
    {
      name: "toLocaleString",
      code: `const s = n.toLocaleString("cs-CZ");`,
      errors: [{ messageId: "rawFormat", data: { method: "toLocaleString" } }],
    },
    {
      name: "toLocaleDateString",
      code: `const s = d.toLocaleDateString("cs-CZ");`,
      errors: [{ messageId: "rawFormat", data: { method: "toLocaleDateString" } }],
    },
    {
      name: "toLocaleTimeString in JSX",
      code: `export function X({ d }) { return <span>{d.toLocaleTimeString()}</span>; }`,
      errors: [{ messageId: "rawFormat", data: { method: "toLocaleTimeString" } }],
    },
    {
      name: "two call sites report twice",
      code: `const s = a.toFixed(1) + b.toFixed(1);`,
      errors: [{ messageId: "rawFormat" }, { messageId: "rawFormat" }],
    },
  ],
});

console.log("PASS no-raw-number-display (RuleTester)");
