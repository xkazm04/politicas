# batch-007 round-2 delta — independent audit (Opus #3, narrow scope)

**Date:** 2026-07-25 · **Scope:** the round-2 delta ONLY — `REPEAL_MARKER`,
`NON_AMEND_ART_HEADING_RE`, the `ČÁST` "Změna" sub-heading gate, the single-subject title-verb
gate, `repealedRefsByCislo` union-suppression, and the 4 hand-verified low-confidence edges.
The core extraction (ČÁST splitter / N1 recall recovery / validator / act-type gate) was
deliberately NOT re-litigated — it already cleared an independent reproduction.

---

# VERDICT: **APPLY**

The round-2 delta **cannot introduce a false edge**. I tested that claim rather than reasoned it:
corpus-wide, the round-2 gates only ever *remove* citations (7 of them, listed below), never add
one — the "fall-through to the next citation" risk that `firstEligibleCitation`'s repeal-skip
creates in principle fires **zero** times on the real corpus. Every one of the four false edges
the reflection pass named is gone, at the source, and the 24-bill over-suppression regression the
driver self-caught is genuinely fixed rather than narrowed.

I found **one real defect** (F1, tisk 215 — a true amending citation suppressed by heading-window
bleed) and **one out-of-scope finding the delta does not cause but does perpetuate** (F2 — five
false edges arriving through the title-derived union). Neither justifies a fourth hold:

- **F1 costs one missing edge, not a false one.** The lost edge is **not live today**, so applying
  does not delete anything true; it is a recall gap of exactly the class this batch already
  discloses. Fixing it is a one-expression change, and it should be fixed — in batch-008, not by
  re-opening batch-007.
- **F2's five false edges are all already live.** Applying this payload does not add them; it
  preserves them while removing four other confirmed-false live edges. Holding the batch over
  pre-existing defects it never claimed to fix would make the graph strictly worse than applying.

Applying remains conditional on the payload's own already-documented mechanical precondition:
`apply-amends-regen.ts` is stale and must be re-pointed before any live run (`boundary` field,
handoff §2). That is disclosed, not a new finding.

---

## What I did

Everything below was run against the **real cached bills** (`.data/law-collision-cache`, 140 bills
with text; tisk 87 has no PDF), never against the code alone. Read-only throughout: two throwaway
`.pglite` copies (`.pglite-audit` from live, `.pglite-r2audit` from `.pglite-copy-law-005`), both
deleted afterwards; all scratch scripts under a gitignored path, since removed. `git status` is
clean — the only file I touched in the repo is this one. (I re-ran `measure-precision-007.ts`,
which rewrote its own output JSON with a new `generatedAt`; I reverted that file with
`git checkout --`, and confirmed the timestamp was the *only* difference.)

**Baseline reproducibility.** I extracted `extractRealAmendedLaws` and its helpers verbatim from
the committed `amends-census.ts` into a harness, replayed the operative-slice derivation from
`processBill`, and re-ran all 140 bills: `realLaws`, `structure` and `repealedRefs` match
`batch-007-amends-census.json` **exactly, 140/140, 0 mismatches**. `validate-amends-regen-007.ts`
reproduces 5/5 PASS, 0 errors, 0 warnings; `measure-precision-007.ts` reproduces 577 high / 4 low
/ 0 unresolvable; the live-graph deletion set reproduces as exactly the 4 allowlisted edges and
nothing else. So the artifacts under audit are the artifacts the code produces.

---

## Finding F1 — **the heading gate over-fires once: tisk 215 loses a real amendment to the tax code**

**Severity: MEDIUM (recall). Not a false edge. Not a live-edge deletion.**

`amends-census.ts:326` builds a Čl. block's heading area as *150 chars of lookback + the first 320
chars of the block's slice*. The block's end is the **next `Čl.` marker** — it is not clipped at
an intervening `ČÁST` boundary. So a Čl. article whose own body is shorter than 320 characters
swallows the **following ČÁST's heading**, and is gated on a heading that is not its own.

tisk 215 (`.data/law-collision-cache/tisk-215/…txt`), verbatim from the operative text:

```
                                              ČÁST SEDMÁ
                                        Změna daňového řádu
                                                Čl. XI
      § 124a zákona č. 280/2009 Sb., daňový řád, ve znění zákona č. 458/2011 Sb., se zrušuje.

                                              ČÁST OSMÁ
                                              ÚČINNOST
```

`Čl. XI`'s body is ~95 characters. `NON_AMEND_ART_HEADING_RE` matches the `ÚČINNOST` line of
**ČÁST OSMÁ**, 40-odd characters past the end of ČÁST SEDMÁ, and the block is skipped outright.
Its own heading — one line above the marker — literally reads *"Změna daňového řádu"* (Amendment
of the Tax Code). Deleting `§ 124a` of law 280/2009 *is* an amendment of 280/2009; this is the
same operation the extractor accepts everywhere else.

Consequences, all verified against the payload and the live graph:

- `tisk 215` census `realLaws` = `["111/1998","121/2008","150/2002","412/2005","500/2004","99/1963"]`
  — **`280/2009` absent**; payload has no `tisk 215 → 280/2009` edge.
- Worse, the gated block's citation is captured into `repealedRefs`
  (`["150/2002","99/1963","412/2005","121/2008","280/2009"]`), so if the title path ever carried
  `280/2009` for this bill, `repealedRefsByCislo` would actively **suppress** the rescue. Here it
  doesn't (the title doesn't carry it), so the damage is one missing edge.
- This is a **round-2 regression**: with the round-2 gates disabled, the same extractor yields
  `280/2009` for tisk 215. It was not present in the 4-edge delta the batch reports, and none of
  the driver's checks (12-bill regression set, corpus re-run, validator, precision proxy,
  repeal-heading sweep) is shaped to catch it — the precision proxy scores only edges that exist.
- Live graph check: `tisk 215` currently has one live `amends` edge (`150/2002`). `280/2009` is
  **not** live, so applying deletes nothing true.

**Corpus incidence: exactly 1.** I searched for the general form — every gated `Čl.` block where
the firing marker's absolute position lies past an intervening `ČÁST` line — across all 140 bills:
one hit, tisk 215 Čl. XI. I also checked the mirror-image case in the `ČÁST` path (a short part
whose 320-char window reaches the *next* part's "Změna" heading, which would falsely **accept** a
block): **0 hits**. And I checked whether any gate ever fired on prose rather than a heading line
(line >70 chars or sentence-shaped): **0 of 246** gated blocks.

**Smallest fix** — clip the forward heading window at the block's own `ČÁST` boundary, in
`amends-census.ts` around line 326:

```ts
const castRe = /\n\s*ČÁST\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g;
castRe.lastIndex = start + 1;
const nextCast = castRe.exec(operative)?.index ?? Infinity;
const fwdEnd = Math.min(start + HEADING_WINDOW, end, nextCast);
const headingArea = operative.slice(Math.max(0, start - 150), start) + operative.slice(start, fwdEnd);
```

I verified by re-running the full corpus with this clip that it changes exactly one bill
(tisk 215 regains `280/2009`) and no other `realLaws`, `repealedRefs` or `structure` value moves.

---

## Finding F2 — **five false edges reach the payload through the title-derived union**

**Severity: MEDIUM. Out of the round-2 delta's scope — the delta neither causes nor fixes it —
but it is the highest-value next target, and all five are false public claims.**

I surfaced these while auditing the suppression layer, not by re-auditing the pipeline: the
round-2 design makes `repealedRefs` the *only* discriminator applied to title-derived refs, so
"which other title-derived refs are wrong?" is precisely the delta's blind spot.

Of the payload's 106 `title_fallback` edges, 99 are corroborated by the bill's own census
`realLaws`. Seven are not, although the census parsed those bills successfully. Reading the cached
text, **two are true** (census recall gaps the union correctly rescues — tisk 107 → 159/1999 and
tisk 243 → 223/2016 both name their target only in the bill title and the ČÁST heading, never in
the operative text) and **five are false**:

| bill | false ref | why it is false (verbatim from the bill's own title/text) |
|---|---|---|
| tisk 153 | `468/1991` | The ref appears **only inside the official name of the target law**: "zákon č. 40/1995 Sb., o regulaci reklamy a o změně a doplnění **zákona č. 468/1991 Sb.**, o provozování rozhlasového a televizního vysílání". The bill's operative text then *deletes that very phrase*: "V názvu zákona se slova „a o změně a doplnění zákona č. 468/1991 Sb. …“ zrušují." It does not amend 468/1991. |
| tisk 88 | `360/2025` | Lineage, not target: "kterým se mění zákon č. 151/2025 Sb., o dávce státní sociální pomoci, **ve znění zákona č. 360/2025 Sb.**". Census correctly extracts `151/2025` from `ČÁST PRVNÍ Změna zákona o dávce státní sociální pomoci`. |
| tisk 124 | `300/2025` | Lineage: "…a zákon č. 152/2025 Sb., …, **ve znění zákona č. 300/2025 Sb.**". Census correctly has `117/1995` and `152/2025`. |
| tisk 36 | `89/2012` | Nested name: the bill amends the *amending* law — "V části čtrnácté zákona č. 268/2025 Sb., **kterým se mění zákon č. 89/2012 Sb., občanský zákoník**, …, se slova „1. ledna 2026“ nahrazují". Census correctly has `268/2025` alone. |
| tisk 42 | `416/2009` | Same nested-name shape: "V čl. VIII bodě 1 zákona č. 465/2023 Sb., **kterým se mění zákon č. 416/2009 Sb.** …". Census correctly has `465/2023` alone. |

Two things worth naming plainly:

1. **All five are already live edges.** I diffed the payload against the live `.pglite`: every one
   of the seven non-corroborated title edges is in today's 150-edge graph. Applying this payload
   does not introduce them. This is why F2 does not block.
2. **`tisk 88 → 360/2025` is the union's own founding example.** `amends-regen-007.ts:181-184`
   justifies unioning instead of replacing with "The body extraction can miss a statute the title
   records (e.g. tisk 88 / 360/2025) — a replace silently drops a live edge." That specific
   citation is a lineage reference, i.e. the documented rationale for the union is itself a false
   edge. The *general* argument for the union survives — tisk 107 and tisk 243 are genuine rescues
   — but the worked example should be swapped for one of those two, and the comment corrected.

**Smallest fix (for batch-008, not for this apply):** gate the title-derived path per citation on
the ref's syntactic role in the full (non-truncated) title, rejecting refs immediately preceded by
`ve znění zákona č.` and refs that sit inside another cited law's name (`zákon č. X Sb., kterým se
mění zákon č. Y Sb.` → keep X, drop Y). On this corpus that rule removes exactly the five above
and keeps tisk 107 and tisk 243. Note it must read the bill's **full title**, not `node.label` —
74/140 labels are truncated at 200 chars, the same trap that defeated the round-1 title gate.

---

## What I tested and found clean

Stated with enough specificity that the thoroughness can be judged rather than trusted.

**1. The structural repeal/transitional exclusion catches everything it was built for.**
All four reflection-named false edges are absent from the payload, each killed at the census layer
rather than allowlisted:

| bill | ref | mechanism that kills it | census result |
|---|---|---|---|
| tisk 129 | `223/2016` | `Čl. I` heading area contains `Zrušují se:` (label-truncation-proof — reads operative text) | `realLaws=[]`, `repealedRefs=["223/2016"]` |
| tisk 64 | `25/2017` | `Čl. CXLIII` heading = `Přechodné ustanovení` | 147 real targets kept, `25/2017` in `repealedRefs` |
| tisk 231 | `348/2005` | `Čl. III` gated via the 150-char lookback picking up `ČÁST TŘETÍ Přechodné ustanovení k části první a druhé` | `realLaws=["483/1991","484/1991"]` — both real amendments retained |
| tisk 116 | `353/2019` | single-subject non-amending (`§1 Zrušují se: 1. Zákon č. 353/2019 Sb.`) + `isPureRepealTitle` | `realLaws=[]` |

The live-graph diff confirms these are exactly the 4 deletions the payload proposes, matching the
allowlist entry-for-entry, with **0 unallowlisted deletions**.

**2. Gate-on/gate-off differential over the whole corpus — the decisive over-fire test.**
Running the identical extractor with the round-2 gates disabled and diffing per bill:
**7 refs removed, 0 refs added.** Six of the seven removals are unambiguously correct:

- tisk 129 → `223/2016` — "ČÁST PRVNÍ Zrušení zákona … Čl. I Zrušují se: 1. Zákon č. 223/2016 Sb."
- tisk 231 → `348/2005` — transitional article re-citing the repealed statute
- tisk 64 → `25/2017` — "Čl. CXLIII Přechodné ustanovení … postupuje podle zákona č. 25/2017 Sb."
- tisk 90 → `76/2005` — "ČÁST DESÁTÁ ZRUŠOVACÍ USTANOVENÍ Čl. XV Zrušují se: 1. Vyhláška č. 76/2005 Sb."
- tisk 24 → `553/2020` — "Čl. V Přechodné ustanovení … v příloze vyhlášky č. 553/2020 Sb."
- tisk 235 → `357/2025` — "Čl. III Zrušovací ustanovení Nařízení vlády č. 357/2025 Sb. … se zrušuje."

The seventh is F1. That "0 added" figure is the load-bearing one for the apply decision: the only
way the round-2 delta could *manufacture* an edge is `firstEligibleCitation` skipping a
repeal-context citation and falling through to a later one (e.g. deep inside a long `Zrušují se:`
list, past the 400-char context window). It never happens here — the block-level heading gate
always fires first. I also confirmed independently that **no** accepted citation anywhere in the
corpus has a `REPEAL_MARKER` earlier in its own block (0/580), and swept for whole-law repeal
constructions in forms `REPEAL_MARKER` deliberately does not match (`Zrušuje se zákon` singular,
`Zrušují se` without colon, `Zákon č. X Sb. … se zrušuje`): 25 repeal sites found corpus-wide, and
**none** of the repealed statutes appears in that bill's `realLaws`. The one apparent hit was my
own regex misfiring on tisk 187's "…zákona č. 29/2000 Sb., … se bod 2 zrušuje" — an amendment
deleting a point, not a repeal.

**3. The 24-bill over-suppression regression is genuinely gone, not narrowed.**
I re-derived the suppression both ways rather than trusting the reported counts. With the shipped
`!r.realLaws.includes(ref)` guard, `repealedRefsByCislo` suppresses **4** title-derived refs
corpus-wide — precisely `tisk 64 → 25/2017`, `116 → 353/2019`, `129 → 223/2016`, `231 → 348/2005`,
i.e. only the intended four and nothing else. Without the guard it would suppress **57**, wrongly
killing **53 refs across 49 bills** (tisk 11 → 589/1992, tisk 121 → 586/1992 + 117/1995 + 187/2006,
tisk 162 → 99/1963 + 549/1991, …). The guard's discriminator — "is this ref also a genuine target
elsewhere in the same bill" — is the correct one and is doing real work.
`isPureRepealTitle` fires on exactly **1** bill (tisk 116), dropping exactly 1 title ref. There is
no over-broad blanket rule left in either layer.

**4. The 150-char lookback does not over-fire.** 246 `Čl.` blocks are gated in total; **61** are
gated *solely* because of the lookback. I read all 61: every one is an `ÚČINNOST` or transitional
article wrapped in an outer `ČÁST` whose heading sits above the `Čl.` marker — exactly the case
the lookback was added for. **0** gated blocks contain a `se mění takto` construction anywhere in
their full body. (Latent, not realised here: a *short* transitional article immediately preceding a
real amending article could bleed into that article's lookback. In this corpus the intervening
`ČÁST` heading or article length always prevents it. Worth a regression case if the corpus grows.)

**5. The `ČÁST` "Změna" gate decides correctly in both directions.** 41 parts accepted — I read
every heading: all 41 carry a genuine `Změna zákona o …` sub-heading and a plausible target
(tisk 250's 10 parts, tisk 69's 7, tisk 189's 4, tisk 113's 4, tisk 10's 4, tisk 54's 4, …).
Of the parts skipped, **0** contain `se mění takto`; broadening to any amending construction
(`se nahrazují|se vkládá|nově zní|se doplňuje|zní:`) leaves 2 flags — tisk 63 ČÁST DESÁTÁ
(*Vykazování informací mimo účetní závěrku*) and tisk 144 ČÁST PRVNÍ (*Úvodní ustanovení*) — both
36k–55k-char bodies of the bill's **own new law**, where the phrase occurs incidentally. Neither
is an amending part. The genuinely repeal-shaped skips are right too: tisk 250 ČÁST DVANÁCTÁ
`ZRUŠOVACÍ USTANOVENÍ` and tisk 228 ČÁST PÁTÁ `ZRUŠOVACÍ USTANOVENÍ` (a *vyhláška*, not even an
act) both contribute nothing.

**6. The single-subject title-verb gate is inert on this corpus and cannot create a false edge.**
Only 5 bills reach it (6, 52, 55, 114, 116). All five test `false` on `AMENDING_TITLE_RE`, and I
confirmed independently that none of the five contains an amending construction anywhere in its
operative text — four are brand-new standalone acts (*Úřad pro prevenci korupce a střetu zájmů*;
electronic-evidence act; network-cost act; CBAM act) and the fifth is tisk 116's pure repeal. The
gate therefore never fires positive, so its false-edge surface on this corpus is empty. Its
false-*negative* surface (a genuine single-subject novela whose title verb sits past char 600 of
the operative slice) is unexercised — no such bill exists here.

**7. The 4 low-confidence edges: hand-verification re-done from raw text, not inherited.**
I did not take the driver's word; I pulled each citation's raw context out of the cached operative
text with line breaks preserved. All four are real, and each sits directly under an explicit
amending heading:

- **tisk 7 → 87/1995** — `ČÁST SEDMÁ / Změna zákona o spořitelních a úvěrních družstvech / Čl. VII / V § 25b odst. 3 písm. q) zákona č. 87/1995 Sb., …`
- **tisk 10 → 141/1961** — `ČÁST DRUHÁ / Změna trestního řádu / § 12 / Zákon č. 141/1961 Sb., o trestním řízení soudním (trestní řád), …`
- **tisk 64 → 99/1963** — `ČÁST PRVNÍ / Změna občanského soudního řádu / Čl. I / Zákon č. 99/1963 Sb., občanský soudní řád, …`
- **tisk 250 → 2/1969** — `ČÁST DRUHÁ / Změna zákona o zřízení ministerstev … / § 49 / Zákon č. 2/1969 Sb., …`

The proxy misses them for the stated reason (a 90-line amendment-history lineage pushes the verb
outside ±2500 chars). The hand-verification holds. Incidentally, two of them (tisk 10, tisk 250)
sit one line below a bare page number on its own line — `isFootnoteLine`'s 5-hop walk-back stops at
the intervening blank line, so they survive. That is correct here but narrow; if pdftotext ever
emits the page number contiguously with a preceding footnote line, these citations would be
silently dropped. Round-1 code, flagged only as a fragility.

**8. No modification of the extraction, no live writes.** `git status` clean; the two `.pglite`
copies deleted; the only repo file written is this report.

---

## Summary table

| # | finding | severity | in the round-2 delta? | blocks apply? |
|---|---|---|---|---|
| F1 | tisk 215 `Čl. XI` gated by the *next* ČÁST's `ÚČINNOST` heading — real amendment to `280/2009` lost; also poisons `repealedRefs` | medium (recall) | **yes — a round-2 regression** | no (edge is not live; no false claim) |
| F2 | 5 false title-derived edges (tisk 153/88/124/36/42), incl. the union's own documented example | medium (precision) | no (pre-existing union path) | no (all 5 already live) |
| — | repeal/transitional exclusion, ČÁST gate, single-subject gate, `repealedRefsByCislo` guard, 4 low-confidence edges | — | yes | **all clean** |

**Recommendation to the orchestrator:** apply, after re-pointing `apply-amends-regen.ts` as the
payload's `boundary` field already requires. Carry F1 and F2 into batch-008 as two small, precisely
scoped fixes with the corpus cases named above as their regression tests. Do not hold the
regeneration a fourth time — the delta it was held for is sound, and the two defects that remain
both leave the graph better applied than unapplied.

---

*Auditor's note on completeness: this audit was narrow by instruction. I did not re-verify the
ČÁST splitter's +29 recall recovery, the act-type gate, the missing-law-node census, or the
title-extraction regex in `psp-legislation.ts` — those cleared an independent reproduction in
round 1. The `title_fallback` path (106 of 581 edges) is body-corroborated for 99 of them and,
per F2, is where the remaining known precision risk lives.*
