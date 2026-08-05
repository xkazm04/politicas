# Batch-019 closure audit — adversarial, independent

**Auditor:** fresh session, no prior involvement in any batch.
**Scope:** `docs/data-analysis/case-law/payloads/verdicts-019/` (10 verdicts: 5, 15, 49, 57,
59, 163, 219, 235, 238, 243), `payloads/batch-019-targets.json`, the P2 migration
(`payloads/bill-summaries-cz.json` + `scripts/case-loops/law/summary-source-migrate-019.ts`).
**Method:** every quoted string re-located in the NFC-normalized, zero-width-stripped
`.data/law-collision-cache/tisk-<N>/*.txt`; every CZK/role claim re-derived from
`docs/data-analysis/case-money/ledger.json`; every procedural verb checked against
`batch-019-targets.json` `committeeRouting`; prior verdicts read from
`payloads/verdicts-01{6,7,8}/`; store read SELECT-only; migration run in PREPARE only.
**No payload, source or store file was edited. No git writes.**

---

## VERDICT: ⛔ BLOCK

Four blocking defects. Three are the *named* batch-018 recurrence class (fabricated /
composed / cross-bill quotation) and one is a batch-019-introduced factual corruption
absent from all three prior batches. Priority-1 verdict-15's `medium` is **not earned**
on the evidence as filed. The P2 migration is otherwise **sound and ready** (see B2).

---

## BLOCKING

### B1 — verdict-235: a quotation that does not exist in the print (fabricated), ×2 fields
`verdicts-019/verdict-235.json` · `.researchedContext` and `.citations[3].claim`

Both render, inside typographic quotation marks:

> „pouhé nouzové řešení pro letošní rok"

Measured over `tisk-235/277513.txt` + `277515.txt` (NFC, zero-width stripped): the string
**„nouzové řešení" occurs 0 times in either file.** What the print actually says (bod J,
`277513.txt`):

> „Mimořádné přerozdělení … (zákon č. 71/2026 Sb., …) **je pouhým nouzovým řešením pro
> letošní rok.**"

The verdict re-inflects the source into the nominative and presents the result as verbatim.
It is meaning-preserving — and that is exactly the batch-018 high verdict's defect. The
second occurrence is in a **`citations[].claim`**, i.e. the field that *is* the citation.
`„další krok"` in the same sentence *is* verbatim (1 hit), which makes the composed one
harder for a reader to spot, not easier.

### B2 — verdict-235: a spliced quotation, subject removed
`verdicts-019/verdict-235.json` · `.researchedContext`

> „na hlavní problém, kterým je nedostatečný celkový objem disponibilních prostředků
> systému z pohledu jeho dlouhodobé udržitelnosti, nemá vliv"

Source (`277513.txt`, verbatim):

> „…, na hlavní problém, kterým je nedostatečný celkový objem disponibilních prostředků
> systému z pohledu jeho dlouhodobé udržitelnosti, **toto jednorázové opatření** nemá vliv."

Three words are excised from the middle of the quotation with **no elision marker**, and the
excised words are the grammatical subject. (Contrast `.unstatedEffects[1].evidence`, which
uses `…` correctly for the same operation on the bod-E sentence and is therefore clean.)

### B3 — verdict-57: a quotation imported from a *different bill*, cited to tisk 57
`verdicts-019/verdict-57.json` · `.unstatedEffects[1].evidence`

The evidence field reads:

> „Body 1 a 15 obecné části zprávy k tisku 57 (**„bylo požádáno o neprovedení meziresortního
> připomínkového řízení k návrhu zákona"**; popis legislativně-technických změn…)"

Measured: **`připomínkového řízení` occurs 0 times in `tisk-57/266021.txt` or `266023.txt`.**
The phrase `bylo požádáno o neprovedení meziresortní připomínkové řízení` exists — **in
tisk 235's print** (`tisk-235/277513.txt`, bod H). The quotation has been carried across
bills into the wrong verdict.

It is also substantively wrong and contradicts verdict-57's own `statedReasoning`, which
correctly reports the tisk-57 mechanism from the print (`266021.txt`, bod 15):

> „…předsedkyně Legislativní rady vlády stanovila dopisem ze dne 16. října 2025 č. j.
> 44265-2025-UVCR …, že se v tomto volebním období připomínkové řízení k návrhu zákona
> **neprovede**…"

A decision *by the LRV chair* is not *a request by the submitter*. The verdict's whoBenefits
("Předkladatel, jenž tímto postupem ušetří čas…") is built on the fabricated version.

### B4 — the graph node id printed as the sněmovní tisk number (3 verdicts, opening sentence)
`verdict-15.json`, `verdict-49.json`, `verdict-5.json` · `.statedReasoning`, first sentence

- verdict-15: `Návrh (sněmovní tisk 43122)` — the sněmovní tisk is **15**; `43122` is
  `billNodeId: "bill:tisk:43122"` in `batch-019-targets.json`.
- verdict-49: `Návrh (sněmovní tisk 43156)` — tisk is **49**.
- verdict-5: `Návrh (sněmovní tisk 43112)` — tisk is **5**.

Measured across the three published batches: `grep -o "sněmovní tisk 4[0-9]{4}"` returns
**0 hits in verdicts-016/017/018 and 3 hits in verdicts-019** — this is
**batch-019-introduced corruption**, not an inherited pattern. It is the first clause a
reader sees, it is trivially falsifiable against psp.cz, and it collides with the same
verdicts' *correct* internal use of real tisk numbers (57 cites tisky 927/918; 163 cites
tisk 133).

---

## MAJOR

### M1 — verdict-163: DZ-section misattribution, and a cited heading that does not exist
`verdict-163.json` · `.researchedContext`, `.unstatedEffects[2].effect`, `.unstatedEffects[2].evidence`, `.citations[2]`

The verdict locates the court-review concession in *"**Zvláštní část** zprávy k **bodu 3**
(soulad s ústavním pořádkem)"* and cites *"bod **K § 3 odst. 3 a 4**"*.

Measured headings in `tisk-163/269172.txt`:

- Obecná část bod **3** = „Zhodnocení slučitelnosti navrhované právní úpravy **s ústavním
  pořádkem** České republiky" — i.e. the passage is in the **obecná** část, not the zvláštní.
- Zvláštní část headings, in full: `K části první`, `K§1`, `K§2`, `K části druhé`, `K§3`,
  `K bodu 1 (§ 3 odst…)`, `K bodu 2 (§ 3 odst…)`, `K bodu 3 (§ 10 odst…)`,
  `K bodům 3 až 9 (§ 10)`, `K části třetí`, `K§4`.
  **There is no `K § 3 odst. 3 a 4`.** `K bodu 3` is about `§ 10`, not `§ 3`.

The substance is real (both passages exist and say what the verdict says), so this is a
locator defect, not a fabrication — but `citations[2]` sends a reader to a heading that is
not in the document, and `unstatedEffects[2]`'s whole finding is "the report justifies the
two losses **in two separate places**", which is an argument *about* placement. Its
companion locator `K bodům 3 až 9 (§ 10)` is **correct** and verified.

### M2 — verdict-59: the bill is said to abolish a cap the print says never existed
`verdict-59.json` · `.statedReasoning` and `.researchedContext`

- `.statedReasoning`: „…ale **ruší povinný strop navyšování**…"
- `.researchedContext`: „§ 17 … a **ruší dosavadní strop navyšování**"

The print (`tisk-59/266065.txt`, obecná část bod 1) says the *problem* is the absence of a
cap: „…jelikož vyžaduje trvalé navyšování fondu **bez stanoveného stropu**…", and the
zvláštní část says „Nově však nebude nutné udržovat tento fond v pevně stanovené výši či jej
každoročně navyšovat **bez stanoveného limitu**." The bill removes an *unbounded-increase
obligation*; it abolishes no `strop`. The verdict's own preceding sentence states the source
position correctly, so the two clauses contradict each other within one field.

### M3 — verdict-59: the load-bearing premise of effect #2 is an unsourced claim about prior law
`verdict-59.json` · `.researchedContext`, `.unstatedEffects[1].effect`

The second unstated effect (and with it the `medium`) rests on:

> „dosavadní § 17 odst. 4 vylučoval zrušení fondu jinak než za podmínek určených zákonem"
> and „prostředky fondu byly účelově vázány na investiční činnosti podle § 18 odst. 1
> **dosavadního znění**"

`tisk-59` has **one cached file** and it contains **no „Platné znění"** attachment (measured:
0 hits) — the pre-amendment wording of zákon č. 468/2024 Sb. is nowhere in the evidence set.
The wording quoted as "dosavadní § 17 odst. 4" is in fact the **new** § 17 odst. 4 of the
operative text („Fond nelze zrušit jinak než za podmínek určených tímto zákonem."). The
`citations[]` array carries no `law` citation supporting the prior text. Additionally, the
verdict never mentions **Čl. II bod 2** — which preserves funds created under old § 17 odst.
2 and 3 as fondy reinvestice zisku, i.e. materially narrows the "release" the effect
describes. (The effect *is* scoped to bod 1, so this is an omission of scope, not a false
claim.)

Related, same verdict: the enumeration „vykládá pouze úpravu přídělu do fondu (odstavec 1),
**převzetí aktiv od jiného podniku (odstavec 3)** a postup při zániku statusu (odstavec 4)"
(`.citations[3].claim`, `.researchedContext`) is inaccurate — the zvláštní část discusses the
>50 % allocation (which is **odst. 2**, not 1), odst. 4, and §§ 18/19/20; it does **not**
discuss odst. 3 at all. **The core absence claim itself is sound and verified:** § 17 odst. 5
(„Pro účely určení navýšení fondu se nepřihlíží k jednáním, jejichž účelem je snížit příděl
do fondu.") occurs exactly once in the print — in the operative text — and appears nowhere in
either the obecná or the zvláštní část.

### M4 — verdict-219: an absence claim not scoped to the evidence it can see
`verdict-219.json` · `.researchedContext`, `.unstatedEffects[1].effect` ("čistý fiskální dopad návrhu tak ze **zprávy** nelze zjistit")

Verified and correct as far as bod 7 goes: the print gives no CZK for the three 13th-grade
posts, states „V krátkodobém horizontu se předpokládá víceméně neutrální fiskální dopad, v
dlouhodobém zvýšení výnosu … v řádu desítek milionů Kč ročně", and states the posts persist
past year 5 — all verbatim. **But bod 8 of the same print says:** „Podrobné zhodnocení dopadů
je uvedeno v **Závěrečné zprávě hodnocení dopadů regulace**." That RIA final report is not in
the cache (tisk 219 has one cached file), the verdict never mentions it, and the claim is
nonetheless stated absolutely. This is the batch-018 B3 class — a clearance/absence sentence
that outruns what the evidence covers. Fix: scope to „v důvodové zprávě" and disclose the
unread RIA annex.

### M5 — procedural-verb inflation: `navrzeno` rendered as an accomplished assignment
`verdict-219.json` · `.citations[7].claim`; `verdict-59.json` · `.citations[5].claim`

> „**Garančním výborem tisku 219 je** hospodářský výbor (HV), kterému byl tisk navržen…"
> „**Garančním výborem tisku 59 je** výbor pro sociální politiku (VSP), kterému byl tisk navržen…"

`batch-019-targets.json` gives both as `status: "navrzeno"`. The batch is internally
inconsistent on exactly this: **verdict-57 handles it correctly** („Garančním výborem byl
navržen Výbor pro zdravotnictví, avšak … ještě nebyl formálně přikázán (stav „navrženo",
17. 12. 2025)"), as do verdict-15 and verdict-49 („byl … **navržen**"). verdict-235
(`prikazano`) and verdict-163 (`prikazano`, `role: dalsi`, and it correctly declines to name
a garanční výbor) are both accurate.

### M6 — verdict-238: a graph_fact about tisk 78 sourced to tisk 238's own node
`verdict-238.json` · `.citations[5]`

Claim: „**Tisk 78** (poslanecký návrh Andreje Babiše) vložil … a byl vyhlášen jako zákon
č. 59/2026 Sb.; textová kolize … zjištěna nebyla." — `source: "bill:tisk:43360"`.
`43360` is **tisk 238's** node (`batch-019-targets.json`). Tisk 78 is `bill:tisk:43185`
(`batch-018-targets.json`). The claim is composite: only its second half belongs to 43360.

### M7 — verdict-15: the political-timing frame is not evidence-bound (see the Priority-1 ruling below)
`verdict-15.json` · `.researchedContext`, `.unstatedEffects[0..1]`, `.citations[3]`

Three separate problems, detailed in "Priority-1 rulings". The sharpest:
`.unstatedEffects[0].evidence` states „Volby … vyhrálo hnutí ANO (34,51 procenta) **před
koalicí Piráti a dalšími stranami**", which contradicts the same verdict's `.citations[3]`
(„koalice SPOLU skončila druhá, dále STAN, Piráti (8,97 procenta) a SPD"). An `evidence`
field that misstates the very result it cites cannot carry a `medium`.

---

## MINOR

- **N1 · verdict-235, negation dropped.** `.researchedContext`: „…zákon č. 71/2026 Sb. byl
  v § 21b vázán výslovně na měsíc březen 2026 a **nesl** žádné dlouhodobé přerozdělovací
  pravidlo." Reads as the opposite of the intended (and correct, per published verdict-70)
  claim; should be `nenesl`. Same field also carries two orthography errors: `potvrduje`
  (→ potvrzuje) and `predvídatelný` (→ předvídatelný).
- **N2 · verdict-235, a false numeric pairing.** `.statedReasoning`: „zvyšuje vyměřovací
  základ … **z 14 074 Kč** na 18 362 Kč měsíčně (**měsíční platba tak stoupne z 2 188 Kč**
  na 2 479 Kč)". The print's own table pairs 14 074 Kč with **1 900 Kč** (2023); 2 188 Kč
  belongs to **16 206 Kč**, the base actually in force for 2026 under nařízení vlády
  č. 357/2025 Sb. Čl. I bod 1 does replace the literal `14 074 Kč`, so the first half is
  textually right — but joining the two makes a false pair, and the 16 206 Kč figure (which
  is what the increase is really measured against, and the reason the +21 mld. is not a
  +30 % jump) never appears in the verdict.
- **N3 · verdict-235, unsupported comparative.** „…jednorázovou, politicky stanovenou částkou
  18 362 Kč (**vyšší než by odpovídalo pokračování valorizace**)" — inferable from the
  print's 585,3 vs 582,1 mld. gap, but stated with no basis given.
- **N4 · re-inflected quotations (meaning intact, not verbatim).** verdict-57
  „nezbytné legislativně-technické změny" (source: „došlo k nezbytným
  legislativně-technickým změnám", ×2 fields); verdict-235 „parametrická změna" (source:
  „parametrickou změnu"); verdict-235 „bylo požádáno o neprovedení meziresortního
  připomínkového řízení" (source: „…**meziresortní připomínkové řízení k tomuto návrhu**" —
  the verdict silently corrects the source's own grammar inside quotation marks);
  verdict-59 „odstranění povinnosti jeho dalšího vedení" (source: „čímž se **odstraní
  povinnost** jeho dalšího vedení"); verdict-59 „ČÁST ČTVRTÁ **—** FOND REINVESTICE ZISKU"
  (source has no dash); verdict-238 „28. a 29. srpna **1948**" (source: „…se účastnilo
  **28. a 29. srpna** více než 100 000 orelských poutníků"; the year is a different sentence).
- **N5 · verdict-163, procedural verb.** „vláda … jeden z nich ve stejném období **odmítla**"
  / „vláda k němu **zaujala nesouhlasné stanovisko**". The second is right; the first inflates
  a non-binding government opinion into a rejection. Same field's „**stát** reagoval dvěma
  … nástroji" flattens a government bill and an opposition MPs' bill into one actor.
- **N6 · verdict-243, factual slip.** „Petr Hladík (**pět brněnských městských a krajských
  podniků**)" — MERO ČR, a.s. (IČO 60193468) is a national state pipeline company, not a Brno
  municipal/regional undertaking; the verdict itself later calls it „ropovodní společnost".
- **N7 · verdict-49, source quality.** The load-bearing institutional link („Zdeněk Hřib byl
  primátorem hlavního města Prahy od listopadu 2018 do února 2023") is cited solely to
  `en.wikipedia.org`. The fact is uncontroversial, but a finding about a named person should
  cite a primary or press source. The three other web citations
  (`ekonomickydenik.cz` ×2, `prazskypatriot.cz`) carry **both** unstated effects and are not
  verifiable offline; the `ekonomickydenik.cz/vyjimka-pro-mestsky-okruh/` slug in particular
  should be re-fetched before publication.
- **N8 · typographic inconsistency across the batch.** Five verdicts (15, 219, 238, 243, plus
  parts of 49) use `—`/`–`; five (5, 57, 59, 163, 235) use ASCII `-` as the dash throughout.
  No ASCII quote pairs and no homoglyphs anywhere (measured, 0/0).
- **N9 · migration script header contains a checkably false collateral claim.**
  `summary-source-migrate-019.ts:14`: „(§ 9o occurs 0×)". Measured over
  `.data/law-collision-cache/tisk-106/` (both cached files): **§ 9o occurs 1×**, in the
  *platné znění* attachment (`267578.txt`), inside § 9n odst. 1 písm. h): „obec v rozsahu
  kontroly dodržování jí vydaného nařízení obce **podle § 9o**." The same "0×" wording is in
  the published verdict-107 („označení § 9o se v jeho textu nevyskytuje"). **This does not
  affect the 9m→9n correction, which is independently confirmed** (bod 38: „Za § 9m se vkládá
  nový § 9n"; no bod inserts § 9o) — but it is a live signal that tisk 106's own attachment
  already cross-references tisk 107's intended § 9o, which is materially relevant to
  verdict-107's coordination finding and should be carried to the batch-020 backlog.
- **N10 · migration leaves store and payload one row apart, undisclosed.** PREPARE reports
  `140 summary_source props`; the payload has **141** rows. Cause (measured, SELECT-only):
  `bill:tisk:43197` (tisk 87, „Nový zákon o zemských znacích a vlajkách") carries **no
  `summary_source` prop at all** — it is not skipped by a guard, it simply has nothing to
  migrate. Every other bill (140/140) carries a cache path; 0 already carry a URL. The script
  neither creates the missing prop nor reports the gap, while its own header states the prop
  „must not diverge from" the payload. Benign (nothing false is written) but should be
  printed by the script.
- **N11 · the store correction is not mirrored in the archival payload.** After pass 53 the
  store's `forensic_stated_reasoning` for tisk 106 will read „§ 9e až § 9n" while
  `payloads/verdicts-016/verdict-106.json` still reads „nový § 9e až § 9m" (measured: 1
  occurrence). Either mirror the correction into the payload or state in the batch note that
  the store is canonical and the payload is the as-published archive.

---

## Priority-1 rulings

### (a) verdict-15 — the `medium` is NOT earned; the framing crosses into editorializing

**What is solid.** Every text-side fact re-verified verbatim against `tisk-15/265165.txt`:
the § 53 odst. 2 quotation (1 exact hit), bod 1.2.1, `Pl. ÚS 7/22`, effect date 1. 1. 2026,
signature date **10. listopadu 2025** (with digital-signature timestamps 2025.11.10 09:39 and
11:26). Committee routing („dne 17. prosince 2025 **navržen** ústavně právní výbor") matches
`committeeRouting: [{organ:"ÚPV", role:"garancni", status:"navrzeno", assignedOn:"2025-12-17"}]`
exactly — the correct weak verb. The conflict assessment is a measured absence (all three
sponsors carry 0 rows in `case-money/ledger.json`) and correctly says the finding is
institutional-political, not personal enrichment.

**Why the medium fails.**

1. **The second unstated effect — half the medium — is about a different bill.** It rests
   entirely on a 3 July 2026 news report of a vote (110 of 136) on „úprava jednacího řádu **s
   obdobným obsahem**", whose described content (1–5 minute speeches on the first sitting day)
   is *not* tisk 15's scheme (20-minute general limit, 13:00 cutoff, three-fifths quorum). The
   verdict never establishes that this is a different bill rather than tisk 15 itself, and
   never checks tisk 15's own `historie.sqw`. It then transfers a motive evidenced at that
   other bill's floor debate onto tisk 15, and assigns `whoBenefits: „Vláda a její většina"`.
2. **The timing premise is unsourced and imprecise.** „…a z vládní strany předchozího
   volebního období (2021–2025) se přesunuli do opozice" carries no citation. The Pirates left
   the Fiala government in **October 2024**, roughly a year before the election the verdict
   ties the filing to — so the framing „a governing party filing this the week it lost power"
   is not what the record shows.
3. **The evidence field misstates its own citation** (M7): „před koalicí Piráti a dalšími
   stranami" vs `citations[3]`'s „koalice SPOLU skončila druhá".
4. **The finding runs against its own subjects.** The verdict states plainly that the sponsors
   „tím sami omezují nástroj, který by mohli potřebovat ve své nové roli menšiny". A bill whose
   sponsors are its own most likely victims is a political observation, not a conflict finding.
   Against the batch ladder (a five-pair numbering collision = medium; batch-018's demoted
   verdict-107 = medium), this does not reach it.

**Ruling: demote to `low`**, keeping the verified text-side description and the neutral
timing note; drop unstatedEffects[1] entirely unless psp.cz's tisk-15 history establishes that
the 3 July 2026 vote concerned a different print, in which case state that fact and cite it.
Fix B4 and M7 regardless.

### (b) The P2 migration — READY, subject to N9/N10/N11

- `git diff` of `payloads/bill-summaries-cz.json`: **284 changed lines, 282 `source` + 2
  `generatedAt`, and nothing else** (measured by field-key histogram over the diff). Every
  `summary`, `method`, `cislo` and `billUrn` is byte-identical.
- **All 141 URLs well-formed and correctly keyed**: 141/141 match
  `^https://www\.psp\.cz/sqw/text/tiskt\.sqw\?o=10&ct=(\d+)&ct1=0$` with `ct` equal to the
  row's own `cislo`; 141 distinct `cislo` values; 0 malformed, 0 mismatched. `covered: 141`,
  `missing: 0`. The top-level `source` field still discloses the derivation
  („deterministic derivation from .data/law-collision-cache/… (pdftotext of the print's own
  PDF on psp.cz)") — correct: the payload does not pretend the summaries were read off the URL.
- **PREPARE re-run by me**: `140 summary_source props → psp.cz URLs · verdict-106 range
  9m → 9n (1 field)` / `PREPARE only`. The 140-vs-141 delta is fully explained by tisk 87
  (N10) — benign.
- **Guards read and judged sound.** Idempotent (`/law-collision-cache|\.txt/` cannot match a
  URL, and 0 bills already carry a URL); throws on a cache path with no `cislo` (0 such bills);
  throws unless tisk 106 exists, carries `forensic_stated_reasoning`, carries
  `forensic_provenance`, and contains **exactly one** occurrence of the old range — measured in
  the live store: `1` occurrence of „nový § 9e až § 9m", `0` of „§ 9n", `0` of „§ 9o". Edits
  are additive (`summary_source_migration`, `forensic_provenance.range_correction`) and the
  node spread `{...b, props}` preserves everything else. Nothing else can be touched.
- **Correctness of the one content edit, independently re-derived**: tisk 106 bod 38 reads
  „Za § 9m se vkládá nový § 9n"; no bod inserts § 9o. The edit is exactly what published
  verdict-107 (pass 52) already states on the record („přímým měřením textu tisku 106 vkládá
  tento tisk §§ 9e až 9n … a toto měření jej opravuje") — **no cross-verdict contradiction.**

**Ruling: the migration may run with `--commit` at closure.** It is blocked only by the batch
gate, not by any defect of its own. Before running, print the tisk-87 gap (N10), correct the
„§ 9o occurs 0×" comment (N9), and decide N11.

---

## Verified clean

- **Quotation sweep** — 63 typographically-quoted strings across all 10 verdicts re-located
  in the cached prints (NFC, zero-width stripped, dash/quote folded). Beyond B1–B3 and N4,
  every one is verbatim, including all 25 date-name strings in verdict-238 and both § 23
  odst. 13/14 strings in verdict-49.
- **Money rule (verdict-243) — fully compliant.** Every tie re-derived from
  `case-money/ledger.json`: Hladík (6881) has exactly 5 ties; **Teplárny Brno, a.s.
  (46347534) is `manager`** — the only attributable one, at 23 570 594 010 Kč, matching
  `targets.contractCzk` exactly; ARENA BRNO (09133267), SAKO Brno (60713470), Dopravní podnik
  města Brna (25508881) and MERO ČR (60193468) are all `steward`, all four labelled „penězi
  instituce, nikoli poslance" at every mention. Výborný (6513): one `steward` tie, Gymnázium
  Pardubice (48161063), 17 804 078 Kč, labelled. Talíř (7052): 0 rows — a **measured** absence,
  correctly stated as such. Roles match the ledger word for word. All 6 render „čeká na
  lidskou kontrolu"; ledger `reviewState` is `pending_review` on all 6. Enumeration complete;
  no steward money attributed anywhere.
- **verdict-238's senator data-gap formula — correct.** Measured: no `Klement` and no
  `Vystrčil` row exists in the 211-tie ledger, and the verdict says so as a *coverage gap*
  („nelze … ani potvrdit, ani vyloučit"), not as a clearance — the right distinction, and the
  exact opposite treatment from Talíř's measured absence in verdict-243. Both of its claims
  are re-derived from tisk 238's **own** text, not copied from verdict-78: the platné znění's
  already-effective „30. březen – Den české vlajky" and the novelizační věta's citation of
  zákon č. 59/2026 Sb. are both located verbatim. It even reproduces the print's own typo
  („zákona č. 92/2022", without „Sb.") rather than silently repairing it.
- **verdict-57's coordinated-numbering finding — fully verbatim.** The print documents the
  § 53b → § 53a renumbering in its own obecná část and names the expired PSP9 tisky 927 and
  918 („…původní sněmoví tisk 927 v projednávání předstihne původní sněmovní tisk 918, mění se
  i označení ustanovení § 53b na § 53a včetně odkazů…"). No operative collision with tisk 153:
  tisk 57 inserts §§ 8a, 8b, 27a, 39a, 53a; `§ 62b` occurs **0×** in tisk 57's cache; the
  §§ 53b/62b claim is correctly sourced to `bill:tisk:43274`, which is tisk 153's node per
  `batch-018-targets.json` — and matches published verdict-153.
- **verdict-163's substantive findings — grep-backed.** The „more than 80 %" figure cites only
  a chart, verified: „Nárůst ceny ropy o více než 80 % se promítá do ceny…" with „Obrázek 1:
  Vývoj ceny barelu ropy Brent. Zdroj: www.kurzy.cz" and no period, no date and no table
  anywhere near it. The e-Legislativa bypass is in the new § 10 odst. 5 („…lze, vyžaduje-li to
  veřejný zájem, připravit cenový výměr bez využití systému e-Legislativa"), justified by
  „To je v rozporu s principy vynucovanými zákonem o cenách". Court review: „Cenový výměr
  vydaný vládou nebude možné napadnout u správního soudu…", čl. 87 odst. 1 písm. b) and čl. 95
  odst. 1 both present. Bod 11's corruption clearance rests verbatim on „lepší veřejnou
  kontrolu". The 13 April 2026 signing is the print's own („V Praze dne 13. dubna 2026",
  digital signatures 13.04.2026); the 14 April 2026 government stance on tisk 133 matches
  published verdict-133 and is sourced to `psp.cz/sqw/historie.sqw?o=10&t=133` +
  `bill:tisk:43256`, which is tisk 133's node. `„účinná od 8. dubna 2026"` verbatim.
- **verdict-219's core finding — fully verbatim and correct.** § 2 odst. 3/4 (exclusive
  organizer), § 7 odst. 1 (chamber proposes, ministry approves the zkušební řád), § 18 odst.
  1/2/3 (fee capped at cost; published; „Příjem z poplatku za vykonání mistrovské zkoušky je
  příjmem rozpočtu komory") and § 19's new písm. n) all located verbatim. The absence claim is
  grep-backed: the Metodika CIA table's only substantive row on this point is
  „odpovědnost … odpovědnost obou komor a ministerstev", and the single identified risk is
  exam fraud („…možnost úspěšného složení mistrovské zkoušky ze strany uchazeče, který
  nedisponuje mistrovskou kvalifikací…"), with nothing on the chamber's triple role. 2 000 /
  1 600 / 30 tisíc Kč / three 13th-grade posts / „v řádu desítek milionů Kč ročně" all
  verbatim. (Scoping defect at M4.)
- **verdict-243's non-money findings.** The srovnávací tabulka exists verbatim („Den Současný
  stav Návrh … Velký pátek otevřeno zavřeno … 17. listopad otevřeno zavřeno"); the count
  closes (5 newly-closed days: Velký pátek, 1. květen, 5. + 6. červenec, 17. listopad, exactly
  matching the table and the DZ's own „…dopadne i na 5. červenec, 6. červenec a 17. listopad …
  Velký pátek a 1. květen"); § 1 odst. 3 is unchanged verbatim; „rozšíření počtu dní, kdy se
  zákaz prodeje uplatní" verbatim; Pl. ÚS 37/16 and the AT/DE/PL/DK comparison present. The
  § 4 non-collision claim with tisky 78/238 holds: tisk 243 touches only státní/ostatní
  svátky, not významné dny. `low` is right.
- **verdict-5's § 20d reading.** § 20d's carve-out quoted verbatim; 1,5 mld. Kč / 100 mil. Kč
  / 6 months / „alespoň 9 systemizovanými místy" / 10 000 000 Kč / zákaz činnosti 5 let /
  § 251a odst. 2 zákona č. 374/2015 Sb. all verified. The unstated effect (everything outside
  ČTÚ/ERÚ/ČNB is fully exposed, never compared in the report) is sound. `low` / confidence 3
  correct. (Defect: B4 only.)
- **verdict-49's text side.** §§ 23 odst. 13 and 14 verbatim; „říjnu 2027", „patnáctým dnem po
  jeho vyhlášení", zákon č. 465/2023 Sb., bod 1.2, signature 27. 11. 2025 all verified. The
  Libeňská spojka / Radlická radiála detail is correctly attributed to press, not to the print
  (0 hits in the cache). `low` correct.
- **Committee routing** — all 10 checked against `batch-019-targets.json`: 15 ✓, 49 ✓, 5 ✓,
  57 ✓ (best-in-batch), 163 ✓, 235 ✓, 238 ✓ (none claimed, none in targets), 243 ✓ (idem);
  219 and 59 inflated (M5).
- **Cross-verdict contradiction** — none found. verdict-235 vs published verdict-70: 235 says
  tisk 235 is **not** the previously announced predictor reform and describes zákon
  č. 71/2026 Sb. as a March-2026-bound one-off — which is exactly verdict-70's record; no
  published finding is inverted. verdict-163 vs verdict-133: dates and the „přesné srovnávané
  datum" contrast agree. verdict-238 vs verdict-78: agree. verdict-57 vs verdict-153: agree.
  The migration's 9m→9n edit agrees with verdict-107.
- **`lawJargonIssues`** over `statedReasoning`, `researchedContext`, `conflictAssessment` and
  every `unstatedEffects[].{effect,whoBenefits,evidence}` and `citations[].claim` in all 10
  verdicts: **0 issues, all 10 clean.**
- **Evidence doctrine** — 0 local paths, 0 PDF/TXT filenames, 0 line numbers, 0 cache
  references in any reader-facing field across all 10 verdicts. All `bill_text` sources are
  `psp.cz/sqw/text/tiskt.sqw` URLs with the right `ct`; all `graph_fact` sources are node ids
  (one wrong, M6); all `law` sources are `NNN/YYYY` refs.
- **Typography / encoding** — 0 ASCII quote pairs inside Czech strings, 0 Cyrillic homoglyphs,
  0 stray zero-width or non-breaking characters, 0 NFC violations across all 10 files.
- **`whoBenefits`** — present and non-empty on all 17 unstated effects; 6 of them correctly
  decline to name a beneficiary („Nelze určit / Nelze jednoznačně určit / Nejde o osobní
  prospěch…") rather than inventing one.
- **Severity ladder** — 5 medium (15, 59, 163, 219, 235), 5 low (5, 49, 57, 238, 243).
  Independent of the defects above, 163/219/235 earn their medium on verified substance;
  59's rests partly on M2/M3; 15's does not (ruling (a)).

---

## What must happen before the pass-53 write

1. Fix B1, B2 (verdict-235), B3 (verdict-57) — remove or make verbatim; B3 additionally
   requires the whoBenefits to be re-reasoned from tisk 57's actual mechanism.
2. Fix B4 in all three verdicts — print the sněmovní tisk number, not the graph node id.
3. Fix M1 (verdict-163 locators), M2/M3 (verdict-59), M4 (verdict-219 scoping), M5 (219 + 59
   verbs), M6 (verdict-238 citation source).
4. Re-rule verdict-15 per (a), and fix M7.
5. Re-run this quotation sweep after the edits — every fix touches a quoted or cited field.
6. The P2 migration itself needs no change to run; address N9/N10/N11 as hygiene.

---

# Closure re-verification (post-remediation, independent re-measurement)

## CLOSURE: NOT CLOSED

**Cleared, re-verified against the NFC cached prints:** B1 (verdict-235 „je pouhým nouzovým
řešením pro letošní rok" now verbatim in `.researchedContext` *and* `.citations[3].claim`,
carried by „slovy, že …" / „uvádí, že …"), B2 (the splice restored to
„…udržitelnosti, toto jednorázové opatření nemá vliv"), B3 (verdict-57's evidence now quotes
tisk 57's own print — „že se v tomto volebním období připomínkové řízení k návrhu zákona
neprovede" — and the whoBenefits asserts no request), B4 (**0** `43[0-9]{3}` tokens in any
non-`source` field across all 10 verdicts; the five remaining are legitimate `graph_fact`
node ids). Also cleared: M2, M5 (both routing sentences now „byl … navržen"), M6 (kind +
source), M7, and ruling (a)'s demotion (15 → `low`, ue 2→1, cit 7→6; batch is 4 medium /
6 low). Migration hygiene N9/N10/N11 all three landed — the § 9o comment now matches my
measurement exactly, and PREPARE prints both disclosures. `lawJargonIssues` 10/10 clean;
0 ASCII quote pairs, 0 homoglyphs, 0 NFC violations, 0 path-like citations, 0 empty
`whoBenefits`; **no new composed quotation was introduced** by the repairs.

**One systematic gap explains items 2–5: the remediation edited `unstatedEffects` and
`citations` but left `researchedContext` untouched.** Four verdicts now contradict themselves
across their own fields.

### Surviving items

1. **BLOCKING — verdict-15: a vote count and party-level voting claims now stand with ZERO
   citation.** `.researchedContext` still carries the July-2026 paragraph in full — „Podle
   pozdějšího zpravodajství (**3. července 2026**) prošla Sněmovnou úprava jednacího řádu …
   poměrem **110 ze 136 přítomných poslanců**; pro hlasovala koalice ANO, SPD a Motoristé sobě
   spolu s většinou ODS a STAN a částí Pirátů, zatímco část poslanců KDU-ČSL a všichni
   přítomní poslanci TOP 09 hlasovali proti z obavy o oslabení nástrojů opozice zablokovat
   vládní návrh týkající se financování České televize a Českého rozhlasu." — while its
   **only** supporting source was deleted in the pruning. Measured: `2845839` occurs **0×** in
   the file; the six surviving citations are 90/1995, the tisk-15 print ×2, the election
   result, the coalition contract, and psp.cz historie — **none covers the date, the count,
   the party splits or the ČT/ČRo motive.** This is a direct brand-rule violation (every
   rendered number cites its source) and is strictly worse than the pre-remediation state,
   where the assertion at least carried its source. Either restore the citation or delete the
   paragraph with the effect it supported.
2. **MAJOR — verdict-15: the imprecise „vládní strana" premise survives, uncited, ×2.**
   `.researchedContext`: „…a **z vládní strany předchozího volebního období (2021–2025) se
   přesunuli do opozice**." `.conflictAssessment`: „…(**přesun předkladatelské strany z vládní
   do opoziční pozice** bezprostředně před podáním návrhu)…". Only `.unstatedEffects[0].effect`
   received the agreed replacement („poslanci strany, která je po volbách v říjnu 2025
   v opozici"), so one verdict now states the premise two ways.
3. **MAJOR — verdict-163: the M1 misattribution survives in `researchedContext`.** It still
   reads „**Zvláštní část** zprávy k bodu 3 (soulad s ústavním pořádkem)", while
   `.unstatedEffects[2].evidence` and `.citations[2]` were both corrected to „**Obecná část** …
   bod 3". Re-measured by offset against the section headings of `tisk-163/269172.txt`: the
   „nebude možné napadnout u správního soudu" / „čl. 87 odst. 1 písm. b)" passage sits at
   offsets 10277/10476, inside **bod 3 of the obecná část** — the corrected fields are right
   and `researchedContext` is wrong. (Residual minor: the navrhovatel enumeration folded into
   the same sentence — „poslanci, senátoři, veřejný ochránce práv, zastupitelstvo kraje" — is
   measured at offset 9397, i.e. in **bod 2**, not bod 3.)
4. **MAJOR — verdict-219: the unscoped fiscal absolute survives in `researchedContext`.**
   It still ends „…čistý fiskální dopad tak **zpráva nikde nesčítá**", with no mention of the
   RIA annex — while `.unstatedEffects[1].effect` now correctly reads „…nelze zjistit **ze
   samotné zprávy** (její bod 8 odkazuje na závěrečnou zprávu z hodnocení dopadů regulace,
   která není součástí archivovaného tisku a nebyla v rámci tohoto zpracování čtena)". M4 is
   half-applied.
5. **MAJOR — verdict-59: the prior-law assertion survives in `researchedContext` and now
   contradicts the disclosure added beside it.** It still reads „…(**dosavadní § 17 odst. 4
   vylučoval zrušení fondu jinak než za podmínek určených zákonem**)…" — the „dosavadní" label
   on what is in fact the **new** § 17 odst. 4 of the operative text — while
   `.unstatedEffects[1].effect` now states „platné znění zákona č. 468/2024 Sb. není součástí
   archivovaného tisku, takže **přesná dosavadní pravidla zrušení fondu z něj ověřit nelze**".
   One verdict simultaneously asserts the old rule and says the old rule cannot be verified.
6. **MINOR — verdict-235: the dropped negation (N1) survives.** „…byl v § 21b vázán výslovně
   na měsíc březen 2026 a **nesl** žádné dlouhodobé přerozdělovací pravidlo" (→ `nenesl`);
   `potvrduje` and `předvídatelný` are still misspelled in the same field. The sentence is a
   cross-verdict consistency statement about published verdict-70 and currently reads as its
   opposite.
7. **MINOR — verdict-59: the odstavec enumeration is still inaccurate** in
   `.researchedContext` and `.citations[3].claim` — „odstavcům 1 (**výše přídělu**), 3
   (převzetí aktiv…)": the >50 % allocation is **odst. 2**, and the zvláštní část discusses
   **odst. 3 nowhere**. (The core § 17 odst. 5 absence claim remains verified and correct.)
8. **MINOR — the re-inflected quotations (N4) all survive**: verdict-57 „nezbytné
   legislativně-technické změny" ×2 (source: „došlo k nezbytným legislativně-technickým
   změnám"); verdict-235 „parametrická změna" and „bylo požádáno o neprovedení
   **meziresortního připomínkového řízení**" (source: „…meziresortní připomínkové řízení
   k tomuto návrhu" — the source's own grammar is silently repaired inside quotation marks);
   verdict-59 „ČÁST ČTVRTÁ **—** FOND REINVESTICE ZISKU" (inserted dash) and „odstranění
   povinnosti jeho dalšího vedení"; verdict-238 „28. a 29. srpna **1948**".
9. **MINOR — verdict-238 `.citations[5]`**: the kind/source fix landed, but the claim's second
   clause („textová kolize mezi tiskem 78 a tiskem 238 z archivovaných textů zjištěna nebyla")
   is the analyst's conclusion, which a `bill_text` citation to tisk 78's document cannot
   support any more than the old `graph_fact` could. Split the claim.
10. **MINOR — N6/N7 untouched**: verdict-243 „Petr Hladík (**pět brněnských městských a
    krajských podniků**)" — MERO ČR, a.s. is a national state pipeline company; verdict-49's
    Hřib mayoralty is still sourced solely to `en.wikipedia.org`, and its three press URLs
    remain unverified offline.

**Item 1 alone gates the batch.** Items 2–5 are one mechanical pass over four
`researchedContext` fields. Re-run the quotation sweep after any further edit.

## CLOSURE: NOT CLOSED

---

# Round-3 closure re-verification (independent re-measurement of the file state)

## CLOSURE: CLOSED

**No BLOCKING and no MAJOR item survives.** One MINOR carry-forward is recorded below; it does
not gate pass 53 but must be corrected before verdict-59 is published.

### Round-2 items 1–6 and 8–10 — cleared, each re-measured

1. **CLEARED (was BLOCKING).** verdict-15's `researchedContext` no longer contains the
   July-2026 passage in any form: measured **0** occurrences of „3. července 2026", „110 ze
   136", „TOP 09", „KDU-ČSL" and „České televize" anywhere in the file. What remains is
   citation-covered end to end — the § 53 odst. 2 quotation and bod 1.2.1 (citations 1–2, both
   re-confirmed verbatim against `tisk-15/265165.txt`), the signature date 10. 11. 2025 and the
   1. 1. 2026 effect date (the print), 34,51 % / 8,97 % (citation 3), the coalition agreement of
   3. 11. 2025 (citation 4). No uncited number remains.
2. **CLEARED.** The premise now reads „…a **jsou po těchto volbách opoziční stranou**"
   (`researchedContext`) and „**opoziční pozice předkladatelské strany po volbách v říjnu
   2025**" (`conflictAssessment`) — precise, and consistent with `unstatedEffects[0].effect`.
   Measured: 0 occurrences of „z vládní strany předchozího volebního období" and 0 of
   „z vládní do opoziční".
3. **CLEARED.** verdict-163: „Zvláštní část zprávy k bodu" → **0**; „Obecná část zprávy
   (bod 3, …)" → **3** (`researchedContext`, `unstatedEffects[2].effect`, `citations[2]`), which
   matches my offset measurement of `tisk-163/269172.txt` (the passage is at 10277/10476, inside
   bod 3 of the obecná část).
4. **CLEARED.** verdict-219: „nikde nesčítá" → **0**; both `researchedContext` and
   `unstatedEffects[1].effect` now end with the identical scoping and disclosure („…nelze zjistit
   ze samotné zprávy; její bod 8 odkazuje na závěrečnou zprávu z hodnocení dopadů regulace, která
   není součástí archivovaného tisku a nebyla v rámci tohoto zpracování čtena").
5. **CLEARED.** verdict-59: „dosavadní § 17 odst. 4 vylučoval…" → **0**. Both
   `researchedContext` and `unstatedEffects[1].effect` now carry „platné znění zákona
   č. 468/2024 Sb. není součástí archivovaného tisku, takže přesná dosavadní pravidla zrušení
   fondu z něj ověřit nelze", and the protiobcházecí sentence is scoped to „podle dostupného
   textu tisku … (platné znění není archivováno)". The contradiction is gone.
6. **CLEARED (partially).** verdict-235: `nenesl` ✓, `potvrzuje` ✓ (`potvrduje` → 0). The third
   orthography item I raised, **`predvídatelný`** in `unstatedEffects[0].effect` (missing háček),
   survives — cosmetic, no claim depends on it.
8. **CLEARED.** All seven re-inflected quotations are de-quoted or corrected; the full
   quotation sweep over all 10 verdicts now returns **only legitimate misses**: three marked
   elisions (`…` / `...` in 163, 235, 243), one cross-bill quote („připravované širší změny
   parametrů přerozdělování pojistného" — I re-verified this **verbatim in tisk 70's own print**,
   `tisk-70/266238.txt`, and identically in published verdict-70, correctly attributed to
   „dřívější tisk"), one press quote in 49 (web-sourced by design), tisk 153's „Program pro
   pacienty" in 57 (correctly sourced to `bill:tisk:43274`), the status token „navrženo", and two
   cosmetic self-coinages in 59 („Fond reinvestice zisku" as the part's name; „účelu jednání" as
   the verdict's own criterion label). **No fabricated or composed quotation remains anywhere.**
9. **CLEARED.** verdict-238 `citations[5]` now ends at the Sbírka fact; the analytic
   non-collision tail is removed and lives in the verdict's prose. Kind `bill_text`, source
   tisk 78's psp.cz document URL.
10. **CLEARED.** verdict-243: „pět brněnských…" → **0**, now „čtyři brněnské městské a krajské
    podniky a **státní podnik s celostátní působností (MERO ČR)**" — accurate. verdict-49's
    Hřib citation now self-discloses („…podle **encyklopedického zdroje** …; jde o **jediný
    pramen**, o který se tato datace v tomto hodnocení opírá").

### Surviving item

1. **MINOR — verdict-59: the odstavec enumeration was fixed in ONE field of three, and the
   verdict now contradicts itself.**
   - `.unstatedEffects[0].effect`: „Zvláštní část zprávy vykládá u § 17 jen **odstavce 1, 2 a 4**"
     (fixed, as reported)
   - `.researchedContext`: „…věnuje jen odstavcům **1** (výše přídělu), **3** (převzetí aktiv
     z fondu jiného podniku) a **4**…" (**unchanged**)
   - `.citations[3].claim`: „…vykládá pouze úpravu přídělu do fondu (**odstavec 1**), převzetí
     aktiv od jiného podniku (**odstavec 3**) a postup při zániku statusu (odstavec 4)…"
     (**unchanged**)

   One verdict now says the zvláštní část covers odst. 2 in one field and odst. 3 in two others,
   and the wrong set is the one carried by the `citations[]` entry — the field a reader checks.
   Measured against `tisk-59/266065.txt`: the zvláštní část K čl. I discusses the >50 %
   allocation (**odst. 2**) and „úpravu navrhovanou v **odstavci 4**", plus §§ 18/19/20; it
   discusses **neither odst. 1 nor odst. 3**. So „1, 2 a 4" is the closer of the two and „1, 3
   a 4" is wrong, though strictly the set is {2, 4}.

   **Why this does not gate:** the load-bearing finding is unaffected and independently
   verified — § 17 odst. 5 („Pro účely určení navýšení fondu se nepřihlíží k jednáním, jejichž
   účelem je snížit příděl do fondu.") occurs exactly once in the print, in the operative text,
   and appears in neither the obecná nor the zvláštní část. All three renderings of that claim
   are correct. The defect is confined to a subsidiary descriptive list. It is classed MINOR for
   the same reason it was classed MINOR in rounds 1 and 2, and MINORs have not gated this batch.

### Standing gates re-run on the final file state

- **Quotation sweep** over all 10 verdicts: 0 fabricated, 0 composed, 0 cross-bill
  misattributions; every remaining miss triaged above.
- **`43[0-9]{3}` scan**: **0** occurrences in any non-`source` field; the five surviving tokens
  are legitimate `graph_fact` node ids (163→43256 = tisk 133, 219→43341, 235→43357,
  57→43274 = tisk 153, 59→43166), each matching its batch's targets file.
- **`lawJargonIssues`**: 10/10 clean.
- **Typography / encoding**: 0 ASCII quote pairs inside Czech strings, 0 Cyrillic homoglyphs,
  0 zero-width or soft-hyphen characters, 0 NFC violations, 0 path-like citations, 0 empty
  `whoBenefits`.
- **Money rule (verdict-243)** re-derived from `case-money/ledger.json` after the edit: all 6
  ties present, Teplárny Brno (46347534) `manager` at 23 570 594 010 Kč attributed, the four
  `steward` ties plus the school all labelled „penězi instituce" (4 occurrences), all
  `pending_review`.
- **Severity/shape**: 4 medium (163, 219, 235, 59) / 6 low (5, 15, 49, 57, 238, 243) — unchanged
  from the gate report; verdict-15 `low`, ue=1, cit=6.
- **P2 migration**: PREPARE re-run — `140 summary_source props → psp.cz URLs · verdict-106 range
  9m → 9n (1 field)` with both disclosures printed (the tisk-87 gap naming `bill:tisk:43197`,
  and the archived-payload divergence). The § 9o comment now matches my own measurement exactly.
  **Cleared to run with `--commit` at closure.**

## CLOSURE: CLOSED
