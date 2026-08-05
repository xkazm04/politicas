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

---
---

# Closure check (post-fix)

**Re-audited:** 2026-08-05, against the files as they now stand. Independent
re-derivation from the primary texts and payloads; nothing taken on the coordinator's
word. No file edited, no git, no PGlite.

## CLOSURE VERDICT: **REOPENED**

**11 of 12 BLOCKING closed** — several of them exemplary. But the remediation
**introduced one new BLOCKING defect of a worse kind than the one it replaced**, and it
sits inside the very finding the fix elevated to headline status.

`verdict-161` no longer merely *adopts* the memorandum's reading of the relief (the old
M2, an unsupported inference). It now **manufactures two verbatim quotations that do not
exist in the bill**, and builds an elevated `unstatedEffects[0]` on them. Fabricated
evidence is a harder failure than an unsupported inference, and it entered through the fix.

Everything else in the verdict layer is genuinely better. This is a narrow reopen: one
finding in one file, plus two regressions of already-diagnosed patterns.

---

## New BLOCKING

### N1 — `verdict-161.json` · `researchedContext` + `unstatedEffects[0]` + `citations[1]` · two fabricated quotations, and the claim they support is false

The new headline finding asserts that the operative text says "o 10 %" while the
memorandum **consistently** says percentage points. Measured over
`.data/law-collision-cache/tisk-161/269099.txt` (NFC, whitespace-collapsed):

- `o 10 %` occurs **3x** — line 26 (§ 59/3 sentence), line 38 (příloha č. 13), **and line 91**
- `10procentních bodů` occurs **2x** — lines 137 and 151-152, **both in obecná část C only**

Checking the three quotations the verdict presents in guillemets:

| # | quoted as | attributed to | actual |
|---|---|---|---|
| Q1 | „Navržené snížení cíle odděleného soustřeďování o 10procentních bodů pro obce s velmi nízkou produkcí…" | obecná část | **PRESENT** (line 137) |
| Q2 | „…umožňuje snížení cílů podle § 59 odst. 3 věty první o 10procentních bodů…" | „v obecné části" | **ABSENT.** The sentence exists at line 37-38 — in the **operative příloha č. 13**, not the memorandum — and reads **„o 10 %"**. The quotation inverts the unit and relocates the source. |
| Q3 | „snižuje cíle pro oddělené soustřeďování… o 10procentních bodů" | „ve zvláštní části" | **ABSENT.** The zvláštní část sentence (line 213-215) reads „snižuje cíle pro oddělené soustřeďování recyklovatelných odpadů v případě obcí, které produkují velmi nízké množství…" — it carries **no figure at all**. The ellipsis conceals an insertion, not an omission. |

Consequently the claim wrapping them is false three ways:

> „Obecná i zvláštní část důvodové zprávy naproti tomu **důsledně** píší o procentních bodech"

(a) **Obecná část A (line 91) says „o 10 %"** — „…cíle nastavené pro minimální podíl
odděleně soustřeďovaných komunálních odpadů **o 10 %**." (b) The **zvláštní část quantifies
nothing**. (c) Two of the three supporting quotations are not in the document.
`citations[1]` — „Obecná i zvláštní část důvodové zprávy popisují tutéž úlevu jako snížení
cíle „o 10procentních bodů", **nikoli „o 10 %"**" — is false on both limbs.

**The underlying finding is real and the fix was right to elevate it** — the bill genuinely
uses both units, and the 54 % vs 50 % arithmetic against the ~60 % target
(`tisk-161/269099.txt:98-99`) is correct. What is needed is the true distribution: the
**operative text says „o 10 %" twice, obecná část A says „o 10 %", obecná část C says
„o 10procentních bodů" twice, and the zvláštní část gives no figure** — i.e. the memorandum
contradicts *itself* as well as partly contradicting the enacting text. That is a stronger
finding than the one asserted, and it needs no invented quotations.

---

## Regressions of already-diagnosed patterns

### N2 (MAJOR) — `verdict-74.json` · `citations[11]` · the B5 mis-kinding pattern moved from 161 into 74

```json
{ "claim": "Bohuslav Niemiec je v grafu evidován s peněžní vazbou na CEVYKO a.s. …
            jde o meziobecní firmu s licencí k nakládání s odpady, na jejíž dozorčí
            radě Niemiec zasedá — …vazba institucionální (dozorčí seat), nikoli vlastnická.",
  "kind": "graph_fact", "source": "company:ico:08599254" }
```

Municipal ownership, the trade licence and the supervisory-board seat are **web facts**,
not graph facts — the graph's `moneyTies` carry only `{ico, name, urn, contractCzk}`. They
are packed into a single `graph_fact` citation sourced to the company urn. This is the
exact defect B5 named, and `verdict-161` now handles the identical facts **correctly**,
with three separate `web` citations (`citations[7]`, `[8]`, `[9]`). The batch is internally
inconsistent about how the same evidence is kinded. 74's ownership prose („mj. obec
Havířov, spoluvlastník ASOMPO") also carries no citation at all, where 161 gives 35/35/30
with a source.

### N3 (MINOR) — `verdict-74.json` · English residue introduced by the fix

„vazba je tedy institucionální (**dozorčí seat**), nikoli vlastnická" — in
`conflictAssessment` **and** `citations[11]`. `seat` is English; a full re-sweep across all
10 verdicts finds it in no other file (the only other regex hits, `text`, are the Czech
word). `lawJargonIssues()` does not match it. Also in 74: „meziobecní **svazkovou** firmu"
implies a dobrovolný svazek obcí, which CEVYKO (an a.s. with municipal shareholders) is
not; and Havířov is a **statutární město**, not „obec".

### N4 (MINOR) — `verdict-161.json` · 3 of 6 ownership assertions still uncited

`ARENA BRNO`, `Teplárny Brno` and `CEVYKO` now carry `web` citations. **`Dopravní podnik
města Brna`, `SAKO Brno` and `MERO ČR` do not** — they ride on „obdobně jsou komunálně,
resp. státem vlastněné i zbylé tři", which is still an assertion. Materially better than
B5 (nothing is now *mislabelled*), but the gap is under-citation in a product whose brand
rule is that every claim cites its source. Separately, `citations[4]` sources an ownership
fact to **Wikipedia** — weak for a public-accountability claim where `hlidacstatu.cz`
(already used at `citations[5]`) covers the same ground.

---

## Findings still open from the first pass

- **M19 (MAJOR) — STILL OPEN, both files.** `collision-close-reads-batch015-gA.json` was
  **not modified** (mtime unchanged at 09:39) and gB's `67-75` record was not corrected on
  this point. Both still misread the queue's `odstavecOverlap` (which holds **§ labels**)
  as odstavec numbers, and credit themselves with overturning a claim the queue never made:
  gA `65-103` — „Metadata fronty sice u této dvojice hlásí shodu na úrovni odstavce „3"…"
  (queue truth: `paragraphs:["3"], genuineParagraphs:["3"], odstavecOverlap:["3"]` — „3" is
  the §); gB `67-75` — „Fronta označila § 55c jako sdílený **se shodou na úrovni odstavce**"
  (queue truth: `odstavecOverlap:["55c"]` — unmistakably a § label).
- **M11 (now MINOR) — STILL OPEN.** `verdict-246` now correctly says the provision „zaniká
  a jeho číslo je obsazeno jiným předmětem úpravy", but neither verdict states the concrete
  consequence: applied after 246, tisk 171's instruction would hit the new odst. 4 písm. d)
  („1 den činí 50 Kč") and leave „1 den" standing in the untouched odst. 3 and odst. 5.
- **Minor 1** (`verdict-215` `citations[4]`, „původně vložil" inferred from an as-amended
  citation), **minor 2** („Kateřina" vs „Katerina" Demetrashvili), **minor 3**, **minor 4/5**
  (`verdict-145`'s „ústavně vyžadovaná spolupodpisová procedura" — *kontrasignace* is a
  presidential-act institute — and the uncited role/figures), **minor 9** (`verdict-171`
  `citations[2]`, „účinnost rovněž 1. ledna 2027" omits 246's čl. II split date of
  30 Nov 2026), and gA **minors 14/15/16** are all unchanged. `verdict-145` and
  `verdict-171` were not touched at all.
- **New nit:** `verdict-232` `citations[5]` and `verdict-104` `citations[5]` quote the
  amending instructions with straight `"` where the rest of the corpus uses „…".

---

## Per-finding closure ledger — verdict + collision layer

| # | finding | status | evidence |
|---|---|---|---|
| B1 | CEVYKO asserted private | **CLOSED** | 161 now states Havířov 35 % / ASOMPO 35 % / Spolek 30 %, „nejde tedy o soukromou firmu, ale o meziobecní subjekt ve vlastnictví obcí", Niemiec „v dozorčí radě, bez evidovaného akcionářského podílu", disposed „podle téže metodiky, jakou tento posudek uplatňuje na Hladíkovy komunální vazby"; severity medium→**low**. Independently matches the public record. |
| B2 | 161/74 contradict on sector | **CLOSED** | 74's „působí mimo obory dotčené novelou" is gone; now „skutečně v oboru, který novela v čl. V … mění", disposed like SAKO. Both files now agree on ownership, seat and sector. |
| B3 | 161 count 3+7≠12 | **CLOSED** | „Z dvanácti… Petr Hladík, Helena Langšádlová a Bohuslav Niemiec… U zbývajících **devíti**" (nine names listed). Programmatic check vs payload: 12 / 3 / 9 |
| B4 | 74 „pěti" vs six names | **CLOSED** | „U zbývajících **šesti** předkladatelů (Pláteník, Brzesková, Filipovičová, Kršková, Krutáková, Svárovská)". Payload: 9 / 3 / 6 |
| B5 | contaminated + mis-kinded citation | **CLOSED in 161** (the „Vodovody a kanalizace" claim is gone; ownership split into properly-kinded `web` citations + a clean `graph_fact`) — but see **N2**, the pattern regressed into 74, and **N4**, 3/6 still uncited |
| B6 | 218's refuted accusation | **CLOSED — exemplary** | `unstatedEffects: []`; researchedContext now states the disclosure and I verified all three limbs: **1.7** at line 359, **2.7** at line 500, and the SAFE competence discussed in the corruption-risk section (lines 933-948). confidence 3→4. An honest negative report. |
| B12 | 13-16 mislabelled confirmed-collision | **CLOSED — exemplary** | Reclassified `coordination-risk`; the commutativity argument now matches my own derivation („KAŽDÁ čárka v jím vkládaném textu … je následována „§"…"); the odst. 4 non-transfer is stated; the cluster is restated as **hvězdicová struktura** around tisk 64 with the batch-014 record quoted accurately. gB counts recomputed to `{confirmed:1, coordination:4, incidental:1}` = 6. Both new excerpts re-verified against the cached texts: **3/3 fragments OK, 0 MISS**. |
| M1 | 161 sector overclaim | **CLOSED** | Now states the direction of effect: „směr jejího účinku … by věcně spíše snižoval než zvyšoval množství odděleně sbíraných surovin", and that the bill changes „jen povinnost obcí…, nikoliv žádnou platbu, poplatek ani zadávací mechanismus". |
| M2 | %-vs-p.b. | **REOPENED as N1** — corrected in direction and elevated, but supported by two fabricated quotations and a false consistency claim |
| M3/M5 | money qualifiers | **CLOSED** | 161 `citations[6]`: „úhrn veřejných smluv **firmy** 301 393 871 Kč, vazba **čeká na lidskou kontrolu**"; 232 `citations[3]` and both 104 graph citations likewise. |
| M4 | Babiš aggregate | **CLOSED** | „úhrn veřejných smluv **firem 1 991 751 917 Kč**; všechny vazby čekají na lidskou kontrolu" — matches my independent sum of the 14 `contractCzk` values exactly. |
| M6 | 167 „second extension" | **CLOSED — exemplary** | The claim is explicitly abandoned in-text: „…nedokládá, že se tato pozdější novela týkala právě posouvaného data v odst. 1 — tvrzení o „druhém prodloužení téže výjimky" proto v dostupném textu oporu nemá **a je opuštěno**." `citations[2]` re-scoped to exactly what the as-amended citation proves. |
| M7 | 215 → profesní komory | **CLOSED** | „profesní komory" removed from `researchedContext`, from `unstatedEffects[1]` and from `citations[1]`; § 107a now confined to „předpisu vysoké školy", with the § 101g distinction drawn separately. |
| M8 | 171/246 disagree | **CLOSED** | 246 now: „nejde o souběžný zásah do totožného ustanovení, ale o **smazání a znovupoužití čísla odstavce**" — aligned with 171. `citations[2]` re-kinded `web`→**`bill_text`** with the `tiskt.sqw?…ct=171` URL. Both files now name odst. 2 **a 4 písm. c)**. |
| M9 | 104×232 collision uncited | **CLOSED** | 232 `citations[5]` cites tisk 104's text, 104 `citations[5]` cites tisk 232's — both quoting the operative instructions verbatim. Verified against source: „V § 30 odstavec 3 zní:" (`tisk-104:33`) and „V § 30 se odstavec 3 zrušuje." (`tisk-232:73`) |
| M10 | Richterová uncited | **CLOSED** | 218 `citations[4]`, `kind:"web"`, sourced to the tisk-168 document itself. |
| M19 | queue metadata misreported | **STILL OPEN** | gA untouched; gB `67-75` uncorrected. See above. |
| M20 | rubric inconsistency | **CLOSED** | resolved as a consequence of B12; `13-16` now sits with `64-260`, `111-207` and `189-248` at `coordination-risk`. |

## Gate re-run

`validateLawVerdict()` + `lawJargonIssues()` over all 10, with `knownLawRefs`/`knownIds`
from the targets payload: **10/10 `ok: true`, zero errors, zero jargon hits** — including
`verdict-218` with `unstatedEffects: []`, so the empty-effects shape is schema-legal.
Sponsor arithmetic recomputed against the payload for all 10: **every "N of M" now closes.**

Note what this still means: **N1's two fabricated quotations pass the gate.** The
recommendation in §9 stands and should gain a fifth item — *any string presented in
guillemets as a quotation from a bill must be located in that bill's cached text, NFC- and
whitespace-normalised, before the verdict is accepted.* That single check would have caught
the only blocking defect remaining in the verdict layer, and it is the cheapest of the five.

---

## The sweep is now the primary blocker — **do not run `--commit`**

The jargon sweep was rebuilt from 16 rewrites to 29. The urn class is genuinely closed and
the tautology defect is fixed. But the rebuilt rules **over-match**, and two of the 29
rewrites now write **false facts** onto live bill nodes. Both are independently re-verified
below from `batch-015-old27-sweep.json` itself.

### N5 (BLOCKING — brand rule) — `patched[11]`, tisk 124, `forensic_stated_reasoning` · a sourced CZK figure was falsified

```
BEFORE: … zápočtu mezi novým „rodičovským příspěvkem před porodem" (novou paušální
        dávkou 15 000 Kč měsíčně před porodem od 1. ledna 2027) a stávajícím rodičov…
AFTER : … zápočtu mezi novým „rodičovským příspěvkem před porodem" (novou paušální
        dřívějším zpracováním 000 Kč měsíčně před porodem od 1. ledna 2027) a stávajícím…
```

Corpus-wide: `15 000 Kč` appears **1× in BEFORE, 0× in AFTER**.

Two independent faults compound here. First, `dávka` in this sentence is the **social-benefit**
sense — a monthly parental allowance — not the pipeline sense the rule targets; the rewrite is
a category error. Second, the quantifier `\bdávkou\s*0*\d{1,3}\b` consumed the `15`, so
**15 000 Kč became 000 Kč**. The result is grammatically broken (`novou paušální` fem. +
`zpracováním` neut.) and, far worse, **numerically false**.

This is the brand rule — *every rendered number cites its source, and nothing renders a figure
the data doesn't carry* — violated by the remediation itself, on a figure that would be stamped
with pass-49 provenance. It is the most serious single defect found anywhere in this audit.

### N6 (BLOCKING) — `patched[23]`, tisk 216, `forensic_researched_context` · an identifier was stripped from the § list it labels

```
BEFORE: …i vůči tiskům z této dávky 173 (§ 199 / § 302 / § 303) a 196 (pouze § 9, …)
        se tisk 216 dotýká zcela nepřekrývající se množiny ustanovení…
AFTER : …i vůči tiskům z této dřívějšího zpracování (§ 199 / § 302 / § 303) a 196 (pouze § 9, …)
        se tisk 216 dotýká zcela nepřekrývající se množiny ustanovení…
```

Stated precisely (the count matters): `173` occurs **2× in BEFORE and 1× in AFTER** — it
survives in an earlier enumeration („churn 6: tisky 111, 115, 173, 196, 207, 216") but is
deleted from **the sentence that carries its section list**. The consequence is that
`(§ 199 / § 302 / § 303)` is now **orphaned**: a reader cannot tell which print those
sections belong to, while the neighbouring `196` keeps its own list. The sentence also leaves
a dangling feminine genitive `této` in front of a neuter genitive.

Cause is rule ordering — `\bdávky\s*0*\d{1,3}\b` fires before the `\btéto dávky\b` rule that
was written for exactly this phrase, so the specific rule never sees the string.

### N7 (MAJOR) — `patched[18]`, tisk 173 · `verdict-115` destroyed rather than made filename-safe

```
BEFORE: … v § 196 a § 55 odst. 2, verdict-115.json) je překryv ustanovení nulový
AFTER : … v § 196 a § 55 odst. 2, archivní podklad tohoto projektu) je překryv ustanovení nulový
```

B7 is closed *mechanically* — `verdict-\d+` 1→0, `\.json` 1→0, no `verdict-115.strojově
čitelný výstup` hybrid is produced. But the extension no longer survives **because the whole
filename is gone**, replaced by the content-free „archivní podklad tohoto projektu". The
checkable artefact id is destroyed. Same failure class as M13, relocated.

### B8 — „dávka" grammar · **STILL OPEN** (4 of 29 broken)

The post-fix is a single five-verb whitelist,
`/\bzpracování (zjistil|potvrdil|našel|uvedl|popsal)a\b/g → "$1o"`, which fires correctly 3×
and misses everything outside the list:

| row | defect |
|---|---|
| `patched[22]` tisk 207 | „jaké **dřívější zpracování označila**" — neuter subject, feminine verb; `označil` is not in the whitelist |
| `patched[23]` tisk 216 | „z **této dřívějšího zpracování**" — orphaned feminine demonstrative (see N6) |
| `patched[28]` tisk 248 | „**Dávkový prověření**" — masculine adjective + neuter noun, **and `Dávkov-` is the very stem B9 claimed to close** |
| `patched[11]` tisk 124 | „novou paušální **dřívějším zpracováním**" (see N5) |

### B9 — detector widening and the throw-guard · **STILL OPEN, and the guard certified this payload**

The widening did not land in `lib/analysis/public-copy.ts` (unchanged, nominative-only). It
landed in `lib/analysis/law-verdict.ts:125`, whose comment claims it covers „v dávce 001 …
the k→c locative". **It cannot**: the locative of *dávka* is `dávce` — the `k` is not there,
so any pattern anchored on `dávk` is structurally incapable of matching it.

A second, subtler bug: `\bdávkov\w+\b` and the sweep's `\bdávkov(ý|ého|ém|ým|á|é|ou)\b`
**cannot match `Dávkový` or `dávková`**, because JS `\w`/`\b` are ASCII-only and `ý`/`á`/`é`
are not word characters, so the trailing `\b` fails. That is precisely why `patched[28]`
shipped „Dávkový prověření".

Consequence: `lawJargonIssues(after)` returns **0 issues for 29/29 strings**, while a
declension-aware scan finds **15 surviving hits** (54 in BEFORE). At least five are
unambiguously the pipeline sense and should have been rewritten — `patched[16]` „v souladu
s **předchozími dávkami**", `patched[18]` and `patched[20]` „pro **koordinátora dávky**",
`patched[1]` and `patched[5]` „v této i předchozí **dávce**". The remaining hits are the
legitimate benefit sense and are correctly untouched. **The throw-if-remaining guard is
worthless for this class**, and it is what certifies the payload as clean.

Other internal vocabulary still ships beside the rewritten prose, matched by no rule:
`v grafu případu law` ×2, `uzel` ×1, `churn 6` ×3, `gatovanému tisku` ×1, `paralelně
pracujícímu agentovi` ×2.

### M13 — batch identifier · **STILL OPEN**

The two bespoke meta-sentence rewrites address a different sentence (tisk 40's
`sponsorContractCzk: 0, sponsors: []`), not the batch identifier. Every `dávka/dávky/dávce
001` still becomes an identifier-free „dřívější zpracování": **22 three-digit `0XX`
identifiers are destroyed across 18 of the 29 rewrites** (independently recounted). With
`verdict-115` (N7) and the tisk-216 case (N6), the sweep removes **24 checkable identifiers**
from a corpus whose brand rule is that every claim can be traced.

### M12 — tautology/nesting · **CLOSED**

0 name-echo parentheticals and 0 nested parentheses in the AFTER text. The person urn
parenthetical is now dropped rather than substituted, and the company urn degrades to a bare
`IČO N` after the name already present. Urn classes fully closed: `company:ico:` 36→0,
`psp:person:` 5→0, `bill:tisk:` 1→0; `batch`, `scan`, `json`, `pass \d`, `pending_review`,
`graph_fact`, `bill_text`, snake_case and camelCase all 0.

### M14 — silent label fallback · **not triggered here; code path unchanged**

No `společnost s IČO`, `poslanec s psp id` or `sněmovní tisk (interní id` reaches the AFTER
text. But the company rule was fixed by dropping the label entirely rather than by adding a
guard, and the person and bill fallbacks remain **silent** — no counter, no warning, no throw
— and neither emitted string trips `lawJargonIssues`. The mechanism is intact for the next
corpus.

### Write path · intact, but still uncounted

`--commit` remains **dry-run by default**, **expectation-guarded** (`if (arr[…][m[3]] !==
f.before) throw` and `if (props[m[1]] !== f.before) throw`, both before any write) and
**merge-preserving** (`structuredClone(bill.props)` → single-field assignment → `{ ...bill,
props }`). The rebuild broke none of the three. Residual: **no assertion that the rewrite
count is 29** — nothing pins `patched.length` or that `before !== after`, so a regex that
silently stops matching yields a smaller, still-green payload; `--commit` recomputes from
`IN` and rewrites `OUT` in the same run, so the reviewed artefact need not be the committed
one; and `(props.forensic_provenance as …).jargon_sweep = …` throws if a bill carries no
`forensic_provenance`.

### Tests · green for the wrong reason

`lib/analysis/public-copy.test.ts` 13/13 and `lib/analysis/law-verdict.test.ts` 11/11 both
pass. Neither contains a `dávce`, `dávkov` or `scan` case; law-verdict's only batch test
(„…už dávka batch-004…") passes on the `\bbatch\b` alternative, not on anything `dávk`-shaped.
**Deleting the entire `dávk`/`dávkov`/`scan` widening would not fail either suite** — the same
shape as the pass-42 lesson recorded in `CLAUDE.md`.

---

## Dependency surface — B10 and B11 verified by code-read and measurement

### B10 — excerpt no longer truncates away the placeholder · **CLOSED**

The loader now genuinely loads the census (`CENSUS_FILE =
"docs/data-analysis/case-law/payloads/batch-014-dependency-census.json"`), `CONTEXT_MAX_CHARS
= 220` is live rather than dead, and `centeredExcerpt()` windows on the placeholder instead
of the string start.

Independently measured over the census payload with a reimplementation of `centeredExcerpt`:
**all 67 census contexts produce a centered excerpt that still contains the placeholder, and
0 exceed the 220-char bound.** Since the 18 rendered hits are a subset of those 67, the
18/18 claim holds.

Two implementation details that make this robust, both worth keeping:

- `PLACEHOLDER_RE = /(?:…|\.\.\.)\s*\/\s*\d{4}\s*Sb\b/` matches **both** the single-glyph
  ellipsis and the literal three-dot run — the corpus uses both, and matching only `…` would
  have silently returned tisk 206/58 to the old start-anchored cut.
- **No `/g` flag**, so the shared module-level regex carries no `lastIndex` state between
  calls. With `/g` and `.exec()` this would have mis-centered intermittently depending on
  call order — a real trap that was avoided.

Edge cases are handled: a placeholder near either end clamps via
`start = Math.max(0, end - max)`, and a string shorter than the bound is returned whole.
The gate runs on the full text *before* centering, so a context failing the Czech/jargon
gate is withheld entirely rather than trimmed into something misleading.

### B11 — inferred companions no longer over-linked · **CLOSED**

The hedge rule is present and is documented against the analyst's own phrasing („MOŽNÁ …
tisk 62 …, ALE BEZ EXPLICITNÍ TEXTOVÉ VAZBY"), applying the same suppression already used
for a `likelyCompanionTisk` absent from the corpus, and the comments state the hedge wording
stays visible rather than being replaced by a bold link. The per-row „odvozeno · čeká na
kontrolu" labelling is in place.

### Scope note

This closure pass re-verified the two BLOCKING surface items by code-read and direct
measurement, as instructed. The surface's **MINOR** residue from the first pass (cs/en key
parity for the new keys, `navModel` anchor registration, `reportLoaderFailure()` on the
silent `return null` paths, the „ručně auditovaná" wording of M16, the M18 duplicate-row
count, and the absence of a colocated test for the new gate/guard) was **not** exhaustively
re-checked here and should be confirmed before the surface ships. Note that
`features/lawwatch/` still contains no colocated test covering the dependency loader — the
four existing `*.test.ts` files predate it.

---

## Closure summary

### Status of the original 12 BLOCKING

| # | status |
|---|---|
| B1 CEVYKO private | **CLOSED** |
| B2 161/74 contradiction | **CLOSED** |
| B3 161 count | **CLOSED** |
| B4 74 count | **CLOSED** |
| B5 contaminated/mis-kinded citation | **CLOSED in 161; regressed into 74 (N2)** |
| B6 218 refuted accusation | **CLOSED — exemplary** |
| B7 json filename mangling | **CLOSED mechanically; citation destroyed instead (N7)** |
| B8 „dávka" grammar | **STILL OPEN — 4 of 29 broken** |
| B9 detector / throw-guard blindness | **STILL OPEN — 15 hits survive, 29/29 certified clean** |
| B10 truncated excerpts | **CLOSED — 67/67 verified** |
| B11 lead rendered as finding | **CLOSED** |
| B12 13-16 confirmed-collision | **CLOSED — exemplary** |

**9 closed, 1 closed-with-regression, 2 still open.**

### New defects introduced by the remediation

| # | severity | what |
|---|---|---|
| **N1** | **BLOCKING** | `verdict-161` — two fabricated quotations plus a false consistency claim, inside the newly elevated headline finding |
| **N5** | **BLOCKING** | sweep `patched[11]` — **`15 000 Kč` rewritten to `000 Kč`**; a sourced money figure made false |
| **N6** | **BLOCKING** | sweep `patched[23]` — tisk `173` stripped from the sentence carrying its § list, orphaning `(§ 199 / § 302 / § 303)` |
| N2 | MAJOR | `verdict-74` `citations[11]` — web facts (ownership, licence, board seat) packed into a `graph_fact` citation; the B5 pattern relocated |
| N7 | MAJOR | sweep `patched[18]` — `verdict-115` replaced by content-free prose |
| N3 | MINOR | `verdict-74` — English residue „dozorčí **seat**"; „svazkovou" and „obec Havířov" imprecise |
| N4 | MINOR | `verdict-161` — 3 of 6 ownership assertions uncited; one sourced to Wikipedia |

Plus, still open from the first pass: **M19** (gA untouched; queue `odstavecOverlap` misread
as odstavec numbers in both files), **M13** (24 checkable identifiers destroyed by the
sweep), **M14** (label fallbacks still silent), **M11** and the minor list.

### Why this is REOPENED and not "ready with caveats"

Three blocking defects remain, and all three are **worse in kind than what they replaced**:

1. The verdict layer moved from an *unsupported inference* to *fabricated quotations* (N1).
2. The sweep moved from *mangling a filename* to *falsifying a CZK amount* (N5) and
   *orphaning a section list* (N6).

The pass-49 write would stamp `forensic_provenance.jargon_sweep = { pass: 49 }` onto bill
nodes carrying a false money figure. In a product whose stated brand rule is that *every
rendered number cites its source and nothing renders a figure the data doesn't carry*, that
is the one outcome the gate exists to prevent.

Note also that **every one of these passes every gate**: `validateLawVerdict()` is 10/10
green, `lawJargonIssues()` is 0/29 on the sweep output, and both test suites are green — and
would stay green if the entire `dávk`/`dávkov`/`scan` widening were deleted. The remediation
did not weaken the gates; it demonstrated again that they cannot see this class of defect.

### Minimum to close

1. **N5** — restore `15 000 Kč` and exclude the social-benefit sense of *dávka* from the
   rewrite rules. A quantifier that can consume a digit run adjacent to a currency amount
   must never run unbounded.
2. **N6** — fix rule ordering so `\btéto dávky\b` precedes `\bdávky\s*\d\b`, and restore the
   `173` label on its § list.
3. **N1** — replace the two fabricated quotations with the true distribution (operative 2×
   „o 10 %", obecná část A „o 10 %", obecná část C 2× „o 10procentních bodů", zvláštní část
   no figure). The finding survives, and is stronger, without them.
4. **B8/B9** — either make the rules declension-complete (note `\w`/`\b` are ASCII-only, so
   `dávkov\w+` cannot match `Dávkový`; and no `dávk`-anchored pattern can ever match the
   locative `dávce`), or narrow the sweep to the cases it can handle correctly and stop
   claiming the rest are clean. Correct the false comment at `law-verdict.ts:120-124`.
5. **N2/N7, M19, M13** — re-kind 74's citation, restore the destroyed identifiers, and
   correct the queue-metadata sentences in gA and gB.

### Gate additions (now five)

The four proposed in §9, plus:

5. **Quotation existence** — any string presented in guillemets as a quotation from a bill
   must be locatable in that bill's cached text, NFC- and whitespace-normalised (catches N1).

And two for the sweep specifically: assert `patched.length` against an expected count so a
regex that stops matching cannot yield a smaller green payload; and assert that **no rewrite
changes any digit sequence** — a jargon sweep has no business altering a number, and that
single invariant would have caught N5 and N6 outright.

---

## Dependency surface — full re-verification (supersedes the scope note above)

The scope note in the preceding section reserved the surface MINORs for later. They have now
been re-checked by running the loader and measuring the rendered output, not by code-read
alone. Two corrections to the section above and one new BLOCKING defect follow.

**Caveat on tree state:** a concurrent session is editing these files. `DependencyRadar.tsx`
was converted from hardcoded Czech to `useTranslations` at **10:34**, *after* the batch-015
remediation window (`getDependencyData.ts`, 10:07). N8 below is the current state of the
tree and blocks the surface either way, but it is likely that session's half-landed work
rather than the remediation's.

### N8 (BLOCKING) — the whole section renders missing message keys, in both locales

`DependencyRadar.tsx` calls ten keys plus one shared key:

```
dependency.title  dependency.aside  dependency.intro  dependency.hitBadge
dependency.dependsOn  dependency.pendingTranscript  dependency.noteLabel
dependency.withheldNote  dependency.coverageFootnote  dependency.sourceNote
printNumbered
```

`messages/cs.json` and `messages/en.json` both carry exactly:

```
back eyebrow title intro section1Title realSection1Title section1Aside effectiveFrom
sampleNote beforeLabel afterLabel passedBy openInChamber section2Title realSection2Title
section2Aside rejectedAtStage voteLink pipelineFootnote
```

**No `dependency` subtree and no `printNumbered` in either catalog** (verified directly;
`messages/cs.json` mtime 2026-08-04 22:47, untouched by this batch). So every string in the
section — the heading, the honesty block, **the B11 `pending_review` badge**, and every
`SourceNote` — renders as a key path or `MISSING_MESSAGE`.

cs/en parity is technically intact (0 cs-only, 0 en-only) **only because neither locale has
the keys**. The M-list item "no `lawwatch.dependency*` keys, so `en` renders Czech" has not
been closed; it has become worse — the section now renders nothing readable in *either*
locale. It also makes M16's copy unverifiable: the „ručně auditovaná" wording moved into
`t("dependency.intro")`, a key that does not exist, so there is no evidence a qualifier was
added.

### N9 (MAJOR) — the badge reintroduces debt `DESIGN.md` records as paid off

`DependencyRadar.tsx:92`:

```tsx
<SourceNote tone="steel" className="!text-[10px]">{t("dependency.hitBadge")}</SourceNote>
```

18 instances. `docs/DESIGN.md:73-81` states the opposite as settled: *"No pixel-valued
arbitrary sizes … below the 11 px floor §5 sets. `SourceNote` now uses `text-xs` (12 px) in
both its modes, and the landing's remaining `text-[10px]` (**including two `!text-[10px]`
overrides that were defeating `SourceNote` from the call site**) are gone."*

The label set at 10 px is precisely the one carrying the `pending_review` qualifier, against
§3's rule that *"a citation that cannot be read has not been made."* The fix for B11 is
undercut by the styling of the fix itself.

### Corrections to the two BLOCKING closures

**B10 — still CLOSED, and now verified end-to-end.** Running the loader under
`--conditions=react-server` and testing every produced excerpt against the loader's own
`PLACEHOLDER_RE`: **18 rendered hits, 18 with placeholder, 0 withheld**
(`bills=10 companionCount=18 unclear=23 total=67`). Pairing is real rather than assumed —
all 26 bills have equal triage/census hit counts and **67/67** triage contexts are substrings
of their positionally-paired census context, which is what `getDependencyData.ts:215`
asserts. Both placeholder forms match; tisk 58/206 use `.../2025 Sb.` and are among the 18.
Synthetic edge cases (placeholder at start, at end, middle, sole content, absent,
whitespace-heavy) never produce an empty or placeholder-less excerpt.

Two new MINORs it introduced:
- **The stated bound is not the enforced bound.** Elision markers are appended *after* the
  220-char slice (`:150-151`), so live max is **221**, and a middle-anchored case measures
  **222**.
- **The elision glyph collides with the placeholder glyph.** 14 of 18 excerpts now open with
  `…` immediately followed by a mid-word cut — tisk 53 renders `„…4 Sb., zákona č. 180/2024
  Sb., …"`, so a reader scanning for „č. …/2026 Sb." meets `…4 Sb.` first; a whitespace-heavy
  input renders `„……/2026 Sb.…"`. Not a fabrication, but it erodes the legibility the fix
  existed to restore.

**B11 — downgrade from CLOSED to PARTIALLY CLOSED.** The two mechanisms are real: the badge
exists (`:92-94`), and the 250→62 link is genuinely gone — `getDependencyData.ts:236`
`likelyCompanionTisk: companionSubject !== null && !weakEvidence ? tisk : null`, probed as
`tisk 250 … weak=true … tisk#=null`, with the hedge rendering verbatim. But:

- The section still calls hits **`nálezů`** (*findings*) everywhere the count is spoken —
  intro, withheld note, closing SourceNote. Only the row badge says „lead … ne zjištění",
  and that badge is currently a missing key (N8) and 10 px when it resolves (N9).
- **`weakEvidence` is dead data on the surface** — `grep -rn "weakEvidence" features/` outside
  the loader returns nothing. A hedged guess (250) and an unresolvable out-of-corpus companion
  (206→777) render identically, so the reader cannot distinguish *"we doubt this"* from
  *"we cannot resolve this."*
- The unlinked, hedged subject is styled **`font-bold text-ink`** (`:108`) while an evidenced,
  linked companion's prose is `text-steel` — **the weakest evidence gets the loudest type.**
- `WEAK_EVIDENCE_RE = /bez\s+explicitn[ěí]\s+textov[ěé]\s+vazby/i` matches **1 of 18**, with
  **no false positives**; the two other hedged subjects (tisk 58 „…neurčitelný", tisk 64
  „…nedá určit") already carry `likelyCompanionTisk: null`, so there is no false negative in
  effect. But it is a single verbatim phrase match, not a hedge detector — a future
  „možná tisk N" without that exact clause links unhedged.

### Remaining M-items — measured

- **M16 — STILL OPEN.** 1 of 18 companion-hit `reasoning` strings mentions Spot-verified
  (14 of 67 overall). Copy now unverifiable per N8.
- **M17 — STILL OPEN, all three parts.** The subject link is still ungated —
  `<Link href={`/zakony/${bill.cislo}`}>` at `:70-76`, with no membership test though
  `billTitleByCislo.has(...)` is used two lines later for the companion — and
  `app/zakony/[cislo]/page.tsx:37-38` hard-404s. Latent today only because the census scanned
  the same 141 bills; `:77 {title && …}` already tolerates a missing bill, so the link ships
  regardless. Tisk 777 remains unlinked with nothing saying it is unresolvable, and the
  chamber problem is untouched — `graph-log.md:1161` records this edge as **`206→ST 777`, a
  Senate print**, while the rendered subject says „označena přímo jako **sněmovní** tisk 777".
- **M18 — PARTIALLY, incidentally.** 10 distinct pairs, 18 rows. Tisk 153 still renders six
  rows; B10's centering made their excerpts distinct, but the claim line is identical six
  times and no dedupe was added. Count copy unchanged in structure.
- **CLOSED:** psp.cz attribution; mixed quote marks (`:120` uses „…“).
- **STILL OPEN:** `generatedAt` never rendered; dead `!companionExists` branch (`:111-116`,
  unreachable since `companionSubject === null` forces `likelyCompanionTisk === null`);
  `f.int()` on print numbers (`:74`, `:104` — renders `1 234` for a 4-digit print); `id="zavislosti"`
  absent from `navModel.ts:172-175`; three silent `return null` paths (`:187`, `:190`, `:242`)
  with no `reportLoaderFailure()` — only the census sub-read (`:200`) and the outer catch
  (`:256`) report; **no colocated test** — `centeredExcerpt` and `WEAK_EVIDENCE_RE`, the two
  functions this remediation turns on, are untested.

### Gates

- `npx eslint features/lawwatch --no-warn-ignored` → **0 errors**, 2 pre-existing unrelated
  warnings (`lawwatchLabels.ts:114,115`).
- `npx vitest run features/lawwatch` → **4 files / 35 tests pass**; **none cover the
  remediated code**.
- `npx tsc --noEmit` → **9 errors**, none in `features/lawwatch` — all in
  `features/civicscore/{CivicScorePage,KrajPage,components/WeightPanel}.tsx` and
  `features/schranka/deriveDeltas.ts`. Unrelated to batch-015, but **`npm run check` is red
  repo-wide**, so the definition of done cannot be met today by anyone.

### Amendment to the closure summary

The new-defect table above gains two rows, and one status changes:

| # | severity | what |
|---|---|---|
| **N8** | **BLOCKING** | dependency section renders 11 missing message keys in both locales — including the B11 `pending_review` badge |
| N9 | MAJOR | `!text-[10px]` on `SourceNote` ×18, against `DESIGN.md:73-81` |

**B11: CLOSED → PARTIALLY CLOSED.** Blocking count for the closure check is therefore
**four** — N1, N5, N6, N8 — with B8, B9, M19 and the surface M-list still open.

---
---

# Final closure check (round 2)

Verified against the tree at 11:01–11:08. Independent recomputation; nothing taken on
report. No file edited, no git, no PGlite.

## VERDICT: **REOPENED**

The sweep is now genuinely safe — the digit invariant is real, correctly implemented and
empirically sound, and both destructive rewrites are gone. The surface is fixed. M19 is
fixed. But **N1 was not actually fixed**: only the word „důsledně" was removed. **Both
fabricated quotations are still there, verbatim**, and the citation asserting the false
claim is untouched — so the verdict now contradicts itself between its prose and its own
citation.

Worse, the corrections to `verdict-161` and to `gA 65-103` were **spliced into existing
sentences without repairing the surrounding syntax**, leaving two passages of broken Czech
with unbalanced parentheses. That is a new MAJOR, and it is the same failure mode in both
files.

---

## The one BLOCKING that did not close

### N1 — `verdict-161.json` · **REOPENED.** The fabricated quotations remain

Re-measured against `.data/law-collision-cache/tisk-161/269099.txt` (NFC, whitespace-collapsed):

| quote | in the bill? | still quoted in the verdict? |
|---|---|---|
| Q1 „Navržené snížení cíle odděleného soustřeďování o 10procentních bodů…" | **YES** | yes — legitimate |
| Q2 „…umožňuje snížení cílů podle § 59 odst. 3 věty první o 10procentních bodů…" | **NO** | **YES** |
| Q3 „snižuje cíle pro oddělené soustřeďování… o 10procentních bodů" | **NO** | **YES** |

Q2's real sentence lives at line 37–38 in the **operative příloha č. 13** and reads
**„o 10 %"**; the quotation inverts the unit and relocates the source. Q3's zvláštní část
sentence carries **no figure at all**; its ellipsis conceals an insertion.

What changed is only that „důsledně" is gone (confirmed: 0 occurrences) and a new sentence
concedes the memorandum also writes „o 10 %". That concession is **true and valuable** — it
is exactly the sharper finding recommended last round. But it does not repair the two
invented quotations, and it creates a direct self-contradiction:

- prose (new): „Sama důvodová zpráva přitom na jiném místě používá i formulaci **„o 10 %"**…"
- `citations[1]` (unchanged): „Obecná i zvláštní část důvodové zprávy popisují tutéž úlevu
  jako snížení cíle „o 10procentních bodů", **nikoli „o 10 %"**."

The citation now denies what the body asserts.

---

## New MAJOR — the same splice defect in two files

### N10 — `verdict-161.json` · `researchedContext` · the correction was inserted mid-quotation-list

```
…píše o procentních bodech („Navržené snížení … bodů…", „…umožňuje snížení cílů …
o 10procentních bodů…" Sama důvodová zpráva přitom na jiném místě používá i formulaci
„o 10 %", takže rozpor … běží … i uvnitř odůvodnění samotného. v obecné části i
„snižuje cíle pro oddělené soustřeďování… o 10procentních bodů" ve zvláštní části).
```

The new sentence was dropped between the second quotation and the words that governed it,
so the passage now runs `…bodů…" Sama … samotného. v obecné části i „…" ve zvláštní části).`
— a sentence ending in a full stop followed by a lowercase fragment, inside a parenthesis
that closes only after the debris. This is reader-facing forensic copy.

### N11 — `collision-close-reads-batch015-gA.json` · `65-103` · orphaned debris from the M19 edit

The M19 correction itself is right (see below), but it overwrote the first half of a
parenthetical and left the second half stranded:

```
…záměrně nerozhodnutelná a rozhoduje až toto čtení). 3, 103 = odst. 1); jde tedy
o koordinační riziko dvou nezávisle měněných odstavců téhož paragrafu…
```

`). 3, 103 = odst. 1);` is the tail of a former „(65 = odst. 3, 103 = odst. 1)". Parenthesis
balance in this `reasoning` is **3 open vs 4 close**.

---

## Still open

### B8 — „Dávkový prověření" survives · `patched[27]`, tisk 248, `forensic_citations[8].claim`

```
BEFORE: „Dávkový scan tohoto tisku v grafu případu law (dávka 001) eviduje u tisku 248…"
AFTER : „Dávkový prověření tohoto tisku v grafu případu law (dřívější zpracování) eviduje…"
```

Masculine adjective + neuter noun — the same string flagged last round, unchanged.

### B9 — the sweep now launders its own defect past the detector

The detector *was* rebuilt unicode-safe (`lib/analysis/law-verdict.ts:125`,
`\p{L}` + `/iu`), and the batch-007 ASCII lesson is correctly cited. But its adjectival rule
is `(?<!\p{L})dávkov\p{L}*\s+scan\p{L}*` — it only fires **when „scan" is attached**. The
sweep replaces `scan → prověření` *before* the guard runs, so by the time
`lawJargonIssues(t)` inspects the string, the token the detector needs is gone. **The
rewrite destroys the evidence of its own error**, and the throw-guard passes. That is why
N-B8 above ships clean.

Two batch-sense residues also survive (`\bdávce\b` with no digit): „v této i předchozí
**dávce**" in `patched[1]` and `patched[5]`. This is the documented limit — but it means the
sweep leaves the reader a batch self-reference in a document whose whole purpose was to
remove them. Separately, `lib/analysis/public-copy.ts:39` is **unchanged** — still
`/\b(batch|dávka)\s*\d/i`, ASCII and nominative-only — and `czechCopyOrNull` is the sweep's
second gate.

Other internal vocabulary still shipping in the rewritten output: „v grafu **případu law**"
×2, „**churn** 6" ×3, „**gatovanému** tisku" ×1, „**uzel**" ×1.

### N3 — „dozorčí seat" · `verdict-74.json` · `conflictAssessment`

The citation was cleaned, the prose was not: „…vazba je tedy institucionální (**dozorčí
seat**), nikoli vlastnická nebo osobně podnikatelská."

### M17 (chamber) / M18 — unchanged

Every row still hardcodes the chamber: `sn. tisk {bill.cislo}` at `DependencyRadar.tsx:114`
and `sn. tisk {rawTisk} (mimo korpus — bez odkazu)` at `:192`. Tisk 777 — which
`graph-log.md:1161` records as **`206→ST 777`, a Senate print** — therefore renders as
„**sn.** tisk 777 (mimo korpus — bez odkazu)". The „(mimo korpus)" wording correctly stops
asserting *resolvability*; it does not stop asserting the *chamber*. No dedupe was added, so
M18's duplicate rows stand.

---

## Closed this round — verified, not trusted

### N5 — the falsified money figure · **CLOSED**

`15 000 Kč` appears in **0 rows** of the payload, before or after — the blanket digit rules
are gone, so the field is no longer rewritten at all. **0 rows** contain an orphan „000 Kč".
The benefit sense is now correctly untouched everywhere: „peněžité **dávky** vyplácené
pojištěným osobám", „paušální **dávky** před porodem", „**dávkové** agendy", „rodinnými
**dávkami**" all survive verbatim.

### N6 — the stripped identifier · **CLOSED**

```
BEFORE: „…vůči tiskům z této dávky 173 (§ 199 / § 302 / § 303) a 196…"
AFTER : „…vůči tiskům z tohoto zpracování 173 (§ 199 / § 302 / § 303) a 196…"
```

`173` preserved **2→2**; the § list keeps its label; „tohoto zpracování" is correct neuter
genitive. The rule-ordering trap I expected (`\bdávky 001\b` pre-empting `\btéto dávky\b`)
does not fire — no „této dávky 001" exists in the corpus, and **0 orphaned demonstratives**
appear in any AFTER string.

### The digit invariant · **implemented, fail-closed, and sound on this corpus**

`sweep-old27-015.ts:77-107`. It throws **before** `patched.push`, so a violation aborts with
zero writes. I recomputed the digit multiset independently for all 28 rows: **22 rows change
digits, and every change falls in one of the four allowlisted classes.** Each class checked
empirically rather than assumed:

- **`001` ×19** — all 22 occurrences in BEFORE are genuine batch ids („dávka 001", „z dávky
  001", „v dávce 001"); none is a section, year or amount.
- **person ids `6433`, `6473`, `6545` ×3 rows** — each dropped parenthetical is preceded by
  the person's own name, and **the name survives in AFTER**: „Olga Richterová
  (psp:person:6473)" → „Olga Richterová", „Ivan Bartoš (…)" → „Ivan Bartoš", „Alenu
  Schillerovou (…)" → „Alenu Schillerovou".
- **`0` ×2** — both are the two bespoke prop-value rewrites, confirmed present in those exact
  rows and nowhere else.
- **`43370` → `248`** — the bill-urn→cislo transform, the only ADD in the payload.

Note the invariant is deliberately fail-closed on the `001` rule: the guard tests
`!t.includes("001")` as a substring, so an unrelated „1001" in the output makes it *refuse*
the drop rather than permit it. One structural gap worth recording: the allowlist permits a
person-id drop **because the urn sat in a parenthetical**, not because anything verified the
name survives — true for all three cases here, unchecked in general.

Also verified: **no real urn survives anywhere** in the 28 rewritten strings
(`law:sb:`/`bill:tisk:`/`psp:person:`/`company:ico:` all 0).

### N7 — **CLOSED.** „verdict-115.json" → „archivovaný posudek k tisku 115" — identity and digits both preserved.

### N2 — **CLOSED.** `verdict-74` `citations[11]` is now a clean `graph_fact` (tie + aggregate + „vazba čeká na lidskou kontrolu" only); the ownership, dozorčí-rada and sector facts moved to `citations[12]`, `kind: "web"`, sourced to the hlídač státu Vazby URL.

### M19 — **CLOSED in both files.** gB `67-75`: „…její pole překryvu nese označení paragrafů, nikoli odstavců; interakce byla z předběžné kontroly záměrně nerozhodnutelná…". gA `65-103`: the same correction, correctly stated — though it carries N11's debris.

### N8 — **CLOSED.** 0 `t("dependency…")` calls remain; the component is inline Czech again, so nothing renders a missing key. Catalogs untouched, as reported.

### N9 — **CLOSED.** No `text-[10px]` anywhere; the badge is `text-[11px]`, on the DESIGN.md floor, and `SourceNote` is used unmodified at `:73` and `:146`.

### B11 — **CLOSED.** Hits are „podněty" with correct numeral congruence (`1 podnět / 2–4 podněty / 5+ podnětů`, `:41-47`). `weakEvidence` is now live on the surface, driving a dashed-ochre „**· vazba nejistá**" badge (`:174-178`); hedged text is `italic text-steel`, never bold (`:192`); a companion links only when `billTitleByCislo.has(rawTisk)`.

### M16 — **CLOSED.** The audit claim is replaced by a measured figure rendered from the payload (`spotCheckedCompanionCount`, `:85-86`).

### M17 (subject link) — **CLOSED.** `const billExists = billTitleByCislo.has(bill.cislo)` gates the subject link (`:100-116`); out-of-corpus renders as text, not a `notFound()` link.

---

## Ledger

| item | status |
|---|---|
| N5 falsified money figure | **CLOSED** |
| N6 stripped identifier | **CLOSED** |
| digit invariant + allowlist | **CLOSED — sound on this corpus** |
| N7 verdict filename | **CLOSED** |
| N2 mixed citation | **CLOSED** |
| M19 queue metadata | **CLOSED** (both files) |
| N8 missing message keys | **CLOSED** |
| N9 10 px badge | **CLOSED** |
| B11 lead-not-finding | **CLOSED** |
| M16 measured spot-check count | **CLOSED** |
| M17 subject-bill link guard | **CLOSED** |
| **N1 fabricated quotations** | **REOPENED — BLOCKING** |
| **N10 spliced sentence (161)** | **NEW — MAJOR** |
| **N11 spliced debris (gA 65-103)** | **NEW — MAJOR** |
| B8 „Dávkový prověření" | **STILL OPEN** |
| B9 detector blinded by the sweep | **STILL OPEN** |
| N3 „dozorčí seat" | **STILL OPEN** |
| M17 chamber / M18 dedupe | **STILL OPEN** |

## Minimum to close

1. **N1** — delete the two quotations that are not in the document, and fix `citations[1]`,
   whose „nikoli „o 10 %"" is now contradicted by the verdict's own prose. State the true
   distribution: operative text 2× „o 10 %", obecná část A „o 10 %", obecná část C 2×
   „o 10procentních bodů", zvláštní část no figure.
2. **N10 / N11** — repair both spliced passages and check parenthesis balance.
3. **B8 / B9** — move the `scan` rewrite *after* the jargon guard, or make the adjectival
   detector rule independent of „scan"; then fix „Dávkový prověření".
4. **N3** — „dozorčí seat" → „místo v dozorčí radě".
5. **M17 chamber** — derive the chamber instead of hardcoding „sn.", or drop the prefix.

## The pattern worth recording

Three of this round's four defects are one failure mode: **a correction applied to a string
without re-reading the string it landed in.** N10 and N11 splice a true sentence into prose
whose syntax then breaks; B9's rewrite deletes the token a downstream guard depends on. The
digit invariant works precisely because it is the opposite — a *property of the whole
string* checked after every rule has run. The same shape, applied to syntax, would catch
N10 and N11: assert that a rewritten string has balanced parentheses and no full stop
followed by a lowercase word.

---
---

# Final closure note (round 3)

Verified against the tree as it now stands. Independent recomputation; nothing taken on
report. No file edited, no git, no PGlite.

## VERDICT: **CLOSED** — pass 49 may proceed

No BLOCKING and no MAJOR remain. Two MINOR residuals are recorded below; neither is a
correctness defect and neither gates the write.

---

## The reopened items

### N1 — fabricated quotations · **CLOSED**

Both invented quotations are gone from `verdict-161.json`, and every quotation that remains
is verbatim. Re-checked by locating each guillemet span in
`.data/law-collision-cache/tisk-161/269099.txt` (NFC, whitespace-collapsed):

| quote | source | status |
|---|---|---|
| „…je obec povinna zajistit splnění cíle … sníženého o 10 %" | § 59 odst. 3 sentence | **VERBATIM** |
| „snížení cílů podle § 59 odst. 3 věty první o 10 %" | příloha č. 13 | **VERBATIM** |
| „Navržené snížení cíle odděleného soustřeďování o 10procentních bodů pro obce s velmi nízkou…" | obecná část C | **VERBATIM** |
| „Snížení cíle o 10procentních bodů proto představuje přiměřenou korekci…" | obecná část C | **VERBATIM** |
| ~~„…umožňuje snížení cílů … o 10procentních bodů…"~~ | — | **removed** |
| ~~„snižuje cíle pro oddělené soustřeďování… o 10procentních bodů"~~ | — | **removed** |

The second surviving quote is the one split across lines 151–152 of the source; it matches
exactly once whitespace is normalised, which is the right standard for a PDF transcript.

`citations[1]` is rewritten and now **agrees with the body**:

> „Odůvodnění důvodové zprávy popisuje úlevu na více místech jako snížení cíle
> „o 10procentních bodů", na jiném místě však samo užívá i formulaci „o 10 %" — zatímco
> zákonný text novely na obou operativních místech stanoví „o 10 %"."

That is the true three-way distribution, and the „nikoli „o 10 %"" assertion that
contradicted the prose is gone. The finding is now both accurate and sharper than the one
this audit first challenged.

### N10 — spliced sentence in `verdict-161` · **CLOSED**

`researchedContext`: parentheses **3 open / 3 close**, guillemets **7 / 7**, and **zero**
occurrences of a full stop followed by a lowercase continuation.

### N11 — stranded fragment in `gA[2]` · **CLOSED**

`65-103-300-2008` no longer contains `3, 103 = odst. 1);`. Parentheses **3 / 3**, no
mid-sentence stop, and the closing sentence now opens correctly on „Jde tedy o koordinační
riziko…". The M19 correction it carries remains accurate.

### B8 — „Dávkový prověření" · **CLOSED**

`Dávkový prověření` → **0 occurrences**; `Hromadné prověření` → **1**. Rewriting the
adjective and noun together, ahead of the bare-noun rule, removes the masculine/neuter clash
at its source rather than patching the output.

### B9 — batch-sense residue · **CLOSED**

**Zero batch-sense survivors.** Six `dávk`-forms remain in the payload and **all six are the
social-benefit sense**, correctly untouched: „rodinnými **dávkami**", „peněžité **dávky**
vyplácené pojištěným osobám", „**dávkové** agendy", „paušální **dávky** před porodem",
„žadatelů o **dávky**", „**dávky** státní sociální podpory". The two „v této i předchozí
dávce" occurrences are gone. `scan` and `json` are both at **0 rows**.

### N3 — „dozorčí seat" · **CLOSED**

No `seat` anywhere in `verdict-74.json`. The prose reads „…na jejíž dozorčí radě Niemiec
zasedá…" and the web citation „…je od 10. října 2019 členem její dozorčí rady, bez
evidovaného vlastnického podílu…".

---

## The syntax invariant — adopted, and correctly *relative*

`sweep-old27-015.ts:114-120`:

```ts
const parenSkew = (s: string) => Math.abs((s.match(/\(/g) ?? []).length - (s.match(/\)/g) ?? []).length);
if (parenSkew(t) > parenSkew(r.text)) throw new Error(`… SYNTAX INVARIANT — parenthesis balance worsened`);
if (midStops(t) > midStops(r.text)) throw new Error(`… SYNTAX INVARIANT — introduced a full stop before a lowercase continuation`);
```

**Both checks are relative, and that is the right call** — a point worth recording, because
the obvious absolute version would be wrong here. Czech legal prose is full of enumeration
markers that are unmatched closers by construction: `písm. m)`, `písmeno n)`, ` b)`, `c)`,
`d)`, `g)`, `i)`. Measured on the collision waves, two `reasoning` fields are "unbalanced"
purely from this: `gA 189-248` (3 open / 7 close, 5 enumeration markers) and `gB 13-16`
(7 / 22, 16 markers). **Neither is a defect.** An absolute balance assertion would have
failed on legitimate legal citation and taught the loop to distrust the check. Comparing
against the input tolerates the corpus's own style while still catching exactly the N10/N11
damage class.

### Three sweep rows re-checked under both invariants

Chosen as the former N5, N6 and B8 rows:

| row | field | digits removed / added | parenSkew | midStops |
|---|---|---|---|---|
| 11 · tisk 124 | `forensic_researched_context` | `["001"]` / `[]` | 0 → 0 | 1 → 1 |
| 22 · tisk 216 | `forensic_researched_context` | `["001","001"]` / `[]` | 0 → 0 | 0 → 0 |
| 27 · tisk 248 | `forensic_citations[8].claim` | `["001"]` / `[]` | 0 → 0 | 0 → 0 |

All three pass both invariants: the only digits lost are allowlisted batch ids, and neither
syntax measure worsens.

---

## Gate

`validateLawVerdict()` + `lawJargonIssues()` re-run over all ten verdicts with the targets
payload's `knownLawRefs`/`knownIds`: **10/10 clean**, zero schema errors, zero jargon hits.

---

## Residual MINORs — recorded, not blocking

1. **The out-of-corpus *subject* still asserts a chamber.** The companion label was fixed —
   `DependencyRadar.tsx:194` now renders „tisk {rawTisk} (mimo korpus — bez odkazu)" with no
   `sn.` prefix, which is the case that mattered (tisk 777 is a Senate print per
   `graph-log.md:1161`). But `:114` still renders „**sn.** tisk {bill.cislo} (mimo korpus)"
   for an out-of-corpus subject — the same logic gap, one branch over. The in-corpus labels
   at `:109` and `:187` are correct as written, since membership in the sněmovní corpus is
   what `billTitleByCislo.has()` establishes.
2. **Internal vocabulary still ships in the sweep output**, unchanged and never claimed
   fixed: „v grafu **případu law**" ×2, „**churn** 6" ×3, „**gatovanému** tisku" ×1,
   „**uzel**" ×1. These are outside the sweep's rule set; they belong to the next pass's
   jargon scope. M18's duplicate rows (tisk 153 rendering six rows for one dependency) also
   remain, as does the absence of a colocated test for `centeredExcerpt` and the hedge rule.

---

## Closing assessment

Batch-015 took four rounds. What the record shows is that **every gate in the loop was green
at every round**, including the rounds that carried a false ownership claim, two arithmetic
errors, a refuted non-disclosure accusation, a falsified CZK figure and two fabricated
quotations. Nothing in the suite could see any of them — the same lesson `CLAUDE.md` already
records for pass 42, encountered again at a different layer.

What closed the gap was not more review but **invariants over whole artefacts**: the digit
invariant (no rewrite may alter a digit sequence), the syntax invariant (no rewrite may
worsen parenthesis balance or introduce a mid-sentence stop), sponsor arithmetic that must
close against the payload, and quotation existence checked against the cached text. Each is
cheap, mechanical, and would have caught its defect on the first round. The five gate
additions proposed across this audit are now the durable output of the batch — more valuable
than any single verdict it produced.
