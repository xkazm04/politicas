# Frontier — the self-expanding work queue

The driver of the [[knowledge-graph-loop]]. Each pass **picks the highest-value
open item**, runs it, and — crucially — *emits new items* (the self-expansion:
finding a bloc spawns "what themes bind it?"). A healthy loop leaves the frontier
**larger than it found it** in early passes, then converges as coverage completes.

Item kinds (design §4.2): `analyze-cluster` · `test-hypothesis` · `expand-node` ·
`recompute-edge` · `blocked-on-data`. Priority 1–5 (5 = do next). Status
`open` / `in-progress` / `done` / `blocked`. `spawned-by` records the finding that
created the item (empty for the seed set). Provenance for *why* an item is worth
doing lives in its row + the note it links.

See [[graph-schema]] for node/edge types, [[graph-log]] for what each pass added,
and the graph-metrics block in [[coverage-ledger]] for progress.

## Open items

| id | kind | target | priority | why | blocked-on | spawned-by | status |
|---|---|---|---|---|---|---|---|
| F1 | analyze-cluster | voting blocs over the `co_votes_with` matrix | 5 | ✅ pass 2: two blocs found (`bloc:ano2011-spd-ms` 114 seats · `bloc:ods-stan-pirati-kdu-top09` 93), 8 `belongs_to` edges. See [[cluster-blocs]], [[graph-log]]. | — | seed §8.3 | **done** |
| F2 | expand-node | themes over vote titles (`Vote —about→ Theme`) | 4 | ✅ pass 3: 13 `theme` nodes + 47 `about` edges over the 47 head subjects (>90% of titled votes). See [[cluster-themes]], [[graph-log]]. | — | seed §8.4 | **done** |
| F3 | test-hypothesis | does rebellion concentrate on *contested* (close) votes vs unanimous? | 3 | ✅ pass 12: per-vote contestedness computed; `contested_vote_rebellion` on 203 persons. Pikora (raw #1, honours) drops out of top 12; Babka/Haas lead. CivicScore Independence = f(contested_vote_rebellion). → [[cluster-contested]]. | — | seed §9 (CivicScore) | **done** |
| F4 | expand-node | committee influence → where does rebellion/theme concentrate? | 3 | ✅ pass 13: weak link — Pearson(member rebellion, owned-theme contestedness) = 0.26. Committees are cross-party; floor rebellion is ~independent of committee. → [[patterns]] P27. | — | seed §8.5 | **done** |
| F5 | recompute-edge | refresh `co_votes_with` / `rebels_against` / cohesion on hlasovani re-ingest | 1 | deterministic edges go stale when `psp-hlasovani` re-ingests after the last `kg-compute` pass; re-run `npm run da:kg-compute --commit --reset`. | staleness-driven | seed §4.2 | open |
| F7 | analyze-cluster | recompute club×club agreement on **contested (close) votes only** | 4 | ✅ pass 12: **knockout** — on contested votes bloc opposition jumps 0.62 → **0.998** with intra-bloc cohesion *rising*. The blocs are a genuine party system, not a lopsided-vote artifact. → [[cluster-contested]]. | — | F1 | **done** |
| F8 | expand-node | is ODS a sub-bloc / swing member of the five-club bloc? | 3 | ✅ pass 5 answered — **yes, fiscally**: ODS-the-club diverges from bloc B on the budget (dominates budget bloc-defection with near-zero club-rebellion). → [[cluster-theme-rebellion]] P13. Detail follow-up = F19. | — | F1 | **done (answered)** |
| F9 | test-hypothesis | is there a tight ANO2011↔MS core (2+1 with SPD looser)? | 3 | ✅ pass 13: **refuted** — bloc A is a flat trio (ANO–SPD 0.985, ANO–MS 0.983, MS–SPD 0.974); ANO–SPD is tightest. The P4 pairs are individual bonds, not a club sub-alliance. → [[patterns]] P27. | — | F1 | **done** |
| F10 | recompute-edge | track the bloc split over the PSP10 term | 2 | the cross-bloc gap is a `minShared=50` snapshot; monitor whether bloc discipline is stable or eroding as roll calls accumulate. | staleness-driven | F1 | open |
| F11 | analyze-cluster | **bloc × theme voting** — how each bloc votes per theme | 5 | ✅ pass 4 (deterministic): 8/13 themes contested, none a true consensus zone; budget sharpest (0.913), even procedure partisan (0.763). Enriched 13 theme nodes with contestedness props. See [[cluster-bloc-theme]]. | — | F2 | **done** |
| F12 | expand-node | committee → theme ownership (`Organ —owns→ Theme`) | 4 | ✅ pass 8: new `owns` rel; 27 committee→theme edges (gated verdict over committee remits). 11/13 themes owned; oversight densest. → [[cluster-committees-and-money]]. Formal per-bill version = F15. | — | F2 | **done** |
| F13 | expand-node | theme the ~132 long-tail subjects + 53 untitled votes | 3 | ✅ pass 10: 124 long-tail subjects themed into existing taxonomy (+124 `about`; 179 total). Tail is 58% housekeeping. 53 untitled votes remain un-themeable (no title). → [[graph-log]]. | — | F2 | **done** |
| F14 | test-hypothesis | do procedure votes show near-unanimity vs contested fiscal/housing votes? | 3 | ✅ pass 4 answered — **REFUTED**: procedure is one of the *most* contested themes (opposed 0.763), not near-unanimous. Volume ≠ consensus. → [[contradictions]] C1. | — | F2 | **done (refuted)** |
| F16 | analyze-cluster | who *defects* on the budget? — rebels on the most contested themes | 4 | ✅ pass 5 (deterministic, 3-layer): computed `contested_rebellion_score` on 207 persons; ODS is its bloc's fiscal outlier; contestedness reweighting reorders independence (Babka/Haas > Pikora). See [[cluster-theme-rebellion]]. | — | F11 | **done** |
| F19 | expand-node | characterise ODS's fiscal divergence — which budget votes, coherent alt-stance? | 2 | ✅ pass 7: coherent — 16/271 fiscal votes, all NO crossing to bloc A, on EET (8) + budget (7). A consistent restrictive stance. → [[cluster-convergence]]. | — | F16 | **done** |
| F20 | test-hypothesis | are the top contested-rebels also pass-2's cross-club bridge MPs? | 2 | ✅ pass 7: **distinct roles** — Pearson(score, cross-bloc agree) = 0.081; true bridges barely exist (max 0.52). Only Haas is both. → [[cluster-convergence]]. | — | F16 | **done** |
| F17 | test-hypothesis | does agenda control shift over the term? | 3 | ✅ pass 6 (deterministic): control never shifts — bloc A (majority) wins ~0.98 throughout; the *mode* flips consensus→majoritarian at the Jan-2026 confidence vote. **Corrected pass-4** ([[contradictions]] C2). See [[cluster-agenda-control]]. | — | F11 | **done** |
| F21 | expand-node | what unites the blocs in the consensus windows (Nov 2025, the June-2026 blip)? | 2 | ✅ pass 7: housekeeping, not policy — Nov 2025 = 42 procedure-setup votes; June 2026 = 138 state-honours. Confirms consensus is only symbolic/technical. → [[cluster-convergence]]. | — | F17 | **done** |
| F18 | recompute-edge | re-score bloc×theme after theme coverage extends (F13) | 2 | ✅ pass 11: re-scored all 14 themes over full coverage. Headline holds; oversight → mixed (C3); foreign-affairs = consensus. Now 7/14 contested. → [[contradictions]] C3. | — | F11 | **done** |

## Blocked (data not yet ingested)

| id | kind | target | why | blocked-on | status |
|---|---|---|---|---|---|
| F6 | blocked-on-data | money graph: `MP —linked_to→ Company —supplies→ Contract` | **join + human gate BUILT** (`lib/analysis/kg-money.ts`, 6 tests); emits nothing until data lands. → [[cluster-committees-and-money]]. | 3 feeds: **Registr smluv** (contracts), **ARES** (IČO→company), and the sensitive **MP↔company linkage** (asset/OI declarations — the hard part). Fabrication forbidden. | blocked (data) |
| F15 | blocked-on-data | formal per-bill committee assignment (`přikázání`) | upgrades F12's remit-based `owns` to formal per-tisk routing. | the psp.cz **`tisky`** (sněmovní tisky) dataset — same UNL format as poslanci/hlasovani, not yet ingested. | blocked (data) |
| F22 | blocked-on-data | confirm `government-confidence` + `state-honours` are plenary-only (no committee gestor) | F12 left them unowned; verify against the rules of procedure rather than assume. | chamber rules-of-procedure text. | blocked |
| F23 | expand-node | extend the theme taxonomy: defence / foreign / education / security | ✅ pass 9: added `theme:foreign-affairs-treaties` (13 votes) — resolves ZAV/VO/VB. **Education (VVVMS) declined**: 0 floor legislation = structural gap, no empty theme. → [[cluster-foreign-and-taxonomy]]. | — | **done** |

> **Honesty rule (design §11):** F6 stays `blocked` — do not fabricate money edges.
> The gap is tracked here, not hidden.

## Case-loop frontiers (generation 3 — see docs/case-loops.md)

### Money (batch 001)
| id | target | why | status |
|---|---|---|---|
| Q-money-1 | reconcile all 260 tie periods vs ARES VR `role_valid_to` | 11/15 of the head were stale; deterministic once VR fetch is in triage | open |
| Q-money-2 | contract-splitting via pgvector subject-similarity (R6) | deferred from batch 001 | open |
| Q-money-3 | confirm 3 company→party donation leads (STYLE PD/OCCAM/Delices) vs sponzoring registry | needs Hlídač API token (user gate) | blocked (token) |
| Q-money-4 | revolving-door pattern (Žbánek's mayor-era contract) | public-office-era ties the MP-mandate graph doesn't track | open |

### Effort (batch 001)
| id | target | why | status |
|---|---|---|---|
| Q-effort-1 | deterministic `never_cast_ballot` pre-filter before the absentee crossover | 4 phantom mandates sat at the score floor; all 4 leads false positives | open |
| Q-effort-2 | split `bills_authored` provenance: first-signatory vs co-signer | top scorers are never předkladatel | open |
| Q-effort-3 | committee_count inflation (friendship groups pad the count) | should only COMMITTEE_ORGAN_TYPES count? | open |
| Q-effort-4 | PSP9 steno substance beyond turn counts | needs tsvector index (R9–R11) | open |

### Law (batch 001)
| id | target | why | status |
|---|---|---|---|
| Q-law-1 | conflict-by-sector-adjacency (tie NACE vs law domain) vs raw CZK | raw flag saturated by municipal/SOE roles (P32) | open |
| Q-law-2 | bill→roll-call linkage (`voted_in`) | needs hlasovani-agenda ingest; hist.unl col5 is a document id, NOT a vote id (dead-end documented) | blocked (ingest) |
| Q-law-3 | how many bills amend statutes NOT named in the title? | amends undercount (C6, tisk 4 proof) | open |
| Q-law-4 | sibling-print §-collision pre-check | tisk 120↔244 (P33) | open |

### Money (batch 002 additions)
| id | target | why | status |
|---|---|---|---|
| Q-money-5 | Juchelka subsidy-influence lead (ČT24 coverage, 2026) — fresh, unrelated to the stale tie it surfaced from | incidental army find | open |
| Q-money-6 | Okamura 2016 U Machtů stake sale vs that year's asset declaration (Týden, HlídacíPes) | verifiable non-disclosure story | open |
| Q-money-7 | re-resolve the correct IČO for "PRaK, a.s." (Bendl+Brabec point at a structurally incompatible s.r.o.) | C7 | open |
| Q-money-8 | 58 special-law bodies (VZP/ČT/universities) unreachable via OR — would need founding-statute corroboration | all steward-class; low urgency | open |
| Q-money-1 | ~~full-population ARES-VR reconciliation~~ | ✅ batch 002: 260/260 (179/23/58) | **done** |

### Effort (batch 002 additions)
| id | target | why | status |
|---|---|---|---|
| Q-effort-5 | tenure normalization for replacement MPs (`mandate_start_date`-aware) | P38 — 4 mid-term seatings read as low effort | open |
| Q-effort-6 | re-tune `componentDivergence` (near-degenerate: most MPs cluster 0.4–0.48) | kernel discriminative-power guardrail | open |
| Q-effort-7 | should leadership_count include club/party-office roles? (Faltýnek b1, Žáček b2) | 2 independent instances | open |
| Q-effort-8 | ~~CEVYKO IČO discrepancy (Niemiec)~~ | ✅ resolved at orchestration: ARES confirms 08599254 = CEVYKO a.s.; cited URL was the bad lead | **done** |

### Law (batch 002 additions)
| id | target | why | status |
|---|---|---|---|
| Q-law-5 | close-read the 70 unconfirmed collision-candidate pairs (111↔207's 91-shared-§ overlap = top) | collision-report.json exists | open |
| Q-law-6 | is the amends undercount origin-correlated (government omnibus vs MP bills)? Deterministic full-sample check over all 141 | C8, 3 bills checked so far | open |
| Q-law-7 | extend the SPARQL §-diff to more statutes (§35c child credit next) / a full-corpus tsvector ingest | point-query proven cheap | open |
| Q-law-4 | ~~sibling-print §-collision pre-check~~ | ✅ batch 002: systematic, 72 pairs, 2 confirmed/corroborated | **done** |

### Money (batch 003 additions)
| id | target | why | status |
|---|---|---|---|
| Q-money-10 | **D1: ingest durability** — kg-money ingest merge-preserves human fields (or audit-replay) | HIGH; write path committed but NOT enabled until closed | open (batch-004 TOP) |
| Q-money-11 | **OSVČ purge** — generic-token blacklist + purge the 49 annotated false edges | C10; 19% of the tie population; hard blocker on crossover surfaces | open (batch-004 TOP) |
| Q-money-12 | write-path polish: D3 honest counter, D4 revalidate, D5 decision whitelist, D7 terminal rejected state | Opus defect list, handoff §2 | open |
| Q-money-7 | PRaK: resolve Bendl end-date conflict vs or.justice.cz úplný výpis; re-point requires steward reclass | C9, medium confidence | open |
| Q-money-2 | pgvector contract-splitting | deferred 3 batches — commit in 004/005 or retire (kernel heuristic) | open |

### Effort (batch 003 additions)
| id | target | why | status |
|---|---|---|---|
| Q-effort-9 | rewrite the 8 held-back money dossiers under the VR doctrine | C11; stripped at persist | open |
| Q-effort-10 | employment-based COI signal (Kott/Agrofert/Control Committee confirmed) — udalosti without IČO match? | invisible to linkedCompanies filter | open |
| Q-effort-11 | prose-vs-props deterministic cross-check before gating | would have caught Výborný + Bartošek in code | open |
| Q-effort-12 | divergence V2 residuals: MIN_COHORT ~8, pool replacements cross-club, filter artifacts from the lens | batch-003 reflection | open |
| Q-effort-5 | ~~tenure normalization~~ | ✅ pass 19: effort_tenure_* on all 207 | **done (annotation)** |

### Law (batch 003 additions)
| id | target | why | status |
|---|---|---|---|
| Q-law-8 | amends edge regeneration from amended_laws_full (census props live on 53 bills) | orchestrator held edge rewrite; 420 unrecorded citations | open (batch-004 decision) |
| Q-law-9 | close-read the remaining 58 collision pairs | 25% confirmed hit rate on the first 12 — backlog undervalued | open |
| Q-law-10 | partition collision-check by statute for omnibus PDFs (tisk 248 contamination) | batch-003 lesson (d) | open |
| Q-law-6 | ~~amends undercount census~~ | ✅ pass 20: 140/141, gov 2.3× MP, tisk 64 = 148 vs 1 | **done** |
| Q-law-5 | ~~collision close-read (first 12)~~ | ✅ 3 confirmed / 2 risk / 7 incidental | **done (head)** |
