/**
 * RuleTester coverage for rules/require-source-citation.cjs.
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/require-source-citation.test.mjs`
 * (RuleTester throws AssertionError on the first failing case; a clean run
 * prints PASS. This is the testing precedent for the eslint-rules pack —
 * plain node, no runner dependency, no config outside the pack's surface.)
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/require-source-citation.cjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const FORMAT_IMPORT = `import { useFormat } from "@/lib/i18n/useFormat";\n`;

tester.run("require-source-citation", rule, {
  valid: [
    {
      name: "figure with SourceNote in the same file",
      code:
        FORMAT_IMPORT +
        `import SourceNote from "@/features/shared/components/SourceNote";
         export function Score({ n }) {
           const f = useFormat();
           return (<div><span>{f.int(n)}</span><SourceNote>zdroj: PSP hlasování</SourceNote></div>);
         }`,
    },
    {
      name: "figure with DataUnavailable disclosure in the same file",
      code:
        FORMAT_IMPORT +
        `import DataUnavailable from "@/features/shared/components/DataUnavailable";
         export function Score({ n }) {
           const f = useFormat();
           return n == null ? <DataUnavailable /> : <span>{f.dec(n)}</span>;
         }`,
    },
    {
      name: "explicit data-undisclosed marker satisfies the file",
      code:
        FORMAT_IMPORT +
        `export function Score({ n }) {
           const f = useFormat();
           return (<div data-undisclosed><span>{f.czk(n)}</span></div>);
         }`,
    },
    {
      name: "per-site citation-ok annotation",
      code:
        FORMAT_IMPORT +
        `export function Cell({ n }) {
           const f = useFormat();
           // citation-ok: SourceNote renders in the parent DossierSection
           return <span>{f.int(n)}</span>;
         }`,
    },
    {
      name: "member call without a chokepoint import is not a house formatter",
      code: `export function X({ api, n }) { return <span>{api.int(n)}</span>; }`,
    },
    {
      name: "formatter in a JSX attribute is not a rendered claim",
      code:
        FORMAT_IMPORT +
        `export function X({ n }) {
           const f = useFormat();
           return <button aria-label={f.int(n)}>vybrat</button>;
         }`,
    },
    {
      name: "dates are context, not claims",
      code:
        FORMAT_IMPORT +
        `export function X({ iso }) {
           const f = useFormat();
           return <time>{f.date(iso)}</time>;
         }`,
    },
    {
      name: "imported formatter used outside JSX render position",
      code: `import { formatCzk } from "@/lib/format";
             export const label = (n) => formatCzk(n, "cs");`,
    },
    {
      name: "AnimatedScore accompanied by SourceNote",
      code: `import AnimatedScore from "@/features/shared/components/AnimatedScore";
             import SourceNote from "@/features/shared/components/SourceNote";
             export function X({ n }) {
               return (<div><AnimatedScore value={n} /><SourceNote>metodika v2</SourceNote></div>);
             }`,
    },
  ],
  invalid: [
    {
      name: "bound-formatter figure with no provenance marker",
      code:
        FORMAT_IMPORT +
        `export function Score({ n }) {
           const f = useFormat();
           return <span>{f.int(n)}</span>;
         }`,
      errors: [{ messageId: "uncitedFigure" }],
    },
    {
      name: "named chokepoint formatter rendered uncited",
      code: `import { formatCzk } from "@/lib/format";
             export function X({ n }) { return <b>{formatCzk(n, "cs")}</b>; }`,
      errors: [{ messageId: "uncitedFigure" }],
    },
    {
      name: "renamed import still tracked by local name",
      code: `import { formatInt as fi } from "@/lib/format";
             export function X({ n }) { return <b>{fi(n, "cs")}</b>; }`,
      errors: [{ messageId: "uncitedFigure" }],
    },
    {
      name: "compactCzk from moneyTypes is a money figure",
      code: `import { compactCzk } from "@/features/money/moneyTypes";
             export function X({ n }) { return <span>{compactCzk(n, "cs")}</span>; }`,
      errors: [{ messageId: "uncitedFigure" }],
    },
    {
      name: "AnimatedScore without any provenance marker",
      code: `import AnimatedScore from "@/features/shared/components/AnimatedScore";
             export function X({ n }) { return <AnimatedScore value={n} />; }`,
      errors: [{ messageId: "uncitedFigure" }],
    },
    {
      name: "figure rendered inside a map callback",
      code:
        FORMAT_IMPORT +
        `export function List({ rows }) {
           const f = useFormat();
           return <ul>{rows.map((r) => <li key={r.id}>{f.dec(r.score)}</li>)}</ul>;
         }`,
      errors: [{ messageId: "uncitedFigure" }],
    },
  ],
});

console.log("PASS require-source-citation (RuleTester)");
