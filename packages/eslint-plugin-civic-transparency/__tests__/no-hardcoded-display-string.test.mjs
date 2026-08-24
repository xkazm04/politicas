/**
 * RuleTester coverage for rules/no-hardcoded-display-string.cjs.
 *
 * Both blocks are drawn from the LIVE population measured 2026-08-24, not from
 * imagined examples — fixtures test the matcher's mechanics, only the
 * population tests its judgement, so the fixtures are copies of the population.
 *
 *   valid   — the technical tail a naive matcher flags: route breadcrumbs,
 *             brand, `IČO`, `č.`/`Sb.`, `psp.cz`, `manifest.json`,
 *             `co_votes_with`, and the `<style>` print block that was the ONE
 *             false positive at the shipped threshold.
 *   invalid — real Czech copy from features/landing/referendum/ReferendumPage.tsx
 *             and features/lawwatch/components/DependencyRadar.tsx, the two
 *             reader surfaces that carry the measured 51-string backlog.
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/no-hardcoded-display-string.test.mjs`
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/no-hardcoded-display-string.cjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-hardcoded-display-string", rule, {
  valid: [
    {
      name: "catalog lookup — the sanctioned path",
      code: `export const X = () => <p>{t("referendum.intro")}</p>;`,
    },
    {
      name: "route breadcrumb (2 letter-words) — the shape that made 3 the threshold",
      code: `export const X = () => <span>/ penize / firma</span>;`,
    },
    {
      name: "brand token",
      code: `export const X = () => <span>Politicas</span>;`,
    },
    {
      name: "domain identifier",
      code: `export const X = () => <span>· psp.cz · co_votes_with</span>;`,
    },
    {
      name: "Czech legal abbreviations arrive as separate one-word nodes",
      code: `export const X = () => <span>č. {n} Sb.</span>;`,
    },
    {
      name: "technical file names",
      code: `export const X = () => <a href={u}>manifest.json</a>;`,
    },
    {
      name: "punctuation-only nodes",
      code: `export const X = () => <span>·</span>;`,
    },
    {
      name: "env-var name in a placeholder",
      code: `export const X = () => <input placeholder="ADMIN_TOKEN" />;`,
    },
    {
      name: "short label in a consumed attribute stays under the threshold",
      code: `export const X = () => <Stat label="Nastavte váhy" />;`,
    },
    {
      name: "a print stylesheet is CSS, not copy (the one measured false positive)",
      code:
        "export const X = () => <style>{`@media print { html[data-poster-mode] [data-doc] { visibility: visible; } }`}</style>;",
    },
    {
      name: "inline script content is not copy either",
      code: `export const X = () => <script>{"var a = 1; var b = 2; var c = 3;"}</script>;`,
    },
    {
      name: "attributes outside the consumed set are not display surfaces",
      code: `export const X = () => <div data-note="tohle je jen technická poznámka" />;`,
    },
    {
      name: "escape hatch with a reason, same line",
      code: `export const X = () => <span>/ penize / firma / detail</span>; // i18n-ok: route breadcrumb, not copy`,
    },
    {
      name: "escape hatch on the line above",
      code: [
        "export const X = () => (",
        "  // i18n-ok: technical identifier triple, not copy",
        "  <span>alfa beta gama</span>",
        ");",
      ].join("\n"),
    },
    {
      name: "multi-line escape-hatch reason counts by its END line",
      code: [
        "export const X = () => (",
        "  /* i18n-ok: this reason runs over",
        "     more than one line on purpose */",
        "  <span>alfa beta gama</span>",
        ");",
      ].join("\n"),
    },
  ],
  invalid: [
    {
      name: "real copy from ReferendumPage (JSX text)",
      code: `export const X = () => <h2>Kolik váží dobrý poslanec</h2>;`,
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "real copy from DependencyRadar (JSX text)",
      code: `export const X = () => <p>census závislostí není k dispozici</p>;`,
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "string literal laundered through a JSX expression container",
      code: `export const X = () => <p>{"Odevzdat můj vektor"}</p>;`,
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "both branches of a ternary in child position",
      code: `export const X = ({ ok }) => <p>{ok ? "hlas byl uložen v pořádku" : "hlas se nepodařilo uložit"}</p>;`,
      errors: [{ messageId: "hardcodedText" }, { messageId: "hardcodedText" }],
    },
    {
      name: "the fallback side of a logical expression",
      code: `export const X = ({ s }) => <p>{s || "agregát teď není k dispozici"}</p>;`,
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "title attribute — read by users",
      code: `export const X = () => <section title="Žebříček pod vaší čočkou" />;`,
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "aria-label — read by screen readers",
      code: `export const X = () => <div aria-label="filtr fronty podle třídy vazby" />;`,
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "placeholder",
      code: `export const X = () => <input placeholder="důvod vrácení ke kontrole — povinný" />;`,
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "alt text",
      code: `export const X = () => <img src={s} alt="graf peněžní stopy mezi poslanci" />;`,
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "the repo's own label prop convention",
      code: `export const X = () => <Row label="peníze u firem poslanců" />;`,
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "attribute value in an expression container",
      code: `export const X = () => <div aria-label={"filtr fronty podle třídy"} />;`,
      errors: [{ messageId: "hardcodedAttr" }],
    },
    {
      name: "template literal with no interpolation is still a literal",
      code: "export const X = () => <p>{`Odevzdat můj vektor vah`}</p>;",
      errors: [{ messageId: "hardcodedText" }],
    },
    {
      name: "an unrelated comment does not open the hatch",
      code: `export const X = () => <p>Kolik váží dobrý poslanec</p>; // TODO: extract later`,
      errors: [{ messageId: "hardcodedText" }],
    },
  ],
});

console.log("PASS no-hardcoded-display-string (RuleTester)");
