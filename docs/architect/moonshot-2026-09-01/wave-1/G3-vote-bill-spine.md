# G3 — the vote→bill spine and club-at-vote (wave 1)

Cards: deck #30 (`decides` edge from the agenda-item join), #29 (club affiliation
dated at the ballot). Registry: legislative-change-tracking / bill-fate-dating;
roll-call-vote-analysis / club-line-and-rebellion; parliamentary-data-modeling /
membership-window-modeling.

## Goal of this wave's slice

### A. `decides` edge

1. Probe first, on the test-lane store or a fixture built from the real UNL
   samples in `lib/ingest/sources/*.test.ts` fixtures: join PSP10 `vote_event`
   `(termPspId, sessionNo, agendaItem)` → `bod_schuze (id_schuze→schuze.id_org, id_bod)`
   → `id_tisk`. Record the join rate, the count of multi-print agenda items and of
   votes whose item names no print, in `docs/data-analysis/graph-log.md` (append)
   and flip `docs/data-analysis/frontier.md` Q-law-2 from "blocked (ingest)" to the
   measured state.
2. Register rel `decides` (vote → bill) in `lib/analysis/kg-verdict.ts` (append to
   `KG_EDGE_RELS`), `lib/kg/prop-registry.json` (edge props: `votedOn`, `outcome`,
   `readingStage` nullable, `joinBasis: "schuze+bod"`), `docs/data-analysis/graph-schema.md`.
3. Writer `scripts/data-analysis/kg-vote-bill-ingest.ts`: deterministic, many-to-many
   with the ambiguity COUNTED (`coverage.votesWithoutPrint`, `agendaItemsMultiPrint`),
   merge-preserving under the `kg-upsert-replaces-props` guard, pass provenance,
   `--dry-run` default, `--commit` to write. Never guess a print from a title.
4. Reads: `LawBill` gains `rollCalls: {votePspId, votedOn, outcome, readingStage|null,
   clubLines}` from `getFullVoteRecord().voteIndex` (one derivation, imported);
   `BillDetail` renders "how the chamber and each club stood, reading by reading"
   with `SourceNote`. `LedgerVote` gains `billCislo | null`; ledger rows link
   `/zakony/<cislo>`. `/volby` `SponsoredBill.finalVoteOn` as a later dated fact in
   the timeline (a record row, positions only — the `contested.ts` doctrine).

### B. club-at-vote

5. `store.clubWindowsByMandate(term)` beside `clubByMandate` returning
   `Map<mandate, {club, fromAt, toAt}[]>` from `membership` windows;
   `lib/analysis/clubAt.ts` pure `clubAt(windows, mandate, isoDay)` (open `toAt` =
   current; no window → `null`; two windows on one day → refuse + count).
6. `features/votetrack/record/derive.ts` threads `votedOn` into both passes; new
   `coverage.outsideClubWindow` bucket (never folded into `unaffiliated`, never
   scored); the rebellion chronicle names the club AT the vote; kompas board copy
   distinguishes "klub při hlasování" from "klub dnes".
7. `lib/analysis/kg.ts` `rebellion()`/`partyCohesion()` and `kg-compute.ts` take
   the windows — UNDER THE REPLAY GATE (`memory/recompute-replay-gate.md`): the old
   formula must reproduce every stored `rebellion_rate` on a fixture before the
   windowed formula writes with a new pass. Ship the before/after table in
   `docs/routes/hlasovani.md`. If the replay cannot be run this wave, ship steps
   5–6 and report 7 as carry-over — do not write the graph.

Out of this wave: deník entries for decisive readings (G16), RSS, retiring
`clubByMandate` (only once no consumer remains).

## Owned paths

- `lib/ingest/sources/psp-activity.ts` (only if a `bod_schuze` reader is missing),
  `lib/analysis/kg-verdict.ts` (append to the rel array), `lib/kg/prop-registry.json`
  (`decides` edge block, alphabetical), `lib/analysis/clubAt.ts` (new) + test,
  `lib/analysis/kg.ts` (rebellion/cohesion signatures), `scripts/data-analysis/kg-vote-bill-ingest.ts`
  (new), `scripts/data-analysis/kg-compute.ts` (windows plumbing only).
- `lib/db/pglite/repositories/graph.ts` (`clubWindowsByMandate`), `lib/db/store.ts`
  (append the method to the graph repository interface).
- `features/lawwatch/getLawData.ts`, `features/lawwatch/lawTypes*.ts`,
  `features/lawwatch/components/BillDetail.tsx`.
- `features/votetrack/**` (`record/derive.ts`, `ledgerRead.ts`, ledger types, kompas
  board copy) + tests.
- `features/volby/volbyLoader.ts`, `lib/analysis/volby/rules.ts` (`law_final_vote`
  record row), tests.
- `messages/{cs,en}.json`: `zakony.*`, `hlasovani.*`, `volby.*` keys.
- Docs owed: `docs/routes/{zakony,hlasovani,volby}.md`, `docs/data-analysis/{graph-schema,graph-log,frontier}.md`.

## Hot-file policy

- `lib/analysis/kg-verdict.ts`: append your rel at the END of the array; nobody
  else touches it this wave.
- `lib/kg/prop-registry.json`: insert your edge block alphabetically; G2 adds
  person/bill node keys — different objects.
- `lib/db/store.ts`: append to the graph repository interface only.
- `features/lawwatch/getLawData.ts`: G2 edits the review-state read (one line
  near `:340`); keep your edits in the bill-shaping block.

## Honesty rules

- Every cap ships its population (`votesWithoutPrint`, multi-print counts printed
  on the surfaces that use the edge).
- A ballot cast on a day inside no club window is `outsideClubWindow`, disclosed.
- Named MPs' rebellion rates move only with the replay proof and the published
  before/after table.

## Build order

1 probe + graph-log/frontier · 2 rel + registry + schema · 3 writer (dry-run tested
on a fixture) · 4 lawwatch/votetrack/volby reads · 5 windows read + clubAt ·
6 derive.ts + copy · 7 replay-gated recompute (or carry-over) · docs.

## Report

As the README, plus: join rate, multi-print count, votes-without-print count,
persons with >1 club window in PSP10, ballots outside the assigned window, and
whether step 7 ran.
