# Batch-017 audit — adversarial, independent

**Auditor:** fresh session, no prior involvement in batches 001–016.
**Date:** 2026-08-05. **Gate:** the pass-51 write.
**Scope:** the 10 verdicts in `docs/data-analysis/case-law/payloads/verdicts-017/`, the
structural jargon rule + sweep, the §-level sector attribution + regenerated census.
**Method:** every factual claim below was re-derived from the cached prints in
`.data/law-collision-cache/` (NFC-normalized), from `batch-017-targets.json`, from
`docs/data-analysis/case-money/ledger.json`, or from a machine comparison run for this
audit. No payload or source file was edited. No git. No PGlite.

---

## VERDICT

# ⛔ BLOCK — do not write pass-51.

**5 BLOCKING, 12 MAJOR, 14 MINOR.** Two of the blocking findings are recurrences of
named historical defect classes (ownership misclassification; §/count precision), one is
a new systematic class (DZ source-location misattribution), and one is the first
*cross-verdict contradiction* the loop has produced — batch-017 states a gap that
batch-014 already published the filling of.

The batch is not weak work. The 12↔131 subset claim — the batch's headline — **holds
under byte-level machine comparison**, the collision arithmetic in 260 closes, and the
whole-artifact hygiene sweep is clean (0 homoglyphs, 0 transcript line refs, 0 unsigned
`whoBenefits`, 0 camelCase/snake_case leaks, 0 English leakage, NFC-stable). The blockers
are concentrated and fixable. But every one of them is reader-facing.

---

## BLOCKING

### B1 — Steward-class money attributed to named MPs. ~119,7 mld Kč across 5 citations.
**Files:** `verdicts-017/verdict-85.json` (`conflictAssessment`, `citations[6]`, `[7]`),
`verdict-72.json` (`citations[6]`), `verdict-50.json` (`citations[7]`, `[8]`).

The repo's attribution rule (CLAUDE.md → `/penize`, `features/money/reachableMoney.ts`)
is unambiguous: *steward money is the institution's, never the MP's* — a steward seat's
institutional contracts are "never fetched, never summed and the row says why." These
five citations sum them and name the MP.

Verified against `docs/data-analysis/case-money/ledger.json`:

| verdict | MP | company | tieClass | role | sum published |
|---|---|---|---|---|---|
| 85 | Aleš Juchelka | ČESKÁ TELEVIZE (00027383) | **steward** | zaměstnanec | 19 557 459 056 Kč |
| 85 | Aleš Juchelka | ČESKÝ ROZHLAS (45245053) | **steward** | moderátor | 3 995 330 864 Kč |
| 72 | Boris Šťastný | VZP ČR (41197518) | **steward** | člen správní rady | 1 981 275 103 Kč |
| 50 | Petr Hladík | Dopravní podnik města Brna (25508881) | **steward** | místopředseda dozorčí rady | 88 987 670 810 Kč |
| 50 | Róbert Teleky | Uherskohradišťská nemocnice (27660915) | **steward** | člen dozorčí rady | 5 207 847 529 Kč |

Sum: **119 729 583 362 Kč**. Not one citation states the tie class, the role, or that the
money is the institution's.

The contrast inside the same batch proves the loop *can* do this: Juchelka's other two
ties are `owner-operator` (`jednatel a společník` — YOU STORY UP!, OCCAM PR) and total
**4 819 108 Kč**. That is his attributable figure. Verdict-85 prints all four in one
undifferentiated list with the two steward giants first and largest — a 4 800× overstatement
of the attributable amount. Babiš × AGROFERT (`manager`) and Hladík × Teplárny Brno
(`manager`, verdict-110) are class-correct and show the rule is reachable.

Two mitigations, stated for fairness: every row says `čeká na lidskou kontrolu` (true —
all are `pending_review`), and every `conflictAssessment` concludes *no* conflict. The
framing is exculpatory. The **figure** is still attributed, and that is what the rule forbids.

Additionally undisclosed: ČT and ČRo are `corroboration: "registry-unconfirmed"` and the
ČRo tie carries `no-period-in-source`. Neither verdict says so.

**Fix:** either drop the steward sums entirely, or render them as the institution's with
the class, the role and the reason named, and state the MP's attributable total separately.

---

### B2 — verdict-12 / verdict-131: the subset arithmetic does not close, and one omitted provision is the substantive one.
**Files:** `verdict-12.json:researchedContext`; `verdict-131.json:researchedContext`.

Machine comparison run for this audit (whitespace-collapsed, NFC, page numbers stripped)
over `tisk-12/265094.txt` and `tisk-131/268460.txt`:

```
12#1  vs 131#1: identical=True  len=77/77
12#8  vs 131#2: identical=True  len=72/72
12#9  vs 131#3: identical=True  len=372/372
12#10 vs 131#4: identical=True  len=127/127
12#11 vs 131#5: identical=True  len=255/255
12#12 vs 131#6: identical=True  len=1656/1656
12#13 vs 131#7: identical=True  len=4722/4722
12#14 vs 131#8: identical=True  len=60/60
```

Tisk 12 carries **15** points; tisk 131 carries **8**. 15 − 8 = **7**.

- `verdict-12` says: *"tisk 131 má o **šest** bodů méně, protože vůbec neobsahuje body
  odpovídající bodům **2, 3, 4, 6, 7 a 15** tisku 12"*. Six named, six claimed, and
  **bod 5 is missing from the list**. Bod 5 is `V § 45 odst. 4 se číslo „10" nahrazuje
  číslem „5"` — the preferential-vote threshold, which the *same verdict* elevates to its
  own `unstatedEffects[1]` and to one of the DZ's "three attributes". The count is wrong
  and the enumeration is incomplete on the one point that matters substantively.
- `verdict-131` says: *"zcela vynechává těch **šest** bodů"* and then correctly enumerates
  **seven** provisions (§ 22/2, § 25/1, § 27, § 45/6, § 46/2/b, příloha, **§ 45 odst. 4**).
  Enumeration complete; the count word is wrong.

This is the §/count-precision class that blocked prior batches, in both directions.

---

### B3 — verdict-193: three DZ source locations misattributed, two of them exactly swapped. 9 reader-facing statements, 3 of them citations.
**File:** `verdict-193.json`. **Evidence:** offsets in `tisk-193/270285.txt` (NFC), section
starts measured: `Důvodová zpráva` @14718, `Obecná část` @14735 (sub-headings
`A. Reformulace role AOS` @14859, `B. Střet zájmů` @20765), `Zvláštní část` @**28335**.

| claim location in verdict | actual offset | actual section |
|---|---|---|
| „pouze jediná autorizovaná obalová společnost" → claimed *Obecná část, bod B* (×4: `researchedContext`, `unstatedEffects[0]`, `unstatedEffects[2]`, `citations[3]`) | **29935** | **Zvláštní část** |
| „Příkladem může být hypotetická situace, kdy…" → claimed *Zvláštní část k § 18 odst. 6* (×3: `researchedContext`, `unstatedEffects[2]`, `citations[4]`) | **25391** | **Obecná část, B. Střet zájmů** |
| „za poskytování SOHZ nenáleží AOS vyrovnávací platba" → claimed *Obecná část, bod A* (×2: `statedReasoning`, `citations[5]`) | **3586** (operative § 17 odst. 2 of the bill) and **38626** (Zvláštní část) | **not in Obecná A at all** |

The quotations themselves are **verbatim-exact** — that is not the defect. The defect is
that a reader (or a reviewer) following the stated pointer will not find them, and the
two headline facts of the verdict are attributed to each other's section. `researchedContext`
also sources „nesmí rozdělovat zisk ani jiné vlastní zdroje" to *bod A obecné části*; it is
operative § 20 odst. 5 (bod 12 of the bill).

Quotation locatability is a whole-artifact invariant. This fails it nine times in one verdict.

---

### B4 — verdict-47 asserts a gap that batch-014 already published the filling of. Cross-verdict contradiction.
**Files:** `verdict-47.json:unstatedEffects[0]` vs `verdicts-014/verdict-217.json`.

`verdict-47` states: *"Tato navazující novela není součástí archivovaného textu tisku 47
**ani s ním není podle textu předkládána souběžně**. Pokud by nabyla účinnosti později
než navrhovaná ústavní změna (1. července 2026), vznikl by ústavní mandát NKÚ bez
odpovídajícího prováděcího nástroje."*

`tisk-217/271419.txt`, verbatim, twice:

> „Návrh zákona navazuje na souběžně projednávaný návrh ústavního zákona, kterým se mění
> ústavní zákon č. 1/1993 Sb., Ústava České republiky … (**senátní tisk č. 47**, 10.
> volební období), a fakticky jej provádí."

> „Návrh zákona navazuje na návrh novely ústavy projednávaný Poslaneckou sněmovnou jako
> **sněmovní tisk č. 47**, ve kterém je navrženo nabytí účinnosti **rovněž dnem 1.
> července 2026**, a je obecně žádoucí, aby jak novela Ústavy, tak i tento zákon nabyly
> účinnosti ke stejnému datu."

Tisk 217 (`Čl. I` — nový § 3 odst. 4 zákona č. 166/1993 Sb.; `Čl. III` — účinnost
1. 7. 2026; filed 3. 6. 2026) **is** the companion. It was verdicted by this loop in
batch-014, at `medium`, on precisely that pairing. Batch-017 then publishes, at `low`, a
finding that the companion is not being filed in parallel and that a sequencing gap would
arise — when the companion exists, is pending, and proposes the *identical* effective date
expressly so that no gap arises.

The hedge *"podle textu"* does not save it: the effect's conclusion is stated as a live
risk, and the corpus the verdict was written against contains the answer. This is the
accusation-by-omission class, produced against the loop's own published record.

---

### B5 — verdict-260 misreads bod 30: it says a safeguard was replaced; the bill keeps it and the DZ says so.
**File:** `verdict-260.json:statedReasoning`, `unstatedEffects[1]`.

Verdict: *"Čl. I bod 30 mění § 53 odst. 1 tak, že podmínku … vymezuje nově prahem podílu
nižšího než 5 % v obchodní korporaci **namísto** dosavadního vymezení postavením osoby ve
vrcholném vedení."*

`tisk-260/278413.txt`, bod 30, verbatim replacement text:

> „…, pokud takový skutečný majitel, právnická osoba nebo právní uspořádání, jejichž je
> rovněž skutečným majitelem, drží jednotlivě v předmětné obchodní korporaci podíl nižší
> než 5 %. **Na skutečného majitele, který je skutečným majitelem podle § 5 odst. 1 a 3 na
> základě svého postavení osoby ve vrcholném vedení, se věta první nepoužije**"

And the DZ, to bodům 30 až 34: *"Z důvodu přehlednosti se stávající pravidlo § 53 odst. 1
věty za středníkem zákona o ESM přesunuje jako samostatná věta na konec odstavce. …
**Věcně se však úprava v tomto směru nemění.**"*

The vrcholné-vedení carve-out is **preserved and relocated**, not replaced. "Namísto" makes
the bill look as if it removed a safeguard it kept.

Compounding it, `§ 53` is misdescribed twice as governing *"odklad zveřejnění výplaty
podílu na zisku"*. § 53 of 37/2021 Sb. governs the **private-law prohibition on paying out
a profit share** where the beneficial-owner duty is unmet — the DZ calls it *"soukromoprávní
následky porušení evidenční povinnosti … soukromoprávní sankce"*, and the bill's own new
odst. 4 speaks of *"podmínky **výplaty** podle odstavce 1"*. Nothing about *zveřejnění*, and
nothing about *odklad*.

---

## MAJOR

### M1 — verdict-85: the collision inventory is materially incomplete. "Dvě kolize" understates by at least three, and the omitted ones carry divergent dates.
`verdict-85:researchedContext` asserts *"potvrzuje **dvě** kolize"*. Re-derived from both
cached prints, tisk 85 čl. III and tisk 88 čl. V **both rewrite Čl. LXIII of 152/2025 Sb.**,
in three further mutually-destructive ways:

| Čl. LXIII | tisk 85 (čl. III) | tisk 88 (čl. V) | consequence |
|---|---|---|---|
| písm. d) | „čl. XLVIII a" se zrušují | „čl. XLVIII a" se zrušují **a slovo „května" se nahrazuje slovem „srpna"** | identical partial deletion, non-repeatable; and **1. května vs 1. srpna 2026** for the hmotná-nouze novela |
| písm. e) | nahrazuje „113 a 116, čl. XLVI bodů 3 až 6 a čl. LIV" → „113, 116 a čl. XLVIII bodů 1 až 3" | **zrušuje** „, čl. XLVI bodů 3 až 6 a čl. LIV" | mutually destructive rewrites of one string |
| nová písmena | doplňuje **h)** only (→ 1. 6. 2028) | doplňuje **h) a i)** (h → 1. 10. 2026; i → 1. 6. 2028) | both run the same non-repeatable „na konci písmene f) … na konci písmene g)" preamble |

Five incompatible instruction pairs, not two — and the two the verdict *did* find are the
weaker ones. The severity (`medium`) is not inflated by this; if anything it is under-earned.
But an asserted count must be the count.

### M2 — verdict-12 / verdict-131: "neproveditelná" is over-general and false for two of the eight points.
Both verdicts state the collision as *"instrukce by byla při nabytí účinnosti
neproveditelná"* for the whole overlapping set. Re-derived: for 12#12 / 131#6 (`§ 58 zní:`)
and 12#9 / 131#3 (`V § 56 odstavec 1 zní:`) the instruction is a **full replacement** — it
executes fine the second time and simply re-enacts identical text. The claim holds for
12#1/131#1 (word-substitution whose target is gone), 12#11/131#5 (re-lettering
`b) až d) → c) až e)` that no longer matches), and 12#13/131#7 (duplicate insertion of
§§ 58a, 58b); it produces corrupted-but-executable text for 12#8, 12#10, 12#14. The 85↔88
version of the same sentence *is* correct (a `zrušuje` instruction genuinely cannot run
twice) — which is why the borrowed phrasing reads as verified when it is not.

### M3 — verdict-72: "z jakéhokoli omezení" is contradicted by the same bill, two points earlier.
`verdict-72:researchedContext` — *"poslední věta téhož odstavce vystoupení prezidenta
republiky, předsedy Sněmovny a členů vlády **z jakéhokoli omezení** výslovně vyjímá"*, and
`unstatedEffects[0]` builds the whole asymmetry on it. But `tisk-72/266355.txt` bod 5 and
bod 6 cap **§ 67 odst. 1 písm. c), d) a e)** — and písm. c) is *„předsedovi a
místopředsedům Sněmovny"*:

> bod 5: „Přednesení návrhu nebo návrhů nesmí překročit pět minut, **u poslanců uvedených
> v § 67 odst. 1 písm. c), d) a e) třicet minut**; každý poslanec může vystoupit pouze jednou."
> bod 6: „… **a u poslanců uvedených v § 67 odst. 1 písm. c), d) a e) nesmí překročit deset
> minut**…"

The Speaker is capped by the same bill. There is a genuine internal tension in the bill
between § 67(2)'s blanket last sentence and §§ 54(5)/(6) — that tension is the finding, and
the verdict does not have it. Not disclosed either: the constitutional basis (čl. 38 odst. 2
Ústavy) that is the standard reason a cabinet carve-out exists, without which the carve-out
reads as unexplained favouritism.

### M4 — verdict-72: entity count wrong, and the self-affecting claim is overtaken by fact.
`conflictAssessment` — *"Andrej Babiš (**třináct** subjektů koncernu kolem AGROFERT, a.s. a
Nadace AGROFERT)"*. `batch-017-targets.json` and the money ledger both carry **14**
(CS CABOT, AGROPROFIT, IMOBA, AGROFERT, Nadace AGROFERT, PROFROST, Synthesia, PRECHEZA,
Kostelecké uzeniny, Fatra, Lovochemie, Hartenberg Holding, AGRONOVA CS, SynBiol).
The sponsor-level counts do close (13 with ties + 17 without = 30 ✓).

Separately: `unstatedEffects[0]` says the new § 67 odst. 2 *"by … sám dopadal"* on Babiš as
předseda ANO. The batch's own cache shows him signing tisk 260 (22. 6. 2026) as
**„Předseda vlády: Ing. Andrej Babiš"** — a *člen vlády*, the category the last sentence of
the very paragraph the verdict quotes expressly exempts. The verdict is scoped *"k datu
podání"* (17. 12. 2025), which is defensible; publishing it in August 2026 without saying
that the position has changed is not.

### M5 — verdict-260: an obecná-část passage attributed to the zvláštní část.
*"**Zvláštní část** zprávy (bod 7) uvádí, že s návrhem jsou spojeny „spíše negativní"
hospodářské dopady"*. In `tisk-260/278413.txt` the quoted phrase sits under
`I. OBECNÁ ČÁST` → `7. Předpokládaný hospodářský a finanční dopad…`. The quote is verbatim;
the section is wrong.

### M6 — verdict-260: the "deliberate refusal" is inaccurate as stated, and the refused fact is in the batch's own cache.
*"V dostupném textu tisku 260 není k dispozici platné (konsolidované) znění § 16 odst. 2 …
takže věcný obsah písmene, které tisk 7 upravuje, **nelze z dostupných podkladů ověřit**."*

The first half is true and well-scoped (`Platné znění` occurs 0× in tisk 260's single cached
document). The generalisation to *"z dostupných podkladů"* is **false**:
`.data/law-collision-cache/tisk-7/265064.txt` states the old content verbatim —

> „Čl. XIX  V § 16 odst. 2 **písm. n)** zákona č. 37/2021 Sb., … se slova
> **„dohled nad hospodařením politických stran a politických hnutí"** nahrazují slovy
> „prevenci korupce a střetu zájmů"."
> DZ: *„Terminologická změna v § 16 odst. 2 písm. n), která promítá transformaci ÚDHPSH na
> Úřad pro prevenci korupce a střetu zájmů."*

A refusal that is stated more broadly than its ground is worse than no refusal — it
suppresses a fact the corpus holds and it lends the suppression the authority of restraint.
(The refusal instinct was right; the scope sentence must be narrowed to tisk 260's own text.)

**Positive, for the record:** the re-lettering arithmetic is correct. `h)…u)` = 14 letters,
`m)…z)` = 14 letters, shift +5; old `n)` is the 7th of `h…u`, and the 7th of `m…z` is `s)`.
Verdict's "posun o pět míst" and "nová písm. s)" both check out, as does the verbatim
citation *„Dosavadní písmena h) až u) se označují jako písmena m) až z)."*

### M7 — verdict-50: a derived money statement the DZ does not support, plus an omission that darkens it.
`researchedContext` — *"v patnáctém roce … může kombinovaný dodatečný náklad … **přesáhnout
součet** obou samostatně uváděných řádů (cca 2 mld. a 2,3 mld. Kč ročně)"*.

`tisk-50` DZ, část F, verbatim: the shortened qualifying period reaches *"až na 2 mld. Kč
… **dlouhodobě**"* (not "at year 15"); the výchovné valorisation peaks *"na úroveň 2,3 mld.
Kč po 15 letech"* and then **"by dodatečné výdaje postupně klesaly až na cílových,
stabilních 1,3 mld. Kč po 25 letech od zavedení."**

Nothing in the DZ supports a combined figure *exceeding* 4,3 mld, and the verdict drops the
decline path entirely. The first-year arithmetic (200 + 300 = 500 mil.) closes ✓, the
"zpráva je nikde nesčítá" claim is backed (the word `součet` occurs 0× in the DZ) ✓, and all
three quotations are verbatim ✓ — the defect is the one extrapolated sentence.

### M8 — the structural jargon rule has a live bypass, two dead allowlist entries, and ships five wrong-direction cross-references.
Executed against the real `lawJargonIssues` (`lib/analysis/law-verdict.ts`), 114 probes:

1. **Allowlist hit on the first match abandons the whole camelCase rule** (`:151–156`,
   `re.exec` + `continue`). Measured:
   `"Systém eGovernment eviduje hodnotu sponsorContractCzk pro tento tisk."` → **0 issues**;
   reverse the word order → flagged. `sponsorContractCzk` is one of the two historical leaks
   this rule exists to stop, and `:138` is its *only* gate. Verdict decided by word order.
2. **`eSbírka` and `eObčanka` are dead allowlist entries.** `\w*` stops at the first
   non-ASCII letter, so the match is `eSb` / `eOb` against an `^…$`-anchored list. The gate
   therefore **rejects any verdict naming the Czech electronic collection of laws**. The
   colocated test covers only the five all-ASCII names, which is why this survived.
3. **Five sweep rows ship `výše` ("above") pointing at sections rendered *below*, inside a
   `useState(false)` disclosure.** `features/lawwatch/components/BillDetail.tsx` order is
   `statedReasoning` → `conflictAssessment` → `researchedContext` → `unstatedEffects`; the
   rewrites `(viz nezávislý kontext výše)` / `(viz … nedeklarovaný dopad výše)` sit in
   `conflictAssessment` (tisky 67, 77, 189, 201). The nominal halves *do* match
   `messages/cs.json`; the positional halves are false, and the repo labels no section with
   an ordinal a reader can see.
4. **One ungrammatical rewrite ships**: tisk 67 —
   *„mechanismu popsaného v **druhý nedeklarovaný dopad výše**"* (`v` + nominative).
5. False positives on legal/administrative Czech: **`kW`, `kWh`, `mSv`, `pH`, `mmHg`, `eV`**
   all fire; so do `Scania` / `Scanmed` (as "internal batch/pass reference"), `steward` /
   `stewardka`, `case law`, and `dávka 12 mSv`. Energy, environmental and health bills
   cannot be described without the units.

**Verified clean:** allowlist is principled — all 11 entries are substantiable real-world
names, none is a code identifier smuggled in. Counts close: scan 18 = sweep 18, key sets
exactly equal, 0 duplicates, and all 18 `after` strings re-verify at 0 residual issues.
Digits: identical across all five spot-checked rewrites once `unstatedEffects[N]` subscripts
are excluded; the one genuine digit change is the literal `0` of `sponsorContractCzk: 0`,
paraphrased away in three rows — acceptable (a prop value, not a reader quantity) but it
must be recorded as a digit that moved.

**Still escaping:** humpless lowercase jargon is entirely ungated — `amends` is **live in
the shipped after-text** (`„Regenerovaná topologie hran amends v grafu"`, rows 4 and 15);
`tisk`, `ico`, `urn`, `slug`, `node`, `edge`, `props`, `kind`, `weight`, `severity`,
`confidence`, `flags` all pass; `pending_review` is caught but bare `pending` is not; the
snake rule is ASCII-only so `úřad_id`, `dávka_001`, `režim_ok` pass; the prop-shape rule
misses `flagged: 0`, `severity: high`, `flagged:false`.

### M9 — the sector-attribution payload overclaims, and 9 of its 29 rows are contradicted by published verdicts.
`batch-017-sector-attribution-para.json:method` calls each row's statute the
*"sector-carrying statute"* and (for tisk 154) says *"statute-level attribution stands"*.
`verdicts-011/verdict-154.json` says of the same flags: *„Sektorová atribuce „economy" tedy
podle obsahu novely neodpovídá žádnému věrohodnému ekonomickému kanálu … topologická blízkost
… nezakládá věcný střet zájmů."* `verdicts-011/verdict-67.json` closes the 139/2002 group
(*„uzavíráme jako nevěrohodný konflikt"*) and the IF Holding + IF FACILITY pair on 235/2004
(*„nebyl nalezen žádný věrohodný ekonomický kanál"*). All 9 rows are republished under a
neutral note with no field carrying the adjudication.

Two further overclaims: the payload **drops the census's own trust precondition** (*"per-§
rows are trustworthy exactly where a bill's diagnostics are clean"*) — it carries no
`extractorMissedRefs` at all, and **20 of 29 rows rest on bills whose diagnostics are not
clean** (67, 77, 154, 221) — and **nothing anywhere marks the attribution as derived or
un-gated**: `pending_review`, `derived`, `gate`, `human` occur 0×, in a payload that names
29 real companies and 6 named MPs against statute §§.

Also: for tisk 67 × 100/2001, five rows publish `citedOnlyParagraphs ["12","27","4","94d",
"94f","94t","94v"]` — §§ 94d/94f/94t/94v are **not §§ of 100/2001**; they are quoted
footnote text about zákon č. 183/2006. The partitioner harvests every `§ N` token in the
block regardless of statute, so `citedOnlyParagraphs` is mislabeled by construction.

### M10 — the tisk 154 × 634/2004 extractor-limit note states the wrong reason, in the reader's disfavour.
Note verbatim: *"the census partitioner did not isolate this statute in the bill's text
(extractor limit) — statute-level attribution stands, §-level unavailable."*

`tisk-154/268961.txt` has a clean `ČÁST TŘETÍ / Změna zákona o správních poplatcích / Čl. V`
block; `partitionFallback` is correctly `false`. The block contains **zero `§` characters**
because the amendment is **annex-only**:

> „1. V položce 22 písm. h) se částka „Kč 25 000" nahrazuje částkou „Kč 50 000"."
> „2. V položce 22 se doplňuje písmeno zb), které zní: …"

The extractor did not fail; there is nothing to extract. The correct note is
*"§-level inapplicable — annex-only amendment"*. The census's own method note names this
failure mode correctly; the 017 script collapses "no bucket" and "empty bucket" into one branch.

### M11 — tisk 221: an insertion *anchor* is published as an amended §, while the § the verdict is actually about is demoted.
Census and payload both carry `218/2000 → operative ["14","14q","44a"]`, `citedOnly
["12","14r","2"]`. But `tisk-221/271529.txt` čl. VII bod 2 reads
*„Za § 14q se vkládá nový § 14r, který včetně nadpisu zní: § 14r / Střet zájmů …"*.
**§ 14q is untouched** — it is the insertion point. **§ 14r is the provision the bill
creates**, and it is the provision `verdict-221` reasons about
(*„oba se skutečně týkají novelizovaných ustanovení o střetu zájmů při poskytování dotací"*).
The join is faithful to the census; the inversion is upstream, at `collision-core.ts:125`,
which deliberately treats `Za § N se vkládá` as amending § N. The same shape recurs on the
sibling 252/1997 row. §§ 14, 44a and the `citedOnly` §12 are otherwise correct.

### M12 — the batch's own artifact inventory does not match what shipped.
- The sector payload carries **29 flags, 27 with §§** — not the 18/16 the batch narrative
  states. Its internal arithmetic closes exactly (`rows.length` 29; 27 non-null
  `operativeParagraphs`; 2 null, both tisk 154; `cislo|company|viaLawRef` unique).
- **There is no batch-017 census file.** The regenerated census ships as
  `batch-016-amended-paragraph-census.json`, `generatedAt` two seconds before the 017
  payload. Nothing in it discloses that it is a regeneration, and its `method` note never
  mentions `partitionFallback` — a field new in this regeneration whose only definition is
  a source comment.
- **`partitionFallback` is true on 7 census rows (bills 10, 54, 69, 113, 189, 228, 250) and
  on 0 rows of the sector payload.** The fallback is severe where it fires: tisk 250 is a
  new act with 0 standalone `Čl.` headers and 13 `ČÁST` blocks, so all 69 §§ collected are
  filed under `330/2025` — a law ref harvested from a **footnote** (`277952.txt:156`) —
  while the real 330/2025 amendment (`ČÁST JEDENÁCTÁ`) touches no § at all. `extractorExtraRefs`
  is empty for that row, so only `partitionFallback` catches it.
- The census method note **inverts its own largest-cause sentence**: it says *"an
  article-structured bill without statute headers collapses into a single partition bucket"*;
  the collapse actually fires when `arts.length === 0`, i.e. when the bill has **no** article
  headers. All 7 collapsed bills have 0 `Čl.` headers; tisk 67 (63 `Čl.` headers) produced 43
  buckets. `batch-016.md:57` states it correctly.
- Latent hazard: `sector-attribution-para-017.ts:51` tests `c.partitionFallback` *before*
  `!st`, so a collapsed bill whose single mislabeled bucket happened to equal the sector law
  ref would publish the whole bill's §§ as that statute's. It does not fire today only
  because none of the 7 collapsed bills carries a sector flag.

---

## MINOR

1. **85** — `citations[4]`: *"Čl. IV tisku 88 **vkládá** … instrukci „se část věty za
   středníkem … zrušuje""*. It is a deletion instruction; "vkládá" is the wrong verb.
2. **85** — *"Pole předkladatelů u tisku 85 je v této datové sadě prázdné"*: `sponsors` is
   `[]`, but `submitter` is `"Juchelka A."` and populated. The sentence reads as broader
   than the field it describes. Same wording in 12 and 131.
3. **85** — the DZ **does** reference another parallel poslanecký návrh, in the very article
   the collision touches: *„V návaznosti na navrhovaný časový posun převodu kompetencí
   v oblasti administrace dávek pro osoby se zdravotním postižením **v dalším poslaneckém
   návrhu**…"* (K čl. III bodu 3). That is tisk 125 — Juchelka's own other bill, verdicted
   in batch-016 — not tisk 88, so *"nezmiňuje se o tisku 88"* is literally true. But the
   "isolated, uncoordinated" framing is weakened by a coordination sentence the verdict
   does not quote.
4. **85** — cross-row money disclosure is otherwise **verified**: all four ICOs and all four
   sums match `batch-016-targets.json` tisk 125 exactly, and the tisk-125 attribution is
   stated. Only the class (B1) and the `registry-unconfirmed` corroboration are missing.
5. **12** — *"zvýší „prostupnost" kandidátních listin **zejména ve velkých obcích**"*. The
   DZ's prostupnost passage says *"ve velkých **městech** na velkých listinách"*; the phrase
   *"zejména ve velkých obcích"* appears in the DZ, but in the *volební obvody* passage.
   Two passages conflated.
6. **12** — *"z 10 % na 5 % **průměrného počtu hlasů**"* reads as a percentage *of* the
   average. § 45 odst. 4 sets a threshold *above* it (*„alespoň o 10 % více hlasů, než je
   průměrný počet"*).
7. **131** — `statedReasoning` says *"Body **3 až 7** zavádějí nový § 58 a nové §§ 58a a
   58b, body 4 a 5 upravují nástupnictví"* — overlapping and inconsistent with its own
   `researchedContext` map (bod 6 = § 58, bod 7 = §§ 58a/58b). The per-bod map is correct;
   the summary is not.
8. **12 / 131** — *"podán 11. 3. 2026"* / *"podán 7. listopadu 2025"*. The cached psp.cz
   pages support only *„Rozesláno poslancům"* on those dates. The "o čtyři měsíce později"
   interval is right either way.
9. **193** — *"Novela (čl. I **bod 5**, nový § 18 odst. 3 a 4)"*. Bod **4** rewrites
   § 18 odst. 3; bod 5 adds odst. 4. `researchedContext`'s list (body 1, 4 až 9, 11, 12) is
   correct.
10. **193** — *"§ 20 odst. 5 omezuje převod akcií na částku **odpovídající** jejich
    jmenovité hodnotě"*; the operative text says *„pouze za cenu **nepřevyšující** její
    jmenovitou hodnotu"*. The verdict follows the DZ's looser paraphrase while citing the
    operative provision. Same for *"maximální základní kapitál"* vs operative
    *„Základní kapitál … **činí** 2 000 000 Kč"*.
11. **260** — the bill and its footnote 11 name the AMLA **„Orgán pro boj proti praní peněz
    a financování terorismu"**; the verdict writes **„Úřad"** three times (statedReasoning,
    citations[1], and in describing nařízení 2024/1620).
12. **260** — *"3 až 5 **systemizovanými** místy"*. The DZ says only *„Tato agenda bude
    zabezpečena 3 až 5 místy"*; "systemizované místo" is a term of art the source does not use.
13. **47** — *"**Tentýž** bod 5 obecné části ale zároveň přiznává…"*. The preceding quote
    (*„nemají dostatečné možnosti ke kontrole hospodaření, ani dostatečné odborné zázemí"*)
    is from bod **1**. The bod-5 fiscal claim itself is correctly located ✓.
14. **72** — *"Jan Richter (tři **komunální podniky** Chomutovska)"* includes `Sportovní klub
    policie Kadaň, z.s.`; *"Robert Stržínek (tři subjekty **zdravotnictví a vodárenství**)"*
    includes `Tenisový klub DEZA Valašské Meziříčí, z.s.`

---

## What is verified and correct — stated so the fixes do not overshoot

**Re-derived and confirmed:**

- **12 ↔ 131 subset**: all 8 mapped point-pairs byte-identical (lengths equal, no diff
  opcodes). Tisk 131 contains **no** provision tisk 12 lacks.
- **Neither DZ references the other**: `tisk`, `sněmovní`, `souběž`, `131` all occur **0×**
  in both cached prints. The "DZ nezmiňuje" claim in both verdicts **is** backed by the grep
  — this is the one place the batch got the historical class right.
- **85 ↔ 88 § 21 odst. 2 písm. e)**: the instruction, including the identical amending-law
  enumeration (366/2011, 331/2012, 313/2013, 200/2017, 47/2019), is character-identical
  between tisk 85 čl. II and tisk 88 čl. IV ✓. The bod-12 divergence
  („příjmu plynoucího z dávky státní sociální pomoci," vs „dávky státní sociální pomoci,")
  is exact ✓.
- **Committee routing** (`batch-017-targets.json`): 12 → ÚPV garanční + VSR další, both
  2025-12-17; 131 → ÚPV garanční only, 2026-04-02; both `navrzeno` ✓. 85 → VSP, 2026-02-05.
- **260 § 53 × tisk 64 disjointness**: tisk 64 čl. CXLVII bod 1 replaces *„vlastních
  zdrojích"* in §§ 4/1/b, 23/3/d and 53 odst. 1 až 3; tisk 260 bod 30 replaces the
  vrcholné-vedení clause. Disjoint substrings ✓. The verdict's restraint
  (*"nikoli o potvrzenou textovou kolizi ve stejném rozsahu"*) is exactly right.
- **193 numerics**: current cap 33 % (platné znění ✓), new cap „menší než 3 %" ✓, alternative
  „nejvýše však 33 %" with „alespoň 34" shareholders ✓, čl. II transitions 12 / 18 / 18
  months ✓, účinnost 1. 7. 2026 ✓. EKO-KOM is correctly **not** named — the corpus does not
  carry it and the verdict does not guess.
- **72**: both § 67 quotations verbatim-exact ✓; Pl. ÚS 47/23 ze 4. června 2025 ✓; sponsor
  arithmetic 13 + 17 = 30 ✓.
- **50 / 110**: all five long quotations verbatim ✓; 200 + 300 = 500 mil. ✓;
  1,4 − 1,2 = 0,2 mld = the 200 mil. upper sensitivity bound ✓; 35 → 25 let ✓; the
  „dostupná data" / „ve více než třetině případů" characterisations match the DZ ✓.
- **135 is clean.** Quote „…potvrzení dlouhodobé zahraničně politické orientace ČR" is
  verbatim *including* the „ČR", correctly located in the zvláštní část K čl. I; bod 5
  (hospodářský dopad) and bod 13 (lobbování) are the right section numbers ✓.
- **Whole-artifact sweep, all 10 verdicts**: 0 Cyrillic/Greek homoglyphs; 0 transcript line
  references (the `řádky 189–193` style that survives in `verdicts-014/verdict-217.json` does
  **not** recur here — the new evidence doctrine holds); 0 unsigned `whoBenefits`;
  0 camelCase or snake_case tokens in reader-facing fields; 0 English leakage; all files
  NFC-stable.
- **Jargon sweep counts**: 18 = 18, scan and sweep key sets exactly equal, 0 residual issues.
- **Census summary arithmetic**: 141 rows = `billsCensused` 141; recomputed operative pairs
  3166 = `totalOperativeBillParagraphPairs`; 48 and 5 diagnostics counts reproduce.

---

## Rulings the loop asked for

**12 / 131 subset ruling.** Tisk 131's **Čl. I is a strict, word-for-word subset** of tisk
12's Čl. I — 8 of 15 points, byte-identical, with no provision tisk 12 lacks. But **131 is
not a subset as a document**: Čl. II (transitional rule) and Čl. III (effectiveness) differ
materially, and both verdicts do say so a sentence later. **`medium` is earned on both** —
two pending bills would enact the same §§ 3, 56, 57, 58, 58a, 58b, 66 in identical wording
with different transitional regimes, months before the October 2026 municipal elections —
**conditional on fixing B2 (the count and the omitted bod 5) and M2 (the over-general
"neproveditelná")**.

**47 ↔ 217 companion ruling.** **Yes — tisk 47 is the companion** tisk 217 names, confirmed
four ways: by number (*„sněmovní tisk č. 47"* / *„senátní tisk č. 47, 10. volební období"*),
by statute (1/1993 Sb., čl. 97), by subject (NKÚ oversight of ČT and ČRo), and by the
identical proposed effective date of 1. 7. 2026, which tisk 217's DZ says is deliberate.
**The two verdicts do not tell a consistent story** and verdict-47's `unstatedEffects[0]` is
the inconsistent half. **Recommendation: yes, add the researched-context cross-reference** —
verdict-47 should carry tisk 217 by bill coordinates (sněmovní tisk 217, čl. I nový § 3
odst. 4 zákona č. 166/1993 Sb., čl. III účinnost 1. 7. 2026, filed 3. 6. 2026), and the
sequencing-gap effect must be rewritten as a *coordination* observation or dropped. The
symmetric back-reference belongs in verdict-217's record too.

**85 severity ruling.** `medium` is earned — and under-earned, given M1. The cross-row money
disclosure is factually accurate (sums, ICOs, tisk-125 provenance, pending-review state all
verified) but fails the attribution rule (B1).

**260 severity ruling.** `medium` is earned on the § 16 odst. 2 re-lettering alone; the
mechanics and arithmetic check out. B5 and M6 must be fixed before it ships.

---

## Required before pass-51

1. Strip or reclass every steward sum (B1) — 5 citations, 3 verdicts.
2. Fix the subset count and restore bod 5 to the omitted list (B2) — 2 verdicts.
3. Re-locate all three misattributed DZ passages in verdict-193 (B3) — 9 statements.
4. Rewrite verdict-47's `unstatedEffects[0]` against tisk 217 (B4).
5. Correct verdict-260's bod 30 reading and the § 53 subject (B5).
6. Then the 12 MAJOR items. M8's allowlist bypass and M9's un-gated attribution payload are
   the two that will recur across future batches if left.

**Audit-integrity note:** every finding above cites a file, a field and either a verbatim
source string or a measured count. Where the batch was right, this report says so — the
subset comparison, the cross-reference greps, 135 in full, and the whole-artifact hygiene
sweep all passed independent re-derivation.
