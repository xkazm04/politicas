# Batch-020 closure audit — adversarial, independent

**Auditor:** fresh session, no prior involvement in any batch of the law-forensics loop.
**Scope:** `docs/data-analysis/case-law/payloads/verdicts-020/` (10 verdicts: 35, 36, 42, 48,
82, 99, 130, 138, 199, 208), `payloads/batch-020-targets.json`, and the P2 build (the /zakony
§-level sector-attribution surface shipping with this batch's commit).
**Method:** every `„…“` string re-located in the NFC-normalized, U+200B/U+200C/U+200D/U+FEFF/
U+00AD-stripped, whitespace-collapsed `.data/law-collision-cache/tisk-<N>/*.txt` **and**
`index.html` (which carries the psp.cz distribution stamp); every tie class and CZK figure
re-derived from `docs/data-analysis/case-money/ledger.json` + `batch-020-targets.json`; every
procedural verb checked against `batch-020-targets.json` `committeeRouting`; prior verdicts
read from `payloads/verdicts-016..019/`; person names checked against the 207-MP roster in
`docs/data-analysis/case-effort/payloads/`; `validateLawVerdict`, `lawJargonIssues` and
`czechCopyOrNull` executed over all ten payloads; `npm run check` and
`npx vitest run features/lawwatch` run in full.
**No payload, source, message or store file was edited. No git writes. PGlite reads only.**

---

## VERDICT: ⛔ BLOCK

Six blocking defects across the three Priority-1 mediums plus one low. Two of them are the
**named recurrence class of batches 018 and 019 — the re-inflected quotation** — now in its
fourth consecutive batch and, this time, inside a `citations[].claim`, i.e. the field that *is*
the citation. Two more are the **batch-016 accusation-by-omission class**, in its sharpest
form yet: both fault a document for failing to mention an event that **did not exist when the
document was signed**. One is a wrong date that contradicts the batch's own cache *and*
inverts a figure published in `verdicts-019`. One is a false temporal quantity (off by a
factor of five) in a `whoBenefits` field.

**Verdict-42's `medium` is not earned as filed** — three of the six blockers sit in it, and
its central cross-verdict claim rests on a coincidence I measured to be a scheduling artifact.
**Verdict-82's `medium` is earned in substance** (the technical-framing-vs-budget finding is
real, verbatim-sourced and press-corroborated) but is published over an uncited six-date
enactment chain and an inflated saving. **Verdict-130's `medium` is earned** — the
scrivener's-error finding is verbatim, correctly scoped and honestly restrained; its defects
are citation coverage only.

**The P2 build ships no false claim on today's data and is not blocking.** `npm run check`
passes (exit 0); `npx vitest run features/lawwatch` = **7 files / 78 tests passed, 0 failed,
0 skipped**. It carries four MAJORs of a single shape — *the build knows more than it says*.

---

## BLOCKING

### B1 — verdict-42: re-inflected quotations, ×2, presented as verbatim
`verdicts-020/verdict-42.json` · `.statedReasoning`

The verdict renders, inside typographic quotation marks:

> …hovoří o „**plánovaných stavbách** místních komunikací I. třídy“ a „**záměrech** uvedených
> dopravních staveb“ obecně po celé republice…

Measured over `tisk-42/265622.txt` (NFC, zero-width stripped, whitespace collapsed), the print
says:

> „Při nerealizaci **plánovaných staveb** místních komunikací I. třídy vzrostou celospolečenské
> ztráty…“
> „To povede ke stavu, že na **záměry** uvedených dopravních staveb územní samosprávné celky již
> nebudou mít dostatečné finanční prostředky…“

Both are inflected out of the genitive/accusative into the locative to fit the auditor's own
carrier sentence („hovoří o …“). Neither string exists in the print. This is exactly the defect
`batch-019-audit.md` B1 blocked on („pouhé nouzové řešení pro letošní rok“) and which
batch-018 named before it: meaning-preserving, and therefore harder for a reader to spot, not
easier. Hit/miss for the same verdict's other four quotations: all HIT verbatim, including
`„místní komunikace I. třídy,“`, `„vlivem měnící se legislativy vůbec“` and `„V Praze dne
1. dubna 2025“` — which is what makes the two composed ones indistinguishable in context.

### B2 — verdict-82: re-inflected quotation propagated into the citation itself, ×3 fields
`verdicts-020/verdict-82.json` · `.statedReasoning`, `.unstatedEffects[0].effect`,
`.citations[1].claim`

All three render:

> „čistě technick**ou**, technologick**ou** a implementační, nikoli koncepční“

`tisk-82/266752.txt` says:

> „Novela je čistě technick**á**, technologick**á** a implementační, nikoli koncepční; jejím
> cílem je umožnit kontrolovaný náběh aplikace zákona, včetně možného snížení administrativní
> zátěže, nikoliv měnit jeho cíle.“

The nominative is re-inflected to the accusative to fit „označuje novelu **za** …“. The
continuation quoted alongside it (`„umožnit kontrolovaný náběh aplikace zákona… nikoliv měnit
jeho cíle“`) **is** verbatim — the same pattern as B1. The aggravating fact is `citations[1]`:
the composed string is published as the *claim of a citation*, so the artifact's own provenance
layer asserts a sentence the source does not contain. This quotation is load-bearing: the
entire medium rests on the contrast between the „purely technical“ framing and Oddíl G.'s
budget table.

### B3 — verdict-42: accusation by omission, chronologically impossible
`verdicts-020/verdict-42.json` · `.unstatedEffects[0].effect` and `.evidence`

> „…aniž by důvodová zpráva tisku 42 souběžný tisk 49 nebo jeho cíl jakkoli zmínila.“
> evidence: „V plném znění tisku 42 (obecná ani zvláštní část) není nikde zmíněn tisk 49…“

Measured: `tisk-42/index.html` — **„Rozesláno poslancům 25. listopadu 2025 v 13:45“**; the
print's own digital signature is stamped **`2025.11.24 13:34:02`**. `tisk-49/index.html` —
**„Rozesláno poslancům 2. prosince 2025 v 8:30“**. Tisk 49 did not exist as a print until
**eight days after tisk 42 was signed and seven days after it was distributed**. The verdict
faults a document for not naming a document that postdates it, and makes that failure the
*first* of its two unstated effects. The exculpatory inverse — that the omission is
chronologically compelled — is nowhere in the payload.

The symmetric claim in `verdicts-019/verdict-49.json` (the later print faulting the earlier
one) is legitimate and is not affected by this finding.

### B4 — verdict-208: accusation by omission, chronologically impossible, plus imputed intent
`verdicts-020/verdict-208.json` · `.unstatedEffects[1].effect` and `.whoBenefits`

> „Vláda k návrhu zaujala nesouhlasné stanovisko (tisk 208/1, 23. 6. 2026) — tento fakt ani
> existence nesouhlasu vlády s návrhem není v archivovaném textu důvodové zprávy nikde zmíněn;
> **zpráva je psána tak, jako by šlo o nesporné technické zpřesnění bez politického sporu o
> obsah.**“

The verdict's own `researchedContext` states the bill was delivered **27. 5. 2026** and
distributed **29. 5. 2026** (`tisk-208/index.html` confirms: „Rozesláno poslancům 29. května
2026 v 9:10“), and that the government's opinion was distributed **23. 6. 2026** — twenty-five
days later. A důvodová zpráva written in May cannot mention a disagreement recorded in June.
Worse than B3: the second clause imputes *rhetorical intent* („psána tak, jako by…“) to the
authors on the basis of that impossible omission. Both halves of the effect fall.

### B5 — verdict-42: a wrong, uncited date contradicted by the batch's own cache, and a
cross-verdict contradiction with `verdicts-019`
`verdicts-020/verdict-42.json` · `.researchedContext`

Two falsifiable dates, **neither covered by any entry in the verdict's seven `citations`**:

1. > „Podle webu psp.cz byl tisk 49 doručen **1. prosince 2025**…“
   `tisk-49/index.html` (this batch's own cache): **„Rozesláno poslancům 2. prosince 2025 v
   8:30“**. Wrong by one day, against a source the pipeline already holds.
2. > „…vláda zaujala k oběma tiskům neutrální stanovisko rozeslané **23. prosince 2025**.“
   `verdicts-019/verdict-49.json` `.researchedContext` + `.citations[5]`: *„zaujala vláda … 
   shodné, neutrální stanovisko dne **22. prosince 2025**“*, sourced to a Pražský patriot piece
   **dated 23 December 2025**. Batch-020 has converted the *article's* date into the
   *decision's* date and published it as the government's action date — one story, two dates,
   no citation on the new side.

The loop's rule is that every date carries a citation that survives. Here two dates carry none
and one of them is refuted by a file in `.data/`.

### B6 — verdict-82: a false temporal quantity in a `whoBenefits` field, uncited
`verdicts-020/verdict-82.json` · `.unstatedEffects[0].whoBenefits`

> „…ztrácejí přístup k poradenství, které mohly čerpat podle zákona ve znění účinném od
> 1. ledna 2026, tedy **pouhé dva měsíce před podpisem tohoto návrhu**.“

`tisk-82/266752.txt`, closing block, verbatim:

> „V Praze dne **12. ledna 2026** Předseda vlády: Ing. Andrej Babiš … Ministryně pro místní
> rozvoj: … Zuzana Mrázová … Datum: **2026.01.12 16:23:29** … Digitálně podepsal Andrej Babiš
> Datum: **13.01.2026**“

The interval between 1 January 2026 and the signature is **eleven to twelve days**, not two
months. (No reading rescues it: the presidential signature the verdict itself places at
16 July 2026 is six and a half months out.) The number is uncited, it is wrong by a factor of
about five, and it sits in the sentence that names who loses. Noted in fairness: the true
figure is *more* adverse to the bill than the printed one, so this is corruption, not
self-serving inflation — but a public accountability artifact may not publish either.

---

## MAJOR

### M1 — verdict-82: an uncited six-date enactment chain that no artifact in this repo supports
`.statedReasoning` asserts: přikázání 13. 3. 2026 · výbor doporučil **7. 4. 2026** · Sněmovna
schválila **29. května až 3. června 2026** (**usnesení č. 200**) · Senát **8. 7. 2026** ·
prezident podepsal **16. 7. 2026** · publikován **23. 7. 2026** jako **zákon č. 129/2026 Sb.**

The only citation covering any of it (`citations[6]`, `kind: web`) claims exactly one thing —
*„Tisk 82 prošel celým legislativním procesem a byl publikován jako zákon č. 129/2026 Sb.“*
Five dates and a resolution number are asserted with no citation at all. `tisk-82/index.html`
carries no history block; `batch-020-targets.json` corroborates only the 13. 3. 2026 referral
(`{organ: "VSR", status: "prikazano", assignedOn: "2026-03-13"}`). A third-reading spanning a
**date range** (29. 5.–3. 6.) is additionally an odd shape for a single vote. Note also that a
completed enactment contradicts the payload's own `status: "prikazano"` snapshot without saying
so.

### M2 — verdict-82: the saving is inflated, and the condition on the 605 mil. figure is dropped
`.unstatedEffects[0].effect` and `.whoBenefits` both characterise the gap between 605 mil. Kč
and 0,79 mld. Kč as *„o částku **v řádu stovek milionů korun**“* / *„úsporu **v řádu stovek
milionů korun**“*. The arithmetic is **790 − 605 = 185 mil. Kč** — below two hundred million.
Neither field carries a citation for the derived quantity. (For calibration, the same corpus
uses the phrase precisely: tisk 42 writes *„v řádu **vyšších** stovek milionů korun“*.)

Separately, `citations[2]` and the effect both truncate the print's own condition. Verbatim:

> „Implementace zákona o podpoře bydlení vyžaduje v roce 2026 částku 605 mil. Kč ze státního
> rozpočtu, **pokud dojde k navýšení příspěvku na výkon státní správy pro obce a kraje.**“

The comparison that carries the medium is drawn against a conditional figure presented as
unconditional.

### M3 — verdict-82: corroboration overstated, plus an unnamed source
`.researchedContext`: *„Číselný údaj 605 mil. Kč i pokles oproti původní kalkulaci **se shodují**
s vlastní tabulkou tisku 82…“* — but the same paragraph reports Česká justice as saying the cost
falls *„přibližně z **805** mil. Kč na 605 mil. Kč“*, while the print's own baseline is
**790 mil. Kč**. The two baselines differ by 15 mil. and are declared to agree.

The same field then states: *„**podle nezávislého zdroje** upravuje výsledná podoba zákona vedle
zákona č. 175/2025 Sb. i zákon č. 73/2011 Sb. … a zákon č. 360/2025 Sb.“* — no source is named
and no citation covers it. Two statute numbers enter the record on an anonymous attribution.

Also in `.unstatedEffects[0].evidence`: **„Česká justie“** where `researchedContext` and
`citations[4]` write „Česká justice“ — a field-parallelism break in the name of a cited outlet.

### M4 — verdict-42: the „identical referral date" coincidence is a scheduling artifact, undisclosed
`.unstatedEffects[0].effect` builds its coordination narrative on three pillars, one of which is
*„se stejným datem přikázání garančnímu výboru (5. ledna 2026)“*.

Measured across every `batch-*-targets.json` in the repo — **125 `committeeRouting` rows over 36
distinct dates**. The distribution is plainly session-batched: **12 bills** share 2025-12-17,
**11** share 2026-06-24, **8** share 2026-04-02, and so on. **Three** bills carry 2026-01-05 —
tisks **40, 42 and 49**. A shared referral date is what the organizační výbor does to a whole
tranche on one sitting; the payload never says so, and a third bill sharing the date goes
unmentioned. The pillar carries far less than the sentence implies.

### M5 — verdict-42 and verdict-130: procedural-verb inflation against the payload's own status
`batch-020-targets.json` records tisk 42 as `{organ: "HV", status: "**navrzeno**", assignedOn:
"2026-01-05"}` and tisk 130 as `{organ: "VZ", status: "**navrzeno**", assignedOn: "2026-04-02"}`.

- verdict-42 `.statedReasoning` correctly writes *„byl … **navržen** Hospodářský výbor“*, but
  `.unstatedEffects[0].effect` upgrades it to *„se stejným datem **přikázání** garančnímu
  výboru“*. One claim, two procedural verbs, in two fields of one artifact.
- verdict-130 `.researchedContext` writes *„byl **přidazením** ze dne 2. 4. 2026 … **navržen**
  výbor pro zdravotnictví … tisk je … ve stavu „navrženo““* — self-contradictory within one
  sentence (an assignment that is only a proposal). verdict-99 and verdict-138 carry the same
  „přidělením … navržen“ construction.

A proposal is not an assignment; the loop has blocked on this class before.

### M6 — verdict-35: a named individual is misspelled
`.researchedContext`: *„zpravodajem byl určen Mgr. **Patrik Pašil**“*.
The 207-MP roster in `docs/data-analysis/case-effort/payloads/` contains **„Patrik Pařil“** and
no „Pašil“; a repo-wide grep for „Pašil“ returns exactly one file — this verdict. The other two
individuals the batch names as rapporteurs/proposers check out (`Vendula Svobodová` ✓,
`Václav Trojan` ✓, `Miloš Vystrčil` ✓ verbatim in `tisk-130/268455.txt`). A public accountability
artifact must not misname the person it places in a procedural role.

### M7 — verdict-35: a state-of-the-world assertion published as fact, uncited, ×2 fields
`.researchedContext` and `.unstatedEffects[0].effect` both assert that *„nárůst platové základny
pro rok 2026 … **proběhl** podle obecného mechanismu“*. The only thing the cited source
(`historie.sqw`) can establish is that the bill did **not** pass. That the base actually rose
under § 3 odst. 3 is a separate factual claim about the world, stated twice in the perfective,
with no citation. The honest form is conditional.

### M8 — verdict-208: a class conclusion contradicted by the money ledger
`.conflictAssessment` reports Bendl's sixth tie as *„(PRaK, a.s. v likvidaci, IČO 61858111) bez
záznamu v revidovaném přehledu … u této vazby proto **nelze** z dostupných dat určit její třídu“*
and concludes *„**I u Bendla jde tedy nanejvýš o penězi institucí**“*.

`docs/data-analysis/case-money/ledger.json` stores that tie under a **different IČO**:
`tie:346:49683144` — „PRAK spol. s r.o.“, role `člen představenstva`, **`tieClass: "manager"`**,
`corroboration: "conflicting"`, `flags: ["no-money-reachable"]`. The ledger's own
`summary.batch3.qMoney7` records `icoCandidate "61858111"` with `"status": "candidate found,
not applied"` and an open item *„tieClass reclassification to steward if repointed“*. The stored
class is `manager` — attributable, not institutional. Money impact is **nil** (0 Kč,
`no-money-reachable`), so no figure is wrong; the *stated conclusion* is.

The disclosure of the IČO mismatch is otherwise good practice and should survive the correction.

### M9 — systemic: uncited dates, counts and percentages across all ten verdicts
The batch's dominant defect by volume. Measured counts of values that are **verified true
against the cache but carry no matching `citations` entry**:

| verdict | uncited values | examples |
|---|---|---|
| 48 | 5 | signature 12. 11. 2025 · „ve 35 bodech“ · 200 ha · „nižších desítek tisíc korun“ · (EU) 2022/2379 + 2023/564 |
| 199 | 7 | garanční výbor 27. 5. 2026 · pspId 6996 (**no `graph_fact` citation exists in this verdict at all**) · „devatenáct oddílů A–S“ · § 24 odst. 1 písm. i) · signatures 15. 5./21. 5. 2026 · „do 31. května“ |
| 36 | 6 | pspIds 6788/6997 + „obě STAN“ (**no `graph_fact` citation at all**) · čl. II účinnost 31. 12. 2025 · podpisy 10.–11. 11. 2025 · „třináct oddílů A–M“ · § 90 odst. 2 |
| 138 | 3 | přidělení 15. 4. 2026 + HV · stav „navrženo“ · účinnost 1. ledna 2027 |
| 130 | 4 | pokles **o 90 %** za rok · rok 2017 · „Trešl I. a další“ · žádost o souhlas v prvém čtení |
| 35 | 3 | 16,4 mil. Kč attributable · „téměř dvě miliardy“ steward · the six steward ties (the `psp:person:6150` citation covers only the 4+4) |
| 99 | 1 | bagatelní limit 50 000 Kč (the 500 000 Kč limit *is* cited) |
| 82 | ≥7 | see M1–M3 |
| 42 | 2 | see B5 |
| 208 | 1 | eKLEP č. 458/26 |

**Citation-kind doctrine is also inconsistent across the batch for one class of fact.** The
committee-routing facts held in `batch-020-targets.json` are cited as `kind: "web"` →
`historie.sqw` in verdicts 35, 42, 48 and 208, and cited **not at all** in 130, 138 and 199.
One fact class, three treatments. (All seven routing statements are *correct* against the
targets file — 42 HV/2026-01-05 ✓, 130 VZ/2026-04-02 ✓, 138 HV/2026-04-15 ✓, 199 VŽP/2026-05-27
✓, 208 VZ/2026-06-24 ✓, 99 ÚPV/2026-03-04 ✓, and verdict-36's *„v grafu není evidováno žádné
přikázání“* matches `routing: []` ✓. The defect is provenance, not accuracy.)

### M10 — verdict-36: a real finding escalated into an unsupported imputation
The date-inconsistency finding is **real and verbatim** — `tisk-36/265520.txt`, oddíl M:
*„…aby zákon mohl nabýt účinnosti **31. prosince 2024**…“*, in a bill signed 10.–11. 11. 2025
whose own čl. II says **31. prosince 2025** (twice). But the verdict promotes a one-digit
clerical slip into an `unstatedEffect` whose `whoBenefits` names the sponsors as beneficiaries
of a § 90 odst. 2 fast-track that would bypass the committee *„jenž by chybné datum v odůvodnění
mohl odhalit“*. Nothing in the payload supports an intent or an advantage. The finding should
stand; the imputation should not.

Adjacent, and a missed *stronger* finding: the print's two documents disagree about the carve-out.
`265520.txt` (bill) excludes *„části první čl. 1 bodů 9 a 16“*; `265522.txt` (platné znění)
excludes *„§ 858 a doplněné věty v § 884“*. The verdict's claim that *„důvodová zpráva neuvádí,
podle jakého kritéria byly právě tyto dva body vyňaty“* is literally true of the DZ while the
companion document identifies them — an incomplete read of a two-document print.

### M11 — the P2 build: four defects of one shape — it computes more than it publishes
Audited against the live payload (`batch-017-sector-attribution-para.json`, 29 rows) and the
live store (141 bills) by executing the real modules.

- **(a) Drop-on-gate-failure is silent and uncounted.** `features/lawwatch/sectorAttribution.ts:79-81`
  — `if (!safeDisposition || lawJargonIssues(safeDisposition).length > 0) return null;` — and
  `buildSectorAttributionIndex:117-121` discards the row whole. The module's own doc says a caller
  *„can compare `rows.length` to the sum of bucket sizes“*; **no caller does**, and
  `getLawData.ts:551-552` counts only post-gate figures. A missing or malformed payload file also
  returns an empty Map with **no `reportLoaderFailure`**. This is *stricter* than the `readForensic`
  precedent it claims parity with — that one withholds the FIELD and keeps the record
  (`CZECH_WITHHELD_CZ`); here the money↔statute adjacency itself disappears. **Measured: 0 drops
  today** (29/29 pass: `dropLang 0, dropJargon 0, dropField 0`), so the defect is latent — and
  undetectable when it fires. *The right failure mode here is disclosure, not deletion: a
  regressed Czech disposition should withhold the sentence, never the lead.*
- **(b) A trust flag is carried and hidden.** The payload's own method states the census's trust
  rule is per-bill via `diagnosticsClean`; it is **false on 18 of 29 rows**, i.e. **16 of the 27
  rows that print a § list come from a bill whose extractor diagnostics are not clean** (tisks 67,
  77, 154). `diagnosticsClean` is validated, projected, shipped — and rendered nowhere. Every §
  number prints at uniform confidence. The block-level `SourceNote` is present and correct for the
  count, the § list and the statute number, so the **brand rule is met**; the defect is that the
  most precise figures on the surface hide a trust qualifier the code already holds. The
  disposition is also rendered undated and unlinked to the verdict it quotes, against the repo's
  own `AnalystNote` doctrine.
- **(c) The ungated label is a second copy of a centralized vocabulary.** `messages/cs.json →
  lawwatch.detail.sectorAttribution.ungated` is **byte-identical** to `overeni.gate.ungated`
  („deterministické odvození — lidskou branou neprochází“), and so is the English pair.
  `BillDetail.tsx:681` renders the `lawwatch`-namespaced literal; `features/overeni/gateVocabulary.ts`
  (`GATE_UNGATED_KEY`) is not imported anywhere under `features/lawwatch/` (grep: 0 hits). It is
  keyed, but to the wrong key. Worse, the payload carries `attributionStatus: "derived-ungated"`
  on all 29 rows and `SectorAttributionRaw` does not declare it — the label is asserted
  unconditionally, so a row with a different status would still print „lidskou branou neprochází“.
- **(g) The wire carries ~40 % it never renders, and omits the field the copy depends on.** There is
  **no `*_WIRE` projection anywhere in `features/lawwatch/`** (unlike `TIE_WIRE` / `MONEY_WIRE`).
  Shipped and rendered nowhere: `sponsor`, `viaLawTitle`, `citedOnlyParagraphs` (non-null on 15/29),
  `diagnosticsClean` — **6 395 B of 16 105 B raw**. Plus `LawData.sectorAttributionBillCount` and
  `sectorAttributionFlagCount`, which have no render site at all. The `sponsor` omission is a
  correctness problem: the block's own intro asserts *„Firma **předkladatele** působí ve stejném
  sektoru…“* while **5 of the 8 flagged bills carry flags from two different sponsors** (tisk 11:
  Fiala + Babiš; tisk 103: Bureš + Haas; tisk 221: Vondráček + Pražák), so the adjacency is
  attributed to „the sponsor“ collectively. The data to fix it is already on the wire.

---

## MINOR

1. **verdict-42** — *„Text **v záhlaví** nese datum „V Praze dne 1. dubna 2025““*: the date sits in
   the closing signature block of the důvodová zpráva, not in a header.
2. **verdict-130** — the table row is rendered as a quotation with reconstructed column order:
   *„40. úrazová chirurgie — chirurgický nebo ortopedický — úrazový chirurg — 5“*. The print
   serializes it as *„40. úrazová chirurgie chirurgický nebo úrazový chirurg 5 ortopedický“*. The
   reconstruction is semantically faithful (a PDF column artifact) but is not marked as a
   reconstruction. Same file: `„úrazová chirurgie (traumatologie)“` lowercases the print's
   `„Úrazová…“`.
3. **verdict-199 / verdict-138** — two quote misses are **sentence-initial capitalization only**
   (E→e, N→n), word-for-word otherwise. Not the B1/B2 class; still not verbatim.
4. **verdict-138** — the graph state token `„navrženo“` is typeset in Czech quotation marks like a
   bill citation, on a page where every other such string is one. (verdict-130 and verdict-99 do
   the same.)
5. **Bare-URL `evidence`** on 6 effects (35 ×2, 48 ×2, 208 ×2) where the other seven verdicts write
   a textual evidence sentence. Not the batch-016 render defect — `BillDetail.tsx:497-513` handles
   both branches (link vs `forensic.evidenceLabel` „zdroj:“) — but a bare `historie.sqw` link hands
   the reader a page, not a located fact.
6. **verdict-208** — Haas's `manager` class derives from a role string that itself mixes
   `člen představenstva` with `člen dozorčí rady`; that resolution moves **5 271 341 109 Kč** into
   „attributable“ and passes without comment. The class is correctly reported; the sensitivity is not.
7. **verdict-99** — the clearance's pspId (`psp:person:7002`) is not derivable from the batch
   payload: `targets[billTisk=99].sponsors` is `[]`. The id is **correct** (verified: Karel Dvořák,
   STAN, in `case-effort/payloads/` and in `knownIds`), but the name→id resolution is undisclosed,
   and a wrong resolution here would silently manufacture a false clearance.
8. **verdict-99** — the second unstated effect (contracts concluded before 1. 1. 2027 stay
   permanently exempt) is a generic property of prospective, non-retroactive legislation presented
   as a bill-specific finding. Honestly hedged, but thin.
9. **verdict-35** — uses ASCII `-` as a dash throughout where the other nine use `—`.
10. **verdict-48** — *„interní odbornou průpravu“*; the statutory term in the print is
    *„specializovanou odbornou průpravou organizovanou Ústavem“*.
11. **verdict-138** — `citations[4].source` is `"č. 353/2019 Sb."` where sibling verdicts use the
    bare `"326/2004"` / `"350/2011"` form (verdict-130 and verdict-99 also use the prefixed form).
12. **P2 build** — `messages.test.ts` substitutes an ad-hoc `/\bdávka\s*\d/i` regex for the real
    `lawJargonIssues`; run for real, `detail.sectorAttribution.source` flags *„dávka 017“* and
    `heading` flags the ICU artifact *„countFmt“*. The exemption is argued in a comment and is
    defensible, but it is untested rather than checked — the app currently holds its DATA to a
    stricter jargon standard than its own reader-facing copy. The test also omits a global
    empty-value check, en-side jargon, ICU parity outside `sectorAttribution.*`, and any test of
    the loader join, the render branches or the wire. Its `variables()` regex still mis-captures
    single-word ICU plural branches (`one {shoda}`) — passing today by luck of multi-word branches.
13. **P2 build** — the `cislo` join is correct today (measured: **0 of 141** bills with a null
    `cislo`, **0** orphan index entries, **0** exact duplicate rows; index cisla `[11, 67, 77, 103,
    121, 154, 201, 221]`, loader reports `billCount 8 / flagCount 29`, matching the payload's own
    `flags: 29`) but none of the three failure modes is counted or disclosed, and rows are keyed by
    array index so a duplicate would silently inflate the visible match count.
14. **P2 build** — `partitionFallback` is `true` on **0 of 29** rows, so the fallback no-§ branch is
    unreachable on live data and asserted only by the type, never by a row or a render test.

---

## Verified clean — measured, not assumed

- **`npm run check` passes, exit 0** (typecheck → lint → test). `npx vitest run features/lawwatch`
  = **7 files / 78 tests passed, 0 failed, 0 skipped**.
- **Schema and gates.** `validateLawVerdict` returns `ok: true` for **10/10** payloads.
  `lawJargonIssues` over all reader-facing prose (excluding the schema tokens `kind` and `source`)
  = **0 issues on 10/10**. `czechCopyOrNull` = **0 non-Czech prose strings** across all 10
  (0/13…0/20 per file).
- **Typography.** No straight `"`, no U+2018/U+2019, no guillemets, no Cyrillic homoglyphs, no
  zero-width characters, and every string is already NFC. The single U+201D in the batch
  (verdict-36) is **verbatim from the print**, which itself closes with `”` — a faithful
  transcription, not a defect.
- **No node-id leak.** `/43\d{3}/` over every field outside `citations[].source`: **0 hits across
  all ten verdicts** — despite `billNodeId` values like `bill:tisk:43142` sitting in the targets file.
- **No fabricated, imported or cross-bill quotation anywhere in the batch.** Every quoted string in
  48, 199, 138, 36, 35, 99, 208, 130 and the remaining four in 42 was located verbatim in its **own**
  `tisk-<N>` directory. The two B1/B2 defects are re-inflections of real passages, not inventions.
- **verdict-35's money arithmetic reproduces exactly.** Babiš: 14 ties, `owner-operator 4 · manager 4
  · steward 6` — matching the verdict's named companies one for one; attributable
  **5 871 751 + 10 564 632 = 16 436 383 Kč** (the same figure /penize publishes); steward
  **1 975 315 534 Kč** („téměř dvě miliardy“ ✓). Okamura: 4 ties, all `owner-operator`, only MIKI
  TRAVEL with a contract (**5 000 000 Kč**) ✓. Macinka: 0 ✓. All 18 `pending_review` ✓.
- **verdict-99's clearance is honestly scoped.** `ledger.json`: `counts.persons 207`,
  `tiesEnumerated 211 = linkedEdges 211`, `droppedTies 0`, 63 distinct pspIds. pspId 7002 appears
  **0 times**. The absence is measured over a complete enumeration, not a coverage gap — and the
  verdict says exactly that, correctly distinguishing itself from the senate-bill case.
- **verdict-130's senator formula is grep-backed.** 8 senate-origin targets exist across every
  batch (257, 171, 12, 47, 131, 190, 238, 130) and **all 8 carry `sponsors: []`**; „Trešl“ appears
  in no other target. The data-gap framing („nelze potvrdit ani vyloučit“) is the right one.
- **verdict-42's municipal-submitter formula is correct and well-drawn** — `sponsors: []` in the
  targets ✓, and the payload states that the money graph covers only persons with a pspId, so
  Zábranský's absence „o případném majetkovém střetu zájmu nic nevypovídá“. The institutional-not-
  proprietary framing matches `verdicts-019/verdict-49.json` exactly.
- **verdict-42's absence claims are grep-backed.** In `tisk-42/265622.txt`: „okruh“ 0 · „Libeň“ 0 ·
  „Radlic“ 0 · „Praha“ 0 (outside the signature) · „investor“ 0 · „2027“ 0. The bill genuinely names
  no concrete project. Its `čl. VIII bodě 1 zákona č. 465/2023 Sb.` attribution is verbatim ✓, as is
  the exception list (jaderný zdroj, dálnice, silnice I. třídy, dráhy, letiště) ✓.
- **verdict-130's central finding is real, verbatim and correctly restrained.** `tisk-130/268455.txt`,
  čl. II bod 3, in full: *„Lékaři, kteří přede dnem nabytí účinnosti tohoto zákona získali
  specializovanou způsobilost v oboru traumatologie, se považují za lékaře se specializovanou
  způsobilostí ve specializačním oboru úrazová chirurgie podle **zákona č. 95/2024 Sb.**, ve znění
  účinném ode dne nabytí účinnosti tohoto zákona.“* — while every other reference in the print,
  including čl. I and přechodná ustanovení body 1–2, says **95/2004**. The verdict calls it a
  scrivener's error, does **not** assert a legal consequence, and sets `whoBenefits` to
  *„Nelze jednoznačně určit — jde o legislativně-technickou vadu textu“*. That is the correct
  restraint. (What 95/2024 Sb. actually is cannot be established from this repo and the verdict
  wisely does not say.)
- **verdict-130's first-reading claim is true.** I initially scored it fabricated on a grep for
  „prvním čtení“; the print uses the archaic locative — *„15. Odůvodnění návrhu, aby Poslanecká
  sněmovna vyslovila se senátním návrhem zákona souhlas již v **prvém** čtení … s ohledem na potřebu
  **urychleně** řešit současný stav“*. The finding is withdrawn. Likewise its „90 měsíců“ figure
  reproduces (*„zkrácení specializačního vzdělávání 60 měsíců (nikoliv 90 měsíců dle aktuálních
  podmínek)“*, and 5 let = 60 měsíců), and the 2017 re-classification, the ministry/society support
  and the „bez dopadu na státní rozpočet“ statement are all verbatim.
- **verdict-82's structural claims check out.** „patnácti označených oddílů A až O“ — measured, the
  print carries exactly **15** section letters A…O ✓. „Kontaktní místa vznikla k 1. lednu 2026“ ✓
  verbatim. The § 12 odst. 1 paraphrase and the § 144 odst. 3 quotation are both exact.
- **verdict-208's eleven citations are the batch's best-covered procedural record** (delivery,
  distribution, government request, usnesení č. 79 / 24. 6. 2026 all cited), all seven of its bill
  quotations HIT verbatim, and it discloses honestly that the content of tisk 208/1 could not be
  read. It also does **not** hide the 5,27 mld. Kč it attributes to Haas.
- **verdict-199's EU claim is the batch's strongest sourcing.** `kind: "web"`, a canonical EUR-Lex
  ELI URL that resolves, and Art. 18(1a) of (EU) 2017/852 as amended by (EU) 2024/1849 confirms the
  claim verbatim. All 18 § / čl. attributions checked across verdicts 48 and 138 verify exactly.
- **verdict-35's five bill-text quotations all HIT verbatim**, including the operative
  *„Do 31. prosince 2030 činí platová základna představitelů 101 364 Kč.“*, and it correctly
  discloses that the content of pozměňovací návrh č. 852 was not verified from the primary text.
- **Severity ladder.** 3 medium / 7 low is defensible against the batch-016/017 precedents (same-§
  collision = medium), with one open question: verdict-130's `medium` rests on a legislative-technical
  typo with `whoBenefits: nelze určit`, ranked above `verdicts-019/verdict-49.json`'s `low` for a
  live institutional conflict. Not a defect; worth settling as doctrine.
- **P2 build, honest branches.** The two no-§ reasons are genuinely distinguished and faithful to the
  payload — `noParagraphsCensus` („buď jde o novelu přílohy bez textu paragrafu, nebo o limit
  rozdělovače … **nikdy ne domyšlené číslo paragrafu**“) vs `noParagraphsFallback` („Rozdělení textu
  na paragrafy zde selhalo…“) — and an empty § array collapses to `null`, so no empty list ever
  renders. cs/en key parity across the whole `lawwatch` namespace holds, ICU parity holds for the new
  keys, no value is empty, and `isCzechSafe` is true for all 8 `detail.sectorAttribution.*` and all 5
  `sector.*` keys.

---

## What has to change before pass 54 writes

1. Restore B1/B2 to verbatim (or drop the quotation marks and paraphrase openly), including the
   copy inside `verdict-82.citations[1].claim`.
2. Withdraw B3 and B4 entirely, or rewrite them to state the chronology — an omission that was
   impossible is not an unstated effect. verdict-208's imputation of framing intent must go with it.
3. Fix verdict-42's two dates: tisk 49 was distributed **2. 12. 2025**, and the government position
   is **22. 12. 2025** per `verdicts-019`. Cite both, or drop both.
4. Delete B6's „dva měsíce“ or replace it with the measured eleven days, cited to the print's
   signature block.
5. Cite M1's enactment chain, or reduce it to what `citations[6]` actually claims.
6. Replace M2's „v řádu stovek milionů“ with the arithmetic (185 mil.), restore the 605 mil.
   condition, and resolve M3's 805-vs-790 disagreement instead of declaring it agreement.
7. Disclose M4 — referral dates are assigned in tranches; a shared date is not corroboration.
8. Correct M6 to **Patrik Pařil**.
9. Rewrite M7 conditionally, and correct M8 against the ledger's stored `manager` class.
10. Close M9's citation gaps and settle one citation kind for committee-routing facts.
11. The P2 build is **shippable as-is** — nothing it renders today is false. M11 (a) and (c) should
    land before the next law batch: a gate failure must disclose rather than delete, and the ungated
    label must come from `GATE_UNGATED_KEY`.
