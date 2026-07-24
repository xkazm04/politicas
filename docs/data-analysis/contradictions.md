# Contradictions — where a re-analysis disagreed with a stored finding

A distinct benefit of *writing knowledge back* (design §7): when a later pass
re-touches a node or re-derives an edge, diff the new finding against the stored
one and **log every disagreement here**. This catches data-refresh degradation and
model drift on a dataset that is otherwise static — a stored fact that a fresh pass
can no longer reproduce is a signal, not noise.

Each entry: the node/edge, the stored value, the new value, the pass that found the
disagreement, and the resolution (which won, and why). Append only.

See [[graph-log]] for what each pass added and [[coverage-ledger]] for the
reuse-rate / contradiction-rate metrics that quantify the flywheel.

---

## C1 — 2026-07-23 (pass 4) — "procedure is process churn" is refuted

- **Stored (pass 3):** [[patterns]] P5 + opportunity **O5** framed
  `theme:parliamentary-procedure` as low-signal "process churn" — the VoteTrack
  proposal was to *default-hide* it so citizens see policy, not repetition. The
  spawned hypothesis F14 predicted procedure votes would be near-unanimous.
- **New (pass 4, F11, deterministic):** procedure is one of the *most* contested
  themes — `opposed_fraction` **0.763** (bloc B carries the agenda at 0.90 support,
  bloc A resists at 0.38). Agenda control is a partisan battleground, not neutral
  housekeeping. See [[cluster-bloc-theme]].
- **Resolution:** the pass-4 deterministic result **wins** (it measures actual bloc
  positions; P5 inferred low-signal from raw vote *volume*, which conflated repetition
  with consensus). **F14 → answered (refuted).** **O5 revised:** VoteTrack should still
  separate procedure from policy for *volume* reasons, but must NOT hide it — it is a
  distinct partisan signal. Volume ≠ consensus is the lesson.

## C2 — 2026-07-23 (pass 6) — "bloc B holds governing control" is corrected

- **Stored (pass 4):** [[cluster-bloc-theme]]'s "directional read" inferred that **bloc B**
  (ODS-STAN-Piráti-KDU-ČSL-TOP09) held governing control this window, from its high
  *support* on budget/procedure/confidence.
- **New (pass 6, F17, deterministic):** by **win-rate** (whose majority matches the vote
  outcome), **bloc A** (ANO-SPD-MS, the 114-seat majority) controls the chamber — it wins
  ~0.99 of decisive votes from Jan 2026 on, while bloc B's win-rate collapses to ~0.2–0.5.
  See [[cluster-agenda-control]].
- **Resolution:** F17 **wins** — *support ≠ control*. Bloc B voted **yes** on the outgoing
  caretaker government's FY2026 budget and lost; the new bloc-A majority **rejected** it.
  High support with low win-rate is the signature of an opposition backing measures that
  fail. The pass-4 directional read is **revised** (bloc A governs; bloc B is the losing
  opposition). Lesson: measure control by *who wins*, not *who says yes*.

## C3 — 2026-07-23 (pass 11) — a borderline theme classification was sample-dependent

- **Stored (pass 4):** [[cluster-bloc-theme]] scored contestedness over the **47 head subjects
  only**. `oversight-interpellations` came out `opposed_fraction` **0.50 → "contested"**;
  [[patterns]] P9 said "8 of 13 themes contested."
- **New (pass 11, F18, full coverage):** re-scoring over all **179** themed subjects,
  `oversight-interpellations` is **0.348 → "mixed"** (12 → 23 scored votes). Most themes drifted
  slightly *down* as the more-consensual long tail (procedure/appointments) was added; oversight
  crossed the 0.5 line. Now **7 of 14 themes contested**.
- **Resolution:** F18 (fuller coverage) **supersedes** — the pass-4 numbers were correct *for the
  head sample* but a borderline theme (12 votes) was sample-sensitive. The headline finding is
  **unchanged** (fiscal-budget sharpest 0.87, procedure partisan 0.72, consensus only symbolic/
  technical). Lesson: report borderline classifications with their sample size; re-score on
  coverage change. (New: `foreign-affairs-treaties` scores 0.133 — treaty ratification is
  bipartisan **consensus**.)


## C4 [money batch 001, 2026-07-24] — graph tie periods vs ARES VR

Graph `linked_to` edges assert "ongoing" (Hlídač `datumDo` absent ⇒ open); ARES VR contradicts
for 8 of the top 15: Okamura/MIKI TRAVEL (ended 2021-06-02), Ženíšek/Pojišťovna VZP (3-month
2013 board seat), Černochová/Komwag (ended 2021-12-20, + an omitted 2005–2011 term), Juchelka,
Decroix, Vondráček, Fiala ×2. Graph also asserts "no party donation" for STYLE PD / OCCAM PR /
Delices de papa where Hlídač shows donations (215k ODS / 240k TOP 09 / 40k ODS) — needs a
donor-registry pass. Resolution: annotated in props (pass 13), review_state untouched; period
reconciliation feeds next triage.

## C5 [effort vs pass-11 crossover, 2026-07-24] — absentee_manager_lead false positives

`absentee_manager_lead=true` for Zarzycký (7063), Brabec (6184), Faltýnek (6190), Karpíšek (6603)
is contradicted by public role: the first two RELINQUISHED their PSP10 seats (regional executives)
and never voted; Faltýnek's 6.27M is Agrofert-in-trust (board exit 2016); Karpíšek's 235M is
regional public-body board seats held by office. Arithmetically correct, semantically false
positive. Resolution: `never_cast_ballot` pre-filter + `effort_low_score_reason` annotation
(pass 14); computeContribution numbers unchanged.

## C6 [law batch 001, 2026-07-24] — `amends` edges UNDERCOUNT the real amended-law set

tisk 4's bill text amends FOUR statutes; the graph's `amends` (title-regex on "č. N/RRRR Sb.")
recorded ONE (586/1992). psp-legislation.ts extracts only laws NAMED IN THE TITLE; bills amending
further statutes in the body ("a další související zákony") are undercounted — churn counts,
routing-domain checks and "most-amended" rankings are all biased low. Fix: parse the tisk body /
e-Sbírka novelization instructions. Recorded so downstream passes don't trust `amends` as complete.

## C7 [money batch 002] — wrong IČO suspected: Bendl + Brabec → "PRAK"

Both ties cite IČO 49683144 ("PRAK spol. s r.o.", an s.r.o. since 1993 — structurally cannot
have a představenstvo) for a "member of the board" role. Independent lookup found a SEPARATE,
dissolved "PRaK, a.s." with a documented Bendl board seat 1996–1999 (liquidated 2012) — almost
certainly the right entity under a different IČO. Resolution: both ties kept
conflicting/signal:0, flagged `wrong-entity-suspected` — never re-pointed without evidence
(no IČO minted). Re-resolution = Q-money-7.

## C8 [law batch 002] — amends undercount is SYSTEMATIC for government omnibus bills

Batch 001 flagged tisk 4 (4 real statutes vs 1 recorded) as a lead; batch 002 confirms the same
failure at 7–8× scale on government EU-transposition omnibus prints (111: 7 vs 1; 207: 8 vs 1).
The `LAW_CITATION` title-regex catches only the FIRST citation; the "a další související zákony"
class undercounts systematically. Churn scores and most-amended rankings for this class are
biased low by a larger factor than batch 001 estimated — a body-text parse is the fix
(priority raised).

## (positive) [effort batch 002] — zero contradictions across 4 batch-001 cross-references

The Opus reflection cross-checked Demjanová↔Brabec, Penc↔Kubis, Bendl/Haas bill-slate overlap,
Činčila/Brzesková pension-novela split against batch-001 facts: all consistent. Recorded per
the "absence of signal is a finding" rule.

## C9 [money batch 003] — PRaK candidate found; confidence downgraded on review

Batch 002's wrong-IČO flag (C7) partially resolved: candidate IČO 61858111 ("PRaK, a.s.
v likvidaci", the Praha–Kladno rychlodráha SPV, dissolved 2012), both Bendl and Brabec
corroborated as board members. Opus downgraded confidence high→medium: ARES returns 404 on both
endpoints (dissolved pre-ARES reach — same structural gap as Q-money-8), and Bendl's claimed end
date (1999-07-28) conflicts with the source's own history page (2002-12-31). NOT applied.
Consequential: PRaK is a municipal rail SPV — any future re-point MUST reclassify the tie
`steward` (mayoral ex-officio appointment), or the console would present a public appointment as
a private conflict against a named sitting MP.

## C10 [effort batch 003 → money] — the "OSVČ" false-edge class (49/260 edges)

IČO 04627695's ARES obchodniJmeno is literally "OSVČ" (a registered micro party, Agrární
demokratická strana). kg-money-ingest's exact-name pick linked **49 of 260** ties to it — every
self-employed MP (independently flagged by 6/7 isolated army groups; orchestrator write revealed
the true repo-wide count, ~5× the army sample). All 49 annotated `false_edge_suspected` (pass
21). contractCzk 0 throughout, so no money totals inflated — but they are false accusatory
edges. Fix (money batch 004): generic-token blacklist ("OSVČ", "advokát", …) before the
exact-name pick + purge. HARD BLOCKER on money-crossover surfaces until then.

## C11 [effort batch 003] — Sonnet's money failure mode INVERTED vs batch 002

Batch 002 found over-claiming; batch 003's Opus verification found systematic UNDER-claiming:
"no personal link found" asserted via ARES's plain /ekonomicke-subjekty/ endpoint, which never
contains officers — factually clearing 5 MPs of documented (some currently-active) register
roles (Válková, Hladík, Bartošek, Hrnčíř, Pařil). New kernel doctrine: never assert ABSENCE of a
company tie without a /ekonomicke-subjekty-vr/{ico} lookup.

## C12 [law batch 004] — "collision backlog CLOSED" is scoped-true, headline-false

The 72-pair backlog closed against the 150-edge `amends` topology that the same batch's
regeneration replaces (bill-pairs sharing a statute: 88 → 436). Restated: closed against the
pre-regen topology; reopens at ~5× on apply (~170 partition-surviving pairs expected, ~half
historically confirm). Also corrected: batch-003's claim that no confirmed collision touches
sponsor money — 2 confirmed-collision bills DO carry sponsor-money flags.

## C13 [effort batch 004] — two blocking omissions survived even the rewrite pass

Foldyna carried a second undisclosed historical company tie; Výborný's Gymnázium Pardubice
statutory role (2012–2022, the entity behind his 9.25M CZK figure) had been wrongly cleared
since batch 003. Both caught by the second verification layer (direct VR curl + Opus), both
fixed before persist. Lesson: money-touching rewrites get TWO independent verification layers.

## C14 [money batch 005] — a fabricated detail survived from batch 002 to batch 005

The Okamura dossier carried a fabricated ownership-successor detail that propagated unchallenged
through three batches until the independent Opus verification layer re-fetched the registry
(plus: a source labeled "independent" that wasn't, and a mis-dated event). All corrected; the
lead landed at medium confidence, pending_review. This is the first confirmed multi-batch
fabrication survival — and the strongest argument yet for P51's two independent layers on every
money-touching claim: the FIRST layer had passed this.

## C15 [effort batch 005] — CRO access assumption corrected

Batch-004's probe implied cro.justice.cz might be fetchable; batch-005 established it requires a
manually-approved, per-person, ~30-day Ministry of Justice process — outside autonomous-ingest
authority (user-gated). volby.cz/ČSÚ is the buildable employment-signal source instead.
