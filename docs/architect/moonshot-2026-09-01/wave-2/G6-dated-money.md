# G6 — dated money: world time on edges, aligned reach (wave 2)

Cards: deck #23 (world time on the graph), #27 (aligned reach). Registry:
civic-knowledge-graphs / civic-entity-ontology (temporal validity of a hop);
conflict-of-interest-detection / temporal-alignment-of-money-and-role ("alignment
as weight, not only as gate"); laws missing-is-not-zero, non-partisan-symmetry.

Builds on wave 1: G5's provenance columns and stamped writers (import
`lib/kg/provenance.ts`), G3's `decides` edge and `clubAt` (do not touch them).

## Goal of this wave's slice

1. `KgEdgeRow`/`KgNodeRow` gain `validFrom`, `validTo` and a `validity` tri-state
   (`known | open | unknown`) — mapped from the DDL's existing world-time columns
   (`lib/db/pglite/ddl.ts:288-305`, already declared, never populated). NULL no
   longer conflates "unknown" with "still holds": the tri-state is explicit in
   `mappers.ts` and in the content tuples of `supersedeUpsertChunk` so a corrected
   date supersedes the old version. The DDL columns exist; if a `validity` column
   is needed, append it in a `-- [G6 world time]` block at the END of `CORE_DDL`.
2. Writers that already know a date write it; writers that do not write `unknown`
   — never a default: `linked_to` from ARES VR `spolecnik[]` dates and
   `role_valid_from/to` props (semantics label `registration`, per
   `memory/or-shareholder-entry-semantics.md`), `supplies` from `signedOn` (moved
   onto the edge props by the kg-promote/kg-compute materialisation under the
   prop-merge rule, never a reset), `belongs_to`/`influential_in` from
   `membership.from_at/to_at`, `sponsors` from tisk dates. Retire
   `role_valid_from`-style props only after a one-pass backfill (dry-run default,
   fixture-tested, replayable).
3. `Store.kgNeighboursAt({id, rels, worldTime})` — the indexed read plus a
   world-time filter, same `warnIfTruncated` discipline.
4. Aligned reach: extract the day-window rule into `features/money/roleWindow.ts`
   (ONE helper; `statuteRelevance.voteInRolePeriod` and `lib/analysis/tripwires.dayInRolePeriod`
   keep their pinned parity test — do not remove them this wave, import the new
   helper from `statuteRelevance`). `reachableMoney.ts` exports `alignedReach(tie,
   lines, window)`; `ReachableTie` and `MoneyBucket` gain `alignedCzk`,
   `undatedCzk`, `undatedCount`; `toReachableTie()` stays the only constructor.
5. `moneyClaims.ts` mints `dosah-vazby-v-obdobi` as a DISTINCT metric (the
   two-metrics precedent); `/zdroj` re-derives it through the same fold.
6. One catalog primitive `AlignedReach` (`features/shared/components/`, `@catalog`):
   raw · aligned · undated floor ("nejméně; n smluv bez data"); rendered on the
   ledger reach cell, `/penize/[pspId]`, `/penize/firma/[ico]`, the spis money
   section and the evidence packet.
7. `/atlas` (or the money coverage tile) prints per-relation world-time coverage
   as a measured share (`validity != unknown` / total) — report the numbers from
   the fixture.

Out of this wave: the tie-at-vote derivation over all 207 MPs and its `/poslanec`
and `/volby` surfaces (report as carry-over with the shape); `reviewSignal`
weighting by aligned fraction (needs the replay gate over the `review_rank` cache).

## Owned paths

- `lib/db/types.ts` (kg rows), `lib/db/pglite/mappers.ts`, `lib/db/pglite/repositories/kg.ts`
  (content tuples, `kgNeighboursAt`), `lib/db/store.ts` (append), `lib/db/pglite/ddl.ts`
  (append-only block if needed) + tests.
- `lib/kg/prop-registry.json` (edge/world-time keys), `lib/analysis/kg-money.ts`,
  `lib/analysis/money-feed.ts` (date extraction only).
- `scripts/data-analysis/{kg-promote,kg-compute,kg-money-ingest}.ts` (date
  stamping under the prop-merge rule), `scripts/data-analysis/kg-worldtime-backfill.ts` (new, dry-run).
- `features/money/**` EXCEPT `collisions/deriveCollisions.ts` and the review console
  (`reviewActions.ts`, `ReviewConsole*`), which G13 will own in wave 3; touch
  `collisions/statuteRelevance.ts` only to import the shared helper.
- `features/profile/profileMoney.ts`, `features/profile/components/MoneySection.tsx`.
- `features/shared/components/AlignedReach.tsx` (new).
- `messages/{cs,en}.json`: `penize.*`, `poslanec.money.*`, `shared.alignedReach.*`.
- Docs owed: `docs/routes/{penize,poslanec,graph-writers}.md`,
  `docs/data-analysis/graph-schema.md`, `docs/db-architecture-guide.md`.

## Hot-file policy

- `ddl.ts`, `store.ts`, `prop-registry.json`: append-only in named slots.
- `features/overeni/liveFigures.ts`: G8 owns it this wave. To register the new
  metric, add exactly one routing branch in a `// [G6]` block and nothing else;
  G8 will reconcile. `liveFiguresRoundTrip.test.ts` must stay green.

## Honesty rules

- A registry date is a registration date, never an acquisition date — the column
  carries the semantics label, or the join lies.
- Undated money is a floor, disclosed on every figure that includes it.
- The `review_rank` cache and packet hashes change for affected ties: expected,
  disclosed in the route record; the recompute-replay gate applies to any stored
  rank rewrite (not in this wave).

## Build order

1 types/mappers/tuples (+ DDL block if needed) → 2 writers + backfill dry-run →
3 `kgNeighboursAt` → 4 `roleWindow` + `alignedReach` → 5 claim + zdroj → 6 primitive
+ surfaces → 7 coverage share → docs.

## Report

README shape, plus: per-relation world-time coverage on the fixture; count of
ties where aligned ≠ raw on the fixture; the `liveFigures` block you added; carry-over.
