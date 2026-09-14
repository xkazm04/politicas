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
      name: "a MULTI-LINE citation-ok reason counts (it ends on the line above)",
      code:
        FORMAT_IMPORT +
        `export function Row({ n }) {
           const f = useFormat();
           return (<span>
             {/* citation-ok: the source renders inline as a plain string
                 immediately after this figure, on the same row */}
             {f.int(n)}
           </span>);
         }`,
    },
    {
      name: "PosterFrame HANDED a citation is the print lane's provenance renderer",
      code:
        FORMAT_IMPORT +
        `import PosterFrame from "@/features/shared/poster/PosterFrame";
         import { buildPosterCitation } from "@/features/shared/poster/citation";
         export function Sheet({ data }) {
           const f = useFormat();
           const citation = buildPosterCitation(data);
           return (<PosterFrame citation={citation}><b>{f.dec(data.avg)}</b></PosterFrame>);
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
      name: "formatCompactCzk from the chokepoint is a money figure (the deník renders it)",
      code: `import { formatCompactCzk } from "@/lib/format";
             export function X({ n }) { return <span>{formatCompactCzk(n, "cs")}</span>; }`,
      errors: [{ messageId: "uncitedFigure" }],
    },
    {
      name: "formatByKind from the chokepoint is a figure of whichever kind",
      code: `import { formatByKind } from "@/lib/format";
             export function X({ n }) { return <span>{formatByKind(n, "cs", "int")}</span>; }`,
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
      name: "PosterFrame WITHOUT a citation prop satisfies nothing — the prop is the evidence",
      code:
        FORMAT_IMPORT +
        `import PosterFrame from "@/features/shared/poster/PosterFrame";
         export function Sheet({ data }) {
           const f = useFormat();
           return (<PosterFrame><b>{f.dec(data.avg)}</b></PosterFrame>);
         }`,
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

// ── Census mode (option `{ census: true }`) ─────────────────────────────────
// The coverage denominator. Every case here is a file the GATE is silent about;
// census reports it anyway, tagged with the state that made the gate silent.
tester.run("require-source-citation (census)", rule, {
  valid: [
    {
      name: "census reports nothing when nothing is a rendered figure",
      options: [{ census: true }],
      code: FORMAT_IMPORT + `export function Note() { return <p>bez čísel</p>; }`,
    },
    {
      name: "a formatter call the file never imported is not a census row either",
      options: [{ census: true }],
      code: `export function Row({ n }) { return <span>{czech(n)}</span>; }`,
    },
  ],
  invalid: [
    {
      name: "a CITED figure is a census row — that is the denominator the gate cannot give",
      options: [{ census: true }],
      code:
        FORMAT_IMPORT +
        `import SourceNote from "@/features/shared/components/SourceNote";
         export function Score({ n }) {
           const f = useFormat();
           return (<div><span>{f.int(n)}</span><SourceNote>zdroj: PSP</SourceNote></div>);
         }`,
      errors: [{ messageId: "censusFigure", data: { state: "cited" } }],
    },
    {
      name: "a citation-ok site counts as DECLARED, not as absent",
      options: [{ census: true }],
      code:
        FORMAT_IMPORT +
        `export function Row({ n }) {
           const f = useFormat();
           // citation-ok: the parent renders the source next to this row
           return (<span>{f.int(n)}</span>);
         }`,
      errors: [{ messageId: "censusFigure", data: { state: "declared" } }],
    },
    {
      name: "an uncited figure is reported as UNCITED — census and gate agree on the count",
      options: [{ census: true }],
      code:
        FORMAT_IMPORT +
        `export function Row({ n }) {
           const f = useFormat();
           return (<span>{f.dec(n)}</span>);
         }`,
      errors: [{ messageId: "censusFigure", data: { state: "uncited" } }],
    },
  ],
});

console.log("PASS require-source-citation (RuleTester)");
