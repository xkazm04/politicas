# eslint-rules — compatibility shims

The politicas doctrine pack moved into an in-repo package (moonshot batch-6,
item 6B): **`packages/eslint-plugin-civic-transparency/`**. That package is now
the canonical home of the rule implementations, their RuleTester suites, the
per-rule docs (when-it-fires, escape hatches, why), and the adoption guide:

- Plugin + presets: `packages/eslint-plugin-civic-transparency/index.cjs`
  (`configs.recommended`, `configs.strict`)
- Rule sources: `packages/eslint-plugin-civic-transparency/rules/*.cjs`
- Per-rule docs: `packages/eslint-plugin-civic-transparency/docs/rules/*.md`
- Adoption guide: `packages/eslint-plugin-civic-transparency/README.md`

Everything in this directory is a thin re-export shim kept so that historical
paths keep working:

- `*.cjs` — `module.exports = require("../packages/eslint-plugin-civic-transparency/rules/<rule>.cjs")`
- `__tests__/*.test.mjs` — forwarders importing the moved suites, so the
  documented commands (`node eslint-rules/__tests__/<rule>.test.mjs`) still run.

`eslint.config.mjs` consumes the package directly (registered under the
historical `custom` prefix so rule IDs, severities, and scoping are unchanged).
The severity policy, doctrine-rule burn-down workflow, and escape-hatch
conventions previously documented here live on in the package README and the
per-rule docs.

Run all suites:

```
node packages/eslint-plugin-civic-transparency/__tests__/run-all.mjs
```

The runner asserts shim equivalence (each file here re-exports the exact rule
object the plugin ships), so a drifted shim fails the pack's own tests.
