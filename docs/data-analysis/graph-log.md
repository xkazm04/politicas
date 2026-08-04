# Graph log — append-only, per pass

The audit trail of how the graph grew: one entry per pass, what nodes/edges it
added, by which method, citing provenance. This is what lets a human (or a
[[contradictions]] check) reconstruct the graph's history. **Append only — never
rewrite a past entry.** The structured counts live in `kg_node`/`kg_edge`; this is
the narrative index. See [[graph-schema]] for types and [[frontier]] for what's next.

---

## Pass 1 — 2026-07-23 — deterministic seed (method: `deterministic`)

The Phase-1 deterministic layer, built and committed via `npm run da:kg-compute --commit`
(`lib/analysis/kg.ts`, unit-tested). No LLM — every number computed from raw ballots
and memberships. This is the ground truth every later interpretive pass reads.

**Nodes added: 248**
- `person` ×207 — all PSP10 mandate-holders; props `rebellion_rate`, `committee_count`.
- `party` ×8 — parliamentary clubs; props `cohesion`, `seats`.
- `organ` ×33 — výbory (18) + komise (15); prop `member_count`.

**Edges added: 21 304**
- `co_votes_with` ×20 496 — agreement matrix over 2 014 non-voided votes, 285 020
  positional ballots; `minShared=50`. Agreement: min 0.136 · median 0.871 · max 1.00.
- `rebels_against` ×203 — MP → club, rate vs club majority; `minEligible=50`
  (4 MPs below the floor). Top rebels: Pikora (MS) 0.082, Forman (MS) 0.053.
- `influential_in` ×605 — MP → committee, role-weighted.

**Cohesion (Rice index):** TOP09 0.996 · Piráti 0.996 · STAN 0.993 · SPD 0.987 ·
KDU-ČSL 0.985 · ANO2011 0.983 · ODS 0.977 · MS 0.968. Seats sum to 207.

**Hand-checks that held:** positional count = yes+no exactly; seats reconcile to 207;
strongest co-voting pair is same-club (two ODS MPs); MS is simultaneously the
least-cohesive club *and* home to the top two rebels — two independent computations
agreeing. **Data note for the backlog:** the chamber carries a stray `Test` organ
(correctly excluded from committees by the `/výbor|komis/i` predicate).

**Frontier after this pass:** seeded F1–F6 (see [[frontier]]).

---

## Pass 2 — 2026-07-23 — voting blocs (F1) (method: `verdict`)

First interpretive pass. A cost-efficient **Sonnet** subagent read the deterministic
bloc-discovery aggregate (club×club co-voting matrix + per-club summary + strongest
cross-club pairs — *not* raw ballots) and named the blocs. The verdict
(`.kg-analysis/verdicts/F1.json`) passed the gate (`da:validate-kg-verdict`, 11 072
known ids) and was promoted via `da:kg-promote --pass=2 --commit`. Every number is
the deterministic layer's; the subagent only interpreted structure.

**Nodes added: 2** (`bloc`)
- `bloc:ano2011-spd-ms` — ANO2011+SPD+MS, 114 seats, intra-bloc agreement 0.974–0.985.
- `bloc:ods-stan-pirati-kdu-top09` — ODS+STAN+Piráti+KDU-ČSL+TOP09, 93 seats, 0.913–0.985.

**Edges added: 8** (`belongs_to`, club → bloc)
- All 8 clubs assigned; weight = each club's mean intra-bloc agreement (ANO2011 0.984 …
  ODS lowest 0.933). Endpoints: 8 real `party` node ids → the 2 new `bloc` nodes.

**Patterns:** P1–P4 → [[patterns]]. **Opportunities:** O3 (Bloc Cohesion Tracker),
O4 (Cross-Bloc Bridge MPs) → [[feature-opportunities]]. **Detail:** [[cluster-blocs]].

**Self-expansion — frontier GREW +4:** F7 (contested-vote bloc test), F8 (ODS swing/
sub-bloc), F9 (ANO↔MS 2+1 core), F10 (bloc split over time). F1 → `done`.

---

## Pass 3 — 2026-07-23 — themes (F2) (method: `verdict`)

A **Sonnet** subagent read the deterministic subject aggregate (the 2 014 non-voided
votes collapse to 179 distinct subjects; the 47 head subjects, count ≥4, cover >90% of
titled votes — *not* raw titles dumped) and built a theme taxonomy. Verdict
(`.kg-analysis/verdicts/F2.json`) passed the gate (11 074 known ids — all 47 vote urns
copied correctly) and was promoted via `da:kg-promote --pass=3 --commit`. Counts are the
deterministic layer's; the subagent grouped subjects into policy domains.

**Nodes added: 13** (`theme`) — parliamentary-procedure, fiscal-budget, housing-construction,
state-honours-symbolic, social-health, civil-service-public-admin, public-appointments,
financial-market-regulation, animal-welfare-environment, government-confidence,
oversight-interpellations, eu-transposition-digital-transport, justice-criminal-law.

**Edges added: 47** (`about`, vote → theme) — one per head subject; weight = the subject's
roll-call count. Endpoints: 47 real `vote_event` urns → the 13 new `theme` nodes.

**Patterns:** P5–P8 → [[patterns]]. **Opportunities:** O5 (VoteTrack theme lens),
O6 (BudgetMirror fiscal timeline), O7 (LawWatch EU tracker) → [[feature-opportunities]].
**Detail:** [[cluster-themes]].

**Self-expansion — frontier GREW +5:** F11 (bloc×theme — *combines pass 2 + pass 3*),
F12 (committee → theme ownership), F13 (theme the long-tail 132 subjects), F14
(procedure vs policy dissent), F15 (blocked: committee-jurisdiction data). F2 → `done`.

---

## Pass 4 — 2026-07-23 — bloc × theme (F11) (method: `deterministic`)

**The first compounding pass** — it consumes pass-2 `belongs_to` + pass-3 `about` edges
+ the raw ballots to compute, per theme, how opposed the two blocs are. Fully
deterministic (`scratchpad/kg-bloc-theme.ts`), so there is no verdict/gate — the numbers
are trusted by construction, like the pass-1 seed. Reuse-rate ~1.0: the computation
*literally reads both prior interpretive passes' output*.

**Nodes added: 0 · Edges added: 0.** The graph accreted by **enrichment**, not topology:
**13 `theme` nodes gained contestedness props** — `contested`, `classification`,
`opposed_fraction`, `votes_scored`, `bloc_support` {A,B} — each carrying a nested
`contestedness_provenance {pass:4, method:deterministic}` while the node's identity
provenance stays `verdict` (pass 3).

**Finding:** the chamber is polarized on nearly everything — 8 of 13 themes contested,
none a true consensus zone; budget the sharpest (0.913); even procedure partisan (0.763).
→ [[cluster-bloc-theme]], [[patterns]] P9–P11.

**Self-correction:** refuted pass-3's "procedure = churn" read → [[contradictions]] C1;
opportunity O5 revised, F14 answered (refuted). New opportunity O8 (CivicScore: weight
independence by theme contestedness).

**Self-expansion — frontier +3 (F14 closed):** F16 (who defects on the budget? — fuses
`rebels_against` + `about` + contestedness), F17 (does agenda control shift over the
term?), F18 (re-score after F13 extends theme coverage). F11 → `done`, F14 → `done` (refuted).

---

## Pass 5 — 2026-07-23 — theme-grain rebellion (F16) (method: `deterministic`)

**A three-layer compounding pass** — consumes `rebels_against` (pass 1) + `about` (pass 3)
+ contestedness props (pass 4) + raw ballots. Deterministic
(`scratchpad/kg-theme-rebellion.ts`), no gate; reuse-rate ~1.0.

**Nodes added: 0 · Edges added: 0.** Accretion by **enrichment**: **207 `person` nodes
gained** `contested_rebellion_score`, `budget_club_rebellions`, `budget_bloc_defections`,
`top_rebellion_theme` (+count), with nested `theme_rebellion_provenance {pass:5,
deterministic}`; identity provenance unchanged.

**Findings** (→ [[cluster-theme-rebellion]], [[patterns]] P12–P14):
- Rebellion concentrates where it is *cheap* — top raw rebel Pikora rebels 87× on symbolic
  honours; contestedness-weighting reorders "most independent" (Babka, Haas rise). Validates O8.
- **ODS is its coalition bloc's fiscal outlier** — budget bloc-defectors are overwhelmingly
  ODS with near-zero club-rebellion → ODS-the-club diverges from bloc B on the budget.

**Cross-pass closures (the flywheel):** **F8** (pass-2 "is ODS a sub-bloc?") **answered** —
yes, fiscally. **O8** (pass-4 proposal) **computed** and shown to work. Pass-1's top rebels
(Pikora, Bureš) reappear here — internal consistency across four passes.

**Self-expansion — frontier +2 (F8, F16 closed):** F19 (characterise ODS's fiscal
divergence — which budget votes?), F20 (are the top contested-rebels also pass-2's cross-club
bridge MPs?). F16 → `done`, F8 → `done` (answered).

---

## Pass 6 — 2026-07-23 — agenda control over time (F17) (method: `deterministic`)

Crosses vote *dates* with the bloc split — the first *temporal* pass. Deterministic
(`scratchpad/kg-agenda-control.ts`), no gate; reuse-rate ~1.0 (consumes `belongs_to` +
vote outcomes/dates).

**Nodes added: 0 · Edges added: 0.** Accretion by **enrichment**: the **2 `bloc` nodes
gained** `overall_win_rate` + a monthly `control_timeline`, nested `control_provenance
{pass:6, deterministic}`; identity provenance (`verdict`) unchanged.

**Finding** (→ [[cluster-agenda-control]], [[patterns]] P15–P16): control never shifted
between blocs — bloc A (114-seat majority) wins ~0.98 throughout. The *mode* flipped from
**consensus** (Nov 2025, both blocs win) to **majoritarian** at the **Jan 2026 confidence
vote** (bloc B's win-rate collapses to ~0.38, agenda ~0.1–0.3).

**Self-correction (second one):** **corrects pass-4's** "bloc B controls" directional read
→ [[contradictions]] **C2**. *Support ≠ control* — bloc B backs the outgoing government's
budget and loses; bloc A (majority) governs by win-rate. The pass-4 note is annotated.

**Self-expansion — frontier +1 (F17 closed):** F21 (what unites the blocs in the consensus
windows — Nov 2025 and the June-2026 blip?). F17 → `done`.

---

## Phase 4 — 2026-07-23 — the controlled test (meta; no graph change)

Not a graph pass — the scientific test of the whole loop (§7). Built the metrics tool
`scripts/data-analysis/kg-metrics.ts` (`da:kg-metrics`) + `.kg-analysis/pass-costs.json`,
and ran a **warm vs cold-control** A/B on one synthesis target with a **blind judge**.
**Verdict:** the flywheel holds — WARM (accumulated graph+vault) beat COLD (deterministic
substrate only) on depth 4.6 vs 2.0 and prior-analysis-dependence 4.6 vs 1.2 at equal
grounding, and at *lower* token cost (36k vs 41k). The blind judge independently identified
that WARM's findings require prior derived layers while COLD's are re-derivable from raw stats.
Nuance: the payoff is accumulated *depth*, not first interpretation (COLD re-derived the blocs).
Full writeup: [[phase4-controlled-test]]. No `kg_*` change.

---

## Pass 7 — 2026-07-23 — convergence (F19/F20/F21) (method: `deterministic`)

Closed three priority-2 detail items in one deterministic sweep — all *confirm/sharpen* prior
passes (`scratchpad/kg-convergence.ts`), no gate, reuse-rate ~1.0.

**Nodes added: 0 · Edges added: 0.** Enrichment: the **ODS `party` node gained**
`fiscal_divergence` (16 votes, all NO-crossing-to-bloc-A, EET+budget); **203 `person` nodes
gained** `cross_bloc_agreement`; nested pass-7 provenance, identities unchanged.

**Findings** (→ [[cluster-convergence]], [[patterns]] P17–P19):
- **F19** — ODS's fiscal break is coherent (5.9% of fiscal votes, all NO with ANO, on EET+budget).
- **F20** — independence ≠ bridging (Pearson 0.081); true bridges barely exist (max cross-bloc 0.52).
- **F21** — consensus windows are procedure-setup (Nov 2025) + honours season (June 2026), never policy.

**Convergence signature:** frontier SHRANK **12 → 9** open — this pass spawned **nothing**
(leaf closures). The loop has stopped expanding. F19/F20/F21 → `done`.

---

## Phase 5 — 2026-07-23 — the DataHub projection (tier 3; optional/disposable)

Not a graph pass — the optional mirror (§10.5). Built `scripts/data-analysis/kg-datahub-sync.ts`
(`da:kg-datahub-sync`): a **pure projection** of `kg_node`/`kg_edge` into DataHub as datasets +
lineage (50 aspects: 2 store + 5 node-kind + 5 edge-rel). Reads `kg_*` only, never writes;
DataHub-free-verifiable (writes aspects to file; `--push` POSTs to a GMS). Lineage traces every
edge rel back to the raw psp.cz corpus tables — a bloc recomputable to the ballots. Disposable:
rebuildable from `kg_*` any time; the loop runs fully with it off. → [[phase5-datahub-projection]].
No `kg_*` change. **Case 2 phases 1–5 complete.**

---

## Pass 8 — 2026-07-23 — committee jurisdiction + money wiring (F12/F6/F15)

**F12 (DONE, verdict):** new `owns` relation added to the schema enum; a gated Sonnet verdict
mapped 33 committees → 13 themes. **Edges added: 27 `owns`** (organ → theme); nodes 0.
`kg_edge` 21 359 → **21 386**. Closes the vote→theme→committee chain. → [[cluster-committees-and-money]].

**F6 (WIRED, still data-blocked — persisted NOTHING):** built `lib/analysis/kg-money.ts` — the
IČO join + **human gate** (`linked_to` review_state verified/pending-review) + `moneyTrails`,
6 unit tests. Emits `company`/`contract` nodes + `linked_to`/`supplies` edges from typed feeds,
but **no real feeds exist here** (Registr smluv + ARES + the sensitive MP-linkage source) and
fabrication is forbidden (§11; accusatory edges about real people). F6: *no adapter* → *join+gate
built, blocked on data*.

**F15 (blocked, source pinned):** formal per-bill committee assignment needs the psp.cz `tisky`
(přikázání) dataset — same UNL format, not yet ingested.

**Frontier:** F12 → `done`. F6/F15 stay `blocked` (data). +F22/F23 spawned (confirm the 2
unowned themes; extend theme taxonomy for defence/foreign/education/security).

---

## Pass 9 — 2026-07-23 — theme-taxonomy extension (F23) (method: `verdict`)

Grounded check of F12's 4 themeless committee domains. Scanned all 179 subjects (incl. the
132-subject long tail); **only foreign affairs is a real vote cluster.**

**Nodes added: 1** — `theme:foreign-affairs-treaties` (8 subjects, 13 votes: double-taxation/
border/police/health treaties + Ukraine measures — all long-tail).
**Edges added: 11** — 8 `about` (→ 55 total) + 3 `owns` (ZAV/VO/VB → theme; → 30 total).
`kg_node` 263 → **264**, `kg_edge` 21 386 → **21 397**.

**Honest negative half:** education (VVVMS) has **0** floor legislation this term — no theme
added (an empty node would be ungrounded). The loop declines to fabricate a category the data
doesn't support → [[patterns]] P22. Detail: [[cluster-foreign-and-taxonomy]].

**Frontier:** F23 → `done`. Spawned nothing new beyond re-pointing at F13 (the rest of the long
tail maps to existing themes — coverage, not new taxonomy). VVVMS gap left as a documented fact.

---

## Pass 10 — 2026-07-23 — long-tail theme coverage (F13) (method: `verdict`)

Classified the 124 remaining long-tail subjects into the 14 EXISTING themes (a Sonnet subagent
returned index→theme; edges built deterministically from a verified index→urn map, so urn
integrity is guaranteed — no 124-urn copy). **Edges added: 124 `about`** (→ 179 total).
`kg_edge` 21 397 → **21 521**. Distribution: procedure 42 · appointments 30 · fiscal 17 ·
oversight 8 · civil-service 7 · social-health 5 · animal-welfare 5 · justice 3 · eu 3 ·
financial 2 · confidence 1 · foreign-affairs 1. `about` now covers all 179 titled subjects.
Finding: the tail is 58% housekeeping ([[patterns]] P23). F13 → `done`.

## Pass 11 — 2026-07-23 — bloc×theme re-score over full coverage (F18) (method: `deterministic`)

Re-ran the F11 contestedness computation now that `about` spans all 179 subjects + the new
foreign-affairs theme. **Nodes 0 / edges 0** — re-enriched all **14 theme nodes** (contestedness
provenance → pass 11). Headline holds (fiscal 0.87, procedure 0.72; consensus symbolic/technical);
`foreign-affairs-treaties` = consensus (0.133). **Self-refinement:** `oversight-interpellations`
0.50 → 0.348 (contested → mixed) on fuller data → [[contradictions]] **C3**; now 7 of 14 contested.
F18 → `done`. → [[patterns]] P24.

---

## Pass 12 — 2026-07-23 — per-vote contestedness (F3/F7) (method: `deterministic`)

Introduced a per-vote contestedness (margin) measure; 1 057 of 2 013 votes (52.5%) are close.
**Nodes 0 / edges 0** — enriched **203 `person` nodes** (`contested_vote_rebellion` + count) and
**2 `bloc` nodes** (`opposition_rate_all` 0.62, `opposition_rate_contested` 0.998, `cohesion_contested`).

**F7 — the knockout:** on contested votes the bloc opposition rate jumps **0.62 → 0.998** and
intra-bloc cohesion rises — the blocs are a genuine party system, not a lopsided-vote artifact.
**F3 — pillar finalized:** per-vote-margin weighting drops the raw #1 rebel (Pikora, honours) out
of the top 12; CivicScore Independence = f(`contested_vote_rebellion`). → [[cluster-contested]],
[[patterns]] P25–P26. F3, F7 → `done`.

---

## Pass 13 — 2026-07-23 — F4 + F9 (read-only; modest/negative results)

The last two analytical items — both answered, neither a headline (findings → vault, **no graph
change**). **F4:** committee membership barely predicts owned-theme contestedness (Pearson 0.26) —
committees are cross-party, so a member's floor rebellion is ~independent of their committee.
**F9:** bloc A is a tight *flat* trio (ANO–SPD 0.985, ANO–MS 0.983, MS–SPD 0.974), **not** a 2+1
core — the pass-2 ANO↔MS individual bonds don't scale to a club-level sub-alliance. → [[patterns]] P27.
F4, F9 → `done`.

**⇒ FRONTIER DRY.** Open items are now only F5 + F10 (staleness-driven — nothing to recompute until
the corpus re-ingests) and the data-blocked F6/F15/F22. No open item can add new knowledge from the
current corpus. **The loop has converged** — 13 passes, grew 5→12 then shrank to 2 staleness-only.

---

# Investigative track — the "golden trio" (independent pass sequence)

> A SEPARATE effort from the analytical loop above. On **2026-07-24** the previously
> data-blocked external feeds were ingested, and three investigative cases materialized new
> node/edge kinds into the same `kg_node`/`kg_edge` store. Pass numbers here are their OWN
> sequence (10, 11) — not a continuation of the loop's 1–13. See [[graph-schema]] track note.

## Case ① FollowTheMoney — pass 10 — 2026-07-24 (method: `deterministic`)

Ingested Hlídač státu (proxying Registr smluv + ARES) and built the money sub-graph via the
IČO join (`lib/analysis/kg-money.ts` + `money-feed.ts`). **Nodes: +196 `company`, +2 287
`contract`. Edges: +260 `linked_to` (person→company), +2 290 `supplies` (company→contract).**
~18.7 bn CZK of reachable public money across 73 MPs. **The human gate held: all 260
`linked_to` edges are `pending_review`** (`review_state`) — an automated IČO+name+birthdate
bridge is a *lead*, never a published fact about a real person; none auto-verified. Closes F6.
→ `/penize`.

## Case ② Effort / contribution — pass 11 — 2026-07-24 (method: `deterministic`)

Computed a per-MP contribution index from the psp.cz activity data (`lib/analysis/contribution.ts`):
committee engagement, voting participation, attendance, legislative output, floor presence,
leadership. **Nodes 0 / edges 0 — enriched all 207 `person` nodes** with `contribution_score`
(0–100) + its 6 exposed components + `absentee_manager_lead` (the Case-②×① crossover: real money
ties + low contribution). Counts come from the deterministic layer, never an LLM. → `/zebricek`,
`/poslanec`.

## Case ③ Law forensics — pass 11 — 2026-07-24 (method: `deterministic` + 1 gated `verdict`)

Ingested the psp.cz `tisky` (sněmovní tisky) + e-Sbírka (`lib/ingest/sources/psp-legislation.ts`).
**Nodes: +141 `bill`, +101 `law`. Edges: +150 `amends` (bill→law, via the `č. N/RRRR Sb.` title
citation), +528 `sponsors` (person→bill).** Bill nodes carry `origin`, `amended_laws`,
`flagged_conflict` (a sponsor with Case-① money ties). **One bill (tisk 58) carries a gated
`forensic_*` verdict** (`pending_review`) — the only LLM-authored product here, and it renders as
*derived*, never as fact. No paragraph diffs / pipeline stages exist in the source (honest gap).
Partially addresses F15 (`tisky` now ingested; formal per-bill→výbor routing still open). → `/zakony`.

**⇒ TRIO COMPLETE.** Graph: **263 nodes / 21 359 edges** (loop convergence) → **2 989 / 24 749**.
The four feature surfaces were wired off the `lib/civic` mock onto these real nodes the same day
(server-loader pattern per `/hlasovani`; mock kept only as graceful fallback).

## Case ③ Law forensics — pass 12 — 2026-07-24 — F15 formal committee routing (method: `deterministic`)

Upgraded F12's name-based committee *remit* (`owns`: organ→theme) to the FORMAL per-bill routing.
psp.cz `tisky.zip` carries `hist_vybory.unl` — the "přikázání tisku výborům" table (schema: psp.cz
open-data k=1303) — joined to `hist.unl` for the step date. New parser
`parseCommitteeAssignments` (`lib/ingest/sources/psp-legislation.ts`) collapses the event rows to one
assignment per (tisk, committee); `scripts/data-analysis/kg-committee-routing.ts` (`da:kg-routing`)
gates them to graph nodes and writes. **Edges: +150 `assigned_to` (bill→organ)**, props `{role:
garancni|dalsi, status: prikazano|navrzeno|iniciativne, assignedOn}`. **131 of 141 bills routed**
(133 garanční + 17 další); the 10 unrouted are bills not yet proposed for assignment in a term
opened 2025-10-04 (honest gap, not a miss). Of the 289 hist_vybory pairs over PSP10 prints, 11 174
event rows for other terms + non-graph prints were dropped by the endpoint gate. Status split (86
navrženo / 63 přikázáno / 1 iniciativně) is recorded per edge so a consumer can filter to
House-confirmed assignments. **Formal-vs-heuristic agreement: 11 of 12 committees that receive a
garanční bill also carry an F12 `owns` remit; the lone exception is VVVMS (education/science)** — one
of the exact 4 committees F12 flagged as having no matching theme (F2 taxonomy gap). The formal
routing independently confirms that honest gap rather than contradicting it. Concentration matches
expectation: ÚPV (justice) 31, RV (budget) 26, HV (economy) 19. F15 → `done`. → `/zakony`, LawWatch.

**⇒ Graph: 2 989 nodes / 24 899 edges** (+150 `assigned_to`).


## Pass 13 (track: money) — Case ① batch-001 corroboration (2026-07-24)

The money loop's calibration batch. **15 `linked_to` edges props-merged** (`corroboration_provenance`
nested; identity provenance untouched): ARES-VR corroboration verdict, real `role_valid_from/to`,
`temporal_status`, `tie_class`, reviewer notes. Gate 15/15, 0 fabricated ids. **No `review_state`
changed** — the human gate holds. Headline: 11/15 top ties carried stale-"ongoing" or misattributed
periods vs ARES VR; tie-class (owner-operator 37 · manager 23 · steward 200) added as the
load-bearing triage dimension. 3 registry-confirmed live owner-operator conflicts (Teleky, Petrtýl,
Karpíšek). → `case-money/batch-001.md`.

## Pass 14 (track: effort) — Case ② batch-001 dossiers + PSP9 restoration (2026-07-24)

The effort loop's calibration batch. **20 person nodes props-merged** (`effort_*` namespaced,
gate 20/20; no contribution number touched) + **`contribution_psp9` complete profiles on 109
continuing MPs** after the live PSP9 ingest (`ingest.ts --term=PSP9`: 9,016 roll calls, 1.8M
ballots — the full prior term). Headline: **all 4 `absentee_manager_lead` flags are structural
false positives** (phantom mandates — Zarzycký/Brabec/Kubis/Kučerová relinquished seats for
executive office; Faltýnek trust-held; Karpíšek office-held board seats) → `never_cast_ballot`
pre-filter frontier item. Positive symmetry: Richter (jednací-řád novela in Senate, 0 speeches),
Brzesková. → `case-effort/batch-001.md`.

## Pass 15 (track: law) — Case ③ batch-001 forensic verdicts (2026-07-24)

The law loop's calibration batch. **8 bill nodes enriched with `pending_review` `forensic_*`
props** (kg-forensics --write, gate 8/8 after the knownIds widening): tisky 4, 40, 115, 119,
120, 121, 244, 248. **All severity=low — 0 self-dealing channels among the top-flagged bills**
(non-partisan symmetry at scale; the honest headline). Richest yield was non-conflict leads:
the tisk 120↔244 §35ba drafting collision, quiet riders (wine excise in tisk 4, beer in 40),
and the `amends`-undercount contradiction (tisk 4 amends FOUR statutes, title-regex recorded
one). forensicCount 1→9. Also shipped: /zakony committee-routing render (no graph change).
→ `case-law/batch-001.md`.

## Pass 16 (track: money) — Case ① batch-002 full-population ARES-VR reconciliation (2026-07-24)

Sonnet-only driver+army, Opus reflection only (the tiering experiment). **245 `linked_to` edges
props-merged** — the full remaining population; with pass 13, all **260/260 ties now carry a
corroboration verdict: 179 registry-confirmed · 23 conflicting · 58 registry-unconfirmed**
(special-law public bodies with no OR record — structural). Deterministic birth-date-exact
matching did the bulk (≈0 LLM tokens); 10 ambiguous units Sonnet-judged; the Opus reflection
caught two real defects, fixed in-session. **No `review_state` changed.** Cost ≈400 tokens/unit
(~75× under batch 001). Key fix: ARES VR `ostatniOrgany` is load-bearing (conflicting 91→23).
Also shipped: O-money-2 temporal-status badge on /penize + /penize/kontrola. → `case-money/batch-002.md`.

## Pass 17 (track: effort) — Case ② batch-002 dossiers + never_cast_ballot pre-filter (2026-07-24)

Sonnet-only army (6 grouped agents × 5 MPs), Opus reflection only. **30 person nodes
props-merged** (gate 30/30; 50 MPs annotated total). The batch-001 `never_cast_ballot`
pre-filter now runs deterministically in triage (0 new phantom mandates, 0 wasted army slots).
New structural class: **replacement MP** (mid-term seatings the index can't tenure-normalize);
dual-mandate generalizes beyond ODS/money (4 ANO cases, mostly no money angle). Zero
contradictions across 4 batch-001 cross-references (a positive finding). Opus verdict: Sonnet
held the bar; both quality gaps were money-touching claims → route money-crossover units
through Opus verification. Also shipped: generalized `LowScoreReasonBadge` on /poslanec
(closed 10-value vocabulary). CEVYKO IČO discrepancy resolved at orchestration: ARES confirms
08599254 = CEVYKO a.s.; the cited URL was the bad lead. → `case-effort/batch-002.md`.

## Pass 18 (track: law) — Case ③ batch-002 forensic verdicts + real §-diff (2026-07-24)

Sonnet-only army, Opus audit only. **10 bill nodes enriched** (tisky 11, 71, 86, 111, 124, 173,
196, 198, 207, 216) — all severity=low; **two structurally different conflict signals (raw money
+ sector-adjacency) now agree: 0/19 gated bills show a real conflict channel.** Gate 18/18 wide,
10/10 new pass canonical (better than batch 001's 7/8). forensicCount 9→19. Systematic
§-collision pre-check over all 141 bills: 72 candidate pairs; 120↔244 confirmed, 111↔207
corroborated (softer — coordination risk on shared scaffolding). `amends` undercount confirmed
SYSTEMATIC for government omnibus bills (111: 7 real vs 1; 207: 8 vs 1). **Flagship shipped: the
first REAL e-Sbírka §-diff on /zakony** (§35ba of 586/1992, 2021→2024, 8 hunks) via the e-Sbírka
SPARQL endpoint — point-query, not the shelved 1.24GB bulk. Also fixed: THEME_KEYWORDS
`.includes()` substring bug (likely a driver of batch-001's 89% routing over-fire).
→ `case-law/batch-002.md`.

## Pass 19 (track: effort) — Case ② batch-003 tenure + dossiers (2026-07-24)

Deterministic first: `effort_tenure_*` on ALL 207 person nodes (end-date-aware; 193 full_term /
7 replacement / 3 departed / 4 never_seated — the Opus reflection caught the fromAt-only version
misclassifying vacated seats); `effort_workhorse_flavour` on 15 (departure-guarded);
componentDivergence retuned to (club × tenure_class)-cohort z-scores (validated sd 0.098→0.323
before ranking use). Army of 35 (7×5 Sonnet groups, gate 35/35, 152 citations) — **money
sentences held back from persist** per the Opus money-crossover verification (6/14 verified units
carried false NEGATIVES from the officer-less ARES endpoint; orchestrator stripped effort_notes
for the 8 flagged units, batch 004 rewrites under the VR doctrine). Kott employment-based COI
confirmed (invisible to the linkedCompanies filter — Opus routing stays claim-type-based).
→ `case-effort/batch-003.md`.

## Pass 20 (track: law) — Case ③ batch-003 verdicts + census + collisions (2026-07-24)

**8 bill nodes enriched** (tisky 112, 132, 143, 210, 146, 28, 181, 24; all severity=low; gate
26/26; forensicCount 19→27) + **53 bills carry `amended_laws_full`/`amends_undercount` census
props** (additive; edges NOT regenerated — batch-004 decision). Census: government bills
undercount real amended statutes 2.3× worse than MP bills (mean 4.80 vs 2.10); outlier tisk 64:
148 real vs 1 recorded. Collision close-read (12 pairs): 3 confirmed — the 4↔120↔244 three-way
§35ba cluster + new 210↔248 §134l — 2 coordination-risk, 7 incidental (tisk 248's omnibus PDF
contaminates §-matching). 4 new real e-Sbírka §-diffs → 15 bills render diffs on /zakony.
gate-verdicts.ts gained the citation-scope check (10/26 soft warnings). Armed Opus trigger
correctly not fired. → `case-law/batch-003.md`.

## Pass 21 (track: money) — orchestrator: OSVČ false-edge annotation (2026-07-24)

**49 of 260 `linked_to` edges** (19% of the population — far beyond the army's 10-MP sample)
point at `company:ico:04627695`, the Agrární demokratická strana, whose ARES `obchodniJmeno` is
the literal junk string "OSVČ" — the exact-name pick matched every self-employed MP to a micro
political party. All 49 annotated `false_edge_suspected` (deterministic; contractCzk 0 on all, so
no money totals were inflated). Purge + generic-token blacklist = money batch-004 top item with
D1. Effective real tie population: ~211. Money batch 003 itself made NO graph write (write-path
build + PRaK research only; console committed but NOT enabled pending D1).

## Pass 22 (track: money) — orchestrator: OSVČ purge executed (2026-07-24)

**49 `linked_to` edges + the `company:ico:04627695` node DELETED** (purge-osvc.ts, rehearsed on a
copy, live run guarded by --confirm-live). Population: 260 → **211 ties**, all `pending_review`.
Money batch 004 also closed D1 (ingest merge-preserves human-gated fields — two passes; the Opus
re-audit found kg-promote shared the defect + 6 missing preserve fields incl. a review_note
near-miss) and D3/D4/D5/D7; pgvector RETIRED (no-fourth-deferral rule); PRaK honest dead end.
`deleteKgEdges`/`deleteKgNodes` accepted into the shared repo (Opus-verified additive). Ten
prop-content mentions of the purged IČO remain in older dossier/citation prose — batch-005
cleanup. **The console durability gate is CLOSED — enablement now only needs REVIEWER_NAME/
REVIEWER_TOKEN set by the operator.**

## Pass 23 (track: effort) — Case ② batch-004: rewrites + army + role-window (2026-07-24)

**8 rewritten money dossiers restored** (VR doctrine, doubly verified — the second pass caught
Foldyna's second undisclosed historical tie and un-cleared Výborný's Gymnázium Pardubice role;
Hladík's tie count 1→5), **35 army dossiers**, **6 role_window_mismatch annotations**. The new
prose-vs-props gate fired its first two soft warnings at persist — both the KNOWN
co-signer-vs-first-author conflation (prose carries the corrected number). Divergence V3
re-validated by ranking diff; triage tenure-classifier staleness bug fixed; Kott probe verdict
PARTIAL (two missed primary sources identified for batch 005). role_window_mismatch badge shipped
reusing LowScoreReasonBadge.

## Held: law batch-004 amends regeneration (validated, NOT applied)

`batch-004-amends-regen.json` validates PASS 282/282 (150 → 282 edges, fully additive after the
Opus audit fixed a replace-vs-union bug). **Deliberately not applied** — the law reflection's
sequencing finding: applying reopens the collision candidate universe ~5× un-pre-checked
(88→436 bill-pairs) and invalidates triageScoreV2. Batch-005 P1: missing-law-node ingest (188
statutes / 289 citations = 50.6% of real citations have no law node) + Q-law-11 trigger fix,
THEN apply. Also batch 004: 24 more collision close-reads (4-batch totals 17 confirmed / 9 risk /
12 incidental, scoped to the 150-edge topology), §88 diff (23 hunks), **/zakony/kolize shipped**
(commit a44fe5f — a driver commit, fleet-rule breach, boundary-clean, retained; rule sharpened).

## Pass 24 (track: money) — Case ① batch-005: review order, leads, closures (2026-07-25)

**211 `linked_to` edges gain `review_tier`/`review_rank`** (confirmed owner-operators first: 34 ·
managers 20 · stewards 125 · unconfirmed 32) driving `/penize/kontrola`'s session order; the
`review_audit` CHECK migration applied live. **Two Opus-verified lead annotations** land
`pending_review`: Q-money-5 Juchelka (evidence HOLDS — a structural advisor-conflict story re
SIPTRADE, not personal enrichment; 3 corrections applied) and Q-money-6 Okamura (PARTIAL — the
Opus layer caught a **fabricated ownership-successor detail that had silently propagated since
batch 002**, plus a mislabeled source and a mis-date; 5 corrections; medium confidence). Q-money-13
closed: 26/26 stale OSVČ mentions surgically corrected (currentText guards, 0 failures) across 24
effort/law nodes. Console session-support UX shipped (205/205 tests).

## Pass 25 (track: effort) — Case ② batch-005: 45 dossiers, coverage nears (2026-07-25)

**45 person nodes props-merged** (P51 double-verified: the Opus layer caught 4 blocking errors on
first full use, incl. REVERSING a false company-tie clear on Černochová and a truncated ARES fetch
missing Stržínek's active board seat). Coverage 165/207 (79.7%); mean signal 0.771→0.458 —
convergence evidence recorded, declaration deferred to steering. CRO reality check: cro.justice.cz
needs a ~30-day manual Ministry process (NOT autonomous — corrects batch-004's optimism);
volby.cz/ČSÚ candidate registry IS freely buildable. Tenure-aware profile copy shipped.

## Held again: law batch-005 change-set (NOT READY — the audit said so)

The paired landing grew to **187/187 nodes resolved + 150→567 edges** — but the Opus paired-landing
audit returned **NOT READY TO APPLY** (11 defects: unmeasured precision on new citations with 3
proven-false footnote edges, an Sb. m. s. treaty-citation collision, no sanctioned apply path, a
value-overwrite gap in the deletion-diff gate). The driver remediated 6/11 same-batch and honestly
flagged the result as validator-PASS but NOT re-audited. **Batch-006 P1: independent fresh audit +
full precision measurement before any live apply** — a self-fixed payload does not apply on the
fixer's word. Post-regen collision pre-check (on the copy): 583 raw → 186 partitioned pairs, 15
close-read (5 confirmed / 7 risk / 3 incidental); the P52 replacement ranking honestly reported as
NOT statistically validated (Fisher p=1.00). /zakony/kolize batch-5 preview shipped (labeled pending).

## Pass 26 (track: effort) — Case ② batch-006: POPULATION CLOSED 207/207 (2026-07-25)

**42 person nodes props-merged** — the final wave. **Coverage 207/207: the effort case is the first
to close its population.** Declared on ENUMERATION, honestly, not on the kernel's K=3 yield rule:
the driver found that threshold had never been pinned to a number anywhere, pinned it at 0.50, and
the real sequence (0.771→0.744→0.500→0.500→0.458→0.405) gives K=2 of 3 — so the rule does not fire
and was not back-fitted to pretend otherwise. Corroborated by 64% pure filler and zero hits on the
sharpest lenses. The loop now drops to staleness- + lead-driven mode. Also: `volby.cz` ingest
(205/207 MPs joined, 33 sector↔committee occupation hits, 3 with Control Committee) with an honest
NULL on the namesake Kott case — his declared occupation is self-referential ("poslanec PSP ČR") —
and a recommendation against shipping it as a badge until a non-self-referential source exists.
The 5-batch committee_count mismatch was **re-root-caused** (batch-005's Podvýbor diagnosis was
itself wrong: zero PSP10 memberships reference a Podvýbor) to Delegace filtering + duplicate
member/function rows; fixed against one shared predicate in extractor AND render (0/42 mismatches).

## Pass 27 (track: money) — Case ① batch-006: dataor sweep (2026-07-25)

**30 `linked_to` edges props-merged** from the new dataor bulk-ISVR adapter (`lib/ingest/sources/
dataor.ts`, 21 tests; a 321MB file OOM'd the first reader — fixed with index-based scanning; an
Opus pass caught missing officer-type codes `DOZORCI_RADA_CLEN`/`KONTROLNI_KOMISE_CLEN`/
`SPRAVNI_RADA_CLEN`). **Scope correction the driver made to the orchestrator's own brief:** the
"81 open corroborations" was stale — the OSVČ purge (pass 22) had already removed 49 of the 58
unconfirmed, so the real open population was **32**. dataor closed **4** (2 general sweep + 2 via
PRaK); 9 verified structurally out of scope (not ISVR-registered at all); 5 pending one very large
slow file. Corroboration now: **181 registry-confirmed / 21 conflicting / 9 unconfirmed** of 211.

## Held (batch 006) — three payloads need an INSERT-capable path

`persist-batch.ts` is props-merge-only by design (it refuses to insert — the fabrication guard).
These three grow the graph and are therefore deferred to a dedicated apply pass, NOT rushed:
- **PRaK re-point** (Q-money-7, CLOSED analytically): both mis-pointed edges — Bendl **and Brabec**,
  a duplicate batch-003 only half-documented — re-point to IČO 61858111 + one new company node. An
  Opus pass retracted an unsupported "mayoral ex-officio rail-SPV" narrative behind the steward
  class in favour of the deterministic classifier the rest of the graph uses.
- **Indirect ownership** (O-money-3): 55 `owns_stake` proposals + 19 parent-company nodes, incl. a
  real DATED AGROFERT chain (2002–2005; the 2017 trust transfer is not visible in this slice and is
  flagged as a lead, not claimed). Needs an `owns_stake` enum addition (shared `kg-verdict.ts`).
- **kiosek notices**: proposed `notice` node kind + `cites`/`concerns` edges (see below).

## Batch 006 — kiosek first slice (no graph write; adapter + measured yield)

2,302 postings across 5 institutions (286 boilerplate / 306 substantive / 1,485 administrative);
23 PDF-extracted → 87 statute mentions (11 distinct laws, 4 already graph nodes) and 115 IČO
mentions (23 distinct). **Honest recalibration of the source assessment: 0 of those IČOs match our
196 tied companies** — court-notice litigants are a DISJOINT population from MP-tied firms, so
kiosek's money value is a *monitoring channel* (watch for a tied IČO appearing), not the immediate
linkage the assessment implied. Opus verification caught a statute-regex false-positive class
(court case-law citations `Sb. NSS` parsed as statutes) and an IČO-checksum edge case.

## Held again (batch 006) — law's amends regeneration, THIRD refusal

An INDEPENDENT fresh audit (different agent than the one that self-fixed it) returned **NOT READY**:
**N1 (new, recall)** — the census extractor splits on `Čl.` only and is blind to `ČÁST`/`§`-organised
bills, undercounting **~29 true amending edges across 7 omnibus bills**, so batch-005's "citation
universe closed" claim is false and the payload is INCOMPLETE, not merely imprecise; **N2** — 6
confirmed false edges (not the 2 the driver's own review found; the audit overturned one of its
"real edge" calls). Precision finally measured properly across all 567 (561 high / 6 low / 0
unresolvable). And the vindication of the hold policy: the batch's reflection **caught a bug in the
driver's own apply script** — 3 of 6 exclusion entries carried wrong bill-node ids and silently
no-op'd, so a live `--commit` would have written three audit-confirmed-FALSE edges. Fixed, with a
startup assertion that refuses to run on any non-matching exclusion. Rework target is now concrete
(the `ČÁST`/`§` splitter), not another audit round.

## Pass 28 (track: money) — batch 007: the insert path opens the graph (2026-07-25)

The first genuine TOPOLOGY growth since the trio landed, via the new
`scripts/case-loops/apply-batch.ts` (insert-capable, node-then-edge ordered,
provenance-preserving, enum-enforcing, deletion-allowlisted, dry-run default;
13 tests). Its Opus audit caught a blocker before any write: the ownership
period-merge picked "latest by date" as the summary row, which would have
written `share: null` onto the AGROFERT→Synthesia edge and TERMINATED dates
onto two still-active state-hospital stakes — false statements about real
companies. Fixed to open-period-first precedence, plus 8 board-seat rows
routed out of `owns_stake` entirely.

- **Q-money-7 CLOSED in the graph**: +1 `company` node (IČO 61858111 "PRaK,
  a.s. v likvidaci") and **2 re-pointed `linked_to` edges** (Bendl 346, Brabec
  6184) with dated board records. The **2 superseded edges to the wrong IČO
  49683144 were RETIRED** by explicit orchestrator allowlist entry — leaving
  them would have made the graph assert both, i.e. a false tie about two named
  MPs; same evidence standard as the pass-22 OSVČ purge, and the full record
  survives in the payload, vault and git.
- **Indirect ownership (O-money-3) LIVE**: +19 company nodes, **+33
  `owns_stake` edges** (dated), incl. the real AGROFERT chain. The 2017 trust
  transfer is NOT visible in this slice and is recorded as a lead, not a claim.
- **Verification caught one more**: the 2 inserted ties had NO `review_state`
  (renderers default to pending, but a person→company edge must be BORN gated
  by construction — kg-money's contract). Set explicitly; all 211 ties now
  carry `pending_review`.

## Pass 29 (track: sources) — batch 007: kiosek notices enter the graph

**+20 `notice` nodes, +36 `cites` edges** (notice → law) from the kiosek
úřední-desky slice. 80 proposed edges excluded and reported, never applied (75
unminted targets + 5 non-enum person-IČO markers). New enum values registered
in `kg-verdict.ts`: node `notice`; rels `owns_stake`, `cites`, `concerns`.
The `concerns` (notice → company) rel is registered but unused — kiosek's
IČOs remain a disjoint population from our tied companies (batch-006 finding),
so the money side stays a WATCH channel rather than an enrichment.

## Pass 30 (track: law) — batch 007: the amends universe APPLIED, on the fourth attempt

The regeneration held three times finally cleared, and only after an audit chain that kept
finding real defects at every level: batch-005 self-fixed (held) → batch-006 independent audit
found the N1 recall defect (held) → batch-007 fixed it structurally, its OWN reflection found 4
more (fixed), and the driver then **refused to bless its own round-2 work** → a narrow
orchestrator-commissioned audit of just that delta returned **APPLY**, having measured it: running
the extractor with the gates on and off across all 140 bills **removes 7 citations and adds 0**.

**Applied: +187 `law` nodes (101 → 288) and the `amends` edge set 150 → 581** (435 new inserts +
146 provenance-preserving merges; 3 tagged `low_confidence_proxy`, never silently promoted). The
citation universe is explicitly NOT claimed closed — 5 statutes remain missing and are reported.

**Then retired, as a separate deliberate act: 4 repeal-target edges** (tisky 116/129/231/64) which
asserted "bill AMENDS law" for bills that REPEAL it — artefacts of the pre-batch-007 title-regex
era, each evidenced from cached bill text. Verified exactly 4 deleted, 581 remaining.

Two orchestrator-level lessons, both from being misled by my own tooling:
- `apply-amends-regen.ts`'s deletion gate is a **refusal check, not an executor** — it never calls
  `deleteKgEdges`, and its "[allowlisted]" output means *permitted to be absent*, not *removed*.
  Wording corrected in place.
- Both arming lists (this script's exclusions, `apply-batch.ts`'s deletion allowlist) are
  **one-shot: arm, fire, disarm.** A stale entry doesn't rot quietly — the startup assertion is
  designed to refuse the whole run, and it did exactly that twice today, catching both the repoint
  and the post-deletion residue. That assertion is the most valuable line of code in the pipeline.

**Graph now: 3 215 nodes / 25 350 edges.** Outstanding for batch 008 (audit-disclosed, not
discovered later): F1 — tisk 215 loses one TRUE edge to 280/2009 via a ČÁST heading-window bleed
(incidence exactly 1, one-expression fix verified to touch only that bill); F2 — 5 pre-existing
FALSE title-derived edges (tisky 153, 88, 124, 36, 42), preserved rather than introduced by this
apply, including the one the union design's own justification comment cites as its founding example.

## Pass 31 (track: law) — batch 008: the two disclosed items closed (2026-07-26)

The batch-007 round-2 audit **disclosed** F1 and F2 rather than leaving them to be found later;
batch 008 closed both, and two Opus audits (a reflection + an adversarial re-derivation from
source) cleared the work while still finding real defects — a misclassified collision pair, a
stale caveat string, and a latent NFC-normalization gap in the core extractor — all fixed and
disclosed rather than smoothed.

- **F1 (recall)**: the `Čl.` block's forward heading-window now clips at an intervening `ČÁST`
  boundary. Blast radius re-verified independently: **exactly 1 bill changes** — tisk 215 recovers
  its real amendment to 280/2009, the edge the ÚČINNOST-heading bleed had swallowed.
- **F2 (precision)**: the **5 false title-derived edges are RETIRED** (tisky 153, 88, 124, 36, 42)
  — each re-verified per-edge from cached bill text this session rather than inherited from the
  audit (the driver's first guess at bill-node ids was wrong and it caught that before finalizing).
  In every case the ref appears only inside a nested law NAME or an amendment-lineage citation,
  never as an amend target. A corpus-validated title-role gate stops them regenerating.
  Pointedly, one of the five (88→360/2025) was the union design's own founding justification example.

**`amends` 581 → 577** (+1 F1, −5 F2). Re-triage recomputed the churn ranking on the new topology
(**40/2009 now #1**, displacing 586/1992); the full per-bill `triageScoreV2` recompute was
explicitly DEFERRED and said so rather than silently skipped. Collision universe re-run on the
regenerated topology: **629 raw → 176 partitioned pairs**, 12 close-read.

## Batch 008 (track: money) — three honest negatives, no graph write (2026-07-26)

The batch produced almost entirely NEGATIVE results, verified rather than assumed — which is what
a converged loop should produce once the easy signal is gone.

- **Q-money-15 closes C17**: all 28 still-open ties (19 conflicting + 9 unconfirmed) re-fetched from
  the LIVE ARES VR endpoint, no cache. **1 flip** (Okamura ↔ MIKI TRAVEL PRAGUE, IČO 25124188,
  jednatel since 1997), 16 genuine confirmed negatives, 9 structural 404s (public bodies outside
  the commercial register). Verdict recorded honestly: *C17's caution was locally right but did not
  generalize.* The Opus sweep of the "confirmed negatives" still caught 2 real mislabelings (a P36
  regression and a C11 no-officer-section case) — corrected before any payload.
- **Q-money-16 UNRESOLVED**: the dataor praha/brno bulk files stall reproducibly at ~65–71 MB of
  ~225 MB. Two retries, same signature. Reported as unfinished; 4 of 5 blocked ties stay open.
- **Indirect ownership — 0 genuinely new leads.** 26 sibling-level candidates, every one already
  independently MP-tied. The Opus pass identified WHY: the query is near-tautological by
  construction, so its null is uninformative rather than reassuring. Rescoped honestly —
  parent-level (8 named private untied parents) and multi-hop descendants were never examined.
- **kiosek watch built** (`scripts/case-loops/money/kiosek-watch.ts`, repeatable): **0 hits, and
  flagged as a ZERO-POWER baseline rather than a finding** — the `concerns` (notice→company) edges
  were never persisted (0 live vs `cites`' 36; they were all in the 80 excluded rows of the
  orchestrator's pass-29 apply), so the watch currently has nothing to match against. An
  orchestrator gap, disclosed by the loop rather than by me.

## Pass 32 (track: effort) — Q-effort-15: the public-copy debt paid off (2026-07-26)

**136 dossiers rewritten** (6 parallel Sonnet agents; strip jargon, preserve every fact/date/IČO/
amount/hedge, relocate removed internals into the NON-rendered `effort_analyst_note`). Gate
136/136 PASS, 0 DROP. Result measured on the live graph: **0/207 leaking**, **207/207 now render at
least one dossier field** (from 71/207), 180/207 render all three, 206 carry citations.

**The batch's most important catch — a cleanup pass that made prose LESS true.** The Opus
money-fidelity layer found **10 rewrites that silently converted hedged, unproven company ties into
flat uncited assertions** — the worst asserting a sitting minister's board seat against a 5.39bn CZK
contract. The reflection caught an 11th (Fiala) via a cross-field inconsistency the fidelity pass
missed. All corrected before persist. This is the sharpest evidence yet for P51's two independent
layers: readability work is exactly where hedges die, and a gate that only checks *jargon* would
have passed all 11.

**Also fixed a real enforcement gap:** `gate.ts` had silently FORKED `lib/analysis/public-copy.ts`'s
rule set with an extra rule the render-time guard lacked — so prose could be dropped at persist
time yet render at read time with its withheld status computed from a weaker rule set. The
orchestrator's own docstring had claimed "one rule set imported by BOTH ends"; that was false in
code until now. Unified, with test coverage — plus a source-grep test asserting
`effort_analyst_note` (which deliberately still holds jargon) is never wired into a render path,
a premise that previously had no enforcement at all.

**Gate reviewer note:** 29 soft prose-vs-props warnings were inspected at integration; the three
sharpest (Murová "dva měsíce", Outrata "tři ze čtyř", Sedmihradská "jeden z pěti") are all gate
FALSE POSITIVES — legitimate subset/period framings — which is the reviewer judgment the soft-fail
design intends rather than a blocking failure.

## Pass 34 (track: effort×law) — bill roles: signature rank, zpravodajové, fates (2026-07-27)

The effort↔law join gets its missing role semantics, built OUTSIDE the loop at operator
request (the loop runs its next batch on top). From psp.cz tisky.zip (column layout verified
against the live dump + doc k=1303 — predkladatel.poradi/typ, hist cols 8/9 + zaver, hist_vybory
col 4, tisky_za col 9; all `*_posl` ids mapped poslanec→osoba via the mandate table):

- **528 `sponsors` edges** gain props `{rank, role: predkladatel|spolupodepsal, joined_later}` —
  109 rank-1 (předkladatel). Closes the Q-effort-2 surface gap: profiles can finally say
  „předložil" vs „spolupodepsal" from data, not analyst prose.
- **NEW rel `rapporteur`: 148 person→bill edges** (scopes: zpravodaj_ov/ps/vyboru/dokumentu) —
  the assigned analytical role the sponsors edges cannot carry; 0 unmapped ids.
- **141 bill nodes** gain `sponsors_ranked`, `stav` (Czech typ_stavu name) and `fate_sb`/
  `fate_published_on` (12 published in Sbírce, e.g. tisk→583/2025). MERGE-preserving write —
  summary_cz/forensic_*/amends_* props verified intact (the P44 trap explicitly avoided; a full
  kg-legislation-ingest re-run would have erased 140 summaries + 27 verdicts).
- **207 person nodes** gain `bills_first_signed`/`bills_co_signed` (sums to bills_authored,
  which is untouched — case gate (a) respected, `computeContribution` not touched).

Writer: `scripts/data-analysis/kg-bill-roles-ingest.ts` (new, merge-preserving; dry-run default).
Parsers + tests in `lib/ingest/sources/psp-legislation.ts` / `psp-activity.ts` (`parseSponsorRoles`,
`parseRapporteurs`, `parseBillFates`, `splitBillAuthorship`). Surfaces: /zakony bill detail
(role-tagged sponsors, zpravodajové block, fate line, sponsor-min-contribution effort context),
/poslanec dossier (authorship split line, role+fate-annotated bill chips with internal /zakony
links, new zpravodajství section). ns=effort×law, track=build (operator-directed).

## Pass 35 (track: effort×law) — bill engagement: floor speeches + amendment authorship (2026-07-27)

Completes the operator-directed role build (pass 34's sibling). Two joins the graph never had:

- **NEW rel `spoke_on`: 891 person→bill edges, 3 048 substantive turns** — steno.zip `rec`
  joined through `bod_schuze.id_tisk` (schuze.zip; internal tisk id, verified empirically),
  chair turns excluded with the exact `speech_turns` filter. "Who actually defended the bill
  on the floor" is now queryable per bill, not just a per-term turn count. 20 debated
  non-law prints (budget, reports) honestly skipped as outside the 141-bill graph.
- **NEW rel `proposes_amendment`: 172 person→bill pairs / 444 amendments** — sd.zip
  `sd_dokument` typ 13. The k=1309 doc promises person attribution (`id_x`) only for typ 12;
  measured on PSP10, ALL 571 typ-13 rows carry an `id_x` that resolves to a sitting MP —
  deterministic authorship with no name-matching (the research plan's scrape fallback is
  unnecessary). Join by PUBLIC print number `ct` → bill `props.cislo` (NOT the internal id).
  127 amendments on non-graph prints skipped; 0 unknown authors.
- **207 person nodes** gain `amendments_authored` (86 nonzero) — annotation only,
  `computeContribution` untouched.

Writer: `scripts/data-analysis/kg-bill-engagement-ingest.ts` (merge-preserving, dry-run
default). Parsers + tests: `parseBillSpeeches`, `parseAmendments` (psp-activity.ts).
Surfaces: /zakony bill detail gains a „rozprava" block (top speakers with turn counts,
honest count-not-quality framing) and a „písemné pozměňovací návrhy" block (authors with
counts); /poslanec's authorship split line gains the amendment count. Top speaker measured
live: Ožanová 126 turns (tisk 72, loterie). ns=effort×law, track=build (operator-directed).

## Pass 36 (track: money) — batch 009: IČO identity repair + registry-existence annotation (2026-07-27)

Money case-loop batch 009, solo mode. Three live writes, no `review_state` touched.

- **1 `linked_to` props-merge** — applies batch-008's Q-money-15 payload: Tomio
  Okamura ↔ MIKI TRAVEL PRAGUE (`company:ico:25124188`), `corroboration`
  `conflicting → registry-confirmed` (jednatel since 1997-04-25, live ARES VR).
- **8 company nodes canonicalized** — company identity is
  `company:ico:<8-digit zero-padded IČO>`; batch-006's ownership slice wrote 8
  unpadded ids. 8 node upserts + 14 `owns_stake` re-points + 14 old-edge deletes
  + 8 malformed-node deletes. `company:ico:2867681` (IF Holding a.s.) was a
  **duplicate** of the canonical `company:ico:02867681` and had severed a real
  ownership chain; merged into the canonical survivor, which reconnects
  B.S.-KINGS → IF Holding → IF FACILITY. Node count 215 → 214.
- **2 company nodes annotated `ico_unresolvable_in_ares`** — `25130072`
  (AGROFERT HOLDING, a.s.) and `60197773` (AGROFERT a.s.) return NENALEZENO from
  BOTH the ARES basic and `-vr` endpoints. Not fabrications: their `owns_stake`
  edges come from dataor/justice.cz's ISVR export with dated 1999–2005
  sole-shareholder records — dissolved predecessor entities the current register
  no longer retains. Annotated (Czech analyst note, checked endpoints,
  `likely_historical_entity`, successor candidate `26185610` AGROFERT, a.s.)
  so no surface can present them as registry-checkable. 45/47 ownership-layer
  nodes verified to exist.

**Pass-number note:** these writes were first stamped pass 34 and re-stamped to
36 when a concurrent effort×law session was found to have taken 34 and 35. The
kernel assigns pass numbers at finalize time in write order; in a solo run that
assumption breaks if another session is writing at the same time — check the log
immediately before stamping, not at batch start.

Detail: `docs/data-analysis/case-money/batch-009.md`.

## Pass 36 (track: effort) — batch 008 build: effort_rapporteur_load (2026-07-27)

Deterministic annotation on all 207 person nodes: `effort_rapporteur_load` = distinct bills the MP
holds a `rapporteur` edge for (79 nonzero, 18 ≥ 3). Drives the „Zpravodajský tahoun" badge on
/zebricek (`lib/analysis/rapporteur-load.ts`, `RapporteurBadge.tsx`). Writer:
`scripts/case-loops/effort/rapporteur-load.ts` (merge-preserving). ns=effort, track=effort.

## Pass 37 (track: effort) — batch 008: role-signal dossier extensions (2026-07-27)

Props-merge on 16 person nodes: `effort_bill_focus` extended append-only with the pass-34/35 role
story (zpravodajství, amendment activity, floor engagement, signature split), `effort_analyst_note`
internals, `effort_citations` threaded. Gated 16/16; Opus verification caught 1 BLOCKING + 4 WRONG
items pre-persist (see case-effort/batch-008.md §3). The strengthened public-copy rule
(sample-scoped self-reference) ships in the same change and withholds 29 pre-existing
field-instances until the Q-effort-16 rewrite. ns=effort, track=effort.

## Pass 38 (track: effort) — batch 009: Q-effort-16 rewrite (2026-07-27)

Props-merge on 28 person nodes: the 29 sample-scoped self-reference field-instances
(effort_notes ×17, effort_bill_focus ×8, effort_public_role ×4, batches 001–007 prose) de-scoped or
restated absolutely. Minimal-diff proven at merge (non-offending sentences byte-preserved — the
deterministic substitute for a money re-verification); 1 stale count (Výborný) corrected from
pass-34 graph data. Re-measured post-persist: 0/207 withheld field-instances — the dossier corpus
renders fully clean. ns=effort, track=effort.

## Pass 39 (track: money) — batch 010: sole-shareholder record + extinct-IČO explanation (2026-07-27)

Money case-loop batch 010. Two props-merge payloads, no edge created, no
`review_state` touched.

- **1 `linked_to` props-merge** — `psp:person:6150` (Andrej Babiš) →
  `company:ico:26185610` (AGROFERT, a.s.). The graph held only a board role
  ending 2014-01-22; the obchodní rejstřík also records a **`jediný akcionář`**
  registration **2025-10-15 → 2026-02-20**, inside the current term. Merged in
  as `shareholder_record` with the legal basis (§ 48 odst. 1 písm. k) zák.
  č. 304/2013 Sb. — a shareholder is entered for an a.s. only where there is a
  single one), the self-declaration in notářský zápis NZ 1292/2025, the office
  held in the window (**předseda vlády od 2025-12-09**, the status §§ 4b/4c zák.
  č. 159/2006 Sb. attach to), the successor (Wilfried Reinhard Elbs **as
  svěřenský správce of RSVP TRUST, not as owner**), and two explicit open
  questions (registry dates are NOT acquisition dates; the trust's founder and
  beneficiaries are unverified). `tie_class_review_needed: true` — a
  sole-shareholder period would reclassify the tie `owner-operator`, which is a
  human-review decision, not an automated one.
  Verified by an independent Opus pass at maximum depth against three primary
  sources (ARES VR REST, or.justice.cz úplný výpis, sbírka listin deeds
  NZ 1292/2025 and NZ 176/2026), which returned PARTIAL and corrected four
  defects in the driver's reading. No media used.
- **3 company node props-merges** — corrects pass 36's "likely historical
  entity" annotation on the two unresolvable IČOs with the precise, sourced
  reason: `25130072` merged into `26185610` on **2004-08-31**, `60197773` (with
  AGROPROFIT) on **2005-06-30**. They are extinct, not erroneous — the dataor
  slice was accurate. A name-collision trap is recorded on the successor: entity
  `26185610` itself bore the name "AGROFERT HOLDING, a.s." between 2004-08-31
  and 2013-10-01 (and "AGFTRADING, a.s." before that).

Pass numbers 37 and 38 were taken by concurrent effort/law sessions during this
batch; 39 was claimed by re-checking the log immediately before writing.

Detail: `docs/data-analysis/case-money/batch-010.md`.

## Pass 40 (track: money) — batch 011: AGROFERT contract window + SZIF corroboration (2026-07-27)

One `linked_to` props-merge onto the same edge pass 39 annotated
(`psp:person:6150` → `company:ico:26185610`). No edge created, no `review_state`
touched.

- **`window_corroboration`** — the state paying agency's own published legal
  analysis (SZIF / PORTOS, 2026-02-27) states that on 2026-02-20 the AGROFERT
  shares were placed into svěřenský fond RSVP TRUST, and that "nejméně v období
  od 9. prosince 2025 do 20. února 2026" the § 4c conditions were met for the
  group's companies. This is an INDEPENDENT, non-registry, non-media source that
  **strengthens the closing date** from "registry výmaz" to "actual transfer".
  The opening date (2025-10-15) remains registration-only — the register does
  not establish when the shares were acquired.
- **`contract_register_findings`** — Registr smluv sweep of the 9 graphed group
  companies: 624 records, 23 published inside the window. **92 % of the stated
  value is a single item**: the SFDI × Lovochemie framework financing contract
  for modernizing Lovochemie's own rail siding (concluded 2025-12-01, published
  2025-12-03) — a **maximum EU ceiling** of 181 454 606,76 Kč (49 % of eligible
  costs), awarded through the closed competitive call č. 35 of Programu Doprava
  2021–2027 (applications closed 2025-06-30), paid **ex post** through 2028. Not
  a discretionary award and not a paid-out sum.
- **Direction is recorded as NOT established.** Of the 16 records published from
  2025-12-09, none is evidenced as public money awarded to the group; the only
  one whose direction was verified from the underlying document runs the other
  way — Kostelecké uzeniny **pays** the Vězeňská služba under a prison-labour
  contract, on a rate derived from 50 % of the minimum wage.
- **Blind spot recorded**: Registr smluv carries no subsidy granted by decision
  (notably SZIF agricultural subsidies), nothing below 50 000 Kč, and nothing
  before 2016-07-01. The 624 records are a lower bound on one partial channel
  across 9 of the group's many companies.

Verified by an Opus pass at maximum depth that returned PARTIAL and corrected
five framing defects, including a wrong premise about `party_idnum` (it matches
only the NON-publishing party) which has been fixed in
`lib/ingest/sources/smlouvy.ts` and the docs it propagated to.

Detail: `docs/data-analysis/case-money/batch-011.md`.

## Pass 41 (track: money) — batch 012: contract corpus re-ingest from the bulk dumps (2026-07-27)

The largest write the money case has made. Contract corpus lifted from a capped
per-company sample to the actual Registr smluv record.

- **152 702 contract nodes** (2 287 → 152 788 total) and **153 634 `supplies`
  edges** (2 290 → 153 731), harvested from the monthly open-data dumps at
  `data.smlouvy.gov.cz` (123/123 months, 2016-05 → 2026-07).
- **Keyed on `idSmlouvy`, not the id in the web URL (`idVerze`).** These are
  different sequences; keying on the URL id would have silently duplicated the
  corpus. Confirmed by outcome: 2 201 of the 2 287 existing nodes matched.
- **Props MERGED, never replaced** — `upsertKgNodes` replaces wholesale, so a
  naive re-ingest would have erased every prior pass's annotations. The ingest's
  own provenance is nested as `reingest_provenance`; identity provenance is
  untouched.
- **A `payer` contract never receives a `supplies` edge** (23 refused). Direction
  comes from the dumps' `<platce>`/`<prijemce>` flags — stated in only ~18 % of
  records, running 25 819 recipient to 23 payer among those — and is recorded on
  every edge so consumers filter on what is known.
- Values keep their basis (`amountBasis`: bezDph 82 918 · vcetneDph 36 580 ·
  ciziMena 2 959 · none 30 245); 13 174 superseded versions dropped.
- **86 legacy contract nodes are absent from the current dumps** — reported, not
  deleted (the dataset's GDPR terms oblige a recipient to propagate withdrawals;
  that is a human decision).

**The surface changed in the same pass, deliberately.** The raw reachable total
became 7.19 tn CZK, of which **99.4 % is not attributable** to any politician
(steward institutions 462.8 bn; ownership parents with no tie at all 6.68 tn).
`/penize` now renders `contractCzkAttributable` (42.89 bn — owner-operator and
manager ties) and names the steward total separately, instead of one
undifferentiated headline. Shipping the completed data without this would have
made the tile say something false at nine times the volume.

Detail: `docs/data-analysis/case-money/batch-012.md`.

## Pass 42 (track: effort) — the contribution index counts BODIES, not filing rows (2026-07-29)

**A stated, dated correction to a published ranking.** `committee_count` counted
psp.cz membership ROWS, and psp.cz files a body an MP LEADS as two rows (a
`member` row plus a `function` row on the same organ). So an MP who chaired one
committee could out-score an MP who sat on two — for a filing convention, not a
fact about the chamber. Documented in `lib/analysis/contribution.ts` since batch
006 and deliberately left unfixed there; on `/zebricek`, whose entire job is
ranking, it silently moved ranks.

`computeContribution` now counts DISTINCT BODIES (`CommitteeSeat.organPspId`),
and `leadershipCount` likewise counts the distinct bodies an MP leads. Role
weighting is untouched: the `leadership` component still pays its full 10 points
for a chair, so a chair still outscores a plain member of the same body — it just
no longer counts that body twice.

Measured over the real store (207 PSP10 MPs, 1 334 membership rows → 855
committee-type):
- **121/207 MPs** held ≥1 body represented by more than one row (206 duplicate rows).
- **33 MPs lose points**; **220,1 index points** removed from the composite
  (220,5 measured on the committee component before per-MP rounding); largest
  single drop **−6,7** (20 → 13,3 on the committee term).
- Saturated population (`committee_count ≥ COMMITTEE_SATURATION = 3`): **158 → 131**.
- **184/207 printed ranks move** under the ordering in place at the time.
- Absentee-manager leads unchanged (4 → 4); no MP crossed the 40-point threshold.
- Prior-term baselines: `contribution_psp9` on **109 nodes** was scored by the
  same formula, so its committee fields were corrected too (16 baselines move).
  Its legislative/speech numbers come from psp.cz dumps this pass never reads and
  were carried through verbatim.

Stored rates were also republished at **3 decimals** instead of 1. They are
PUBLISHED INPUTS — `/zebricek` re-derives the participation and attendance
component points from them — and a 1-decimal rate (0,9 for 938/1 000) made the
published parts disagree with the published whole by up to 1,6 points for
**197/207** MPs. After the correction: **71/207, max |Δ| 0,1**, which is the
irreducible rounding of six one-decimal parts. The composite itself is unchanged
by this.

**Write mechanics** (`scripts/data-analysis/kg-contribution-recompute.ts`, new).
Re-running `kg-contribution-ingest.ts` was rejected: it re-derives
bills/interpellations/speeches from LIVE psp.cz dumps, which would fold whatever
the chamber has done since pass 11 into a commit whose stated subject is a
formula correction. The new pass instead
- takes every non-committee input verbatim off the person node, or recomputes it
  from the same store rows pass 11 read (2 014 roll calls over 63 sitting days);
- **replays the OLD formula** over those inputs and refuses to write unless it
  reproduces the stored score, committee/leadership counts and both rates for
  EVERY MP — it reproduced 207/207, which is what makes this a correction rather
  than an unattributable rewrite;
- writes `{...liveNode.props, ...corrected}` over the node read in the same run
  (memory/kg-upsert-replaces-props.md — `upsertKgNodes` REPLACES props).

Verified on a throwaway copy of the 1,6 GB store before touching the live one: a
full before/after props diff over all **153 646 nodes** showed **0 differences**
outside the eight declared props (140 bill summaries, 195 effort dossiers and all
207 rapporteur loads intact).

## Pass 43 — effort track: prose reconciled to the pass-42 correction (2026-08-04)

21 person nodes props-merged (`track: "effort"`, refs `pass42-committee-prose` and
`pass42-score-prose`). No number changed: pass 42 owns every contribution value, and this
pass touches only the analyst prose that QUOTED those values.

Why it exists: pass 42 moved 41 committee counts and 33 scores. The dossier prose written in
batches 001–009 had quoted the old numbers, so the correction left **14 sentences naming the
wrong committee count** and **16 quoting a superseded score** — including two claims that
INVERTED (a „stays above the club average" that is now below it; a „positive trend" that now
runs backwards). Measured by diffing the live store against `.pglite-backup-pass11`.

Every rewrite passed a minimal-diff proof: sentences not opened for rewrite are byte-identical,
so no money sentence, hedge, date or IČO can have moved. Verified on the live store afterwards:
committee contradictions 15 → 1 (an adjudicated false positive — a sentence about a different
person quoted inside a dossier), stale score citations 16 → 9 with **0 on any rendered field**.

Recomputing distinct bodies from the membership rows independently reproduced the stored
`committee_count` for 15/15 contested MPs — pass 42 re-verified from the outside.

Guard added where it belongs: `kg-contribution-recompute.ts` now reports every dossier field
quoting a score it supersedes, so a future contribution correction cannot silently invalidate
prose again. Detail in `case-effort/batch-010.md`.

## Pass 43 (track: law) — Case ③ batch-011: 12 forensic verdicts on the audited triage head, the case's first medium severities (2026-08-04)
One live write: kg-forensics.ts --write --pass=43 --commit enriched 12 bill nodes (tisky 64, 67,
7, 102, 213, 14, 189, 77, 154, 221, 103, 201) with pending_review forensic_* props — the top-9
pending bills by triageScoreV2 after batch-010's sector-adjacency audit plus the three attributed
survivors outside the head. All 12 written Czech-native against requireCzech and gated twice
(DB-free scoped gate off the targets file's 24 774-statute anti-fabrication scope, then the
write-time gate). Verdict backlog 114 → 102; totals 27 → 39 verdicts. Severities: 3 medium
(67 — EIA one-stop-shop reaches AGROFERT chemical operators and the 235/2004 § 55a edit moves
the VAT-exemption boundary with Hartenberg/IMOBA active in real estate, channel held open not
cleared; 213 — foreigner-residency scope beyond the Ukraine title; 221 — the conflict-of-interest
reform loosens the minister exclusion while creating a new ÚSC-councillor restriction class that
covers both sponsors' own companies) and 9 low. An Opus adversarial audit at max effort
(batch-011-audit.md) found 1 BLOCKING + 8 MAJOR defects pre-persist — six money-touching, the
class the kernel predicts — all remediated by the resumed authors and re-gated 12/12 before the
write; a FRESH independent audit of the remediated payload is batch-012 P1. Alongside (no graph
writes): 16 collision pairs close-read (12 confirmed / 2 coordination-risk / 2 incidental, plus a
verbatim-evidence re-confirmation of batch-001's 120-244 that supersedes the loader's hardcoded
prior pair), all 32 E-CHECKs pass the P49 guard; two mechanisms named — tisk 64's
insert-letter-and-renumber habit breaks sibling bills on four statutes, and 586/1992 § 35ba
odst. 1 is a confirmed three-way collision (120/189/244). Manifestation verified by running the
loaders: 39 forensic blocks render with 0 withheld strings; /zakony/kolize renders 80 pairs
(48 confirmed), czechPending 0 after the batch-002-era English prior-pair reasoning (silently
withheld since pass 33) was rewritten in Czech.
