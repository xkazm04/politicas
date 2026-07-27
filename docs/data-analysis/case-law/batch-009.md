# Case ③ Law loop — batch 009 (2026-07-27)

Solo run (no orchestrator, no sibling case drivers active in this session). Analysis on
`.pglite-copy-law-009`, a read-only copy of the live store; **no live `.pglite` writes**.
Subagents were not dispatched — the operator instructions for this session forbid it — so the
army work in §3 was done directly by the driver, at correspondingly reduced volume. That is a
scope reduction, disclosed here rather than absorbed silently.

**Live graph read at start:** 577 `amends` edges, 288 `law` nodes, 141 bills, 27 gated forensic
verdicts (Czech since pass 33). Batch-008's F1/F2 payload **is applied** — the ledger claimed
otherwise for three batches.

---

## 1. The deferred re-triage — landed (batch-006 P4 → 007 → 008 → **009**)

The kernel's deferred-three-batches rule forbade a fourth roll. Done.

**Why it kept not happening is itself the finding.** `triage-002.ts` owns both the scoring and a
ledger writer that **replaces `ledger.json` wholesale**. Re-running it to refresh the rows would
have erased all 19 accumulated hand-written `totals.*` blocks — the P44/D1 wholesale-replace
failure the kernel warns about. The two obvious ways out were both wrong: re-running it destroys
history, and copying the scoring into a `*-009.ts` script is precisely the copy-drift bug class
batch-008's own lessons flagged (four of its scripts shipped byte-copied prose describing events
that never happened in that batch).

So the scoring was **extracted** to `scripts/case-loops/law/triage-core.ts` and is now imported by
both `triage-002.ts` (unchanged batch-002 semantics) and the new merge-preserving
`retriage-009.ts`. Neither can drift from the other. Scoring weights were deliberately NOT
touched — this is a refactor, not a re-weighting.

**Result — the ledger was badly stale, worse than the batch-008 reflection estimated:**

| | before | after |
|---|---|---|
| rows moved | — | **110 / 141** |
| bills with zero `amends` | 25 | **11** |
| `totals.laws` | 101 | **288** |
| `totals.amends` | 150 | **577** |
| `sectorAdjacencyHits` | 5 | **12** |
| `collisionCandidateGroups` | 29 | **150** |
| `collisionCandidateBills` | 71 | **117** |

The six bills the batch-008 reflection named as demonstrably wrong all moved: tisk 7
(`0 → 22` amends, score `0 → 1 211 000`), 90 (`0 → 9`), 102 (`0 → 12`), 213 (`0 → 7`), 111 and
207 (churn `6 → 12`, score `600 500 → ~6 204 000`). New top-10 pending head: tisk 64, 67, 7, 102,
213, 14, 189, 77, 69, 56.

**The one band still stale, scoped precisely:** `sectorAdjBand` — 50 000 against a top score of
1 273 500, under 4%. Sector-adjacency is still computed over a bill's whole amended-law set
rather than per amended §, per the standing batch-004 warning. Every other band is live-accurate.

`rebase-ledger-009.ts` additionally corrected four prose blocks that described a superseded graph,
each with a `batch009Correction` field saying what it used to claim and why that was wrong —
most importantly `amendsRegenPrepared.status`, which read "still NOT applied to live graph"
through batches 006–008 while the regeneration had been live since 2026-07-25.

## 2. P49 close-read presence guard — built, run over everything, **0 defects**

`scripts/case-loops/law/verify-close-reads.ts`. Motivated by batch-008's pair 90-221: published
as a `confirmed` collision asserting two bills carry "VERBATIM IDENTICAL" text that occurs in only
one of them (it compared tisk 221's excerpt against itself). Two Opus agents ran that batch and
neither was scoped to catch it; the doctrine that would have (P49) had been applied to that
batch's deletion payload but never to its close-reads.

- **E-CHECK** — the leading verbatim span of each `evidence.*Excerpt` must occur in its OWN bill's
  cached text. When it is absent from its own bill but present in the pair's other bill, the
  finding says so by name.
- **R-CHECK** — inside a sentence that asserts sameness and does not also mark a contrast, a
  quoted source span must be shared by ≥2 of the documents that sentence ranges over (the pair's
  two bills plus any other print it names by number).

**Result over the published corpus: 63 pairs, 99 E-CHECKs, 3 R-CHECKs, 0 failures, 4 unverifiable.**
No published close-read misattributes text to a bill. Recorded with the same weight a positive
finding would get.

**The guard was built by measurement, and that method is the transferable part.** Fire rate at
each revision, with every survivor hand-verified against cached text before the next rule was
written:

| revision | fails / checks | what the survivors actually were |
|---|---|---|
| whole-field compare | 106 / 102 (~100%) | degenerate — excerpts are `provenance: 'quote' -- analysis` |
| + quoted-span extraction | 180 / 298 | apostrophes in `tisk 4's` swallowed whole sentences |
| + possessive-safe quoting | 16 / 206 | plausible, still wrong |
| + primary-span, sentence scope | 7 / 103 | 4 diverged at analyst brackets `„40[0 000 Kč]“` |
| + elision/bracket splitting | 2 / 103 | both semantically sound (see below) |
| + contrast + third-bill scope | **0 / 103** | final |

The last two survivors are worth recording because both were *correct close-reads* my guard
misread: pair 85-88 quotes two wordings that its own sentence explicitly **contrasts** ("…at the
identical numeric slot, but with two different wordings ('X' vs. 'Y')") — verified, tisk 85
carries X and tisk 88 carries Y. Pair 7-90 asserts identity with a **third** print ("bill 90's
excerpt … is textually identical to bill 68's") — verified present in 68 and 90, correctly absent
from 7. A guard whose failures nobody has read is not evidence.

**Known limit, stated not hidden:** 12 of the 63 pairs (all batch-008's) carry no evidence excerpt
at all and 3 more quote nothing — unverifiable by construction. This guard cannot certify what a
payload never asserted. Requiring a verbatim span on every new close-read is what closes it.

## 3. Manifestation build phase — `/zakony/kolize`

### 3a. The presentation gate had moved one surface over, not been fixed

**44 of 44** close-read analyses rendered on `/zakony/kolize` were English analyst prose on a
`lang="cs"` public-accountability surface — measured by `lib/analysis/language-gate.ts`, the module
pass 33 built for exactly this. Same defect class as the 27 forensic verdicts, one surface over,
shipping *after* the kernel's presentation gate was written. Prose lessons do not survive contact
with the next army; only code does.

Fixed the way pass 33 fixed it: `collision-reasoning-cz.json` carries 44 Czech rewrites keyed
`<file>::<pairId>`, the loader applies `czechCopyOrNull` so anything still English is **withheld**
(never machine-translated, never partial), `CollisionsPage` shows the honest
`CZECH_WITHHELD_CZ` placeholder, and the page discloses `czechPendingCount`. The English originals
stay in the payloads as ground truth. A regression test now fails on the next English string.

Every rewrite carries over the §s, tisk numbers, statute refs, amounts and quoted Czech legal
strings unchanged; only connective prose was written. Hedges were preserved verbatim — no pair's
classification was re-litigated here. **One correction:** the Czech text of pair 56-234 drops its
English original's cross-reference to "tisk 90/221's § 14" as a precedent for the
duplicate-insertion class, because that finding was **retracted inside batch-008 itself**.

### 3b. "One filename away" was wrong

The batch-008 reflection recorded that wiring its close-reads was "a filename in a list plus a
ladder case". It was not. batch-008's payload spells its classifications `confirmed` /
`coordination_risk`; the four earlier payloads spell them `confirmed-collision` /
`coordination-risk`, and the loader filters on the latter. **Adding the filename alone would have
silently dropped all 12 pairs** — a failure indistinguishable from "that batch found nothing".
`normalizeClassification` now maps both spellings at the single point every payload is read
through. batch-008's 8 non-incidental pairs now render, including the 4-bill 40/2009 §88 cluster.

### 3c. False user-visible caveats removed

The loader was telling readers, in product copy, that the regenerated topology was "**NOT yet
applied to the live graph**" and citing "574→567 edges". Applied since pass 30; live is 577. Also
fixed: `batchesRun` was hardcoded `5` (now derived — correctly 6, and it cannot fall behind a new
payload again), and the header comment's "38 pairs across 4 batches" (now 63 across 001–008).
`postRegenTopology`, whose whole meaning was the false pending claim, is replaced by a neutral
per-pair source-batch chip.

`npm run check`: **typecheck + lint clean, 456/456 tests pass** (up 2 — the presentation-gate lock
and a derived-`batchesRun` assertion replacing a magic number).

## 4. Not done this batch — disclosed, not silent

- **The 117 unread partitioned collision pairs.** Untouched. This was the batch's planned army
  wave and it did not run, because subagent dispatch was unavailable this session and 117 pairs is
  not driver-scale work. It remains the natural next army task, and it should now run **behind
  `verify-close-reads.ts`**, with a verbatim span required on every pair — which would also close
  the 12-pair unverifiable gap §2 names.
- **Sector-adjacency §-level rework** — still deferred, now scoped to a single 50 000-point band
  and disclosed as the only stale term rather than blocking the whole refresh.
- **No new forensic verdicts.** The 27 stand.
- **No graph writes.** Nothing this batch needed one; the re-triage reads.

## 5. Files

New: `scripts/case-loops/law/{triage-core,retriage-009,rebase-ledger-009,verify-close-reads}.ts`,
`docs/data-analysis/case-law/payloads/{collision-reasoning-cz,batch-009-close-read-verification}.json`,
this note.
Modified: `docs/data-analysis/case-law/ledger.json` (141 rows + 2 new blocks + 4 corrections),
`features/lawwatch/{getCollisionData.ts,CollisionsPage.tsx}`,
`docs/case-loops.md` (kernel: the gate-is-code rule, P49-applies-to-the-analyst, the
no-`git add -A`-during-a-fleet-window amendment batch-008's reflection recommended).

**Deliberately NOT committed by this batch: `lib/testing/loaders.test.ts`.** The presentation-gate
regression test and the derived-`batchesRun` assertion described in §3 live in that file and are
written, passing, and left in the working tree. The file itself is **untracked** — it is a
concurrent session's in-flight restructure (it supersedes the now-deleted
`lib/testing/leaderboard-loader.test.ts`, both already present in this session's opening `git
status`). Staging it would sweep an unrelated session's unreviewed work into a law-loop commit —
precisely the fleet-hygiene violation batch-008 investigated and whose kernel amendment this batch
just wrote. It goes in with whichever session owns that file. Anyone re-running `npm run check`
before then still gets the test; anyone who reverts to `HEAD` does not, and should re-add it.

A concurrent writer was observed during this run (a transient transform failure on the untracked
`lib/ingest/sources/smlouvy.test.ts`, a money-case file, which passes in isolation) — so this
session behaved as a fleet run for git purposes even though it was dispatched solo.
