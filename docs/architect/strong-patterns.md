# Strong Patterns

Load-bearing patterns identified by `/architect`. Promote-worthy: ideally these
graduate into lint rules, docs sections, or test guards.

## Patterns

## Repository layer: narrow interfaces + single mapper file + total coercion
- Identified: 2026-07-26
- Reach: 7 store interfaces (`lib/db/store.ts:186`), 11 `map*` functions in one file (`lib/db/pglite/mappers.ts`), zero raw-row escapes
- Why it works: every query is `pg.query<Record<string, unknown>>` immediately mapped through defensive coercers (`str`/`num`/`isoDate`); `unknown` props stay honestly `unknown`. No `any` anywhere in the chain.
- Codification status: noted
- Examples: `lib/db/pglite/repositories/kg.ts:36`, `lib/db/pglite/mappers.ts:129` (the canonical union-narrowing idiom)

## Detail-route null disambiguation (unavailable ≠ absent)
- Identified: 2026-07-26
- Reach: 2 routes + `features/shared/components/DataUnavailable.tsx`
- Why it works: a second cheap query distinguishes "store busy" from "entity doesn't exist", so `notFound()` never fires on an outage and no false factual claim renders — the brand rule's failure-mode counterpart.
- Codification status: noted
- Examples: `app/poslanec/[id]/page.tsx:39-46`, `app/zakony/[cislo]/page.tsx:32-37`

## Canonical loader shape: `getVoteThemes.ts` + sibling `themeTypes.ts`
- Identified: 2026-07-26
- Reach: every loader whose types a `"use client"` file reads — 9 loaders gained a sibling `*Types.ts` on 2026-09-01 (was: 5 features had one, 4 didn't)
- Why it works: 47 lines, zero casts, `Promise<X | null>`, types in a plain module both sides import — satisfies every rule the codebase states for itself (`themeTypes.ts:1-4`).
- Codification status: lint-rule-added — `custom/no-server-import-in-client` with `typeImports: "forbid"` (a client module cannot import even a type from a `get*`/`*Loader` file, so the sibling module is the only home)
- Codified: 2026-09-01
- Codification ADR: [[decisions/2026-07-26-server-only-boundary-enforcement]] (rollout step 5, commit 0b217ff)
- Lint rule: `packages/eslint-plugin-civic-transparency/rules/no-server-import-in-client.cjs`
- Examples: `features/votetrack/getVoteThemes.ts`, `features/votetrack/themeTypes.ts`

## Real-PGlite temp-dir test harness
- Identified: 2026-07-26
- Reach: 3 test files boot a real WASM Postgres via `mkdtempSync` + `PGLITE_PATH` + dynamic import
- Why it works: exercises the full DDL and real queries without mocks; already proven able to test feature loaders across the vitest glob boundary (`review.test.ts:15`).
- Codification status: noted
- Examples: `lib/db/pglite/repositories/review.test.ts:1-15`, `lib/analysis/kg-money-reingest.test.ts:13-24`
