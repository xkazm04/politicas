# features/volby — loaders (WP2 notes, 2026-08-27)

Server-only half of `/volby` (Volby: zrcadlo). The contract is
`lib/analysis/volby/{types,rules,terms,kraje,contested}.ts`; these files only READ the
store and compose. Nothing here persists, formats, or renders.

| File | Role |
| --- | --- |
| `tenderLayer.ts` | ONE memoised fold of `tender` nodes + `procures`/`wins` edges + authority `company` nodes → per-authority lots, winner totals, live arena census, per-arena baselines |
| `volbyLoader.ts` | shared: `VolbyResult<T>`, chamber through the election lens (`chamberForVolby`), `billsByMp`, `listRollups`/`listSummaries`, `authorityCard`, `volbyProvenance` |
| `getVolbyHomeData.ts` | `/volby` — census + 20 latest findings + list summaries |
| `getObecData.ts` | `/volby/obec/[ico]` — registry obec (404 when unknown) + kraj card + lists |
| `getKrajData.ts` | `/volby/kraj/[slug]` — crosswalk kraj (404 when unknown) + its current MPs |
| `getListData.ts` | `/volby/snemovna/[slug]` — one elected list, members' findings, contested record |

## Measured on the live store (2026-08-27)

- Cold tender fold: **3 814–4 065 ms** (reads 3 635–3 879 ms of it) over 61 421 tender
  nodes, 61 383 `procures`, 31 744 `wins`, 17 728 company nodes → 5 240 authorities.
  Warm `/volby` home: 134–144 ms; obec 141 ms; kraj 134 ms; list 237–242 ms.
- `wins.price_czk` filled on 16 955 / 31 744 wins; `decided_on` on 23 508. 494 lots carry
  more than one `wins` edge (the earliest dated winner is the lot's winner).
- 38 tenders have no authority at all, 498 an authority with no mapped company node.

## Decisions taken here (report to the Director)

1. **Arena is registry-corrected.** `electoral_arena` (pass 74, from the self-declared RVZ
   `kategorie_zadavatele`) files 1 296 registry obce as „Příspěvková organizace kraje"
   (→ krajske; statutární město Havířov among them), 129 as „Kraj", 70 as „Česká
   republika"; Středočeský kraj is komunalni, Jihočeský statni. The fold takes
   obec-registry ico → komunalni, crosswalk kraj ico → krajske, then the declared arena;
   both are kept (`arena`, `arenaDeclared`), 1 518 authorities move, and the census /
   baselines are computed over the corrected arena. Without it Havířov's card would run
   under the krajské term window.
2. **Current holder = open chamber membership** (`membership.organ_psp_id` = the `PSP10`
   organ, `to_at IS NULL`): 200 of 207 persons. `mandate_from/to` are null on every row.
   Fallback to `dedupeCurrentHolders` only when a store has no chamber rows (a fixture),
   and `currentHolderSignal` says which was used.
3. **Ballots are keyed by mandate**, so `listVoteBallots({ voteIds })` (the indexed read,
   2 400 rows / 33 ms for 12 roll calls) is filtered by the list's `mandatePspId`s here —
   `BallotListOptions` has no per-person filter.
4. No bill prop carries the sponsorship date → `sponsoredOn: null` on every law finding.
5. List slugs follow the organ labels verbatim: `ano2011`, `spolu`,
   `starostove-a-nezavisli`, `ceska-piratska-strana`,
   `svoboda-a-prima-demokracie-tomio-okamura`, `motoriste-sobe`.
