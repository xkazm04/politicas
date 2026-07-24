# Patterns — durable data findings

Durable, evidence-cited findings the loop surfaces, feeding the graph and the app.
Each pattern cites real entity ids / counts (the gate rejects a hallucinated one).
Append-only; group by the pass that found them. See [[graph-log]] for provenance,
[[feature-opportunities]] for the product proposals these motivate, and the
per-cluster notes (e.g. [[cluster-blocs]]) for context.

---

## Pass 2 — 2026-07-23 — voting blocs (F1)

- **P1 — Two blocs, not eight clubs.** Every within-bloc club pair scores 0.913–0.985
  while every cross-bloc pair scores 0.369–0.457 — a clean gap with no intermediate
  cases (ODS–SPD 0.457 vs ODS–Piráti 0.913). → [[cluster-blocs]]
- **P2 — The ANO2011+SPD+MS bloc holds a 114-seat majority** (of 207) and is internally
  *more* cohesive (0.974–0.985) than the five-club bloc's least-aligned pair
  (ODS–Piráti 0.913).
- **P3 — ODS is the weakest-integrated member of the five-club bloc** — mean intra-bloc
  agreement 0.933 vs 0.957–0.970 for STAN/Piráti/KDU-ČSL/TOP09. A possible swing role.
- **P4 — A perfect ANO2011↔MS core.** The four strongest cross-club MP pairs in the
  chamber (agreement 1.0 over 849–1090 shared votes) all link ANO2011 and MS:
  Okleštěk↔Barták, Krňanský↔Pařil, Okleštěk↔Krňanský, Klempíř↔Mrázová.

*(Pass 1 was the deterministic seed — see [[graph-log]]; its quantitative facts
(cohesion ranking, rebellion leaders) live in the node props, not restated here.)*

## Pass 3 — 2026-07-23 — themes (F2)

- **P5 — Procedural churn dominates the agenda.** Parliamentary-procedure votes are
  ~40% of the chamber's 2 014 roll calls (807 of the 47 head subjects' 1 775) — mostly
  the 717-vote "Pořad schůze" ritual. Policy signal is a minority of floor activity.
  → [[cluster-themes]]
- **P6 — Two dominant legislative pushes.** `theme:fiscal-budget` (276 votes) and
  `theme:housing-construction` (199) together exceed every other policy theme combined;
  next largest (social-health) is only 77.
- **P7 — `- EU` marks legal basis, not a policy domain.** The 8 EU-tagged subjects
  scatter across four unrelated themes (financial-market, animal-welfare, fiscal, and a
  residual digital/transport cluster) — so EU status is a *cross-cutting tag*, not a theme.
- **P8 — A distinct ~15% non-legislative slice.** State honours/symbolic (182),
  public-appointments (56), government-confidence (18) and oversight/interpellations (12)
  = 268 votes of Chamber governance separate from lawmaking.

## Pass 4 — 2026-07-23 — bloc × theme (F11, deterministic)

- **P9 — The chamber is polarized on nearly everything.** The two blocs are on opposite
  sides on 8 of 13 themes (`opposed_fraction` ≥ 0.5); *none* is a true consensus zone —
  even the least-contested (state honours, 0.215) splits them a fifth of the time.
  → [[cluster-bloc-theme]]
- **P10 — The budget is the sharpest battleground; consensus is technical, not political.**
  Fiscal-budget opposed 0.913 (bloc B 0.92 vs bloc A 0.18). The lowest-opposition themes
  are symbolic honours, appointments, EU-transposition and financial-market technicalities
  — never a core policy domain.
- **P11 — Volume ≠ consensus: even procedure is partisan** (opposed 0.763). High vote
  *volume* on a theme does not mean low conflict — it refutes the pass-3 read of procedure
  as neutral churn ([[contradictions]] C1).

## Pass 5 — 2026-07-23 — theme-grain rebellion (F16, deterministic)

- **P12 — Rebellion concentrates where it is cheap.** The top raw rebel (pass 1) Pikora
  (MS) rebels 87× but almost entirely on low-stakes state-honours free votes; weighting by
  theme `opposed_fraction` reorders the "most independent" MPs (Babka, Haas rise). Raw
  rebellion overstates substantive independence — the quantified case for O8.
  → [[cluster-theme-rebellion]]
- **P13 — ODS is its coalition bloc's fiscal outlier.** Budget bloc-defectors are
  overwhelmingly ODS (Haas 20, Bureš 11, Sokol 11, Adamec 9, Bendl 8…) with near-zero
  *club*-rebellion — so ODS-the-club diverges from the rest of bloc B on the budget while
  its members stay loyal. Answers F8; localises pass-2 P3 (ODS weakest-integrated) to the
  fiscal dimension.
- **P14 — Budget crossing is asymmetric.** 440 budget bloc-defection events: bloc-B
  crossings are *club-level* (ODS as a unit), bloc-A crossings more *individual* (Šťastný,
  Gregor, Nacher — higher club-rebellion). Different mechanisms of dissent per bloc.

## Pass 6 — 2026-07-23 — agenda control over time (F17, deterministic)

- **P15 — Control never shifted between blocs; the *mode* did.** Bloc A (the 114-seat
  majority) wins ~0.98 of decisive votes throughout. What changes is the chamber flipping
  from **consensus** (Nov 2025 — both blocs win ~everything) to **majoritarian** (from the
  Jan 2026 confidence vote — bloc B's win-rate collapses to ~0.38 overall, agenda ~0.1–0.3).
  → [[cluster-agenda-control]]
- **P16 — Support ≠ control** (corrects pass 4, [[contradictions]] C2). Bloc B posts high
  *support* on budget/procedure yet *loses* — it backs the outgoing government's measures
  that the new bloc-A majority rejects. Governing control must be read from **win-rate**,
  not vote direction.

## Pass 7 — 2026-07-23 — convergence (F19/F20/F21, deterministic)

- **P17 — ODS's coalition break is a coherent fiscal position.** ODS diverges from bloc B on
  only 5.9% of fiscal votes (16/271) but *all 16* are ODS voting NO with the ANO majority
  against its own bloc, concentrated on the EET/sales-records bill (8) and budget (7) — a
  consistent more-restrictive stance, not scatter. → [[cluster-convergence]]
- **P18 — Independence ≠ bridging.** `contested_rebellion_score` and cross-bloc co-voting are
  uncorrelated (Pearson 0.081); rebels break idiosyncratically, not toward the other bloc. And
  true bridges barely exist — max cross-bloc agreement 0.52 vs 0.9+ within-bloc (Haas the lone
  MP who is both independent and bridging).
- **P19 — Consensus is ceremonial, confirmed temporally.** The two cross-bloc-agreement windows
  are chamber self-constitution (Nov 2025: 42 procedure votes) and the honours season (June 2026:
  138 state-honours) — never policy. Confirms P10 with dates.

## Pass 8 — 2026-07-23 — committee jurisdiction (F12, gated verdict)

- **P20 — The chamber runs a large dedicated oversight apparatus.** Of 27 committee→theme
  `owns` edges, `oversight-interpellations` is the most-owned theme (7 of 33 committees),
  while 2 themes (government-confidence, state-honours) are plenary-only and 4 committees
  (defence, foreign, education, security) fall outside the vote-derived theme taxonomy —
  a structural map of where legislative power is delegated vs kept on the floor.
  → [[cluster-committees-and-money]]

## Pass 9 — 2026-07-23 — theme taxonomy extension (F23, gated verdict)

- **P21 — Foreign-affairs legislation is a small treaty-ratification cluster hidden in the
  long tail.** 8 subjects / 13 votes (double-taxation treaties with Kenya/Tanzania/Malta, the
  German border treaty, Slovak/Mongolian police-cooperation, the Slovak health-rescue treaty,
  + the Ukraine armed-conflict measures) — none in the 47 head subjects. Now `theme:foreign-affairs-treaties`,
  resolving the ZAV/VO/VB committee gap with real votes. → [[cluster-foreign-and-taxonomy]]
- **P22 — Education has ZERO floor legislation this term** — the VVVMS committee gap is a true
  structural fact, not a taxonomy defect. No theme was added; an empty theme node would be
  ungrounded. The loop declines to fabricate a category the data does not support.

## Passes 10–11 — 2026-07-23 — full theme coverage + re-score (F13, F18)

- **P23 — The long tail is chamber housekeeping, confirming the head sample captured the policy.**
  The 124 long-tail subjects classify as parliamentary-procedure (42) + public-appointments (30)
  = 58% housekeeping, with the rest thin across existing themes. `about` coverage now spans all
  179 subjects; the head-47 pass already held essentially all substantive policy volume.
- **P24 — Contestedness is sample-robust at the top, sample-sensitive at the margin.** Re-scoring
  over full coverage left the headline intact (fiscal-budget 0.87, procedure 0.72) but nudged
  borderline themes down as the more-consensual tail was added — `oversight-interpellations`
  crossed 0.50 → 0.348 (contested → mixed; [[contradictions]] C3). `foreign-affairs-treaties` is
  **consensus** (0.133) — treaty ratification is bipartisan. Now 7 of 14 themes contested.

## Pass 12 — 2026-07-23 — per-vote contestedness (F3/F7, deterministic)

- **P25 — The blocs are a genuine party system, not a lopsided-vote artifact.** On the 1 057
  contested (close) votes, bloc opposition rate jumps **0.62 → 0.998** and intra-bloc cohesion
  *rises* (A 0.976→0.989, B 0.924→0.945). The two-bloc split is sharpest exactly when votes are
  decided narrowly — the definitive confirmation of the pass-2 finding. → [[cluster-contested]]
- **P26 — Per-vote-margin weighting finalizes the independence measure.** Weighting rebellion by
  vote contestedness drops the raw #1 rebel (Pikora, honours free-votes) out of the top 12 and
  lifts genuine cross-pressure MPs (Babka, Haas). Three measures now agree (raw → theme-weighted →
  per-vote-weighted). CivicScore Independence = f(`contested_vote_rebellion`), not raw rebellion.

## Pass 13 — 2026-07-23 — F4/F9 (modest/negative results, honestly recorded)

- **P27 — Two hypotheses that did NOT pan out.** (F4) Committee membership barely predicts owned-theme
  contestedness (Pearson 0.26) — committees are cross-party, floor rebellion is ~independent of them.
  (F9) Bloc A (ANO-SPD-MS) is a tight *flat* trio (pairs 0.974–0.985), **not** a 2+1 core — the
  pass-2 ANO↔MS perfect *individual* pairs don't scale to a club-level sub-alliance (ANO–SPD is
  marginally tightest). Recorded because a negative result is a result — the loop doesn't force a story.

## P28 [money] Stale "ongoing" is the norm, not the exception (batch 001)

The `linked_to` period derives from Hlídač `datumDo` (absent ⇒ "ongoing"); ARES VR shows the real
end date. In the top 15 owner/steward ties, 11/15 were stale or misattributed: 8 roles had ENDED,
2 had money post-dating the role, 1 missed an indirect chain. No tie should render as "active"
until reconciled against ARES VR. Hlídač start dates are year-rounded (~months off ARES vznik).

## P29 [money] Owner-operator vs steward is the load-bearing tie distinction (batch 001)

Raw reachable-money ranks public-body supervisory seats (hospitals/utilities) at the top, where
money is the body's own public activity and does NOT flow to the MP. Tie-class (owner-operator 37 ·
manager 23 · steward 200), keyed on role × legal-form/public-marker, separates the real
FollowTheMoney from stewardship. Steward totals (VaK Kroměříž ~602M) must never attach to the MP.

## P30 [effort] Young-term floor artifact (batch 001)

In a ~8-month term the effort index's bottom tail is dominated by role artifacts, not
disengagement: declined mandates (floor ~10.4, participation 0), executive handovers (Fiala 28.6),
dual-mandate regional executives. The Case-①×② absentee crossover mis-fires — 4/4 leads were
structural false positives; corroboration should DOWN-weight these.

## P31 [effort] Two flavours of quiet workhorse (batch 001)

Legislative-authorship (high bills, low speech: Richter) vs oversight-institutional (high
committee load, ~0 bills: Sedláčková, Ratiborský). Both positive; the product should not
collapse them into one label.

## P32 [law] The money flag is a weak conflict proxy (batch 001)

`sponsor_contract_czk` flags 65/141 bills but the top-8 yielded 0 real conflicts — it saturates on
municipal/SOE board roles (ARENA BRNO, Pražské služby, ČEPRO) that are not self-dealing channels.
General tax/pension/criminal statutes distribute to statutory classes, not sponsor-linked firms.
Rank conflict by tie SECTOR-ADJACENCY to the amended law's domain; exclude municipal/SOE roles.

## P33 [law] Sibling bills collide — read them together (batch 001)

tisk 120 ↔ 244 both amend §35ba of 586/1992 with renumbering assuming different starting
letterings; whichever enacts second strikes the wrong provision. Only visible reading sibling
prints in one batch — a "same-statute, same-§, overlapping prints" pre-check is worth building.

## P34 [law] Quiet riders hide under a headline title (batch 001)

tisk 4 (an "income-tax" bill) carries a new 2,340 Kč/hl wine excise; tisk 40 adds beer beyond its
stated wine scope. The churn-target triage signal (busy statutes) surfaces these correctly.
