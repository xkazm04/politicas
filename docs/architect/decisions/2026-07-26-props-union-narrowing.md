---
date: 2026-07-26
slug: props-union-narrowing
status: shipped
branch: "(committed to master)"
commits: [a2a70cd]
type: weak-pattern
reach: "6 closed-union `as` casts / ~47 assertion widenings of kg props across features/"
risk: 1
effort: s
payoff: 3
related_scan: "[[Architect/scans/2026-07-26-data-loading-boundary]]"
---

# Narrow `kg_*.props` by guard, never by `as`

## Context
`KgNodeRow.props` is honestly `Record<string, unknown>` (`lib/db/types.ts:180,199`); the
repository layer coerces totally (`lib/db/pglite/mappers.ts`, e.g. `:129` narrows a union
with a ternary — the correct idiom). Loaders instead widen by assertion: 6 unsound
closed-union casts (`getCollisionData.ts:275`, `getLawData.ts:268`, `getMoneyData.ts:70`,
`getMpDetail.ts:51`, `graphLoader.ts:542,546`) that admit any JSON string straight into a
render branch, plus ~47 `as Record<string, unknown>` / `as string | null` widenings. The
same files also contain the correct guard idiom (`getMoneyData.ts:56-57`,
`getProfileData.ts:235-237`), so this is inconsistency, not ignorance.

## Decision
Add tiny narrowing helpers (`asUnion(value, members, fallback)` alongside the existing
`asStr` style) and replace the 6 unsound casts; sweep the widenings opportunistically.
Optionally: lint rule banning `as <UnionType>` on expressions originating from `.props`.

## Rollout (as executed, 2026-07-26)
1. a2a70cd — `asUnion()` in `lib/db/narrow.ts` (overloaded: non-null fallback → T,
   nullable fallback → T | null); 4 casts replaced; each union now derives its type
   from an exported members array. `npm run check` green (340/340) at baseline parity.
   Fallback semantics: collision pairs degrade to "coordination-risk" (mirrors the
   existing cluster-level rule at getCollisionData.ts:262), bill origin → "other",
   corroboration → null.

## Remaining
- graphLoader.ts:542,546 (`row.kind as KgNodeKind`) — deferred, in-flight round-4
  session. Wire via `asUnion(row.kind, KG_NODE_KINDS, ...)` when it lands.
- Optional lint rule banning `as <Union>` on `.props`-derived expressions — not
  written; revisit if new casts appear.

## Acceptance criteria
- [x] No `as`-cast from `props` values into a closed union in `features/` outside
      the deferred `features/graph/`.
