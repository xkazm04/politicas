# eslint-plugin-civic-transparency

The [politicas](../../README.md) lint doctrine, packaged as a flat-config ESLint
plugin. Eight rules that turn editorial guarantees into build gates: no silent
failures, a hard server/client boundary, keyboard operability, motion safety,
design-token color discipline — and the flagship pair that makes **number
provenance machine-enforced**: an uncited rendered figure fails lint.

Battle-tested as the politicas repo's own lint layer (this repo is the first
consumer, via `eslint.config.mjs` at the root). Dependency-free rule
implementations; ESLint ≥ 9 (flat config) as a peer.

> **Status: in-repo package.** Not yet published to npm — consume it by path
> (see below). The public faces of the same ecosystem story: the
> [`czech-civic-data`](../czech-civic-data/README.md) parsing library, and the
> live surfaces at [politicas `/data`](https://politicas.cz/data) and
> [`/atlas`](https://politicas.cz/atlas).

## Rules

| Rule | Guards | recommended | strict |
| --- | --- | --- | --- |
| [`no-silent-catch`](docs/rules/no-silent-catch.md) | no swallowed errors | error | error |
| [`no-silent-null-catch`](docs/rules/no-silent-null-catch.md) | loader degradations leave a trace | warn | error |
| [`no-server-import-in-client`](docs/rules/no-server-import-in-client.md) | server/client bundle boundary | error | error |
| [`role-button-requires-keydown`](docs/rules/role-button-requires-keydown.md) | keyboard operability (WCAG 2.1.1) | error | error |
| [`enforce-reduced-motion-fallback`](docs/rules/enforce-reduced-motion-fallback.md) | looping motion is gated (WCAG 2.3.3) | error | error |
| [`no-hardcoded-colors`](docs/rules/no-hardcoded-colors.md) | design-token color discipline | warn | error |
| [`require-source-citation`](docs/rules/require-source-citation.md) | **doctrine**: rendered figures carry provenance | — | error |
| [`no-raw-number-display`](docs/rules/no-raw-number-display.md) | **doctrine**: formatting only via the chokepoint | — | error |

Each rule doc covers **when it fires**, **escape hatches**, and **why it
exists** — read the doc before adopting a rule; several are convention-driven
and tell you exactly which constants to map onto your project.

## Adoption

### 1. Get the package

Until an npm publish, vendor the directory (it is self-contained:
`index.cjs` + `rules/` + docs) or consume it from a monorepo path.

### 2. Wire it into flat config

Presets — spread into your `eslint.config.mjs`:

```js
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const civic = require("./packages/eslint-plugin-civic-transparency/index.cjs");

export default [
  // ...your base configs...
  ...civic.configs.recommended,
  // ...civic.configs.strict,  // when your architecture supports the doctrine pair
];
```

- **`recommended`** — the portable discipline for any TS/React repo. The five
  generic rules at `error`; `no-hardcoded-colors` and `no-silent-null-catch` at
  `warn` because their fix paths name project conventions (a token layer, a
  `reportLoaderFailure` helper) you need to map first.
- **`strict`** — everything at `error`, including the provenance doctrine.
  Only adopt the doctrine pair if you have a formatting chokepoint and
  provenance components (see their docs).

Or register the plugin under your own prefix and choose severities per scope —
what politicas itself does (prefix `custom`, historical):

```js
export default [
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { custom: civic },
    rules: {
      "custom/no-silent-catch": "error",
      // ...
    },
  },
];
```

### 3. Scope, then escalate

The pack's severity policy, learned the useful way:

1. **Declare exemption zones in config, not inline** — palette mirrors, archived
   art directions, data-as-color modules (`no-hardcoded-colors` doc has the
   pattern). One readable list of declared exceptions beats scattered disables.
2. **Warn-first burn-down for the doctrine rules** — measure the violation
   inventory, ship at `warn`, burn a module down, then move that glob to
   `error`. Never flip a scope to `error` while it still warns.
3. **Escape hatches carry reasons** — `// citation-ok: <reason>`,
   `// raw-format-ok: <reason>`, `// reduced-motion-ok: <reason>`. All grep-able;
   a bare disable is not an audit trail.

## Testing

RuleTester suites for all eight rules, plain node, no runner dependency:

```
node packages/eslint-plugin-civic-transparency/__tests__/run-all.mjs
```

A failing case throws (non-zero exit); a clean run prints one `PASS` line per
suite plus plugin-surface checks (every rule exported, presets resolvable,
compat shims equivalent). Single suites run directly:
`node packages/eslint-plugin-civic-transparency/__tests__/<rule>.test.mjs`.

New rules ship with positive, negative, and escape-hatch cases in this shape.

## Layout

```
index.cjs            plugin object: meta + rules + configs.{recommended,strict}
rules/*.cjs          rule implementations (header comment = canonical rationale)
docs/rules/*.md      per-rule adoption docs (when-it-fires / escape hatches / why)
__tests__/           RuleTester suites + run-all runner
```

The politicas repo keeps `eslint-rules/*.cjs` at the root as compatibility
shims re-exporting these rules; `run-all.mjs` asserts shim equivalence.
