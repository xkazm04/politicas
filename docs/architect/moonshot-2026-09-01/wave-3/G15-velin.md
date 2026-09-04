# G15 — the velín: sealed instrument readings; reader-seeded slices (wave 3)

Cards: deck #2 (sealed instrument readings — the velín as a dated series), #45
(reader-seeded slices). Registry: claim-verification-and-provenance /
recomputation-receipts, claim-ref-addressing ("format migrations decode both
shapes"); accountability-publishing-ethics / real-vs-illustrative-form-encoding,
honest-empty-states; laws missing-is-not-zero, non-partisan-symmetry.

Builds on: G1 (both-sides `moved`), G5 (release manifest + certification), G8
(chamber claims, `CitableNumber` on tiles). You own `features/dashboard/**` and
`features/landing/**` this wave.

## Goal of this wave's slice

### A. Sealed readings (#2)

1. `InstrumentReading` (pure, `features/dashboard/reading.ts`): `{releaseVersion,
   cutAt, pass, provenance, tiles, top, histogram, slice: Pick<StateSlice,"graph"|"rule">,
   sliceHash, landing: LandingData}` — the wire shapes imported, not copied;
   canonical JSON + `contentHash`.
2. `instrument_reading` table (append-only, keyed by release version) in a
   `-- [G15 instrument readings]` block; one writer repository; the release-cutting
   path in `scripts/data-analysis` writes one reading per successful
   `kg-compute`/`kg-promote` run and refuses when `provenance.state !== "uniform"`;
   sealed into the ledger chain like `merkle_root`.
3. `getLatestSealedReading()` (server-only, `react.cache`); `app/dashboard/page.tsx`
   passes `{live, sealed}`; `DashboardPage` renders live → sealed-labelled ("odečet z
   verze V — úložiště momentálně nečitelné", ochre illustrative form) →
   `DataUnavailable`; DELETE `buildStateGraph()`/`MockStatTiles`/`MockRankingLedger`/
   `CHAMBER_TREND` consumers from the velín (keep the `lib/civic` shapes for their
   tests until the last consumer goes). The label is asserted in `messages.test.ts`:
   a sealed reading is never served as "today".
4. Landing: `SpecimenUnavailable` and the ranking section render the sealed
   reading with its version (the `LiveDataNotice` wording pattern).
5. Series: the histogram tile gains `avgByRelease[]` from the reading table (every
   point cites its release version); `ChamberChart` draws it instead of the mock trend.
6. Exhibit + gate: `getExhibitData()` on `fresh === false` looks the hash up in the
   sealed readings; `ExhibitViewModel.cited: {version, cutAt, graph, rule} | null`;
   `hashedVerdict` `moved` carries both sides (extend G1's fields, do not reshape).

### B. Reader-seeded slices (#45)

7. `stateSlice.ts`: `SliceInput.population?: {kind: "kraj"|"klub"|"obec", key,
   pspIds, label, size}`; `buildStateSlice` filters `tiedMps` BEFORE the unchanged
   pspId-asc rule; `StateSliceRule.population` printed; a test pins that the
   default population yields the byte-identical graph.
8. `exhibit.ts`: `rez.<view>.<hash>` for non-default views, `rez.<hash>` kept for
   the default; `decodeExhibitId` accepts both; the recorded layout-field eviction
   (`exhibit.ts:63-70`) rides the same migration window with both hashes shown
   during it; `refDetect` regex + `guide.ts` example widen.
9. `getDashboardData(options.view)` resolves kraj/club from the leaderboard
   payload (no new read); an empty population returns a labelled "no MP in this
   population carries both bands", never the default slice; a population < 3
   seeds prints that it is partial.
10. Entry links: `features/volby/KrajPage.tsx` + `/kraj` card → `/dashboard?vyrez=kraj:<slug>`;
    on the landing a third door only if the reader's kraj is known client-side
    (localStorage, the `/schranka` pattern), else nothing.

## Owned paths

- `lib/db/pglite/ddl.ts` (append block), `lib/db/pglite/repositories/readings.ts`
  (new), `lib/db/store.ts` (append), `lib/db/types.ts` (append), ledger seal hook.
- `scripts/data-analysis/{kg-compute,kg-promote}.ts` (the reading write at the end
  of a successful pass; nothing else).
- `features/dashboard/**`, `features/landing/**` (rendering of sealed readings only),
  `app/dashboard/**`, `features/overeni/{refDetect,guide,verdict}.ts` (exhibit family
  only — G12 owns the rest; coordinate by keeping to the `exponat` branch),
  `features/volby/KrajPage.tsx` (one link), `features/civicscore/KrajPage.tsx` (one link).
- `messages/{cs,en}.json`: `dashboard.*`, `landing.*`, `overeni.exponat.*`.
- Docs owed: `docs/routes/{dashboard,landing,overeni}.md`, `docs/db-architecture-guide.md`.

## Hot-file policy

- `ddl.ts`, `store.ts`, `types.ts`: append-only.
- `verdict.ts`/`refDetect.ts`: exhibit branch only; G12 edits the others in the
  same wave — if a shared line is unavoidable, stop and report.

## Honesty rules

- A reading from a non-uniform store is refused at write time.
- A sealed reading renders in the illustrative form with its version; never as today.
- A small population's slice prints its size; the seed rule never orders by a metric.

## Build order

A1 → A2 → A3 → A4 → A5 → A6 → B7 → B8 → B9 → B10 → docs.

## Report

README shape, plus: mock renderers referenced from `features/dashboard` (4 → 0),
distinct `rez.` addresses decodable (old fixtures all decode), the sealed fallback
rendering on a store-down fixture, carry-over.

## Addendum from wave 1 (2026-09-05)

- **State-slice provenance table** (G4 carry-over): `/dashboard` prints the
  per-relation `{pass, ref}` variant table from `summarizeGraphProvenance`
  (`lib/kg/graphProvenance.ts`) with a `SourceNote`.
- **Rung props** (G2 carry-over): `DashboardPage` badges pass the effort verdict
  rung instead of defaulting to null.
