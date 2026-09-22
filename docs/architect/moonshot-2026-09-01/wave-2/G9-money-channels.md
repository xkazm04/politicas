# G9 — three money channels as dated edges; CZ-NACE on every company (wave 2)

Cards: deck #24 (subsidy + donation join contracts as dated graph edges), #44
(registry sector codes). Registry: public-money-attribution / citable-money-claims;
conflict-of-interest-detection / temporal-alignment-of-money-and-role,
statute-relevance-mapping; laws every-cap-ships-its-population,
deterministic-code-owns-numbers, disclose-never-repair.

Builds on wave 1: G5's stamped writers (`lib/kg/provenance.ts`). Runs beside G6
(dated edges): you write NEW node kinds and relations; G6 changes the shape of
existing edge rows. Do not edit `types.ts`/`mappers.ts`/`kg.ts` this wave — report
if you need to.

## Goal of this wave's slice

### A. Channels as edges (#24)

1. Schema first: `subsidy:<source>:<id>` node kind (props `amount`, `decidedOn`
   / `paidOn`, `provider`, `programme`, `amountBasis`, source URL, `accessedAt`)
   with `receives_subsidy` company → subsidy; `donates_to` company/person → party
   (props `date`, `amount`, `donor_ico`, `year`, source URL). Append kinds/rels at
   the END of the `kg-verdict.ts` arrays; registry + `graph-schema.md` rows in the
   same commit; every record IČO-keyed through `canonicalIco`.
2. Pure builders in `lib/analysis/kg-money.ts` beside `supplies`, fixture-tested
   with NO invented data (fixtures from real payload samples).
3. Ingest adapters in `lib/ingest/sources/`: CEDR/DotInfo (subsidies), SZIF
   (subsidies — `STATE.md` item 5), ÚDHPSH annual reports (party donations). Each
   shape-asserted, cached under `.data/`, rate-limited with the shared backoff,
   `--dry-run` default; persistence via `persist-batch.ts` with a new pass. Do NOT
   run against the live store from the worktree; ship the adapters + the fixture
   run + the writer.
4. Parity gate script: replay `subsidies_total_czk` / `donated_to_party_czk` from
   the new edges per company and report every company where the two differ; the
   scalar props stay untouched and the delta is DISCLOSED on the company file
   (`ChannelDisclosure`, the `BasisDisclosure` pattern) — never reconciled by repair.
5. Reads: `moneyLoader.ts`'s supplies fold becomes three channel folds sharing one
   `moneyReaches*` predicate family; `ReachableTie` carries per-channel
   `{czk, count, coverage}` and `reachableMoney` keeps the split (coordinate with
   G6's `alignedCzk` fields: add yours as siblings, do not rename theirs);
   `MONEY_METRIC` gains `dotace-firmy` / `dary-firmy` (two `// [G9]` branches in
   `liveFigures.ts` — G8 reconciles).
6. `relevantStatutesFor(tie, events)` takes dated channel events; `voteInRolePeriod`
   / the G6 `roleWindow` helper stays the one window test; subsidy/donation
   statutes fire on a channel date inside the role window, not on `count > 0`;
   coverage gains "grants inside window / total".

### B. NACE (#44)

7. `parseAresCompany` keeps `czNace[]` (`naceCodes: string[] | null`) and
   `legalFormCode`; fixture tests from a real ARES payload.
8. `nace_codes`, `nace_provenance` registered; one merge-preserving sweep
   `scripts/case-loops/money/nace-sweep.ts` (dry-run default, throttled like
   `reconcile-ares-vr.ts`).
9. `lib/analysis/sector.ts`: NACE section/division → the existing `Sector` union
   (primary code first, count disclosed); unknown → `null`. `company-sectors.ts`
   becomes a thin importer; `SECTOR_OVERRIDES` shrinks to statutory exceptions,
   each with its incident; `triage-core.ts` and the tender authority code import
   the same module. Re-run `collision-check.ts` on a fixture and record the fire
   rate before/after in the law ledger doc.
10. `/penize/firma/[ico]` and `/zakony` collision rows print the NACE code with a
    `SourceNote` citing ARES + fetch date; the NACE→sector table on `/metodika`.

Out of this wave: live persistence of any new channel or NACE data (coordinator
runs the writers after merge under the loop's hygiene), `reviewSignal` changes.

## Owned paths

- `lib/analysis/kg-verdict.ts` (append), `lib/kg/prop-registry.json` (new blocks),
  `lib/analysis/kg-money.ts`, `lib/analysis/money-feed.ts` (parser + channel readers),
  `lib/analysis/sector.ts` (new), `lib/ingest/sources/{cedr,szif,udhpsh}.ts` (new) + tests.
- `scripts/case-loops/money/{nace-sweep,channel-parity}.ts` (new),
  `scripts/case-loops/law/{company-sectors,triage-core}.ts`, `scripts/data-analysis/kg-money-ingest.ts`.
- `features/money/moneyLoader.ts` (channel folds), `features/money/reachableMoney.ts`
  (sibling fields), `features/money/collisions/statuteRelevance.ts` (dated events),
  `features/money/moneyClaims.ts` (+ two metrics), `features/money/components/ChannelDisclosure.tsx`
  (new), `features/money/CompanyCaseFilePage.tsx` (NACE + disclosure),
  `features/lawwatch/components/*Collision*` (NACE cell only), `features/civicscore`
  metodika money section (NACE table).
- `messages/{cs,en}.json`: `penize.*`, `zakony.kolize.*`, `metodika.*`.
- Docs owed: `docs/routes/{penize,zakony,metodika}.md`, `docs/data-analysis/graph-schema.md`,
  `docs/data-analysis/case-money/STATE.md`, `docs/data-analysis/frontier.md` (Q-law-1).

## Hot-file policy

- `kg-verdict.ts` arrays: append at the END (G7 appends `municipality`, `party_to`,
  `founded` — different literals).
- `reachableMoney.ts` / `moneyLoader.ts`: G6 is editing the same files for
  alignment. Keep your edits in channel-fold blocks marked `// [G9]` and add
  fields as siblings; if the same function body must change in both, stop and
  report — the coordinator sequences it.
- `liveFigures.ts`: two `// [G9]` branches only.

## Honesty rules

- Hlídač totals vs primary registers: disclose the delta, never repair.
- Subsidy statutes fire on a dated event inside the window, or not at all.
- Primary NACE decides the sector; the code count is disclosed.

## Build order

A1 → A2 → A3 → A4 → A5 → A6 → B7 → B8 → B9 → B10 → docs.

## Report

README shape, plus: fixture parity table (companies where edges ≠ scalar), strety
candidate count before/after the date gate on the fixture, NACE coverage on the
fixture, collision fire rate before/after, carry-over.
