/**
 * RuleTester coverage for rules/role-button-requires-keydown.cjs.
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/role-button-requires-keydown.test.mjs`
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/role-button-requires-keydown.cjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("role-button-requires-keydown", rule, {
  valid: [
    {
      name: "a real button needs nothing extra",
      code: `export const X = () => <button onClick={go}>ok</button>;`,
    },
    {
      name: "role=button with both onClick and onKeyDown",
      code: `export const X = () => <div role="button" tabIndex={0} onClick={go} onKeyDown={onKey}>ok</div>;`,
    },
    {
      name: "role=button without onClick is not activation",
      code: `export const X = () => <div role="button">ok</div>;`,
    },
    {
      name: "other roles are out of scope",
      code: `export const X = () => <div role="tab" onClick={go}>ok</div>;`,
    },
    {
      name: "dynamic role expression is not statically button",
      code: `export const X = ({ r }) => <div role={r} onClick={go}>ok</div>;`,
    },
  ],
  invalid: [
    {
      name: "div with role=button and onClick but no keyboard path",
      code: `export const X = () => <div role="button" onClick={go}>ok</div>;`,
      errors: [{ messageId: "missingKeyDown" }],
    },
    {
      name: "role literal inside an expression container still matches",
      code: `export const X = () => <span role={"button"} onClick={go}>ok</span>;`,
      errors: [{ messageId: "missingKeyDown" }],
    },
  ],
});

console.log("PASS role-button-requires-keydown (RuleTester)");
