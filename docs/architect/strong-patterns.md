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
- Reach: 1 exemplar pair (5 features use sibling `*Types.ts`; 4 don't)
- Why it works: 47 lines, zero casts, `Promise<X | null>`, types in a plain module both sides import — satisfies every rule the codebase states for itself (`themeTypes.ts:1-4`).
- Codification status: noted
- Examples: `features/votetrack/getVoteThemes.ts`, `features/votetrack/themeTypes.ts`

## Real-PGlite temp-dir test harness
- Identified: 2026-07-26
- Reach: 3 test files boot a real WASM Postgres via `mkdtempSync` + `PGLITE_PATH` + dynamic import
- Why it works: exercises the full DDL and real queries without mocks; already proven able to test feature loaders across the vitest glob boundary (`review.test.ts:15`).
- Codification status: noted
- Examples: `lib/db/pglite/repositories/review.test.ts:1-15`, `lib/analysis/kg-money-reingest.test.ts:13-24`
