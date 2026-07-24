# Case ③ Law loop — batch-004 collision funnel (Q-law-10 partition fix + Q-law-9 full close-read)

**Run:** 2026-07-24 · fleet mode (law loop; concurrent money/effort work confirmed in the same
tree). No live `.pglite` writes (the v2 pre-check reads only `collision-groups.json` +
`.data/law-collision-cache/` — no DB needed, no copy made), no commits, boundary respected
(`scripts/case-loops/law/**`, `docs/data-analysis/case-law/**` only).

## Q-law-10 — the partition fix (`collision-check.ts --v2`)

`scripts/case-loops/law/collision-check.ts` gained a `--v2` mode (`runV2` +
`partitionParagraphsByStatute` + `fetchNavrhOperative`). Before matching § numbers between two
bills, each bill's §-set is now partitioned by WHICH statute each § belongs to, using the same
`Čl. N` article-boundary + first-`LAW_CITATION`-per-block convention `amends-census.ts` built for
the boilerplate-citation fix (shared regex imported from `lib/ingest/sources/psp-legislation.ts`).
A § only counts toward a collision group's `lawRef` if the bill's OWN novelization instructions
place it under an article block targeting that exact statute. The v2 pass reads the **návrh
zákona** document (the amending instructions, which carry the Čl. structure), not the
multi-statute "platné znění" dump that caused the tisk-248 contamination.

Output: `payloads/collision-report-v2.json` (original `collision-report.json` untouched).
71/71 bills fetched (all cached), 0 skips.

## The funnel

```
72 original candidate pairs (collision-report.json; = 2 prior-confirmed + 70 unconfirmed)
 └─ partitioned v2 pre-check
     ├─ 38 DIED  — same-§-number-different-statute (or citation-inside-new-text) artifacts
     │            (4 of these were batch-003 close-reads, ALL 4 already classified incidental —
     │             partitioning retroactively confirms those labels: 143↔248, 244↔248, 4↔248, 40↔248;
     │             the other 34 died without ever needing a close-read)
     └─ 34 SURVIVED
         ├─ 2 prior-confirmed (120↔244 batch-001; 111↔207 batch-002)
         ├─ 8 batch-003 close-reads (classifications stand: 3 confirmed, 2 coordination-risk, 3 incidental)
         └─ 24 NEW close-reads this batch (5 grouped Sonnet agents; every confirmed pair
             driver-verified by direct grep per P49):
             13 confirmed-collision · 6 coordination-risk · 5 incidental
```

Tisk-248-class examples of WHY pairs died: **143↔248** (47 "shared" §s — tisk 248's platné-znění
PDF bundles 5 statutes; its actual 256/2004 touch is only §134ha/§134l, neither in tisk 143's
set); **4↔248** / **40↔248** / **244↔248** (586/1992 §-numbers matched against tisk 248's
117/1995 / 262/2006 text); **111↔196** (40/2009 group, 10 shared §s — gone once each bill's §s
are scoped to the article actually amending 40/2009).

Two residual artifact classes the partition can't catch (found by close-read, classified
incidental): (a) §-numbers cited as **cross-references inside a bill's own newly-inserted
provisions** (tisk 124's "§ 30 odst. 1" inside new §30d text; tisk 46's "§ 113 trestního řádu"
inside new §395f — pointing at a different statute's § with the same number); (b) a **new
standalone act's own §-numbering** matched against its secondary "o změně" target (tisk 62's
right-to-repair act §2/§3/§5/§13/§15 vs 634/1992 — its only real 634/1992 touch is one Annex-3
row).

## Batch-004 close-read results (24 new pairs)

**Confirmed-collision (13):**

| pair | statute · § | why it's real (grep-verified) |
|---|---|---|
| 112↔121 | 117/1995 §30(1)+§31(3) | both replace the literal "350 000 Kč" (→370 000 vs →400 000) AND both issue full "§31 odstavec 3 zní" rewrites with different final texts |
| 112↔198 | 117/1995 §30(1) | same "350 000 Kč" target, →370 000 vs →400 000 |
| 121↔198 | 117/1995 §30(1) | literally identical instruction in both ("350 000"→"400 000") — second-enacted bill's target string is already gone |
| 4↔121 | 586/1992 §35c(1) | same source string "15 204 Kč" → 22 320 (tisk 4) vs 22 380 Kč (tisk 121); tisk 4 also deletes text tisk 121's second substitution needs |
| 121↔120 | 586/1992 §35c(1) | tisk 121 substring-substitutes amounts in the unlettered odst.1; tisk 120 wholesale-replaces odst.1 into an a)/b) structure |
| 71↔248 | 427/2011 §60(4) | tisk 71 deletes the phrase "…nejvýše 15 %"; tisk 248 search-and-replaces inside that exact phrase (15 %→10 %) |
| 12↔131 | 491/2001 §§3/56/57/58/58a/58b/66 | two independently-filed bills carrying a word-for-word IDENTICAL by-elections reform (§56 sentence + §58a texts byte-identical) |
| 15↔72 | 90/1995 §67 (+§54/59/60/95a) | identical "dosavadní text → odstavec 1 + new odstavec" restructuring instruction with divergent new content; both fully rewrite §95a differently |
| 85↔88 | 110/2006 §7(2)(h) | both insert a NEW "bod 12" at the same list slot with different wording |
| 104↔232 | 561/2004 §30(3) | rewrite-vs-delete: tisk 104 "odstavec 3 zní" (mobile-phone policy) vs tisk 232 "odstavec 3 se zrušuje" + renumbering + §136 cross-ref fix |
| 28↔140 | 243/2000 §3 (+§4/§6) | overlapping full rewrites of §3(2): tisk 28 keeps the Prague carve-out in písm. f)/g), tisk 140 drops it (grep: 0 occurrences); incompatible §6(4) cross-ref fixes (odst.13 vs odst.12) |
| 28↔141 | 243/2000 §3 (+§6) | both rewrite §3 but assign DIFFERENT content to odst.(3) (Prague rule vs road-km data-source; 141 moves the Prague rule to a new odst.13) |
| 140↔141 | 243/2000 §3 (+§4/§6) | two mutually exclusive full rewrites of §3(2–6) from the SAME submitter (Pardubický kraj initiative) — Prague in vs out of the formula pool, different coefficients, plus byte-identical duplicate §4 instructions |

**Coordination-risk (6):** 119↔248 (586/1992 §15b — non-overlapping substring edits, but 248's
odst-renumbering breaks 119's "odst. 4" reference), 121↔244 (586/1992 §35c(1) — numeral edits in
sentence 1 vs insertion after sentence 1), 207↔216 (40/2009 §283(1) — restructure-around vs
word-insert; the §283a match is an artifact), 57↔153 (375/2022 — 153 anchors new §53b to a §53a
that only tisk 57 creates), 78↔238 (245/2000 §4(1) — two combinable list insertions at different
anchors), 171↔246 (13/1997 §21(4) — narrow phrase swap vs full odst.3–5 rewrite).

**Incidental (5):** 46↔196, 53↔62, 112↔124, 121↔124, 124↔198 — all residual-artifact classes (a)
and (b) above; each explained with grep evidence in the payload.

**New N-way clusters** (extending batch-003's §35ba pattern; group by statute+§, not pair):
- **117/1995 §30(1): a THREE-way cluster** — tisky 112, 121, 198 all target the literal
  "350 000 Kč" with three instructions (→370 000 / →400 000 / →400 000). tisk 124 grep-confirmed
  NOT in the cluster (zero "V § 30" amending instructions).
- **243/2000 §3: a THREE-way cluster** — tisky 28, 140, 141 all issue overlapping full rewrites
  with three different formulas (all three pairs confirmed).
- **586/1992 §35c(1) now a FOUR-bill complex** — 4, 120, 121, 244 all touch it (4↔121 and 121↔120
  confirmed this batch, joining batch-003's 4↔120/4↔244 and batch-001's 120↔244).

## Running 4-batch totals (all close-read pairs, all batches)

| classification | b-001 | b-002 | b-003 | b-004 | total |
|---|---|---|---|---|---|
| confirmed-collision | 1 (120↔244) | 0 | 3 | 13 | **17** |
| coordination-risk | 0 | 1 (111↔207) | 2 | 6 | **9** |
| incidental | 0 | 0 | 7 | 5 | **12** |
| **close-read total** | 1 | 1 | 12 | 24 | **38** |

## Backlog status: CLOSED

All 72 original candidate pairs are now accounted for: **38 close-read** (17 confirmed / 9
coordination-risk / 12 incidental) + **34 died in the partitioned v2 pre-check** as deterministic
same-number-different-statute artifacts (each listed with reason in
`collision-report-v2.json → diedPairs`). No pair remains untouched and unexplained.

Note the confirmed rate among genuinely-partition-surviving, newly-read pairs (13/24 = 54%) is
far above batch-003's 3/12 — exactly the expected effect of the partition fix: the artifact
class that diluted the candidate list is now filtered before the close-read, so what survives is
mostly real.

## Files

- `scripts/case-loops/law/collision-check.ts` — `--v2` partitioned mode (default no-flag run
  unchanged, still reproduces the original report).
- `docs/data-analysis/case-law/payloads/collision-report-v2.json` — corrected candidate set +
  survived/died funnel.
- `docs/data-analysis/case-law/payloads/collision-close-reads-batch004.json` — 24 close-reads,
  driver grep verifications inline.
- `docs/data-analysis/case-law/payloads/batch004-inputs.json` +
  `batch004-group-inputs/g{1..5}.json`, `g{1..5}-results.json` — army inputs/outputs audit trail.
- `docs/data-analysis/case-law/payloads/collision-report.json` — original, untouched.
