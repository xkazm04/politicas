# G13 — identity ledger; declared attribution perimeter + exposure lane (wave 3)

Cards: deck #14 (one cross-source person resolution table with confidence and a
review door), #17 (declared attribution perimeter + a downward exposure lane).
Registry: civic-source-adapters / entity-name-normalization ("a name match is
never an identity claim"), beneficial-ownership-resolution /
name-to-identifier-discipline, ownership-chain-traversal; llm-forensic-gating /
human-review-doors; public-money-attribution / attribution-perimeter; laws
lead-not-finding, non-partisan-symmetry, every-cap-ships-its-population.

Builds on: G2 (the one review writer `setReviewState` — add an `identity` branch,
do not fork it), G6 (`alignedCzk` fields, `roleWindow`), G9 (channel folds). You
own the review console (`features/money/reviewActions.ts`, `ReviewConsole*`) this wave.

## Goal of this wave's slice

### A. Identity ledger (#14)

1. `person_identity` (`person_psp_id, source ∈ {ares-vr, dataor, volby, hlidac,
   kiosek}, source_key, method ∈ {birthdate-exact, name-fold+region, bridge},
   confidence, review_state, decided_by, decided_at, audit_id`) appended to
   `CORE_DDL` in a `-- [G13 identity]` block; repository
   `lib/db/pglite/repositories/identity.ts` outside the `Store` facade (the
   `ledger.ts`/`changes.ts` precedent) with a `Store`-free reader for loaders.
2. `lib/analysis/identity.ts` (pure): the four matching rules — exact birthdate,
   folded name with region/elected tie-break, ambiguity rules, bridge — importing
   `asciiFold` from `packages/czech-civic-data`; fixture-tested; the four adapters
   (`reconcile-ares-vr.ts`, `dataor-corroborate.ts`, `lib/ingest/sources/volby.ts`,
   `lib/analysis/money-feed.ts` bridges) IMPORT it and delete their local rules.
3. Backfill script (dry-run default): rows derived from what the graph already
   asserts (`corroboration: registry-confirmed` → `ares-vr` machine-confirmed;
   volby `matched`; Hlídač bridges) with `review_state: pending_review` and the
   originating pass as provenance — never human-confirmed by a script.
4. Every tie-building path resolves through the ledger first; a rejected identity
   yields no tie and stays rejected on re-run; the volby name join is lead-grade
   and never seeds a `linked_to` tie by itself.
5. Review: `setReviewState` gains the `identity` branch (audit row first);
   `/penize/kontrola` gains a "totožnost" lane for `ambiguous`/pending rows; the
   "rozpor role × rejstřík" lane links each tie to its identity row.
6. `/poslanec` money block states the identity basis per tie ("shoda data narození
   v OR, potvrzeno strojově") through the gate vocabulary.

### B. Perimeter + exposure (#17)

7. `ATTRIBUTION_PERIMETER` versioned constant in `reachableMoney.ts`
   (`{subjects: "official-only", relations: ["registered-role","direct-holding"],
   depth: 1, stakeThreshold: null, version: "perimeter-v1"}`) rendered verbatim in
   `TrailMethod`, the metodika money section, the packet `citeCs`, and the claim
   derivation string; the "nejméně" wording gains its second reason.
8. `features/money/exposure.ts` (pure): one hop DOWN over current `owns_stake`
   edges from each attributable tie's company; rows = subsidiary, stake wording,
   period, contracts count/czk (`moneyReachesCompany`-filtered) — structure only,
   never added to any bucket; `walked / not attempted` counts ship with the result.
9. Console lane „expozice přes vlastnictví" with ONE reviewer action:
   `proposeLeadFromChain` writes a NEW `linked_to` edge `pending_review` with
   `source: "ownership-chain:<parent>→<child>"` and an audit row; never a class
   change, never a figure.
10. `/penize/firma/[ico]`: "dceřiné firmy v grafu: n, smluv m" as counts with
    links; no CZK on the parent's file. Symmetry script: run the walk over ALL
    attributable ties and report per-club counts before the lane ships.

## Owned paths

- `lib/db/pglite/ddl.ts` (append block), `lib/db/pglite/repositories/{identity,review}.ts`
  (+ tests), `lib/db/types.ts` (append).
- `lib/analysis/identity.ts` (new) + test, `lib/analysis/money-feed.ts` (bridge
  functions → import), `lib/ingest/sources/volby.ts` (join → import).
- `scripts/case-loops/money/{reconcile-ares-vr,dataor-corroborate}.ts`,
  `scripts/case-loops/money/identity-backfill.ts` (new), `scripts/case-loops/money/exposure-symmetry.ts` (new),
  `scripts/data-analysis/kg-money-ingest.ts` (resolve-through-ledger).
- `features/money/{reviewActions.ts,reviewTypes.ts,reachableMoney.ts,exposure.ts,moneyClaims.ts,packet.ts}`,
  `features/money/components/{TrailMethod,ReviewConsole*,…}.tsx`, `CompanyCaseFilePage.tsx`
  (subsidiaries block), `features/profile/components/MoneySection.tsx` (identity basis line),
  `features/civicscore` metodika money section (perimeter text).
- `messages/{cs,en}.json`: `penize.*`, `poslanec.money.*`, `metodika.*`.
- Docs owed: `docs/routes/{penize,poslanec,metodika}.md`, `docs/db-architecture-guide.md`,
  `docs/case-loops.md` (Authority: identity is a claim with a door),
  `docs/data-analysis/case-money/STATE.md`.

## Hot-file policy

- `ddl.ts`, `types.ts`, review repository: append-only; the review writer stays one
  dispatcher.
- `reachableMoney.ts`: G6/G9 added fields in wave 2; add the perimeter constant
  and nothing structural.

## Honesty rules

- Backfill never upgrades a machine match to human-confirmed.
- Exposure is a candidate set, never a money number; the parent file carries counts only.
- Whole population or nothing: the symmetry report precedes the lane.

## Build order

A1 → A2 → A3 → A4 → A5 → A6 → B7 → B8 → B9 → B10 → docs.

## Report

README shape, plus: matching implementations (4 → 1), identity rows on the
fixture backfill with their review_state histogram, chain leads found on the
fixture with per-club counts, carry-over.

## Addendum from wave 1 (2026-09-05)

- **`/penize/kontrola` lanes for the new claim kinds** (G2 carry-over): the
  console gains lanes for `bill_verdict` and `effort_verdict` decisions through
  the same `setReviewState` writer (G2 built the `/admin` board only).
- **Cross-links into the canvas** (G4 carry-over): `/penize/firma/[ico]` and the
  tender surface link `/graf?okoli=<id>`; wire `caseFileLink` in `NodeInspector`.
