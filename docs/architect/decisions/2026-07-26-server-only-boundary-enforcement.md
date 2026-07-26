---
date: 2026-07-26
slug: server-only-boundary-enforcement
status: in-progress
type: convention-gap
reach: "7 loader headers / 4 loaders exporting prop types / 0 lint rules on the boundary"
risk: 1
effort: s
payoff: 3
branch: "(committed to master)"
commits: [431d147, 4e1f112]
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

## Remaining (blocked: working-tree-conflict)
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
- [ ] Zero client imports of server loader modules including type-only — blocked on step 3.
