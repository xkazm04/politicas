# Graph schema — the evolving node/edge-type catalogue

The living catalogue of what the derived graph (`kg_node` / `kg_edge`, see
`lib/db/types.ts`) is allowed to contain. Starts from design §3 and **grows as new
relationship kinds are discovered** — when a pass introduces an edge type, add it
here with its provenance method and how it's grounded. The machine-enforced
version is the enum set in `lib/analysis/kg-verdict.ts` (`KG_NODE_KINDS`,
`KG_EDGE_RELS`); keep the two in sync.

> **Two provenance tracks share this store.** Passes 1–13 are the **analytical KG loop**
> (blocs / themes / contestedness; converged 2026-07-23). Passes 10–11 in the *money*,
> *law*, and *contribution* rows below are the **investigative "golden trio"** cases
> (① FollowTheMoney, ② Effort, ③ Law forensics), materialized **2026-07-24** — a separate
> effort that reuses the same `kg_node`/`kg_edge` tables, so their pass numbers are an
> independent sequence, not a continuation of the loop's. This unblocked the layers the
> older passes (and [[onboarding]], [[coverage-ledger]], [[cluster-committees-and-money]])
> recorded as *data-blocked*. Graph is now **2 989 nodes / 24 899 edges** (was 263 / 21 359
> at loop convergence). All three trio layers are `deterministic`; the only `verdict` money/law
> product is the human gate (below) and one bill forensic posudek.

> **Since batch 001 (passes 13–15)** case-loop provenance additionally carries **`track`**
> (`money` | `effort` | `law`) — see `docs/case-loops.md` §Provenance. Enrichment provenance
> is NESTED IN PROPS (`corroboration_provenance`, `effort_provenance`, `forensic_provenance`,
> `contribution_psp9.provenance`) so a row's identity provenance is never clobbered.

Every node/edge carries `provenance = {pass, method, ref, computedAt}`. Two methods:
- **`deterministic`** — computed in SQL/code from raw rows (`lib/analysis/kg.ts` via
  `npm run da:kg-compute`). Recomputable and exact; the LLM never authors these.
- **`verdict`** — proposed by a gated Sonnet subagent, persisted only after passing
  the schema + entity-id membership gate (`da:validate-kg-verdict`, then
  `da:kg-promote`). Cites the verdict it came from.

## Node kinds

| kind | id scheme | populated | props | how derived |
|---|---|---|---|---|
| `person` | `psp:person:<pspId>` | ✅ pass 1 (207) | `rebellion_rate`, `committee_count`, `contested_vote_rebellion`; + **contribution index** (`contribution_score` + 6 components, `absentee_manager_lead`) pass 11; + `contribution_psp9` (prior-term profile, complete on 109 continuing MPs) + `effort_*` dossier props (85, passes 14+17+19; closed vocabularies: `effort_low_score_reason` ×10, `effort_tenure_class` {full_term/replacement/departed/never_seated} on ALL 207, `effort_workhorse_flavour` {legislative/oversight}; **pass 34: `bills_first_signed`/`bills_co_signed`** — Q-effort-2 split of the bills_authored universe by predkladatel rank, sums to bills_authored which stays untouched; **pass 35: `amendments_authored`** — written amendments on graph bills, 86 nonzero) | raw entity + deterministic props |
| `party` | `psp:organ:<pspId>` (a Klub organ) | ✅ pass 1 (8) | `cohesion`, `cohesion_votes`, `seats` | raw entity + deterministic cohesion |
| `organ` | `psp:organ:<pspId>` (a výbor/komise) | ✅ pass 1 (33) | `member_count`, `organ_type` | raw entity |
| `bloc` | `bloc:<slug>` | ✅ pass 2 (2) | `overall_win_rate`, `control_timeline` | verdict + deterministic enrichment |
| `theme` | `theme:<slug>` | ✅ pass 3 (14) | `opposed_fraction`, `classification`, `bloc_support` | verdict + deterministic enrichment |
| `company` | `company:ico:<ico>` | ✅ **pass 10 (196)** | `ico`, `subsidies_total_czk`, `donated_to_party_czk` | `kg-money.ts` (Hlídač ⋈ ARES IČO join) |
| `contract` | `contract:<id>` | ✅ **pass 10 (2 287)** | `amount`, `signedOn`, `supplierIco` | `kg-money.ts` (Registr smluv via Hlídač) |
| `bill` | `bill:tisk:<tiskId>` | ✅ **pass 11 (141)** | `cislo`, `origin`, `amended_laws`, `sponsors`, `flagged_conflict`; gated `forensic_*` on **27** (passes 15+18+20; all `pending_review`, all severity=low); `amended_laws_full`/`amends_undercount` census props on 53 (pass 20); **pass 34: `sponsors_ranked` (signature order), `stav` (Czech typ_stavu state name), `fate_sb`/`fate_published_on` (Sbírka publication — 12/141)** | `psp-legislation.ts` + `law-verdict.ts` gate. ⚠ `amends` EDGES undercount body-amended statutes — gov omnibus 2.3× worse, tisk 64 = 148 real vs 1 recorded ([[contradictions]] C6, C8); regeneration from the census = Q-law-8 |
| `law` | `law:sb:<n>-<rok>` | ✅ **pass 11 (101)** | `ref`, `esbirka_title`, `esbirka_exists` | `psp-legislation.ts` (e-Sbírka) |

## Edge relations

| rel | shape | populated | weight | how derived |
|---|---|---|---|---|
| `co_votes_with` | person ↔ person (undirected, `src<dst`) | ✅ pass 1 (20 496) | agreement rate over shared positional votes | deterministic; `minShared=50` |
| `rebels_against` | person → party | ✅ pass 1 (203) | rebellion rate vs club majority line | deterministic; `minEligible=50`, voided excluded |
| `influential_in` | person → organ | ✅ pass 1 (605) | committee role rank (chair 1 / vice 0.6 / member 0.3) | deterministic (degree + role) |
| `belongs_to` | party → bloc | ✅ pass 2 (8) | mean intra-bloc agreement | verdict |
| `about` | vote → theme | ✅ pass 3 (47) | roll-call count on the subject | verdict |
| `owns` | organ (committee) → theme | ✅ pass 8 (30) | — | verdict (committee remit → theme) |
| `linked_to` | person → company | ✅ **pass 10 (260, all `pending_review`)** | — | join (`lib/analysis/kg-money.ts`) + **human gate** (`review_state`: verified / pending_review). Since pass 16, **ALL 260** carry corroboration props: `corroboration` (registry-confirmed 179 / conflicting 23 / registry-unconfirmed 58 — identity-match semantics, see case-money/batch-002), `role_valid_from/to`, `temporal_status` (current / historical / money-postdates-role / historical-undated-money), `tie_class`. **PURGED pass 22: the 49 "OSVČ" false edges + their fake company node are DELETED** ([[contradictions]] C10) — population is now **211 real ties**, all `pending_review`; ingest merge-preserves human-gated fields (D1 closed) and blacklists generic name tokens |
| `supplies` | company → contract | ✅ **pass 10 (2 290)** | contract amount | join (`kg-money.ts`) over Registr smluv IČO |
| `owns_stake` | company → company (src = registered shareholder, dst = owned firm) | ✅ **pass 28 (33; 19 new parent nodes)** | — | `scripts/case-loops/money/dataor-ownership-chains.ts` → `apply-batch.ts` (verdict). Dated **sole-shareholder** registrations from the dataor.justice.cz bulk ISVR export; props `role` (33/33 „jediný akcionář"), `share` (33/33 = 100 — **NOT a published percentage**: `dataor-ownership-chains.ts:177` derives it from `/jedin[ýá]/i` over the free-text `role`, and the real `stakePct` field in `lib/ingest/sources/dataor.ts` is dead, both construction sites writing `null`. Since `abb709f` it renders as a sole-owner STATEMENT with the role wording beside it, never as a measured stake; a value that regex could not have produced is treated as published and still typeset as a number), `from`, `to` (`null` = open, 19/33), `source` (the export URL), `note`, plus `periods[]` + `multi_period_merged` when the register holds several periods of one relationship (11/33). A row whose `share` is not a number is a **board/officer seat, not a stake** and is EXCLUDED at apply time (8 such rows); a missing/non-ISO `from` is refused outright. Pass 36 re-pointed 14 edges onto canonical 8-digit IČO node ids. Two ancestor nodes (`25130072`, `60197773`) are NENALEZENO in both ARES endpoints and carry the pass-39 extinction annotation (`ico_unresolvable_in_ares`, `ico_check_result`, `extinction_reason`, `merged_into`, `merged_on`, Czech `analyst_note_cs`) — they may never be presented as registry-verified subjects. Rendered one hop, both directions, by `features/money/ownership.ts` on `/penize/firma/[ico]` (29 of 195 tied companies have such a record) |
| `sponsors` | person → bill | ✅ **pass 11 (528)** | — | `psp-legislation.ts` (tisk předkladatelé). **Pass 34: props `rank`/`role`/`joined_later`** from `predkladatel.poradi`/`typ` — rank 1 = předkladatel (responsible first signatory), else spolupodepsal (closes Q-effort-2; `kg-bill-roles-ingest.ts`) |
| `rapporteur` | person → bill | ✅ **pass 34 (148)** | — | `kg-bill-roles-ingest.ts` — zpravodaj assignments from tisky.zip `hist` (plenary: `orgv_id_posl`/`ps_id_posl`) + `hist_vybory`/`tisky_za` (committee); props `scopes[]` (zpravodaj_ov / zpravodaj_ps / zpravodaj_vyboru / zpravodaj_dokumentu), `organ_ids[]`; poslanec→osoba via mandate table |
| `spoke_on` | person → bill | ✅ **pass 35 (891)** | substantive floor-speech turns on the bill's agenda items | `kg-bill-engagement-ingest.ts` — steno.zip `rec` ⋈ schuze.zip `bod_schuze.id_tisk` (internal tisk id, verified), chair turns excluded (same filter as `speech_turns`); 20 debated non-law prints honestly skipped |
| `proposes_amendment` | person → bill | ✅ **pass 35 (172, 444 amendments)** | amendment count | `kg-bill-engagement-ingest.ts` — sd.zip `sd_dokument` typ 13 joined by PUBLIC `ct` → `props.cislo`; author via `id_x` (k=1309 documents it only for typ 12, but MEASURED: 571/571 PSP10 typ-13 rows resolve to sitting MPs — deterministic, no name-matching); props `sd_cislos[]`; 127 amendments on non-graph prints skipped |
| `amends` | bill → law | ✅ **pass 11 (150)** | — | `psp-legislation.ts` (title citation → law node). ⚠ A validated 282-edge regeneration from the body-text census is **HELD** (batch-005 apply, with the missing-law-node ingest — 188 statutes/50.6% of citations have no node; see graph-log batch-004 note) |
| `assigned_to` | bill → organ (committee) | ✅ **pass 12 (150)** | — | `psp-legislation.ts` `parseCommitteeAssignments` (tisky `hist_vybory` ⋈ `hist`); props `role` (garanční/další), `status` (přikázáno/navrženo/iniciativně/**unknown**), `assignedOn`. **`unknown` since `6a30205`**: an undocumented `hist_vybory.typ` (the dump carries a `typ = 4` no constant covers) maps to an explicit unknown instead of silently degrading to the weakest REAL status; `assignedOn` may now be absent where the strongest status carries no dated step, because a weaker step's date is no longer borrowed. Formal per-bill routing; **F15** upgrade of the heuristic `owns` remit |

## Bases & caveats (shared with the deterministic layer)

- **Positional basis** = `{yes, no}` (`POSITIONAL_CHOICES`). abstain / not-voting /
  merged K bucket / absence are non-participation — never agreement or rebellion.
- **Voided (zmatečné) votes** (16 in PSP10) are excluded from every discipline metric.
- **Blocs are *named* by the LLM but *defined* by the computation** — the co-voting
  matrix is ground truth; the gate rejects a bloc member who isn't a real person id.
