# Batch-011 adversarial audit — 12 gated verdicts + 16 collision close-reads

**Auditor:** independent adversarial pass (Opus), 2026-08-04.
**Scope:** `payloads/verdicts-011/*.json` (12), `payloads/collision-close-reads-batch011-g{A,B}.json` (16 pairs).
**Method:** every claim re-derived from the primary cached text (`.data/law-collision-cache/tisk-<n>/*.txt`),
NFC-normalised before matching (helper: `readFileSync(...,'utf8').normalize('NFC')` then line-regex — plain
`rg` on these PDF-extracted files is unsafe because the Czech diacritics arrive decomposed). Money claims
re-derived from `batch-011-targets.json`. Three URLs spot-fetched. The batch's own machine gate was re-run.
**No verdict or close-read file was modified. No git command was run. No PGlite database was opened.**

---

## VERDICT: **READY WITH CAVEATS**

Nothing in this batch is fabricated. Every `č. N/RRRR Sb.` cited anywhere in any of the 12 verdicts is a real
statute in scope — machine-verified by re-running the batch's own gate (`npx tsx
scripts/case-loops/law/gate-verdicts-011.ts` → `GATE: 12/12 batch-011 verdicts pass`), which enforces the
anti-fabrication rule in `lib/analysis/law-verdict.ts`. Every quoted legislative excerpt I checked — and I
checked 21 of them across 7 bills — occurs **verbatim** in the named bill at the claimed provision. Two of the
three spot-fetched URLs resolve and support their claim; the third resolves via search but not via fetch.

But **1 BLOCKING and 8 MAJOR findings must be fixed before persistence.** Six of them sit in the money-touching
claim class, which is exactly where the prompt warned Sonnet historically drifts — and the drift here is in
**both** directions: one verdict double-books a real company into contradictory groups, and three verdicts
declare an absence of conflict on reasoning that the primary text does not support.

Severity distribution is also questionable at one point: **tisk 64's `medium` is not carried by its own
evidence** and should be `low`.

---

## Priority 1 — the four MEDIUM verdicts

### verdict-67.json (tisk 67, stavební zákon, Babiš a další) — the weakest artifact in the batch

This verdict does the hardest job in the batch and gets the hard part right (the EIA finding is excellent and
exactly verified). Its money bookkeeping is where it breaks.

**[BLOCKING] `unstatedEffects[1].whoBenefits` places Lovochemie in a group it is not attributed to, and
contradicts the verdict's own `conflictAssessment`.**

- Field: `unstatedEffects[1].whoBenefits` — *"chemické a zemědělsko-potravinářské společnosti skupiny AGROFERT
  (CS CABOT, PRECHEZA, Fatra, Synthesia, **Lovochemie**), u nichž byla v cíleném přiřazení batch-010
  identifikována sektorová vazba **přes zákon č. 100/2001 Sb.**"*
- Checked how: enumerated `attributedSectorLeads` in `batch-011-targets.json` grouped by `viaLaw.ref`:
  - `100/2001` → **4** companies: CS CABOT, PRECHEZA, Fatra, Synthesia. **Lovochemie is not among them.**
  - `139/2002` → 5 companies: AGROFERT, Kostelecké uzeniny, AGROPROFIT, **Lovochemie**, AGRONOVA CS.
- So the verdict asserts a batch-010 attribution that does not exist, and it simultaneously lists Lovochemie in
  `conflictAssessment` inside the group it **dismisses** as legislativně-technická (via 139/2002). The same
  named, real company is both "no credible conflict" and "beneficiary of the EIA one-stop-shop" in one verdict.
- Why blocking: this is a false `graph_fact`-class assertion about a named real company inside a verdict that
  will be rendered to Czech readers with Andrej Babiš's name on it. Fix by removing Lovochemie from the
  100/2001 sentence (or by stating explicitly that the analyst is extending beyond the batch-010 attribution
  and saying so in the analyst's own voice).

**[MAJOR] The VAT dismissal is stronger than the primary text supports — and it disposes of four money leads.**

- Field: `researchedContext` and `citations[2].claim` — *"legislativně-technická záměna … **bez věcného dopadu
  na daň z přidané hodnoty** … ani o změnu … **osvobození od DPH u nemovitostí**"*; `conflictAssessment` uses
  this to conclude *"Tyto vazby proto nepředstavují věrohodný střet zájmů"* for Hartenberg Holding, IMOBA,
  IF Holding and IF FACILITY (the four `235/2004` leads).
- Checked how: read the amending instruction and then the accompanying *platné znění*.
  - `tisk-67/266188.txt:6832-6834` (ČÁST DVACÁTÁ OSMÁ, Čl. XXV): *"V § 55a zákona č. 235/2004 Sb. … se
    v odstavci 2 písmeno a) slovo „zastavěného“ nahrazuje slovem „zastavitelného“."*
  - `tisk-67/266190.txt:22315-22322` — **§ 55a is titled "Dodání pozemku"**, and odst. 2 písm. a) is the
    **definition of `stavební pozemek`**: *"(1) Od daně je osvobozeno dodání pozemku, který … b) není stavebním
    pozemkem. (2) Stavebním pozemkem se pro účely daně z přidané hodnoty rozumí pozemek, a) na kterém lze na
    základě územně plánovací dokumentace …, vymezení ~~zastavěného~~ zastavitelného území …"*
- The clause the bill edits **is** the exemption boundary. `zastavitelné území` is the broader of the two
  concepts, so the set of plots that count as a taxable building plot moves. The důvodová zpráva
  (`266188.txt:14718-14722`) says only *"Legislativně-technická změna související se změnou koncepce
  a terminologie ve stavebním zákoně"* — it never claims "no substantive effect on the exemption." The verdict
  upgrades the sponsor's own self-characterisation into a stronger negative finding **in the analyst's voice**,
  and then uses it to clear four companies tied to the bill's lead sponsor.
- Fix: attribute the label to the DZ, name the affected provision (§ 55a "Dodání pozemku", definition of
  stavební pozemek), and say the direction/magnitude of effect was not assessed — do not assert absence.

**[MAJOR] `conflictAssessment` miscounts the attributed leads and leaves one undisposed.**

- Field: `conflictAssessment` — *"U poloviny z **12** atribuovaných sektorových vazeb …"*
- Checked how: `attributedSectorLeads.length` in `batch-011-targets.json` for tisk 67 = **14**, not 12. The
  companies the sentence then names are **9**, not half of anything.
- **SynBiol, a.s. (via zákon č. 258/2000 Sb., sector `health`) is never disposed of anywhere in the verdict** —
  even though `researchedContext` discusses the very provision it hangs on (*"mj. novelizovaný § 77 zákona
  č. 258/2000 Sb."*). A lead left silently unaddressed is a buried finding.

**[MAJOR] The closing "no other sponsor has a sector tie" sentence functions as an absence claim it cannot
carry.**

- Field: `conflictAssessment` — *"Money-vazby ostatních sponzorů (Karel Havlíček, Tomio Okamura, **Boris
  Šťastný** aj.) … neobsahují sektorově atribuovanou vazbu k žádnému z 42 novelizovaných zákonů."*
- Literally true of batch-010's attribution, and materially misleading. Checked how:
  - Boris Šťastný's largest money tie in the sponsor set — and the largest of **any** sponsor on this bill — is
    **Pražské služby, a.s. (IČO 60194120), 53 271 958 488 Kč** (`batch-011-targets.json`, sponsors[tisk 67]).
  - The bill amends **zákon č. 541/2020 Sb., o odpadech** — ČÁST TŘICÁTÁ DEVÁTÁ, Čl. LVII
    (`266188.txt:7384-7433`), and the changes are not cosmetic: waste-facility permitting review moves to the
    stavební úřad (new § 146a), § 149 is repealed, and § 151 odst. 2 folds waste-permit conditions into the
    EIA one-stop-shop the verdict itself flags as the bill's material win for investors.
  - Pražské služby is Prague's municipal waste operator. batch-010's sector heuristic simply did not cover the
    Waste Act.
- The verdict must either dispose of this tie explicitly (including its class — steward vs owner-operator, which
  the targets file does not carry and which the verdict therefore may not assume) or drop the absence sentence.
  Note the repo's own doctrine: a steward seat's institutional contracts are never the MP's — but that has to be
  *said*, not silently relied on.

**Verified correct in verdict-67** (recorded so the batch keeps credit for it):

- The EIA "one-stop-shop" finding is **exactly** right. `unstatedEffects[1].evidence` cites
  `266188.txt` "řádky cca 14461–14486"; the sentence is at **14481-14486** verbatim: *"Nová možnost, aby závazné
  stanovisko EIA nahradilo i další požadované akty, přináší pro investora „one-stop-shop“ řešení pro
  environmentální část projektu. Tím se eliminuje riziko, že stanovisko EIA bude kladné, ale následně bude
  žádost o povolení záměru zamítnuta. Zvyšuje se právní jistota investora v rané fázi projektu…"*
- 42 amended predecessors confirmed: 43 `ČÁST` headings in `266188.txt`, the 43rd being ÚČINNOST.
- The 139/2002 "legislativně-technická" label is verbatim in the DZ (`266188.txt:14613-14614`), and the three
  operative points (§ 3 odst. 3, § 9 odst. 17, § 14 odst. 8) are consistent with it.
- IMOBA contract 1 791 100 Kč ✓ matches the graph. `citations[7]` source `company:ico:26124459` ✓ is IMOBA.
- `citations[7]` legislative status verified by fetch of `https://www.psp.cz/sqw/historie.sqw?o=10&t=67`:
  *"3. čtení proběhlo 10. 7. 2026 na 27. schůzi. Návrh zákona schválen"*, postoupen Senátu 23. 7. 2026 as tisk 272. ✓

**[MINOR] Sourcing hygiene in verdict-67.**

- `citations[4]` (`https://forbes.cz/babisove-firme-imoba-klesly-trzby-loni-na-pet-set-devatenact-milionu-korun/`)
  returned **HTTP 404 to WebFetch**. The article does exist (confirmed by a `forbes.cz`-scoped web search which
  returned the identical URL and its content), so this is bot-blocking, not a hallucinated URL. **However the
  article does not support the specific descriptor** *"mj. jako developer rezidenčních projektů na okraji
  Prahy"* — the portfolio it names is Čapí hnízdo, the Průhonice petrol station, and 21 apartments in Špindlerův
  Mlýn. It does support the load-bearing part (Imoba = real-estate/developer/investment company, a SynBiol
  subsidiary, back in Babiš's ownership).
- `citations[5]` (e15.cz, Hartenberg) fetched cleanly and **supports its claim**: *"Holding Hartenberg ze
  svěřenských fondů premiéra Andreje Babiše (ANO) finančně vstoupil do dvou rezidenčních projektů v Praze"*
  (85 % stakes, Císařská vinice / Rezidence Silurská). ✓
- `unstatedEffects[0].evidence` leans on `lemesani.blog.respekt.cz` and `imoba.cz` — a personal blog and the
  company's own site — for an ownership claim about a named politician. Neither is in `citations`. Weak for the
  claim class.
- The claim that CS CABOT / PRECHEZA / Fatra / Synthesia / Lovochemie are *"společnosti skupiny AGROFERT"* has
  **no citation at all**. The graph records a `linked_to` tie from Babiš; group membership is a separate
  proposition (CS CABOT in particular is a joint venture, not a wholly-owned Agrofert company).
- `citations[7]` asserts the psp.cz status but no prose in the verdict mentions it — so a reader never learns
  that this bill **already passed the Chamber on 10. 7. 2026 and sits in the Senate**, which is material context
  for a medium-severity finding.

---

### verdict-64.json (tisk 64, doprovodný zákon k zákonu o účetnictví) — severity is inflated

**[MAJOR] `severity: "medium"` is not supported by this verdict's own evidence; `low` is the honest call.**

The verdict's `conflictAssessment` is unambiguous and correct: a government bill, one sponsor (Stanjura),
`moneyTies: []`, `attributedSectorLeads: []` — *"selhává samotný předpoklad pro Case-①-typ konfliktu"*. So the
whole of the `medium` rests on two `unstatedEffects`, and neither holds up as one:

1. **`unstatedEffects[0]` is not an effect of the bill — it is a note about Politicas' own census pipeline.**
   Its text is about *"[v]stupní data tohoto batche … evidovala u tisku 64 jen jeden novelizovaný zákon namísto
   skutečných 147"* and it is explicitly *"již opravený v samotném vstupu tohoto batche"*. The field's contract
   (`lib/analysis/law-verdict.ts`: *"hypothesise unstated economic/negative effects"*) is about the legislation.
   Persisting our own data-quality history as a forensic finding **on tisk 64** would render, on `/zakony`, as
   a finding about that bill. That is a category error with a reputational surface.
2. **`unstatedEffects[1]`'s premise — that the staggered effectiveness is unexplained — is contradicted by the
   důvodová zpráva.** The verdict quotes Čl. CLX correctly (verified verbatim at `tisk-64/266153.txt:12764-12770`:
   *"…b) ustanovení čl. XXIII bodů 332, 334, 336, 339, 340, 348, 360 a 361 a čl. LIX, která nabývají účinnosti
   dnem 1. ledna 2030."*). But the DZ's zvláštní část **does** explain it — `266153.txt:39091-39098`, *"K čl. CLX:
   V případě novely zákona o daních z příjmů zavádějící možnost správy daně z příjmů v eurech se navrhuje
   odložená účinnost o dva roky. Důvodem je poskytnutí dostatku času na přípravu infrastruktury systému pro
   správu daní."* The verdict hedges to *"bez doprovodného **kvantifikovaného** odůvodnění **v obecné části**"*,
   which is technically survivable, but it is a much thinner finding than the framing implies.

With one field out of contract and the other explained in the primary source, `medium` overstates. Recommend
`low`, or a rewritten `unstatedEffects[0]` that is actually about the bill (e.g. that a 150-part omnibus
concentrates ~70 % of its substantive volume in one part while the rest is presented as terminology).

**[MINOR] Three quantitative slips in `researchedContext`.**

Checked how: enumerated all `^\s*ČÁST\s+[A-Z…]` headings in `266153.txt` and measured each part's line span.

- *"strukturální přehled všech **149** částí … (ČÁST PRVNÍ až ČÁST STO PADESÁTÁ)"* — there are **150** headings
  (last at line 12758, ČÁST STO PADESÁTÁ = ÚČINNOST; ČÁST STO ČTYŘICÁTÁ DEVÁTÁ at 12727 = ZRUŠOVACÍ USTANOVENÍ,
  which does confirm the 25/2017 repeal claim at 12733-12735). The stated count and the stated range disagree.
- *"ČÁST DVACÁTÁ TŘETÍ … o cca 3500 řádcích – **řádově desetinásobek** kterékoli jiné části"* — part 23 measures
  **3501 lines** (exact, nice), but the next-largest is **591**, i.e. **5.9×**, not tenfold.
- The ranked list of next-largest parts (*"investiční společnosti…, kapitálový trh, obchodní korporace,
  rozpočtová pravidla, každá v řádu 380–420 řádků"*) **omits the actual 2nd and 3rd largest**: ČÁST STO DESÁTÁ
  (zákon o auditorech, 591) and ČÁST TŘICÁTÁ DEVÁTÁ (zákon o oceňování majetku, 504). The stratification's
  conclusion (concentration in the tax/financial area) survives — both omissions are financial — but the
  "largest parts" claim as stated is not what the file says.
- Verified correct: *"cca 39 000 řádků cache"* → 39 131 lines ✓; ČÁST DVACÁTÁ TŘETÍ = 586/1992 ✓
  (`266153.txt:915-920`); the DZ's *"změny ve více než stovce zákonů"* ✓ (`266153.txt:12785`).

---

### verdict-213.json (tisk 213, ukrajinský bezpečnostní balík) — clean; `medium` defensible

Every operative claim verified against `tisk-213/271314.txt`. This is the best-evidenced medium in the batch.

- **Article numbering is right, and it is a trap I nearly flagged.** The bill has 8 `ČÁST` but 12 `Čl.` (four are
  přechodná ustanovení), so part *n* and article *n* diverge. The verdict's *"čl. VIII"* for pobyt cizinců and
  *"čl. XI"* for trestní zákoník are **correct**: Čl. VIII opens at line 927 inside ČÁST PÁTÁ (line 923), Čl. XI
  at 1522 inside ČÁST SEDMÁ (1519).
- New § 12 / čl. 23a Schengenského hraničního kodexu / **CELEX 32016R0399** — verbatim at `271314.txt:958-969`. ✓
- § 31, § 42, § 44a all genuinely amended (body 4, 5, 7, 10 at lines 985-1006), not merely referenced. ✓
- § 339 new odst. 3: *"Odnětím svobody na **tři léta až dvanáct let** … c) spáchá takový čin **za stavu ohrožení
  státu nebo za válečného stavu**"* — verbatim (`271314.txt:1548-1554`). ✓
- **[MINOR]** `researchedContext` and `citations[2]` attach the *"3 až 12 let"* range to the pair "§ 339 a § 340".
  It is § 339's. § 340's new qualified offence (odst. 4, line 1580) is **3 to 10 years**. Precision, not error.
- The `medium` is carried by a real, substantive finding (a title framed around the Ukraine conflict carrying
  general third-country-national return and residence rules). No money claim exists to over- or under-state.

---

### verdict-221.json (tisk 221, novela zákona o střetu zájmů) — strongest finding, one load-bearing error

The core `unstatedEffects[0]` is correct, important and well-evidenced: a **kogentní plošný** procurement ban is
replaced by a **fakultativní, narrow** power. Verified verbatim in `tisk-221/271529.txt`:

- bod 3: *"§ 4b se zrušuje."* (line 30) ✓
- new § 48 odst. 8 ZZVZ (lines 456-462): *"Zadavatel podle § 4 odst. 1 písm. a) **může** vyloučit účastníka …
  jejímž skutečným majitelem je veřejný funkcionář podle § 2 odst. 1 písm. c) … **stojící v čele ústředního
  správního úřadu, který je v tomto řízení zadavatelem**"* ✓ — "may", and only own-office procurement.
- § 4c narrowed to non-entitlement dotace from the funkcionář's own ústřední správní úřad (bod 4, lines 32-38) ✓
- § 11a, § 14r (rozpočtová pravidla), § 2db (zákon o zemědělství) all exist in the bill ✓ and all key off
  § 2 odst. 1 písm. c) ✓
- Money figures all match the graph exactly: KORID LK 405 232 883 Kč, AGROCENTRUM JIZERAN 3 040 369 Kč,
  MAE invest 912 000 Kč ✓. The KORID LK steward exclusion is correct doctrine and correctly reasoned.

**[MAJOR] `conflictAssessment`'s load-bearing "výhradně" is false, and contradicts the verdict's own
`researchedContext`.**

- Field: `conflictAssessment` — *"novelizovaná ustanovení § 4b, § 4c a navazující § 11a, § 14r a § 2db dopadají
  **výhradně** na veřejné funkcionáře v postavení člena vlády nebo vedoucího ústředního správního úřadu."*
- Checked how: read the whole of Čl. I and Čl. X in `271529.txt`.
  - **The same bill's new § 4c odst. 2** (bod 5, lines 42-46): *"Je zakázáno poskytnout dotaci, na kterou není
    právní nárok, … obchodní společnosti, jejímž skutečným majitelem je **člen zastupitelstva územního
    samosprávného celku**, který je poskytovatelem dotace."*
  - **The same bill's new § 48 odst. 9 ZZVZ** (lines 464-470): same extension to *"člen zastupitelstva územního
    samosprávného celku, který je v tomto řízení zadavatelem"*.
  - The DZ confirms this is deliberate (`271529.txt:605-608`, `878-879`, `1121-1122`).
- The verdict's **own `researchedContext` already says this** (*"respektive obdobně u zastupitele územního
  samosprávného celku vůči zakázkám jeho vlastní obce nebo kraje"*). So the verdict contradicts itself, and the
  contradiction is precisely the sentence that clears both money leads.
- The dismissal is probably still directionally right (the new zastupitel clauses **add** a prohibition, i.e. a
  burden, so they cannot be a self-benefit), but the verdict must reason that way rather than by asserting an
  exclusivity the text denies. It should also state whether either sponsor holds a regional/municipal mandate —
  it never asks, and David Pražák's ties are Liberec-region ones.

**[MINOR]** `citations[3]` sources a three-company, three-figure money claim to a single URN
(`company:ico:27267351` = KORID LK). MAE invest is `29186315`, AGROCENTRUM JIZERAN is `60914351`.
**[MINOR]** `citations[2]` points at `https://www.zakonyprolidi.cz/cs/2006-159`, which returns **HTTP 403** to
fetch. The proposition it supports is nevertheless independently confirmed by the bill's own text (bod 4 quotes
the current § 4c wording keying on § 2 odst. 1 písm. c)) and by the DZ at `271529.txt:507-512`, so the claim is
sound even though the citation is not retrievable.

---

## Priority 2 — spot-check of three LOW verdicts

### verdict-7.json (tisk 7, Úřad pro prevenci korupce a střetu zájmů) — central finding CONFIRMED

Both riders exist exactly as described, in `tisk-7/265064.txt`:

- **BISS cap**: new § 11n–11q (line 334 ff.). § 11o odst. 1 (lines 364-366): *"Souhrnná částka BISS vyplácená
  v jednom kalendářním roce žadatelům náležejícím do téže skupiny propojených žadatelů se zastropuje částkou
  **100 000 EUR** … Částka BISS přesahující limit se nevyplatí."* Aggregation is by **skutečný majitel**
  (§ 11n odst. 1 písm. b), lines 345-347), with an anti-circumvention rule looking back 36 months (§ 11p,
  lines 388-394). The verdict's *"na 100 000 EUR za kalendářní rok na úrovni skutečného majitele"* is accurate. ✓
- **Hospital directors**: § 111a odst. 2 (lines 1026-1027) *"Funkční období ředitele fakultní nemocnice je 6 let"*
  and § 111a odst. 1 / § 111b *"Ministr jmenuje ředitele fakultní nemocnice na základě výběrového řízení"* ✓
- The rider framing ("broader than the title signals") is fair, and the verdict correctly notes both riders are
  openly reasoned in the obecná část — it does not over-claim concealment.
- `moneyTies: []` for all three sponsors and `attributedSectorLeads: []` ✓ confirmed in the targets file.
- `severity: low` is right. No finding.

### verdict-103.json (tisk 103, datové schránky cizinců) — central finding confirmed; **one MAJOR money error**

The ruling-out of the two sector leads is correct and well-reasoned. `tisk-103/267494.txt:129-134` confirms the
whole of the 155/1995 change is the new § 57a: *"Vznikl-li nárok na výplatu důchodu cizinci, informuje o tom
příslušný orgán sociálního zabezpečení … bezodkladně Digitální a informační agenturu"* — a pure notification
duty, nothing touching pension amounts or insurance products. Both leads (ZPS holding/Bureš, ČSOB
Pojišťovna/Haas, both via `155/1995`) match the targets file ✓. Calling them a *"artefakt heuristiky
„sdílený zákon = sektorový lead“"* is the honest read.

**[MAJOR] The disposal sentence for the remaining sponsors misattributes one company and is false about
another.**

- Field: `conflictAssessment` — *"Ostatní peněžní vazby předkladatelů (**Bendl, Černochová**) směřují ke
  státním podnikům a obecně prospěšným společnostem, u nichž jde o institucionální/svěřenecké vazby (např.
  Povodí Vltavy, s. p., **Vodárny a kanalizace Karlovy Vary, a.s.**), **nikoli o soukromé vlastnictví**"*
- Checked how: enumerated every sponsor's `moneyTies` for tisk 103 in `batch-011-targets.json`.
  - *Povodí Vltavy, státní podnik* is Petr Bendl's ✓.
  - ***Vodárny a kanalizace Karlovy Vary, a.s.* is not Bendl's or Černochová's — it is Jan Bureš's** (along with
    Údržba silnic Karlovarského kraje 8 004 685 063 Kč, Povodí Ohře 7 458 380 247 Kč, Ostrovská teplárenská
    182 963 808 Kč). Bureš is the bill's lead sponsor, the one whose ZPS holding lead was just dismissed.
  - **Petr Bendl also holds *Energie - stavební a báňská a.s.* with 20 790 731 132 Kč** — a private
    construction/mining company, not a state enterprise and not an o.p.s. The blanket *"nikoli o soukromé
    vlastnictví"* is false on the single largest tie in that sponsor's list.
- Compounding it: the verdict asserts a tie **class** ("institucionální/svěřenecké") for these companies, but
  `batch-011-targets.json` carries no `tie_class` field at all. Per the repo's own doctrine
  (`features/money/reviewTypes.ts` — a stored class wins, a guess must be labelled a guess), asserting the class
  from the company name is exactly the move the product forbids on its money surfaces.
- Two MINOR notes: describing ZPS holding as *"strojírenská společnost"* is uncited (plausible, low stakes since
  the conclusion is dismissal).

### verdict-189.json (tisk 189, evidence tržeb) — central finding confirmed but **incomplete**

Verified in `tisk-189/270143.txt`:

- *"cca 14,4 mld. Kč"* — verbatim at line 3159: *"Z titulu zavedení elektronické evidence tržeb se předpokládá
  růst příjmů veřejných rozpočtů (dodatečné daňové výnosy) cca o 14,4 mld. Kč."* ✓
- The cited rider tables at *"řádky cca 3195–3237"* are real and land where claimed (lines ~3193-3237), with
  separate impact rows for *Zavedení slevy za umístění dítěte* (-2,3), *Zavedení slevy na studenta* (-0,4),
  *Zrušení zastropování u volnočasových benefitů* (-0,4) and a prose line for *Osvobození spropitného
  v gastronomii* (*"maximálně v řádech mínus stamiliónů Kč"*). ✓
- The § 35ba insertion of the three new slevy is verbatim at lines 685-690 (see Priority 3). ✓

**[MAJOR] The rider inventory is incomplete, and the verdict's only finding IS the rider inventory.**

`unstatedEffects[0]` and `citations[2]` present the rider list as closed — *"(sleva za umístění dítěte, sleva na
studenta, zrušení zastropování volnočasových benefitů, osvobození spropitného v gastronomii)"*. The same
document carries at least three more non-EET tax changes bundled into the same act:

- **Snížení sazby DPH na nealkoholické nápoje v rámci restauračních služeb, 21 % → 12 %** — `270143.txt:1380-1388`
  and `1723-1727` (*"Cílem návrhu, v souladu s programovým prohlášením vlády, je zavedení stejné sazby DPH
  (snížené sazby DPH ve výši 12 %) na nealkoholické nápoje podávané v rámci restauračních služeb"*), with its own
  budget-impact table immediately after the rider tables the verdict does cite. This is arguably the most
  economically visible rider in the bill and the verdict does not mention it.
- **§ 46 zákona o DPH — malé nedobytné pohledávky**, shortening the recovery window 6 → 3 months
  (`270143.txt:1390-1396`, `1729-1734`).
- **Osvobození příspěvku zaměstnavatele na sociální služby** — listed in the same impact section with an
  explicit "cannot be estimated" note.

`researchedContext` hedges once with *"mj."*, but the reader-facing `effect` and the citation do not. This is an
under-claim on the exact finding the verdict exists to make. Fix by completing the list (or by stating the list
is illustrative and giving the count).

**Verified correct**: `citations[3]` — fetched `https://www.psp.cz/sqw/historie.sqw?o=10&t=189`: *"3. čtení
probíhlo 15. 7. 2026 na 25. schůzi. Návrh zákona schválen (hlasování č. 88, usnesení č. 263)"*, postoupen Senátu
21. 7. 2026 as tisk 270. ✓ `sectorAdjacency: false`, Schillerová `moneyTies: []` ✓.

---

## Priority 3 — four collision close-reads

All four re-read at the claimed §§ in both bills. **All four excerpts are verbatim and all four classifications
hold.** This is the strongest part of the batch.

### `189-244` (lawRef 586/1992, § 35ba) — gA — **classification CORRECT**

- tisk 189 bod 12 verbatim at `tisk-189/270143.txt:685-690`: *"V § 35ba se na konci odstavce 1 tečka nahrazuje
  čárkou a doplňují se písmena f) až h), která znějí: „f) slevu na studenta, g) slevu za umístění dítěte,
  h) slevu na evidenci tržeb.“."* ✓ (including the three-item list, which the close-read quotes exactly)
- tisk 244 bod 2 verbatim at `tisk-244/277769.txt:19-20`: *"V § 35ba odst. 1 se písmeno b) zrušuje a dosavadní
  písmena c) až e) se označují jako písmena b) až d)."* ✓
- The chain the close-read relies on is real: 189 bod 14 changes the odst. 3 reference *"e)"* → *"f)"*
  (`270143.txt:694`), while 244 body 3-4 replace *"b) až e)"* with *"b) až d)"* in odst. 2 and 3
  (`277769.txt:22-23`). Under 244, písmeno e) ceases to exist; 189's instructions then address a letter that is
  gone. **Both instructions cannot apply cleanly. `confirmed-collision` is right.**
- Corroborating (not needed, but it removes any doubt): 244's DZ at `277769.txt:470-471` — *"Ruší se sleva na
  manžela nebo manželku podle § 35ba odst. 1 písm. b). Dosavadní slevy uvedené pod písmeny c) až e) se
  v návaznosti na to přečíslují na písmena b) až d)."*

### `120-189` (lawRef 586/1992, §§ 35ba + 35d) — gA — **classification CORRECT**

- tisk 120 bod 1 verbatim at `tisk-120/268221.txt:15-16`: *"V § 35ba se v odst. 1 zrušuje písm. a) a dosavadní
  písmena b) až e) se označují jako a) až d)."* ✓ (the unusual phrasing in the excerpt is the bill's own — I
  suspected paraphrase and it is not)
- The § 35d claim is exact too — tisk 120 bod 4 at `268221.txt:54-55`: *"V § 35d odstavci 1 a § 35d odstavci 2
  se text „písm. a), c) až e)“ nahrazuje textem „písm. b) až d)“."* ✓ against 189's *"e)" → "f)"* at the same
  place. The `268223.txt` platné znění shows both substitutions landing in the same sentences (lines 165, 170).
- Two mutually exclusive assumptions about whether písmeno e) survives. **`confirmed-collision` is right**, and
  the three-way 120/189/244 framing over § 35ba is accurate.

### `13-64-240-2013` (lawRef 240/2013, § 604) — gA, letter-renumbering mechanism — **classification CORRECT**

- tisk 13 bod 182 verbatim at `tisk-13/265099.txt:2503-2504` ✓
- tisk 64 bod 72 verbatim at `tisk-64/266153.txt:12014-12018`, **including the renumbering sentence** the
  close-read quotes: *"Dosavadní písmena a) až c) se označují jako písmena b) až d)."* ✓
- The mechanism is exactly as described: 64 inserts a new písmeno a) and shifts a→b, b→c, c→d, while 13
  addresses the pre-shift b) and c) by name. Order-dependent, non-mergeable. **`confirmed-collision` is right.**

### `7-64-424-1991` (lawRef 424/1991, § 6) — gB — **classification CORRECT, but under-evidenced**

- tisk 7 Čl. III bod 1 verbatim at `tisk-7/265064.txt:144-145` ✓; tisk 64 Čl. VIII bod 1 verbatim at
  `tisk-64/266153.txt:164-165` ✓.
- **[MINOR]** The close-read's `reasoning` hedges the load-bearing step: *"Tisk 7 předpokládá, že text bodu 9
  obsahuje formulaci s částkou „50 000“ (**patrně** v poslední větě bodu…)"*. A `confirmed-collision` resting on
  *patrně* is a confidence mismatch — if the 50 000 sat in a different sentence, the pair would collapse to
  coordination-risk.
- The proof was in the same cached file the agent already had open. **tisk 64's own DZ, `266153.txt:15930-15932`:**
  *"Ustanovení § 6 odst. 2 písm. b) bodu 9 **druhá věta** je nadbytečné, jelikož vyplývá z § 19h odst. 1 písm. j),
  kde je stanovena povinnost vytvořit přehled o členech, jejichž členský příspěvek za kalendářní rok je vyšší
  **než 50 000 Kč**."* The sentence tisk 64 deletes is precisely the sentence carrying the figure tisk 7 rewrites.
  **The classification is right and should be upgraded from inference to citation.**

### Also checked: `64-73` (incidental) — **classification defensible**

Both bills do amend §§ 17, 20, 23a, 44 of 477/2001, at disjoint odstavce (64: § 17 odst. 3, § 44 odst. 4;
73: § 17 odst. 5, § 44 odst. 1) with no renumbering on either side. Calling the pairing a paragraph-level
detection artefact is the correct read, and the close-read says so without over-claiming.

---

## Priority 4 — reflection, self-consistency, and the batch's headline numbers

**[MAJOR] The headline counts are correct, but one artifact file's own metadata contradicts them.**

- Checked how: recounted `pairs[].classification` in both files against the stored `classificationCounts`.

  | file | stated `classificationCounts` | actual, from its own `pairs[]` |
  |---|---|---|
  | `collision-close-reads-batch011-gA.json` | 7 confirmed / 1 coordination / 0 incidental | 7 / 1 / 0 ✓ |
  | `collision-close-reads-batch011-gB.json` | **5 confirmed / 1 coordination / 2 incidental** | **6 / 1 / 1** ✗ |

- The batch will state **13 confirmed / 2 coordination-risk / 1 incidental**. That matches the **pairs**
  (7+6, 1+1, 0+1 = 13/2/1) and is therefore **the correct headline**. It does **not** match the sum of the
  stored `classificationCounts` fields (12/2/2). Any downstream step that trusts `classificationCounts` — the
  natural thing for a summariser to read — will publish 12/2/2 and contradict the batch note. `coverage`
  (`pairsRead: 8, pairsAssigned: 8`) is correct in both files. Fix the gB metadata field.
- **12 verdicts (4 medium / 8 low)** — ✓ supported. Directory holds exactly 12 files (tisky 7, 14, 64, 67, 77,
  102, 103, 154, 189, 201, 213, 221); severities are medium on 64/67/213/221 and low on the other eight;
  `billTisk` on every file is a batch-011 target. All 12 pass the batch gate.

**Internal contradictions between severity/confidence and prose** — three found, all reported above:

1. tisk 64: `medium`/conf 3 on a verdict whose `conflictAssessment` says the conflict predicate *cannot* apply
   and whose two `unstatedEffects` are, respectively, out of contract and explained in the primary source.
2. tisk 67: `conflictAssessment` dismisses Lovochemie's 139/2002 tie while `unstatedEffects[1]` counts Lovochemie
   as a 100/2001 beneficiary.
3. tisk 221: `conflictAssessment` says *"výhradně"* ministers/heads of central offices; `researchedContext` in
   the same file says the ZZVZ rule extends to zastupitelé — and the bill's text agrees with the latter.

**Claims that read as self-serving or over-smooth** — the pattern is consistent enough to be worth naming as a
batch-level habit rather than three separate nits. Three verdicts close with a sentence of the form *"jde
o věcný, nikoli jen formální závěr"* / *"jde o očekávaný a hodnotný závěr o absenci konfliktu"* (verdict-7,
verdict-103, verdict-221; verdict-64 uses *"to je zde věcný závěr, nikoli mezera v analýze"*). Where the
underlying work is real, that is fine — verdict-7's and verdict-103's are earned. But in verdict-221 the sentence
sits directly on top of the false *"výhradně"*, and in verdict-103 it sits on top of a misattributed and partly
false money sentence. **A formula that asserts the quality of one's own negative finding is exactly the place a
thin verification hides.** Recommend the loop stop rewarding that phrasing and instead require the negative
finding to name what was checked (which provision, which tie, which class).

**`pending_review` semantics** — respected, and correctly *not* a payload field. `lib/analysis/law-verdict.ts`
documents the contract (*"Findings that pass are written pending_review — a lead for a human, never a published
verdict"*), so the state is applied at persistence, not carried in the JSON. No verdict in the batch phrases a
finding as an established fact of wrongdoing; the hedging in verdict-67's *"nikoli jako doklad konkrétního
korupčního zvýhodnění jednotlivé transakce"* and verdict-189's *"procesní/legislativně-technickou otázkou …
nikoli osobním konfliktem zájmů"* is exactly the right register. **No finding here.**

**Statutes and URLs** — every statute machine-verified real (gate 12/12, `citedLawRefs` × `knownLawRefs`).
Three URLs fetched: psp.cz historie t=67 ✓ (supports its claim exactly), psp.cz historie t=189 ✓ (supports its
claim exactly), e15.cz Hartenberg ✓ (supports its claim). Two do not retrieve: forbes.cz (404 to fetch, article
confirmed to exist and to substantially support its claim via a domain-scoped search), zakonyprolidi.cz (403;
proposition independently confirmed from the bill's own text). **No hallucinated URL found.**

---

## Required before persistence

| # | Sev | File · field | Fix |
|---|---|---|---|
| 1 | BLOCKING | `verdict-67.json` · `unstatedEffects[1].whoBenefits` | Remove Lovochemie from the 100/2001 group (its lead is 139/2002) or state the extension as the analyst's own, not batch-010's |
| 2 | MAJOR | `verdict-67.json` · `researchedContext`, `citations[2]`, `conflictAssessment` | Stop asserting *"bez věcného dopadu na osvobození od DPH"*; § 55a is "Dodání pozemku" and the edited clause is the definition of stavební pozemek |
| 3 | MAJOR | `verdict-67.json` · `conflictAssessment` | 14 leads, not 12; dispose of SynBiol (258/2000) |
| 4 | MAJOR | `verdict-67.json` · `conflictAssessment` | Dispose of Šťastný × Pražské služby (53 271 958 488 Kč) against ČÁST 39 (zákon o odpadech), or drop the absence sentence |
| 5 | MAJOR | `verdict-64.json` · `severity`, `unstatedEffects[0..1]` | Downgrade to `low`; effect[0] is about our census, not the bill; effect[1] is explained at `266153.txt:39093` |
| 6 | MAJOR | `verdict-221.json` · `conflictAssessment` | *"výhradně"* is false — new § 4c odst. 2 and § 48 odst. 9 ZZVZ cover členy zastupitelstva ÚSC |
| 7 | MAJOR | `verdict-103.json` · `conflictAssessment` | VaK Karlovy Vary is Bureš's, not Bendl's/Černochová's; Bendl's *Energie - stavební a báňská a.s.* (20 790 731 132 Kč) is private; do not assert tie class the data does not carry |
| 8 | MAJOR | `verdict-189.json` · `unstatedEffects[0]`, `citations[2]` | Rider list omits the 21 %→12 % VAT cut on non-alcoholic drinks, the § 46 nedobytné pohledávky change, and the sociální-služby exemption |
| 9 | MAJOR | `collision-close-reads-batch011-gB.json` · `classificationCounts` | Stored 5/1/2 contradicts its own pairs (6/1/1); the batch headline 13/2/1 is right, the field is wrong |

Minors (non-blocking, worth a pass): verdict-64's 149-vs-150 parts, "desetinásobek" (actually 5.9×) and the
missing 2nd/3rd-largest parts; verdict-213's 3–12 range attributed to § 339+§ 340 jointly; verdict-221's
single-URN citation for three companies; verdict-67's forbes.cz descriptor, blog sourcing, and uncited "skupiny
AGROFERT"; close-read `7-64-424-1991`'s *patrně* (upgrade with `266153.txt:15930-15932`).
