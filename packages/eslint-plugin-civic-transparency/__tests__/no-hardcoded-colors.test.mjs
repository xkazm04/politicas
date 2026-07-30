/**
 * RuleTester coverage for rules/no-hardcoded-colors.cjs.
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/no-hardcoded-colors.test.mjs`
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/no-hardcoded-colors.cjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-hardcoded-colors", rule, {
  valid: [
    {
      name: "token classes are the sanctioned path",
      code: `export const X = () => <div className="bg-paper text-ink" />;`,
    },
    {
      name: "href fragment that happens to be hex-shaped",
      code: `export const X = () => <a href="#deadbe">kotva</a>;`,
    },
    {
      name: "DOM id that parses as short hex",
      code: `export const X = () => <section id="a3f5c9" />;`,
    },
    {
      name: "aria-* values never carry CSS colors",
      code: `export const X = () => <div aria-describedby="fff" />;`,
    },
    {
      name: "template literal in a non-color attribute",
      code: "export const X = ({ sha }) => <a href={`#${sha}fff`}>diff</a>;",
    },
    {
      name: "plain word containing rgb letters is not a color function",
      code: `const s = "rgbish text";`,
    },
  ],
  invalid: [
    {
      name: "hex literal in className",
      code: `export const X = () => <div className="text-[#ff0000]" />;`,
      errors: [{ messageId: "hardcodedColor" }],
    },
    {
      name: "hex literal in a style string constant",
      code: `const ACCENT = "#c8102e";`,
      errors: [{ messageId: "hardcodedColor" }],
    },
    {
      name: "rgba() call syntax in a string",
      code: `const shadow = "0 1px rgba(0,0,0,0.2)";`,
      errors: [{ messageId: "hardcodedColor" }],
    },
    {
      name: "hsl() in a template literal",
      code: "const bg = `hsl(${h}, 40%, 50%)`;",
      errors: [{ messageId: "hardcodedColor" }],
    },
    {
      name: "hex inside a template literal className",
      code: "export const X = () => <div className={`border-[#00ff00] p-2`} />;",
      errors: [{ messageId: "hardcodedColor" }],
    },
  ],
});

console.log("PASS no-hardcoded-colors (RuleTester)");
