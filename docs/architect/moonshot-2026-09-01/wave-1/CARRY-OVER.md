# Wave 1 — what shipped, what carries over (merged 2026-09-05)

All five branches merged into master (`4332800` G1, `4ebcddd` G3, `e5c16c5` G4,
`57e45ca` G2, `085baad` G5). Builder reports are summarised here; the route
records and `docs/db-architecture-guide.md` carry the dated detail.

## Shipped

- **G1 as-of spine** — `asOf` in the Store contract with point reads + epoch rule;
  `/zdroj?k=` re-derives at a day and a `gone` receipt shows its last version;
  `/overeni` three-column `moved` for the zdroj family (`notReplayable` for the
  derived-figure families); `g2.<state>.<hash8>.<YYYYMMDD>` citations with a
  pure `diffViews()`; schránka `scoreMagnitude` pure half.
- **G2 review door** — `review_audit` generalised (subject_kind/subject_id, v2
  hash domain, legacy rows read as `tie` at read time, never rehashed); ONE
  `setReviewState` writer with `tie`, `bill_verdict`, `effort_verdict` branches;
  effort verdicts stamped `machine` and rendered with their rung; `/zakony` stops
  fabricating `pending_review` (141 → 0); `/admin` per-kind coverage board;
  sentinel `review-coverage`, `effort-review-chain`.
- **G3 vote→bill spine** — `decides` writer from the agenda-as-taken join
  (measured: 473 / 2 075 valid roll calls; the `pozvanka = 1` numbering was 27,5 %
  correct vs 97,2 %); bill roll calls on `/zakony`, print links on `/hlasovani`,
  final-vote record rows on `/volby`; `clubWindowsByMandate` + `clubAt` in the
  record (population of floor-crossers today: 0).
- **G4 graph explorer** — three-state gate through the core (a rejected hop never
  ranks or exports as verified), `PATH_RULE_REF` + per-relation provenance
  aggregate, `okoli` neighbourhoods as a citable view; announced derivation bump
  for `cesta` citations.
- **G5 provenance + certification** — `lib/kg/provenance.ts`, generated
  `source`/`ingest_run_id` columns, stamped writers, dry-run backfill, `/atlas`
  scorable 3 → 14, `sentinel_run` + certification on `/data`, roster 11 → 16,
  loader-degradation sidecar, sentinel cron wired to a backup artifact.

## Coordinator actions after the merge

- [ ] `npm run db:migrate` on the live store (G2 + G5 DDL; snapshot first).
- [ ] `npx tsx scripts/data-analysis/kg-vote-bill-ingest.ts` dry-run, then `--commit`.
- [ ] `kg-provenance-backfill` dry-run on a copy, then `--commit` on the live store.
- [ ] Repository variable `SENTINEL_STORE_RUN_ID` (the ingest machine's `db:backup`
      run) — without it the nightly sentinel is red by design.
- [ ] Live per-relation provenance query (`select rel, provenance->>'pass',
      provenance->>'ref', count(*) from kg_edge group by 1,2,3`) → record in graf.md.

## Carry-over, assigned

| Item | From | To |
| --- | --- | --- |
| `/graf/p` then-side replay: `resolveView(state, at)` over `graphLoader` parameterised by `KgAsOfReads`; JSON-LD `hasPart` then-side; OG "změněno od" | G1 | wave 4 carry-over group (graph) |
| Figura family as-of (`liveFigures` re-derivation through as-of-parameterised loaders) | G1 | G8 (addendum) |
| schránka read wiring: `asOfNode` per followed MP in `getRecomputeFact.ts` → `recomputeDelta` 4th arg | G1 | wave 4 carry-over (small) |
| `/denik` `recompute` rows; `retrievedAt` → instant on minted claims | G1 | wave 4 |
| `/admin` decision buttons + server action through the one writer | G2 | wave 4 carry-over |
| `tripwire` dismissals + `lead` sidecars (durable subject needed) | G2 | wave 4 |
| `/overeni` gate modifier for bill claims | G2 | G12 (addendum) |
| `/penize/kontrola` lane for the new claim kinds | G2 | G13 (addendum) |
| Rung props on `HeadToHead`, `KrajPage`, `DashboardPage` (default null today) | G2 | G15 (addendum: dashboard), G10 (KrajPage/HeadToHead) |
| Step 7: `rebellion()`/`partyCohesion()`/`kg-compute` under the replay gate (meaningful only once a floor-crosser exists) | G3 | wave 4, conditional |
| `/overeni` `grafVerdict` via `worstGateOfView` (diff in G4's report) | G4 | G12 (addendum) |
| Sentinel `graph-provenance-uniformity` (mixed-within alarm) + `path-rule-ref` | G4 | wave 4 |
| `/dashboard` state-slice provenance variant table | G4 | G15 (addendum) |
| `/penize/firma/[ico]` + tender cross-links into `/graf?okoli=`; `caseFileLink` in graph | G4 | G13 (addendum) |
| `/zdroj` + `/graf/p` printing run + pass (`kg_*.source`, `ingest_run_id`, `provenance->>'pass'/'ref'/'writer'`) | G5 | G8 (addendum: receipts) |
| `/data` snapshot `limits` per source | G5 | G12 (addendum) |
