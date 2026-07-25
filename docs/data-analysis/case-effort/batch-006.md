# Batch 006 — population closed at 207/207, the committee bug re-root-caused, public copy made a gate

*Case ② Effort · 2026-07-25 · fleet mode (money/law/kiosek executors concurrent in the same tree)*

The last 42 MPs. Coverage is now **207/207 dossiered** — the population is enumerated and the
loop drops to staleness-driven mode. Three things make this batch worth reading beyond the
coverage number: a 5-batch-old bug was root-caused *again* and the previous root cause turned out
to be wrong; a public-render defect that batch 005 had written a prose lesson about recurred at
25× scale and was converted into code; and the two-layer money gate reversed two false clearances.

---

## 1. The `extract-dossiers.ts` committee bug — batch-005's diagnosis was wrong

**Batch 005 concluded**: the mismatch between a dossier's `committees[]` array and the
`committee_count` prop was an effort-owned extractor bug that "excludes Podvýbor + ověřovatel
roles". That was recorded in the ledger, the handoff, `patterns.md` and `frontier.md`, and 21
dossiers' escalation claims were rewritten on the strength of it.

**Batch 006 verified it before building on it, and it does not hold.** Probing the copy:

| claim | reality |
|---|---|
| `committee_count` counts Podvýbor seats, extractor drops them | **430 Podvýbor organs exist; ZERO PSP10 memberships reference any of them.** Neither side ever counted them — Podvýbor was never the cause. The stated *mechanism* was also wrong twice over: `/v[ýy]bor|komis/i` **does** match the string "Podvýbor"; what actually keeps subcommittees out of `influential_in` is the direct-child-of-chamber filter (all 430 hang off 125 parent committees, never off the chamber). Moot either way, given zero memberships. |

The actual divergence is two independent mechanisms, measured over all 207 persons:

1. **Delegace (39 MPs).** `COMMITTEE_ORGAN_TYPES` in `lib/analysis/contribution.ts` includes
   `"Delegace"`, so `committee_count` counts delegation seats (86 PSP10 memberships). The
   `influential_in` edges the extractor read are built by `kg-compute.ts` behind the filter
   `/v[ýy]bor|komis/i`, which does not match "Delegace". Invisible to the old extractor.
   **This divergence is still live in `kg-compute.ts`**, which keeps its own forked copy of the
   committee-type test — outside this case's boundary, escalated in the handoff.
2. **Duplicate membership rows (121 MPs — the dominant cause).** psp.cz stores a leadership seat
   as **two** rows on the same organ: a `kind:"member"` row and a `kind:"function"` row
   (251 of 1062 PSP10 person-organ pairs). `committee_count` counts membership ROWS, so it counts
   such a body twice; `influential_in` dedupes to one edge per (person, organ) at max role. This
   is the mechanical source of the "counter is exactly 1 higher than the documented list" pattern
   army agents kept reporting across five batches.

**Fix**: `committees[]` is now rebuilt from the raw membership rows through the exact
`isCommitteeSeat` predicate `computeContribution` uses (both predicates exported from
`contribution.ts` with a comment forbidding a third fork), and carries `role`, `leadership`,
`fromAt`, `toAt`, `current`. Verified **0/42 mismatches** this batch and 0 across all 207 in the
probe; `extract-dossiers.ts` now prints a mismatch count on every run so a future regression is
loud rather than rediscovered by an army agent.

**Consequence that is NOT ours to fix**: `committee_count` genuinely double-counts any body where
an MP holds a function — a defect in the deterministic index itself. Case gate (a) forbids this
loop from touching `computeContribution`, so it is **escalated in the handoff, not fixed here**.
The extractor deliberately reproduces the double-count so an analyst comparing the array against
the prop never sees a phantom mismatch; the *profile page* deduplicates for render (§3).

**Lesson**: batch 005's own pattern entry said a recurring anomaly deserves a root-cause trace at
its next occurrence. It got one — and produced a confident, specific, wrong answer that three
vault files then cited. A root-cause trace needs the same verification bar as any other claim.

---

## 2. Army — 42 MPs, 9 Sonnet groups, gate 42/42

Triage over the 42-MP remaining pool. Lens composition confirms exhaustion: **27/42 (64 %) pure
high-triage filler**; `top` 6, `bottom` 4, `divergence` 6, and **absentee / quiet-workhorse
(both flavours) / contested produced ZERO** — every sharp lens is empty.

- Gate **42/42 PASS, 0 DROP** (after the two driver fix passes in §3 and §4). 146 citations.
- Mean signal **0.405**, continuing the monotone decline (§5).
- Money-touching: 8 of 42, all routed through the mandatory dedicated Opus layer (§4).

**Cross-cutting leads converged independently across groups** — the same defects were reported by
agents that never saw each other's work, which is what makes them credible:

| lead | independently reported by |
|---|---|
| Subcommittee (Podvýbor) memberships absent from the data entirely, incl. subcommittee *chairs* | D, E, F, H, I |
| Duplicate identical row in `committees[]` for one body | B, F, G, I |
| `leadership_count` misses club leadership (předseda/místopředseda klubu) and subcommittee chairs | C, E, F, H, I |
| External institutional oversight seats (VZP, SZIF dozorčí rady) captured nowhere | A |
| Broad multi-party bills (e.g. tisk 87, ~40 co-signers) make `bills_authored` a poor effort proxy | E, F |

The first three are **ingest-scope gaps outside this case's boundary** — escalated, not touched.

---

## 3. The public-copy defect: a prose lesson that had to become code

`effort_notes`, `effort_public_role` and `effort_bill_focus` render **verbatim** to voters on
`/poslanec` (via `DossierSection`, and `effort_public_role` again via `LowScoreReasonBadge`).

Batch 005 found 4 profiles leaking pipeline narration into these fields and wrote a `patterns.md`
lesson: *"public-render fields need a 'would I show this to a voter' check, separate from
factual-accuracy checks."* Batch 006 scanned all 42 dossiers and found **99 field-instances across
42/42 MPs** — raw prop names (`committee_count`, `bills_authored`), pipeline field names
(`sponsoredBills`, `contributionPsp9`), internal case references ("Case ①"), gate-rule citations
("gate (e)"), batch self-references ("v tomto vzorku"), API mechanics ("endpoint", "REST",
"<ICO>"). Every statement was *true* — which is exactly why an accuracy-only gate passed all 99.

The lesson did not survive contact with a new army, so it is now **executable**:
`publicCopyViolations()` in `gate.ts` (**Q-effort-14**) is a **hard DROP**, not a warning. All 42
dropped on first run; all 42 were rewritten as reader copy and re-gated clean.

Nothing was discarded: removed internals moved verbatim into a new **`effort_analyst_note`** prop
(39/42 carry one), which is namespaced, gate-legal, and **rendered nowhere** — the analyst/reviewer
channel the dossier layer never had. This honours the kernel's no-silent-truncation rule while
fixing the render.

A second, related defect: **10 MPs carried `effort_low_score_reason: "unknown"`**, which renders a
public badge reading *"Neobjasněno — nízké skóre bylo prověřeno, ale příčina nebyla dohledatelná"*
— on MPs including the batch's **highest** scorer (Papajanovský 82.9) plus 80.6, 80.4, 77.3. A
low-score corrective applied to MPs who have no low score. All 10 removed. Batch 005 removed 9
fields for closed-vocabulary misuse; this is the same class recurring, and it argues the field
needs a score precondition in code, not just a vocabulary check (steering item).

---

## 4. Money — the P51/C13 two-layer gate reverses two false clearances

8 money-touching dossiers → dedicated Opus verification (`batch-006-opus-verification.json`),
which re-fetched raw ARES VR JSON for all 18 IČOs and walked the full historical officer records
(`vznikClenstvi`/`zanikClenstvi`, not the current snapshot), cross-checking every hit on birth date.
**20 entities re-verified; 4 disagreed with the army. Verdicts: 2 BLOCKING / 5 NEEDS_CORRECTION /
1 CONFIRMED.**

**BLOCKING — Jan Jakob (TOP09).** The textbook C11 false clearance. The army wrote that he appears
"v žádné roli" at Operátor ICT, a.s. (884.86 M CZK). He was **a member of its supervisory board,
19. 12. 2018 – 31. 12. 2020** (birth date and Roztoky address both exact-matching). The army had
enumerated only the *currently* registered board. **Symmetry held in the correction**: the seat
ended 19 days before he first entered the Chamber, so there is no mandate overlap and the text must
not — and does not — imply one.

**BLOCKING — Jiří Horák (KDU-ČSL).** VR dates were flawless, the *arithmetic* was not: the army
computed against "entry to the Chamber (October 2025)", but Horák has been an MP since 9. 10. 2021,
so his board seat at Vodovody a kanalizace Vyškov ran **~2.5 months concurrently with his mandate**.
The sentence denying any concurrency is false and was deleted. Kept proportionate: the contract
date is unknown, so this is a documented overlap, **not** a proven conflict.

**CONFIRMED — František Petrtýl (ANO2011)**, the batch's strongest finding, held at field level:
four *active* ties (no `datumVymazu`) — SPARING MB (jednatel + 50 %), F.M.S. Consulting (33 % owner,
correctly *not* jednatel), COMBIN BOHEMIA (sole-acting jednatel, correctly no personal stake),
GEMA MB (jednatel + 50 %) — running concurrently with a mandate held since 3. 1. 2017.

**Systemic root cause the gate identified** — more valuable than any single catch: the army's
dominant error was *not* a bad source (it used the VR endpoint correctly, and its date extraction
was accurate in 6 of 8 dossiers). It was the assumption that **every mandate began 4. 10. 2025**,
when 6 of these 8 MPs served earlier terms. That single assumption produced both BLOCKING findings
and most corrections. Hard rule proposed for Case ①: never compute concurrency against the current
term; always resolve the *first* mandate from psp.cz `o=6..o=10`.

**Two material findings the army missed**, recorded as sourced LEADs for Case ① confirmation, not
as settled facts:
- **GEMA MB / Petrtýl** — the 16 575 162,54 CZK figure is an **aggregate** (180 contracts, ~186 M
  CZK), not one untraceable contract; the dominant counterparty is the city of Mladá Boleslav. And
  the company he half-owns and directs **donated to ANO 2011 in every year 2016–2025, ~946 500 CZK**.
  A firm living on city contracts funding the party it its owner sits for is a public-role fact, and
  it was absent from the dossier entirely.
- **AGROCENTRUM JIZERAN / Pražák** — ~154 M CZK across 153 subsidy records from MZe and **SZIF**,
  the very fund on whose supervisory board Pražák has sat since 25. 3. 2026. The **subsidy channel,
  not the 2.84 M CZK contract, is the actual mechanism** of the conflict — and his board seat is
  unbroken since 2003, concurrent with a mandate for ~4.8 years, not 9 months.

All corrections were applied **in place** (batch 005's failure was appending a correction beside the
error) and then **independently audited by the driver** against a pre-correction snapshot: **8/8
verified**. One audit "failure" was a bug in the *audit regex* — Czech declension
(`příspěvkovou organizaci` vs `příspěvková organizace`) — not a missing fix; noted because it is the
same morphology trap that produced a gate false positive in batch 005.

**Positive symmetry, stated with equal weight**: of 8 money-touching MPs, only Petrtýl carries
active concurrent commercial ties. Kučera's role ended 2005; Tureček's 2003; Rakušan's single active
tie is a non-commercial local political association with zero recorded money flow; Brázdil's ended
2016. Jakob's is now documented but ended before his first mandate. Milan Brázdil's dossier also
contains the batch's best piece of epistemics, preserved verbatim: Vojenská nemocnice Olomouc is a
státní příspěvková organizace structurally **outside** the commercial register (the only one of 18
IČOs returning no record), so it is explicitly recorded as **not verifiable this way — not
"cleared"**.

---

## 5. Convergence — the rule was unenforceable, and the honest answer is "moot"

The kernel's step 8 says *K=3 consecutive batches under the signal-yield threshold → declare
coverage*. **That threshold was never pinned to a number anywhere in this repo.** The
"threshold recalibrated for the V2 scale" comment in `triage.ts` — which prior steering pointed to —
is the **componentDivergence lens cut (0.9)**, an unrelated quantity. Batch 005 reasoned about the
rule in prose and explicitly deferred the call. An unenforceable rule is one that silently never
fires, so batch 006 pinned it: `SIGNAL_YIELD_THRESHOLD = 0.50` in `triage.ts`, evaluated in code,
printed every run.

Signal history: **0.771 → 0.744 → 0.500 → 0.500 → 0.458 → 0.405**

Strictly under 0.50: **b5 and b6 only → K=2 of 3. The yield rule does NOT fire.** It is not forced,
and the threshold was not back-fitted to make it appear to.

**But the rule is an early-stop rule, and it is moot**: batch 006 dossiered the last 42 of 207, so
**coverage is complete by enumeration**. Coverage is declared on that basis, honestly labelled — not
on a convergence rule that did not trigger. The lens evidence (64 % filler, every sharp lens empty,
six batches of monotone decline) independently corroborates that continuing to grind the same lenses
would have yielded little.

**Ledger accounting is deliberately two-part**: 207/207 *dossiered* (army + gate complete), of which
127 at stage `signal` and **80 still at `triaged`** — batches 004/005 are gated and handed off but
not yet persisted by the orchestrator. That is outstanding persist debt, not missing analysis, and
`finalize-ledger.ts` now prints both numbers so neither can be quietly overstated.

---

## 6. Manifestation check (kernel step 6) — one real gap found and fixed

Verified every prop this case writes is actually consumed:

| prop | reader | render | verdict |
|---|---|---|---|
| `effort_work_themes`, `effort_bill_focus`, `effort_notes`, `effort_data_flag` | `getProfileData.ts` | `DossierSection` | ✅ consumed, graceful-null |
| `effort_public_role` | `getLeaderboardData.ts` | `DossierSection` + `LowScoreReasonBadge` | ✅ |
| `effort_low_score_reason` | `getLeaderboardData.ts` | `LowScoreReasonBadge` | ✅ (misuse fixed §3) |
| `effort_tenure_*` | `getProfileData.ts` | `TenureNote`, `TenureTrendGate` | ✅ |
| `effort_workhorse_flavour` | `getLeaderboardData.ts` | `WorkhorseBadge` | ✅ |
| `effort_analyst_note` (new) | — | **none, by design** | ✅ intentional |

No prop-name drift, no silent swallow, no orphaned UI field. `hasDossierProps()` correctly
excludes closed-vocabulary props from the "has a dossier" test. `serverExternalPackages:
["@electric-sql/pglite"]` — the pause retro's decisive fix — still present in `next.config`.

**The one real gap**: `/poslanec`'s committee section had the *identical* bug as the dossier
extractor — it also read `influential_in`, so it dropped Delegace seats and, carrying no
`fromAt`/`toAt`, rendered a seat vacated for a ministerial post as still active. Fixed inside
boundary: rebuilt from memberships, **deduped by organ at max role** (the render must not show one
committee twice, even though `committee_count` counts it twice), past seats sorted last and
de-emphasized. This was found by verification, not assumed — and is the only thing built this batch;
nothing was constructed merely to demonstrate activity.

---

## 7. Metrics

| metric | value |
|---|---|
| units | 42 (population closed: 207/207 dossiered) |
| gate | 42/42 PASS, 0 DROP (after 2 driver fix passes) · 14 Q-effort-11 warnings, all inspected, all legitimate |
| mean signal | 0.405 (b1→b6: 0.771 → 0.744 → 0.500 → 0.500 → 0.458 → 0.405) |
| army composition | 27/42 (64 %) pure high-triage filler; absentee/quiet-workhorse/contested lenses all empty |
| citations | 146 |
| money dossiers | 8 → 20 entities re-verified → 2 BLOCKING, 5 NEEDS_CORRECTION, 1 CONFIRMED |
| Opus calls | 2 (money verification, reflection) + 1 Sonnet correction-application pass |
| build (R=1) | Q-effort-14 public-copy gate · committees rebuilt (extractor + profile render) · `finalize-ledger.ts` · convergence rule made executable |
| `npm run check` | effort-owned paths green (264 tests, typecheck + lint clean); **repo-wide lint FAILS** on `lib/ingest/sources/dataor.ts` (2 errors, sibling loop's file, outside boundary) |
