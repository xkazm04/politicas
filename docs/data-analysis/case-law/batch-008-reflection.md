# batch-008 reflection pass (Opus, maximum depth) — this batch's own deliverables

**Date:** 2026-07-26 · **Scope:** internal consistency, self-serving framing, scope/dispatch,
manifestation, fleet hygiene, and a spot re-read of the close-read classifications. A separate
adversarial audit is re-deriving the F1/F2 payload byte-level in parallel; I deliberately did not
re-litigate the census extractor, and I take the edge-level arithmetic only far enough to check
that the batch's own artifacts agree with each other.

**Read-only.** No file in this repo was modified except this one. No `.pglite` was opened at all
(the live-graph state below is established from the committed apply report and commit `257e723`,
not from a store read). All verification was `git`, JSON set-math, and NFC-normalized grep over the
already-cached bill text in `.data/law-collision-cache/`.

---

# VERDICT: **NOT ready as reported.**

Three material defects, one of them a **false `confirmed` collision classification** that would
become a public forensic claim about two named bills, and one of them the batch-006/007
stale-figure bug class **reappearing one level up**: not a hardcoded number inside a file this
time, but an entire artifact family (regen stats, impact note, churn table, deletion-allowlist
comments) computed against a baseline the orchestrator superseded a day earlier.

The underlying engineering is good. The F1 fix is precisely the fix the round-2 audit specified,
with a real improvement on it; the edge delta is exactly `−5 F2 / +1 F1` and nothing else; the F2
deletion payload is the strongest artifact this case has produced — per-edge re-verified excerpts,
named false-edge class, real targets listed as unaffected, and an honest admission that the
union's own founding worked example was itself a false edge. The P52 abstention is honest and
correctly reasoned. What is not ready is the **reporting**: the batch describes a graph that no
longer exists, claims a re-triage it did not perform on the object that matters, publishes one
close-read verdict that its own evidence does not support, and does not answer the kernel's step-6
manifestation question at all.

---

## A. HEADLINE — pair `90-221` is classified **confirmed** on a comparison of one bill with itself

`collision-close-reads-batch008.json`, pair `90-221` (218/2000, rozpočtová pravidla), reasoning:

> "§ 14 odst. 1: the two bills' excerpts are **VERBATIM IDENTICAL** (`V § 14 odst. 1 se za slovo
> „předpis“ vkládají slova „nebo program podle § 12 odst. 1 písm. a)“. 2. Za § 14q se vkládá nový
> § 14r…`) — both bills propose to insert the EXACT SAME text at the exact same location. This is
> a genuinely novel finding class for this case … the §14 duplicate alone justifies CONFIRMED."

**Tisk 90's cached text does not contain that string, or any part of it.** NFC-normalized,
whitespace-collapsed counts over `.data/law-collision-cache/tisk-{90,221}/*.txt`:

| probe | tisk 90 | tisk 221 |
|---|---|---|
| `za slovo „předpis“` | **0** | 1 |
| `V § 14 odst. 1` | **0** | 1 |
| `Za § 14q` | **0** | 1 |
| `14r` | **0** | 4 |

The source of the error is visible in `collision-report-v2-008.json` itself. For this pair the §12
entry's `excerptB` and the §14 entry's `excerptB` are two overlapping windows onto **the same tisk
221 instruction block**; their common substring is exactly the string quoted as "verbatim
identical". Tisk 90's actual §14 excerpt is unrelated (`… b) údaje podle § 14 odst. 4 písm. a) až
e), c) stejnopis rozhodnutí o poskytnutí dotace …`). The pair was read by comparing bill 221's two
excerpts with each other instead of A against B.

Reading the pair's three shared §s as they actually stand: §12 — tisk 90 amends odst. 4, tisk 221
only *cites* § 12 odst. 1 písm. a) inside its §14 clause; §14 — different provisions entirely;
§44a — tisk 90 edits odst. 3, tisk 221 edits odst. 11. That is **incidental**, or at the outside a
weak coordination risk. It is not confirmed.

Consequences:
- `ledger.json → batch008CollisionRecheck.closeReadClassification.confirmed: 4` should be **3**
  (and `incidental: 3` → 4), as should the same counts in `collision-close-reads-batch008.json`.
- The "genuinely novel finding class — a literal duplicate-amendment pair" claim rests on two
  cases; **one of them evaporates.** The other survives (§B below), so the class is real, but it
  is n=1, not n=2, and should be reported that way.
- `/zakony/kolize` publishes `confirmed-collision` pairs by bill number as public forensic leads.
  Had this file been wired to the loader this batch, tisk 90 and tisk 221 would carry a public
  claim of a duplicate insertion that does not exist in tisk 90.

**The method gap this exposes is the finding worth carrying.** The case already has the doctrine
that would have caught it — P49, *presence claims verify by grep, not by a second model read*. It
was applied to the F2 deletion payload (correctly, and to that payload's great credit) and not to
the close-reads. A close-read that asserts "identical", "duplicate" or "the same text" is a
presence claim about two documents and should be gated by a five-line script asserting the quoted
string occurs in **both** bills' cached text before the classification is written. Note that
neither dispatched Opus agent was scoped to catch this: the adversarial audit is aimed at the
F1/F2 payload, and a reflection pass finds it only by re-reading excerpts, which is not its
guaranteed remit.

### A2 — pair `7-221`: right verdict, wrong headline reason

The reasoning leads with: "§ 4: BOTH bills insert a NEW odstavec numbered `8` into § 4 with
DIFFERENT content (a numbering collision on insertion — the clearest confirmed-collision shape)."
Neither bill does. Both insertions are into **§ 48**:

- tisk 7: `V § 48 se za odstavec 7 vkládá nový odstavce 8, který zní: „(8) Zadavatel a) podle § 4 odst. 1 …`
- tisk 221: `V § 48 se za odstavec 7 vkládají nové odstavce 8 a 9, které znějí: „(8) Zadavatel podle § 4 odst. 1 …`

The `§ 4` partition hit is a citation inside those §48 insertions — precisely the "citation-only
artifact" incidental class this case's own loader documents. The real §48 collision is *stronger*
than the close-read describes it (it calls §48 merely "near-identical wording … suggesting the two
bills are drafting over the same package", when it is the same numbering collision the §4 sentence
claims). And the third leg is exact and independently verified verbatim: tisk 7 `V § 67 odst. 3 …
se číslo „9“ nahrazuje číslem „10“` vs tisk 221 `… číslem „11“`. **Classification stands;
one-third of its stated evidence is misattributed.**

### A3 — a conservative error, in credit's direction

`111-207` on 40/2009 § 88 odst. 2 písm. c) is classified `coordination_risk` on the grounds that
the two bills touch different literal substrings. Reading the four §88 instructions side by side,
tisk 111 replaces the bare numerals `„4, 5“ → „5, 6“` inside that písmeno while tisk 207 rewrites
`„nebo s jedy podle § 283 odst. 4“ → „, s jedy nebo se rtutí podle § 283 odst. 5“` — i.e. both are
shifting the same predicate-offense subsection references, each assuming the pre-edit text, with
tisk 111 anchored on a bare-numeral string that tisk 207 is rewriting. That is arguably
`confirmed`. Flagged for completeness: the close-reads err in **both** directions, and this one
errs cautiously.

I spot-checked five of the twelve (`90-221`, `7-221`, `56-234`, `102-111`, plus the `7/111/207/213`
§88 quartet). `56-234` holds exactly as written — both bills genuinely contain
`Za § 17c se vkládá nový § 17d` and the identical opening sentence
(`Přestupky podle tohoto zákona projednává inspektorát, s výjimkou přestupků a) podle § 17a odst. 1
písm. b) …`), and the §17a insert-new-odst-3 vs edit-existing-odst-3 collision is real. "Duplicate
/ near-identical" is an **accurate** read there, not an overstatement. `102-111` holds too, and is
appropriately hedged ("if tisk 102 applies first"). So: one of five wrong, one of five partly
wrong, one arguably under-called. The remaining seven were not re-read.

---

## B. The whole regen/impact/churn artifact family is computed against a superseded baseline

**Batch-007's regeneration was applied to the live graph on 2026-07-25** — commit `257e723`
("APPLY the amends regeneration — 187 law nodes, 581 edges (pass 30)"), corroborated by
`payloads/batch-006-apply-report.json` (`mode: "commit"`, `edgesApplied: 581`, 435 inserts + 146
merges, then 4 repeal edges retired). Live today: **288 law nodes, 581 `amends` edges.**

Batch-008 ran against `.pglite-copy-law-008`, a copy of `.pglite-copy-law-005` — the **pre-apply**
150-edge store. Everything downstream inherited that baseline and states it as current fact:

| artifact | says | truth |
|---|---|---|
| `batch-008-amends-regen.json → stats.currentAmendsEdgeCount` | `150` | 581 |
| `… stats.edgeCountDelta` | `427` | net **−4** (+1 F1, −5 F2) |
| `batch-008-amends-regen-impact.md` headline | "Edge count: **150 (current) → 577 (regenerated)**, Δ+427" | −4 against live |
| `… impact.md` churn table | "Before top 10 (**current 150-edge graph**)" | that state is a day old |
| `diff-amends-regen-deletions.ts` new allowlist comment | "already live in the **150-edge graph**" | 581-edge graph |
| `ledger.json → totals.amends` | `150` | 581 |
| `ledger.json → totals.amendsRegenPrepared` | "still **NOT applied** to live graph" | applied, pass 30 |

**The batch contradicts itself inside its own deliverables.** `batch-008-f2-deletion-payload.json`
gets it right — "diff-amends-regen-deletions.ts PASS 0 unallowlisted deletions against the **live
581-edge graph** (1 added = F1, 5 dropped = F2, all allowlisted)" — so the driver ran the diff
against live, saw 581, and correctly framed the operational delta as 6 edges, while the sibling
artifacts continued to describe a 427-edge regeneration of a 150-edge graph.

This matters operationally, not just cosmetically. An orchestrator reading `edgeCountDelta: 427`
and "150 (current) → 577" would reasonably conclude the regeneration is still unapplied and
re-apply 577 edges wholesale, when the entire remaining action is `+1 / −5`. The honest framing —
which the batch has all the evidence for — is: *"live is 581; batch-008 proposes exactly six
changes to it."*

---

## C. "Churn re-ranking DONE and verified" — overclaimed three ways

**(i) It is a byproduct, not new analysis.** `batch-007-amends-regen.json` already carried a
`churnRanking` block. Diffing the two: `beforeTop10` is byte-identical, and `afterTop10` differs in
exactly one row (89/2012, 7 → 6 — the tisk 36 F2 deletion). "40/2009 takes #1 with 12 edges" was
batch-007's result, and before that it was batch-006's *prediction* ("re-triage the moment the
regen applies — churn ranking flips, 40/2009 takes #1"). The ledger's own wording ("matching
batch-007's own predicted re-ranking") is a hair away from admitting this. Worse, given §B the
"after" state is **already live**: this is not a pending re-ranking, it is a description of the
current graph.

**(ii) Not one of the 141 `rows` was touched.** `git diff` on `ledger.json` is additive only — four
new `totals` blocks, nothing else. The rows are still on the 150-edge topology, and they are now
wrong for exactly the bills this batch spent its analysis on:

| tisk | ledger row today | reality after pass 30 |
|---|---|---|
| 7 | `amendedLaws: []`, `amendsCount: 0`, `triageScoreV2: 0` | 4 `amends` edges incl. 134/2016 and 40/2009 |
| 90 | `amendedLaws: []`, `amendsCount: 0`, `triageScoreV2: 0` | amends 218/2000 (its own confirmed-pair statute) |
| 102, 213 | same, `triageScoreV2: 0` | amend 40/2009 |
| 111, 207 | `maxTargetChurn: 6` | 12 |

The kernel calls the ledger "the resumable state … no prior-session context needed" and the triage
queue the thing that keeps the army in value order. A batch that reports "re-triage DONE" while
leaving four of the bills at the centre of its own findings at `triageScoreV2: 0` has not
re-triaged; it has re-printed a top-10 statute table into a payload.

**(iii) The deferral bundles hard work with easy work and defers both under the hard one's
justification.** From `triage-002.ts:198-226`:

```
sevBand       = severity × 5_000_000     // only where a verdict exists
churnBand     = maxTargetChurn × 100_000 // "PRIMARY"
sectorAdjBand = adjacent ? 50_000 : 0    // "SECONDARY"
moneyLogBand  = log10(1+czk) × 200       // ≤ ~2_000
amendsBand    = amendsCount × 500
```

Only `sectorAdjBand` — **50 000, less than one churn point** — needs the §-level sector rework the
batch-004 warning is about. The dominant term needs nothing but the edge set this batch already
produced. Re-running `triage-002.ts` against the applied live graph would refresh
`amendedLaws`/`amendsCount`/`maxTargetChurn`/`triageScoreV2` on all 141 rows and leave exactly one
bounded, disclosable stale band. So: the deferral is **honest about sector-adjacency and dodging
on the row refresh**. It reads as if the whole recompute were blocked; it is not, and the blocked
part is worth 4% of the top score.

Also worth naming: this item has now been carried as batch-006 P4 → batch-007 → batch-008. Per the
kernel's deferred-three-batches rule it cannot roll again without landing or being explicitly
retired.

---

## D. Collision coverage arithmetic does not close (off by 4)

`collision-close-reads-batch008.json → coverage`: `previouslyReadAcrossAllBatches: 51` +
`closeReadThisBatch: 12` + `remainingUnread: 117` = **180 ≠ 176**.

I re-derived it from the payloads. Union of every prior close-read file (batches 002/003/004/005),
keyed on `(lawRef, {billA,billB})`, against `collision-report-v2-008.json`'s 176 ranked pairs:

- distinct prior pairs across all batches: **51** — the published figure is not invented;
- of those, surviving into the new 176: **47** (4 died in the new partition);
- therefore unread before this batch: **129**, and after: **117**.

So `remainingUnread: 117` is **correct**, and the `method` string's own chain
("129/176 unread total; 12/129 read this batch, 117 remain") is internally exact. The single
defective field is `previouslyReadAcrossAllBatches`, which is scoped to all history while its three
neighbours are scoped to the 176. Fix: add `previouslyReadWithinThis176: 47`, or rename. Minor —
but it is the same reader-misleading shape the last two reflections caught, and a reader doing the
obvious sum lands on a contradiction.

On the framing question the brief raises: **"12/176, 117 remaining, disclosed not dropped" is
honest**, and if anything under-claims — 59 of the 176 have now been read, not 12. The
"topic-diverse unread pairs, not moneyLiteral-ranked" selection and the "driver, not a subagent
army — effort-budget decision" admission are both disclosed without spin. This part of the batch is
exemplary.

---

## E. Stale self-description in shipped artifacts — the batch-006/007 bug class, inverted

Last two batches the defect was *a number that looks updated but isn't*. Here it is the mirror
image: **prose mechanically refreshed from `007` to `008` that now describes events which never
happened in batch-008.** `measure-precision-008.ts`, `validate-amends-regen-008.ts`,
`fix-proposal-trigger-008.ts` and `collision-check-008.ts` are byte-for-byte copies of their
predecessors with only path constants (and a blanket `007`→`008`) changed. Consequences that
shipped into JSON:

1. `batch-008-precision-measurement.json → method`: "after a **batch-008 self-review** caught a
   stale count left over from an earlier pipeline iteration". That self-review was batch-007's.
2. `… → caveats[3]`: "**batch-008 independent-audit finding (N-D)**". N-D was batch-007's
   independent audit. **No batch-008 audit had run when this string was written** — the same
   payload's own `auditStatus` says so ("this batch's OWN F1/F2 fixes … have NOT yet been
   independently audited"). Both misattributions run in the self-flattering direction: they imply
   batch-008 performed a self-review and an independent audit it had not.
3. `collision-report-v2-008.json → method` is **batch-005's, verbatim**: "batch-005: partitioned
   §-overlap … re-run on the batch-005 post-ingest/post-regen topology (**collision-groups-005.json,
   574 amends edges** vs batch-004's 282-held/150-live)". Wrong batch, wrong source file, and an
   edge count (574) that matches no artifact in this case's history — it was already wrong in
   batch-005 and has now been re-shipped. `priorBatchReference` still points at
   `collision-report-v2.json`.
4. `batch-008-amends-regen.json → boundary`: "read-only against **`.pglite-copy-law-007`**", while
   `method` in the same file says `.pglite-copy-law-008`. Only `.pglite-copy-law-005` and
   `-008` exist on disk.
5. The same `boundary` directs the reader to "`docs/data-analysis/case-law/batch-008.md` and
   `handoff.md` for the full audit trail". **`batch-008.md` does not exist**, and `handoff.md` is
   still batch-007's (unmodified since 2026-07-25 14:34). This is precisely finding D of the
   batch-007 reflection ("dangling `batch-007.md` reference"), repeated one batch later.
6. `ledger.json → batch008F2Deletion.codeFix` cites "verified via `f2-title-gate-test.ts`" — that
   file is **deleted from the working tree** (`git status`: ` D`). It survives only inside an
   unrelated commit (§F). The named verification artifact is not re-runnable from the tree.
7. Ledger running totals not updated alongside the new blocks: `totals.amends` 150 (§B),
   `collisionPairsCloseRead: 38` (batch-005's +15 and this batch's +12 never counted; true ≥65
   reads over 63 distinct pairs), `amendsRegenPrepared` still "NOT applied".
8. `validate-amends-regen-008.ts:18` usage comment invokes `validate-amends-regen-007.ts`.

None of these changes an edge. Items 1–3 do change what a reader believes about how much
independent scrutiny this batch received, which is the class this reflection exists to catch.

---

## F. Manifestation check (kernel step 6) — **not answered anywhere, and the surface is one file away**

No `batch008*` ledger block mentions manifestation, rendering, or debt. The answer is:

**Nothing this batch produced renders.** F1's `+1` edge and F2's `−5` are prepare-only payloads;
the 629/176 collision universe, the 12 close-reads and the §88 N-way cluster are files on disk.
100% payload/ledger work, zero surface exposure — undisclosed.

Three things sharpen this from routine debt into a specific, cheap omission:

1. **`/zakony/kolize`'s loader is file-driven.** `features/lawwatch/getCollisionData.ts:196-212`
   reads `collision-close-reads{,-batch004,-batch005}.json` by name and has a `sourceBatchOf()`
   ladder capped at 5. Wiring `collision-close-reads-batch008.json` is a filename in a list plus a
   ladder case — the exact "the surface already exists, the data just isn't in it" shape the
   manifestation pause was created to stop. (It should not be wired **until** finding A is
   corrected — a false `confirmed` pair would render as a public forensic lead.)
2. **The 5 F2 false edges are public right now.** Because pass 30 applied the regeneration and
   `features/lawwatch/getLawData.ts:219` reads live `amends` edges from the store, tisk
   153/88/124/36/42's false targets render on `/zakony` and the per-bill dossiers today. The
   deletion payload's phrase "5 false public claims" is *literally* true, not prospective. The
   ledger does not say this, and it is the strongest argument for the orchestrator executing the
   deletion promptly.
3. **The live surface now carries a stale caveat.** `getCollisionData.ts:83-89` still tells users
   the batch-005 pairs came from a topology "**NOT yet applied to the live graph** (see handoff.md)"
   and cites "574→567 edges". Applied since pass 30. Product-code prose, user-visible, and a direct
   downstream consequence of the §B baseline error. `batchesRun: 5` and the "38 pairs close-read
   across 4 batches" header comment are stale in the same direction.

---

## G. Scope and dispatch — 2 Opus agents was right; no third trigger fires

**On the conditional top-signal trigger: it does not fire, and it should not be forced.** The kernel
arms it for *genuine severity* — a money-touching self-dealing finding. Nothing in the close-reads
reaches that bar:

- All four (three, post-§A) confirmed pairs are **drafting collisions**. This case's own loader
  states the doctrine plainly: "a legislative-DRAFTING-PROCESS finding, not an ethics or corruption
  finding. Nothing here implies wrongdoing."
- The sponsors carry nothing. Ledger rows: tisk 7, 90, 102, 111, 207, 213 all
  `sponsorContractCzk: 0` / `sectorAdjacency: false`. Tisk 221 is 62.9M CZK whose only tie is
  *Vodovody a kanalizace Kroměříž, a.s.* — a municipal utility, i.e. the exact class batch-001
  proved degenerate and the skill instructs excluding.
- The §88 N-way cluster is criminal-code confiscation drafting across four bills, three of them
  government omnibuses. Real, worth carrying, zero money adjacency.

So: **two Opus agents at maximum depth was the correct call, and a third for severity would have
been a misfire.**

Two qualifications:

- **The two money-adjacent statutes in the set deserve a cheap deterministic check, not an agent.**
  134/2016 (procurement — tisk 221's inserted §48(8) lets an authority exclude a bidder whose
  beneficial owner is a senior public official; tisk 7 inserts a competing §48(8)) and 218/2000
  (budget rules — tisk 221 inserts a §14r "Střet zájmů") are the most money-adjacent provisions
  this case has close-read. The proportionate spend is a deterministic cross-check of those bills'
  sponsor ties against sector adjacency — which is **exactly what the deferred re-triage would have
  produced** (§C). The deferral has a concrete, nameable cost.
- **A third pass was in fact needed — for verification, not severity.** §A's defect sits in the gap
  between the two dispatched agents' remits. The durable answer is not a third agent per batch but
  the deterministic guard in §A: no close-read may assert "identical/duplicate/same text" without a
  grep proving the string in both bills.

---

## H. Fleet hygiene — the commit anomaly (investigated; real, low severity, worth one line up)

**What is true.** `scripts/case-loops/law/amends-census.ts` (carrying the F1 fix) and the
since-deleted `f2-title-gate-test.ts` are in commit `9abfde1`,
*"feat(case-effort): unify the public-copy jargon rules — close the persist/render gap"*, authored
2026-07-26 17:21:30 +0200, `Co-Authored-By: Claude Fable 5`, `Claude-Session:
session_01V7dCe6Hc4DG4WBRHoMBrGA`. `git diff HEAD -- scripts/case-loops/law/amends-census.ts` is
**empty** — the committed content is byte-identical to the working tree, so nothing was altered or
lost. Also swept in: `batch-008-amends-census.json`,
`batch-008-amended-laws-full-proposal{,-v2}.json`, `batch-008-amends-regen.json`,
`batch-008-amends-regen-impact.md`.

**Timing.** `batch-008-amends-regen.json`'s own `generatedAt` is `15:21:11Z` = 17:21:11 local. The
commit landed at **17:21:30 — nineteen seconds later.** That is a race with a live fleet run, not a
review.

**It was not the law driver.** The driver's later outputs (17:22 deletion payload, 17:21–17:29
precision/collision artifacts, ledger) are all still uncommitted; the co-author trailer is a
different model on a different session, which also produced `ba1da0a` (context-map refresh) eight
seconds later and, before that, a long run of `feat(architect): …` commits. The kernel's fleet
"do not commit" rule was **not** violated by this case's driver.

**Innocent explanation, checked.** I looked for a scheduled/hook-driven checkpoint: there is **no
`.claude/settings.json`** in this repo, so no Stop/PostToolUse hook auto-commits. This is a
concurrent human-initiated session doing housekeeping commits with `git add -A`-style staging. And
the commit body **does disclose the sweep** — "Includes batch-007/008 census + baseline payloads
and the supporting one-off scripts." Nothing covert.

**Assessment: a real anomaly, LOW severity, worth one line to the orchestrator — not an alarm.** No
data harm. The three concrete costs:

1. **History now holds a partial, self-contradicting batch-008.** The 577-edge payload is
   committed; its precision measurement, F2 deletion payload, collision artifacts and ledger update
   are not. A checkout of `9abfde1` yields a batch whose payload references a `batch-008.md`,
   a handoff and a deletion set that do not exist there.
2. **A throwaway scratch file entered history and is now a pending deletion** — and `ledger.json`
   cites that very file as the F2 gate's verification artifact (§E.6). The named verification is
   reproducible only from a commit whose subject line is about a different case.
3. **It defeats the stated purpose of the rule.** The kernel's git row exists "so the orchestrator
   can review BEFORE history is written", and notes staging races "are only safe when one process
   touches the index". Both properties were lost here — by a process the rule doesn't currently
   address, because the rule is written at *case drivers*.

**Recommendation:** extend the kernel's fleet git row from "case drivers do not commit" to "**no
process stages the tree while a fleet window is open** — orchestrator and housekeeping commits
stage explicit paths, never `-A`". And whoever writes batch-008's handoff must not assume the
files above are uncommitted.

---

## I. What checked out clean (recorded with equal weight)

- **The F1 fix is exactly the audit's prescription, with a genuine improvement on it.** The audit
  proposed `nextCast = castRe.exec(operative)?.index ?? Infinity`; the shipped code bounds it to
  the block (`castMatch.index < end ? castMatch.index : Infinity`), which is strictly more correct.
  The rationale comment names tisk 215 and the mechanism.
- **The edge delta is exactly what is claimed, and nothing else.** Set-differencing batch-007's 581
  against batch-008's 577: removed = the five F2 keys (tisk 36/42/88/124/153); added =
  `bill:tisk:43337 → law:sb:280-2009` (tisk 215, F1). Zero other movement.
- **The regen stats are internally self-consistent**: 55 + 77 + 9 = 141 bills; 582 citations
  considered = 577 resolved + 5 unresolved; `distinctMissingLawStatutes: 5` matches the
  `missingLawNodeCensus` array; the universe is honestly **not** claimed closed.
- **The precision measurement reconciles with the payload**: 577 = 476 `census_full` + 101
  `title_fallback` (batch-007's 475/106, moved by exactly +1/−5); 573 high + 4 low; the four
  low-confidence edges are the same four batch-007 hand-verified as real.
- **The F2 deletion payload is the batch's best artifact** — per-edge cached-text excerpts, an
  explicit false-edge class, `realTargetsOfThisBillUnaffected` on every entry, `liveConfirmed`
  checked against the live store, and an unflinching note that the union's own founding worked
  example (tisk 88 → 360/2025) was itself the false edge. The allowlist comments carry the evidence
  inline.
- **The P52 abstention is doctrinally correct and honestly reported** — the signal is still
  unvalidated, was not used to order the sweep, and the reason a larger sample was not built
  (pair identity does not survive topology changes) is stated rather than elided.
- **An unclaimed precision dividend the batch could honestly report.** The partitioned universe
  went 186 → 176 with **10 lost and 0 gained**; every one of the 10 involves tisk 6, 63, 76 or 144
  — the bills whose false edges the census fix removed. Fewer candidate pairs on *more* edges is
  direct evidence the precision work is working. Nobody says so. (Relatedly, F1's recovered edge
  puts 280/2009 into a 3-bill group — 7, 64, 215 — that produces no §-overlap survivor.)

---

## Recommended minimum before this batch is reported as ready

1. **Re-classify pair `90-221`** (confirmed → incidental, or re-read it properly) and correct the
   classification counts in both `collision-close-reads-batch008.json` and `ledger.json`
   (`confirmed: 4` → 3). Fix `7-221`'s §4 reasoning to name §48. Consider re-calling `111-207`.
2. **Add the P49 guard to the close-read step**: a script asserting every quoted
   "identical/duplicate/same" string appears in **both** bills' cached text. Re-run it over the
   other seven unre-read pairs before any of this reaches a surface.
3. **Re-base every artifact on the applied live graph (581 edges / 288 law nodes, pass 30).**
   Fix `currentAmendsEdgeCount`, `edgeCountDelta`, the impact note's headline and "before" table
   caption, the allowlist comment, `ledger.totals.amends`, and `amendsRegenPrepared`. State the
   operational delta as **+1 / −5**, not +427.
4. **Refresh the 141 ledger rows** by re-running `triage-002.ts` against live: churn (the primary
   term) needs no §-level work. Keep the sector-adjacency deferral, but scope the note to
   `sectorAdjBand` (50 000) and disclose that it is the only stale band — and log the item as
   third-batch-deferred per the kernel rule.
5. **Fix the misattributed provenance prose** in `measure-precision-008.ts` (the "batch-008
   self-review" and "batch-008 independent-audit finding (N-D)" strings) and the batch-005 `method`
   string re-shipped inside `collision-report-v2-008.json`, plus the `.pglite-copy-law-007`
   boundary and the `validate-amends-regen-007.ts` usage line.
6. **Write `batch-008.md` and the batch-008 `handoff.md`, or stop referencing them** — and restore
   `f2-title-gate-test.ts` (or point the ledger at whatever survives), since it is cited as the F2
   verification.
7. **Answer the manifestation question in the ledger**: declare the debt, note that the batch-008
   close-reads need only a filename in `getCollisionData.ts` (gated on item 1), that the 5 F2 false
   edges are rendering publicly *today*, and that the loader's "not yet applied to the live graph"
   caveat and its `574→567` figure are now false.
8. **Fix `coverage.previouslyReadAcrossAllBatches`** — add `previouslyReadWithinThis176: 47` so the
   block sums to 176.
9. **Escalate the commit anomaly to the orchestrator as one line**, with the kernel amendment in
   §H — and do not assume the swept files are uncommitted when the handoff's commit plan is written.
