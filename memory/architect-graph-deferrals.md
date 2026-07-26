---
name: architect-graph-deferrals
description: /architect follow-ups deliberately deferred because features/graph was in-flight (round 4) on 2026-07-26 — apply when that work lands
---

The `/architect` skill (adopted from personas 2026-07-26; backlog at
`docs/architect/backlog.md`, resume mode drains it) executed 5 of 8 findings but
left `features/graph/graphLoader.ts` strictly alone — it was untracked in-flight
round-4 work in a concurrent session. When that lands, apply in one pass:

1. `import "server-only"` at the top (every other loader has it).
2. `reportLoaderFailure()` in its 4 silent catches (`:118/:256/:487/:561`),
   then **delete the `features/graph/**` exclusion** from the
   `no-silent-null-catch` scope block in `eslint.config.mjs` — lint then
   verifies the wiring.
3. `asUnion(row.kind, KG_NODE_KINDS, …)` for the 2 casts at `:542/:546`
   (helper: `lib/db/narrow.ts`).
4. Invalidate the 3 module-level memo promises (`indexPromise`, `mapPromise`,
   `trailsPromise`) on null/rejection — same bug shape as the `open()` fix in
   `lib/db/pglite/internals.ts` (see `open-retry.test.ts` for the pattern).

Why: these were deferred purely for tree-safety, not because they don't apply —
the lint exclusion actively hides class-2 violations until removed.
