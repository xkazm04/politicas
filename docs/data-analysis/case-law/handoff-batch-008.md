# Case ③ Law loop — fleet handoff (batch-008, 2026-07-26)

Fleet run, concurrent with money/effort drivers (stayed strictly inside the law boundary: `docs/data-analysis/case-law/`, `scripts/case-loops/law/`, `lib/ingest/sources/psp-legislation*`+`esbirka*`, `features/lawwatch/`, `app/zakony/`). **No live `.pglite` writes during analysis** (all work on `.pglite-copy-law-008`, a fresh `cp -r` from `.pglite-copy-law-005`), **no shared-vault edits**, **no commits run by this driver**. This supersedes batch-007's `handoff.md` as the action list; prior batch files stay as history.

## 0. IMPORTANT — a fleet-hygiene anomaly observed this session (not caused by this driver)

While working, this driver found that `scripts/case-loops/law/amends-census.ts` (containing this batch's own F1 fix, byte-for-byte identical to what this driver wrote) and a since-deleted throwaway test script (`f2-title-gate-test.ts`) were **already present in git history**, committed under `9abfde1 feat(case-effort): unify the public-copy jargon rules — close the persist/render gap` — an unrelated-sounding commit message for a DIFFERENT case. `git diff HEAD -- scripts/case-loops/law/amends-census.ts` is empty, confirming the committed content matches this driver's working-tree edits exactly. This driver never ran `git commit` at any point. This strongly suggests an automated/external process is sweeping the whole working tree (including in-progress, unreviewed case-loop work) into commits under mismatched messages — a violation of the kernel's fleet-mode "do not commit" rule for case drivers, though not one this driver caused. **Flagging for the orchestrator/user**: history now contains this batch's F1 fix under a confusing, unrelated commit message, and the mechanism doing this is worth identifying before it happens again (it could just as easily sweep up unreviewed, ungated work from another case mid-edit). The reflection audit dispatched this batch (§5 of its brief) was asked to investigate this further — see its report, `docs/data-analysis/case-law/batch-008-reflection.md`, for what it found.

Only `docs/data-analysis/case-law/ledger.json`, `scripts/case-loops/law/diff-amends-regen-deletions.ts`, and the newly-created batch-008 files (see §5) remain as this driver's own uncommitted tree changes; everything else this driver touched (`amends-census.ts`) has already landed in history via the anomalous commit above.

## 1. F1 — recall fix, corpus-verified single-bill blast radius

**Finding** (`batch-007-round2-audit.md`): a `Čl.`-organised bill's forward heading-window scan was not clipped at an intervening `ČÁST` boundary — tisk 215's `Čl. XI` (deletes §124a of law 280/2009, a real amendment) was gated out because the scan's 320-char forward window reached past its own block into the NEXT `ČÁST`'s "ÚČINNOST" heading.

**Fix**: `scripts/case-loops/law/amends-census.ts`, inside `extractRealAmendedLaws`'s `Čl.`-block branch — the forward heading-window end is now `Math.min(start + HEADING_WINDOW, end, nextCastIdx)`, where `nextCastIdx` is the nearest following `ČÁST` line (if any) inside the block. Independently re-verified against the raw cached text (`.data/law-collision-cache/tisk-215/*.txt`) BEFORE writing the fix — not inherited from the audit's excerpt.

**Blast radius, verified**: diffed `batch-007-amends-census.json` against the newly-generated `batch-008-amends-census.json` across all 140 rows — **exactly 1 row changed** (tisk 215: `realLaws` gains `280/2009`, `repealedRefs` loses it), 0 other bills' `realLaws`/`repealedRefs`/`structure` moved.

## 2. F2 — deletion payload prepared (orchestrator executes), evidence re-verified per edge

**Finding** (`batch-007-round2-audit.md`): 5 `title_fallback` `amends` edges are false public claims, already LIVE in the graph (confirmed by read-only query against `./.pglite`): tisk 153→468/1991 (nested inside the target law's own official name), tisk 88→360/2025 and tisk 124→300/2025 (lineage — "ve znění zákona č. X"), tisk 36→89/2012 and tisk 42→416/2009 (nested inside an amending law's own name).

**Deliverable**: `docs/data-analysis/case-law/payloads/batch-008-f2-deletion-payload.json` — each of the 5 edges carries: the live bill/law node IDs (independently looked up, not assumed from tisk numbers — the first pass at this guessed wrong bill IDs from a numeric pattern and was corrected against the live graph before finalizing), the exact edge key, a verbatim title-preamble AND operative-text excerpt pulled directly from `.data/law-collision-cache/` this session (not inherited from the audit's prose), and the real target(s) of that bill left unaffected. **PREPARE only — no live write performed.**

**Code fix** (so the regenerated payload doesn't reproduce these 5): `scripts/case-loops/law/amends-regen-008.ts` adds a per-citation **title-role gate** (`titleRoleGateDrops`) with three patterns — LINEAGE (`ve znění zákona č.`), NESTED-AMEND (`zákon č. Y, kterým se mění zákon č. X` where X is not the bill's own first-cited target), NESTED-NAME (`o změně a doplnění zákona č.`). Corpus-verified (all 141 bills' title preambles, standalone test harness run before wiring into the pipeline) to remove **exactly these 5 refs and nothing else** — the 2 genuine title-only census rescues (tisk 107→159/1999, tisk 243→223/2016) are untouched. Required an NFC-normalization fix along the way: `pdftotext` inconsistently emits "č" as a decomposed base-c + combining caron within the SAME document (found live on tisk 36's first "č." token), which silently broke a regex-literal "č" match before normalization was added.

`scripts/case-loops/law/diff-amends-regen-deletions.ts`'s `DELETION_ALLOWLIST` now carries all 5 keys (in addition to batch-007's 4), each with its own evidence comment, so the deletion-safety gate does not refuse them as unallowlisted drops.

## 3. Full regen pipeline — 577 edges, all checks green

```
cp -r .pglite-copy-law-005 .pglite-copy-law-008
PGLITE_PATH=./.pglite-copy-law-008 npx tsx scripts/case-loops/law/amends-census.ts
PGLITE_PATH=./.pglite-copy-law-008 npx tsx scripts/case-loops/law/fix-proposal-trigger-008.ts
PGLITE_PATH=./.pglite-copy-law-008 npx tsx scripts/case-loops/law/amends-regen-008.ts
PGLITE_PATH=./.pglite-copy-law-008 npx tsx scripts/case-loops/law/validate-amends-regen-008.ts
npx tsx scripts/case-loops/law/measure-precision-008.ts
PGLITE_PATH=./.pglite npx tsx scripts/case-loops/law/diff-amends-regen-deletions.ts \
  --payload=docs/data-analysis/case-law/payloads/batch-008-amends-regen.json
# expect: 577 edges (581 live + 1 F1 add − 5 F2 drops), validator 5/5 PASS,
# precision 573/577 high_confidence (4 low, same hand-verified-real 4 as batch-007),
# diff-deletions: 1 added / 5 dropped (all allowlisted), 0 unallowlisted
```

All ran clean this session: **577 edges**, validator **PASS 0 errors 0 warnings**, precision **573 high / 4 low / 0 unresolvable** (0.69% low-confidence rate — matches batch-007's 4 hand-verified-real low-confidence edges exactly, no new ones introduced), deletion-diff **PASS, 0 unallowlisted** (confirms live graph today = batch-007's 581-edge set exactly — 1 add is F1, 5 drops are F2, all allowlisted).

`apply-amends-regen.ts` remains **NOT re-pointed** at this or any batch-007/008 payload (same boundary call as batch-007 — a concurrent sibling agent owns generalizing that script; its `NODE_PAYLOAD`/`EDGE_PAYLOAD`/`EXCLUDED_LOW_CONFIDENCE_EDGES` constants still name batch-005's files and its own startup assertion safely refuses to run unmodified).

## 4. Re-triage — churn re-ranking done; full triageScoreV2 deferred (disclosed, not silent)

Churn ranking (from `batch-008-amends-regen.json`'s `churnRanking.afterTop10`): **40/2009 takes #1 with 12 edges**, exactly as batch-007 predicted; 586/1992 drops to #2 (9).

**Not done this batch, and disclosed why**: a full `triageScoreV2`/sector-adjacency recompute (`scripts/case-loops/law/triage-002.ts`) against the new 577-edge topology. The batch-004 reflection explicitly warned sector-adjacency needs **§-level** recomputation, not a naive re-run over the new edge set (a bill's sector-adjacency conflict should be scoped to which SECTION it amends, not its whole amended-law set) — that rework was not attempted this batch (effort-budget call) rather than shipped as an invalidated naive re-run. Logged in `ledger.json`'s `totals.batch008ReTriage` as an open item for whichever batch does it.

## 5. Collision universe reopened — partitioned pre-check re-run, ranking signal still unvalidated, 12 pairs close-read

- New collision-candidate groups from the 577-edge topology: `scripts/case-loops/law/collision-groups-008.ts` → **150 groups, 629 raw candidate pairs** (up from batch-005's 583 pre-regen).
- §-level partition check (all cached `.data/law-collision-cache/` text, 0 new network fetches — all 117 relevant bills already cached): `scripts/case-loops/law/collision-check-008.ts --v2` → **176 partitioned survivor pairs** (down slightly from batch-005's 186, consistent with F1/F2's net −4 edges and a different grouping).
- **P52 ranking-signal validation, before spending model time (per the kernel's explicit P52 doctrine)**: the `moneyLiteral` candidate signal (introduced batch-005) was already found NOT statistically distinguishable from the partition-survivor baseline (Opus audit: Fisher p=1.00 at n=15). This batch did **not** attempt to re-derive a larger validated sample (pair identity does not survive a topology change cleanly across batch-004/005/008's three different edge sets — flagged as real, non-trivial work, not attempted this batch) — so this batch's close-read sample was explicitly **topic-diverse UNREAD pairs**, never ranked by the unvalidated signal.
- **Close-read**: 12 of 176 pairs, done directly by the driver (not a subagent army — an effort-budget call, disclosed) — `docs/data-analysis/case-law/payloads/collision-close-reads-batch008.json`. **3 confirmed / 5 coordination-risk / 4 incidental** (originally reported 4/5/3 — pair 90/221 was corrected from confirmed to incidental after an independent Opus reflection pass caught a same-bill excerpt-comparison error; see §6a). Two notable finds: (a) an emergent N-way cluster — 4 separate bills (tisk 7, 111, 207, 213) each independently edit 40/2009 §88 odst.2 písm.c) (criminal-code confiscation predicate-offense enumeration), star-topology centered on tisk 207; (b) tisk 56/234 §17c/§17d, where the shared-§ excerpts are **near-verbatim identical text** proposed as NEW insertions by two different bills — a genuine duplicate-insertion collision shape not previously seen in this case's history.
- **117/176 pairs remain unread** — logged honestly in the close-read payload's `coverage` block (no silent truncation), a natural batch-009 army task.

## 6. Opus audits (dispatched this batch, per the brief's "Opus ≤2 at max depth: one audit, one reflection")

Two independent Opus agents were dispatched in parallel, maximum reasoning depth, no shared context with each other or with this driver's own narrative:
1. **Adversarial audit** of the F1 fix and F2 deletion evidence (re-derive everything from cached source text independently, hunt for a 6th false edge or a false positive in the deletion set, re-verify the full pipeline against a fresh copy). Report: `docs/data-analysis/case-law/batch-008-audit.md`.
2. **Reflection** on this batch's own deliverables (internal consistency, self-serving framing, manifestation debt, the fleet-hygiene commit anomaly in §0, spot-checking 3+ of the 12 collision close-read classifications). Report: `docs/data-analysis/case-law/batch-008-reflection.md`.

### 6a. Reflection verdict — RETURNED, real findings, corrected same session

**VERDICT: NOT ready as reported** (engineering sound; the *reporting* had 3 real defects, all fixed in this handoff before being called ready):

1. **A false `confirmed` collision, now fixed.** Pair 90-221's "VERBATIM IDENTICAL duplicate insertion" claim compared bill 221's own excerpt against ITSELF (a same-bill excerpt-reuse artifact: §12 and §14 sit close together in 221's own text, so `excerptFor()` returned bill 221's own §14 text for both the §12 AND §14 partition hits, and the driver misread the two same-bill quotes as opposing sides of the pair). The reflection agent's NFC-normalized grep of tisk 90's own cached text found ZERO occurrences of the quoted phrases. **Independently re-confirmed by this driver** (same grep, same result) and **corrected**: `collision-close-reads-batch008.json`'s pair 90-221 reclassified `confirmed` → `incidental`, `classificationCounts` corrected 4/5/3 → **3/5/4**, `ledger.json`'s `batch008CollisionRecheck` updated to match, both with a `correctionNote` disclosing the fix rather than silently editing it. (56-234's §17c/§17d duplicate-insertion finding was independently verified by the reflection as real — that one stands.)
2. **Baseline-framing confusion, now caveated.** `batch-008-amends-regen.json`'s own `stats.currentAmendsEdgeCount: 150` reflects `.pglite-copy-law-008`'s baseline (a copy of `.pglite-copy-law-005`, which predates batch-007's live apply on 2026-07-25) — NOT the live graph, which already carried 581 edges (batch-007 applied, commit 257e723, pass 30) BEFORE this batch started. This driver's own §3 diff against the LIVE graph already reported the correct real-world delta (+1 F1 / −5 F2, 581→577) — the raw payload JSON's internal 150-baseline arithmetic is correct FOR THAT COPY but is misleading read in isolation. Added `ledger.json`'s `batch008F1Fix.baselineCaveat` to disclose this explicitly for anyone reading the raw payload.
3. **"Re-triage DONE" overclaim, now precisely scoped.** Only the AGGREGATE top-10 churn ranking was recomputed; zero of the 141 per-bill `ledger.json` rows (`triageScoreV2`, `maxTargetChurn`, `sectorAdjacency`) were updated. `ledger.json`'s `batch008ReTriage.status` corrected to say this explicitly rather than "churn re-ranking DONE and verified" (technically true but readable as more complete than it is).
4. **Manifestation debt: unanswered, confirmed as a real gap.** Nothing from this batch renders anywhere yet; `/zakony/kolize`'s loader is (per the reflection) "one filename away" from picking up the new collision data — flagged as manifestation debt for a build-review batch, not fixed here (this was an analysis batch, not a build phase).
5. **Fleet-hygiene commit anomaly (§0): confirmed real, assessed LOW severity, root cause found.** The reflection traced commit `9abfde1` to a **concurrent architect-scan session** (Claude Fable 5) that swept the whole working tree ~19 seconds after this batch's F1/F2 payload was written — not an auto-commit hook, not this driver, and not malicious; a `git add -A`-style commit from an unrelated session while this batch's window was open. Harm assessed as: a partial, self-contradicting snapshot landed in history under a mismatched message, and a scratch file (`f2-title-gate-test.ts`) that `ledger.json` had cited as this batch's F2 verification got swept along too before this driver deleted it locally. **Recommendation carried to the orchestrator**: no session should run `git add -A`/commit-everything while another case's fleet window is open — a kernel amendment candidate, not just a one-off note.
6. No third Opus trigger fired — the reflection independently confirms all confirmed/coordination-risk collision pairs are drafting-collision risk with zero sponsor-money adjacency, correctly below the genuine top-signal bar.

Full report: `docs/data-analysis/case-law/batch-008-reflection.md`.

### 6b. Adversarial audit — RETURNED, VERDICT: READY WITH CAVEATS (apply the change-set; the caveats were about *reporting*, fixed same session)

Independently re-implemented `extractRealAmendedLaws` and `titleRoleGateDrops` from source, reproduced both census artifacts 140/140, and re-ran the whole pipeline on a fresh copy: **577 edges, validator PASS 5/5, live diff = 1 added / 5 dropped / 0 unallowlisted** (matches this driver's own numbers exactly). Full report: `docs/data-analysis/case-law/batch-008-audit.md`.

**F1 and F2 are clean — the audit could not break either.** The ČÁST-boundary clip changes exactly 1 bill (tisk 215) out of 47 candidate blocks and can only ever un-gate (never introduce a false positive). The title-role gate drops exactly the 5 named refs and correctly keeps tisk 107/243 — the audit independently verified all 5 as genuinely false from cached text, verified the live node IDs, built a full taxonomy of every title-citation context in the corpus, and ran a widened-lineage counterfactual: **no 6th false edge exists**. Two things worth carrying forward: the `isFirst`-citation guard in the title-role gate is far MORE load-bearing than its own comment suggests (disabling it would produce 109 drops instead of 5 — it is currently correct 116/116 times on this corpus, but its failure mode is only contained by the deletion-diff gate downstream, not by anything upstream); and NFC normalization is genuinely load-bearing (without it, the F2 gate drops only 4 of the 5, missing tisk 36).

**3 reporting defects found, all fixed in this same session** (2 were already caught by the parallel reflection pass and fixed before this audit's report landed; timing meant the audit's own read of the files happened before those fixes, so its report shows the pre-fix state — cross-referenced and confirmed resolved here):
1. The `ledger.json`/`collision-close-reads-batch008.json` contradiction (retracted `confirmed: 4` vs corrected `confirmed: 3`) — **already fixed** in §6a above before this audit's report arrived; independently re-confirmed by the audit's own grep of tisk 90 finding zero matches, same conclusion as the reflection.
2. The 150-edge-baseline stats confusion (`edgeCountDelta: 427` reads as if 427 edges are missing from the live graph, when the real live-relative change is 6 edges) — **fixed this session** (after this audit report landed) with a new prominent `LIVE_GRAPH_CAVEAT_READ_THIS_BEFORE_APPLYING` top-level field in `amends-regen-008.ts`'s output (see §3), re-generated and re-verified (577 edges, validator PASS, deletion-diff PASS — unchanged) before being called final.
3. `measure-precision-008.ts`/`batch-008-precision-measurement.json` attributed a caveat to "batch-008 independent-audit finding (N-D)" that had not happened yet when the file was generated (stale text carried over verbatim from the batch-007 script during the `sed` copy) — **fixed this session**: reworded to correctly attribute it as carried forward from batch-007's own N-D finding, re-generated (573/577 high_confidence, unchanged — text-only fix).

**Latent, not blocking, fixed anyway**: `amends-census.ts`'s `extractText` never NFC-normalized (the same decomposed-vs-precomposed-diacritic risk class as the F2 gate needed fixing) — 3 cached documents demonstrably under-match some regex without it, though the audit confirmed **0 realised effect on this corpus's 140 census rows**. Fixed this session at the single point every downstream extractor reads cached text through (`extractText`, both the cache-hit and cache-miss paths); re-ran the full pipeline afterward and confirmed byte-for-byte identical output except the `generatedAt` timestamp (diffed against the git-committed pre-fix version) — then re-ran `fix-proposal-trigger-008` → `amends-regen-008` → `validate-amends-regen-008` → `measure-precision-008` → `diff-amends-regen-deletions` end to end once more: still 577 edges, still all green, still exactly the same 1-add/5-drop live diff.

**Overall: both Opus passes converge on the same verdict** — the F1/F2 engineering is sound and independently reproducible from source by two agents with no shared context; every reporting defect either agent found has been fixed, disclosed, and re-verified in this same session, not smoothed over. This batch is ready to hand to the orchestrator.

## 7. Graph payloads — NOT applied (orchestrator decision required)

Same posture as every prior batch: **PREPARE only**. Nothing in this batch wrote to `./.pglite`. The orchestrator's live-apply path is:
1. Apply the F2 deletion payload (§2) — 5 edges, or fold into a full regen apply.
2. Re-point `apply-amends-regen.ts` at `batch-008-amends-regen.json` (still not done, same boundary call as batch-007) and apply the full 577-edge regenerated set (which already excludes the 5 F2 edges and includes the 1 F1 recovery) — this subsumes the standalone F2 deletion if done as one topology swap instead of two steps.
3. Read both Opus reports (§6) before either.

## 8. Shared-file additions (append verbatim — could not edit these in fleet mode)

### → `patterns.md`
```
### Law: pdftotext can emit the SAME diacritic letter in two different Unicode normalization
forms within ONE document, silently breaking a regex literal
batch-008's F2 title-role gate needed to detect a citation's second-vs-first occurrence order in
a bill's title preamble; the very first "č." token in tisk 36's preamble was pdftotext-extracted
as a DECOMPOSED "c" + U+030C combining caron rather than the precomposed U+010D "č", while later
"č." tokens in the SAME document were precomposed — a regex literal "č" only matches the
precomposed form, so ordering/counting logic built on it silently mis-ordered citations with no
error, no warning, just a wrong answer that looked plausible. Fixed by NFC-normalizing
(`.normalize("NFC")`) the cached text once at load time before any regex touches it. -> any new
text-processing code against `.data/law-collision-cache/`'s pdftotext output should normalize to
NFC at the point of reading the file, not assume the source is internally consistent even within
one document — this is a genuinely different bug class from both P42 (substring-collision from
`.includes()`) and the batch-007 `\w`-is-ASCII-only bug (a compiled-regex construction issue,
not a source-encoding issue).

### Law: a per-citation syntactic-role gate over a bill's title preamble needs a
"which occurrence in citation ORDER" guard, not just an immediate-preceding-context regex
batch-008's F2 fix rejects a title-derived ref when it's a lineage citation or nested inside
another law's own name — but the SAME "kterým se mění zákon č. X" phrase that correctly names a
bill's real FIRST target also appears, verbatim, describing what an EARLIER-cited law itself is
(the nested-name case). A context-only regex (does the phrase immediately before this citation
match a nesting pattern) over-fired on every bill's own genuine primary target, because the
bill's real target is ALSO introduced by "kterým se mění zákon č." -- the discriminator that
actually works is ORDER: only a SECOND-OR-LATER occurrence of that phrase in the preamble is
nested; the first is always the bill's own real target (the fixed Czech drafting formula "ZÁKON
ze dne ..., kterým se mění zákon č. X ..." always leads with the real target). -> any future
syntactic-role gate over Czech legal-text citations should check citation ORDER within the
document, not just the locally-preceding text, when the same surface phrase is legitimately used
both for the real target and for describing a target's own history.
```

### → `feature-opportunities.md`
```
### Law: a genuine duplicate-insertion collision (tisk 56/234 §17c/§17d) is a distinct shape
from a conflicting-edit collision — worth its own /zakony/kolize UI treatment
batch-008's collision close-read (docs/data-analysis/case-law/payloads/collision-close-reads-
batch008.json) confirmed one pair (tisk 56 and tisk 234) where BOTH bills propose to insert a new
§ 17d beginning with near-identical text ("Přestupky podle tohoto zákona projednává inspektorát,
s výjimkou přestupků a) podle § 17a odst. 1 písm. b)") -- a genuinely different collision shape
from the usual "two bills edit the same odstavec with different instructions" pattern: here two
bills are independently drafting the SAME new provision. (A second candidate, tisk 90/221 §14,
was INITIALLY misread as the same shape by the driver -- both quoted excerpts turned out to be
bill 221's own text reused across two different §-match rows, not a real cross-bill match; caught
by an independent Opus reflection pass and corrected same session, see handoff.md §6a. Only the
56/234 pair is a confirmed instance of this shape.) Worth a distinct /zakony/kolize UI treatment
("duplicate insertion" vs "conflicting edit") if more genuine instances turn up in the 117
still-unread partitioned pairs -- it likely indicates shared drafting lineage (same sponsor
office/template) rather than independent legislative intent, itself a citable finding for a
feature that surfaces WHO drafts together.
```

### → `frontier.md` (Case ③ section)
```
- **batch-008 fixed both disclosed defects from the round-2 audit (F1 recall gap, F2 five false
  edges) and prepared a deletion payload for the false edges** -- F1 (tisk 215's real amendment
  to 280/2009, lost to a heading-window clip bug) is fixed and corpus-verified to a single-bill
  blast radius; F2 (5 live false title-derived edges) has a re-verified-from-cached-text deletion
  payload ready for the orchestrator plus a corpus-validated code fix (a per-citation title-role
  gate) so the regenerated set doesn't reproduce them. Full regen: 577 edges, validator/precision/
  deletion-diff all clean. Re-triage's churn ranking is done (40/2009 takes #1); the
  triageScoreV2/sector-adjacency full recompute remains explicitly deferred pending §-level rework
  (a real, disclosed gap, not a silent skip). The collision universe reopened as predicted (629 raw
  / 176 partitioned pairs, up from 583/186) -- 12 close-read (3 confirmed / 5 coordination-risk /
  4 incidental), 117 remain, a natural batch-009 army task. P52's moneyLiteral ranking signal is
  STILL unvalidated (carried forward unchanged from batch-005) -- do not use it to rank a sweep
  without a fresh, larger validation.
- **A fleet-hygiene anomaly was observed this batch, not caused by the law driver**: this batch's
  own F1 fix (and a since-deleted test script) were found ALREADY committed in git history under
  an unrelated commit message for a different case ("feat(case-effort): unify the public-copy
  jargon rules"), with the law driver never having run `git commit`. This suggests an automated
  process is sweeping uncommitted working-tree changes into commits under mismatched messages --
  worth the orchestrator/user investigating before it sweeps up unreviewed work from another case
  mid-edit. See handoff.md §0 and batch-008-reflection.md for what the reflection audit found.
```

### → `graph-log.md`
```
## Pass N (track: law) — Case ③ batch-008: F1 recall fix (tisk 215 recovered) + F2 five-false-edge
deletion payload prepared + code fix, re-triage churn ranking recomputed, collision universe
re-run on the reopened 577-edge topology (2026-07-26)
No graph writes this batch (all analysis on .pglite-copy-law-008, a fresh copy, removed after
use; the live 581-edge graph was only READ, via diff-amends-regen-deletions.ts, to confirm the F2
edges are live and to confirm the F1/F2-fixed regen's add/drop set matches exactly). F1: amends-
census.ts's Čl.-block forward heading-window scan now clips at an intervening ČÁST boundary,
recovering tisk 215's real amendment to 280/2009 (a §124a repeal, previously gated out by the
NEXT part's ÚČINNOST heading bleeding into the window) -- verified to change exactly 1 of 140
census rows. F2: amends-regen-008.ts adds a per-citation title-role gate (lineage / nested-amend /
nested-name, NFC-normalization-dependent) removing exactly the 5 false title_fallback edges the
round-2 audit named (tisk 153/88/124/36/42) and neither of the 2 genuine title-only rescues (tisk
107/243) -- corpus-verified across all 141 bills. A standalone deletion payload
(batch-008-f2-deletion-payload.json) re-verifies each of the 5 false edges from cached text
independently (not inherited from the audit) with live bill/law node IDs looked up directly
(a first guess at the IDs from a numeric pattern was wrong and caught before finalizing). Full
regen: 577 edges (581 live + 1 F1 add - 5 F2 drops), validator PASS 5/5, precision 573/577
high_confidence (4 low, unchanged from batch-007's hand-verified-real 4), deletion-diff PASS 0
unallowlisted. Re-triage: churn re-ranking done (40/2009 #1, 12 edges); full triageScoreV2/
sector-adjacency recompute explicitly deferred (needs §-level rework per a standing batch-004
warning) rather than shipped as an invalidated naive re-run. Collision universe: 629 raw / 176
partitioned candidate pairs (up from 583/186 pre-regen, as predicted); 12 close-read (3 confirmed
/ 5 coordination-risk / 4 incidental -- corrected from an initial 4/5/3 same session after an
independent Opus reflection pass caught a same-bill excerpt-comparison error in one pair, see
handoff.md §6a), including an emergent 4-bill N-way cluster on 40/2009 §88 and one genuine
near-verbatim duplicate-insertion pair (tisk 56/234). 117 remain, logged not dropped. Two
independent Opus agents dispatched (adversarial audit of F1/F2 + a reflection pass, both
returned, both converging on READY / NOT-ready-as-FIRST-reported-but-corrected-same-session) --
see handoff.md §6 for their reports and the corrections made in response. npm run check: this
batch's own files (scripts/case-loops/law/*, docs/data-analysis/case-law/*) typecheck- and
lint-clean, 347/347 tests pass; the repo-wide `npm run check` is blocked by pre-existing lint
errors in scripts/case-loops/money/*.ts (a concurrent case's files, outside this batch's
boundary, not introduced this batch).
```

## 9. Enum / schema proposals

None new this batch.

## 10. Commit plan (orchestrator; per-case commit inside law boundary)

**Nothing committed by this driver this batch** (per Authority — no exceptions; see §0 for the anomaly where some of this work already appears in history via an external process).

**Uncommitted work in the tree at handoff time, all within law boundary**:
- `docs/data-analysis/case-law/ledger.json` (modified — `batch008F1Fix`/`batch008F2Deletion`/`batch008ReTriage`/`batch008CollisionRecheck` blocks added to `totals`)
- `scripts/case-loops/law/diff-amends-regen-deletions.ts` (modified — 5 new `DELETION_ALLOWLIST` entries, F2)
- `docs/data-analysis/case-law/handoff.md` (this file, replacing batch-007's)
- `docs/data-analysis/case-law/payloads/batch-008-f2-deletion-payload.json` (new)
- `docs/data-analysis/case-law/payloads/batch-008-precision-measurement.json` (new)
- `docs/data-analysis/case-law/payloads/collision-close-reads-batch008.json` (new)
- `docs/data-analysis/case-law/payloads/collision-groups-008.json` (new)
- `docs/data-analysis/case-law/payloads/collision-report-v2-008.json` (new)
- `docs/data-analysis/case-law/batch-008-audit.md` (new, Opus adversarial audit)
- `docs/data-analysis/case-law/batch-008-reflection.md` (new, Opus reflection)
- `scripts/case-loops/law/collision-check-008.ts` (new)
- `scripts/case-loops/law/collision-groups-008.ts` (new)
- `scripts/case-loops/law/fix-proposal-trigger-008.ts` (new)
- `scripts/case-loops/law/measure-precision-008.ts` (new)
- `scripts/case-loops/law/validate-amends-regen-008.ts` (new)

**Already present in git history via the §0 anomaly, but SINCE FURTHER MODIFIED after both audits landed** (not this driver's commit — the pre-audit content matched what's in history at the time of the §0 sweep; both files were edited again afterward in response to the adversarial audit's findings #2/#3 and are now AHEAD of what git history holds — re-diff before assuming history is current): `scripts/case-loops/law/amends-census.ts` (F1 fix, PLUS the NFC-normalization latent-risk fix added after the audit), `scripts/case-loops/law/amends-regen-008.ts` (F2 fix, PLUS the new `LIVE_GRAPH_CAVEAT_READ_THIS_BEFORE_APPLYING` field and a stale `.pglite-copy-law-007` path-string fix in `boundary`), `docs/data-analysis/case-law/payloads/batch-008-amends-census.json` (re-generated after the NFC fix — content identical except `generatedAt`, independently diff-verified), `batch-008-amended-laws-full-proposal.json`, `batch-008-amended-laws-full-proposal-v2.json`, `batch-008-amends-regen.json` (re-generated — now carries the live-graph caveat), `batch-008-amends-regen-impact.md`.

Suggested message (Conventional), for whatever the orchestrator folds together:
```
fix(case-law): batch-008 closes both round-2-audit disclosures — tisk 215's lost amendment (F1)
and 5 false title-derived edges (F2), re-triages churn, reopens the collision universe

Law loop batch-008 — F1: amends-census.ts's Čl.-block forward heading-window scan now clips at
an intervening ČÁST boundary, recovering tisk 215's real amendment to 280/2009 (verified to
change exactly 1 of 140 bills). F2: a corpus-validated per-citation title-role gate
(amends-regen-008.ts) removes the 5 false title-derived edges the round-2 audit named
(153/88/124/36/42) without touching the 2 genuine title-only rescues (107/243); a standalone
deletion payload re-verifies each false edge from cached text independently, ready for live
apply. Full regen: 577 edges, validator/precision/deletion-diff all clean. Re-triage: churn
re-ranking done (40/2009 #1); full triageScoreV2/sector-adjacency recompute explicitly deferred
(needs §-level rework, disclosed not silent). Collision universe reopened as predicted (629 raw
/ 176 partitioned pairs); 12 close-read (3 confirmed / 5 coordination-risk / 4 incidental, corrected from an initial 4/5/3
after an independent Opus reflection caught a misclassified pair — see handoff §6a), including an
emergent N-way cluster and one genuine near-verbatim duplicate-insertion pair. 117 remain.
Two independent Opus passes (adversarial audit + reflection) — see handoff.md §6.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## 11. Lessons learned

1. **A regex construction bug and a source-encoding bug can look identical from the outside but need different fixes.** batch-007 found `\w` is ASCII-only even with `/u`; batch-008 found a DIFFERENT failure mode — the same source text can carry the SAME letter in two different Unicode normalization forms within one document. Both silently produce a "looks-compiled-correctly, matches-nothing-or-wrong-thing" regex. NFC-normalize at the file-read boundary, always, for this corpus.
2. **A per-citation syntactic-role gate needs document-order awareness, not just local context** — the same Czech legislative phrase legitimately introduces a bill's REAL target (first occurrence) and describes an EARLIER-cited law's own name (later occurrence); a context-only regex cannot tell these apart without also checking citation order.
3. **Verify IDs against the live system before writing them into a deletion payload** — this batch's first pass at the F2 deletion payload guessed bill node IDs from a numeric pattern (tisk cislo → `bill:tisk:432XX`) and got all 5 wrong; caught by an explicit live-graph lookup before finalizing. A deletion payload's evidence is only as trustworthy as its weakest unverified assumption, and node-ID pattern-guessing is exactly the kind of thing that looks obviously right until checked.
4. **An unexplained already-committed file is worth investigating immediately, not shrugging off** — finding this driver's own uncommitted work already in git history (§0) was surprising enough to warrant its own audit item rather than being noted and left; a fleet environment where commits happen outside any case driver's control needs that surfaced, not absorbed silently.

`docs/data-analysis/case-law/handoff.md`
