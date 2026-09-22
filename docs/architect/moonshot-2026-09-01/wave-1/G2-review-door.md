# G2 — one audited review door for every claim kind (wave 1)

Cards: deck #5 (one review door), #12 (review lane for person-level effort
verdicts). Registry: llm-forensic-gating / human-review-doors — "one code path is
the only writer of review state; audit-append then update in one transaction;
reject terminal".

## Goal of this wave's slice

1. `review_audit` gains `subject_kind` (`tie | bill_verdict | effort_verdict |
   tripwire | lead`) and a generic `subject_id`, additive, via `CORE_DDL`. Existing
   rows are backfilled as `tie` with their triple. New rows hash the wider payload
   under a NEW domain tag `politicas-audit-v2` (`lib/db/pglite/ledger.ts`); old rows'
   hashes are never recomputed — the chain verifier accepts both tags in sequence.
2. `ReviewRepository.setReviewState(subject, decision, reviewer, note)` is the ONE
   writer; `setTieReviewState` becomes the `tie` branch of it (its exact write
   preserved, its tests unchanged). Branches this wave: `tie`, `bill_verdict`
   (writes `forensic_review_state` on the bill node + history row), `effort_verdict`
   (writes `review_state`/`decided_by`/`decided_at` inside `effort_provenance` on
   the person node, per field). `tripwire` and `lead` are carry-over.
3. Effort verdict props (`effort_low_score_reason`, `effort_workhorse`,
   `effort_rapporteur_load`) carry `review_state: "machine"` by default; the
   loaders read it; one shared catalog primitive `VerdictProvenance`
   (`features/shared/components/`, `@catalog`) renders the rung — "strojově
   odvozeno" vs "ověřeno (kdo, kdy)" — on `LowScoreReasonChip`, `WorkhorseBadge`,
   `RapporteurBadge`. A `rejected` verdict withholds the badge and renders the
   honest "verdikt zamítnut" state, never a blank.
4. `/zakony` bill detail reads the gate state from the store; `getLawData.ts:340`
   stops defaulting an absent state to `pending_review` — absent renders as absent.
5. `/admin` ReviewHubSection: the four counters become queues with decided /
   pending / total per kind (two-phase confirm, the `LoopMissionControl` pattern);
   decisions post through the one writer with the existing token gates.
6. Sentinel: `audit-chain` reads counts per kind; new `review-coverage` check
   (pending / decided / total per kind, never a rate without its denominator);
   `effort-review-chain` (every non-machine effort verdict has an audit row).

Out of this wave: tripwire dismissals, lead sidecars, `/overeni` gate modifiers for
bill claims, the `/penize/kontrola` UI for the new kinds (the `/admin` queue is the
first door). Report as carry-over.

## Owned paths

- `lib/db/pglite/ddl.ts` (append-only: the `review_audit` ALTERs go in a block
  commented `-- [G2 review door v2]` at the END of `CORE_DDL`), `lib/db/pglite/ledger.ts`,
  `lib/db/pglite/repositories/review.ts` + tests, `lib/db/types.ts` (review rows only),
  `lib/db/store.ts` (the `ReviewRepository` interface only, append at end).
- `lib/kg/prop-registry.json`: add keys under `person` / `bill` alphabetically;
  never remove.
- `lib/analysis/verdict-provenance.ts` (new, pure) + test; `lib/analysis/law-verdict.ts`
  only if the read of `forensic_review_state` lives there.
- `features/civicscore/getLeaderboardData.ts` (the effort prop reads only),
  `features/civicscore/components/{LowScoreReasonChip,WorkhorseBadge,RapporteurBadge}.tsx`,
  `features/profile/getProfileData.ts` (effort prop reads only).
- `features/shared/components/VerdictProvenance.tsx` (new, `@catalog`).
- `features/lawwatch/getLawData.ts` (review state read only), `features/lawwatch/components/BillDetail.tsx`.
- `features/admin/**` (ReviewHubSection, getAdminData, adminTypes, the server action).
- `lib/testing/sentinel/{invariants,facts,report}.ts` — additive check names only.
- `scripts/case-loops/effort/gate.ts` and `merge-batch.ts`: stamp `review_state:
  "machine"` on write (merge-preserving).
- `messages/{cs,en}.json`: keys under `admin.*`, `civicscore.*`, `zakony.*`, `shared.verdict.*`.
- Docs owed: `docs/routes/{penize,zebricek,poslanec,zakony,app-shell}.md`
  (admin lives in app-shell's record), `docs/db-architecture-guide.md`,
  `docs/case-loops.md` (Authority section: the door now covers bill + effort verdicts).

## Hot-file policy

- `ddl.ts`: append only, in your named block; G5 appends its own block; the
  coordinator resolves the trivial append conflict.
- `lib/db/store.ts`: G1 appends to `KnowledgeGraphRepository`; you append to
  `ReviewRepository`. Different interfaces, no shared lines.
- `features/admin/`: G5 edits `SystemStateStrip.tsx` and `getAdminData.ts`'s system
  state section. Keep your `getAdminData.ts` edits inside the review-hub block.
- `lib/testing/sentinel/invariants.ts`: G5 adds checks too. Add yours as separate
  functions appended before the roster, and append your ids at the END of the
  roster array.

## Honesty rules

- Machine verdicts stay `machine` on backfill; nothing is ever upgraded to
  human-confirmed by a script.
- Reject is terminal per kind; `needs-more` may return a claim to pending, never
  to published.
- Verify the store copy discipline: any props backfill is merge-preserving
  (`memory/kg-upsert-replaces-props.md`) and tested on a PGlite fixture.
- Symmetry: the queue orders by evidence completeness, never by score or party.

## Build order

1. DDL + ledger v2 tag + chain verifier accepting both tags; PGlite tests
   (write v1 rows, then v2 rows, verify).
2. `setReviewState` dispatcher with `tie` branch (existing tests green unchanged),
   then `bill_verdict`, then `effort_verdict`; tests per branch incl. terminal reject.
3. Effort writers stamp `machine`; prop-registry keys; verdict-provenance pure module.
4. `VerdictProvenance` primitive + the three badges + loaders.
5. `/zakony` gate read; `/admin` queues + server action.
6. Sentinel checks; docs.

## Gates and report

As in the README. Measured in the report: claim kinds with a writer (before 1,
after 3), badges carrying a rung (before 0), and the fault-injection result: a
mass `machine → verified` flip without audit rows makes `effort-review-chain`
fire (write that test).
