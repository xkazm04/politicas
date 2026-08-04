# Batch-014 closure audit — Case ③ law forensics

**Auditor:** fresh adversarial pass, no prior involvement in batches 011–013.
**Date:** 2026-08-04.
**Scope:** `payloads/verdicts-014/` (10 verdicts), `payloads/collision-close-reads-batch014-g{A,B}.json`,
`payloads/batch-014-dependency-census.json` + `payloads/batch-014-dependency-triage.json`.
**Method:** every claim re-derived from `.data/law-collision-cache/tisk-<n>/*.txt` (NFC, whitespace-collapsed);
counts and span-occurrence checked by script, never by eye; no payload, verdict or graph was modified.

---

# VERDICT: **NOT READY**

Four BLOCKING defects. Two of them publish a false quantified claim about a named bill
(`verdict-141`), one attaches three named companies to a person the bill's own signature page
does not carry (`verdict-217`), and one is a pair of provably inverted classifications in the
new dependency artifact. Eight MAJOR findings follow, including a regression of a finding
batch-013 recorded as **CLOSED**.

The deterministic gate passes **10/10** (`npx tsx scripts/case-loops/law/gate-verdicts-011.ts --batch=014`).
Every defect below is invisible to it. That is the batch's headline lesson, not an aside: the
gate checks shape, statute existence, citation-per-effect and Czech — it does not check
arithmetic, does not check a count against the list beneath it, does not check that a quoted
span exists, and (finding **M8**) does not run the jargon rules at all.

---

# 1. BLOCKING

## B1 — `verdict-141` · the DZ's money decomposition is arithmetically impossible, and the impossible version is attributed to the DZ

**File:** `payloads/verdicts-014/verdict-141.json` · fields `researchedContext` and `citations[1].claim`.

`researchedContext` states:

> „…celkové navýšení alokace do RUD krajů činí 11,35 mld. Kč ročně, z čehož 4 mld. Kč odpovídá
> převodu dosavadních dotací [SFDI] …, zatímco **zbylých cca 11,335 mld. Kč** (10 mld. Kč ze
> zvýšení procenta z 10,23 % na 10,97 % a 1,335 mld. Kč z nového podílu Prahy podle § 3a) je …
> skutečným snížením příjmů státního rozpočtu…"

11,35 − 4 = **7,35**. A remainder cannot exceed its total. `citations[1].claim` restates the same
split as a decomposition of 11,35 into 4 + 10 + 1,335 = **15,335**. Both are presented as what the
důvodová zpráva says.

**What the DZ actually says** (`.data/law-collision-cache/tisk-141/268738.txt`):

| line | text | figure |
|---|---|---|
| 306 | „navýšení celkové alokace do systému RUD krajů **o 11,35 mld. Kč ročně**, z čehož **4 mld. Kč** odpovídají zrušení dotací … SFDI" | total 11,35; SFDI 4 |
| 309–311 | „Z této částky připadne **6,0 mld. Kč** krajům a hlavnímu městu Praze na základě nového modelu … a **1,35 mld. Kč** hlavnímu městu Praze … podle § 3a" | 4 + 6,0 + 1,35 = **11,35** ✓ |
| 407–409 | „Nově je navrhován podíl RUD krajů ve výši 10,97 % … toto navýšení v roce 2027 představuje částku **10 mld. Kč**. Dále bude dopad na **1,335 mld. Kč** jako kompenzace pro hl. m. Prahu." | 10 + 1,335 = 11,335 ≈ 11,35 |
| 414 | „**Zároveň budou součástí tohoto navýšení** prostředky [SFDI] do RUD krajů **ve výši 4 mld. Kč**." | the 4 mld sits **inside** the 10 mld |

**Resolution.** The two DZ passages are consistent, and the verdict broke them by treating the
4 mld as *disjoint* from the 10 mld when line 414 says it is *part of* it:

- total increase **11,35 mld Kč** = 10 mld (the 10,23 % → 10,97 % rise) + ~1,35 mld (Prague, § 3a);
- **inside** the 10 mld sits the **4 mld** budget-neutral SFDI transfer (state subsidy to SFDI falls
  by the same amount, line 417–419);
- therefore the **real cut to state-budget shared-tax revenue is ≈ 7,35 mld Kč** (6,0 + 1,35),
  not ~11,335 mld. §2.1's own three-way split (4 + 6,0 + 1,35) is the arithmetically sound one and
  it is the passage the verdict never quotes.

The verdict **overstates the real revenue cut by ~54 %** and credits the overstatement to the
sponsor's own document. The only genuine inconsistency inside the DZ is 1,35 (line 310) vs 1,335
(line 409) — a rounding wobble the verdict could have reported and instead consumed.

## B2 — `verdict-141` · Prague is excluded from **three** of eight criteria, not two; § 3 odst. 13 was not read

**File:** `verdict-141.json` · `researchedContext`, `unstatedEffects[0].effect`, `citations[0].claim`
(all three carry the claim).

> „Praha je tedy **ze dvou z osmi kritérií** vyňata" / „Vyloučení … ze dvou z osmi přerozdělovacích
> kritérií (počet obyvatel s vahou 40 % a poměr počtu obcí k rozloze kraje s vahou 8 %)"

The bill's own text says otherwise. `268738.txt` line 108–109, new **§ 3 odst. 13**:

> „(13) V případě hlavního města Prahy se pro účely výpočtu procenta podle odstavce 2 použije
> ustanovení **odstavce 2 písm. a) až e)** obdobně."

a)–e) is **five** of the eight criteria. Prague is therefore excluded from **f), g) and h)** —
obyvatelé **0,4**, obce/rozloha **0,08**, and the **vyrovnávací koeficient 0,07**. The DZ confirms
h) independently: line 559 tabulates „Vyrovnávací koeficient (**kraje bez hl. m. Prahy**) 7 %", and
its footnote (line 563–565) says the criterion „shodnou výší **všem krajům (vyjma hlavního města
Prahy)** přispívá". Line 567–569 spells out Prague's set in full — silnice, rozloha, výjezdové
základny, urgentní příjmy, děti/žáci — five items.

Excluded weight is **55 %** of the model, not 48 %. The verdict states it read „nové znění § 3
odstavců 2 až 13" but its exclusion count comes only from the two `s výjimkou hlavního města Prahy`
strings in odst. 2 (lines 53 and 57); odst. 13, the one provision that states Prague's criterion set
directly, is nowhere in the verdict. This is the "counts vs their own lists" class again, on the
verdict's central mechanism, repeated in three fields.

## B3 — `verdict-217` · three named companies published against a sponsor the bill does not carry

**File:** `verdict-217.json` · `conflictAssessment`.

> „Podle grafu peněžních vazeb má **z pěti uvedených sponzorů** vazby na firmy dodávající státu …
> a **Robert Stržínek** (Nemocnice AGEL Valašské Meziříčí a.s., Vodovody a kanalizace Vsetín, a.s.
> a Tenisový klub DEZA Valašské Meziříčí, z. s.)"

The same verdict's `researchedContext` says:

> „Podepsanými navrhovateli podle textu tisku (řádky 219–224) jsou Ondřej Babka, Jan Richter,
> Gabriela Sedláčková a Patrik Nacher – to odpovídá **čtyřem** jménům v titulu návrhu."

Both sentences ship in one verdict, unreconciled, and the four-name one is right.
`.data/law-collision-cache/tisk-217/271419.txt` (226 lines total) — signature block, lines 218–224:

```
219   Ondřej Babka, elektronicky podepsáno
221     Jan Richter, elektronicky podepsáno
222   Gabriela Sedláčková, elektronicky podepsáno
224     Patrik Nacher, elektronicky podepsáno
```

`grep -n "Stržínek" 271419.txt` → **no match anywhere in the document**. The cached `index.html`
carries no sponsor list at all (it is the file-listing page). So the only sponsor evidence held in
this repo names four people, and the verdict publishes a fifth with three companies beside him on a
media-oversight bill.

**Ruling for the graph.** Record **four** sponsors for tisk 217 — Babka (pspId 6623), Richter (6500),
Sedláčková (7041), Nacher (6487). Do **not** record Robert Stržínek (6743). His entry in
`batch-014-targets.json → targets[billTisk=217].sponsors[3]` is unevidenced by every artifact in this
repo and must be dropped, or held out of the write pending a fresh psp.cz sponsor-list fetch that is
not the bill PDF. Until then no money tie may be published against him on this bill. The three
companies are real and correctly copied from the targets file — the defect is the *attachment*, not
the figures.

## B4 — dependency triage · two `self_reference` calls are provably `companion_dependency`

**File:** `payloads/batch-014-dependency-triage.json`.

Independently re-derived from the cached texts (not taken on the classifier's word):

| hit | triage says | the bill's own annex header says |
|---|---|---|
| `bills[cislo=207].hits[0]` | `self_reference` — „odkaz na vlastní budoucí číslo" | `tisk-207/271154.txt` **line 4**: „Změna trestního zákoníku **(ve znění sněmovního tisku 14)**" |
| `bills[cislo=216].hits[0]` | `self_reference` — „nový §175a je jeho vlastní vkládané ustanovení" | `tisk-216/271416.txt` **line 4**: „…s vyznačením navrhovaných změn a doplnění **(ve znění sněmovního tisku 207/0)**" |

tisk 207 corroborates itself again in its důvodová zpráva (`271152.txt` line 2046): „…s úpravou
počítá **novela trestního zákoníku projednávaná jako sněmovní tisk 14**". The dangling
`…/2026 Sb.` in tisk 207's baseline chain (`271152.txt` line 33) is tisk 14; tisk 216's is tisk 207.
Correct labels: `companion_dependency`, `likelyCompanionTisk: 14` and `207`.

**The general point is stronger than the two rows.** The placeholder in every one of these hits sits
in the *prior-amendment enumeration* of the law being changed — „…ve znění zákona č. 314/2025 Sb.
**a zákona č. …/2026 Sb.**, se mění takto". That enumeration lists acts that have **already** amended
the law. A bill does not enumerate itself there. So the whole "routine drafting convention →
self_reference" reading is structurally wrong for this shape, and the two rows above are simply the
two where a companion annex header made the referent provable. See **M7**.

---

# 2. MAJOR

## M1 — `verdict-187` · "4th postponement" overcounts by one against the DZ's own history

`unstatedEffects[1].effect`: „…je již **nejméně čtvrtým posunem** téhož závazku od jeho zavedení
v roce 2021 (2021 → 2024/2025 → 2026 → 2027 → nyní 2029/2030)".

The milestone chain is right; the ordinal is not. `tisk-187/270041.txt`:

| line | event |
|---|---|
| 238–242 | zákon **261/2021** inserts the atestace rules; „Ta předpokládala, že **od 1. ledna 2024, respektive 1. ledna 2025**…" — the original deadline, not a postponement |
| 262–266 | zákon **89/2022** — „došlo k odložení účinnosti … **od 1. ledna 2026**" → postponement **1** |
| 268–274 | zákon **197/2024** — „**opětovně** došlo k odložení … **od 1. ledna 2027**" → postponement **2** |
| 418–421 | this bill — 1. 1. **2029** / 1. 1. **2030** → postponement **3** |

Three postponements, and the verdict's own parenthetical contains exactly three arrows that are
postponements; the fourth arrow is the enactment. „nejméně" does not rescue a floor that the source
refutes. Correct copy: *třetí odklad*. The substantive finding (repeatedly deferred, never solved
otherwise) survives intact.

## M2 — `verdict-25` · the quoted důvodová zpráva sentence does not exist

`researchedContext` renders inside Czech quotation marks:

> „**nejde o dočasnou výjimku, ale o trvalý zvláštní právní režim**"

That exact string occurs nowhere in `tisk-25/265305.txt`. It is a splice of two different sentences:

- line **201**: „**Nemá se jednat** o dočasnou výjimku, ale o **trvalý zvláštní právní režim** –
  výluku z režimu § 16…"
- line **475**: „**Nejde** o dočasnou výjimku, ale o **trvalou výluku** z využití e-Legislativy…"

Substantively faithful — both sentences do assert permanence, and both are about § 22a — but a
fabricated verbatim span published as the sponsor's own words is the defect class this loop exists
to prevent. Either quote is usable as-is; the composite is not.

## M3 — `verdict-168` · CZK against named MPs without the `pending_review` marker — batch-013 **M5 regressing**

batch-013's audit recorded M5 (CZK figures rendered without a gate label) as **CLOSED**. Two of
three `graph_fact` citations in `verdict-168.json` reopen it:

| citation | figure | aggregate qualifier | `pending_review` marker |
|---|---|---|---|
| `citations[…].source = company:ico:24766216` | 1,06 mil. Kč | „v agregované výši" ✓ | **„(čeká na lidskou kontrolu)" ✓** |
| `company:ico:00084018` (Patková × Hvězdárna HK) | 19 mil. Kč | „v agregované výši" ✓ | **none** |
| `company:ico:61989592` (Hoffmannová × Univerzita Palackého) | **28,35 mld. Kč** | „institucionálních zakázek veřejné vysoké školy" ✓ | **none** |

The `conflictAssessment` prose does carry the label once for all three („peněžní vazbu, **čekající na
lidskou kontrolu**"), which is why this is MAJOR and not BLOCKING — but the citations are the
machine-readable surface, and the largest sum in the batch is the one that ships bare. All three
figures reconcile exactly with `batch-014-targets.json` (1 061 437 / 19 017 989 / 28 353 545 697 Kč).

## M4 — collision `gA` · `16-64-240-2013` states an exclusivity the source refutes, behind a truncated excerpt

`collision-close-reads-batch014-gA.json` → `pairs[16-64-240-2013]`, `incidental`:

> „…zatímco tisk 64 pracuje **pouze v odstavcích 3** … **a 4**"

`tisk-64/266153.txt` **bod 68, lines 11993–12002** amends, in one enumeration,
„…§ 603a odst. 2 písm. b), **§ 604 odst. 6 písm. b), § 604 odst. 7 písm. b)**, § 605 odst. 7 písm. b)…".
tisk 16 (`tisk-16/265180.txt` **line 546**, bod 5) amends „**§ 604 odst. 6** úvodní části ustanovení".

Both bills edit **§ 604 odstavec 6** — different subdivisions of it (úvodní část vs. písm. b)).
That is precisely the "same unit, disjoint substrings" shape `gB` labels **coordination-risk**
(see M5). The `billBExcerpt` stops at bod 72 and never shows bod 68, so the quoted evidence conceals
the overlap it is offered to disprove. The *conclusion* (no address break — tisk 64's renumbering is
confined to odst. 3 and 4, verified) still holds; the stated ground for it does not.

## M5 — collision `gA` vs `gB` apply opposite rubrics to one fact pattern; the counts are not comparable

Recomputed from the `pairs` arrays (both `classificationCounts` are **exact** — see §5):

- **gA**: `confirmed-collision 2 · coordination-risk 0 · incidental 6`
- **gB**: `confirmed-collision 0 · coordination-risk 7 · incidental 1`

A perfectly bimodal split across two groups reading the same corpus. The pairs show why — same §,
disjoint odstavce, no renumbering, no cross-reference:

| pair | file | label |
|---|---|---|
| `64-67-219-2000` (§ 21b odst. 3 vs odst. 1) | gA | **incidental** — „Instrukce jsou vzájemně nezávislé." |
| `67-77-258-2000` (§ 80 odst. 2 vs odst. 8) | gA | **incidental** |
| `64-145-277-2009` (§ 120 odst. 2 vs odst. 3) | gA | **incidental** |
| `64-77-181-2007` (§ 12 odst. 5 vs odst. 3) | gB | **coordination-risk** — „stejný paragraf, disjunktní odstavce, bez skutečného textového střetu, **ale vyžadující sloučení**" |
| `85-125` / `88-125` (§ 21 odst. 2 písm. e) vs odst. 1) | gB | **coordination-risk** |

gB's own sentence states the rule gA breaks. The label is a function of which group wrote the row.
Any downstream aggregation of batch-014 collision classifications is summing two different scales,
and the batch cannot publish a `coordination-risk` count until one rubric is applied to all 16 pairs.

## M6 — collision `gA` · `7-260-37-2021` carries a fabricated evidentiary parenthetical

The pair's verdict (`confirmed-collision`) is **earned** — re-derived independently: tisk 260
(`tisk-260/278413.txt` bod 15, lines 468–471 + line 485 „Dosavadní písmena h) až u) se označují jako
písmena m) až z)") shifts by +5, and tisk 7 (`tisk-7/265064.txt` lines 1180–1183) addresses
`§ 16 odst. 2 písm. n)` with no cross-reference. Old n) → new s). All correct.

The defect is inside `reasoning`: „…adresa 'písm. n)' po přečíslování ukazuje na zcela jiný, věcně
nesouvisející text (**dříve písm. i) o Europolu a Eurojustu**)". By the mapping stated in the same
sentence, new n) = **old i)** — and no *platné znění* of 37/2021 exists in the cache for either bill,
so old i)'s content is not knowable from the corpus. The only Europol/Eurojust wording present is
`tisk-260/278413.txt` **line 475**, „j) Europolu a Eurojustu…", one of the **newly inserted** letters
h)–l), which by definition is not a *dosavadní* letter and is not renumbered. The parenthetical
asserts a content fact the corpus contradicts, in the most consequential row of the file.

## M7 — dependency triage · `unclear: 0` does not survive; the companion set is under-inclusive

Structural integrity is exact (§5). The classification quality is not:

- **29 distinct `reasoning` strings for 67 entries.** 52/67 (78 %) share a justification with at
  least one other hit; one string covers 13 hits (tisk 113). Seven entries' reasoning never names
  its own bill number.
- **30/67 hits rest on evidence that cannot discriminate the two classes** — stripping the
  Sb-citation chain before the placeholder leaves no named subject at all. Of those 30: **26
  `self_reference`, 4 `companion_dependency`, 0 `unclear`.**
- **Six hits across six different bills carry a byte-identical chain tail** (the trestní-zákoník
  chain ending `…314/2025 Sb. a zákona č. …/2026 Sb.`): tisks **207, 111, 196, 173, 213, 216**. All
  six called `self_reference` — six different acts asserted for one identical string, and two of
  them (B4) are textually proven to denote other bills.
- **`bills[cislo=207].hits[1,2,3]`** (targeting 141/1961, 273/2008, 341/2011 — Části druhá/čtvrtá/pátá
  at `271152.txt` lines ~765/831/851) carry no tisk marker and no hit-specific evidence, only the
  shared boilerplate that hit 0 has now disqualified. These should be `unclear`.

Most suspicious three, all `self_reference`, all recommended `unclear`:
`bills[111].hits[0]` (justification is pure analogy to 207/173/216 — two of its three anchors are
wrong; `tisk-111/267625.txt` line 1 annex carries **no** tisk marker);
`bills[173].hits[0]` (annex `tisk-173/269589.txt` line 1, no marker);
`bills[213].hits[0]` (justification invokes membership in a „bezpečnostní balíček" — an *inter-bill*
package, which argues for companion, not self).

A detector that returns `unclear: 0` on 67 hits where 30 carry no discriminating signal is reporting
a default, not a finding.

## M8 — the law-loop gate does not run the jargon rules; the "jargon gate is live" premise is false for this loop

`scripts/case-loops/law/gate-verdicts-011.ts` → `validateLawVerdict()` (`lib/analysis/law-verdict.ts`)
→ shape · statute existence · citation-per-effect · `czechGateErrors`. It never imports
`PIPELINE_JARGON` / `jargonViolations` from `lib/analysis/public-copy.ts`.

`grep -rln "jargonViolation|isPublicSafe|publicCopyOrNull"` over `lib/`, `features/` and
`scripts/case-loops/law/` returns only `lib/analysis/public-copy.{ts,test.ts}` — the render-time
withholding is wired into `features/profile/getProfileData.ts` (effort loop) and **nowhere in
`features/lawwatch/`**. Law verdict prose is neither gated at persist time nor withheld at render
time. Batch-014's clean jargon result (below) is an artifact of the authors' discipline, not of a
control. Either wire the rules into `validateLawVerdict` or stop describing the gate as covering
this loop.

---

# 3. MINOR

- **m1 · a live gate-evasion shape, found.** `PIPELINE_JARGON`'s batch rule is
  `/\b(batch|dávka)\s*\d|…/i`. A **hyphen** defeats it: `re.test("batch-011") === false`, while
  `"batch 011"` and `"batch011"` both test `true`. Three instances ship in this batch —
  `collision-close-reads-batch014-gA.json` (`batch-011`, in `pairs[16-64-240-2013].reasoning`) and
  `-gB.json` (`batch-009` ×2). Not currently reader-facing (M8), but the regex should take `[\s-]*`.
- **m2 · `verdict-257.unstatedEffects[1].effect`** contains „v této skupině", which trips
  `PIPELINE_JARGON`'s sample-self-reference rule verbatim. Here it is **ordinary Czech** — it means
  the bill's own target group (poživatelé ID 3. stupně), not an analyst sample — so it is a false
  positive, but it would be silently withheld the moment this prose is routed through
  `publicCopyOrNull()`. Worth a one-word rewording rather than a rule exemption.
- **m3 · non-Czech characters in Czech forensic prose.** Cyrillic „**ред**aktor" (`р`, `е`, `д`) in
  `gB.pairs[13-145-84-2024].reasoning`; English „**correctly**" in `gA.pairs[7-260-37-2021].reasoning`;
  broken clause „…kterou tisk 125 nikde neupravuje odstavec 2" in `gB.pairs[85-125-108-2006].reasoning`.
- **m4 · role/person conflation on government bills (recurrence of a batch-012 MINOR).**
  `verdict-234.conflictAssessment`: „Jedinou uvedenou předkladatelkou je **poslankyně** Zuzana Mrázová
  (návrh je vládní, podává ho **ministr pro místní rozvoj**)" — as if two people.
  `tisk-234/277503.txt` line 2296: „**Ministryně pro místní rozvoj:** Mgr. Zuzana Mrázová".
  Same shape in `verdict-83`: „vládní ministr dopravy, formálně provázaný v grafu s **poslancem**
  Ivanem Bednárikem" — `tisk-83/266860.txt` line 1986: „**Ministr dopravy:** Ivan Bednárik, MBA".
  `verdict-25` gets the identical situation right („předkladatelem-poslancem je Vít Rakušan
  (1. místopředseda vlády a ministr vnitra, který návrh jako člen vlády i podepsal)"), so the batch is
  internally inconsistent. *Not* a finding: all four government bills (25, 83, 222, 234) also carry
  PM Babiš's signature and no verdict names him — that omission is a uniform, defensible convention.
- **m5 · `verdict-234.unstatedEffects[0].evidence`** cites „zvláštní část důvodové zprávy **k bodům 44
  až 47**"; the heading at `277503.txt` line 2235 is „K bodům **44 až 45 a 47**".
- **m6 · `verdict-217.researchedContext`** embellishes the source: the bill says NKÚ may audit
  „veškerý majetek … a nikoli jen s finančními prostředky vybranými **na základě zákona**"
  (`271419.txt` line 193); the verdict renders „…na základě **zákona o televizních a rozhlasových
  poplatcích**", naming a statute the sentence does not.
- **m7 · `verdict-89` and `verdict-217` name MP↔company ties without stating the gate state.** All 211
  `linked_to` ties in the graph are `pending_review`. Neither renders a CZK figure, which is why this
  is MINOR rather than a money-rule failure — but „evidované vazby" reads as settled.
- **m8 · `verdict-25.unstatedEffects[1]`** is framed as an unstated effect, yet the DZ states the rule
  plainly at „K bodům 4 až 6" (`265305.txt` lines 509–513). What is unstated is the *asymmetry*, not
  the rule; the verdict never says the DZ describes the mechanism, so a reader may infer concealment.
- **m9 · `verdict-187` citations are a subset of its own count.** It correctly finds „osm samostatných
  částí měnících osm různých zákonů" (verified: ČÁST PRVNÍ–OSMÁ each headed „Změna zákona…", ČÁST
  DEVÁTÁ is účinnost) but cites six. Acceptable — completeness is not claimed — but two amended acts
  (the občanský-zákoník-amending act and the 499/2004-amending act) have no `law` citation.
- **m10 · dependency triage `bills[206].hits[0]`** sets `likelyCompanionTisk: 777`; tisk 777 is outside
  the 141-bill PSP10 corpus and has no cache directory. The classification is earned; the payload does
  not say the target is unresolvable here.
- **m11 · `gB.pairs[77-125-582-1991].evidence.billBExcerpt`** holds a span that occurs in **tisk 77**,
  not tisk 125 (`tisk-77/266520.txt` lines 1563–1565). The field's own prose says so („dle platného
  znění citovaného tiskem 77"), so it is field hygiene rather than a fabricated quote — but a
  `billBExcerpt` holding bill-A text breaks any automated span check.

---

# 4. What verified clean

Stated explicitly, because a silent pass is indistinguishable from an unchecked one.

**`verdict-141`** — „10,23" → „10,97" in § 3 odst. 1 písm. b) až g), čl. I bod 1 (line 26) ✓;
the eight criteria and every weight (0,2 + 0,13 + 0,06 + 0,04 + 0,02 + 0,4 + 0,08 + 0,07 = **1,00**) ✓;
Prague excluded in **§ 3 odst. 2 písm. f) a g)** exactly as cited (lines 53, 57) ✓; new § 3a with
**six** tax categories a)–f) at 0,1 % each (lines 114–136) ✓; the tisk-140 collision — both bills
rewrite § 3 odst. 2–6 (140 line 27, 141 line 28), 140 adds odst. 7–12 and 141 odst. 7–13, 140 leaves
10,23 % untouched (`tisk-140/268735.txt` lines 12–28) and has no § 3a, same submitter ✓.

**`verdict-187`** — the permanent carve-out is real and its beneficiary list is exact: all seven
named bezpečnostní sbory **including GIBS**, plus Vojenská policie (`270041.txt` lines 445–449),
enacted as unsunsetted amendments to § 63 odst. 3 and § 69e odst. 1 (lines 99–103) against a
*time-limited* deferral for everyone else ✓; „pokutu až ve výši 200 tis. Kč" (line 416) ✓;
2 000 000 000 → 1 500 000 000 Kč and the 750 000 000 Kč advance cap (lines 40, 51–52) ✓;
Commission decision SA.116631, licence period 2025–2029 (lines 231, 234, 393–395) ✓; eight amending
parts ✓.

**`verdict-217`** — the scope-widening finding is earned: „aby NKÚ mohl kontrolovat také hospodaření
s **veškerým majetkem** … tedy i s majetkem pocházejícím např. z jejich obchodní činnosti, a nikoli
jen s finančními prostředky vybranými na základě zákona" (lines 189–193) ✓; the non-binding
kontrolní závěr (lines 195–197) ✓; the companion **senátní tisk č. 47** (lines 40–41, 148) ✓ — note
the DZ contradicts itself at line 214 („sněmovní tisk č. 47") and the verdict picked the version the
DZ states twice. Everything except B3.

**`verdict-89`** — the collision is real and I re-derived both sides. tisk 89 (`tisk-89/267100.txt`
lines 36–46): „V § 3 se na konci písmene r) nahrazuje tečka čárkou a doplňuje se písmeno s) …
**rozvojem sociální infrastruktury**…". tisk 64 (`tisk-64/266153.txt` **line 6534**, inside its
218/2000 part, header line 6490): „V § 3 se na konci písmene r) tečka nahrazuje čárkou a doplňuje se
písmeno s), které zní: „s) **dlouhodobým hmotným nebo nehmotným majetkem**…"" — same paragraph, same
letter, same insertion point, incompatible content, DZ at line 28709 „K bodu 5 (§ 3 písm. s))" ✓.
The uncapped new channel ✓ (bod 2 adds „a na dotační investiční akce pro rozvoj sociální
infrastruktury" with no numeric limit). The 2020 precedent ✓ (line 80: „Takový postup již byl
aplikován v roce 2020"). This is the batch's strongest verdict.

**`verdict-25`** — § 22a verbatim (lines 38–41) ✓; § 26 odst. 1 písm. a) bod 1/2 verbatim
(lines 43–52), the differential trigger confirmed and correctly characterised ✓; the EU-cofinancing
rationale for keeping wholly-new laws on 15. 1. 2026 (lines 177–182) ✓; the one-year deferral ✓;
`whoBenefits` naming the government is **earned**, not an unsigned-effect beneficiary — čl. 42 Ústavy
makes the government the budget bill's exclusive submitter (line 480). Everything except M2.

**`verdict-222`** (low) — § 9a quoted verbatim and correctly located in ČÁST DRUHÁ, § 16
(`tisk-222/271596.txt` lines 376–390) ✓; § 12 odst. 3 quoted verbatim (lines 336–337) ✓; the claim
that the DZ itself concedes the FOI exclusion in **part J** ✓ (lines 883–890, sitting inside the
corruption-risk assessment, before „K) ZHODNOCENÍ DOPADU NA BEZPEČNOST" at line 896).

**`verdict-234`** (low) — **byte-identity re-derived, as requested.** The two § 17d texts are *not*
byte-identical, and the verdict does not claim they are — it says „**téměř doslovně** totožný", which
is exactly right. After whitespace collapse, `tisk-234/277503.txt` lines 904–912 and
`tisk-56/266014.txt` lines 134–147 differ in precisely three places: (1) tisk 56 opens „**(1)**
Přestupky podle tohoto zákona projednává inspektorát…", tisk 234 has no odstavec marker; (2) tisk 234's
písm. a) ends „…Zeměměřický úřad, **a**" (conjunction before the final letter) where tisk 56 ends
„…Zeměměřický úřad," and moves the conjunction to písm. b) („…Ministerstvo obrany, **a**") because a
písm. c) follows; (3) tisk 56 adds písm. **c)** (Český telekomunikační úřad) and an **odstavec 2**.
Every other character of the chapeau and of a)/b) is identical. The verdict's characterisation —
„tatáž písmena a) a b), rozšířená navíc o písmeno c) a odstavec 2 pro ČTÚ" — is exact, and its
attribution to shared drafting rather than to a substantive conflict is the right call.

**`verdict-83`** (low) — the honest-negative claim holds. Every new offence class in the bill names a
non-citizen offender: `tisk-83/266860.txt` line 69 „**Právnická nebo podnikající fyzická osoba** se
dopustí přestupku tím, že jako vlastník…", line 147 „**Vlastník nebo správce pozemní komunikace**",
line 152 „…integrovaných veřejných služeb v přepravě cestujících…", fines at 100 000 Kč (lines 77,
158, 1433, 1539, 1651, 1757, 1936). `grep "fyzická osoba"` returns **only** the „podnikající fyzická
osoba" form — no offence falls on a private individual, driver or passenger. `unstatedEffects: []`
with a fully reasoned negative is the right shape, not a gap.

**`verdict-168`** (low) — „Návrh podepsalo **18** poslanců" is grounded in the bill's own signature
page, not merely in the targets file: `tisk-168/269433.txt` lines 546–606 carry exactly **18**
„podepsáno elektronicky" blocks and all 18 names match `batch-014-targets.json`. The internal split
also reconciles: 3 with ties + „zbývajících **patnáct**" (all 15 enumerated) = 18. This is the
counter-example to B3 — the same check, done properly.

**Standing sweeps (all ten verdicts).**
*whoBenefits of unsigned effects*: 12 effect blocks; 8 lead with „Nelze jednoznačně určit". The four
that do not are **earned**, not violations — `verdict-25` ×2 (the government, per čl. 42 Ústavy) and
`verdict-257` ×2 (the bill's own DZ names the target group, and the verdict says so).
*Money rule*: only three verdicts render CZK (25, 168, and none elsewhere). `verdict-25` carries both
halves ✓. `verdict-168` fails the gate-label half in two citations (**M3**).
*Temporal rule*: no verdict asserts a present-tense ownership, board seat or statutory-body role for
any MP. The only present-tense roles are public offices from the targets `submitter` field.
*Counts vs their own lists*: `verdict-168` (18 = 3 + 15) ✓, `verdict-187` (eight parts) ✓,
`verdict-89` (11 sponsors = 3 + 8) ✓, `verdict-217` (5 vs 4 — **B3**), `verdict-141`
(two vs three criteria — **B2**), `verdict-187` (four vs three postponements — **M1**).
*Jargon*: I ran `PIPELINE_JARGON` plus ten additional evasion probes (id-like tokens `pspId` /
`kg_node` / `company:ico:` / `contractCzk`, English pipeline vocabulary `payload` / `detector` /
`triage` / `severity`, Czech sample-scope phrasings) over every prose field of all ten verdicts:
**one hit**, `verdict-257`'s „v této skupině", a false positive (**m2**). The verdicts are clean.
The *collision payloads* are not (**m1**, **m3**).

**Collision close-reads.** `64-162-99-1963` ✓ — re-derived: tisk 64 (`266153.txt` lines 74–77)
„doplňuje odstavec 3" while tisk 162 (`269165.txt` line 112 + **line 124** „Dosavadní odstavec 2 se
označuje jako odstavec 3") occupies position 3 with pre-existing text; both bills independently
attest § 141 currently has two odstavce, so either order breaks. `7-260-37-2021` ✓ on mechanics
(defect is M6). `64-67-184-2006` ✓ — the load-bearing question is whether písm. b) contains *both*
substrings, and it does: `tisk-67/266190.txt` lines 22435–22447 print b) as one fragment carrying
„ceny stanovené" and „zastavěném"; disjoint substrings, no renumbering, order-irrelevant →
**coordination-risk is the right call**. `85/88/125` V-not-triangle ✓ — tisks 85 and 88 carry
byte-identical instructions on § 21 odst. 2 písm. e) (`266984.txt` lines 27–29, `267095.txt` lines
54–56, identical amendment-history lists), while tisk 125's **only** operative § 21 hit
(`268378.txt` line 61) is „V § 21 **odstavec 1** zní" — it never touches odst. 2. Real edge 85×88
only; 125 is a merge concern on both. Not a triple.
**Span integrity**: all 34 verbatim segments across both files occur in the named bill at the
strictest normalisation (NFC + whitespace collapse, exact — no fallback needed), and law attribution
was confirmed for all 20 span sites by walking back to the nearest part header. One field-hygiene
exception (**m11**) and one trailing-quote artifact.
**`classificationCounts`**: gA stated `{2, 0, 6}`, computed `{2, 0, 6}` over 8 pairs ✓; gB stated
`{0, 7, 1}`, computed `{0, 7, 1}` over 8 pairs ✓; `coverage.pairsRead/pairsAssigned = 8/8` matches
`pairs.length` in both; every `classification` value is drawn from the declared vocabulary.

**Dependency census structural integrity** — recomputed, not eyeballed: census `rows[]` = 26 bills
matching `billsWithDanglingRefs: 26` ✓; Σ hits = **67** on both sides ✓; triage `bills[]` = 26 with a
bill-number set diff of **empty in both directions** ✓; per-bill hit counts **0 mismatches** across
26 bills ✓; recomputed tally `{self_reference: 53, companion_dependency: 14}` matches `counts`,
sum 67 ✓; positional context match (triage contexts are 120-char prefixes of census contexts)
**67/67, 0 orphaned, 0 duplicated** ✓. Nothing dropped, added or mis-tallied. The census is sound;
the *classification layer* on top of it is B4 / M7.
Three companion calls spot-verified and **earned**: tisk 144 → 64 (`tisk-144/268804.txt` line ~14466
carries tisk 64's title verbatim, and the cited ČÁST ČTYŘICÁTÁ PÁTÁ resolves in `tisk-64` line ~6073
to the cizinecký-zákon part — matching tisk 144's subject); tisk 153 → 69 (footnotes 10a, 32 and 55
at `tisk-153/268952.txt` lines ~153, ~559, ~562, naming „o digitální ekonomice", tisk 69's own title
at `tisk-69/266214.txt` line ~7); tisk 206 → ST 777 (`tisk-206/271159.txt` line ~272 „(ST 777)"
verbatim, corroborated at line ~1554 „podle sněmovního tisku 777"). The `self_reference` calls for
**tisk 113** (13 hits) and **tisk 69** (5 hits) are of a sound, different shape — the citation names
the bill's *own subject* being inserted into another law's annex — and are unaffected by M7.

---

# 5. Required before the write

1. **B1** — recompute `verdict-141`'s money paragraph from DZ §2.1 (4 + 6,0 + 1,35 = 11,35) and state
   the real revenue cut as ≈ **7,35 mld Kč**; report the DZ's own 1,35/1,335 wobble rather than
   consuming it. Fix `researchedContext` **and** `citations[1].claim`.
2. **B2** — correct to **three of eight** criteria / **55 %** of model weight in all three fields, and
   cite § 3 odst. 13 (`268738.txt` line 108).
3. **B3** — drop Robert Stržínek and his three companies from `verdict-217`; record four sponsors;
   correct „z pěti uvedených sponzorů"; correct `batch-014-targets.json`'s sponsor array for tisk 217
   or hold it pending an independent sponsor-list fetch.
4. **B4** — reclassify `bills[207].hits[0]` → `companion_dependency` / 14 and `bills[216].hits[0]` →
   `companion_dependency` / 207, then re-examine the other four bills sharing the byte-identical
   trestní-zákoník chain (111, 196, 173, 213).
5. **M1** — „třetí odklad", not „nejméně čtvrtým".
6. **M2** — replace the spliced quote with either line 201 or line 475 verbatim.
7. **M3** — add the `pending_review` marker to `verdict-168`'s two bare `graph_fact` citations.
8. **M4–M6** — fix the `16-64-240-2013` reasoning and excerpt; reconcile gA/gB onto one rubric and
   restate both count blocks; delete the Europol/Eurojust parenthetical from `7-260-37-2021`.
9. **M7** — reclassify the unsupported hits to `unclear` and republish the tally; a
   `companion_dependency`/`self_reference`/`unclear` split of 14/53/0 must not ship.
10. **M8** — wire `PIPELINE_JARGON` into `validateLawVerdict()`, and widen the batch rule to
    `[\s-]*\d` (**m1**) in the same change.

Re-audit scope after remediation: B1–B4 and M1–M7 re-verified against the cached texts, plus a fresh
standing sweep — every prior batch's remediation introduced new defects, and three of this batch's
BLOCKING items are in fields that a previous pass had already touched.

---

# Closure check (post-fix)

Re-verified against the **current files**, not against the remediation account. Every figure below
was recomputed or re-grepped from source; the fix report was treated as a claim to test.

## VERDICT: **REOPENED** — narrowly

**All twelve original findings (B1–B4, M1–M8) verify CLOSED.** The remediation is genuinely good:
the 141 arithmetic and Prague weights re-derive exactly, B3 is fixed on both the verdict and the
payload with a live-graph correction script, the triage rebuild found two real edges I had not, and
M8 shipped a working two-ended gate. Nothing I flagged came back wrong.

But the doctrine's own warning held for a fourth batch: **two NEW defects were introduced by the
fixes themselves**, both MAJOR, both one-touch. The write should not go until they are cleared.

## Finding-by-finding

| # | status | verification |
|---|---|---|
| **B1** 141 arithmetic | **CLOSED** | `researchedContext` now carries the DZ's own §2.1 split (4 + 6,0 + 1,35 = **11,35** ✓), states §6.1's alternative (10 + 1,335 = 11,335 ≈ 11,35 ✓), discloses the DZ's 1,35 vs 1,335 rounding wobble, quotes „součástí tohoto navýšení" and concludes the real revenue cut is **≈ 7,35 mld Kč (6,0 + 1,35)**. `citations[1].claim` restates the same split consistently. All four sums recomputed by hand. No remainder exceeds its total anywhere. |
| **B2** Prague count | **CLOSED** | „ze tří z osmi" in `researchedContext`, `unstatedEffects[0].effect` **and** `citations[0].claim`. § 3 odst. 13 is now quoted verbatim and matches `268738.txt` lines 108–109 exactly. Weights recomputed: 0,4 + 0,08 + 0,07 = **0,55** ✓. The DZ's independent corroboration for h) („Vyrovnávací koeficient (kraje bez hl. m. Prahy)", line 559; „všem krajům (vyjma hlavního města Prahy)", line 564) is cited. |
| **B3** 217 sponsor | **CLOSED** | `conflictAssessment` now says „ze čtyř sponzorů, jejichž jména nese titul návrhu i podpisová strana" and names only Babka/Richter/Sedláčková/Nacher; every Stržínek claim and all three of his companies are gone. `batch-014-targets.json` carries 4 sponsors + a `sponsorCorrectionNote`; his name survives **only inside that note**, which is correct — the note is the record of the correction. The added data-quality sentence discloses the discrepancy without naming anyone. `fix-217-sponsors-014.ts` read and sound: merge-preserving single-prop write, `EXPECT`-guard that **throws** if the live sponsor set differs, `sponsors_correction` provenance stamped, dry-run by default. (Read only — I did not open PGlite.) |
| **B4** triage 207/216 | **CLOSED** | `bills[207].hits[0]` → `companion_dependency`/**14**; `bills[216].hits[0]` → `companion_dependency`/**207**. Both cite the annex headers I verified independently. |
| **M1** 187 postponement | **CLOSED** | Now „již **třetím** posunem … s původním termínem 2024/2025 (2024/2025 → 2026 → 2027 → nyní 2029/2030)" — three arrows, three postponements. `evidence` widened to „řádky 239–280", which now covers line 242 where the original 1. 1. 2024 / 1. 1. 2025 deadline is stated. |
| **M2** 25 spliced quote | **CLOSED** | Two quotes, both verbatim prefixes of real sentences: „Nemá se jednat o dočasnou výjimku, ale o trvalý zvláštní právní režim" = `265305.txt` line 201 ✓; „Nejde o dočasnou výjimku, ale o trvalou výluku z využití e-Legislativy" = line 475 ✓. Extracted by regex from the field and matched against the cache. |
| **M3** 168 money rule | **CLOSED** | All **three** `graph_fact` citations now carry both halves — „(úhrn veřejných smluv firmy, **vazba čeká na lidskou kontrolu**)" — including the 28,35 mld Kč one. Applied preemptively to `verdict-25` too. Batch-wide recomputation: **0** graph_fact citations render CZK without the marker across all ten verdicts. |
| **M4** 16-64 mechanics | **CLOSED** | Reasoning rebuilt and now correct: it states bod 68's mass substitution reaches § 604 odst. 6 písm. b) and odst. 7 písm. b). `billBExcerpt` quotes bod 69 — verified verbatim at `266153.txt` **lines 12005–12006**. Reclassified `coordination-risk`, the right label under the unified rubric. *Nit:* the excerpt attributes bod 68's reach to „podle důvodové zprávy" when it is enumerated in the **operative text** (lines 11993–12002) — a stronger source than the one credited. |
| **M5** rubric | **CLOSED for batch-014** | One rule now stated verbatim in the reasoning of the reclassified pairs. gA: stated `{2, 6}` = computed `{confirmed-collision 2, coordination-risk 6}` ✓. gB: stated `{0, 7, 1}` = computed ✓. gB's surviving `incidental` (`64-74-282-1991`) is coherent with the rule — tisk 74 uses § 1 only as a positional anchor for a new § 1a and never edits § 1's text, exactly the „citační, kotevní" carve-out the rule names. (See **N1** for the batch-013 half.) |
| **M6** Europol parenthetical | **CLOSED** | Replaced with „…jehož obsah ale korpus nenese (platné znění zákona č. 37/2021 Sb. není v archivu)" — an honest statement of what the corpus does not carry, which is what the evidence supports. |
| **M7** `unclear: 0` | **CLOSED** | Rebuilt under an explicit structural rule (stated in `method`): the ve-znění enumeration form is now **structurally excluded** from `self_reference`. Counts recomputed from the `bills[]` array: stated `{self 26, companion 18, unclear 23}` = computed exactly, sum = **67** ✓, census sum = 67 ✓, 26 bills both sides ✓. `bills[207].hits[1..3]` are now `unclear`, as recommended. The three `companion_dependency` entries with a **null** tisk number (64 ×2, 58) are the right call, not a hedge: I verified from the census contexts that all three placeholders read „…a zákona č. …/**2025** Sb." while both bills' own headers are **2026** — positive evidence the referent is a different act, with the identity honestly unrecoverable. |
| **M8** gate coverage | **CLOSED, with N2** | `lawJargonIssues()` is module-scoped in `law-verdict.ts`, composes `PIPELINE_JARGON` rather than forking it, and runs at persist (`validateLawVerdict`, line 225). Probe-tested directly: cache path → TRIP, graph urn → TRIP, „batch 014" → TRIP, „pass-48" → TRIP, verdict-257's „v této skupině" → **pass** (the documented skip works), clean Czech → pass. Gates re-run: **12/12 · 10/10 · 10/10 · 10/10**; `law-verdict.test.ts` **11/11**; `npm run typecheck` clean; `vitest lib/analysis features/lawwatch` **319/319**. |

## New defects introduced by the fixes

### N1 (MAJOR) — batch-013 gB: two pairs now state two different classifications

`payloads/collision-close-reads-batch013-gB.json`. The M5 corpus-consistency edit flipped
`classification` to `coordination-risk` on `64-218-235-2004` and `64-232-561-2004` and appended the
unified-rubric sentence — but **left the reasoning's own verdict sentence untouched**:

- `64-218-235-2004` · field `"coordination-risk"` · reasoning ends: „…bez jakékoli adresní nebo
  textové interakce -- **klasifikováno jako incidental**. (Sjednocené pravidlo klasifikace: …)"
- `64-232-561-2004` · field `"coordination-risk"` · reasoning ends: „…bez textové nebo adresní
  interakce -- **incidental**. (Sjednocené pravidlo klasifikace: …)"

A machine reading the field and a human reading the prose get opposite answers, in a file this pass
republishes as corrected — and the appended rule refutes the prose it is appended to (both bodies
concede an operative instruction on each side, which the rule says is *at least* a coordination
risk). Found by scripted field-vs-prose comparison across all four collision files; **batch-014's own
six reclassified gA pairs are clean** — their reasoning was properly rewritten — so this is isolated
to the two batch-013 rows. Fix: rewrite the two concluding sentences. Counts are unaffected
(013 gB stated `{3, 5}` = computed ✓; 013 gA stated `{0, 8, 0}` = computed ✓).

### N2 (MAJOR) — the render-time gate does not cover `unstatedEffects[].evidence`, the field the new rule was written for

`features/lawwatch/getLawData.ts` `readForensic()`. Every reader string goes through `cz()` — which
applies `czechCopyOrNull` **and** `lawJargonIssues` — except one:

```ts
return [{ effect: cz(o.effect), whoBenefits: cz(o.whoBenefits), evidence: asStr(o.evidence) ?? "" }];
```

`evidence` bypasses both gates at render. `validateLawVerdict` **does** gate it (`readerFields`
includes `unstatedEffects[i].evidence`, line 217), so persist and render cover different field sets —
while the docstring above `LAW_PIPELINE_JARGON` states the opposite: *"the SAME rule runs at persist
time … and at render time … a gate that exists in one place only is a gate the other surface silently
lacks."* That is M8's own thesis, and the fix reproduces the flaw one field over.

It is not academic. `LAW_PIPELINE_JARGON` added a rule specifically for **cache file paths**
(„cite the psp.cz document URL instead", matching `.data/law-collision-cache` and `\.txt\b`), and
`evidence` is precisely the field whose house style is a document-and-line reference — the one place
a raw cache path is likely to have been written. Probe: the string
`"Text tisku 187, viz .data/law-collision-cache/tisk-187/270041.txt řádky 100–104."` TRIPs
`lawJargonIssues`, and at render today it would ship verbatim. All ten batch-014 verdicts pass the
persist gate, so **this batch leaks nothing**; the exposure is the pre-rule graph content from
batches 001–013, which is exactly the population the render side was added for (I did not open
PGlite, so the live extent is unmeasured). Fix: route `evidence` through `cz()` — and note that doing
so also makes it count toward `withheldFields`, so the disclosure stays honest.

## Still-open MINORs from the original audit (none blocking)

- **m1 · PARTIAL.** The law list now carries a bare `\bbatch\b` rule, so law prose is covered. But
  `lib/analysis/public-copy.ts` line 39 still reads `/\b(batch|dávka)\s*\d/i` — `"batch-011"` still
  tests **false** there, so the **effort** loop keeps the hyphen hole.
- **m3 · OPEN.** Both residues survive: Cyrillic „**ред**aktor" in `gB.pairs[13-145-84-2024]`, and
  English „**correctly**" in `gA.pairs[7-260-37-2021]` — the latter inside the very sentence the M6
  rewrite touched.
- **m4, m5, m6, m7, m8, m9, m10, m11 · OPEN**, not claimed fixed. `verdict-217` still renders
  „na základě **zákona o televizních a rozhlasových poplatcích**" where the source says only
  „na základě zákona" (m6).
- **New nit ·** `verdict-141.citations[0].claim` compresses the exclusion as if písm. f), g) **and h)**
  of odst. 2 each carried the „s výjimkou hlavního města Prahy" clause; only f) and g) do, and h)'s
  exclusion comes from odst. 13. The same sentence supplies odst. 13 as the ground and
  `researchedContext` states it precisely, so the claim is true as an effect — but the compression
  invites the reading I originally got wrong.
- **New nit ·** `fix-217-sponsors-014.ts` reads `listKgNodes({ kind: "bill" })` with no `limit`
  and filters by id in JS. It fails closed (a truncated read throws „not found" rather than writing),
  so it is safe — but a targeted read would be better per the repo's own `KG_READ_CAP` lesson.
- **m2 · CLOSED by design** — the law gate documents and skips the sample-scoped rule, citing
  verdict-257's „v této skupině pojištěnců" as the false positive. Probe-confirmed it does not trip.
  Note the skip is a **string match on the rule's `what` description** (`what.includes("sample-scoped")`);
  renaming that description in `public-copy.ts` would silently re-enable withholding of correct Czech.
  A shared exported constant would be sturdier than a substring.

## To clear the gate

Fix **N1** (two concluding sentences in `collision-close-reads-batch013-gB.json`) and **N2** (route
`evidence` through `cz()` in `getLawData.ts`). Both are one-touch and neither disturbs any verified
figure. No re-derivation of B1–B4 or M1–M8 is needed on the next pass — they are checked and closed;
only the two new defects and a regression sweep over whatever those edits touch.

---

# Final closure note

Narrow re-check of the four fixes to N1, N2 and the two m3 slips. Verified against the current
files; the fix report was again treated as a claim to test.

## VERDICT: **CLOSED** — pass 48 may proceed

All four fixes land clean, and the N2 change does not regress anything.

| fix | status | verification |
|---|---|---|
| **N1** · 013-gB verdict sentences | **CLOSED** | Both reasonings rewritten, not patched. `64-218-235-2004` now ends „…protože však obě strany nesou věcnou novelizační instrukci do téhož paragrafu, je pár podle sjednoceného pravidla klasifikován jako **koordinační riziko**"; `64-232-561-2004` the same. Scripted check: the token `incident` no longer occurs in **either** reasoning, so no prose verdict survives under the opposite label. The word „nahodilé" remains only inside the appended rubric sentence, where it defines the *other* class — correct, not residue. Counts unchanged and exact: stated `{confirmed-collision 3, coordination-risk 5}` = computed ✓. |
| **N2** · `evidence` through `cz()` | **CLOSED** | `features/lawwatch/getLawData.ts` line 261 now reads `evidence: cz(o.evidence) ?? ""`, with a comment naming the finding. Persist and render now cover the same field set, so the docstring's parity claim is true. |
| **m3a** · Cyrillic in 014-gB | **CLOSED** | „редaktor" → „redaktor" in `pairs[13-145-84-2024]`. Scan over both 014 collision files: **zero** Cyrillic codepoints remain. |
| **m3b** · English in 014-gA | **CLOSED** | „correctly" → „**správně**" in `pairs[7-260-37-2021]`. Scan: no `correctly`/`actually`/`however` remains in either file. |

## Regression probe on N2 — the fix does not withhold real evidence

Routing a field through a Czech-language gate is exactly the kind of change that can silently
delete correct content, and `evidence` is **a bare URL** in several verdicts (141 ×2, 222 ×2). I
probed `czechCopyOrNull` + `lawJargonIssues` on every real shape the field takes in this batch:

| value | result |
|---|---|
| `https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=141&ct1=0` (141, 222) | **ok** — not withheld |
| „Text tisku 187 na psp.cz, řádky 100–104 (…§ 63 odst. 3 a § 69e odst. 1…)" | **ok** |
| „úplný text tisku na psp.cz, řádky 38–43 a 452–496 strojového přepisu…" (25) | **ok** |
| „Text tisku 89 na psp.cz, řádky 63–70 … a 94–96." (89) | **ok** |
| „úplný text tisku na psp.cz, řádky 904–912 …" (234) | **ok** |
| „Text tisku 187, viz `.data/law-collision-cache/tisk-187/270041.txt` řádky 100–104." | **WITHHELD (jargon)** ✓ |

So the gate withholds precisely the shape it was written for and nothing else. The consumer is
safe either way: `BillDetail.tsx` line 468 renders the evidence link only under
`/^https?:\/\//.test(u.evidence)`, so a withheld value (`""`) drops the link rather than leaving a
dangling label, and `withheldFields` still counts it so the block discloses instead of quietly
shrinking.

## Batch-wide state at closure

- Verdict gates: **12/12 · 10/10 · 10/10 · 10/10** (batches 011–014).
- `npm run typecheck` clean; `vitest lib/analysis features/lawwatch` **319/319**.
- Collision counts recomputed once more, all four files: 014-gA stated `{2, 6}` = computed ✓;
  014-gB `{0, 7, 1}` = computed ✓; 013-gB `{3, 5}` = computed ✓; 013-gA `{0, 8, 0}` = computed ✓.
- Dependency triage: `{self_reference 26, companion_dependency 18, unclear 23}`, sum 67 = census ✓.

**Every BLOCKING and MAJOR finding of this audit (B1–B4, M1–M8, N1–N2) is closed and re-verified
from source.** The MINORs listed in the previous section remain open by decision, none of them
blocking: m1 is partial (the hyphen hole survives in `public-copy.ts` for the effort loop), and
m4–m11 were not claimed fixed.

## Two notes for the pass-48 operator (not gating)

1. **The store restore is outside this audit's scope and I did not verify it.** The overnight
   `.pglite` restore-and-replay of passes 43–47 was reported, not checked here — my constraints
   exclude opening PGlite, so nothing in this document attests to the store's current contents,
   the replay's fidelity, or the probe figures (59 forensic bills, provenance [12/15/18/20/45/47],
   293 laws, 582 amends). Treat that as unaudited. The reported behaviour — the write gate
   rejecting a stale-text entry from an outdated combined file until it was regenerated from
   current files — is the persist gate doing its job, and is consistent with M8's design.
2. **`fix-217-sponsors-014.ts` is safe across the restore.** Its `EXPECT` guard requires the live
   sponsor set to be exactly `[6623, 6500, 6487, 6743, 7041]` and **throws** otherwise, before any
   write. If the restore left tisk 217 uncorrected (as reported), the guard passes and the script
   drops 6743; if the restore changed anything, the script refuses rather than writing a wrong
   set. Either way it fails closed — no verification of the live state is needed before running it.
