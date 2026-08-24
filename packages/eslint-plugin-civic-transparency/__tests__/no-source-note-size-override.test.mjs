/**
 * RuleTester coverage for rules/no-source-note-size-override.cjs.
 *
 * The `valid` block is drawn from the LIVE population, not from imagined
 * counter-examples: `!text-ochre`, `!text-cobalt`, `!${tone.text}`,
 * `normal-case tracking-wider`, `min-w-0 truncate` and `mt-*` are all real
 * SourceNote call sites in features/** on 2026-08-24, and every one of them
 * must stay silent. The `invalid` block reproduces the shapes commit 776f01a
 * removed (72 sites: 66 at 10 px, 6 at 11 px).
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/no-source-note-size-override.test.mjs`
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/no-source-note-size-override.cjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-source-note-size-override", rule, {
  valid: [
    {
      name: "spacing-only className — the dominant real shape",
      code: `export const X = () => <SourceNote className="mt-3">{s}</SourceNote>;`,
    },
    {
      name: "colour override with the important marker is deliberate and stays legal",
      code: `export const X = () => <SourceNote tone="steel" className="!text-ochre">{s}</SourceNote>;`,
    },
    {
      name: "another live colour override",
      code: `export const X = () => <SourceNote tone="steel" className="!text-cobalt">{s}</SourceNote>;`,
    },
    {
      name: "case/tracking overrides are not font-size",
      code: `export const X = () => <SourceNote className="normal-case tracking-wider">{s}</SourceNote>;`,
    },
    {
      name: "layout utilities that merely contain the letters text",
      code: `export const X = () => <SourceNote className="min-w-0 truncate text-balance">{s}</SourceNote>;`,
    },
    {
      name: "arbitrary COLOUR value is not a size",
      code: `export const X = () => <SourceNote className="text-[#c8102e]">{s}</SourceNote>;`,
    },
    {
      name: "arbitrary var() without a length hint is treated as a colour",
      code: `export const X = () => <SourceNote className="text-[var(--color-ochre)]">{s}</SourceNote>;`,
    },
    {
      name: "opacity-modified colour token",
      code: `export const X = () => <SourceNote tone="paper" className="text-paper/90">{s}</SourceNote>;`,
    },
    {
      name: "template literal whose static text carries no size (live: !${tone.text})",
      code: "export const X = ({ tone }) => <SourceNote tone=\"steel\" className={`!${tone.text}`}>{s}</SourceNote>;",
    },
    {
      name: "the documented escape hatch — mode, not size",
      code: `export const X = () => <SourceNote as="label" className="mt-2">{s}</SourceNote>;`,
    },
    {
      name: "a size utility on some OTHER element is none of this rule's business",
      code: `export const X = () => <span className="text-[10px]">{s}</span>;`,
    },
    {
      name: "KNOWN RECALL GAP, recorded not fixed: a class string laundered through an identifier is invisible to the static matcher (features/money/components/BasisDisclosure.tsx:61)",
      code: `export const X = ({ className = "mt-2 !text-[10px]" }) => <SourceNote className={className}>{s}</SourceNote>;`,
    },
  ],
  invalid: [
    {
      name: "the exact shape DESIGN.md §3 forbids",
      code: `export const X = () => <SourceNote className="!text-[10px]">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "the 11 px variant (6 of the 72 removed sites)",
      code: `export const X = () => <SourceNote className="mt-1 !text-[11px]">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "no important marker — still a second font-size, now decided by stylesheet order",
      code: `export const X = () => <SourceNote className="text-[10px] mt-2">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "named scale, including a redundant text-xs (the seed of the next 10px)",
      code: `export const X = () => <SourceNote className="text-xs">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "named scale, larger",
      code: `export const X = () => <SourceNote className="text-sm mt-4">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "rem-valued arbitrary size",
      code: `export const X = () => <SourceNote className="text-[0.625rem]">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "responsive variant prefix is stripped before matching",
      code: `export const X = () => <SourceNote className="sm:!text-[10px]">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "bracketed variant prefix does not confuse the bracket-aware split",
      code: `export const X = () => <SourceNote className="data-[state=open]:text-[10px]">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "Tailwind v4 postfix important marker",
      code: `export const X = () => <SourceNote className="text-[10px]!">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "explicit length hint on a CSS variable",
      code: `export const X = () => <SourceNote className="text-[length:var(--tiny)]">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "line-height modifier does not hide the size",
      code: `export const X = () => <SourceNote className="text-[10px]/[1.4]">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "static quasi of a template literal className",
      code: "export const X = ({ extra }) => <SourceNote className={`!text-[10px] ${extra}`}>{s}</SourceNote>;",
      errors: [{ messageId: "sizeOverride" }],
    },
    {
      name: "two size utilities in one className report twice",
      code: `export const X = () => <SourceNote className="text-xs sm:text-[10px]">{s}</SourceNote>;`,
      errors: [{ messageId: "sizeOverride" }, { messageId: "sizeOverride" }],
    },
  ],
});

console.log("PASS no-source-note-size-override (RuleTester)");
