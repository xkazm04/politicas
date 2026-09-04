# G5 — structured graph provenance and sentinel-certified releases (wave 1)

Cards: deck #22 (source + run + pass on every kg row, sealed per pass), #26
(sentinel-certified releases). Registry: claim-verification-and-provenance /
derivation-comparison ("never ran must not render as passed"); laws
provenance-or-nothing, every-cap-ships-its-population, disclose-never-repair.

## Goal of this wave's slice

### A. Provenance contract (#22) — the columns and the writers

1. `lib/kg/provenance.ts`: the ONE `KgProvenance` type `{source, ingest_run_id,
   pass, ref, writer}` + `assertProvenance()`; `source` ∈ the atlas
   `INGESTED_SOURCES` keys (import the constant from `lib/analysis/atlas.ts`);
   `ref` a declared formula/batch ref. `lib/kg/prop-registry.json` gains the
   provenance keys.
2. `CORE_DDL`: two STORED generated columns on `kg_node` and `kg_edge` —
   `source text generated always as (provenance->>'source') stored`,
   `ingest_run_id bigint generated always as ((provenance->>'ingest_run_id')::bigint) stored`
   — plus indexes, in a block commented `-- [G5 provenance columns]` at the END
   of `CORE_DDL`. `disclosePendingDdl` must report them as additive. The
   coordinator runs `npm run db:migrate` on the live store after merge; you prove
   the DDL on the PGlite test lane (`premigration.test.ts` pattern).
3. Writers refuse an unstamped write unless `--allow-unstamped` (migration only):
   `scripts/data-analysis/{kg-compute,kg-promote,persist-batch,kg-forensics,kg-money-ingest,kg-legislation-ingest,kg-contribution-ingest}.ts`
   — each stamps `{source, pass, ref, writer}`; `ingest_run_id` set when the
   writer opened an `ingest_run` (graph passes become `ingest_run` rows, writer =
   script name, note = batch id).
4. Migration pass `scripts/data-analysis/kg-provenance-backfill.ts`: derive
   `{source, pass, ref}` from what `provenance` already holds where unambiguous
   (contribution and forensic stamps are); else `source: "unknown"` — COUNTED,
   never guessed; merge-preserving (never a props replace); `--dry-run` default;
   report per-outcome counts. Never run it against the live store from the
   worktree.
5. `/atlas`: `readEntityCoverage` extends to graph sources via the new columns;
   the unscored list shrinks to `generated-module`/`none` landings; the integrity
   rule's printed sentence stays true only if `RUN_TABLES` is extended — extend
   `lib/db/pglite/repositories/ledger.ts` `RUN_TABLES` by `kg_node`/`kg_edge`
   filtered by `ingest_run_id`, and `sealIngestRun` over them; `ATLAS_RULES` prose
   updated in the same commit (`features/atlas/messages.test.ts` pins the Czech
   sentence to the constant — update both). Rows with `source: unknown` are
   counted on the card, not hidden.

### B. Certified releases (#26)

6. `sentinel_run(manifest_hash, ran_at, verdict, report jsonb)` in `CORE_DDL`
   (same `-- [G5 …]` block); `scripts/sentinel/run.ts` persists its canonical report
   through a pending-queue file applied on the next live open (`lib/db/pglite/pending.ts`
   pattern) — the run itself never opens the live handle.
7. `features/data-releases/manifest.ts`: `certification: ok | violation |
   unevaluable | none` = the newest sentinel verdict FOR THIS manifestHash (exact
   match only); `/data` prints "invarianty ověřeny k <date> (n/m)" or "neověřeno —
   sentinel nad tímto otiskem neběžel"; `/data/manifest.json` carries it;
   `loader.test.ts` pins page == JSON.
8. Roster: `money-rank-cache` (stored `review_rank` == pure `reviewTier` per tie,
   population shipped), `law-provenance-uniformity`, `graph-provenance-uniformity`
   (per layer: one `{pass, ref}` or a named split with counts; mixed WITHIN one
   rel is the alarm), `amends-closure`. Report schema stays `/1` (additive enum
   values only).
9. `lib/db/loaderGuard.ts`: a bounded JSONL append (`.data/loader-failures.jsonl`,
   "write fails LOUD" contract) beside the existing console/Sentry no-op;
   `/admin` `SystemStateStrip` renders "degradace za 24 h: N (loader, count, last)";
   sentinel `loader-degradations` check (unevaluable when the file is absent).
10. `.github/workflows/sentinel.yml`: ADOPTION POINT wired to download the latest
    `db:backup` artifact; restore the cron; red on `unevaluable`.

Out of this wave: `/graf/p` and `/zdroj` printing run + pass (G1 owns those
surfaces — report the field names they should read); `/data` snapshot `limits`
per source. Report as carry-over.

## Owned paths

- `lib/kg/provenance.ts` (new) + test; `lib/kg/prop-registry.json` (provenance keys).
- `lib/db/pglite/ddl.ts` (append-only block), `lib/db/pglite/repositories/ledger.ts`,
  `lib/db/pglite/pending.ts` (if the queue needs a new kind), `lib/db/loaderGuard.ts`,
  `lib/db/types.ts` (new row types appended), tests.
- `scripts/data-analysis/**` writers named above + the backfill script;
  `scripts/sentinel/run.ts`; `lib/testing/sentinel/**`.
- `lib/analysis/atlas.ts` (only `INGESTED_SOURCES` export reuse + coverage shape),
  `features/atlas/**`, `features/data-releases/**`, `features/admin/components/SystemStateStrip.tsx`,
  `features/admin/getAdminData.ts` (system-state block only).
- `.github/workflows/sentinel.yml`.
- `messages/{cs,en}.json`: `atlas.*`, `data.*`, `admin.system.*` keys.
- Docs owed: `docs/routes/{atlas,data,app-shell,graph-writers}.md`,
  `docs/db-architecture-guide.md`, `docs/data-analysis/graph-schema.md`.

## Hot-file policy

- `ddl.ts`: append-only in your named block (G2 appends its own).
- `lib/testing/sentinel/invariants.ts`: G2 appends review checks; you append
  yours as separate functions and append ids at the END of the roster array.
- `features/admin/getAdminData.ts`: G2 edits the review-hub block; keep to the
  system-state block.
- `lib/analysis/atlas.ts`: export what you need; do not reshape `deriveAtlas`'s
  inputs except by adding optional fields.

## Honesty rules

- `source: "unknown"` is a first-class, counted value; a migration that guesses a
  source violates disclose-never-repair.
- The sentinel run never opens the live handle; the certification join is exact
  match on `manifest_hash`.
- Every writer touched must keep the merge-preserving idiom
  (`mergeComputedNodeProps`); a copy-verified test proves later-pass props survive.

## Build order

A1 → A2 (DDL on the test lane) → A3 (writers, one commit each or grouped by idiom)
→ A4 (backfill dry-run on a fixture) → A5 (atlas + seal) → B6 → B7 → B8 → B9 →
B10 → docs.

## Report

As the README, plus: sources scorable before/after (3 → n), rows stamped vs
`unknown` on the fixture backfill, roster size (11 → n), `certification` value
rendered on the `/data` test fixture, and the field names `/zdroj`/`/graf/p`
should read.
