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
