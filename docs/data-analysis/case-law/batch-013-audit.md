# Batch 013 — adversarial audit (independent, pre-persist)

**Auditor:** fresh session, no prior involvement in batch 013. No verdict or close-read file was
edited; no git operation; no PGlite read. All source verification was done against the cached
bill texts in `.data/law-collision-cache/` (NFC-normalized before matching) and against live
primary sources (ARES VR, psp.cz, sompo.cz) fetched during this audit on 2026-08-04.

---

## VERDICT: **NOT READY**

Four BLOCKING defects. Three of them are in the two most consequential MEDIUM verdicts (90, 206)
and go to the load-bearing claim of each — in both cases the bill's own důvodová zpráva says the
opposite of what the verdict asserts, in the very passage the verdict claims to have read. The
fourth is a person-level misattribution in **already-persisted** batch-012 verdicts (69, 56) that
this batch's own SOMPO work surfaced but did not chase to ground.

Nine MAJOR and eight MINOR findings follow. The collision close-reads (Priority 5) are **clean** —
all four spot-checked pairs verify verbatim, and both files' `classificationCounts` match their
`pairs` arrays exactly.

Scope of what was verified positively is listed in §6 so remediation does not re-litigate it.

---

## 1. BLOCKING

### B1 — `verdicts-013/verdict-90.json` · "schvalovací pravomoc" is false; the DZ says the opposite

**Fields:** `statedReasoning`; `unstatedEffects[0].effect`; `citations[2].claim`.

The verdict asserts three times that the bill moves an **approval power** ("schvalovací pravomoc" /
"schvalovací a projednávací pravomoc") over the pololetní and čtvrtletní zprávy from the Sněmovna
plenary to the rozpočtový výbor. The Sněmovna has no approval power over these materials, and the
bill's own důvodová zpráva says so twice, in the passages justifying the very amendment points the
verdict cites:

- `tisk-90/267105.txt` **L2366–2367** (K bodům 12 a 14, § 20 odst. 1 a 2):
  „Poslanecká sněmovna navíc **bere materiál pouze na vědomí, neschvaluje svým usnesením** jako
  například u státního závěrečného účtu žádné parametry hospodaření státního rozpočtu."
- `tisk-90/267105.txt` **L2395–2396** (K bodu 13):
  „Rozpočtový výbor Poslanecké sněmovny svým usnesením **neschvaloval** v materiálech žádné
  parametry hospodaření státního rozpočtu, **nýbrž je bral pouze na vědomí**."

The bill's operative text agrees: new § 20 odst. 2 (bod 14, L127) reads „Zprávu podle odstavce 1
poté, kdy ji rozpočtový výbor Poslanecké sněmovny **vezme na vědomí**, ministerstvo uveřejní…".

Calling a *bere na vědomí* an *approval* inflates the constitutional weight of the effect, and it is
the load-bearing half of this verdict's MEDIUM. The narrower true finding — that the last body to
formally deal with the material is now a committee rather than the floor, so fewer MPs encounter it
in a formal proceeding — survives, but only in corrected form.

### B2 — `verdicts-013/verdict-90.json` · the čtvrtletní zpráva is not relocated; it is abolished

**Fields:** `statedReasoning`; `unstatedEffects[0].effect`; `citations[2].claim` (all say the
čtvrtletní zpráva moves „z pléna Poslanecké sněmovny na její rozpočtový výbor").

Both halves are false, per `tisk-90/267105.txt` **L2377–2396** (K bodu 13, § 20 odst. 2):

- It was never on the plenary: „Čtvrtletní informace o plnění státního rozpočtu jsou **do této doby
  předkládány rozpočtovému výboru** Poslanecké sněmovny…" (L2378–2379).
- It is not relocated, it is **deleted**: the operative instruction is bod 13, „V § 20 se odstavec 2
  **zrušuje**" (L123), and the DZ calls it exactly that — „Dalším důvodem pro **zrušení** těchto
  materiálů nelegislativní povahy…" (L2385). The stated substitute is not a committee but MF press
  releases: „tiskové zprávy o plnění státního rozpočtu zveřejňované Ministerstvem financí každý
  měsíc se jeví jako dostatečná náhrada za čtvrtletní informace" (L2381–2383).

Note the cost of the error: a *statutory quarterly reporting duty toward Parliament is repealed and
replaced by a ministry's own voluntary press releases* is a stronger and fully evidenced unstated
effect than the one the verdict wrote. It was traded away for a false one.

### B3 — `verdicts-013/verdict-206.json` · the ÚOHS kauce did not move "z paušální částky" to 1 %

**Fields:** `researchedContext` („místo dosavadní paušální částky"); `unstatedEffects[0].effect`
(„přechodu kauce u ÚOHS z paušální částky na 1 % z předpokládané hodnoty zakázky (až 10 000 000 Kč)
zvyšuje finanční bariéru… kde je nová kauce **řádově vyšší než dosavadní paušál**").

`tisk-206/271159.txt` **L976–988** (K bodům 14 a 15 – k § 255 odst. 1) contradicts every element:

> „Nově se stanovuje, že **v případě, kdy nelze určit celkovou nabídkovou cenu**, vychází se pro
> určení výše kauce z předpokládané hodnoty… Výše kauce má poté činit 1 % z této předpokládané
> hodnoty, nejméně však 50 000 Kč a nejvýše 10 000 000 Kč. **Stanovené limity odpovídají limitům pro
> stanovení kauce v případech, kdy byla nabídka podána**… Kauce při podání návrhu by tak měla být
> **srovnatelná**… Teprve v případě, kdy předpokládaná hodnota veřejné zakázky nebyla uveřejněna,
> stanovuje se výše kauce pevnou částkou, a to ve výši 100 000 Kč."

Confirmed independently at **L665–669**: „Také při podání návrhu k přezkoumání úkonu zadavatele
v řízení před ÚOHS… je skládaná kauce **zpravidla ve výši 1 % z nabídkové ceny** navrhovatele, vždy
však v minimální výši 50 000 Kč. **Minimální výše kauce 50 000 Kč vychází z dosavadní právní
úpravy**."

So: (a) § 255 odst. 1 already prescribed 1 %, not a flat sum; (b) bod 14 is a **fallback base** for
the case where no bid price exists — typically a challenge to the tender conditions; (c) the
50 000 / 10 000 000 limits are **not new**; (d) the 100 000 Kč flat sum survives as the residual
case; (e) against that residual flat sum a 1 % kauce on a smaller contract is *lower*, floored at
50 000 Kč — the opposite direction from the one asserted.

The verdict contradicts itself: `statedReasoning` pillar (4) correctly places the 1 % / flat-100 000
change on the **court kauce for a předběžné opatření** (the true location — L565–569), while
`researchedContext` and the sole `unstatedEffects` entry relocate it to the ÚOHS kauce. This is the
verdict's only unstated effect and roughly half of its MEDIUM. The court-fee half (3 000 → 50 000 Kč)
is sound and independently verified (L271–279 the new písmeno d), L564 and L661–662 the DZ) — the
MEDIUM may well be re-earnable on that half alone, but not on what is written.

### B4 — persisted batch-012 verdicts 69 and 56 attribute **Tomáš Kocour's registry record to Lukáš Vlček**

**Files:** `payloads/verdicts-012/verdict-69.json`, `payloads/verdicts-012/verdict-56.json`
(pass 45, already persisted). **Fields:** `conflictAssessment` (both) and the identically-worded
`kind: "web"` citation in both:

> „Lukáš Vlček je podle veřejného rejstříku (ARES VR) předsedou představenstva SOMPO, a.s. **od
> 3. 12. 2024 (vznik funkce 2024-12-03, bez zapsaného zániku)**"

I fetched the exact URL those citations name
(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/25172263`, raw JSON,
2026-08-04) and parsed every `fyzickaOsoba` in the record. The two relevant angažmá:

```json
{"datumZapisu":"2023-10-16","datumVymazu":"2025-02-04","typAngazma":"STATUTARNI_ORGAN_CLEN",
 "clenstvi":{"clenstvi":{"vznikClenstvi":"2015-12-17","zanikClenstvi":"2024-10-31"},
 "funkce":{"vznikFunkce":"2020-02-27","zanikFunkce":"2024-10-31","nazev":"předseda představenstva"}},
 "fyzickaOsoba":{"datumNarozeni":"1982-02-27","jmeno":"LUKÁŠ","prijmeni":"VLČEK"}}

{"datumZapisu":"2025-02-04","typAngazma":"STATUTARNI_ORGAN_CLEN",
 "clenstvi":{"clenstvi":{"vznikClenstvi":"2024-12-03"},
 "funkce":{"vznikFunkce":"2024-12-03","nazev":"předseda představenstva"}},
 "fyzickaOsoba":{"datumNarozeni":"1974-10-17","jmeno":"TOMÁŠ","prijmeni":"KOCOUR"}}
```

`2024-12-03` with no `zanikFunkce` is **Kocour's** record (born 1974-10-17), not Vlček's (born
1982-02-27). Vlček's chairmanship **ended 2024-10-31** and was struck from the register on
2025-02-04. The batch-012 agent read the adjacent `fyzickaOsoba` block. Both verdicts additionally
state the role in the present tense in prose („zastává funkci předsedy představenstva od 3. 12.
2024").

This is a false, dated, present-tense registry claim about a named living person who is a sitting
Minister of Industry, attached to a company carrying 9 174 258 Kč of public contracts, published
under an explicit citation of a primary register that says otherwise. It is the highest-severity
class this project defines and it is live on the product now.

---

## 2. THE SOMPO SOURCE CONFLICT — decided

**There is no source conflict.** The two sources agree; batch-012's reading of ARES was wrong.

| | ARES VR (fetched 2026-08-04, raw JSON) | sompo.cz `/sompo/vedeni-spolecnosti/` (fetched 2026-08-04) |
|---|---|---|
| chair now | Tomáš Kocour, od 2024-12-03, no zánik | Tomáš Kocour – „předseda" |
| Vlček | člen 2015-12-17 → **2024-10-31**; předseda 2020-02-27 → **2024-10-31**; vymaz 2025-02-04 | absent from představenstvo and dozorčí rada |

The registry additionally records Vlček as místopředseda 2006-12-21 → 2010-12-21 and 2010-12-21 →
2015-12-17, and as místopředseda 2015-12-22 → 2020-02-27. The "resignation not yet propagated"
hypothesis is unnecessary: the resignation *was* propagated, on 2025-02-04, and the change predates
his appointment as minister.

**The honest public sentence** (recommended verbatim wording for both surfaces):

> Podle veřejného rejstříku (ARES VR, ověřeno 4. 8. 2026) byl Lukáš Vlček předsedou představenstva
> SOMPO, a.s. od 27. 2. 2020; členství i funkce zanikly **31. 10. 2024** a záznam byl z rejstříku
> vymazán 4. 2. 2025. Od 3. 12. 2024 je předsedou představenstva Tomáš Kocour, což potvrzuje
> i vlastní stránka společnosti. Peněžní vazba evidovaná v grafu je souhrn veřejných zakázek firmy,
> nikoli příjem poslance, a **čeká na lidskou kontrolu**.

### (a) Does `verdict-206` handle it right? — **Partly. MAJOR, not blocking.**

Credit where due: verdict-206 is the only file in the batch that noticed the discrepancy at all, it
names its source and its date („ověřeno na oficiální stránce společnosti, srpen 2026"), and it does
not resolve the ambiguity in the direction that would help its own narrative.

But it leaves resolvable as unresolved, and it does so by reaching for the wrong source. Its
`conflictAssessment` concludes „aktuálnost tohoto tvrzení k srpnu 2026 tedy nelze bez dalšího
potvrdit jako platnou", resting the competing claim on **Wikipedia** (`citations[7]`, „od roku 2006
… místopředseda … bez uvedeného konce funkce"). The primary register settles it outright, is one
HTTP GET away, is already cited by two sibling verdicts in the corpus, and *contains an explicit
`zanikFunkce`*. Citing an encyclopedia for a registry fact when the registry is available — and then
declaring the question open — is a research failure, not a hedge. The Wikipedia citation should be
dropped and replaced with the ARES VR record and the dates above.

### (b) Do the persisted 69/56 need a corrective note? — **Yes, and a note is not enough.**

A `forensic_correction` note appended beside a sentence that still reads „zastává funkci předsedy
představenstva od 3. 12. 2024" leaves the false claim rendering. Recommended, concretely:

1. **Rewrite the sentence, do not annotate it.** In both `verdict-69` and `verdict-56`, replace the
   `conflictAssessment` clause and the identical `kind:"web"` citation with the §2 sentence above.
   The surrounding municipal/SOE reasoning is unaffected and correct — the tie is still worth naming
   and is still not a conflict — so nothing else in either verdict changes.
2. **Carry a dated correction record**, in the batch-014 payload and in `graph-log.md`: what was
   claimed, what the register says, when it was checked, and that the error was a misread of an
   adjacent person's record in the same JSON document. The lesson generalizes past this row.
3. **Re-run the ARES read for every `kind:"web"` ARES-VR citation in the persisted corpus.** This
   defect class — picking the wrong `fyzickaOsoba` out of a full-history VR document — is invisible
   to every gate the project owns, produces a plausible-looking dated claim, and was reproduced
   *twice* by the same agent in batch-012 ("fetched twice independently" is not independent
   corroboration when both fetches run the same parse).
4. **Add a mechanical check** to the verdict gate: a registry-role claim must carry both a `vznik`
   and either a `zánik` or an explicit assertion of `bez zapsaného zániku` that is re-derivable from
   the cited record. The current gate (`lib/analysis/law-verdict.ts`) validates statute refs, graph
   ids and language — it has nothing that could have caught this.

---

## 3. MAJOR

**M1 — `verdict-206.json` · `researchedContext` · wrong § for panel decisions.**
„zavádí kolektivní rozhodování formou komise (**§ 1a** novelizovaného zákona č. 273/1996 Sb.)".
The komise provision is **§ 2a**: `tisk-206/271159.txt` L364 „5. Za § 2 se vkládá nový § 2a, který
zní:" → L367 „(1) Úřad rozhoduje v řízeních o přezkoumání úkonů zadavatele v komisích…". § 1a is a
different provision — the místopředseda pro veřejné zakázky (L314, L318). This is precisely the
batch-012 §-citation failure class recurring.

**M2 — `verdict-206.json` · `statedReasoning` · law count overstated.**
„mění zákon č. 134/2016 Sb. … **a dalších 7 předpisů**" (⇒ 8 laws). The bill has six parts and
five of them amend a law: ČÁST PRVNÍ 134/2016 (L14), DRUHÁ 549/1991 (L265), TŘETÍ 166/1993 (L283),
ČTVRTÁ 273/1996 (L300), PÁTÁ o veřejných službách v přepravě cestujících (L413); ČÁST ŠESTÁ is
ÚČINNOST (L436–440) and the DZ begins at L443. Correct figure: **four further laws**. The verdict
also never mentions that 166/1993 (NKÚ) is among them.

**M3 — `verdict-174.json` · `statedReasoning` · the 5→10 let change is misdescribed as a limitation period.**
„prodloužení **promlčecí/prekluzivní lhůty** z 5 na 10 let (§ 27 a § 27a)". It is the maximum
duration of the administrative **trest zákazu chovu**: `tisk-174/269592.txt` L338–339 „uložit trest
zákazu chovu až na dobu 5 let. Nově se stanoví možnost uložit trest zákazu chovu až na dobu 10 let";
L780–785 (K bodům 6 a 8) „Cílem změny § 27 odst. 13 a § 27a odst. 20 … je zpřísnění … zákazu chovu";
platné znění L1612 „chovu zvířat na dobu až ~~5 let~~ 10 let." A ban on keeping animals and a
limitation period are not the same legal object, and the substitution changes what the bill does.
(The `researchedContext` version — „změna lhůty „5 let" na „10 let"" — is merely bare and survives.)

**M4 — `verdict-62.json` · `conflictAssessment` · SOMPO called an insurance company.**
„…(jde o **pojišťovnu**, vodárenské družstvo, inženýrskou firmu, spolky a společenství vlastníků
jednotek)". The six enumerated ties map that description onto SOMPO, a.s., which is a municipal
**waste-management** company (NACE 38) — as `verdict-69`, `verdict-56`, `verdict-205` and
`verdict-206` all correctly state within the same corpus. A false sector attribution to a named real
company in reader-facing Czech copy; it also hollows out the sector-adjacency reasoning that rests
on it.

**M5 — money rule · CZK figures rendered without a `pending_review` marker (4 of 10 verdicts).**
The house sentence is batch-012's „(úhrn veřejných smluv firmy, **vazba čeká na lidskou kontrolu**)".
`verdict-53`, `verdict-62` and `verdict-109` carry it. These do not, in either the
`conflictAssessment` prose or the `graph_fact` citations:

| file | CZK in `conflictAssessment` | `graph_fact` citations with CZK | marker anywhere |
|---|---|---|---|
| `verdict-73.json` | „řádově miliardy Kč" | 24 673 935 464 / 2 981 571 045 / 88 987 670 810 Kč | **none** |
| `verdict-174.json` | 20 857 960 Kč | 254 454 304 / 53 271 958 488 / 177 151 008 Kč | **none** |
| `verdict-205.json` | 9 174 258 / 1 234 888 / 2 008 259 / 200 000 Kč | 200 000 / 9 174 258 / 1 234 888 Kč | **none** |
| `verdict-206.json` | 9 174 258 / 1 234 888 / 200 000 Kč | 9 174 258 / 1 234 888 / 200 000 Kč | **none** |

The aggregate half of the rule *is* met everywhere („v souhrnné výši … smluvního plnění"). It is the
gate label that is missing — and these are the four verdicts that attach the largest sums to named
MPs, including 88,99 mld Kč beside Petr Hladík's name.

**M6 — internal pipeline tokens in reader-facing prose (9 of 10 verdicts), unscreened by the gate.**
`forensic_stated_reasoning` / `_researched_context` / `_conflict_assessment` are rendered to the
public by `features/lawwatch/getLawData.ts` (per `handoff.md` §1). They currently contain:

- `sectorAdjacency: false`, `attributedSectorLeads: []`, „moneyTies je prázdné pole" — 53, 68, 90
- `(mp_group)` as a suffix on a list of MP names — 73, 174, 205, 206
- raw `pending_review` — 53, 62, 109
- cache file paths, e.g. „Text v cache (`.data/law-collision-cache/tisk-206/271159.txt`)" — 73, 174,
  205, 206
- `psp:person:6789`, `(psp:person:6205)` — 62, 109
- „**Batch-004** zjistil grep-verifikovaný střet" — 140; „**batch** neeviduje žádný sector lead" — 62

`lib/analysis/public-copy.ts` exists for exactly this failure („pipeline jargon inside true
sentences") and is **not imported** by `lib/analysis/law-verdict.ts` or
`scripts/case-loops/law/gate-verdicts.ts` (grep: no hits) — so none of this is blocked at persist
time. Recommend wiring it in before batch-013 is written, not after.

**M7 — `verdict-206.json` · Wikipedia cited for a registry fact that the register resolves.**
See §2(a). `citations[7]` should be replaced by the ARES VR record.

**M8 — `verdict-90.json` · `unstatedEffects[0].evidence` cites „§ 24 odst. 6" without disclosing that the provision was renumbered under it.**
Bod **20** deletes the existing § 24 odst. 6 (DZ L2496–2510: „navrhuje se zrušení § 24 odst. 6") and
bod **21** then edits the *newly renumbered* odst. 6 (formerly odst. 7 — L182, and DZ L2512 „K bodu
21 (nově označený § 24 odst. 6)"). The verdict cites bod 21 and „§ 24 odst. 6" as if they were the
pre-existing provision. The substance of the finding (an information duty toward the Sněmovna
becomes one toward the výbor — L184–185) holds; the citation as written points a reader at the wrong
text.

**M9 — `verdict-62.json` · uncited role attribution driving the entire conflict section.**
„osobou uvedenou u tisku jako **zpravodaj/garant v hospodářském výboru** je poslanec Lukáš Vlček
(psp:person:6789)". No citation in the file supports this (there is no `web` citation and the
`historie.sqw` pattern used by `verdict-205` is absent). It is the sole reason Vlček's six money
ties are discussed in this verdict at all.

---

## 4. MINOR

- **`verdict-62.json`** — the annex-scope finding says „jedenáct kategorií" and the annex itself does
  have 11 numbered items (`tisk-62/266120.txt` L272–290, verified item by item against the verdict's
  enumeration). But the bill's own DZ says „V současné době příloha č. 1 návrhu zákona obsahuje **10
  kategorií** výrobků" (L1881). A verdict whose central finding *is* the narrowness of the scope
  should disclose that the source contradicts itself about how narrow.
- **`verdict-90.json`** — „36 z 42 novelizačních instrukcí tisku 68" is correctly attributed
  („dřívější deterministická textová kolace") and is faithful to
  `payloads/batch-009-duplicate-bills.json` (`instructionsA: 42, shared: 36`). But 42 is that
  matcher's scope (numbered `N. V § …` strings only), not the bill's instruction count: čl. I alone
  carries **68** numbered points, which is what `verdict-68.json` states in the same batch. A reader
  who opens both prints sees 42 and 68 for the same bill. One clause of disclosure fixes it.
- **`verdict-206.json`** — „Novela dále ruší rozkladové řízení (druhý stupeň)" is unscoped; the new
  § 257a (bod 23, L146–155) excludes rozklad only „v řízení o přezkoumání úkonů zadavatele"
  (confirmed L514–515). The DZ is equally loose, so this is presentational.
- **`verdict-206.json`** — the court fee is described as an increase „z 3 000 Kč na 50 000 Kč";
  mechanically the bill **inserts a new písmeno d)** into položka 18 bodu 2 (L271–281) rather than
  editing a 3 000 figure. The 3 000 baseline is the DZ's own comparison (L564, L661–662), so the
  claim is sourced — it is the mechanism that is misdescribed.
- **`verdict-140.json`** and **`verdict-62.json`** — `unstatedEffects[0].evidence` is a bare psp.cz
  URL. Every other verdict in the batch quotes the operative text or the DZ in that field. The
  claims themselves verify (see §6), but the field carries no evidence.
- **`verdict-62.json`** — `unstatedEffects[0].whoBenefits` asserts a beneficiary („výrobci výrobků
  mimo přílohu č. 1, kteří touto novelou nezískávají žádnou novou právní povinnost opravy") for an
  unenacted effect, where eight of the ten verdicts use „Nelze jednoznačně určit —". No identifiable
  person or company is named, so this is a house-consistency point rather than a rule breach, but it
  is the loosest whoBenefits in the batch.
- **`verdict-140.json`** — „tisk 140 zachovává hl. m. Prahu ve stejném výpočtovém poolu" is accurate
  for the § 3 odst. 2 criteria, but both bills share an identical Prague carve-out in § 3 odst. 6
  (140 L74–79 ≡ 141 L74–79, pre-school and compulsory-schooling pupils excluded for Prague). Worth a
  half-sentence so the contrast is not read as "141 touches Prague, 140 does not".
- **`verdict-205.json`** vs **`verdict-206.json`** — the same Rakušan tie is named „SVJ Rimavské
  Soboty Kolín" in one and „SVJ Kolín" in the other. Cosmetic; flagged only because both render.

---

## 5. Collision close-reads (Priority 5) — **clean**

`classificationCounts` reconcile exactly against the `pairs` arrays in **both** files:

- `collision-close-reads-batch013-gA.json` — declared `{confirmed-collision: 0, coordination-risk: 8,
  incidental: 0}`; actual tally over 8 pairs identical.
- `collision-close-reads-batch013-gB.json` — declared `{confirmed-collision: 3, coordination-risk: 3,
  incidental: 2}`; actual tally over 8 pairs identical.

Four pairs spot-checked, quoted spans NFC-verified against the caches:

| pair | quoted span | verified |
|---|---|---|
| `56-67-283-2021` | tisk 56 bod 1 ≡ tisk 67 bod 318 | `tisk-56/266014.txt` L289–290 and `tisk-67/266188.txt` L1717–1718 — byte-identical after whitespace collapse. Both sit in a stavební-zákon (283/2021) article: tisk 56 ČÁST PÁTÁ / Čl. VI (L280–287). The "sousední bod 317 mění odst. 2" aside is correct (L1714–1715), and 43 ČÁST headers in tisk 67 are consistent with the stated 42 amended laws. Classification sound. |
| `64-65-365-2000` | tisk 64 čl. LXVI § 2 odst. 2 písm. f); tisk 65 bod 4 | `tisk-64/266153.txt` L7335 and `tisk-65/266164.txt` L373–375 verbatim. tisk 65's ČÁST PÁTÁ / Čl. V is indeed 365/2000 (L340–355). The renumbering logic checks out: e)→c), f)→d), g)→e), so písm. f) ceases to exist and tisk 64's address is destroyed; tisk 65's own bod 5 (L378) already operates in the renumbered space. `confirmed-collision` earned. |
| `24-68-262-2006` | tisk 24 body 2–3; tisk 68 Čl. IX | `tisk-24/265302.txt` L453–457 and `tisk-68/266205.txt` L756–760 verbatim. Reasoning correct: tisk 68 targets písm. b), outside the e)→f) insertion and the f)/g)→g)/h) renumbering. `coordination-risk` earned. |
| `24-90-262-2006` (twin) | byte-identity claim between tisk 68 and tisk 90 | **Verified.** `tisk-90/267105.txt` L502–512 (ČÁST ŠESTÁ / Čl. IX) vs `tisk-68/266205.txt` L753–760 — same instruction, same inserted text „20. Úřadu Národní rozpočtové rady,", and both are followed by a Čl. X přechodné ustanovení about § 303 odst. 3 a 4 (90: L514; 68: L762–768), exactly as the close-read claims. The 68⊂90 family note is honest and is disclosed on both twins rather than on one. |

No defect found in the close-reads.

---

## 6. Verified sound — do not re-litigate

Recorded so remediation is scoped and a closure check does not repeat this work.

**`verdict-53.json` — fully verified, its central finding stands.** § 2174a occurs at
`tisk-53/265983.txt` L171 (bod 18) and L203 (bod 29) plus two DZ lines (L2249, L2308), and **nowhere**
in čl. II — which is confirmed to contain exactly **18** numbered points (L292 → bod 18 at L435), none
of them touching § 2174a. Čl. I contains exactly **45** points. Both novelizační věty do end on an
unassigned number: „zákona č. **…/2025 Sb.**, se mění takto:" (čl. I L33, čl. II L300). The
`conflictAssessment` aggregate „do cca 12,4 mil. Kč" reconciles (9 174 258 + 1 234 888 + 2 008 259 =
12 417 405) and is correctly labelled aggregate + `pending_review`.

**`verdict-140.json` — central claim verified.** tisk 141 bod 1 is „V § 3 odst. 1 písm. b) až g) se
číslo „10,23" nahrazuje číslem „10,97"" (`tisk-141/268738.txt` L26); tisk 140 does **not** touch § 3
odst. 1 (its bod 1 opens at § 3 odst. 2, `tisk-140/268733.txt` L27) and its platné znění still reads
10,23 % throughout (`268735.txt` L12–28). tisk 141 excludes Prague from the population and
obce/rozloha criteria (L53, L57); tisk 140's equivalents do not (L54, L56). Both rewrite § 3 odst.
2–6. The DZ sentence behind `citations[2]` exists (L417).

**`verdict-90.json` — everything except B1/B2/M8.** Hlava VIII / § 31 / § 32 verified (bod 25,
L194–223); the 10 % ceiling verified (L208); the Bezpečnostní rada státu route verified (L204–206),
and the DZ itself concedes it operates before any formal declaration — „…ale ještě nedošlo
k vyhlášení stavu ohrožení státu nebo válečného stavu" (L2589–2591), which makes the second unstated
effect well-earned and properly hedged. „9 zákonů" verified (nine of eleven parts amend a law; ČÁST
DESÁTÁ is zrušovací, JEDENÁCTÁ účinnost). „41 bodů čl. II" verified exactly (points 1–41, none
missing; corroborated by the účinnost clause at L1225). The 166/1993 § 5 odst. 2 shift verified (čl.
I bod 1, L24–25). The 68⊂90 containment statements verified: tisk 68 čl. III amends 218/2000 in
exactly one provision, § 8 odst. 2 (L557–568), and tisk 90 čl. II bod 2 carries the identical text
(L62–69).

**`verdict-73.json` — evidence sound; the medium is earned.** All three quoted spans are exact and
correctly attributed to their DZ parts (part G) runs L2144–2264, part I) L2326–2339): the waste-company
sentence at L2234, the handling-fee sentence at L2243–2248, and the corruption-risk sentence
„korupční rizika spojená s nastavením poplatků výrobcům" at part I). **The no-floor claim holds
structurally**: „manipulační poplatek" / „handling fee" appears only at L1892, L1893, L2248 and
L2354 — all inside the důvodová zpráva, which begins at L1554. The operative text contains no
mention of it at all, so there is no statutory floor, no methodology and no transparency duty, in
direct contrast to the published sazebníky the same bill requires toward výrobci. Figures verified:
5,6 mld (L2244), 1,8 mld (L2245), 39 Kč (L2178), 15 % (L2177), 11 000 (L2243), 3 mld (L1629), 50 m²
(L1446), 500 m (L1905), 77 %/90 % per § 10 odst. 5 (L2558), nová hlava § 29a (L187). **The SAKO
framing is correct and is a steward disposal, not an accusation** — it names an economic effect that
runs *against* the tied institution (SAKO loses PET/aluminium resale revenue by the DZ's own
admission), explicitly denies a personal conflict, states the roles are municipal/institutional, and
concedes that current 2026 engagement was not independently verified. Hladík's stated dates check out
against the public record (minister 2023-03-10 → 2025-12-15; 1. náměstek do 2022).

**`verdict-174.json` — everything except M3.** The fine changes are stated with unusual precision and
verify exactly: § 27 odst. 14 new sentence „vyšší než 5 000 Kč" and 5 000 → 10 000 Kč (L69–70);
§ 27a odst. 21 „vyšší než 10 000 Kč" and 10 000 → 20 000 Kč (L75–76). § 13b odst. 3 verified (bod 4,
L49; quoted text L53, L56–57), including „samostatné působnosti" (L474) and the cost-unpredictability
quote (L477, L521). § 40 odst. 2 písm. c) + „obydlí" verified (L178–179). § 1048 odst. 2 verified
(L185).

**`verdict-62.json` — annex verified.** All eleven categories in příloha č. 1 (L272–290) match the
verdict's enumeration item for item; § 8 odst. 1 „na žádost spotřebitele může opravář poskytnout"
verified (L111); the 5 000 000 Kč penalty (L216) and the 31 July 2026 effective date (L261) verified.

**`verdict-68.json`.** „68 bodech čl. I" verified exactly (points 1–68). „sedm navazujících zákonů
(218/2000, 243/2000, 250/2000, 159/2006, 262/2006, 222/2016, 177/2023)" matches the bill's own DZ
list verbatim (L1315–1323). Empty `unstatedEffects` with `severity: low` is honest, not a gap.

**Statutes.** Every statute cited across the ten verdicts is a real Czech law and is correctly
numbered. No fabricated citation found.

**Hedges.** Every `whoBenefits` except `verdict-62`'s and `verdict-109`'s opens „Nelze jednoznačně
určit —"; no verdict names an identifiable person or company as the beneficiary of an unenacted
effect. `verdict-90`, `verdict-73` and `verdict-206` each explicitly disclaim a conflict of interest
rather than implying one. No completeness overclaim found — `verdict-90` and `verdict-73` both scope
their DZ-silence claims to a named part of the důvodová zpráva. Czech register holds throughout;
the only non-Czech strings are the internal tokens under M6 and „handling fee", which the source
itself uses as a term of art.

**Sponsor attributions spot-checked against psp.cz.** tisk 206 is a poslanecký návrh by Rakušan,
Dvořák and Vlček, předložen 2026-05-27 (`historie.sqw?o=10&t=206`) ✓. tisk 90 is a vládní návrh,
předložen 2026-01-27, zástupce navrhovatele min. financí — consistent with Schillerová ✓. tisk 68,
předložen 2025-12-12, three days before the change of government — consistent with Stanjura ✓.

---

## 7. Remediation checklist

**Before anything is persisted:**

1. `verdict-90` — rewrite the first unstated effect: drop "schvalovací", state the pololetní zpráva
   moves plenary → committee as the last body to *take note*, and replace the čtvrtletní claim with
   the abolition of § 20 odst. 2 (bod 13) and its replacement by MF press releases. Fix
   `citations[2].claim` to match. Re-assess whether MEDIUM survives on the corrected first effect
   plus the (intact) Hlava VIII effect — my reading is that it does, on the second effect alone.
2. `verdict-206` — rewrite `researchedContext` and the sole unstated effect so the 1 % / flat-100 000
   change sits where the bill puts it (the court kauce for a předběžné opatření) and the § 255 change
   is described as a fallback base with unchanged limits. Fix § 1a → § 2a. Fix "dalších 7 předpisů" →
   four further laws, and name 166/1993. Replace the Wikipedia citation with the ARES VR record and
   the §2 sentence. Re-assess MEDIUM on the court-fee half.
3. `verdict-174` — replace "promlčecí/prekluzivní lhůty" with the trest zákazu chovu.
4. `verdict-62` — SOMPO is a municipal waste company, not a pojišťovna. Cite or drop the rapporteur
   role. Disclose the annex-vs-DZ 11/10 discrepancy.
5. All ten — add the `pending_review` marker to every CZK figure (M5) and strip the pipeline tokens
   (M6); wire `public-copy.ts` into `law-verdict.ts` so the next batch cannot reintroduce either.

**Separately, and not gated on batch 013:** the persisted `verdict-69` / `verdict-56` correction and
the ARES-VR re-read described in §2(b).

**On the batch-011/012 pattern.** In both prior batches, author remediation introduced new defects
that a closure check caught. Five of the six remediation items above are *rewrites of load-bearing
sentences in MEDIUM verdicts*, which is the highest-risk edit this loop performs. Recommend the
closure check re-derive B1–B3 from the cached text rather than reading the corrected prose — the DZ
line numbers in §1 are sufficient for that and are stable.

---

# Closure check (post-fix)

Re-verified against the **current files on disk** (mtimes 18:58–19:09, 2026-08-04), not against the
remediation account. Sources re-derived independently: the cached bill texts, `git diff` on the swept
files, the ARES VR raw JSON, the platné znění attached to tisk 206, and the operative text of
§ 5 zákona č. 166/1993 Sb. Files were read only; nothing was edited.

## Result: **REOPENED**

Eleven of the fourteen B/M findings are **CLOSED**, several better than I asked for. But the batch
cannot persist yet:

- **B3 REOPENED** — the kauce rebuild replaced an overstatement with a mirror-image understatement
  that is false in the opposite direction, and it deletes a real finding.
- **M6 REOPENED (partial)** — the new gate does not cover two of the three token classes M6 named, so
  the "011 12/12, 012 10/10, 013 10/10" pass is a pass on a check that cannot see the defect;
  **12 occurrences survive across 10 files**.
- **N1 (new, MAJOR)** — a §-citation error in `verdict-90` that both the original and the rebuild
  carry, and that I did not close out in round 1. Recorded as my own miss, not as a regression.

## Per-finding

| # | status | evidence |
|---|---|---|
| **B1** schvalovací pravomoc (90) | **CLOSED** | `statedReasoning` now leads with the DZ's own sentence („Poslanecká sněmovna dosud … pouze brala na vědomí a svým usnesením v nich neschvalovala žádné parametry hospodaření"); `unstatedEffects[1].effect` states it outright — „nejde tedy o přesun schvalovací pravomoci"; `citations[2]` rewritten to match. No approval claim remains anywhere in the file. |
| **B2** čtvrtletní zpráva (90) | **CLOSED** | `unstatedEffects[0]` rebuilt on the true finding and is now the strongest effect in the batch: bod 13 ruší § 20 odst. 2, the duty „dosud směřovala výhradně k rozpočtovému výboru … nikoli k plénu", replaced by MF press releases, framed as „zrušení zákonem uložené informační povinnosti vůči Parlamentu a její nahrazení nezávaznou komunikací vlastního předkladatele". Re-verified against L123 (bod 13) and L2377–2396 (DZ). |
| **B3** ÚOHS kauce (206) | **REOPENED** | see §C1 |
| **B4** SOMPO / Vlček (69, 56) | **CLOSED** | Both now read „zastával funkci předsedy představenstva **od 27. 2. 2020 do 31. 10. 2024** (zápis vymazán 4. 2. 2025); od 3. 12. 2024 je předsedou představenstva Tomáš Kocour a žádnou aktuální roli Vlčka rejstřík neeviduje." Past tense, both dates, the vymaz, the successor, and the negative. The `kind:"web"` citation states the method („deterministicky parsováno s NFC normalizací") and adds „předtím místopředsedou", which the register bears out (2006-12-21→2010-12-21, 2010-12-21→2015-12-17, 2015-12-22→2020-02-27). Consistent with the raw VR record on every date. |
| **M1** § 1a → § 2a (206) | **CLOSED** | „v novém § 2a zákona č. 273/1996 Sb. … (nikoli v § 1a, který upravuje pouze funkci místopředsedy pro veřejné zakázky)" — matches L364–369 and L314/L318. Naming the wrong provision *and* saying why it is wrong beats a silent fix. |
| **M2** law count (206) | **CLOSED** | „a čtyři další předpisy — 549/1991, 166/1993, 273/1996, 194/2010", all four correct against the ČÁST headers (L265/283/300/413); ČÁST ŠESTÁ = účinnost. A `kind:"law"` citation for 166/1993 was added. |
| **M3** trest zákazu chovu (174) | **CLOSED** | „prodloužení nejvyšší přípustné doby trestu zákazu chovu zvířat z 5 na 10 let (§ 27 odst. 13 a § 27a odst. 20)" — matches L65, L72, L338–339, L780–785. |
| **M4** SOMPO „pojišťovna" (62) | **CLOSED** | Now „obecní svazková společnost pro odpadové hospodářství založená sto sedmnácti obcemi"; the summary list reads „komunální/družstevní subjekty odpadového a vodárenského hospodářství…". Consistent with 56/69/205/206. |
| **M5** money rule (73, 174, 205, 206) | **CLOSED** | All four qualify now. Spot-checked the two largest: `verdict-73` — „řádově miliardy Kč, úhrn evidovaný v grafu, nikoli příjem poslance, vazba čeká na lidskou kontrolu"; `verdict-174` — Šťastný's 53 271 958 488 Kč carries „úhrnem veřejných smluv firmy, vazba čeká na lidskou kontrolu", and the Agrofert block carries a collective qualifier. The `graph_fact` citations in 206 carry it too. |
| **M6** pipeline jargon | **REOPENED (partial)** | see §C2 |
| **M7** Wikipedia for a registry fact (206) | **CLOSED** | The Wikipedia citation is gone, replaced by an ARES VR citation carrying both persons' birth dates and all four dates; `conflictAssessment` states the recommended sentence almost verbatim and closes with „Vlčkova funkce v SOMPO navíc skončila před podáním tohoto návrhu" — correct (role ended 2024-10-31; bill předložen 2026-05-27 per `historie.sqw?o=10&t=206`). |
| **M8** § 24 renumbering (90) | **CLOSED** | „u dosavadního § 24 odst. 7 … (přeznačeného bodem 20 na § 24 odst. 6) bodem 21 mění adresát". Verified exactly: L180–182 „20. V § 24 se odstavec 6 zrušuje. Dosavadní odstavce 7 a 8 se označují jako odstavce 6 a 7." The added hedge — „věcný obsah tohoto konkrétního ustanovení není v dostupném textu novely dále rozveden" — improves on the original, which asserted content the cached text does not carry. |
| **M9** uncited rapporteur role (62) | **CLOSED** | The committee-rapporteur assertion is gone; replaced by „Ve zdrojových datech k tomuto tisku je jako poslanec spojený s návrhem uveden Lukáš Vlček", which claims only what the data supports. |
| **MINORs** | **open, not regressed** | Unchanged and still advisory: 62's „jedenáct kategorií" without disclosing the DZ's own „10 kategorií" (L1881); 90's „36 z 42" without the scope caveat; bare-URL `evidence` in 140 and 62; 62's asserting `whoBenefits`. None block. |

## C1 — B3 REOPENED: the rebuild is false in the other direction and deletes a real finding

**File/fields:** `verdicts-013/verdict-206.json` · `researchedContext`, `citations[1].claim`, and
`statedReasoning` pillar (4).

Current text:

> „kauce za podání návrhu k ÚOHS **ve výši 1 % z předpokládané hodnoty zakázky**, nejméně 50 000 Kč
> a nejvýše 10 000 000 Kč, **PLATILA JIŽ PODLE DOSAVADNÍHO ZNĚNÍ § 255 odst. 1** … Skutečná změna
> z paušální částky 100 000 Kč na 1 % z předpokládané hodnoty … se týká **JINÉ kauce** — kauce
> skládané spolu s návrhem na nařízení předběžného opatření…"

The bill ships its own platné znění, and it settles this. `tisk-206/271161.txt` **L164–176**, § 255
odst. 1 with the amendments marked:

> „(1) Ve lhůtě pro doručení návrhu je navrhovatel … povinen složit na účet Úřadu kauci **ve výši
> 1 % z nabídkové ceny navrhovatele** …, nejméně však ve výši 50 000 Kč, nejvýše ve výši
> 10 000 000 Kč. … V případě, že navrhovatel nemůže stanovit celkovou nabídkovou cenu, je povinen
> složit kauci **ve výši 1 % z předpokládané hodnoty … nejméně však ve výši 50 000 Kč a nejvýše ve
> výši 10 000 000 Kč; pokud předpokládaná hodnota není uveřejněna,** je povinen složit kauci ve výši
> 100 000 Kč."

The bolded run is exactly what body 14/15 insert. Strip it and the pre-amendment third sentence reads:
*„V případě, že navrhovatel nemůže stanovit celkovou nabídkovou cenu, je povinen složit kauci ve výši
100 000 Kč."* Therefore:

1. **The předpokládaná-hodnota base did NOT already apply in odst. 1.** What already applied there is
   1 % of the **nabídková cena**. (The předpokládaná hodnota appears pre-amendment only in odst. 2,
   koncese — L179–180.) The current sentence states the opposite, then contradicts itself two clauses
   later by conceding that bod 14 „doplňuje náhradní základ".
2. **The 100 000 Kč → 1 % change is NOT confined to the court kauce.** It happens right here, in
   § 255 odst. 1 sentence 3: a flat 100 000 Kč becomes 1 % of the předpokládaná hodnota, floored at
   50 000 Kč and **capped at 10 000 000 Kč**. The flat sum survives only in the narrower sub-case
   where the předpokládaná hodnota was never published (L173).
3. The court kauce is not a separate scheme at all — it is defined by reference: `271161.txt` **L457**
   „…složí žalobce soudu kauci **ve výši podle § 255**." It moves because § 255 moves.

What is *correct* in both my B3 and the rebuild: the 50 000 / 10 000 000 limits are not new (they
mirror sentence 1), and the DZ's stated aim is that the two bases yield a **comparable** kauce
(L982–986). What neither version has yet stated: **for a challenge to the tender conditions — the case
where no bid price exists, and the one moment when a supplier can still stop a bad procurement before
award — the kauce moves from a flat 100 000 Kč to as much as 10 000 000 Kč.** That is a genuine,
evidenced, unstated effect on access to review. The original verdict overstated it into the whole ÚOHS
kauce being „řádově vyšší"; the rebuild erased it.

**Severity:** BLOCKING. The sole surviving unstated effect (court fee 3 000 → 50 000 Kč) is
independently sound and MEDIUM/4 does not collapse. But `researchedContext` and `citations[1]` now
assert what the law said *before* the amendment, and that assertion is false — a fabricated
legal-status claim, which this project treats as a failed task regardless of which direction it errs
in.

**Recommended replacement**, derivable line-by-line from `271161.txt` L164–176:

> § 255 odst. 1 rozlišuje dva případy. Byla-li podána nabídka, činí kauce 1 % z nabídkové ceny
> navrhovatele, nejméně 50 000 Kč a nejvýše 10 000 000 Kč — toto novela nemění. Nelze-li celkovou
> nabídkovou cenu určit (typicky u návrhu proti zadávacím podmínkám), platila dosud pevná kauce
> 100 000 Kč; novelizační bod 14 ji nahrazuje 1 % z předpokládané hodnoty zakázky se stejnými limity
> 50 000 Kč / 10 000 000 Kč, přičemž pevných 100 000 Kč zůstává jen pro případ, kdy předpokládaná
> hodnota nebyla uveřejněna. Důvodová zpráva uvádí, že limity odpovídají limitům pro případ podané
> nabídky a kauce má být „srovnatelná". Kauce skládaná soudu s návrhem na předběžné opatření se řídí
> § 255, a mění se proto shodně.

## C2 — M6 REOPENED (partial): the gate does not cover the tokens M6 named

**File:** `lib/analysis/law-verdict.ts` L174–180 (`JARGON`), and `lib/analysis/law-verdict.test.ts`.

The rule is a real improvement and its architecture is right — code rather than prose, scoped to the
law case, composing with `public-copy.ts` rather than forking it, 11/11 tests green
(`npx vitest run lib/analysis/law-verdict.test.ts`). But of the three prop identifiers M6 quoted
verbatim — `sectorAdjacency: false`, `attributedSectorLeads: []`, `moneyTies je prázdné pole` — the
regex list contains **only `sectorAdjacency`**. `moneyTies` and `attributedSectorLeads` appear in
neither the rule nor its test.

Consequence: the sweep purged what the gate can see and left what it cannot, so **"011 12/12,
012 10/10" is a pass on a blind check**. Scanning the current files and evaluating the shipped JARGON
regexes against each offending string, **12 occurrences survive in 10 files**, every one returning
`gate catches: false`:

| file | field | surviving token |
|---|---|---|
| `verdicts-011/verdict-7.json` | `researchedContext` | „moneyTies je u všech tří prázdné pole) ani žádný sektorový lead (attributedSect…" |
| `verdicts-011/verdict-7.json` | `conflictAssessment` | „moneyTies = [] u všech) a **batch** k tisku 7 nepřiřazuje … (attributedSectorLeads…" |
| `verdicts-011/verdict-102.json` | `conflictAssessment` | „moneyTies je prázdné pole)"; „attributedSectorLeads: []" |
| `verdicts-011/verdict-14.json` | `conflictAssessment`, `citations[4].claim` | „attributedSectorLeads je prázdné pole"; „attributedSectorLeads = []" |
| `verdicts-011/verdict-189.json` | `conflictAssessment` | „moneyTies: [])" |
| `verdicts-011/verdict-213.json` | `conflictAssessment` | „moneyTies je prázdné pole)"; „attributedSectorLeads: []" |
| `verdicts-011/verdict-64.json` | `conflictAssessment` | „moneyTies = []) a bez sektorového leadu (attributedSectorLeads = [])" |
| `verdicts-012/verdict-16.json` | `conflictAssessment` | „moneyTies je prázdný seznam)" |
| `verdicts-012/verdict-172.json` | `conflictAssessment` | „moneyTies je prázdné pole) … (attributedS…" |
| `verdicts-012/verdict-250.json` | `conflictAssessment` | „moneyTies je u obou prázdné pole) ani … (attributedS…" |
| `verdicts-012/verdict-54.json` | `conflictAssessment` | „attributedSectorLeads je prázdné, …" |

`verdict-54` shows the failure mode inside a single sentence: the sweep rewrote „sectorAdjacency
nastaveno na false" → „deterministický odvětvový signál tohoto projektu jej nenašel" (good, meaning
preserved) and left „attributedSectorLeads je prázdné" **in the same clause**, because only the first
token tripped the gate. `verdict-7`, `verdict-14` and `verdict-16` were never touched at all — they do
not appear in the diff — which is consistent: nothing flagged them.

Also uncovered: the bare word **`batch`** without digits (`verdict-7`: „a batch k tisku 7
nepřiřazuje"), since the regex requires `\d{2,3}`.

**Fix:** add `moneyTies|attributedSectorLeads` (and, cheaply, `reviewState|tieClass`) to the first
JARGON alternation, add a bare-`batch`/`pass` word form, extend the test with a `moneyTies` case, and
re-run the sweep over 011/012/013. Ten of the twelve occurrences are in `conflictAssessment` — the
field that renders directly under an MP's name.

## C3 — N1 (NEW, MAJOR): `verdict-90` cites the wrong NKÚ provision

**File/fields:** `verdicts-013/verdict-90.json` · `unstatedEffects[1].effect` and
`unstatedEffects[1].evidence`.

Current text: „stanoviska Nejvyššího kontrolního úřadu **ke státnímu závěrečnému účtu podle § 5 odst.
2** zákona č. 166/1993 Sb. (čl. I bod 1)".

§ 5 zákona č. 166/1993 Sb. splits the two opinions across two odstavce:

- **odst. 2** — „Stanovisko **ke zprávě o vývoji ekonomiky a plnění státního rozpočtu** předkládá Úřad
  Poslanecké sněmovně ve lhůtě do 1 měsíce…"
- **odst. 3** — „Stanovisko **k návrhu státního závěrečného účtu** předkládá Úřad Poslanecké sněmovně
  ve lhůtě do 4 měsíců…"

The bill confirms the split by treating the two differently: čl. I **bod 1** changes the addressee in
**odst. 2** („Poslanecké sněmovně" → „rozpočtovému výboru Poslanecké sněmovny", L24–25), while čl. I
**bod 2** touches **odst. 3** only to shorten a deadline — „V § 5 odst. 3 se číslo „4" nahrazuje číslem
„3"" (L27). The DZ agrees: the NKÚ article „souvisí se změnou v oblasti předkládání **pololetních
zpráv o plnění státního rozpočtu** a s posunem termínu pro předložení státního závěrečného účtu"
(L2195–2198).

So the opinion whose addressee moves to the committee is the one on the **report on economic
development and budget execution** — coherent with the rest of the effect, which is about the
pololetní zpráva. The opinion on the **státní závěrečný účet**, constitutionally the weightier of the
two, **stays with the plenary**; only its deadline shortens. The verdict attaches odst. 3's subject
matter to odst. 2 and thereby inflates the finding.

This error is present in the pre-fix file too — it is not a regression, and it is **my own round-1
miss**: I listed „§ 5 odst. 2 of 166/1993" as an item to re-derive, then closed on the amendment
instruction without checking what the provision contains. Recorded as such.

**Fix:** name the zpráva o vývoji ekonomiky a plnění státního rozpočtu, and optionally add the odst. 3
deadline change (4 → 3 months) as a separate, small, correctly attributed fact.

## C4 — MINOR (new): shouted emphasis in reader-facing Czech

`verdicts-013/verdict-206.json` · `researchedContext` contains „**PLATILA JIŽ PODLE DOSAVADNÍHO
ZNĚNÍ**" and „**JINÉ** kauce" in full caps. Nothing else in the corpus shouts; the register is
legal-formal Czech and the surface renders this verbatim. It reads as an author arguing with a
reviewer rather than as a finding. Resolves itself with the C1 rewrite.

## C5 — Sweep fidelity: no claim drifted

Word-diffed the swept files. `verdict-67` (10 changed lines, the most edited) is **clean**: every edit
is `.data/law-collision-cache/tisk-67/266188.txt` → „úplný text tisku na psp.cz (strojový přepis)" and
`batch-010` → „dřívější cílená prověrka v rámci tohoto projektu". Line-number anchors survive intact
(6829–6834, 22315–22326, 14481–14486) and every substantive claim is byte-identical — including the
self-correction on § 55a, the Šťastný / Pražské služby municipal disposal with its „odešel už v lednu
2012" dating, the 14-not-12 tie recount, and the severity reasoning. `verdict-54`'s single edit
preserves meaning (see C2). `verdict-7` is unchanged. **No drift found in the sweep.**

## C6 — Nothing else newly broken

- `verdict-90` now carries 3 effects; MEDIUM/3 is earned twice over (the § 20 odst. 2 abolition is
  stronger than anything in the pre-fix file, and Hlava VIII is untouched and still well hedged). The
  three effects do not overlap and each has its own evidence line. `conflictAssessment` no longer
  carries prop identifiers and says the same thing in Czech.
- `verdict-206` reads coherently apart from C1/C4; confidence 3 → 4 is defensible now that the sole
  effect is the fully verified court fee, and „cca 16,7násobek" is arithmetically right
  (50 000/3 000 = 16,67). „část J)" checks out — J) Zhodnocení korupčních rizik at L794, concentration
  of powers at L802.
- `verdict-206` retains one parenthetical `pending_review` („čekají na lidskou kontrolu
  (pending_review)"). The Czech leads and the token glosses it, so it is defensible, but it is the
  only such gloss left in batch 013 — worth deciding once, either way.
- Previously verified material re-checked wherever the edits touched it: 174's fine figures, 62's
  annex enumeration, 205's and 73's tie lists, and 69/56's SOMPO founding facts are unchanged and
  still correct.
- `npx vitest run lib/analysis/law-verdict.test.ts` — 11/11 pass.

## Persist gate

Blocked on **C1** (rewrite `verdict-206`'s `researchedContext`, `citations[1].claim` and
`statedReasoning` pillar 4) and **C2** (extend the JARGON list + test, re-sweep 011/012). **C3** should
ride the same pass — it is a one-clause fix, and it is a §-citation error of the class this loop has
now failed on in three consecutive batches. **C4** resolves itself with C1.

Everything else is closed. When C1–C3 are applied, re-derive them from `271161.txt` L164–176 and
`267105.txt` L24 / L27 / L2195–2198, plus a fresh token scan — not from the corrected prose.

---

## Final closure

Scope as instructed: `verdict-206`'s three rewritten fields plus the restored effect, `verdict-90`'s
NKÚ sentence, and the sweep in `verdict-7`. Re-derived from the platné znění (`tisk-206/271161.txt`)
and the operative text (`tisk-90/267105.txt`), plus a full token re-scan of all 32 verdicts across
011/012/013. Read only; nothing edited.

**Result: CLOSED.** No blocking finding remains. Zero hard jargon hits corpus-wide.

| # | status | evidence |
|---|---|---|
| **C1** ÚOHS kauce (206) | **CLOSED** | `researchedContext` is near-verbatim the recommended text and each clause checks out against `271161.txt` L164–176: 1 % z nabídkové ceny with 50 000–10 000 000 Kč „to novela nemění" (L164–167); the no-bid-price case „platila dosud pevná kauce 100 000 Kč", replaced by 1 % z předpokládané hodnoty at the same limits, with 100 000 Kč surviving only for an unpublished předpokládaná hodnota (L168–173); „Kauce skládaná soudu s návrhem na předběžné opatření se řídí § 255 a mění se proto shodně" (L457). No caps remain. `citations[1]` restates the same platné-znění facts and no longer asserts anything about what applied before. `statedReasoning` pillar (4) now locates the change in § 255 odst. 1 and says the court kauce follows „odkazem" — correct. |
| **C1b** restored effect (206) | **CLOSED** | `unstatedEffects[1]` puts the deleted finding back and scopes it correctly to „návrhu proti zadávacím podmínkám — tedy v situaci, kdy nabídková cena z povahy věci neexistuje", from pevných 100 000 Kč to „až na 10 000 000 Kč". Arithmetic checks: 10 000 000 / 100 000 = 100, and `whoBenefits` says „až stonásobně" ✓. `whoBenefits` is sign-neutral as asked — opens „Nelze jednoznačně určit", names both sides (suppliers and contracting authorities), and declines to model net direction. Covered by `citations[1]`, so the ≥1-citation rule holds. With two independent, verified effects, medium/4 is now comfortably earned rather than argued. |
| **C3** NKÚ § 5 (90) | **CLOSED** | `unstatedEffects[1]` now reads „stanoviska Nejvyššího kontrolního úřadu **ke zprávě o vývoji ekonomiky a plnění státního rozpočtu** podle § 5 odst. 2 … (čl. I bod 1); u stanoviska ke státnímu závěrečnému účtu podle § 5 odst. 3 novela **pouze zkracuje lhůtu ze čtyř na tři měsíce (bod 2), adresát se nemění**." Matches the statute's own split and the bill exactly: bod 1 changes the addressee in odst. 2 (L24–25), bod 2 touches odst. 3 only — „V § 5 odst. 3 se číslo „4" nahrazuje číslem „3"" (L27). The `evidence` field carries both provisions with their subject matter. The distinction that inflated the finding is now the thing the sentence explicitly draws. |
| **C2** jargon gate + sweep | **CLOSED** | Full re-scan of all 32 verdicts (011/012/013), evaluating the extended token set over every reader-facing field: **0 hard hits**. `moneyTies`, `attributedSectorLeads`, `sectorAdjacency`, `mp_group`, urns, cache paths and batch/pass references are gone everywhere, including the three files the previous sweep never touched (`verdict-7`, `verdict-14`, `verdict-16`). |
| **C4** shouted caps (206) | **CLOSED** | Resolved by the C1 rewrite; no all-caps emphasis remains. |
| **C5** sweep fidelity (`verdict-7`) | **CLOSED — no drift** | Diffed against `HEAD`. Eight replacements, all glossing: „v datech tohoto batche … (moneyTies je u všech tří prázdné pole) ani žádný sektorový lead (attributedSectorLeads = [])" → „v datech tohoto případu … žádnou peněžní vazbu ani žádný sektorový lead"; „batch k tisku 7 nepřiřazuje" → „k tisku 7 není přiřazen"; „Batch přiřazuje" → „Případový soubor přiřazuje". Every substantive claim survives byte-identical — the psp.cz procedural dates, the Vojenská policie capacity figures (nápad pod 500 případů, cca 70 stíhání), the title-vs-content finding on body 1.10/1.11, and both negative findings, which are still stated rather than dropped along with their tokens. |

### Residual, advisory only (no action required before persist)

A soft scan turns up 16 occurrences of three non-identifier patterns, none of which the gate targets
and none of which I would block on: the bare word „cache" in six `researchedContext` fields (e.g.
`verdict-7`: „Přímé čtení normativního textu (cache tisk-7)"); „strojového přepisu" in seven
`evidence` fields — the sweep's own replacement wording, Czech and legible, though the line numbers it
anchors are not resolvable by a reader; and `pending_review` as a glossed parenthetical in
`verdict-54` and `verdict-206`, in both cases preceded by the Czech („čekají na lidskou kontrolu
(pending_review)"). Worth one decision each in a future pass, not a defect now.

The MINORs carried from §4 of the original audit remain open and unchanged: `verdict-62`'s „jedenáct
kategorií" without disclosing the DZ's own „10 kategorií" (L1881), `verdict-90`'s „36 z 42" without
the matcher-scope caveat, bare-URL `evidence` in 140 and 62, and 62's asserting `whoBenefits`.

### One process note

Pass 47 persisted the 28 verdicts **before** this closure check ran. The result is clean, so nothing
was published in error — but the ordering meant this check could not have prevented a bad write, and
the two prior rounds both found that remediation introduced fresh defects (C1 was itself a defect
introduced while fixing B3). The cheap invariant for batch 014: the closure check gates the write, not
the other way round.

**Batch 013 is clear to stand as persisted.**
