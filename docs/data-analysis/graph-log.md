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

