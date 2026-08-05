# Batch-015 adversarial audit — pass-49 closure gate

**Auditor:** fresh, independent, no prior involvement in batch-015.
**Date:** 2026-08-05.
**Scope:** 10 verdicts (`payloads/verdicts-015/`), the old-27 jargon sweep, the two
collision close-read waves, and the reader-facing dependency surface.
**Constraints honoured:** no payload or source file edited, no git operation, no PGlite read.

---

## VERDICT: **NOT READY**

Twelve BLOCKING defects. The pass-49 write must not proceed.

The decisive one is Priority 1. **CEVYKO a.s. is not a private company.** Verdict-161's
`medium` severity, its "prioritní lidské ověření" recommendation, and its entire
conflict logic rest on the claim that CEVYKO is "soukromá firma podnikající přímo
v oboru". CEVYKO a.s. is owned by statutární město Havířov (35 %), ASOMPO, a.s. (an
association of 45 municipalities) and Spolek pro nakládání s komunálním odpadem, z. s.
— it is an inter-municipal waste company, the same category the same paragraph
*excludes* for Hladík. Bohuslav Niemiec's seat on it is a **dozorčí rada** seat. The
verdict states privateness as settled and carries no ownership hedge anywhere.

The second structural problem is that **the batch contradicts itself about the same
company on the same statute**, and the third is that **the repo's own gate cannot see
any of this**: all 10 verdicts return `ok: true` from `validateLawVerdict()` with zero
errors and zero `lawJargonIssues` hits. A schema-valid, jargon-clean, Czech-clean
verdict asserting a false ownership fact and two arithmetic errors is precisely the
failure mode `CLAUDE.md` already records for pass 42 — *"nothing in the suite could see
the difference."*

Positively: several findings in this batch are **earned and well-built**, and one prior
batch defect is demonstrably fixed (see §7). The batch is close, not broken.

---

## 1. BLOCKING

### B1 — `verdict-161.json` · `conflictAssessment`, `citations[4]` · CEVYKO is municipally owned; the core positive claim is false

Verdict text:

> "…jde o **soukromou firmu** podnikající přímo v oboru, jehož regulaci tento tisk mění."

Register + public record:

- Seat `Svornosti 86/2, Město, 736 01 Havířov` — the Havířov magistrate address.
  Incorporated 10 Oct 2019, 92 000 registered shares, nominal CZK 92 m.
- Shareholders: **statutární město Havířov** (35 %), **ASOMPO, a. s.** (45 municipalities
  of Novojičínsko, 35 %), **Spolek pro nakládání s komunálním odpadem, z. s.** (30 %).
- CEVYKO = *Centrum pro využití komunálního odpadu*, a municipal facility for up to
  57 municipalities, ~100 kt/yr, planned operation 2028.
- **Bohuslav Niemiec sits on the dozorčí rada**, not the představenstvo, and holds no
  shareholding on the record.

Three consequences, each independently blocking:

1. **The claim is false as written.** "Soukromá firma" is contradicted by the ownership
   structure.
2. **The verdict applies two standards in one paragraph.** It excuses Hladík's five
   municipal companies — including **SAKO Brno, a.s., a municipal waste incinerator that
   is materially closer to a waste-act amendment than CEVYKO is** — on the ground that
   "komunální, resp. státem vlastněné subjekty … se podle standardní metodiky nepovažují
   za soukromý podnikatelský konflikt zájmů", then elevates CEVYKO under the opposite
   rule. Applied consistently, CEVYKO is excluded on the verdict's own methodology.
3. **The ownership question is asserted, not left open.** The brief asked whether the
   deliberately-unresolved ownership question is stated as such. It is not — there is no
   ownership hedge anywhere in verdict-161. The only hedge present is about the *money
   channel* ("přímý peněžní kanál … není v textu doložen"), which is a different question.

A supervisory-board seat at a municipally-owned company is the textbook **steward** case
under the `/penize` attribution rule in `CLAUDE.md` ("a `steward` seat's institutional
contracts are never fetched, never summed"). Neither verdict states the tie class at all.

### B2 — `verdict-161.json` vs `verdict-74.json` · the batch contradicts itself about CEVYKO's sector

| file | claim about CEVYKO a.s. (IČO 08599254) |
|---|---|
| `verdict-74.json` · `conflictAssessment` + `citations[11]` | "společnost působí **mimo obory dotčené novelou** (ekologická újma, **odpady**, ČIŽP, vodní zákon)" / "obor společnosti se s předmětem novely věcně nekryje" |
| `verdict-161.json` · `conflictAssessment` | "má … živnostenské oprávnění … k **nakládání s odpady** … jde o soukromou firmu podnikající **přímo v oboru**, jehož regulaci tento tisk mění" |

Both bills amend **zákon č. 541/2020 Sb., o odpadech** — tisk 161 as its sole target,
tisk 74 at čl. V (`ČÁST ČTVRTÁ — Změna zákona o odpadech`, line 416/418 of
`tisk-74/266759.txt`). The same company cannot be both in and out of the waste sector
for the same statute in the same batch.

On the merits **verdict-74 is the wrong one on sector**: CEVYKO holds
`Nakládání s odpady (vyjma nebezpečných)` from 10 Oct 2019 and is a municipal waste
facility. Verdict-161 is wrong on *ownership* (B1). Persisting both writes two
irreconcilable statements into the graph.

### B3 — `verdict-161.json` · `conflictAssessment` · sponsor count does not close

> "Z **dvanácti** spolupředkladatelů …" → Hladík, Langšádlová, Niemiec have ties →
> "U zbývajících **sedmi** spolupředkladatelů graf žádnou peněžní vazbu neeviduje."

3 + 7 = 10 ≠ 12. Ground truth (`batch-015-targets.json`, tisk 161, `sponsors[]`): **12
sponsors**, 3 with `moneyTies`, **9 without** (Brzesková, Filipovičová, Kašparová,
Kršková, Krutáková, Okamura, Philipp, Svárovská, Šmída). The bill's own signature block
(`tisk-161/269099.txt` lines 222–233) confirms 12. Repeat of the count-precision class
that blocked a prior batch.

### B4 — `verdict-74.json` · `conflictAssessment` · numeral contradicts its own list

> "U zbývajících **pěti** předkladatelů (Pláteník, Brzesková, Filipovičová, Kršková,
> Krutáková, Svárovská) graf neeviduje žádnou peněžní vazbu."

Six names are listed. Ground truth: 9 sponsors − 3 with ties = **6**. The list is right,
the numeral is wrong.

### B5 — `verdict-161.json` · `citations[5]` · contaminated claim, mis-kinded evidence, single source for six entities

```json
{ "claim": "Vodovody a kanalizace a jim podobné regionální komunální podniky jako
            ARENA BRNO, Dopravní podnik města Brna, Teplárny Brno a SAKO Brno jsou
            ovládány statutárním městem Brnem, MERO ČR je státem vlastněný
            provozovatel ropovodů.",
  "kind": "graph_fact", "source": "company:ico:60713470" }
```

- **"Vodovody a kanalizace"** appears nowhere in tisk 161. It is
  *Vodovody a kanalizace Vyškov, a.s.* (IČO 49454587), the tie of **Jiří Horák**, a
  sponsor of **tisk 104** — cross-verdict contamination of the claim string.
- **`kind: "graph_fact"` is false.** The graph's `moneyTies` carry only
  `{ico, name, urn, contractCzk}`. Municipal control, state ownership and "provozovatel
  ropovodů" are external facts. Verdict-104 handles the identical shape correctly, with
  `kind: "web"` and a real URL (`citations[3]`).
- One `source` urn (SAKO Brno) is offered for assertions about six distinct entities.

### B6 — `verdict-218.json` · `unstatedEffects[0]` · the sole finding is refuted by the bill's own důvodová zpráva

The verdict's only unstated effect accuses the memorandum of presenting an omnibus as a
single-topic technical bill:

> "…jde tedy o vícetematický (omnibusový) návrh, ačkoli je **zprávou prezentován jako
> jednotematická technická novela**."

`tisk-218/271424.txt`: `I. Obecná část` begins at line 191, `II. Zvláštní část` at line
1029. Inside the **obecná část**:

- line ~357, a dedicated numbered subsection: **"1.7 Potvrzení o osvobození od DPH při
  dovozu a dodávkách obranných produktů pod nařízením SAFE"**, followed by four
  paragraphs on nařízení (EU) 2025/1106 čl. 20;
- line 608, the EU-acts compatibility list, which names
  "nařízení Rady (EU) 2025/1106 … nástroj Bezpečnostní akce pro Evropu (SAFE)".

The SAFE rider is disclosed in the general part in its own right, under its own heading.
The non-disclosure accusation does not survive the text, and it is the verdict's only
finding. (The §71m mechanics themselves are correct — see §7.)

### B7 — `batch-015-old27-sweep.json` · `patched[9]` · the `json` rule destroyed a citation

Rule `sweep-old27-015.ts:44` — `t.replace(/\bjson\b/gi, "strojově čitelný výstup")`:

- before: `… v § 196 a § 55 odst. 2, verdict-115.json) je překryv ustanovení nulový …`
- after: `… v § 196 a § 55 odst. 2, verdict-115.strojově čitelný výstup) je překryv …`

`verdict-115.json` is a cited artefact name. The rewrite produces a non-existent token and
deletes a checkable reference. This is the payload's only `json` rewrite — 1/1 broken.

### B8 — `batch-015-old27-sweep.json` · 5 of 6 „dávka" rewrites are ungrammatical Czech

The rule substitutes a neuter nominative noun phrase into slots requiring other
genders/cases; `czechCopyOrNull` is a stopword classifier and passed all of them.

| path | after | fault |
|---|---|---|
| `patched[1]` | „stejný vzorec, **jaký** dřívější **zpracování** tohoto projektu **zjistila**" | needs „jaké … zjistilo" |
| `patched[2]` | „Symetricky se zjištěním **dřívější zpracování**" | needs genitive „dřívějšího zpracování" |
| `patched[3]` | „…, **jaký** … **zjistila** u tisku 4" | as above |
| `patched[9]` | „**z** dřívější zpracování tohoto projektu" | needs „z dřívějšího zpracování" |
| `patched[11]` | „**jaké** … **označila** u tisku 4" | needs „označilo" |

Only `patched[15]` reads correctly.

### B9 — the sweep certifies as clean output that still carries the jargon it targets

Declined forms survive in the *after* text, in the same sentences the sweep rewrote:
`patched[2]` „…který se v této **dávce** i v **dávce 001** opakuje shodně…";
`patched[1]` „…v **dávce 001**…", „(testovaný případ této **dávky**)";
`patched[9]` „…u tisku 4 v **dávce 001**.", „…pro koordinátora **dávky**.";
`patched[14]` „Podle **dávkového** scanu…"; `patched[15]` „**Dávkový** scan…".

Root cause is a **shared blind spot in detector and sweep** — `lib/analysis/public-copy.ts:39`
matches `/\b(batch|dávka)\s*\d/i` (nominative only) and the sweep's
`/dávk[ayeou]{1,2}\s*0*(\d{1,3})/gi` cannot match `dávce` (Czech palatalises k→c in the
locative). Because `sweep-old27-015.ts:46` does `if (remaining.length > 0) throw`, the
script **certifies the output as jargon-free**. The payload's "re-verified" claim is only
as strong as a detector measurably blind to these strings. Net effect: the same document
now names batch 001 twice by euphemism and three times outright.

### B10 — `DependencyRadar.tsx:107-109` · 16 of 18 evidence quotes do not contain what the section says they show

The intro (`:53-54`) tells the reader the excerpt will show the e-Sbírka placeholder
(„zákona č. …/2026 Sb."). Measured over both payloads: all 18 triage `context` values are
exactly 120 chars and **only 2 of 18 contain the placeholder**, while the census payload's
context for the same hits is 231–277 chars and **18 of 18 contain it**. The triage context
is a 120-char prefix that truncates the placeholder away — a fact the batch-014 audit
itself records (`batch-014-audit.md:470`). `CONTEXT_MAX_CHARS = 220`
(`getDependencyData.ts:33`) is dead code, and the loader never opens the census file
despite its header comment naming it. The reader is shown a raw amendment enumeration as
proof of a claim it does not evidence.

### B11 — `DependencyRadar.tsx:91-102` · "a lead, not a finding" ships as a linked assertion with no `pending_review` label

`batch-014-dependency-census.json`'s own method string: *"A hit is a lead for close
reading, **not a finding**."* The surface calls them `nálezů`, renders `závisí na:` as an
assertion, and hard-links the inferred companion — with none of the derived/ungated
labelling the same feature already uses at `BillDetail.tsx:539`. Worst case is tisk 250:

```
subj: "…souběžná novela … — MOŽNÁ tisk 62 (týž zákon, táž vkládací technika,
       ALE BEZ EXPLICITNÍ TEXTOVÉ VAZBY)"
likelyCompanionTisk: 62
```

renders as a bold cobalt link **`závisí na: sn. tisk 62`** → `/zakony/62`, with the hedge
demoted to grey trailing prose. This is a direct brand-rule violation.

---

## 2. MAJOR

### M1 — `verdict-161.json` · the on-topic reading overstates what the bill regulates

The operative text (`tisk-161/269099.txt` lines 21–75) does exactly two things: append a
sentence to **§ 59 odst. 3** and add **příloha č. 13**. Both bind **obce**. The bill
imposes no duty, fee, tariff, tender rule or payment on any waste operator. Saying CEVYKO
"podniká přímo v oboru, jehož regulaci tento tisk mění" reads the amended *statute* for
the amended *provision*. The verdict also never states the **direction of effect**: a
*lowered* separation target for low-production municipalities means *less* separately
collected tonnage — if anything mildly adverse to a collection contractor. Stating it
would have deflated the on-topic reading rather than supported it.

### M2 — `verdict-161.json` · misstates the relief, and misses the bill's sharpest unstated effect

The enacting text says **"o 10 %"**, in both places:

- line 26, the § 59/3 sentence: „…stanoveného větou první **sníženého o 10 %**."
- line 38, příloha č. 13: „…které umožňuje snížení cílů podle § 59 odst. 3 věty první
  **o 10 %**…"

Only the *důvodová zpráva* says percentage points (lines 137, 152: „o 10procentních
bodů"). The verdict adopts the memorandum's reading as the text's — `statedReasoning`:
„smí plnit cíl **snížený o 10 procentních bodů**"; `researchedContext`: „úlevu 10
procentních bodů".

This is doubly costly: the assertion is unsupported, **and the discrepancy itself is
arguably the most consequential unstated effect in the bill** — 10 % of a 60 % target is
6 points, not 10, and the operative text and its own memorandum disagree about which. The
verdict does not raise it.

### M3 — `verdict-161.json` · `citations[3]` · money claim below the batch's own discipline

> „…peněžní vazbu na CEVYKO a.s. (IČO 08599254) s úhrnem veřejných smluv 301 393 871 Kč."

No "**firmy**" qualifier (so the figure reads as money reaching the MP) and no "**vazba
čeká na lidskou kontrolu**". `verdict-74.json`'s seven parallel graph citations all carry
both — e.g. `citations[11]`: „(úhrn veřejných smluv **firmy**, vazba **čeká na lidskou
kontrolu**)". Verdict-161 deviates from the batch's own norm on the single money figure
the batch elevates to `medium`.

### M4 — `verdict-232.json` · `conflictAssessment` · Babiš aggregate understated by an order of magnitude

> „…s celkovým úhrnem veřejných smluv **v řádu stovek milionů korun**."

Sum of the 14 `contractCzk` values in `batch-015-targets.json` (tisk 232,
`sponsors[0].moneyTies`): **1 991 751 917 Kč ≈ 1,99 mld**. Not "hundreds of millions" —
roughly two billion. The error runs in the direction that minimises the exposure being
described. Same citation (`citations[3]`) also carries neither the "firem" qualifier nor
`pending_review` (M5 in effect).

### M6 — `verdict-167.json` · the "second extension" accusation is not established by the evidence

`researchedContext` and `unstatedEffects[0]` assert:

> „…§ 334b bylo … vloženo zákonem č. 437/2024 Sb. a od té doby **již jednou novelizováno
> zákonem č. 223/2025 Sb.** — jde tedy o **opakované prodlužování stejné přechodné
> výjimky**" / „…aniž by uvedla, že jde už o **druhé prodloužení**…"

What the cached text supports:

- `tisk-167/269349.txt:10-11` — „V § 334b odst. 1 zákona č. 283/2021 Sb. … **ve znění
  zákona č. 437/2024 Sb. a zákona č. 223/2025 Sb.**, se číslo „2026" nahrazuje číslem
  „2027"." This is the standard *as-amended* citation form. It establishes that 223/2025
  touched the statute — **not that it moved this deadline**.
- `:23-24` — 437/2024 inserted § 334b. ✓ established.

Nothing in the corpus shows 223/2025 extended *this* date. The verdict converts an
as-amended citation into a substantive fact and then builds a **non-disclosure
accusation** on it. `citations[1]` compounds this: a two-limb claim ("vloženo … a
novelizováno …") carried on the single source `437/2024`, leaving the 223/2025 limb
unsourced.

### M7 — `verdict-215.json` · § 107a extended to "profesní komory" without textual basis

Operative text, `tisk-215/271409.txt:799-809`:

> „(1) Oprávnění podat návrh na přezkoumání a zrušení **předpisu vysoké školy** … má
> a) ministr, jde-li o předpis veřejné nebo soukromé vysoké školy, b) ministr obrany …,
> c) ministr vnitra …"

§ 107a covers **vysoké školy only**. Professional chambers are *zájmová samospráva*,
routed through the new § 101g s.ř.s., whose standing rule defers to sectoral statutes
(„…je oprávněn podat ten, komu právo navrhovat přezkum … **přiznává zákon**", `:556-557`).

The verdict nonetheless says, in `researchedContext`, `unstatedEffects[1].effect`,
`unstatedEffects[1].whoBenefits` **and** `citations[1]`, that the ministerial monopoly
covers „předpisu vysoké školy **nebo profesní komory**". That extends a real finding onto
an entire second class of institutions (lékařská, advokátní, notářská komora …) with no
textual support — and it is the extension that makes the effect sound alarming.

*The core § 107a concentration claim, confined to vysoké školy, is correct and correctly
hedged — see §7.*

### M8 — `verdict-246.json` vs `verdict-171.json` · the mirror pair disagrees on the mechanics, and 246 mis-kinds its cross-bill citation

Re-derived from both texts:

- Current § 21 odst. 4 = the **percentage** table (30 d = 19 %, 10 d = 12 %, 1 den = 9 %)
  — `tisk-171/269516.txt`. Tisk 171 changes „1 den" → „24 hodin" in odst. 2 and odst. 4
  písm. c).
- Tisk 246 čl. I bod 1 replaces **odst. 3 až 5** wholesale; the **new odst. 4** is the
  electric/hydrogen fixed-rate table (formerly odst. 5) — `tisk-246/277815.txt:44-51`.
  Bod 2 repeals odst. 6–8.

So the odstavec 171 edits is **deleted and its number reused for a different subject**.

| | verdict-171 | verdict-246 |
|---|---|---|
| framing | „nový odst. 4 podle tisku 246 upravuje sazby pro elektromobily/vodíková vozidla, **nikoli obecnou percentuální sazbu**, kterou dnes upravuje odst. 4" — **correct** | „obě novely zasahují do **stejného odstavce 4** § 21 nezávisle na sobě" — asserts identity where the text shows delete-and-repurpose |
| citation of the cross-bill fact | `kind: "bill_text"`, source `tiskt.sqw?…ct=246` — **correct** | `kind: "web"`, source `historie.sqw?o=10&t=171` — a status page that **cannot** carry an amending instruction |

Answering the brief directly: **no, the two verdicts do not agree on the mechanics.**
171 has it right; 246 states a weaker and misleading version and sources it to a page that
cannot support it.

### M9 — `verdict-104.json` and `verdict-232.json` · the 104×232 collision is entirely uncited on both sides

Re-derived: tisk 104 čl. I bod 1 — „**V § 30 odstavec 3 zní:**" (replaces the wording,
`tisk-104/267510.txt:33`); tisk 232 čl. I bod 2 — „**V § 30 se odstavec 3 zrušuje.**"
(`tisk-232/277445.txt:73`). One amends what the other repeals. Verdict-104's reading
("jeden jej novelizuje, druhý ruší") is **exactly right**.

But **neither verdict cites the other bill's text**. Verdict-104's `citations[]` contains
no reference to tisk 232; verdict-232's contains none to tisk 104. In both files the
cross-bill collision is the most consequential claim in `researchedContext` and it rests
on nothing. Verdict-171 does this correctly (`citations[2]`), which shows the batch knows
the right pattern.

### M10 — `verdict-218.json` · `researchedContext` · uncited graph claim naming a person

> „Graf eviduje jako další novelu téhož zákona … souběžně projednávaný **tisk 168**
> (skupina poslanců, mj. **Olga Richterová** a další)…"

Tisk 168 is not a batch-015 target and `citations[]` carries **no** entry for it. A named
MP enters a verdict's prose with no source — the shape of the defect a prior batch was
blocked for.

### M11 — the 171×246 collision's actual consequence is stated by neither verdict

If 246 lands first, 171's instruction („v § 21 odst. 2 **a 4** … se slova „1 den"
nahrazují slovy „24 hodin"") would apply to the *new* odst. 4 — „d) 1 den činí 50 Kč" —
while leaving „1 den" standing in the new odst. 3 and odst. 5, which 171 does not touch.
The result is a statute pricing a *24-hour* period in odst. 4 and a *1-day* period in
odst. 3 and 5. That concrete, checkable incoherence is the collision's real product;
both verdicts stop at the generic "later overwrites earlier".

### M12–M15 — old-27 sweep (Priority 3)

- **M12** · 18 tautological duplications and 29 nested parentheticals. The urn was almost
  always an appositive to an entity the sentence had already named, so inserting its label
  duplicates it: `patched[0]` „Olga Richterová (Olga Richterová) … Ivan Bartoš (Ivan
  Bartoš)"; `patched[13]` „ČEPRO, a.s. (ČEPRO, a.s. (IČO 60193531))"; `patched[6]`
  „SOMPO (SOMPO, a.s. (IČO 25172263))". Parenthesis balance is preserved — this is
  legibility, which is the sweep's entire purpose.
- **M13** · `dávka 001` → `dřívější zpracování tohoto projektu` **deletes the batch
  number**. A reader-checkable provenance identifier becomes unverifiable prose, in a
  product whose brand rule is that every claim cites its source. Combined with B9 the
  corpus is now internally inconsistent about the same referent.
- **M14** · silent label fallback at `sweep-old27-015.ts:36/38/41` — no count, no warning.
  It **did** fire: IČO `04627695` has no label and silently rendered „společnost s IČO
  04627695" in four patches. The person and bill fallbacks would emit „poslanec s psp id
  6473" / „sněmovní tisk (interní id 43370)" — pipeline identifiers `lawJargonIssues` does
  not match, so a label miss writes *new* jargon straight past the gate meant to stop it.

### M16–M18 — dependency surface (Priority 5)

- **M16** · `DependencyRadar.tsx:58,136` — „Klasifikace byla **ručně auditovaná**"
  overstates. `batch-014-audit.md:473` records **three** spot-verified companion calls of
  18; across all 67 hits only 14 `reasoning` fields mention "Spot-verified".
- **M17** · the corpus guard is correct for the **companion**
  (`billTitleByCislo.has(...)`, genuine membership in the full corpus) but the **subject-bill**
  link has no guard at all (`:72-78`, `href={/zakony/${bill.cislo}}` straight from the
  payload). `app/zakony/[cislo]/page.tsx:38` calls `notFound()` — a payload/corpus
  disagreement, the exact disagreement the file warns about twice, produces a hard 404
  from a link the page drew itself. Related: tisk 777 is correctly left unlinked, but the
  prose still ships the number with nothing saying it is unresolvable — batch-014's still-open
  m10 survives to the screen. Latent: `/zakony/<n>` is keyed on *sněmovní* prints only, so a
  senátní print would silently link to the wrong document.
- **M18** · 18 hits = **10 distinct `(bill → companion)` pairs**. Tisk 153 renders **six**
  rows with a byte-identical subject and the identical link; 210, 53 and 64 render two
  each. The heading says „10 tisků · 18 nálezů závislosti" — a third of the headline is one
  dependency counted six times.

---

## 3. MINOR

1. `verdict-215.json` · `citations[4]` — „Zákon č. 458/2011 Sb. … § 124a … **původně
   vložil**" is an inference from the as-amended citation `tisk-215/271409.txt:897`, on a
   source that is the law urn itself. Same shape as M6, but peripheral and carrying no
   accusation.
2. `verdict-215.json` · `conflictAssessment` writes „**Kateřina** Demetrashvili"; the graph
   and the bill title both carry „**Katerina**" (no háček). A verdict should not rename a
   person.
3. `verdict-215.json` — makes a negative graph claim („U žádné z těchto osob graf
   neeviduje peněžní vazbu") with **no `graph_fact` citation** (kinds are bill_text ×2,
   law ×5). Low risk because negative, but inconsistent with 74/104/161/232.
4. `verdict-145.json` · `conflictAssessment` — the conclusion is right (see §7) but the
   justification is wrong and uncited: a government bill signed by the PM and the finance
   minister is not „**ústavně vyžadovaná spolupodpisová procedura**". *Kontrasignace* is a
   distinct institute attaching to presidential acts. No citation supports the claim.
5. `verdict-145.json` — Schillerová's role („místopředsedkyně vlády a ministryně financí")
   and the figures „18,92 mil. Kč / 135,125 mil. Kč" carry no specific citation.
6. `verdict-232.json` — „účinnost … **o rok později** než u konkurenčního tisku 104":
   1 Jul 2026 → 1 Sep 2027 is 14 months (`tisk-104/267510.txt:95`, `tisk-232/277445.txt:81`).
7. `verdict-232.json` — „tisk 232 celý dosavadní § 30 odst. 3 **přesouvá a přečíslovává**"
   describes the memorandum's rationale; the operative verb is „**zrušuje**". Verdict-104's
   formulation is sharper.
8. `verdict-74.json` · `unstatedEffects[1]` — argues an undisclosed burden on EMAS/ISO
   operators without mentioning that **čl. II bod 1 grants those very operators a 24-month
   transition** (`tisk-74/266759.txt:358-362`). A mitigating provision in the same bill,
   omitted from the effect that complains about the burden.
9. `verdict-171.json` · `citations[2]` — „účinnost rovněž 1. ledna 2027" for tisk 246 is
   incomplete: čl. III splits the date, with čl. II effective **30 Nov 2026**
   (`tisk-246/277815.txt`).
10. Sweep `patched[14]` — „(uzel **sněmovní tisk 248**)" is internally consistent but reads
    badly, and `uzel` / `scan` / `případu law` remain untranslated in the same clause.
11. Sweep — English residue left in shipped after-text: „již **gatovanému** tisku 115",
    „dávkového **scanu**", „v grafu **případu law**".
12. Dependency surface — `psp.cz` misattributed as the placeholder's author (`:54`); the
    author is the drafter. `generatedAt` is loaded and never rendered. Czech plural/agreement
    defects at `:122-124` („3 dalších nálezů", `prošlo`, `jeho popis`) and `:46`; mixed quote
    marks („ … `&quot;`); a dead `!companionExists` branch at `:104`; no `lawwatch.dependency*`
    message keys, so the `en` locale renders section 03 in Czech; `f.int()` applied to print
    numbers; `id="zavislosti"` not registered in `navModel.ts:175-178`; three silent
    `return null` paths (`:104/107/134`) that never call `reportLoaderFailure()`; no colocated
    test for the gate or the guard.

---

## 4. Priority 4 — collision waves (`collision-close-reads-batch015-g{A,B}.json`)

### Mechanical sweep — clean

Over all 12 records, NFC-normalised with whitespace and quote-glyph collapsing, checking
own-bill vs other-bill attribution:

| check | result |
|---|---|
| quoted spans occur in the **named** bill | **24/24 excerpts, 12/12 records pass** |
| swapped attributions (span found only in the *other* bill of the pair) | **zero** |
| `classificationCounts` vs actual | gA `{confirmed-collision:1, coordination-risk:5}` ✓ · gB `{2,3,1}` ✓ |
| `coverage.pairsRead` / `pairsAssigned` vs `pairs.length` | 6 = 6 = 6 in both ✓ |
| classifications drawn from `classificationVocabulary` | 12/12 ✓ |
| queue coverage | 12 records ↔ 12 queue pairs, 1:1, no duplicates ✓ |
| `sharedParagraph` vs queue `genuineParagraphs` | 12/12 ✓ |
| cited article/bod numbers resolve in the cached text | all pass, incl. tisk 189's `§ 29 (Část druhá)` ✓ |

This is materially better than the verdict layer. The defects below are in classification
and reasoning, not in the evidence plumbing.

### B12 (BLOCKING) — gB `pairs[3]` (`13-16-240-2013-604`) · `confirmed-collision` is refuted by its own quoted instructions

The two operative instructions, both verified verbatim:

- **tisk 13, bod 181:** „V § 604 odst. 1 písm. m) se za číslo „456" vkládají slova „odst. 2",
  … a slova „nebo § 475 odst. 2" se nahrazují slovy „, § 475 odst. 2 nebo § 476 odst. 2
  nebo 5"."
- **tisk 16, bod 4:** „V § 604 odst. 1 písm. m) se slovo „,nebo" nahrazuje tečkou
  a písmeno n) se zrušuje."

The record's mechanism is that applying 13 first would displace 16's target string. Czech
novelisation substitutes **by string, not by offset**, so displacement is not a failure
mode — and tisk 13 neither consumes nor creates the string `,nebo`: every comma in its
inserted text `, § 475 odst. 2 nebo § 476 odst. 2 nebo 5` is followed by `§`. The converse
claim (that tisk 13's reference to the m)/n) structure becomes „zmatečný") is also
unsupported — **tisk 13 issues no instruction referencing `,nebo` or písmeno n) anywhere.**
The two substitutions target disjoint strings and commute.

Under the file's **own** criterion — the one it uses to downgrade `64-260`, `189-248` and
`111-207` — this is at most `coordination-risk`. Three compounding problems in the same
record:

1. **Irrelevant evidence carries the label.** „…tisk 13 v odstavci 4 pracuje s PŮVODNÍM
   písmenným značením b)/c)/d) — jde o STEJNÝ mechanismus přečíslování jako u potvrzené
   kolize 13×64." A renumbering conflict requires the counterpart to address that odstavec.
   Tisk 16's only § 604 instructions are body 3–5, touching **odst. 1 and odst. 6** — it
   never touches odst. 4. The 13×64 mechanism does not transfer.
2. **The "real three-bill cluster" claim contradicts the record it cites.** gB asserts
   „všechny tři dvojice mají mezi sebou vlastní, nezávisle doloženou textovou interakci na
   § 604". The cited 16×64 edge is `collision-close-reads-batch014-gA.json` → `16-64-240-2013`,
   whose own reasoning reads **„přímý textový střet nebyl nalezen"** (classification
   `coordination-risk`). One of the three edges is on record as having *no* textual
   interaction, so the claim that this closes into a real cluster rather than a V-shape with
   one shared vertex overstates the record base. **Answering the brief directly: the
   13×16 interaction on písm. m) is real, but the cluster is not.**
3. **The load-bearing premise is not in the corpus.** The argument rests on both edits
   sitting „na jeho konci", adjacent to the m)/n) boundary. Neither `tisk-13/265099.txt` nor
   `tisk-16/265180.txt` carries a consolidated or srovnávací znění of § 604, so the
   adjacency is asserted as fact and cannot be evidenced from the cited sources.

### M19 — both files misreport the queue metadata and credit themselves with overturning it

gA `pairs[2]`: „Metadata fronty sice u této dvojice hlásí shodu na úrovni **odstavce** „3"…";
gB `pairs[5]`: „Fronta označila § 55c jako sdílený **se shodou na úrovni odstavce**."

The queue's `odstavecOverlap` holds **§ labels**, not odstavec numbers (`["22"]`, `["23e"]`,
`["604"]`, `["55c"]` elsewhere in the same file). Per
`scripts/case-loops/law/collision-sweep-009.ts:135-139` an entry is pushed **either** on a
genuine odstavec intersection **or** when either side names no odstavec — the comment says
so outright: *"the interaction is not decidable here"*. Both pairs hit the second branch,
because `targetedOdstavce` (`collision-core.ts:141-151`) matches only `V § N odst. M`, and
tisk 65 says „V § 3 **odstavec** 3 zní" while tisk 75 says „**Za** § 55c se vkládají". The
queue never claimed odstavec agreement; two records manufacture a correction to a claim
that was not made.

### M20 — rubric applied inconsistently: one evidence shape, two labels

Records sharing the shape *"both sides instruct on the same odstavec/písmeno, disjoint
target substrings, order-independent"*:

| record | label |
|---|---|
| `64-260-37-2021-53` — both edit odst. 1 („vlastních zdrojích" vs the vrcholné-vedení/5 % phrase) | `coordination-risk` |
| `111-207-359-1999` — both edit odst. 1 of one enumeration („moci jiného" vs „nebo s jedy", ~25 words apart in both srovnávací znění) | `coordination-risk` |
| `189-248-586-1992` — same odst. 9, písm. d)/g) vs m) | `coordination-risk` |
| `13-16-240-2013-604` — same písm. m), disjoint substrings | **`confirmed-collision`** |

The outlier is B12. Correcting it also repairs the rubric's consistency.

### Spot-check verdicts (all four re-derived from both bills' texts)

- **67-234 (§ 22, 360/1992) — RIGHT.** tisk 234 bod 63 is a true wholesale replacement
  („**§ 22 zní**:" — three odstavce, different subject matter); tisk 67 čl. XIX is a narrow
  append („se doplňuje odstavec 4") that presupposes the existing odst. 1–3. Neither bill has
  another § 22 instruction (tisk 234's next bod is § 22a). Text is lost in either order.
  `confirmed-collision` is earned.
- **89-90 (§ 36, 218/2000) — RIGHT.** tisk 89 bod 2 amends **odst. 3** at word level;
  tisk 90 bod 32 does „V § 36 **se odstavec 3 zrušuje. Dosavadní odstavce 4 až 10 se
  označují jako odstavce 3 až 9.**", with bod 34 then repealing the renumbered odst. 9.
  Deletion + renumbering against a word-level amendment of the deleted odstavec.
  `confirmed-collision` correct, quotes exact.
- **13-16 (§ 604, 240/2013) — OVERSTATED.** See B12. The narrow claim (both touch písm. m)
  of odst. 1) is right; the label and the cluster conclusion are not.
- **67-75 (§ 55c, 254/2001) — RIGHT.** tisk 67 bod 15 is a real edit („se slovo „zastavěné"
  nahrazuje slovem „zastavitelné"…", confirmed against the marked srovnávací znění in
  `266190.txt`); tisk 75 bod 1 is „**Za § 55c** se vkládají nové § 55d a § 55e…", and `55c`
  occurs **exactly once** in the whole of `tisk-75/266819.txt`, at that anchor. The
  anchor-only reading is correct and `incidental` is the right label — its stated rationale
  carries M19.

### Minor (collision waves)

13. gB `pairs[3].evidence.billBExcerpt` — quote glyph deviates from source: payload
    `se slovo „,nebo" nahrazuje tečkou`, cached `tisk-16/265180.txt` reads
    `se slovo ,,,nebo" nahrazuje tečkou`. A PDF-extraction artifact, not a misattribution
    (batch-014 preserved the raw form).
14. gA `pairs[2].evidence.billAExcerpt` — truncated quotation presented as closed: ends
    `…která není zapsána v základním registru obyvatel, dále"` mid-provision, with a closing
    quote and no ellipsis, while the source continues `dále a) místo a okres…`. Other records
    mark truncation with `...`.
15. gA `pairs[5]` (`189-248`) — incomplete instruction inventory: „tisk 189 mění § 6 odst. 9
    písmena d) a g)" omits that tisk 189 also amends **§ 6 odst. 3** (body 2 and 3). Disjoint
    from tisk 248's odst. 9 písm. m), so the verdict stands, but the framing is not complete.
16. Schema drift between the group files — gA's `classificationCounts` omits the zero-valued
    `incidental` key gB lists, and `pairId` format differs (gA `64-77-388-1991`, no §-suffix,
    5 of 6; gB `64-221-218-2000-14`, §-suffix, 6 of 6). Both are keys downstream code may
    join on.

*Verified and **not** a defect:* gA `111-207`'s claim of a prior publication on 40/2009 Sb.
§ 88 is true — `collision-close-reads-batch008.json` → `pairId: "111-207"`,
`sharedParagraph: "33, 88"`, `coordination_risk`.

---

## 5. Standing sweeps (Priority 6)

Mechanical checks over all 10 verdicts:

| check | result |
|---|---|
| `validateLawVerdict()` (repo gate, with `knownLawRefs`/`knownIds`) | **10/10 `ok: true`, zero errors** |
| `lawJargonIssues()` over every prose field + every `citations[].claim` | **zero hits** |
| NFC normalisation | 10/10 clean |
| Cyrillic/Latin homoglyphs | none |
| `whoBenefits` unsigned ("Nelze jednoznačně určit") | 15/15 effects |
| `evidence` present on every effect | 15/15 |
| English residue in prose | none (the „Text potvrzuje…" openings are Czech) |
| counts vs lists | **2 failures — B3, B4** |
| money figures carry `firmy` + `pending_review` | **fails in 161 (M3) and 232 (M5); passes in 74, 104** |
| completeness overclaims | 161 (M1/M2), 215 (M7), 218 (B6), 167 (M6) |

**The most important line in this table is the first.** Every defect in §1–§3 passes the
machine gate. A false ownership assertion, two arithmetic errors, a refuted non-disclosure
accusation and an uncited person-naming all return `ok: true`. The gate checks shape,
vocabulary and language — not arithmetic against the payload, not internal consistency
across a batch, not whether a positive claim survives its own source. Two cheap additions
would have caught four blocking defects here:

1. **Sponsor arithmetic** — parse the "N of M" pattern in `conflictAssessment` and assert
   it closes against `targets.sponsors[].moneyTies` (catches B3, B4).
2. **Cross-verdict entity consistency** — for any IČO appearing in more than one verdict in
   a batch, diff the sector/ownership adjectives applied to it (catches B2).

---

## 6. The CEVYKO ruling

**CEVYKO a.s. (IČO 08599254) is a municipally owned inter-municipal waste company, not a
private firm, and Bohuslav Niemiec's connection to it is a supervisory-board seat.** It
holds a genuine `Nakládání s odpady (vyjma nebezpečných)` licence from 10 Oct 2019 — so
verdict-74's "outside the affected sectors" is wrong — but verdict-161's "soukromá firma"
is wrong in the way that matters, because it is the sole ground on which the tie is
elevated above the five municipal ties the same paragraph excuses. Applied consistently,
the verdict's own methodology excludes CEVYKO exactly as it excludes SAKO Brno, which is a
municipal waste incinerator and closer to a waste-act amendment than CEVYKO is. On top of
that, the bill's operative content binds **obce**, not waste operators, and its direction
of effect is *lower* separated-collection tonnage. **The `medium` severity is not earned on
the money limb.**

What would be defensible, and is worth preserving from the work: an inter-municipal waste
company whose supervisory board seats a co-sponsor of a waste-act amendment is a legitimate
**registered adjacency worth a human's attention** — stated in exactly the terms
verdict-74 uses for SAKO Brno („věcná blízkost tématu bez důkazu osobního prospěchu"),
with the ownership named, the seat named as a supervisory seat, the tie's `pending_review`
state on the claim, and the aggregate labelled as the *company's* public-contract total.

---

## 7. What is earned — do not regress these

Re-derived from the primary texts and confirmed:

- **`verdict-74.json` — the § 1a self-execution exclusion is exact.** `tisk-74/266759.txt:381-395`:
  new § 1a odst. 1 empowers ČIŽP to execute unmet remedial orders at the obliged person's
  cost; **odst. 2: „Odstavec 1 se nepoužije na opatření k nápravě uložené podle zákona
  o předcházení ekologické újmě."** The mismatch between the memorandum's stated purpose
  (ZEÚ unenforceability) and the new tool's scope (which excludes ZEÚ) is real, correctly
  located at čl. III bod 1, and not stated in the memorandum. Čl. III body 2 and 3 verified
  verbatim: „5 000 000" → „10 000 000" and „10 000 000" → „20 000 000".
- **`verdict-74.json` — the SAKO Brno hedge is exactly right.** „…jde o věcnou blízkost
  tématu **bez důkazu osobního prospěchu**, kterou by měl budoucí lidský přezkum vzít
  v úvahu." It names the adjacency, asserts no benefit, and defers. This is the model the
  CEVYKO paragraph should have followed.
- **`verdict-74.json` — the EMAS/ISO removal is verified.** Čl. I bod 19 rewrites § 14
  odst. 4 leaving only the CZK 20 m threshold (`:230-234`), and the memorandum confirms the
  removed carve-out was from the **financial-security** duty: „vyváže se z povinnosti
  finančního zajištění pouhým odkazem na uvedenou certifikaci" (`:609-610`).
- **`verdict-215.json` — the § 124a → § 110 odst. 7–8 tracing is exact.** Čl. XI
  (`:896-897`) and the memorandum's `K čl. XI` (`:3500-3529`) match the verdict clause for
  clause, including the duplicity rationale and the admitted „specifika správy daní". The
  effect — that the memorandum asserts equivalence without any comparative analysis of what
  changes for taxpayers — is fair and well-aimed. § 110 odst. 7–8 confirmed at `:668`.
- **`verdict-215.json` — the standing-concentration claim, confined to vysoké školy, is
  correct and precisely hedged.** „…žádná jiná osoba … **podle tohoto konkrétního
  mechanismu** návrhovou legitimaci nezískává" is the right qualifier, because § 101g(1)
  defers to sectoral statutes. Only the extension to professional chambers is defective (M7).
- **`verdict-218.json` — the „…/2026 Sb." placeholder reasoning is sound and honestly left
  open.** The self-reference is correctly excluded, and the verdict says so: „jednoznačné
  určení proto není z dostupných dat možné a **ambiguita zůstává neuzavřená**." The § 71m
  mechanics are exact (`:99-108`, čl. I bod 12, Ministerstvo obrany, nařízení 2025/1106).
- **`verdict-232.json` — the survey figures are exact.** „Na šetření odpovědělo **5 441**
  z celkového počtu **5 461** oslovených škol" (`:118-119`), „**93 %** škol" (`:122`),
  published 20 May 2026 (`:119`). The 14-tie count is correct, and Babiš is correctly
  treated as a **co-sponsor** (bill title + payload confirm) — no countersignature confusion.
- **`verdict-145.json` — a prior batch's defect is fixed.** The countersignature/sponsor
  distinction is drawn explicitly and the verdict **declines to draft Andrej Babiš's ties
  against him** on a bill he merely countersigned. This is the correct handling of "a
  non-sponsor with ties drafted against him". Only the constitutional label is wrong (minor 4).
- **`verdict-104.json` — counts close** (7 sponsors = 5 without ties + Horák + Jurečka), the
  ownership claim is correctly `kind: "web"` with a real URL, and the 104×232 mechanics are
  correctly derived.
- **`verdict-171.json` — the senate data-gap statement is exemplary.** „…jde o **mez rozsahu
  dat, nikoli o zjištění, že střet zájmů neexistuje**." Every negative conflict finding in
  this corpus should read like that. Its reading of the 246 collision is also the correct
  one (M8).
- **Dependency surface — the honesty numbers all reproduce.** 18 / 10 / 23 / 67 recomputed
  directly from the triage **records** (not its `counts` field) all match; every rendered
  number carries a `SourceNote`; **no bare number**; zero machine urns or English residue can
  reach the screen; token discipline clean (`ink`, `steel`, `signal`, `cobalt`, `ochre`,
  `hairline`, `paper-strong`, all from `app/globals.css`); server boundary holds;
  `npx tsc --noEmit` clean and `npx eslint features/lawwatch` reports 0 errors (2 pre-existing
  warnings in `lawwatchLabels.ts`, out of scope).
- **`sweep-old27-015.ts` — the write path is sound.** `--commit` is **expectation-guarded**
  (`:67`, `:70` throw when the live text differs from the extract, *before* `upsertKgNodes`
  at `:77`, so a mismatch aborts with zero writes), **merge-preserving**
  (`structuredClone(bill.props)` → single-field assignment → `{ ...bill, props }`, plus a
  `forensic_provenance.jargon_sweep` marker), and **dry-run by default** (`:20`, `:53`, `:80`).
  Residual footguns: `f.before` is re-read in the same run rather than independently frozen,
  so regenerating the extract from an already-swept store makes the guard vacuous; no
  assertion that `patched.length === 16` or `n === toWrite.length`; `--pass=abc` serialises
  `pass: null` unvalidated; `OUT` is rewritten even on `--commit`.

---

## 8. Required before pass-49

1. **B1/B2/B6** — re-derive verdicts 161, 74 and 218. 161's `medium` and its money limb do
   not survive; 218 has no finding left as written.
2. **B3/B4** — fix both counts and add the sponsor-arithmetic assertion to the gate.
3. **B5, M3, M5, M9, M10** — repair the citation layer: contaminated claim, mis-kinded
   evidence, missing `firmy`/`pending_review` qualifiers, the uncited 104×232 collision on
   both sides, the uncited tisk-168 person naming.
4. **B7/B8/B9** — do not run `sweep-old27-015.ts --commit`. The `\bjson\b` rule must be
   filename-safe, the „dávka" rule must decline correctly, and both detector and sweep must
   handle the locative `dávce` before the throw-if-remaining guard means anything.
5. **B10/B11** — the dependency section must render the census context (or say the excerpt is
   truncated) and must carry a `pending_review`-class label before it links an inferred
   companion.
6. **B12** — downgrade `13-16-240-2013-604` to `coordination-risk` and drop the three-bill
   cluster conclusion, or produce the consolidated § 604 text that would evidence it.
7. **M2, M6, M7, M8, M11, M19, M20** — the substantive re-derivations above.

---

## 9. One structural recommendation

The evidence plumbing in this batch is in good shape — 24/24 collision quotes resolve to the
right bill, every dependency-surface number reproduces, the sweep's write path is
expectation-guarded and merge-preserving, and the machine gate is clean on all 10 verdicts.
**Every blocking defect is in a claim's relationship to its evidence, not in the evidence
itself:** an ownership adjective nobody checked (B1), two sums nobody added (B3, B4), a
non-disclosure accusation nobody tested against the memorandum's own table of contents (B6),
a commutativity argument nobody tried to apply in both orders (B12), and a regex nobody ran
against a filename (B7).

That is a gate-design problem, not an analyst problem. The four cheapest checks that would
have caught seven of the twelve:

1. **Sponsor arithmetic** — parse "N of M" in `conflictAssessment`, assert closure against
   `targets.sponsors[].moneyTies` → B3, B4.
2. **Cross-verdict entity consistency** — for any IČO in more than one verdict of a batch,
   diff the sector/ownership adjectives applied to it → B2.
3. **Money-claim shape** — any `contractCzk` figure in a claim must carry both the "firmy"
   qualifier and the tie's review state, and must reproduce against the payload sum → M3, M4, M5.
4. **Commutativity replay** — for any `confirmed-collision`, mechanically apply both quoted
   instruction sets in both orders over the quoted substrings and require a demonstrated loss
   → B12.
