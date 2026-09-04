---
date: 2026-09-01
mode: resume
theme: (n/a — resume of data-loading-boundary decision)
sub_agents_spawned: 3 (builders on disjoint directories, not scan angles)
findings_total: 0
executed: [server-only-boundary-enforcement]
adrs_written: ["[[decisions/2026-07-26-server-only-boundary-enforcement]] (refreshed + shipped)"]
commits: [45d8fea, 09004fa, 751b100, b22d1a9, 0b217ff]
branch: "(committed on master — overlay default)"
registry: declared, unmapped — no registry subject was read this run (resume of a pre-registry ADR; judged against the repo's own rule in themeTypes.ts:1-4)
---

# Architect resume — server-only loader boundary (2026-09-01)

## Refresh delta (Phase 9c)
The 2026-07-26 ADR listed 4 type-leaking loaders and a working-tree conflict. On resume: tree clean; step 4 (graphLoader server-only) already landed 2026-08-13; reach had grown to **9 loaders / 29 `"use client"` import sites**; one new unguarded server module (`getPermalinkData.ts`). Effort re-sized `s` → `m`; the user chose the full scope.

## Rollout as shipped
| Step | Commit | What |
|---|---|---|
| 1 | 45d8fea | `getPermalinkData.ts` gets `import "server-only"` |
| 2 | 09004fa | civicscore `leaderboardTypes.ts`, 14 client importers (incl. landing) |
| 3 | 751b100 | lawwatch `lawTypes.ts`, `collisionTypes.ts`, `radarTypes.ts`; 7 client importers |
| 4 | b22d1a9 | `supplierTiesTypes.ts`, `moneyTypes.ts` (+2), `profileTypes.ts`; 3 client importers |
| 5 | 0b217ff | rule option `typeImports: "forbid"` wired; dry run = 0 violations; tests, doc, CLAUDE.md |

Steps 2–4 were built by three parallel builders on disjoint directories (civicscore+landing / lawwatch / budget+money+profile) with an agreed cross-name (`ProfileEntry` in `leaderboardTypes.ts`), each verified in place; commits were made centrally, one per step, pathspec-only, index verified. Every loader re-exports what moved, so no page, feed, other loader or test changed.

## Strong pattern codified
"Canonical loader shape: `getVoteThemes.ts` + sibling `themeTypes.ts`" → `lint-rule-added` (the tightened rule leaves the sibling module as the only legal type home for a client importer).

## Not verified
No browser: no politicas dev server this session. No JSX was touched; the change is import lines and type homes.

## Cross-references
- Backlog remainder: loader-test-coverage (in-progress), ingest-readiness (in-progress), fallback-state-contract (proposed), empty-slices-scored (proposed), moonshot deck (portfolio).
