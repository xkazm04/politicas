---
date: 2026-07-26
slug: server-only-boundary-enforcement
status: in-progress  # all five rollout commits landed; browser smoke of the touched routes pending (no politicas dev server this session)
type: convention-gap
reach: "7 loader headers / 4 loaders exporting prop types / 0 lint rules on the boundary"
risk: 1
effort: s
payoff: 3
branch: "(committed to master)"
commits: [431d147, 4e1f112, 45d8fea, 09004fa, 751b100, b22d1a9, 0b217ff]
related_scan: "[[Architect/scans/2026-07-26-data-loading-boundary]]"
---

# Enforce the server-only loader boundary mechanically, not by prose

## Context
The `get*Data.ts` → client-feature boundary was held together by header comments
("must never be imported into a client component"), which also misattributed the
runtime client guard to `lib/db/store.ts` — the real guard is
`lib/db/pglite-store.ts:15`, driver-specific and transitive. No `server-only`
package; lint restricted imports only for `features/shared/components/**`.
4 of 9 loaders export their prop types directly, forcing `"use client"` files to
import a server module for its type, against the codebase's own rule in
`themeTypes.ts:1-4`.

## Executed (2026-07-26)
1. **431d147** — `server-only` installed; `import "server-only"` added to 11
   server loader modules; vitest aliases the package to
   `lib/testing/server-only-stub.ts` (the real package throws outside a React
   Server environment, which would break the lib-hosted loader tests); all 7
   misattributing header comments corrected. Validation: `npm run check` green
   (340/340), `npm run build` green (all 16 routes).
2. **4e1f112** — new lint rule `custom/no-server-import-in-client` (error,
   global): in `"use client"` modules, value imports of `get*`/`*Loader`
   modules and `@/lib/db/*` fail; `import type` remains allowed.

## Refresh (2026-09-01, `/architect resume`)

Re-measured before executing. The tree is clean (the 2026-07-26 conflict is gone).
Step 4 already landed (2026-08-13, `graphLoader.ts` carries `server-only`). Reach grew:
**9 loader modules leak types into 29 `"use client"` import sites** (was 4 loaders) —
`getLeaderboardData` (13 importers across civicscore + landing), `getLawData` (5),
`getRadarData` (2), `getDependencyData` (2), `getCollisionData`, `getSupplierTies` (2),
`getLeadDossiers`, `getLeadPacketTargets`, `getProfileData`. Six sibling `*Types.ts`
modules already exist as the canonical shape. One new gap: `features/graph/getPermalinkData.ts`
calls itself a server module in its header and had no `import "server-only"`. Effort is
honestly `m` now. User chose the full scope. Isolation: current branch (overlay default).

### Pre-flight baseline (2026-09-01, `npm run check` at 2b836c9)
tsc 0 errors · eslint 0 errors / 2 warnings (`app/global-error.tsx`, `features/graph/components/NodeSearch.tsx`, both pre-existing and outside scope) · vitest 3 046 + 211 · rules/census/library/doc-sync green.

### Rollout (refreshed)
0. Dry run of the enforcement: the tightened rule's violation count before wiring = the 29
   sites above, all moved in steps 2–4, so the expected count at step 5 is 0 — measured, not assumed.
1. `getPermalinkData.ts` gets `import "server-only"` — gate: eslint + vitest features/graph.
2. civicscore: `leaderboardTypes.ts` + 14 client importers (civicscore + landing) rewritten;
   `ComponentKey`/`ComponentDef` imported from the pure `componentDefs.ts` — gate: tsc, eslint, vitest.
3. lawwatch: `lawTypes.ts`, `collisionTypes.ts`, `radarTypes.ts`; dependency types from the pure
   `buildDependencyView.ts`; 7 client importers — gate: same.
4. budget/money/profile: `supplierTiesTypes.ts`, `LeadDossiers` + `PacketTarget` into the existing
   `moneyTypes.ts`, `profileTypes.ts`; 4 client importers — gate: same.
5. Tighten `custom/no-server-import-in-client`: a new option (`typeImports: "allow" | "forbid"`,
   default `allow` so the package's external presets keep their contract); politicas sets
   `forbid`. RuleTester cases, rule doc, CLAUDE.md line, `npm run test:rules` — gate: full `npm run check`.
6. ADR → shipped; backlog → Shipped; scan note + coverage; ledger entry moved.

Every loader keeps `export type { … } from "./xTypes"` so server-side importers (pages,
other loaders, tests) are untouched — only `"use client"` sites move.

## Remaining as of 2026-07-26 (blocked: working-tree-conflict — cleared 2026-09-01)
3. **Type extraction** — move prop types out of `getLeaderboardData.ts`,
   `getProfileData.ts`, `getLawData.ts`, `getCollisionData.ts` into sibling
   `*Types.ts` and update client imports. Blocked 2026-07-26: every consuming
   client component (`CivicScorePage.tsx`, `ProfilePage.tsx`, `LawWatchPage.tsx`,
   `BillDossierPage.tsx`, `CollisionsPage.tsx`) carries uncommitted changes from
   a concurrent session. Re-attempt when the tree clears. Interim risk is low —
   the remaining imports are type-only, which both new enforcement layers allow.
4. `features/graph/graphLoader.ts` — add `server-only` once round-4 lands.

## Acceptance criteria
- [x] A `"use client"` value import of a loader fails lint (rule) and build (package).
- [x] Zero client imports of server loader modules including type-only — shipped 2026-09-01 (steps 2–5; enforced by `typeImports: "forbid"`).

## Shipped (2026-09-01)
1. **45d8fea** — `getPermalinkData.ts` gets `import "server-only"` (the header promised it).
2. **09004fa** — civicscore: `leaderboardTypes.ts`; 14 client importers (civicscore + landing) rewired; `ComponentKey`/`ComponentDef` from the pure `componentDefs.ts`.
3. **751b100** — lawwatch: `lawTypes.ts`, `collisionTypes.ts`, `radarTypes.ts`; dependency types from the pure `buildDependencyView.ts`; 7 client importers.
4. **b22d1a9** — budget/money/profile: `supplierTiesTypes.ts`, `LeadDossiers` + `PacketTarget` into `moneyTypes.ts`, `profileTypes.ts`; 3 client importers (`ProfilePage.tsx` is a server component since 2026-08-04 and keeps the loader import).
5. **0b217ff** — rule option `typeImports: "forbid"` (default `allow` for the package presets); politicas sets `forbid`. Counted dry run after steps 2–4: 0 violations. RuleTester +4 cases; rule doc Options section; CLAUDE.md line.

Every loader re-exports the moved types, so pages, feeds, other loaders and tests were untouched. Steps 2–4 were built by three parallel builders on disjoint directories, each verified (tsc 0, eslint 0, their vitest lanes green) and committed centrally with pathspec-only staging; step 5 ran `npm run check` in full (tsc 0, eslint 0 errors / 2 pre-existing warnings outside scope, vitest 3 046 + 211, test:rules 10 suites, census, library, doc-sync).

## Regression checklist
- [x] Every route still typechecks and its feature tests pass — verified by: tsc 0 + full vitest in `npm run check` at 0b217ff.
- [x] Server-side importers (pages, feeds, other loaders, tests) untouched — verified by: `git diff --stat` per step lists only the loaders, the new `*Types.ts` and the `"use client"` files; tsc 0 without any page edit.
- [x] The rule still allows type imports for external adopters — verified by: RuleTester valid case under the default option; `npm run test:rules` shim-equivalence PASS.
- [ ] Rendered surfaces unchanged in a browser — NOT verified: no politicas dev server in this session; the change is import lines and type homes only, no JSX touched.

Isolation: current branch (overlay default), no worktree — the rollout was multi-file but every commit staged by pathspec and the index was verified before each commit.
