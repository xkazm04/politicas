# G1 — the as-of spine (wave 1)

Cards: deck #1 (time-travelling claim gate), #9 (record-time citations), #10
(temporal receipts), #13 (moved permalinks with both sides). One mechanism, four
surfaces. Registry: claim-verification-and-provenance / three-verdict-vocabulary —
"moved is shown with both sides and both dates".

## Goal of this wave's slice

The store's bitemporal history (`kg_node_history`, `kg_edge_history`, `asOf()` in
`lib/db/pglite/repositories/kg.ts`) reaches readers. After this wave:

1. `asOf` is part of the `Store` contract with a typed epoch rule — an instant
   before the bitemporal epoch answers `{ known: false, epoch }`, never a value.
2. Point reads exist: `asOfNode(id, at)` and `asOfEdge({src,rel,dst}, at)` riding
   the history key indexes (`kg_node_history_id_idx`, `kg_edge_history_key_idx`);
   the whole-relation union lister stays the history instrument it is.
3. `/zdroj/<ref>?k=YYYY-MM-DD` re-derives the receipt at that day; the receipt
   posts a dated banner ABOVE the content (the `/graf/p` staleness rule) and shows
   both fingerprints. A `gone` receipt shows the last recorded version
   ("naposledy zaznamenáno … / nahrazeno …") as history, never re-promoted.
4. `/overeni?ref=…&k=…`: `moved` verdicts (zdroj + figura + graf families) print
   three columns — cited by reader · published by us on that day · today; where
   history has no row spanning `k`, the column says "záznam k tomu dni
   neexistuje". A `k` that is not an ISO day is refused, not repaired.
5. `/graf/p/[ref]`: a second address shape `g2.<state>.<hash8>.<YYYYMMDD>`
   encoded from now on; `g.` keeps decoding (append-only address space). A stale
   `g2.` view renders "tehdy / dnes" with a pure `diffViews()` (edges added /
   removed, gate flips, weight changes, re-routed path), both dated.
6. `/schranka` `recompute` delta prints the per-MP magnitude ONLY when the person
   node's history carries a prior `contribution_score` under a uniform prior
   `{pass, ref}`; otherwise the existing "size unknown" sentence stays.

Out of this wave: `/denik` `recompute` rows; JSON-LD `hasPart` for the then-side;
upgrading `retrievedAt` to an instant on minted claims. Report them as carry-over.

## Owned paths (write set)

- `lib/db/store.ts`, `lib/db/pglite/repositories/kg.ts`, `lib/db/pglite/pglite-store.ts`
  (only to expose `asOf`/point reads), `lib/db/kg-bitemporal.test.ts` or the
  repository's colocated tests.
- `features/shared/provenance/**` (`getReceiptData.ts`, `receipt.ts`, `claimRef.ts`,
  `ReceiptBody*.tsx`, tests).
- `features/overeni/**` (`verdict.ts`, `getVerdictData.ts`, `refDetect.ts`,
  `OvereniPage.tsx`, copy keys under the overeni namespace).
- `features/graph/permalink.ts`, `features/graph/getPermalinkData.ts`,
  `features/graph/PermalinkPage.tsx`, `features/graph/diffViews.ts` (new) + tests.
  NOT `graphLoader.ts`, `trailPath.ts`, `forensicView.ts`, `GraphStage.tsx`,
  `VariantMapa.tsx` (G4 owns them).
- `features/schranka/recomputeFact.ts` + test.
- `app/zdroj/[ref]/page.tsx`, `app/overeni/page.tsx`, `app/graf/p/[ref]/page.tsx`
  (search-param plumbing only).
- `messages/cs.json`, `messages/en.json`: keys under `overeni.*`, `zdroj.*`/the
  provenance namespace, `graf.permalink.*`, `schranka.*` only.
- Docs owed: `docs/routes/overeni.md`, `docs/routes/graf-permalink.md`,
  `docs/routes/schranka.md`, `docs/db-architecture-guide.md` (asOf contract).

## Hot-file policy

- `lib/db/store.ts`: add `asOf`/point reads to `KnowledgeGraphRepository` at the
  END of the interface; touch nothing else.
- No DDL change in this group. If a new index seems needed, report it — G5 owns
  `ddl.ts` this wave.
- `features/overeni/verdict.ts`: G4 will later touch the `graf` family's gate
  modifier; keep `verdictGate` structure intact and add the as-of columns as new
  fields, not by reshaping existing ones.

## Honesty rules that bind the build

- Record time only. All pre-migration rows share one `recorded_at` (see
  `lib/db/pglite/repositories/changes.ts` epoch caveat): a `k` before the epoch
  must render as unknown, never as "unchanged since <epoch>".
- A `clearKg --reset` archives a whole rebuild as one instant: label it "rebuild",
  not "change", in the version ledger.
- Never a second `kgNeighbours` per receipt; point reads only (the
  `kgneighbours-default-limit-is-500` memo).
- Every rendered figure cites its source (`SourceNote`); numbers through
  `lib/format.ts`; no new colors.

## Build order (one commit each)

1. Store contract + point reads + epoch rule, with repository tests over a two-pass
   fixture (upsert, supersede, read at three instants incl. pre-epoch).
2. `getReceiptData` `k=` + `gone` last-version; `ReceiptBody` banner; tests.
3. `verdict.ts` three-column `moved`; `getVerdictData` k plumbing; page; tests.
4. `permalink.ts` `g2.` codec (both shapes decode; malformed date refused);
   `diffViews.ts` pure + fixtures; `getPermalinkData` then/now; `PermalinkPage`
   ledger; tests.
5. `recomputeFact.ts` magnitude under uniform prior; tests.
6. Route docs + db guide.

## Gates

`npm run typecheck && npm run lint && npm run test` in the worktree, all green, and
the doc-sync commit-msg hook satisfied on every commit. If a whole-tree gate is red
in a file you did not touch, say so with the path; do not "fix" it.

## Report

Branch, worktree path, HEAD sha, commit list; per build step: shipped / partial /
not started, with the reason; measured: count of `moved` verdicts in the test
fixtures that render both sides (target: all); carry-over list; any needed path
outside the write set.
