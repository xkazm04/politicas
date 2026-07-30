# eslint-rules — the politicas doctrine pack

Custom flat-config rules registered in `eslint.config.mjs` under the `custom/` prefix.
Each rule documents its own rationale and heuristics in its file header — that header is
the rule's canonical doc. This README covers what is pack-wide: severity policy, escape
hatches, and testing.

## Rules

| Rule | Guards | Severity |
| --- | --- | --- |
| `no-silent-catch` | no swallowed errors | error |
| `no-silent-null-catch` | loader degradations leave a trace | error (loader files) |
| `no-server-import-in-client` | server/client boundary | error |
| `role-button-requires-keydown` | keyboard operability | error |
| `enforce-reduced-motion-fallback` | WCAG 2.3.3 looping motion | error |
| `no-hardcoded-colors` | token discipline | error |
| `require-source-citation` | **doctrine**: rendered figures carry provenance | warn in `features/**`, error in `app/**` |
| `no-raw-number-display` | **doctrine**: formatting only via `lib/format.ts` | warn in `features/**`, error in `app/**` |

## The doctrine rules (batch-2 item 2D)

"Every rendered number carries its source" was a review convention; these two rules make
it a build gate. Both were shipped **warn-first** against a measured inventory
(2026-07-30: 29 warnings, 12 file×rule pairs, all under `features/**`; `app/**` was
clean and is at `error`). Escalation path: burn down a module's warnings, then move that
glob into the `error` block in `eslint.config.mjs`. Never flip a scope to `error` while
it still warns — a red repo lint destroys trust in the whole pack.

Escape hatches (all leave a grep-able audit trail — a bare disable comment does not):

- `// citation-ok: <reason>` — the citation genuinely exists but lives outside the file
  (e.g. the parent component renders the `SourceNote` caption).
- `data-undisclosed` JSX attribute — the figure knowingly ships without a source.
  **Convention**: an element carrying `data-undisclosed` must render a visible
  „bez zdroje" badge, so the disclosure reaches the reader, not just the linter.
  (Not yet machine-enforced on old code.)
- `// raw-format-ok: <reason>` — a deliberate raw `toFixed`/`toLocaleString*` call site
  (e.g. admin-only, never server-rendered surfaces).

## Testing

Precedent established with the doctrine rules: RuleTester suites under `__tests__/`,
plain `node`, no runner dependency:

```
node eslint-rules/__tests__/require-source-citation.test.mjs
node eslint-rules/__tests__/no-raw-number-display.test.mjs
```

A failing case throws an AssertionError (non-zero exit); a clean run prints `PASS`.
New rules should ship with positive, negative, and escape-hatch cases in this shape.
