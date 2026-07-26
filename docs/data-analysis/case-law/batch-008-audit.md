# batch-008 — independent adversarial audit (Opus, maximum depth)

**Date:** 2026-07-26 · **Scope:** batch-008's F1 fix (`amends-census.ts`), F2 fix + deletion
payload (`amends-regen-008.ts`, `batch-008-f2-deletion-payload.json`), full pipeline
reproduction, and the new `ledger.json` blocks + `collision-close-reads-batch008.json`.
Nothing was taken on the driver's word: every claim below was re-derived from the cached bill
text and the live store, with my own harness, before being accepted or rejected.

---

# VERDICT: **READY WITH CAVEATS**

**Apply the edge change-set. Do not report the batch as ready.**

The engineering is correct and I reproduced it end to end. The operative change to the live
graph is exactly **+1 / −5**: add `tisk 215 → 280/2009` (a real amendment, presently missing);
remove five title-derived edges (`tisk 153→468/1991`, `88→360/2025`, `124→300/2025`,
`36→89/2012`, `42→416/2009`) that I independently re-verified, from the bills' own cached text,
to be **false public claims that render on `/zakony` today**. Applying strictly improves the
graph in both directions at once. Nothing I found argues for holding it.

What is *not* ready is the reporting layer wrapped around that change-set. Two defects in it are
material enough that an orchestrator acting on the artifacts rather than on the diff could do the
wrong thing, and one is a live self-contradiction between two artifacts shipped in the same batch.
Both are cheap to fix and neither touches an edge.

This audit was run in parallel with `batch-008-reflection.md`. Where our findings overlap I
re-derived independently and say so; where I disagree with it I say that too. I found **no defect
in the F1 or F2 logic**, one **new latent fragility** neither pass named (§D3), and I confirm the
reflection's headline close-read defect by direct grep.

---

## What I did

All work against the **real cached bills** (`.data/law-collision-cache`, 140 with text; tisk 87
has no PDF) and the live store, never against the code's own claims.

- **Re-implemented `extractRealAmendedLaws` and `processBill`'s operative-slice derivation from
  scratch**, by reading the committed source, in a private harness — including the index-HTML
  `Návrh zákona ?? Platné znění` document choice. Ran all 140 bills. My output matches
  `batch-008-amends-census.json` on `realLaws`, `structure` **and** `repealedRefs`, **140/140,
  0 mismatches** — and matches `batch-007-amends-census.json` 140/140 with the clip disabled. So
  both artifacts are what the code produces, and my harness is a valid substitute for it.
  (My first run showed a single mismatch on tisk 243's `repealedRefs`; it was **my** bug — I had
  written `FOOTNOTE_START` as `/^\s*\d{1,3}\s*\)/` instead of the shipped
  `/^\s*\d{1,3}\)?\s+[A-ZÁČ…§]/u`, which exists precisely for the paren-less `"3 § 3 zákona č.
  240/2000 Sb."` form in that bill. Corrected; the artifacts were right.)
- **Re-implemented `titleRoleGateDrops`** and ran it over all 141 bills' preambles, plus three
  counterfactual variants (no NFC / `isFirst` guard disabled / widened lineage regex).
- **Re-ran the whole pipeline** on a fresh `.pglite-copy-law-008-audit` (copy of
  `.pglite-copy-law-005`): census → `fix-proposal-trigger-008` → `amends-regen-008` →
  `validate-amends-regen-008`. Every artifact reproduced byte-identical modulo timestamps.
- **Read-only against `./.pglite`** for node ids, live edges and `amended_laws` props, and for
  the deletion diff. No write of any kind. `.pglite-copy-law-008-audit` deleted; all scratch
  under a gitignored path, removed. `git diff` on `docs/data-analysis/case-law/payloads/` is
  empty — I restored every file the re-run rewrote. The only repo file I wrote is this one.

**Reproduction results, verbatim:**

| step | result |
|---|---|
| `amends-census.ts` | census + proposal reproduce **byte-identical** (mod `generatedAt`) |
| `fix-proposal-trigger-008.ts` | 140 rows, 55-bill set-difference trigger, reproduces identical |
| `amends-regen-008.ts` | **577 edges**, reproduces identical (mod `generatedAt`/`computedAt`) |
| `validate-amends-regen-008.ts` | **PASS 5/5**, 577 edges, 0 errors, 0 warnings |
| `diff-amends-regen-deletions.ts` vs **live** | live 581 → payload 577; **1 added, 5 dropped, all 5 allowlisted, 0 unallowlisted → PASS** |
| the 1 added edge | `bill:tisk:43337 → law:sb:280-2009` (tisk 215, F1) — confirmed, nothing else |
| live graph identity | live 581 `amends` set is **exactly** batch-007's payload, element for element |

---

## F1 — the clip is correct, minimal, and its blast radius really is one bill

**Verified. No defect.**

The bug is real and I read it in the raw text before reading the fix. `.data/law-collision-cache/tisk-215/271409.txt`, lines 893–903:

```
                                              ČÁST SEDMÁ
                                        Změna daňového řádu
                                                Čl. XI
      § 124a zákona č. 280/2009 Sb., daňový řád, ve znění zákona č. 458/2011 Sb., se zrušuje.

                                              ČÁST OSMÁ
                                              ÚČINNOST
```

`Čl. XI`'s own heading is *"Změna daňového řádu"*; deleting `§ 124a` of 280/2009 is an amendment
of 280/2009 by the bill's own structural declaration. The unclipped 320-char forward window ran
past `ČÁST OSMÁ` and gated the block on the *next* part's `ÚČINNOST`.

**The differential, computed by me, not read off a description.** Running my harness twice over
all 140 bills with the clip on and off and diffing every field:

- **exactly 1 bill changes: tisk 215.** `realLaws` gains `280/2009`; `repealedRefs` loses it.
  `structure`, `skippedParts` and every other bill: identical.
- **exactly 1 `Čl.` block is un-gated corpus-wide** — tisk 215 `Čl. XI`. No other gated block's
  outcome moves.
- Diffing the two committed census artifacts directly: **1 changed row**, four changed fields
  (`realLaws`, `realCount`, `undercount`, `repealedRefs`), `skips` identical. The driver's claim
  holds exactly.

**False-positive risk is structurally zero, and I tested it anyway.** The clip only ever *narrows*
the heading area, so it can only ever *un-gate* a block — it cannot cause a block to be gated that
was not. And a block's own heading always sits between its `Čl.` marker and any following `ČÁST`
line, so clipping there cannot hide it. Empirically: **47** `Čl.` blocks have a `ČÁST` boundary
inside their 320-char window, and only one of the 47 changes outcome. I also confirmed the shipped
form is *stricter* than the audit's proposed one-liner: it bounds the boundary to `< end`
(`castMatch.index < end ? castMatch.index : Infinity`), so a `ČÁST` line belonging to a later block
cannot clip this one.

**The mirror-image risk the brief asked about does not exist in this corpus, but the guard is
one-sided.** The *citation* slice (`start … start+800`) is still **not** clipped at a `ČÁST`
boundary — only the heading window is. So a `Čl.` block whose own body carries no citation can in
principle pick up the *next part's* citation and attribute it to itself. I swept all **797** `Čl.`
blocks: in **0** cases does the first eligible citation lie past an intervening `ČÁST` boundary.
Latent, not realised. **Cheap hardening (not required for this apply):** pass the same `nextCastIdx`
into the `slice` bound as well as `fwdEnd`. Worth a regression case if the corpus grows.

**Semantics check.** `280/2009` is picked, not `458/2011`, because `firstEligibleCitation` takes
the first citation and `458/2011` is lineage inside the same sentence. `"se zrušuje"` (singular,
no colon) is correctly *not* matched by `REPEAL_MARKER`, so the section-repeal-as-amendment is not
suppressed. Correct on both counts.

---

## F2 — all 5 deletions are genuinely false, the gate is exact, and I could not find a 6th

**Verified. No defect in the gate. The deletion payload is accurate.**

### The 5, re-read from source

I read each bill's cached text myself and reproduce the decisive line. Every excerpt in
`batch-008-f2-deletion-payload.json` is accurate and every reasoning is sound.

| bill | ref | what the text actually says | verdict |
|---|---|---|---|
| 153 | `468/1991` | Title: *"…zákon č. 40/1995 Sb., o regulaci reklamy **a o změně a doplnění zákona č. 468/1991 Sb.**, o provozování rozhlasového a televizního vysílání…"* — that phrase **is 40/1995's own legal name**. All 6 occurrences of `468/1991` in the document are inside that name. Čl. I item 1 then *deletes the phrase*: *"V názvu zákona se slova „a o změně a doplnění zákona č. 468/1991 Sb. …“ zrušují."* | **false** |
| 88 | `360/2025` | Title and Čl. I: *"Zákon č. 151/2025 Sb., o dávce státní sociální pomoci, **ve znění zákona č. 360/2025 Sb.**, se mění takto:"* — lineage dating the real target. | **false** |
| 124 | `300/2025` | Title: *"…a zákon č. 152/2025 Sb., …, **ve znění zákona č. 300/2025 Sb.**"* — lineage dating the second real target. Čl. I amends 117/1995. | **false** |
| 36 | `89/2012` | Čl. I: *"V části čtrnácté zákona č. 268/2025 Sb., **kterým se mění zákon č. 89/2012 Sb., občanský zákoník**, …, se slova „1. ledna 2026“ nahrazují…"* — the bill edits a date inside 268/2025's own transitional provision. It never touches 89/2012's text. | **false** |
| 42 | `416/2009` | Čl. I: *"V čl. VIII bodě 1 zákona č. 465/2023 Sb., **kterým se mění zákon č. 416/2009 Sb.** …, se za slovo „třídy,“ vkládají slova…"* — same nested-name shape. | **false** |

**Live node ids and edge keys: all 5 correct**, all 5 `liveConfirmed: true` verified against
`./.pglite` (read-only). `bill:tisk:43274|law:sb:468-1991`, `43198|360-2025`, `43239|300-2025`,
`43143|89-2012`, `43149|416-2009`. `tisk 215 → 280/2009` is confirmed **not** live.

**The 2 genuine rescues are genuinely genuine, and the gate keeps both.** I read them rather than
inherit the claim. tisk 107: title *"kterým se mění zákon č. 159/1999 Sb."*, `ČÁST PRVNÍ / Změna
zákona o některých podmínkách podnikání…`, but `Čl. I` opens *"Za § 9d se vkládá nový § 9e"* and
never re-cites the statute — census `realLaws=[]`, so the title union is the only path. tisk 243
is the identical shape (`Čl. I` opens *"§ 1 nově zní:"*). Both rescues are real; the union's
general rationale survives even though its documented worked example (tisk 88 → 360/2025) was
itself the false edge, exactly as the payload admits.

### Hunting a 6th false edge — negative, and I looked hard

**1. The non-corroborated universe is closed.** Every title-derived ref not present in the bill's
census `realLaws`, corpus-wide, is **11** refs across 11 bills: the 5 dropped above, the 2 genuine
rescues, and the 4 already handled and allowlisted in batch-007 (`64→25/2017`, `116→353/2019`,
`129→223/2016`, `231→348/2005`). Nothing is unaccounted for.

**2. I built a full taxonomy of the pre-context of every title citation** (last 4 tokens before
`č.`, over all 141 preambles, restricted to refs that are actually in `amended_laws`). 13 distinct
shapes. The only shapes the gate does not suppress and that could conceivably be false are:

- `"pozdějších předpisů, a zákon"` (15) and `"znění pozdějších předpisů, zákon"` (10) — genuine
  coordinate second/third targets (tisk 146 → 129/2000 + 131/2000, tisk 162 → 549/1991 + 82/1998,
  tisk 248's four). Correctly kept.
- **`"a o změně zákona"` (4: tisk 62→634/1992, 163→526/1990, 219→301/1992, 222→134/2016)** — this
  is the *short* form of the nested-name shape, and `NESTED_NAME_RE` deliberately requires
  `"a doplnění"`, so it does not fire. **This is fortunate rather than designed**, and I checked
  it: all four are bills that are new standalone acts which *also* genuinely amend the named law
  ("… o mistrovské kvalifikaci **a o změně zákona č. 301/1992 Sb.**"), and all four are
  **census-corroborated**. Had `NESTED_NAME_RE` been written one word looser it would have
  deleted 4–5 genuine edges. Worth a comment in the code; not a defect.
- `"kterým se zrušuje zákon"` (3) — tisk 116/129/231, already retired in batch-007. The role gate
  has no repeal clause; it doesn't need one here, but a *new* repeal bill would slip past it and
  land on `repealedRefsByCislo`/`isPureRepealTitle` instead. Known, layered.

**3. Widened-lineage counterfactual.** I re-ran the gate with a deliberately looser lineage
pattern (any `…zákona` immediately before a non-first citation, catching `"ve znění zákonů č. X"`
and `"…zákona č. A Sb. a zákona č. B Sb."` forms `LINEAGE_RE` would miss): **the drop set is
unchanged at exactly 5.** There is no missed lineage-shaped false ref in this corpus.

**Conclusion: exactly 5, no more, no fewer.** My independent re-implementation of
`titleRoleGateDrops` drops exactly `36→89/2012, 42→416/2009, 88→360/2025, 124→300/2025,
153→468/1991` and keeps tisk 107 and tisk 243. This matches
`batch-008-amends-regen.json → titleRoleGateExclusions` element for element.

### The `isFirst` guard — correct here, and *far* more load-bearing than the code admits

The brief asked whether the "not first citation" guard could be wrong. It is correct on this
corpus, and I measured how much weight it carries:

- With the guard **disabled**, the gate drops **109 refs** instead of 5 — including nearly every
  bill's own primary target (`4→586/1992`, `11→589/1992`, `215→150/2002`, `243→223/2016`, …),
  because the enactment formula *"ZÁKON ze dne …, kterým se mění zákon č. X"* is itself a
  `NESTED_AMEND_TITLE_RE` match. The guard is the only thing standing between this gate and a
  mass deletion.
- Its correctness rests entirely on a **positional** assumption: *the bill's own primary target is
  the first `č. N/RRRR Sb.` in the text before "Parlament se usnesl."* I tested it: across all
  **116** bills with title refs, the first preamble citation is a title ref **116/116, zero
  near-misses**. Where a cover page repeats the title (tisk 36), the repeated occurrence is also
  the target's, so the assumption survives.
- **The failure mode is nonetheless one stray citation wide.** A cover-page reference to, say, the
  standing orders (`zákona č. 90/1995 Sb.`) placed above the enactment formula would silently
  delete that bill's primary edge. **Blast radius is contained**: any such drop would appear in
  `diff-amends-regen-deletions.ts` as an *unallowlisted* deletion and hard-FAIL the gate. That
  safety net is doing real work here and should be named as the reason this heuristic is
  acceptable — the code comment argues from drafting convention alone.
- The converse risk (a false ref kept because it is *genuinely* first) is structurally
  impossible for the nested-amend shape — the nested law is always named *after* the law it
  describes, in the same phrase — and `LINEAGE_RE`/`NESTED_NAME_RE` carry no `isFirst` guard at
  all, so they are unaffected by ordering. Verified: no non-corroborated ref survives the gate.

### NFC normalization — necessary, correctly applied where F2 needs it, **absent where the census reads text**

**The driver's NFC claim is true and I confirmed the mechanism.** 8 cached `.txt` files contain
decomposed characters; in `tisk-36/265520.txt` the document mixes forms *within itself* — 5
citations match a precomposed-`č` regex, 8 match after NFC. Concretely: tisk 36's `268/2025`
citation uses decomposed `č`, its `89/2012` uses precomposed, so **without normalization the false
ref looks like the first citation**, `isFirst` flips true, and the drop is silently lost.
I measured it: **without NFC the gate drops 4, not 5 — it misses `36 → 89/2012` exactly.**
`loadTitlePreamble` normalizes, so production is correct. The deleted `f2-title-gate-test.ts`
normalized too (checked in `git show HEAD:`).

**But `amends-census.ts` does *not* normalize.** `extractText()` returns raw pdftotext output and
every census regex (`LAW_CITATION`, `Čl.`, `ČÁST`, `REPEAL_MARKER`, `NON_AMEND_ART_HEADING_RE`)
runs against it. On the same three documents the raw-vs-NFC citation counts differ (tisk 36: 5 vs
8; tisk 138: 3 vs 6; tisk 120: 12 vs 13) — i.e. **the census is demonstrably blind to citations in
those files.** I ran the full corpus with an NFC-normalized census: **0 bills change** `realLaws`,
`structure`, `repealedRefs` or `skippedParts`. So the gap is **latent, not realised**, and it does
**not** block this apply. It is the same silent-under-match class as the `\w`-vs-diacritics bug
batch-007 already logged, one layer up, and it should be closed by a one-line `.normalize("NFC")`
in `extractText()` — with the corpus re-run as its own regression test.

---

## Reporting defects — these are what make the batch "not ready"

None of these changes an edge. Two of them could change what an orchestrator *does*.

### D1 — the ledger and the close-read payload now disagree with each other (**live contradiction**)

`collision-close-reads-batch008.json` has been corrected to `confirmed: 3 / coordination_risk: 5 /
incidental: 4`, with a `correctionNote` and a rewritten `90-221` reasoning.
`ledger.json → totals.batch008CollisionRecheck.closeReadClassification` **still reads
`confirmed: 4 / incidental: 3`.** The correction landed in one artifact and not its own summary.
A reader taking the ledger as "the resumable state" gets the retracted number.

I verified the retraction is the right call **by grep, not by re-reading prose**. Over
`.data/law-collision-cache/tisk-90/` and `tisk-221/`, NFC-normalized, whitespace-collapsed:

| probe | tisk 90 | tisk 221 |
|---|---|---|
| `za slovo „předpis“` | **0** | 1 |
| `V § 14 odst. 1` | **0** | 1 |
| `Za § 14q` | **0** | 1 |
| `§ 14r` | **0** | 4 |

The string quoted as "VERBATIM IDENTICAL in both bills" occurs **only in tisk 221**, once, as a
single contiguous instruction block. `incidental` is correct.

### D2 — the whole regen/impact/ledger family is computed against a superseded baseline

The live graph carries **581** `amends` edges and **288** law nodes: batch-007's payload was
applied. I confirmed this directly — the live edge set is **exactly** batch-007's 581, element for
element, and the 4 batch-007 allowlisted deletions are gone from it. Yet:

| artifact | says | truth |
|---|---|---|
| `batch-008-amends-regen.json → stats.currentAmendsEdgeCount` | `150` | 581 |
| `… stats.edgeCountDelta` | `427` | **net −4** (+1 F1, −5 F2) |
| `batch-008-amends-regen-impact.md` headline + churn "before" table | "150 (current) → 577, Δ+427" | 6-edge delta against live |
| `diff-amends-regen-deletions.ts` allowlist comments | "already live in the 150-edge graph" | 581-edge graph |
| `ledger.json → totals.amends` / `totals.laws` | `150` / `101` | 581 / 288 |
| `ledger.json → totals.amendsRegenPrepared` | "still NOT applied to live graph" | applied |

`batch-008-f2-deletion-payload.json` gets it right ("against the live 581-edge graph"), so the
batch contradicts itself. **This is the operationally dangerous one**: an orchestrator reading
`edgeCountDelta: 427` would reasonably conclude the regeneration is unapplied and re-apply 577
edges wholesale. The honest statement — which the batch has all the evidence for — is *"live is
581; batch-008 proposes exactly six changes to it."* I reached this independently and it agrees
with the reflection's §B.

### D3 — a self-flattering provenance misattribution, written before any audit existed

`batch-008-precision-measurement.json` cites *"a batch-008 self-review"* and
*"batch-008 independent-audit finding (N-D)"*. N-D was **batch-007's** independent audit; no
batch-008 audit had run when that string was written (this document is the first). Same class in
`batch-008-amends-regen.json → boundary`: it says the run was read-only against
**`.pglite-copy-law-007`** — a directory that does not exist; the run used `-008` — and directs
the reader to `docs/data-analysis/case-law/batch-008.md`, which **does not exist**, and to a
`handoff.md` that was still batch-007's. `validate-amends-regen-008.ts`'s usage comment invokes
`validate-amends-regen-007.ts`, and its own PASS line prints `VALIDATE-AMENDS-REGEN-007`.
The provenance `ref` stamped into all 577 edges is `"amends-regen-census-007"`.

### D4 — the F2 gate's named verification artifact is deleted from the tree

`ledger.json → batch008F2Deletion.codeFix` cites "verified via `f2-title-gate-test.ts`". That file
is `D` in `git status` — it survives only inside commit `9abfde1` (whose subject is about a
different case). The named verification is not re-runnable from the working tree. This did not
impede me — I re-derived the gate from scratch — but a ledger should not cite a file that is not
there.

### D5 — the close-read coverage block does not sum

`coverage`: `previouslyReadAcrossAllBatches: 51` + `closeReadThisBatch: 12` +
`remainingUnread: 117` = **180 ≠ 176**. The `method` string's own chain (129 unread → 12 read →
117 remain) is internally exact, so `remainingUnread` is right and the mis-scoped field is
`previouslyReadAcrossAllBatches` (all-history, while its neighbours are scoped to the 176).

### D6 — `batch008ReTriage`'s "churn re-ranking DONE and verified" is a byproduct, not work

`beforeTop10` is **byte-identical** to batch-007's. `afterTop10` differs only in that 89/2012 goes
7 → 6 (the tisk 36 deletion) and three equal-count rows shuffle behind it. "40/2009 takes #1 with
12 edges" was batch-007's result, and — per D2 — that state is **already live**, so it is a
description of the current graph, not a pending re-ranking. Separately, not one of the ledger's
141 `rows` was touched; they are still on the 150-edge topology.

---

## Spot-checks of the 12 close-reads — 7 of 12 re-derived from cached text

Beyond `90-221` (D1), I applied the presence-claim discipline myself: every long quoted string in
every pair's reasoning, checked for occurrence in **both** bills.

- **`56-234` → `confirmed`: holds, and its presence claim is real.** The quoted opening sentence
  *"Přestupky podle tohoto zákona projednává inspektorát, s výjimkou přestupků a) podle § 17a
  odst. 1 písm. b)"* occurs in **both** bills' cached text. Genuine duplicate `§ 17d` insertion.
- **`102-111` → `confirmed`: holds.** tisk 102 item 6 is *"V § 102a **odstavec 1 zní:**"* (full
  rewrite); tisk 111 item 4 is *"V § 102a odst. 1 se za slovo „pornografií“ **vkládají slova**"*
  (insertion assuming the pre-edit text). Real collision, correctly hedged.
- **`7-221` → `confirmed` stands; one-third of its stated evidence is misattributed.** The
  reasoning leads with *"BOTH bills insert a NEW odstavec numbered 8 into **§ 4**"*. Neither bill
  does: `V § 4 se za odstavec` → **0 hits in both**. Both insertions are into **§ 48**
  (tisk 7: *"V § 48 se za odstavec 7 vkládá nový odstavce 8"*; tisk 221: *"…vkládají nové
  odstavce 8 a 9"*) — verified, 1 hit each. The `§ 4` partition hit is a citation *inside* those
  §48 insertions, i.e. the citation-only incidental artifact. The classification is right and the
  real collision is **stronger** than described; the sentence is wrong.
- **`64-143` → `incidental`: holds exactly as written.** tisk 64 edits §27b odst.1/odst.4 and
  §27e odst.2; tisk 143 edits §27b odst.5, §27c odst.5, §27e odst.3. Different odstavce
  throughout, both transposing the same EU directives.
- **`73-161` → `coordination_risk`: holds.** tisk 73: *"V § 59 odst. 3 se číslo „60“ nahrazuje
  číslem „59“…"*; tisk 161: *"V § 59 se na konci odstavce 3 doplňují věty…"*. Same odstavec,
  non-contradictory, order-dependent. Accurate.
- **`65-154` → `coordination_risk`: holds** (arguably under-called). tisk 65 item 13 inserts a
  sentence *after* věta první of §14 odst.4; tisk 154 item 15 appends words *to* věta první of the
  same odstavec. Both touch the same sentence.
- **The `emergentFinding` N-way cluster is real.** All four of tisk 7/111/207/213 contain exactly
  one `V § 88 odst. 2 písm. c)` instruction, each editing a different substring of the same
  confiscation-predicate enumeration in 40/2009. Verified by grep in all four.

Of 7 re-derived: **5 hold as written, 1 was already retracted and the retraction is correct, 1
holds with a misattributed limb.** The five not re-read here (`7-207`, `25-187`, `111-207`,
`207-213`, `77-206`) are all `coordination_risk`/`incidental` — the low-stakes classes.

**The method gap is the durable finding.** A close-read that asserts "identical" / "duplicate" /
"the same text" is a *presence claim about two documents*. `90-221` failed because a second model
read replaced a grep — while the F2 deletion payload, in the same batch, did exactly the right
thing and re-verified every excerpt against the file. That discipline needs to apply to the
close-reads too, as a five-line script run before any classification is written.

---

## What checked out clean (recorded with equal weight)

- **The F1 clip is exactly the audit's prescription, improved.** Bounding the boundary to `< end`
  is strictly more correct than the one-liner the round-2 audit proposed.
- **The edge delta is exactly `+1 / −5` and nothing else** — verified by set-differencing the
  payload against the live graph *and* by set-differencing batch-007's payload against batch-008's.
- **Every `amends-census.ts` output reproduces 140/140** against an independently written
  extractor, on `realLaws`, `structure` **and** `repealedRefs`.
- **The regen stats are internally consistent**: 55 + 77 + 9 = 141 bills; 582 citations = 577
  resolved + 5 unresolved; `distinctMissingLawStatutes: 5` matches the array; the citation
  universe is honestly **not** claimed closed.
- **The precision measurement reconciles**: 577 = 476 `census_full` + 101 `title_fallback`
  (batch-007's 475/106, moved by exactly +1/−5); 573 high / 4 low; the 4 low-confidence edges are
  the same four batch-007 hand-verified as real (87/1995, 141/1961, 99/1963, 2/1969).
- **`repealedRefsByCislo`'s `!realLaws.includes(ref)` guard still behaves.** tisk 88 carries
  `151/2025` in **both** `realLaws` and `repealedRefs`; the guard correctly does not suppress it,
  and `88 → 151/2025` survives into the payload.
- **The deletion payload is the batch's strongest artifact** — per-edge cached-text excerpts,
  a named false-edge class, `realTargetsOfThisBillUnaffected` on every entry, `liveConfirmed`
  checked against the store, and an unflinching note that the union's own founding worked example
  was itself the false edge. Every one of those claims survived my independent re-derivation.
- **No bill is orphaned by the deletion.** Every one of the five bills retains 1–4 real edges.
  Two *law* nodes (`468/1991`, `360/2025`) drop to zero incoming `amends` edges — correct, they
  were never amended by this session's bills; the orchestrator may want to decide whether such
  nodes are retired or left in place, but nothing breaks.
- **No live write.** `./.pglite` opened read-only only; `.pglite-copy-law-008-audit` created from
  `.pglite-copy-law-005` and deleted; `git diff` on the payload directory empty.

---

## Summary

| # | finding | severity | blocks apply? |
|---|---|---|---|
| — | F1 clip: correct, 1-bill blast radius, 0 false-positive incidence (47 candidate blocks, 1 change) | — | **clean** |
| — | F2 gate: drops exactly the 5, keeps the 2 genuine rescues; no 6th false edge exists in this corpus | — | **clean** |
| — | All 5 deletions re-verified false from source; node ids and live-confirmation correct | — | **clean** |
| — | Full pipeline reproduces: 577 edges, validator PASS 5/5, live diff 1 added / 5 dropped / 0 unallowlisted | — | **clean** |
| D1 | `ledger.json` still publishes the retracted `confirmed: 4`; the payload says 3 — self-contradiction | **medium** | no (fix before reporting) |
| D2 | regen stats / impact note / ledger totals all computed against the superseded 150-edge baseline; `edgeCountDelta: 427` invites a wholesale re-apply of a 6-edge change | **medium** | no (fix before reporting) |
| D3 | provenance prose claims a batch-008 self-review and a batch-008 independent audit that had not happened; `.pglite-copy-law-007` and `batch-008.md` are dangling | low | no |
| D4 | `f2-title-gate-test.ts`, cited as the F2 verification, is deleted from the tree | low | no |
| D5 | close-read `coverage` sums to 180, not 176 | low | no |
| D6 | "churn re-ranking DONE" is batch-007's result, already live; 141 ledger rows untouched | low | no |
| L1 | `amends-census.ts` does not NFC-normalize; 3 documents demonstrably under-match — **latent, 0 realised** | low (latent) | no |
| L2 | the `Čl.` *citation* slice is still unclipped at a `ČÁST` boundary — 0/797 realised | low (latent) | no |
| L3 | `isFirst` is a positional heuristic 116/116 correct here; one stray cover-page citation would delete a primary edge — contained by the deletion-diff gate | low (latent) | no |

**Recommendation to the orchestrator.** Execute the change-set: add `tisk 215 → 280/2009`, delete
the 5 F2 edges. They are false public claims rendering today, and the correction is verified to
the source. Before the batch is written up as ready, do the two cheap fixes that matter: **(1)**
propagate the `90-221` retraction into `ledger.json` (`confirmed: 4 → 3`, `incidental: 3 → 4`),
and **(2)** re-base every count on the applied live graph and state the delta as **+1 / −5, not
+427**. D3–D6 and L1–L3 are one-line each and can ride along.

---

*Auditor's note on completeness. I did not re-litigate the ČÁST splitter, the act-type gate, the
missing-law-node census, the `psp-legislation.ts` title regex, or the round-2 repeal/transitional
gates — those cleared two prior independent passes and batch-008 does not touch them. I re-read 7
of the 12 close-reads and 5 of the 141 census rows in raw form beyond the corpus-wide automated
checks. Everything in this report was derived by me; where it agrees with `batch-008-reflection.md`
(D1, D2, and the `7-221` §4 misattribution) I reached it separately and by a different method
(grep and set-math against the live store, versus that pass's artifact cross-reading).*
