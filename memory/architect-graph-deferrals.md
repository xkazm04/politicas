---
name: architect-graph-deferrals
description: /architect follow-ups deferred on 2026-07-26 because features/graph was in-flight — 3 of 4 applied 2026-08-13; only the asUnion narrowing remains
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

## Applied 2026-08-13 (round 18) — 3 of 4

Items **1, 2 and 4 are done**; the round-4 art-direction arc never landed, and
waiting on it had by then cost three weeks of a hidden lint zone.

- **2** — `69124ae`: nine sites now call `reportLoaderFailure()`, not four. The
  extra five were **early `return null` paths that logged nothing at all**
  (`!store` / `nodes.length === 0` in `buildIndex`, `!store || !idx` in the three
  memoised builders). The `features/graph/**` exclusion is deleted from
  `eslint.config.mjs` — no suppressions, lint clean. A genuinely missing node
  still reports NOTHING, deliberately: filing a vanished node as an outage is how
  people stop noticing outages.
- **4** — same commit: `memoNonNull()` replaces `indexPromise ??= buildIndex()`.
  The bug was worse than the note's "invalidate on null/rejection" implies — a
  null was memoised for the whole process lifetime, so one unlucky boot served an
  empty `/graf` until restart, and an empty canvas reads as a *real* empty graph.
- **1** — `import "server-only"` added, and with it a FALSE claim retired: the
  file's own header said „balíček `server-only` v projektu není". It is in
  `package.json` and `features/admin/getTripwireData.ts` imports it. The boundary
  now fails at build time instead of at runtime.

**Still open: item 3** — the two `row.kind as KgNodeKind` casts (now at
`graphLoader.ts:807,811`) want `asUnion(…, KG_NODE_KINDS, …)` from
`lib/db/narrow.ts`. Left alone because it changes what a malformed row DOES
(today it flows through as a bad kind), and that is a behaviour ruling, not a
tidy-up. `features/graph/getPermalinkData.ts` is also still missing
`import "server-only"`.
