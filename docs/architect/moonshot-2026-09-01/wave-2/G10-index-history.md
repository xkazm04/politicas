# G10 — the index publishes its history: formula revision ledger; legislative substance (wave 2)

Cards: deck #32 (formula revision ledger), #46 (legislative substance ledger).
Registry: politician-performance-scoring — "corrections are published, not
absorbed", formula-lineage-stamping, "narrow the claim"; laws
provenance-or-nothing, incident-anchored-doctrine, missing-is-not-zero.

Builds on wave 1: G2's effort-verdict review state (do not touch the badges);
G5's stamped writers.

## Goal of this wave's slice

### A. Formula revision ledger (#32)

1. `formula_revision` (`ref, predecessorRef, pass, computedAt, subjectsMoved,
   pointsMoved, ranksMoved, saturationBefore/After, staleProseFields, auditRef`)
   and `formula_revision_subject` (`ref, pass, pspId, scoreBefore, scoreAfter,
   rankBefore, rankAfter`) appended to `CORE_DDL` in a `-- [G10 formula revisions]`
   block; repository in `lib/db/pglite/repositories/formulaRevisions.ts`, exposed
   on `Store` (append).
2. `scripts/data-analysis/kg-contribution-recompute.ts` writes both tables in the
   SAME transaction as the node stamps, after the replay gate passes;
   `guardContributionWrite`'s refusal names the last revision. A partial write
   rolls back both.
3. Seed: a one-off, provenance-stamped backfill script that loads the pass-42 row
   from `docs/data-analysis/contribution-pass42-audit.json` (207 subjects) —
   dry-run default; the coordinator runs it after merge.
4. Pure `lib/analysis/formula-revisions.ts` (shape, ordering, sentence builder as
   message KEYS) + tests; loader `features/civicscore/getFormulaRevisions.ts`
   (server-only, `reportLoaderFailure`, `KG_READ_CAP`).
5. `/metodika` §"Opravy metodiky": table of revisions, every figure from the row,
   `SourceNote` citing the pass; `messages.test.ts` bans literal counts.
   `/poslanec`: one dated sentence under the score for MPs with a subject row —
   absent row renders NOTHING (not "no change"). `/overeni`: when a pasted claim's
   derivation differs, look up the transition and render the revision line beside
   `moved/basis` (extend the figura verdict fields; G8 owns `liveFigures.ts`, you
   own only the revision lookup — put it in `features/civicscore/`).
6. Sentinel `revision-chain`: every distinct historical ref in `formula_revision`
   chains to `CONTRIBUTION_FORMULA_REF`; a stamped ref with no revision row is
   `unevaluable`, not ok.

### B. Legislative substance (#46) — annotate, never adjust

7. `kg-contribution-ingest.ts` writes `interpellations_written` + `interpellations_oral`
   beside the sum (registry keys; the score input stays the sum — pin with a test
   that `computeContribution` output is byte-identical; `CONTRIBUTION_FORMULA_REF`
   unchanged).
8. Pure `lib/analysis/legislative-substance.ts`: per-MP `{billsFirstSigned,
   billsCoSigned, billsEnacted, billsRejected, billsPending, interpellationsWritten,
   interpellationsOral}` from the `sponsors` edges + bill `stav`/`fate_sb`
   (psp.cz `typ_stavu` vocabulary disclosed, never remapped); tests.
9. Chamber pass attaches the split facts to `DuelFacts` with real chamber medians
   + `chamberN`; profile aggregates fates from the neighbour read it already
   performs (no new store read); render in the legibility panel (`ScoreLegibilityPanel`
   composition rows), Souboj rows (`DUEL_FACT_DEFS` extended), `/zebricek`
   expanded-row column; `/metodika` paragraph: the score counts instruments, the
   ledger shows what they were, weights unchanged and why. The lens grammar is
   NOT extended.
10. Symmetry: the split renders for all 207 or none; a missing split renders
    „údaj chybí", never 0.

## Owned paths

- `lib/db/pglite/ddl.ts` (append-only block), `lib/db/pglite/repositories/formulaRevisions.ts`
  (new), `lib/db/store.ts` (append), `lib/db/types.ts` (append) + tests.
- `scripts/data-analysis/{kg-contribution-recompute,kg-contribution-ingest}.ts`,
  `scripts/data-analysis/formula-revision-seed.ts` (new).
- `lib/analysis/{formula-revisions,legislative-substance}.ts` (new) + tests,
  `lib/analysis/contribution.ts` (NO formula change; comments only if needed),
  `lib/analysis/score-legibility.ts`, `lib/kg/prop-registry.json` (person keys).
- `features/civicscore/**` (`getFormulaRevisions.ts` new, `getLeaderboardData.ts`
  facts attach, `duelFacts.ts`, metodika components, `ScoreLegibilityPanel`,
  `LeaderboardRow` expanded column) EXCEPT the three badges G2 owns.
- `features/profile/getProfileData.ts` (fates aggregate + revision sentence),
  `features/profile/components/{DossierSection,ScoreCitation…}.tsx` (revision line).
- `lib/testing/sentinel/**` (append `revision-chain`).
- `messages/{cs,en}.json`: `metodika.*`, `zebricek.*`, `poslanec.*`, `souboj.*`.
- Docs owed: `docs/routes/{metodika,poslanec,zebricek,overeni}.md`,
  `docs/data-analysis/{graph-schema,coverage-ledger}.md`, `docs/db-architecture-guide.md`.

## Hot-file policy

- `ddl.ts`, `store.ts`, `types.ts`, sentinel roster: append-only in named slots.
- `getLeaderboardData.ts`: G2 edited the effort prop reads block in wave 1; keep to
  the facts/duel block.
- `prop-registry.json`: alphabetical inserts.

## Honesty rules

- The recompute's transactional scope grows: both tables or neither.
- No formula change anywhere in this group; the byte-identity test is the proof.
- The fate vocabulary is the register's own words.

## Build order

A1 → A2 → A3 → A4 → A5 → A6 → B7 → B8 → B9 → B10 → docs.

## Report

README shape, plus: revisions rendered on the `/metodika` fixture, per-MP
sentences on the fixture, `computeContribution` byte-identity test result,
Souboj row count (4 → n), carry-over.
