# Batch-021 closure audit — adversarial, independent

**Auditor:** fresh session, no prior involvement in any batch of the law-forensics loop.
**Scope:** `docs/data-analysis/case-law/payloads/verdicts-021/` (12 verdicts: 6, 52, 55, 63, 76,
87, 98, 101, 114, 116, 129, 144), `payloads/batch-021-targets.json`, and the graph's own
`kg_node.props.sponsors` for the bills in scope. This is the **corpus-closing** batch: the write
it gates takes coverage to 141/141.
**Method:** every `„…“` **and** every ASCII-`"…"` span re-located in the NFC-normalized,
U+200B/U+200C/U+200D/U+FEFF/U+00AD-stripped, whitespace-collapsed
`.data/law-collision-cache/tisk-<N>/*.txt`, with `index.html` read for the psp.cz distribution
stamp; **67 typographic quotations + 15 ASCII quotations = 82 spans** checked, each against the
*right* print and, on a miss, against all 128 cached prints to test for import. Every procedural
verb compared to `batch-021-targets.json` `committeeRouting`. Every tie class and CZK figure
re-derived from `docs/data-analysis/case-money/ledger.json` (211 units: 37 owner-operator /
23 manager / 151 steward). Sponsor lists compared to each print's own signature block
(`Předkladatelé` / `PODPISOVÁ LISTINA` / title page). Prior verdicts read from
`payloads/verdicts-011..020/`. `validateLawVerdict`, `lawJargonIssues` and `czechGateErrors`
executed over all twelve payloads. PGlite read with SELECT only.
**No payload, source, message or store file was edited. No git writes.**

---

## VERDICT: ⛔ BLOCK

**Eight blocking defect groups across nine of the twelve files.** The corpus-closing batch is the
worst-carrying batch of the last five on quotation integrity and the first to publish **fabricated
procedural history**.

Three things make this batch different from its predecessors rather than merely equal to them:

1. **The re-inflected quotation is now in its fifth consecutive batch** (018, 019, 020, and here
   ×4) — and this time it is joined by its harder sibling: verdict-98 publishes, inside quotation
   marks, a **noun that appears in no sentence of the print**, assembled from two sentences in two
   different sections. Batch-020 closed on a self-sweep reporting "0 fabricated / 0 re-inflected /
   0 spliced / 0 imported". That sweep did not survive contact with batch 021.
2. **verdict-144 asserts four procedural stages and three dates that no cached source carries and
   that the batch's own targets file contradicts** — including a completed second reading with
   amendments over a `committeeRouting` recording `status: "prikazano"` and nothing else. Every
   prior batch's procedural defects were verb inflation over a *correct* date. This is invention.
3. **verdict-114's two load-bearing findings are both falsified by the print**, one of them by a
   passage in the commentary on the very section the verdict is about.

**verdict-101's `high` is not earned** (§ P1 below) — it is the second `high` ever filed and it
repeats the exact error for which batch-018 demoted the first. **The sponsor-array defect is real,
is upstream in the graph, and does gate this batch** — not through 87 or 116, which caught and
corrected it, but through verdict-6 and (indirectly) verdict-87 (§ P3 below).

**The repo's own gate cannot see any of this.** `validateLawVerdict` = OK 12/12,
`lawJargonIssues` = **0/12**, Czech language gate = 0 errors, `43\d{3}` outside `source` = 0,
Cyrillic homoglyphs = 0, empty/unsigned `whoBenefits` = 0, NFC-clean 12/12, zero-width chars 0.
The gate does not verify quotations against the cache, does not check quotation-mark discipline,
does not compare procedural verbs to `committeeRouting`, and does not compare sponsor lists to the
print. A green gate on this batch is not coverage.

---

# Priority 1 — the ruling on verdict-101's `high`

## Re-derivation from the print (`tisk-101/267467.txt`, 256 267 B)

Everything the verdict describes as the bill's design is **real and correctly read**:

| Claim | Print | Verdict |
|---|---|---|
| 10-year lookback | § 3 odst. 5: „Rozhodným obdobím se rozumí období **10 let** před zajištěním majetku nevysvětleného původu" | „desetiletém rozhodném období (§ 3 odst. 5)" ✔ |
| Burden of proof | § 4 odst. 1: „Soud uloží odčerpávací opatření … pokud jeho zákonný původ nebyl věrohodně a ověřitelně doložen a soud má po uvážení všech konkrétních okolností případu za to, že pochází z trestné činnosti **nebo činnosti jinak trestné**" | paraphrase, accurate (drops „nebo činnosti jinak trestné", narrowing) ✔ |
| Retroactivity reasoning | „Vzhledem k tomu, že účel odčerpání majetku nevysvětleného původu je primárně preventivní … na odčerpání majetku se ani nevztahuje čl. 40 odst. 6 Listiny … nepředstavuje nepřípustnou retroaktivitu" | rendered accurately ✔ |
| ECHR / ÚS authority | „II. ÚS 1026/21" ×3 · „Gogitidze a ostatní proti Gruzii, č. 36862/05, rozsudek ze dne 12. května 2015" ×3/×2 | cited correctly ✔ |
| Transitional § 26 | K § 26: „…ale i v případě, že původní trestní řízení bylo zahájeno kdykoli před nabytím účinnosti tohoto zákona, ale ke dni nabytí účinnosti tohoto zákona dosud nebylo pravomocně skončeno" | „umožňuje zahájit řízení i tehdy, bylo-li … zahájeno kdykoli před účinností zákona, pokud jen nebylo k tomuto dni pravomocně skončeno" — **verbatim-backed by the DZ's own words** ✔ |
| Skipped RIA | „V souladu s Plánem legislativních prací vlády na rok 2025 nebylo hodnocení dopadů regulace zpracováno." | quoted **verbatim** ✔ |
| „zásada oportunity" | K § 12, both quoted spans located verbatim | ✔ |

So the substrate is sound. The ruling turns on what `high` is for.

## Ruling: `high` is NOT earned. Should be `medium`.

**The ladder is the loop's own, and it was set on this exact question.** `batch-018-audit.md` M1
demoted the corpus's first-ever `high` (verdict-107) with the rule: *"A finding whose beneficiary
analysis is nobody and whose harm is a bill needing one amendment cannot be the corpus's single
highest severity while a five-pair collision is medium."* The demotion required, for a `high`, a
**concrete mechanism plus an identified beneficiary**. Measured across
`payloads/verdicts-011..021`: **74 low · 39 medium · 1 high**, the one being this verdict.

**verdict-101 names no beneficiary at all.**

- `unstatedEffects[0].whoBenefits` — *„**Nelze jednoznačně určit** — nezpracování hodnocení dopadů
  ochuzuje veřejnou diskuzi i Parlament…"* This is literally "cannot be determined": the same
  "nobody" that demoted 107.
- `unstatedEffects[1].whoBenefits` — *„Osoby, u nichž státní zástupce z důvodu neshledání veřejného
  zájmu návrh na uložení odčerpávacího opatření nepodá, si ponechají majetek…"* This is
  **tautological**: it restates the mechanism (a prosecutor who declines does not pursue) as if it
  identified someone. It names no person, no class with a boundary, and no interest.
- `conflictAssessment` closes the question itself: *„Na základě dostupných dat nebyl u tisku 101
  zjištěn střet zájmů; institucionální otázky … jsou věcí návrhu jako celku, **nikoli osobního
  zájmu předkladatele**."*

**What actually carries the weight is the print's own disclosed design, and the loop grades
UNSTATED effects.** The reversed evidentiary posture, the non-conviction-based confiscation, the
10-year lookback and the retroactive reach are all **stated, argued and defended at length** in the
DZ, with ÚS and ECHR authority. The single gravest sentence in the whole print —

> „…půjde v zásadě o řízení proti věci (in rem), v němž se všechny zásady ovládající trestní řízení
> plně neuplatní, **zejména se z povahy věci neuplatní zásada presumpce neviny** (až na dílčí
> aspekty)…"

— is the drafter's own disclosure, and verdict-101 does not even render it. A verdict cannot
escalate on effects the print states; and the two effects it did file as unstated are (a) a skipped
RIA, which this corpus rates `low` routinely, and (b) an undiscussed prosecutorial discretion.

**What concrete mechanism could carry a `high` here — and does the verdict state one?**
The strongest candidate in the print is the § 12 opportunity principle: a decision **not** to file
is unreviewable by any court and is controlled only by a note in the supervising prosecutor's file.
The verdict **does** state that mechanism, verbatim-sourced, and it is genuine, non-obvious
forensics. But a mechanism whose beneficiary the verdict itself declares indeterminate is a
`medium`, not the corpus's high-water mark. **`high` here rests on subject-matter gravity —
property confiscation, criminal law, a big new statute — which is precisely the ground batch-018
ruled insufficient.**

**Recurrence note.** This is not a first-time judgement call. Batch-018 ruled on it; batch-021 filed
the same shape again. Under this loop's own escalation pattern (the re-inflected quotation was
escalated on recurrence), the repeat is worse than the original.

**Also unearned in 101 independently of severity:** two MAJORs (M7, M8) and one BLOCKING (B4c).

---

# BLOCKING

### B1 — Quotation integrity: 5 defects across 4 files, including one fabrication
**The named recurrence class of batches 018/019/020, now in its fifth consecutive batch.**

**B1a · verdict-98 · `.statedReasoning` — a quoted noun phrase that exists in no sentence of the
print (fabricated by splice).**
> …a uvádí, že jde o poskytovatele služeb souvisejících s kryptoaktivy **„v řádu desítek subjektů“**.

Measured over `tisk-98/267359.txt`: the string `v řádu desítek subjektů` returns **NOT FOUND**, case
sensitive and insensitive, and is absent from all 128 cached prints. What the print says, in **two
different sections**:
> §6.1.2: „…by měly dopadat na omezený okruh tuzemských **subjektů** poskytujících služby… Jejich
> počet je nyní odhadován **v řádu desítek osob**."
> §6.2: „Dle předběžných odhadů se **jedná o desítky subjektů** podnikajících v České republice…"

The verdict welds the quantifier of one sentence to the noun of another and presents the result as
verbatim. The substance survives (both say dozens) — the citation does not. This is the class
`batch-019-audit.md` B2 filed as blocking.

**B1b · verdict-63 · `.researchedContext` — re-inflected quotation (nominative → accusative).**
> …jako kompenzační opatření zpráva uvádí pouze **„relativně dlouhou legisvakanční dobu, úměrnou
> rozsahu změn“**…

Print (`tisk-63/266144.txt`): „…je navrhována **relativně dlouhá legisvakanční doba, úměrná rozsahu
změn**." The nominative is re-inflected to the accusative to fit „uvádí … dobu".

**B1c · verdict-116 · `.statedReasoning` — re-inflected quotation (nominative → genitive).**
> …s odůvodněním **„naléhavého obecného zájmu“** na rychlém zrušení.

Print (`tisk-116/267813.txt`, K§2): „…je z důvodu iracionality a nefunkčnosti nominačního zákona
**dán naléhavý obecný zájem** na jeho zrušení…". The quoted genitive string appears nowhere in the
print, in any case. (It *does* appear verbatim in tisky 68, 69, 124, 125 and 167 — an import
false-positive that the cross-print sweep raised and that the K§2 passage resolves.)

**B1d · verdict-52 · `.researchedContext` — substituted inflection *and* a shifted referent.**
> Zpráva sama v bodě 7 přiznává, že **volba dozorového orgánu** byla `"komplikovaná"`…

Print (bod 7): „S ohledem na **komplikované řešení problematiky** dozorového orgánu, kdy
Ministerstvo spravedlnosti nesouhlasilo…". The print calls the *řešení problematiky* complicated
(neuter); the verdict re-inflects to the feminine to agree with `volba` and re-attaches the
adjective to a **different noun**, then presents the result as the report's own admission. This is
worse than B1b/B1c: the referent moves.

**B1e · verdict-98 · `.researchedContext` — re-inflected quotation (nominative → locative).**
> …ani v části 6.2 …, která u finančních institucí hovoří pouze o **„jednorázových nákladech“**…

Print (§6.2): „…lze očekávat **jednorázové náklady** na straně oznamujících finančních institucí."
(The *substance* of the surrounding finding is correct — §6.2 does discuss only one-off costs for
financial institutions and never mentions the tripled cap. Only the quotation fails.)

**Tolerated, recorded, not filed:** five de-capitalisations at quote start (116 ×2, 144 ×1, 63 ×1,
98 ×1) where the print carries a sentence-initial capital. Note that verdict-144 renders the same
sentence **both ways in two fields** — `„aktuální verze…“` in `researchedContext`,
`„Aktuální verze…“` in `unstatedEffects[0].evidence` — so the payload disagrees with itself.
**Also recorded, not filed:** verdict-63's `„adopce nových účetních pravidel [může] vyvolat…“`
re-orders the source („…může adopce nových účetních pravidel vyvolat…") inside the quotation marks,
but marks the moved word with brackets and renders it correctly in `.evidence`. MINOR.

### B2 — verdict-114: both load-bearing findings falsified by the print
`verdicts-021/verdict-114.json` · `.researchedContext` + `.unstatedEffects[1]`

**B2a — an absence claim about a section that exists.**
> …nikoli v rámci **samostatné části 11 o ochraně soukromí a osobních údajů, kterou tento tisk — na
> rozdíl od tisku 52 v tomtéž korpusu — vůbec neobsahuje**.

`tisk-114/267658.txt` carries, verbatim:
> **„10. Zhodnocení dopadu navrhovaného řešení ve vztahu k ochraně soukromí a osobních údajů"**

— a dedicated section running 10.1–10.9, whose **10.4 Veřejnost zpracování** addresses the very
secrecy the verdict says is unaddressed. The verdict is wrong on the existence **and** on the
number: part **11** of this print is „11. Zhodnocení korupčních rizik navrhovaného řešení (CIA)".

**B2b — a novelty claim contradicted by the commentary on the same section.**
> …jde o vnitrostátní průlom do mlčenlivosti chráněné daňovým řádem, **který samotné nařízení CBAM
> nepředepisuje** … **Tuto výjimku nařízení CBAM samo nepředepisuje – jde o vnitrostátní volbu**.

Print, commentary **K § 13**, verbatim:
> „Navrhované ustanovení je **doplněním přímo použitelné právní úpravy prolomení mlčenlivosti,
> kterou obsahuje čl. 13 odst. 2 a čl. 25 odst. 4 nařízení CBAM**. Smyslem navrhovaného ustanovení
> je úprava výměny informací na vnitrostátní úrovni."

The regulation carries the secrecy-breach provision; § 13(2) complements it domestically. The
verdict never quotes or acknowledges this sentence. This is the exculpatory-inverse rule failing at
the tightest possible range — the inverse is in the commentary on the section the finding is about.

### B3 — verdict-144: fabricated procedural history
`verdicts-021/verdict-144.json` · `.researchedContext` + `.citations[4]`

> „Historie tisku na psp.cz potvrzuje předložení vládou 25. 3. 2026, **přikázání Organizačním
> výborem Výboru pro bezpečnost jako garančnímu 2. 4. 2026, první čtení 15. 4. 2026, doporučující
> usnesení garančního výboru 4. 5. 2026 (tisk 144/1), druhé čtení s podanými pozměňovacími návrhy
> 24. 6. 2026 (tisk 144/2)** a zařazení k dalšímu projednávání na 27. schůzi od 10. 7. 2026."
> `citations[4]`: „…byl **přikázán** Výboru pro bezpečnost jako garančnímu **2. 4. 2026** a **prošel
> druhým čtením s pozměňovacími návrhy 24. 6. 2026**." (`kind: "web"`)

Ground truth:
- `batch-021-targets.json` → `committeeRouting: [{organ:"VB", role:"garancni", status:"prikazano",
  assignedOn:"**2026-04-15**"}]` — **one** event, and its date is the one the verdict reassigns to
  "první čtení".
- `tisk-144/index.html` lists **only** `t014400`, `t0144a0`, `t0144b0` — i.e. **tisk 144/0 only**.
  No 144/1, no 144/2. Its single date is „Rozesláno poslancům **25. března 2026** v 12:39", which
  the verdict converts into „**předložení vládou** 25. 3. 2026" and repeats in `citations[4]` as
  „Návrh **podala vláda** 25. 3. 2026" — a different event.

Four procedural stages, two committee prints and three dates asserted with no support in any cached
source, over a routing that records `prikazano` and nothing further. A completed second reading with
tabled amendments is the strongest procedural claim in the batch and it rests on nothing. `historie
.sqw` is not cached for any tisk and cannot carry a `kind: "web"` citation on its own.

### B4 — Procedural verb and date inflation over `committeeRouting`
A single class, three files. `committeeRouting` distinguishes `navrzeno` (the Organizational
Committee *recommended* an assignment) from `prikazano` (the House *made* it), and this batch proves
the distinction is legible: verdict-87 („doporučil … **přikázat**" over `navrzeno`), verdict-129
(same), verdict-52/55/76/114 (exact date + verb match) all get it right.

**B4a · verdict-6 · `.citations[3].claim`** — „…a 17. 12. 2025 **byl přikázán** Ústavně-právnímu
výboru jako garančnímu…" over `{status:"**navrzeno**", assignedOn:"2025-12-17"}`. The payload
contradicts itself: `.researchedContext` gets it right („doporučení Organizačního výboru s
přikázáním").

**B4b · verdict-63 · `.citations[2].claim`** — „Návrh podala vláda 12. 12. 2025, **byl přikázán
Rozpočtovému výboru jako garančnímu 17. 12. 2025**, prošel prvním čtením 12. 3. 2026…" over
`{status:"prikazano", assignedOn:"**2026-03-12**"}`. Two defects in one sentence: the date is wrong
by three months, and the assignment is placed **before** the first reading the same sentence dates
12. 3. 2026 — procedurally impossible, since přikázání is made by resolution at the close of the
first reading. `assignedOn` **is** 2026-03-12, i.e. the first-reading date the verdict itself gives.
The same error appears in `.researchedContext`.

**B4c · verdict-101 · `.citations[4].claim`** — „Návrh podala vláda 10. 2. 2026 a **byl přikázán**
Ústavně-právnímu výboru jako garančnímu 19. 2. 2026." over `{status:"**navrzeno**",
assignedOn:"2026-02-19"}`. In the batch's only `high`, in the field that *is* the citation.

### B5 — verdict-101: `high` is not earned
Ruled in full under **Priority 1** above. **Should be `medium`.** Filed blocking because publishing
the corpus's only `high` on a finding whose own beneficiary field reads „Nelze jednoznačně určit"
misrepresents the corpus's severity distribution to every downstream reader, and because it repeats
verbatim the error batch-018 M1 already ruled on.

### B6 — verdict-87 ↔ verdict-76: intra-batch contradiction on one MP's three ties
Both verdicts describe **the same three ties of the same MP (Radek Vondráček, 6165)**, in the same
batch, and they do not agree.

`verdict-76.conflictAssessment` — exemplary, and the model this loop should hold:
> „Vazba na Vodovody a kanalizace Kroměříž, a.s. (IČO 49451871) je vedena jako **řídicího typu
> (přičitatelná)**, s úhrnem veřejných smluv firmy **391 010 121 Kč** … Dvě další vazby — předseda
> dozorčí rady NEXNET, a.s. (IČO 26232987, **role 2000-12-14 až 2014-08-06**) a člen dozorčí rady
> MAE invest a.s. (IČO 29186315, **role 2009-10-27 až 2015-03-02**) — jsou vedeny jako **svěřenecké
> (peníze instituce, nikoli poslance)**, obě navíc s dozorčí funkcí **ukončenou před více než deseti
> lety** a s příznakem, že evidované smlouvy firem časově následují až po skončení role."

`verdict-87.conflictAssessment` — same three ties, same batch:
> „Graf peněžních vazeb u něj eviduje tři vazby: jednu v řídicí funkci (Vodovody a kanalizace
> Kroměříž, a.s., IČO 49451871, člen představenstva) a dvě v dohledové funkci (NEXNET, a.s., …
> předseda dozorčí rady; MAE invest a.s., … člen dozorčí rady) – **dosažitelná peněžní hodnota
> těchto vazeb nebyla v tomto zpracování ověřena**."

Three divergences, all in the same direction:
1. **No steward/attributable split.** 76 states which money is the institution's; 87 does not,
   although `ledger.json` carries `tieClass: manager` / `steward` / `steward` for exactly these
   three rows.
2. **No temporal scoping.** 87 renders three board seats in the present tense with no end date,
   while the graph's own person node for 6165 records: *„Tři firemní vazby … jsou **historické**:
   členství v dozorčí radě/statutárním orgánu **končící 2014–2018**, roky před mandátem PSP10 (od
   10/2025)."* A clearance delivered over ties presented as live is an unscoped clearance.
3. **The value is declared unverifiable while the same batch publishes it.** 87 says the reachable
   money „nebyla v tomto zpracování ověřena"; 76 publishes 391 010 121 Kč, and verdicts-011/77 and
   verdicts-018/78 published NEXNET 2 763 049 Kč and MAE invest 912 000 Kč earlier.

**Root cause, and why it matters for Priority 3:** tisk 87's `sponsors` array does not contain
pspId 6165 at all (§ P3), so verdict-87 had no target-supplied money payload for the real submitter
and had to reconstruct it. It got the companies right and the classification, scoping and figures
wrong. **The sponsor-array data defect propagated into a money-quality defect.**

### B7 — verdicts 52 and 55: SOMPO mis-sectored, and the clearance rests on it
Both files, `.conflictAssessment`, describe the same six Vlček ties and open the sector list with:
> „(SOMPO, a.s.; PEVAK Pelhřimov, družstvo; …) – **pojišťovnictví**, vodárenské družstvo, stavební
> projekce, spolková a bytová správa."

SOMPO, a.s. (IČO 25172263) is a **municipal waste-management** company. Four published verdicts say
so with ARES evidence, e.g. verdicts-013: *„SOMPO, a.s. — **obecní svazková firma pro odpadové
hospodářství**, 9 174 258 Kč"*; verdicts-012: *„SOMPO je dle vlastní prezentace stoprocentně
vlastněno svazkem **117 obcí**"*. It is not an insurer, and „pojišťovnictví" appears nowhere in the
prints or the ledger. Because the clearance sentence that follows — „Žádná z těchto firem nepůsobí v
oblasti elektronických komunikací…" — is reasoned **from** the sector list, a wrong sector is not
cosmetic: it is the load-bearing premise, published twice, contradicting the corpus.

Compounding, in both files: **no steward/attributable split** (ledger: 2 `manager` + 1
`owner-operator` attributable, 3 `steward`), **no CZK** although prior verdicts published SOMPO
9 174 258 Kč and PEVAK 1 234 888 Kč, and **no temporal scoping** although a prior verdict recorded
that *„[vazba na] SOMPO navíc skončila před podáním tohoto návrhu"*.

### B8 — verdict-116: `unstatedEffects: []` is not honest
The bill repeals the nomination act **without replacement**, and the print itself supplies the
effect the verdict does not name:

> „Zrušení zákonné úpravy neznamená rezignaci na transparentní a odborné posuzování nominací; tyto
> principy budou nadále zajišťovány prostřednictvím **interních pravidel vlády**."

The safeguard moves from a statute — enacted publicly, amendable only by Parliament — to internal
executive rules that the government writes and rewrites unilaterally, and no such rule is shown to
exist or to bind anyone. And:

> „V této souvislosti není nutné zavádět žádnou legisvakanci a současně není nutné přijímat ani
> žádná přechodná ustanovení. **Probíhající procesy se již dokončí mimo režim nominačního zákona.**"

— every in-flight appointment escapes the regime mid-procedure, effective the first day of the
following month. A removed statutory oversight body, no legisvakance, no transitional provisions,
and the replacement guarantee resting on unwritten internal rules is precisely the shape the
unstated-effect field exists for. **Consequentially, `severity: "low"` is under-rated; this is a
`medium`.** (Contrast verdict-87, where the empty array is far more defensible — see M12.)

---

# MAJOR

**M1 · verdict-6 · `.unstatedEffects[0]` — the "unstated effect" pre-exists the bill.**
The verdict faults the design for concentrating appointment power in the President, Chamber and
Senate. The print says twice that this is lifted, not created: K§5 „Jde o **systematické převzetí
dosavadního § 19c**"; K§7 „…jsou **věcně převzaty z dosavadního § 19e odst. 1 až 4**." An effect
that is current law (zák. 424/1991) is not an effect of this bill, and the print discloses it.

**M2 · verdict-6 · `.unstatedEffects[0].evidence` — verbatim, but cut at the exculpatory clause.**
The quote stops after „Kandidáty na členy Úřadu navrhují Senátu prezident Nejvyššího kontrolního
úřadu, Poslanecká sněmovna a jednotliví senátoři." § 7 odst. 2 continues with a **statutory 1/2/1
allocation** reserving one of four seats to NKÚ-president nominees. „celé osazení Úřadu je tímto
mechanismem svěřeno aktuální politické většině obou komor" overstates against the rest of the
sentence. This is batch-020's elided-qualifier lesson at citation granularity.

**M3 · verdict-6 · `.researchedContext` + `.citations[3]` — three of four dates unsupported, and the
headline claim is circular.** `tisk-6/index.html` carries exactly one date („Rozesláno poslancům
6. listopadu 2025 v 13:15"). The filing (15. 10.), the government stance (4. 12.) and a fourth date
(10. 11. 2025) appear in no cached source; the first three are identical to the set published in
`verdicts-011/verdict-7.json` and cited there to *tisk 7's* history. The "tentýž den jako u tisku 7"
finding therefore compares tisk 7's record to a copy of itself. (The one-package ruling
**nevertheless survives on independent evidence** — see "verified clean".)

**M4 · verdict-6 · `.severity` — `medium` above its own published companion.**
`verdicts-011/verdict-7.json` is `low`, and tisk 7 is the *substantive* half (22 amended laws, BISS
caps, criminal-rate tightening, the Vojenská policie carve-out). Rating the organizational shell
above the substantive companion, on the verdict's own one-package reasoning, is not defensible.

**M5 · verdict-76 · `.unstatedEffects[0]` — „mlčí o" falsified by the print, three times.**
The print addresses the loss of administrative review head-on: „…**se ruší řízení ve věcech služby**
… **V oblasti soudního přezkumu je řešen přechod z modelu správního soudnictví do obecného
občanského soudního řízení.**"; „…bude umožněno státnímu zaměstnanci **domáhat se právní ochrany …
žalobou k obecnému soudu**."; and the description of the current regime „…**formou přezkoumatelných
individuálních správních aktů**". The defensible narrow claim — that **bod 12 (korupční rizika)**
never weighs it — is already in the same paragraph and is correct. The „mlčí" framing is not.

**M6 · verdict-76 · `.researchedContext` — the companion print is never mentioned.**
`tisk-76/index.html`: „Související sněmovní tisky **77** Návrh zákona o státních zaměstnancích -
související", and `verdicts-011/verdict-77.json` is already published on it, covering the same two
Vondráček ties. The RIA / no-scrutiny finding is stated over tisk 76 in isolation while the reform
is a two-print package — the exact package reasoning verdict-6 applies to 6+7 in the same batch.

**M7 · verdict-101 · `.researchedContext` — a source attribution that is not in the print, framed as
direct reading.**
> „**Přímé čtení důvodové zprávy potvrzuje**, že hodnocení dopadů regulace (RIA) nebylo **podle bodu
> 3.8 Obecných zásad pro hodnocení dopadů regulace** zpracováno…"

Measured over `tisk-101/267467.txt`: `3.8` = **0 hits**; `Obecné zásady` / `Obecných zásad` = **0
hits**. The print says only „V souladu s Plánem legislativních prací vlády na rok 2025 nebylo
hodnocení dopadů regulace zpracováno." The methodological authority is supplied by the verdict and
attributed to a direct reading of the document.

**M8 · verdict-101 · `.statedReasoning` — „cosi mezi“ misattributed.**
> „Zpráva **výslovně charakterizuje** důkazní konstrukci jako **„cosi mezi“** civilním a trestním
> standardem dokazování…"

In the print the phrase sits **inside a block quotation of the Ústavní soud**, which is in turn
quoting the explanatory memorandum of a **different statute** (§ 102a tr. zák.): „Ústavní soud k
tomu v uvedeném nálezu dále uvádí „…Podle důvodové zprávy se tu „nezavádí úplný civilní standard
dokazování“ … Jde o „cosi mezi“ — …“". The DZ reproduces it approvingly, so the substance is
defensible; presenting a thrice-nested third-party quotation about another provision as this
report's own express characterisation of **its own** evidentiary construction is not.

**M9 · verdict-114 · `.unstatedEffects[0]` + `.severity` — a self-cancelling effect.**
The effect asserts „…ačkoli sama zpráva tento mechanismus jako daň výslovně odmítá klasifikovat",
while `.citations[3]` and `.researchedContext` both record that the report **states** the procedural
regime („Zpráva sama v bodě 2 … tento procesní režim potvrzuje"). Both halves of the „není clem ani
daní" / daňový-řád tension are **verbatim-verified**, but they answer different questions: the
former is a substantive/WTO characterisation of the levy in „1. Zhodnocení platného právního stavu",
the latter a procedural competence clause in § 9(2). With effect 1 self-cancelling and effect 2
falsified (B2), **`severity` should be `low`.**

**M10 · verdict-55 · `.unstatedEffects[1]` — „zákonem věcně neomezenou" is contradicted by the same
sections.** The carve-out mapping (§ 6(3)/§ 8(4) = MO, § 6(4)/§ 8(5) = MV) is **exactly correct and
verbatim-verified**. But the delegation is expressly bounded: „Ministerstvo obrany může **podle čl. 5
odst. 5 nařízení o gigabitové infrastruktuře** opatřením obecné povahy stanovit…", the commentary
adds „**Na základě řádně opodstatněných a přiměřených důvodů**…" and „…lze **omezit nebo zamítnout
pouze tehdy, je-li to nezbytné**…", and „kritická infrastruktura" is a pre-existing statutory term
(zák. 240/2000 Sb.), which the print itself calls „vymezené ve vnitrostátních právních předpisech".
An OOP is also reviewable under SŘS § 101a.

**M11 · verdict-116 · `.researchedContext` — seven procedural steps outside the record, one of them
apparently imported from another tisk.** `committeeRouting` records one row (`HV / garancni /
prikazano / 2026-04-22`). Unsupported: the government stance of 3. 3. 2026 (tisk 116/1), the
Organizational Committee recommendation of **4. 3. 2026**, „zpravodajem určil Martina Záboje", the
first reading of 21.–22. 4. on the 14. schůze, „usnesením č. 116/2 **přerušil**" (5. 5.),
„usnesením č. 116/3 **doporučil ke schválení**" (15. 6.), and the 27. schůze from 10. 7.
`doporučil ke schválení` is a committee-report verb well outside `prikazano`. Note that **4. 3. 2026
is not in tisk 116's routing but IS the `assignedOn` of tisk 87's** — a probable cross-tisk import.

**M12 · verdict-87 · `.unstatedEffects: []` — under-worked, though far less so than 116.**
§ 1(1) creates a binding rule on the use of the **state** emblem — „Je-li znak Čech užit spolu se
státním znakem, **užije se vždy velký státní znak**." — governed by zák. 3/1993 Sb. and 352/2001
Sb., neither of which the bill amends, while the bill's own obligations annex declares „Nebyla
zadána žádná veřejnoprávní povinnost." A mandatory rule disclaimed as no public-law obligation in
the bill's own schedule is a nameable unstated effect. (Weaker secondary candidates: § 4's
„vhodným a důstojným způsobem" carries no definition, no sanction and no enforcement body; § 2 (3)
legalises two competing Moravian emblems with no precedence rule.)

**M13 · Field parallelism: 4 of 12 files use ASCII `"` instead of `„…“`.**
`verdict-52` (5 spans), `verdict-55` (4), `verdict-76` (2), `verdict-114` (6) contain **zero**
U+201E/U+201C pairs; the other eight files use the Czech pair correctly (67 balanced pairs). Fifteen
quotations therefore sit outside the batch's own typographic convention — and outside the reach of
any `„…“`-based self-sweep, which is how B1d survived to this audit.

**M14 · verdict-6 · `.conflictAssessment` — a named MP attributed as sponsor on a disclosed
inference.** „U žádného ze **tří sponzorů** … (Ivan Bartoš, Olga Richterová, **Kateřina
Stojanová**)". The print's signature block reads „V Praze dne 10. října 2025 … Ivan Bartoš …
Olga Richterová" — **two**. `.researchedContext` is honest about it („…se k tisku 7 … **zjevně i k
tomuto** úzce provázanému tisku 6 … připojila až 26. 2. 2026"), which keeps this out of BLOCKING;
but `conflictAssessment` then publishes the inferred name as fact. See § P3 — this is the sponsor
array's one live escape into published prose in this batch.

---

# Priority 3 — the sponsor-array data finding

## (a) Are the corrections right? — **Yes, both.**

| tisk | print's own signature block | targets `sponsors` | verdict used |
|---|---|---|---|
| **87** | title page: „**Návrh poslance Radka Vondráčka** na vydání zákona o zemských znacích a vlajkách … Zástupce předkladatele: **Vondráček R.**" — **1** | **42 names, and 6165 is not among them** | Radek Vondráček alone ✔, and the discrepancy is disclosed in `.researchedContext` |
| **116** | „V Praze dne 19. února 2026 Předkladatelé: … **Zuzana Ožanová** … **Patrik Pařil** … **Renata Vesecká**" (with `ParilP` / `VeseckaR` signature stamps) — **3** | **6** (adds Foldyna 5911, Peštová 6780, Kott 6246) | the verified three ✔, discrepancy disclosed |

Both verdicts caught it, both said so in the payload, and both restricted the money analysis to the
verified submitters. Tie classes for the used lists check out against `ledger.json` (Pařil's two are
`owner-operator`; Vondráček's are `manager`/`steward`/`steward`).

## (b) Scope of the upstream defect

**It is in the graph, not in the targets builder.** `kg_node.props.sponsors` for
`bill:tisk:43197` is byte-for-byte the 42-element array in `batch-021-targets.json`; provenance is
`roles_provenance = {ref: "psp-tisky-roles", pass: 34, method: "deterministic"}`.

**Two distinct error shapes, not one:**
- **Over-inclusion** (tisk 116): the real submitters are a *subset*; three extra names are added.
  Recoverable by intersection.
- **Wrong join** (tisk 87): 42 names spanning ANO, SPD and Motoristé, and the **sole real submitter
  is absent entirely**. This is not a superset of the truth, so no filter recovers it.

**Corpus-wide shape over all 141 bill nodes** (SELECT-only):
- Sponsor-count distribution: `{0:23, 1:56, 2:8, 3:9, 4:9, 5:4, 6:2, 7:6, 8:1, 9:6, 10:4, 11:3,
  12:2, 14:3, 18:1, 19:1, 23:1, 30:1, **42:1**}`. Tisk 87 is the sole 42 and a clear outlier.
- **Three `origin:"mp"` (by definition single-submitter) bills carry n > 1**: tisk 70 („Vojtěch
  Adam", n=10), tisk 87 („Vondráček R.", n=42), tisk 124 („Juchelka A.", n=2). All three are wrong
  by construction. Tisk 70's ten overlap tisk 87's forty-two on eight ids (7025, 7031, 7029, 6431,
  7053, 6484, 6500, 6534), which is consistent with a join that collects *every person carrying a
  role row reachable from the tisk* rather than the submitters only.
- **23 bills carry `sponsors: []`**, including `origin:"mp"` bills with a named submitter — tisky 85
  and 88 („Juchelka A.") both have an empty array. So the prop **drops** submitters as well as
  inventing them.
- The `submitter` **string** prop is correct in every case checked (87 „Vondráček R.", 116
  „Ožanová Z. a další", 85/88 „Juchelka A."). **The two props disagree and nothing reconciles them
  — that disagreement is a free, deterministic detector nobody is running.**

## (c) Sample of earlier published verdicts — **all clean**

| verdict | claimed | print's signature block | |
|---|---|---|---|
| `verdicts-020/verdict-36` | Urbanová, Chochelová (2) | „…Ing. Barbora Urbanová … Mgr. Adriana Chochelová" | ✔ |
| `verdicts-019/verdict-59` | Pivoňka Vaňková, Blišťanová (2) | „Předkladatelé: Mgr. Ing. Pavla Pivoňka Vaňková … Mgr. Bc. Zdeňka Blišťanová" | ✔ |
| `verdicts-018/verdict-107` | Olšáková, Dvořák, Sedmihradská, Smejkalová, Zuna, Horák, Blišťanová (7) | „PODPISOVÁ LISTINA POSLANCŮ … Mgr. Eliška Olšáková, Mgr. Karel Dvořák, doc. Ing. Lucie Sedmihradská Ph.D., Julie Smejkalová, Michal Zuna … PhDr. Jiří Horák Ph.D., Mgr. Bc. Zdeňka Blišťanová" | ✔ |

Also verified inside this batch: **tisk 129** — eleven names in the verdict, eleven in the print's
signature block, in the same order ✔; **tisk 76** — four ✔.

**No published verdict in the sample misattributes sponsorship.**

## (d) Does it gate THIS batch? — **Yes, twice.**

1. **Directly, through verdict-6.** Tisk 6's array carries **3** (Bartoš, Richterová, **Stojanová**)
   against a print signature block of **2**. Unlike 87 and 116, verdict-6 did **not** exclude the
   phantom: `.conflictAssessment` names her as one of „tří sponzorů" on an explicit inference
   („zjevně i k tomuto … tisku 6"). That is a sponsorship attribution to a named MP whose name is
   not on the bill — the very failure 87 and 116 avoided. **M14.**
2. **Indirectly, through verdict-87.** Because the array omits pspId 6165, the target payload
   carried no money data for the real submitter, and the verdict reconstructed it — producing the
   unscoped, unclassified, value-less treatment that contradicts verdict-76 in the same batch.
   **B6.**

So **3 of 12 targets in this batch carry a wrong `sponsors` array (6, 87, 116)**; two were caught
and one was not.

---

# MINOR

1. **verdict-144** — the same sentence is de-capitalised in `.researchedContext` („aktuální verze…")
   and capitalised correctly in `.unstatedEffects[0].evidence` („Aktuální verze…"). Two fields, one
   quote, two renderings.
2. **verdict-144 · `.unstatedEffects[1]`** — „**s cílem obejít** tento procesní krok" imputes
   intent; the print says only „…**se jeví jako vhodnější** řízení … zastavit, než přistupovat k
   vyrozumění…".
3. **verdict-144 · `.unstatedEffects[2].whoBenefits`** — „Nelze jednoznačně určit"; the effect (no
   provision guaranteeing staffing) is also a category observation — a bill does not set staffing
   tables.
4. **verdict-144** — „782/0 **devátého volebního** období"; the print says „z **9. funkčního**
   období". Outside quotation marks, so not a quote defect.
5. **verdict-129** — „zákaz prodeje v maloobchodě o **sedmi** svátcích"; the print says „**8 dní v
   roce (svátků)**", and the verdict's own enumeration spans eight calendar days.
6. **verdict-129** — „jde o **penězi** těchto institucí" (should be „o peníze"); carried over from
   `verdicts-020/verdict-208`, so a corpus pattern rather than new.
7. **verdict-129** — „Česká asociace věřitelů" listed among „**karlovarských** institucí"; it is a
   national creditors' association.
8. **verdict-129** — asserts `PRAK spol. s r.o. (IČO 49683144)` flatly, silently dropping the
   unresolved IČO ambiguity `verdicts-020/verdict-208` disclosed (candidate 61858111, PRaK a.s. v
   likvidaci, with possible reclassification).
9. **verdict-129** — „předložila návrh **10. 3. 2026**"; the print's signature block reads „V Praze
   dne **4. 2. 2026**". Not contradictory, but unsupported by the cache.
10. **verdict-116** — „ani RAPAJA s.r.o., ani RMPJ s.r.o. nejsou firmou … ani jinak **podléhají**
    nominačnímu zákonu" (should be „nepodléhají") — the negation is dropped, inverting the sentence.
11. **verdict-52 · `.citations[1]`** — the „jednotek až nízkých desítek" figure is attributed to bod
    7; it appears at bod 9 and again at 11.9. Both quotes are individually verbatim; only the bod
    number is loose.
12. **verdict-76** — „desítky tisíc státních zaměstnanců"; `tisíc` = **0 hits** in the print, no
    source given.
13. **verdict-76** — „**government-scale** reformě" — English in Czech prose (below the language
    gate's threshold; it passes `czechCopyOrNull`).
14. **verdict-76** — „…nikoli též výboru pro veřejnou správu a regionální rozvoj, **který se
    personální agendou státní služby obvykle zabývá**" — an unsourced assertion of practice.
15. **verdict-76** — „Žádná ze **čtyř** firem…" after naming **three** companies.
16. **verdict-101** — „evidovány **čtyři písemné příspěvky**" in `.researchedContext`; the
    `historie.sqw` citation's `claim` text covers only the two dates, so the count is uncited and
    unverifiable from the cache.
17. **verdict-101** — the print's § 12 threshold („zajištěn majetek nejméně v hodnotě **1 000 000
    Kč**, nebo i v nižší hodnotě, pokud se vedlo trestní řízení o trestných činech spojených s
    organizovanou zločineckou skupinou") is a material scoping fact and appears nowhere in the
    verdict.
18. **verdict-101** — § 27 sets effect from **1. července 2026**, already past at the date of the
    finding while the bill sits in first-reading debate. verdict-98 handles the analogous lapse
    explicitly („což se podle vlastního přiznání zprávy nestihne"); 101 does not.
19. **verdict-114 · `.citations[5]`** — targets record **both** VŽP and RV as `role: "garancni"` on
    2026-07-14. The verdict normalises this two-garanční data anomaly („přikázán souběžně jako
    garančnímu…") rather than disclosing it. It does not overstate.
20. **verdict-87** — procedural detail beyond `committeeRouting`: „usnesením č. 37", „zpravodajem …
    Mgr. Jiřího Vojáčka", the government stance of 25. 2. 2026, „další postup … od 7. 3. 2026". The
    verb and date that *are* in the record match exactly.
21. **verdict-55** — omits, unlike `verdicts-013/verdict-206` and `verdicts-012/verdict-56`, that
    Vlček's SOMPO mandate **ended 31. 10. 2024** (ARES, deleted 4. 2. 2025) — established elsewhere
    in the loop and material to a conflict finding on a 2026 print.
22. **verdict-52 · `.severity`** — `low` is arguably under-rated for a DPIA that asserts zero privacy
    impact („Právní úprava s sebou nenese dopady na soukromí dotčených ani jiných osob.") over
    unconditional publication of date of birth and home address on a public EU website. Note the
    verdict *understated* its own case: bod 11.3's category inventory („jméno, popřípadě název,
    trvalý pobyt, místo podnikání a identifikační číslo osoby") **omits `datum narození`
    entirely**.
23. **verdict-63 · `.researchedContext`** — „relativně dlouhou legisvakanční dobu … (odstup mezi
    předložením 12. 12. 2025 a navrhovanou účinností 1. 1. 2028 činí zhruba dva roky)" is the
    verdict's own arithmetic over the print's own dates; correct, but uncited as a derivation.

---

# Verified clean

Recorded so a re-audit does not re-raise them.

**Quotations.** 72 of 82 spans located **verbatim** in the right print after normalization; 5 more
differ only by a de-capitalised sentence-initial letter (tolerated); the remaining 5 are B1a–B1e.
Zero **imported** quotations survived scrutiny — the one cross-print hit (verdict-116's „naléhavého
obecného zájmu“ matching tisky 68/69/124/125/167) resolves to a re-inflection of tisk 116's own
K§2, not an import. Zero quotations from the **wrong** print.

**verdict-101** (beyond § P1): §§ 2, 3(5), 4(1), 12, 26, 27 read correctly; „cosi mezi", „II. ÚS
1026/21", „Gogitidze … č. 36862/05", „čl. 40 odst. 6", „1. července 2026", § 102a (12 hits), § 79i
(12 hits) all present; both § 12 quotations verbatim; the RIA quotation verbatim; the § 26
retroactivity reading is directly supported by the DZ's own K§26 sentence; the filing date
(10. 2. 2026) matches `index.html` („Rozesláno poslancům 10. února 2026 v 14:41"); conflict analysis
honest and correctly scoped (Tejc, no ties, no sector lead).

**verdict-6.** All three `„…“` quotations verbatim. **The one-package ruling is chronology-safe and
independently supported** despite M3: `tisk-6/index.html` „Rozesláno poslancům 6. listopadu 2025 v
**13:15**" and `tisk-7/index.html` „…v **13:16**", and each page cross-lists the other under
„Související sněmovní tisky". The delegation statement is real (paraphrased, not quoted): „**Následující
body se týkají pouze návrhu změnového zákona, který je předkládán společně s tímto návrhem:**", and
the 1.2–1.13 body enumeration checks out against the headings. The capture-channel **absence claim is
grep-backed**: `exekutiv` 0 hits, `politické většin` 0, `většin` 2 (both unrelated) — the memo argues
independence from the executive at length in 1.1 and nowhere analyses parliamentary-majority capture.

**verdict-76.** The **no-RIA claim is correct and grep-backed**: `RIA` = 1 hit, and only as
„Analýza byla zpracována formou tzv. **ex post RIA**" (the 2018 KPMG study); `meziresort` 0,
`připomínkov` 0, `dopadů regulace` 0. The loss-of-court-review claim is correctly sourced as a
paraphrase. **Money handling is the strongest in the batch** and matches `ledger.json` row for row
(49451871 `manager`/391 010 121 Kč; 26232987 `steward`; 29186315 `steward`), with role dates and the
`money-postdates-role` flag from `case-money/payloads/batch-002-ares-vr-reconciliation.json`, zero
steward money attributed, zero bare English class tokens, all ties stated as awaiting the human gate.
Routing verb and date exact. „úřednická zkouška zůstává zachována" is **correct** (Hlava IV § 60) —
recorded so a naive phrase-grep does not re-raise it.

**verdict-129.** All nine `„…“` spans verbatim (including the full čl. I repeal clause and the
1 000 000 / 5 000 000 Kč penalty sentence). Eleven submitters match the print's signature block in
order. **Money is clean, tie by tie, against `ledger.json`**: Bureš 1 owner-operator + 7 steward,
Baxa 9/9 steward, Haas `manager` 5 271 341 109 Kč attributed correctly, Černochová 1 `manager` +
1 765 842 642 Kč with the conflicting-registry state disclosed + 3 steward, Bendl 5 steward + PRAK
`manager` with no reachable money. **Zero steward money attributed to any MP**, no bare English class
token, enumeration complete and not silently truncated (6 tie-free + 5 enumerated = 11), routing verb
and date exact. `severity: low` correct.

**verdict-55.** § 14(7) quoted verbatim („…není přípustný rozklad, přezkumné řízení ani obnova
řízení."). **The no-remedy claim survives the exculpatory inverse**: the verdict does *not* claim
absence of judicial review — it says „jedinou zbývající cestou nápravy je žaloba ve správním
soudnictví", which the print corroborates („Tím samozřejmě není vyloučen soudní přezkum … podle § 4
zákona č. 150/2002 Sb."). Greps of `přezkum` (12) / `rozklad` (2) / `žalob` (1) / `opravn` (18) /
`soud` (10) surface no § 14 remedy the verdict suppressed. **The Defence/Interior carve-out reading is
exactly correct and verbatim-verified** (§ 6(3)/§ 8(4) = MO, § 6(4)/§ 8(5) = MV). Fines, deadlines,
the § 20 repeal list and § 11's fikce povolení all check out. All six ties match the ledger; no CZK
asserted; 6/6 `pending_review`.

**verdict-114.** § 9(2), § 13(2) and „Z výše uvedeného vyplývá, že CBAM není clem ani daní, neboť
nemá jejich charakteristické znaky." all **verbatim**, and the last correctly located in „1.
Zhodnocení platného právního stavu" — i.e. **both halves of the P2 tension are real quotations**; the
defect is what is inferred from them (M9), not the quoting. Fines (10–50 / 100 / 300–500 EUR,
HICP-indexed), the shared-competence finding and the routing date are all correct. Schillerová's
`moneyTies: []` is handled honestly, distinguishing absence of input data from a cleared check.

**verdict-144.** **All the P2 resurrection claims are verbatim-grounded**: „…závěrečné zprávě z
hodnocení dopadů regulace (RIA) předložené vlády v lednu 2024 (**č.j. OVA 52/24**) a Poslanecké
sněmovně v závěru srpna roku 2024 (**sněmovní tisk č. 782/0 z 9. funkčního období**)" and „Aktuální
verze návrhu zákona v těchto bodech bezprostředně navazuje na výsledky těchto analýz. **Závěry
hodnocení dopadů regulace jsou proto nadále platné.**" The **discontinuance-over-rejection admission
is verbatim** and sits under „K odstavci 1 písm. k)", with the preceding sentence independently
confirming the re-designation („Tento důvod **koresponduje s dosavadním důvodem pro zamítnutí
žádosti** … § 56 odst. 1 písm. i)") — the strongest single finding in the batch. **The „1/3 late"
figure is the print's own, not verdict arithmetic**: „…je **až třetina** řízení o žádostech
podávaných na území vyřizována po lhůtě". Figures (660 849 / 1 094 089), effective dates (1. 1. 2029
/ § 710 → 1. 10. 2028 / § 261 → 1. 1. 2030) and nařízení (EU) 2024/1356 all correct. `severity:
medium` **earned** on effects 1 and 2. Only its procedural history is fabricated (B3).

**verdict-52.** **The DOB / home-address claim is correct**, verbatim at § 6 písm. c): „…jméno,
adresa místa trvalého pobytu, popřípadě bydliště, na území České republiky, **datum narození**…",
with publication unconditional under § 5 odst. 3 (the whole § 6 set, no carve-out) and the asymmetry
against a legal person's acting individual exactly as the verdict states. **No exculpatory inverse
exists**: `neuvádí se`, `anonym`, `pseudonym`, `nezveřej`, `v rozsahu` all NOT FOUND; the four
`s výjimkou` / `kromě` hits are definitional. The disclosure is new, not pre-existing.

**verdict-87.** Seven `„…“` spans verbatim. The submitter is correct and the bad targets array is
explicitly disclosed. `severity: low` defensible for a symbolic act. Routing verb (`doporučil …
přikázat` over `navrzeno`) and date correct.

**verdict-98.** The § 13n tripled-fine finding is **sound**: „V § 13n odst. 2 se částka „500 000 Kč“
nahrazuje částkou „1 500 000 Kč“." verbatim, and the „not driven by the directive" reading is
**grep-backed and quoted verbatim** from the zvláštní část („Navyšuje se horní hranice pokuty tak,
aby odpovídala automatické výměně informací provozovatelů platforem … vznikaly by nedůvodné
rozdíly."). § 6.2 does confine itself to one-off costs for financial institutions and never mentions
the cap — the finding holds; only the two quotations fail (B1a, B1e). The DAC 8 / DAC 9 quotation,
the 25–35 / 110–140 mil. Kč estimates, the CIA quotation and the routing are all correct.

**Batch-wide.** `validateLawVerdict` OK 12/12 · `lawJargonIssues` **0/12** · `czechGateErrors` 0/12 ·
`43\d{3}` outside a `source` field **0** · Cyrillic/Latin homoglyph mixing **0** · non-NFC bytes
**0** · zero-width / soft-hyphen characters **0** · empty or unsigned `whoBenefits` **0** ·
`„…“` open/close balance exact in all eight files that use them · `confidence` 3–4 throughout, with
4 reserved for the four verdicts resting on the longest verbatim chains (6, 63, 101, 144).

---

# What must happen before the pass-55 write

1. **B1a–B1e** — repair or de-quote five quotations; verdict-98's „v řádu desítek subjektů“ must be
   replaced by one of the two real sentences, not both welded together.
2. **B2a/B2b** — withdraw or rewrite verdict-114's two findings; its `severity` follows to `low`.
3. **B3** — strip verdict-144's invented procedural chain back to `assignedOn: 2026-04-15` +
   `status: prikazano`, or cite a source that is actually cached.
4. **B4a–B4c** — `přikázán` → `navrženo přikázat` in verdicts 6 and 101; verdict-63's date corrected
   from 17. 12. 2025 to 12. 3. 2026 and the ordering fixed.
5. **B5** — verdict-101 `high` → `medium`.
6. **B6** — verdict-87's money section brought to verdict-76's standard (class split, temporal
   scoping, published figures), or the two reconciled explicitly.
7. **B7** — SOMPO's sector corrected in verdicts 52 and 55, and the clearance re-reasoned from the
   corrected list.
8. **B8** — verdict-116's unstated effect filed and `severity` → `medium`.
9. **M13** — ASCII quotation marks normalised to `„…“` in verdicts 52, 55, 76, 114, so the next
   self-sweep can see them.
10. **P3** — the graph's `sponsors` prop (`psp-tisky-roles`, pass 34) is not fit to source a
    conflict analysis. Minimum: a deterministic detector on `sponsors` vs `submitter` disagreement
    (free, and it flags 87/116/6/70/124/85/88 today), and verdict-6's Stojanová attribution removed
    or demoted to the disclosed inference it is.

**A gate idea this batch earns:** the sweep must run over **both** quotation conventions. B1d
survived every prior check because it was written with ASCII quotes, and four of twelve files in the
corpus-closing batch are written that way.

---
---

# CLOSURE CHECK — round 2 (re-verified against the actual file state)

**Method:** all twelve payloads re-read from disk (timestamps 09:26–09:50); the quotation sweep
re-run over **118 typographic spans** (up from 67 — the ASCII spans were converted, not dropped)
against the NFC-normalized, zero-width-stripped, whitespace-collapsed caches **and** `index.html`;
`committeeRouting` re-compared; `ledger.json` re-derived; every claimed fix re-grepped in the print
rather than taken on report. Repo validators re-run.

## What is genuinely closed

**All 8 BLOCKING groups and all 14 MAJORs verified closed.** Spot-verified, not accepted:

- **B1** — sweep: **118 spans → 106 exact, 8 case-only (tolerated), 4 non-exact.** Of the 4, two are
  psp.cz **`index.html` page labels** („Související sněmovní tisky", „Návrh zákona o státních
  zaměstnancích - související") — both located verbatim in the respective `index.html`, so they are
  correct web citations my PDF-only harness cannot see; one is verdict-101's document *title*
  („Obecných zásad pro hodnocení dopadů regulace") used inside an **absence** claim, which is
  grep-true (`3.8` = 0 hits, `Obecných zásad` = 0 hits in tisk 101); one is verdict-63's
  bracket-marked reorder, recorded but never filed. **Zero fabricated, zero re-inflected, zero
  spliced, zero imported quotations survive.** B1a's welded phrase is gone; B1b restored to
  „je navrhována relativně dlouhá legisvakanční doba, úměrná rozsahu změn"; B1c, B1d, B1e restored
  verbatim. **ASCII quotation marks: 0 in all 12 files** (M13 closed).
- **B2** — verdict-114 rewritten correctly. „10. Zhodnocení dopadu … ve vztahu k ochraně soukromí a
  osobních údajů" (10.1–10.9) and „11. … (CIA)" both now stated as they are in the print; the K § 13
  passage („je doplněním přímo použitelné právní úpravy prolomení mlčenlivosti, kterou obsahuje
  čl. 13 odst. 2 a čl. 25 odst. 4 nařízení CBAM") quoted and its consequence accepted. The surviving
  finding is now honestly framed („Obě tvrzení jsou samostatně pravdivá a zpráva je nijak neskrývá
  — ale nikde je vzájemně nepropojuje"). `severity` → `low`.
- **B3** — verdict-144's invented chain is gone. What remains is exactly two facts, both data-backed:
  rozeslání **25. 3. 2026 v 12:39** (matches `index.html` verbatim) and přikázání VB **15. 4. 2026**
  (matches `assignedOn: 2026-04-15`). The payload now *states the archival gap* and the web citation
  enumerates what is **not** documented. Best-in-batch handling.
- **B4** — verdict-6 and verdict-101 now say „doporučil … přikázání (navrženo přikázat, nikoli již
  přikázáno)" against `navrzeno`; verdict-63 reads „první čtení 12. 3. 2026, **na jehož konci** byl
  tisk přikázán … — přikázání tedy datuje shodně s prvním čtením, nikoli o tři měsíce dříve",
  matching `assignedOn: 2026-03-12` and fixing the impossible ordering.
- **B5** — `severity: "medium"`. The print's own „…zejména se z povahy věci neuplatní zásada
  presumpce neviny…" is now quoted and **verified byte-exact**. The fabricated „bod 3.8" authority is
  replaced by a grep-true absence claim. „cosi mezi" is now correctly identified as a **three-level
  nested** citation (tisk 101 → ÚS II. ÚS 1026/21 → the § 102a memorandum), with the adoption noted.
  § 12 discretion carries the medium.
- **B6** — verdict-87's money now matches verdict-76 row for row: class split, 391 010 121 Kč, role
  end dates 2014-08-06 / 2015-03-02, the money-postdates-role flag, and an explicit „nikoli živé
  vazby, jak by mohla naznačovat prostá přítomná formulace". The intra-batch contradiction is gone.
- **B7** — SOMPO resectored in **both** files („obecní svazková firma pro odpadové hospodářství …
  **nikoli pojišťovna**"), clearances re-reasoned, and the fix over-delivers: full attributable /
  steward split matching `ledger.json` **exactly** (SOMPO `manager`, PEVAK `manager`, W.H.V.
  `owner-operator`; Via rustica, PRO VYSOČINU, SVJ `steward`), CZK published (9 174 258 + 1 234 888
  + 0 = **10 409 146 Kč**, arithmetic correct), and MINOR 21 closed on top (ARES-VR: the SOMPO seat
  ended 31. 10. 2024, before the 25. 3. 2026 filing).
- **B8** — verdict-116 files the real effect with the „interních pravidel vlády" quote verbatim,
  plus the no-legisvakance / no-transitional-provisions passage; `severity` → `medium`.
- **M1–M4, M14 (verdict-6)** — effect restated as design **preservation** with both K § 5 / K § 7
  quotes verbatim; § 7 odst. 2's **1/2/1** allocation restored; the three unsupported dates removed
  and the one-package finding re-grounded on independently verified evidence (`index.html` 13:15 vs
  13:16 and the reciprocal cross-listing), explicitly „nezávisle na jakémkoli konkrétním datu";
  `severity` → `low` with the tisk-7 comparator stated. **Stojanová is de-named entirely** — the
  payload now says „ještě jedno další poslanecké jméno" and discloses the array defect citing tisky
  87 and 116. The „V Praze dne 10. října 2025 Předkladatelé Ivan Bartoš … Olga Richterová" basis is
  **verbatim-verified**.
- **M5, M6 (verdict-76)** — the „mlčí o" claim retracted, the three passages quoted verbatim, the
  finding narrowed to bod 12, and tisk 77 now cited.
- **M9–M12** — 114 → `low`; 55's delegation bounded by čl. 5 odst. 5 and „omezit nebo zamítnout
  pouze tehdy, je-li to nezbytné"; 116's seven unrecorded steps stripped **including the
  tisk-87-imported 4. 3. 2026**; 87 gained an honest effect (§ 1 odst. 1 vs „Nebyla zadána žádná
  veřejnoprávní povinnost", both quotes verbatim).

**Standing sweeps re-run:** `validateLawVerdict` **0 failures / 12** · `lawJargonIssues` **0** ·
Czech gate **0** · severity **6 low / 6 medium / 0 high** · Cyrillic **0** · non-NFC **0** ·
zero-width **0** · empty `whoBenefits`/`evidence` **0** · ASCII quotes **0** · the two `43\d{3}`
hits are substrings of IČO **27043843** (PRO VYSOČINU) — legitimate, confirmed against the ledger.
Round-1 MINORs 4, 5, 6, 7, 8, 10, 12, 13, 14, 15, 21, 23 all closed.

## CLOSURE: **NOT CLOSED** — 3 surviving items

The batch is transformed: no fabricated quotation, no falsified finding, no invented procedural
chain, and no unearned `high` remains. The surviving items are one **regression introduced by the
remediation pass** and two consistency defects. All three are small and localized.

### S1 — MAJOR · **REGRESSION** · verdict-144: a new uncited authority claim
`verdicts-021/verdict-144.json` · `.conflictAssessment`
> „Jde o vládní předlohu navazující na **programové prohlášení vlády z roku 2022** a na hodnocení
> dopadů regulace z ledna 2024…"

Measured over `tisk-144/268804.txt` (1 906 845 B): **`programov` = 0 hits**; all 82 `prohlášení`
hits are unrelated (čestné prohlášení, prohlášení za mrtvého, souhlasné prohlášení otcovství). The
phrase appears in no cached source and carries no citation. This text is **new in this round** — the
pre-remediation payload said only „navazující na … hodnocení dopadů regulace z ledna 2024".

It is the same class as the M7 defect the pass just correctly removed from verdict-101 (an authority
attributed to a document that does not carry it), re-introduced two files away. It is exculpatory
framing and changes none of verdict-144's three findings — but it cannot ship in the batch that
closes the corpus. **Remove it, or cite a source that exists.**

### S2 — MAJOR · the batch now applies two evidentiary standards to one kind of claim
The remediation adopted a strict rule in verdicts **116** and **144** — state only procedural steps
the cache or the targets file documents, and disclose the archival gap:
> [144] „…podrobná historie projednávání pro tento tisk nebyla archivována a nemůže tedy sloužit
> jako zdroj. Tento posudek proto uvádí jen rozeslání a přikázání jako doložené procesní kroky."
> [116] „Žádné další procesní kroky … nejsou v uložených podkladech k tisku ani v datech případu
> doloženy, a tento posudek je proto neuvádí."

It was **not** applied to the other four files carrying the same kind of claim. Verified: **no
tisk's `index.html` lists any `/1` or `/2` print** — every cached page lists only the `/0` files —
yet
- **verdict-63** asserts „přerušení projednávání usnesením Rozpočtového výboru z 30. 4. 2026
  (**tisk 63/1**) s možností pokračování od 11. 7. 2026";
- **verdict-98** asserts usnesení č. 31, zpravodaj Hebr, usnesení č. 258, usnesení č. 22 and the
  dates 2. 9. / 13. 9. 2026;
- **verdict-87** asserts **tisk 87/1** (government stance 25. 2. 2026), usnesení č. 37, zpravodaj
  Vojáček, 7. 3. 2026;
- **verdict-129** asserts **tisk 129/1** (31. 3. 2026) and a government stance.

None of these is contradicted by `committeeRouting` (unlike B3), so none is a fabrication finding.
But after this remediation the batch **publishes two different standards for the same claim type**,
and the four looser files are now inconsistent with the doctrine the batch states in its own text.
Either extend the disclosure sentence to 63/87/98/129, or state once, per batch, that `historie.sqw`
was not archived and such steps are carried at lower confidence.

### S3 — MINOR-group · evidence-field parallelism and four copy defects
- **Four `unstatedEffects[].evidence` fields are bare URLs** (54 chars, the `tiskt.sqw` link and
  nothing else) while thirteen carry quotations: **verdict-52 eff0 and eff1, verdict-55 eff0,
  verdict-76 eff1**. Three of the four rest on claims that *are* quotable and *are* quoted in the
  same payload's `citations` (§ 6 písm. c) bod 1 and bod 11.9 for verdict-52; § 14 odst. 7 for
  verdict-55). The evidence doctrine's own field should not be the emptiest one.
- **verdict-114 · `.researchedContext`** — English inside Czech prose: „**secrecy**-breach
  mechanismus", „podřizuje **enforcement** mechanismu". Below the language gate's threshold, but the
  batch's rule is Czech prose.
- **All-caps emphasis, unprecedented in the published corpus** (verdicts-011…020 contain all-caps
  tokens only as proper nouns/acronyms): verdict-76 „NEZAMLČUJE", „PŘECHOD"; verdict-101 „K TOMUTO",
  „NEPODAT".
- **verdict-101 · `.citations[4].claim`** — internally contradictory: „Návrh podala vláda 10. 2.
  2026; Organizační výbor **toho dne** pouze doporučil jeho přikázání … **19. 2. 2026**". Both dates
  are individually correct; „toho dne" is a copy-edit slip.
- The **retraction narrative** („Dvě dřívější verze tohoto nálezu tvrdily … byla proto stažena" in
  verdict-114; „na rozdíl od dřívější verze tohoto nálezu" in verdict-76) is **precedented**
  (`verdicts-011/verdict-67`) and therefore not filed — but verdict-114's is a four-sentence
  paragraph about its own drafts, an order of magnitude beyond the precedent, on a reader-facing
  surface.
- Surviving from round 1: verdict-129's filing date „10. 3. 2026" against the print's signature
  „V Praze dne 4. 2. 2026"; verdict-101 still omits § 12's **1 000 000 Kč** threshold and does not
  note that § 27's effect date (1. 7. 2026) is already past.

## Gate idea this round earns

The remediation was verified by a 137-span self-sweep that reported 0 unresolved misses, yet S1 —
a fabricated authority — was **introduced** by the same pass. A quotation sweep cannot see an
uncited claim written *outside* quotation marks. The corpus needs a second, cheap check alongside
it: **every proper-noun authority named in a payload (a document title, a government act, a
programme statement, a methodology) must be locatable in a cached source or carry its own
citation.** `programové prohlášení vlády z roku 2022` and the removed `bod 3.8 Obecných zásad` are
the same defect, and only the second one had quotation marks around it.

## Carried forward (not gating, per the coordinator's scope note)

The upstream graph `sponsors`-prop defect (`psp-tisky-roles`, pass 34 — both shapes: wrong join on
tisk 87, over-inclusion on tisky 6 and 116; 3 `origin:"mp"` bills with n>1; 23 bills with n=0) is
**not** fixed in this batch and is carried as its own regen+audit item. The verdict layer is now
**fully insulated**: all three affected verdicts (6, 87, 116) use only print-verified submitter
names and each discloses the discrepancy. The free detector remains unbuilt — `sponsors` vs
`submitter` disagreement flags every affected bill today.

---
---

# CLOSURE CHECK — round 3 (re-verified against the actual file state)

Files re-read from disk (timestamps 10:03–10:04). Full quotation sweep, standing sweeps, date-
integrity scan and repo validators re-run. Nothing accepted on report.

## Closed in this round

- **S1 · CLOSED.** `programov` = **0 hits** anywhere in verdict-144. The clause is gone and the
  surrounding text is coherent: *„…ani sektorový lead. Jde o vládní předlohu. Na základě dostupných
  dat nebyl u tisku 144 zjištěn střet zájmů…"*. **No orphaned meaning:** the „vládní předloha"
  clause still carries its argumentative role (a government bill is not a private-interest vehicle)
  and is independently true (`origin: "government"`, submitter „ministr vnitra", print title
  „Vládní návrh"). The verified RIA-reuse finding survives intact in its own fields — `OVA 52/24`,
  `782/0` and „Závěry hodnocení dopadů regulace jsou proto nadále platné" are all still present in
  `researchedContext` and `unstatedEffects[0]`. Nothing was lost with the removal.
- **S3 · CLOSED.** English tokens in Czech prose: **0** across all twelve files (`secrecy`,
  `breach`, `enforcement` all gone from verdict-114). All-caps emphasis: **0** — the only remaining
  all-caps tokens are legitimate acronyms and proper nouns (CBAM, GDPR, ARES, IFRS, DPIA, ESLP,
  KPMG, SOMPO, PEVAK, NEXNET, RAPAJA, RMPJ, BISS, ÚDHPSH, BCRD, MERO, PRAK, ČSOB, DOCX, KLEP,
  SUTNAR, ZPDM, VYSOČINU). verdict-101 `.citations[4]` is now internally consistent: *„Návrh podala
  vláda 10. 2. 2026; Organizační výbor 19. 2. 2026 pouze doporučil jeho přikázání … Sněmovna sama
  jej ještě nepřikázala."*
- **No regression anywhere else.** Quotation sweep re-run: **118 spans → 106 exact, 8 case-only,
  4 non-exact**, byte-identical to round 2, and all four non-exact resolve clean (two psp.cz
  `index.html` page labels, verdict-101's document title inside a grep-true absence claim,
  verdict-63's bracket-marked reorder). ASCII quotation marks **0/12**. `validateLawVerdict`
  **0 failures / 12**, `lawJargonIssues` **0**, Czech gate **0**, severity **6 low / 6 medium /
  0 high**.

## CLOSURE: **NOT CLOSED** — 1 item

### S2a — the S2 disclosure was inserted mid-sentence in 2 of 4 files, splitting a date in half

The disclosure sentence itself is correct and well-worded, and in **verdict-87** and **verdict-129**
it lands at a genuine sentence boundary (after „…dostupný pouze jako soubor PDF/DOCX.") — those two
are clean. In **verdict-63** and **verdict-98** the insertion point was chosen on the wrong `.`: the
splitter treated the **day-ordinal dot of a Czech date** as a sentence terminator. Both files now
publish a destroyed date inside a broken sentence:

**verdict-63 · `.researchedContext`**
> „…přerušení projednávání usnesením Rozpočtového výboru z 30. 4. 2026 (tisk 63/1) s možností
> pokračování **od 11. Údaje o průběhu projednávání nad rámec rozpisu v datové sadě (čísla
> navazujících tisků a usnesení, data jednotlivých kroků) vycházejí výhradně ze stránky historie
> tisku na psp.cz; archivované podklady obsahují pouze výchozí text tisku. 7. 2026** — k datu tohoto
> nálezu tedy tisk zůstává v projednávání."

The date **11. 7. 2026** is cut in two by a 210-character paragraph.

**verdict-98 · `.researchedContext`**
> „…jeho projednání je plánováno na 2. 9. 2026 (usnesení č. 22) a další postup je možný **od 13.
> Údaje o průběhu projednávání nad rámec rozpisu v datové sadě (čísla usnesení a data jednotlivých
> kroků) vycházejí výhradně ze stránky historie tisku na psp.cz; archivované podklady obsahují pouze
> výchozí text tisku. 9. 2026.** Směrnice Rady (EU) 2023/2226…"

The date **13. 9. 2026** is cut in two the same way.

This is the batch-015 **N10/N11 spliced-sentence class**, reproduced by an automated edit. It is
mechanical and trivially fixable — move the disclosure to the end of the procedural paragraph (where
it reads better anyway, since it governs the whole paragraph rather than the clause it currently
interrupts). But it cannot ship: *„další postup je možný od 13. Údaje o průběhu projednávání …
výchozí text tisku. 9. 2026."* is not a sentence, and two dates in the corpus-closing batch are
currently unreadable.

**The gate cannot see it** — `validateLawVerdict`, `lawJargonIssues` and the Czech language gate all
pass 12/12 over both files, and the quotation sweep is unaffected because the damage is outside
quotation marks. A one-line detector closes it permanently:
`/\b\d{1,2}\.\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/` over `researchedContext` flags a capital letter following a
bare day-ordinal, which in Czech legislative prose is almost always a split date. Run today it
returns exactly these two hits and nothing else.

## Not gating, but still open

**Four `unstatedEffects[].evidence` fields remain bare 54-character URLs** — verdict-52 eff0 and
eff1, verdict-55 eff0, verdict-76 eff1 — against thirteen that carry quotations. Three of the four
rest on claims that are quotable and are already quoted in the same payload's `citations`
(§ 6 písm. c) bod 1 and bod 11.9 for verdict-52; § 14 odst. 7 for verdict-55). This was filed in
round 2 under S3 and was not among the two leftovers deliberately left untouched. It is a field-
parallelism defect, not a truth defect, and does not gate the write — but the evidence doctrine's
own field should not be the emptiest one in the batch.

Deliberately untouched per round 2, confirmed still so and correctly so: verdict-129's filing-date
nuance (print signature „V Praze dne 4. 2. 2026" vs the stated 10. 3. 2026) and verdict-101's
omitted § 12 threshold (1 000 000 Kč) / already-lapsed § 27 effect date.

---
---

# CLOSURE CHECK — round 4 (final)

Files re-read from disk (timestamps 10:03–10:09). Full quotation sweep, standing sweeps, the
date-split detector and the repo validators all re-run. Nothing accepted on report.

## S2a — CLOSED

**verdict-63** — the date reads whole and the disclosure sits at the boundary between the
procedural block and the document-reading block, which is the right seam:
> „…a přerušení projednávání usnesením Rozpočtového výboru z 30. 4. 2026 (tisk 63/1) s možností
> pokračování **od 11. 7. 2026** — k datu tohoto nálezu tedy tisk zůstává v projednávání. **Údaje o
> průběhu projednávání nad rámec rozpisu v datové sadě … obsahují pouze výchozí text tisku.** Přímé
> čtení hospodářské a sociální části důvodové zprávy potvrzuje…"

**verdict-98** — the date reads whole and the disclosure closes the field:
> „…jeho projednání je plánováno na 2. 9. 2026 (usnesení č. 22) a další postup je možný **od
> 13. 9. 2026**. Směrnice Rady (EU) 2023/2226…"
> …[DAC material, then the § 13n finding]…
> „**Údaje o průběhu projednávání nad rámec rozpisu v datové sadě (čísla usnesení a data
> jednotlivých kroků) vycházejí výhradně ze stránky historie tisku na psp.cz; archivované podklady
> obsahují pouze výchozí text tisku.**"

**No claim is orphaned by the end placement.** The sentence names its own scope („údaje o průběhu
projednávání … čísla usnesení a data jednotlivých kroků"), so it reaches back to the procedural
block regardless of what sits between, and its wording cannot be misread as qualifying the DAC
directive material or the § 13n finding that precede it. It reads as a closing methodological note.

**A detail worth recording, because it is the opposite of sloppy:** verdict-98's parenthetical is
„(čísla usnesení a data jednotlivých kroků)" while 63, 87 and 129 read „(čísla navazujících tisků a
usnesení, …)". That is correct per file — 63, 87 and 129 each assert a follow-on print (63/1, 87/1,
129/1) and verdict-98 asserts none, carrying only tisk 98/0 and the eKLEP number. The disclosure was
tailored to what each file actually claims rather than pasted uniformly.

**All four placements verified at true sentence boundaries** (each preceded by „. ").

**Date-split detector re-run batch-wide over every reader-facing field of all twelve payloads
(`statedReasoning`, `researchedContext`, `conflictAssessment`, every `unstatedEffects[]` subfield,
every `citations[].claim`): 14 hits, every one inspected, all 14 legitimate** — numbered zrušovací
lists inside quoted normative text (verdict-116 cit0 ×3, verdict-129 cit0 ×3), quoted section titles
(verdict-114 ×3: „10. Zhodnocení…", „11. Zhodnocení…"), and sentences legitimately ending in a
figure before a new sentence (verdict-116 „…tisk 116/0. Tisk byl…", verdict-98 „…pod č. 27/26.
Organizační výbor…", verdict-55 „…u tisku 52. Podle…", verdict-6 ×2 „…tisku 6. Tento/Tisk…").
**Zero real splits.**

## Non-gating leftover — CLOSED

All four bare-URL `evidence` fields now carry a locus before the link, matching the batch's
convention: verdict-52 eff0 „Text tisku 52 a jeho důvodová zpráva **(určení dozorového orgánu)**,
https://…"; verdict-52 eff1 „…**(zveřejňované údaje o zástupcích)**, …"; verdict-55 eff0 „Text
tisku 55 **(rozhodování ČTÚ o cenových sporech)**, …"; verdict-76 eff1 „Text tisku 76 a jeho
důvodová zpráva, …". **Bare URLs: 0 of 18.** verdict-76 eff1 is the thinnest of the four, carrying
no parenthetical coordinate — correctly so: its claim is an absence claim (no RIA anywhere in the
print), where there is by definition nothing to quote and no narrower locus to name.

## Final battery — no regression anywhere

| Check | Result |
|---|---|
| Quotation sweep (typographic + ASCII, NFC, zero-width-stripped, whitespace-collapsed) | **118 spans → 106 exact · 8 case-only · 4 non-exact**, byte-identical to rounds 2 and 3 |
| The 4 non-exact | all benign and unchanged: 2 psp.cz `index.html` page labels (verified verbatim in the HTML), verdict-101's document title inside a grep-true absence claim, verdict-63's bracket-marked reorder |
| Fabricated / re-inflected / spliced / imported quotations | **0** |
| ASCII quotation marks | **0 / 12 files** |
| `validateLawVerdict` | **0 failures / 12** |
| `lawJargonIssues` | **0** |
| Czech language gate | **0 errors** |
| Severity distribution | **6 low · 6 medium · 0 high** |
| `43\d{3}` outside `source` | **0** (the only matches are substrings of IČO 27043843, PRO VYSOČINU) |
| Cyrillic homoglyphs · non-NFC bytes · zero-width chars | **0 · 0 · 0** |
| English tokens in Czech prose · all-caps emphasis | **0 · 0** |
| Empty `whoBenefits` / `evidence` · quotation-mark balance | **0 · exact in all 12** |
| Date-split detector | **0 real hits** |

---

# CLOSURE: ✅ **CLOSED**

**No surviving items.** All 8 BLOCKING groups, all 14 MAJORs, the round-2 regression (S1), the
round-2 consistency defect (S2), the round-3 insertion bug (S2a) and the round-3 non-gating
leftover are closed and independently re-verified against the prints, the ledger, the targets file
and `index.html` — not against the remediation reports.

**Batch 021 is cleared for the pass-55 write and the 141/141 corpus close.**

## What this batch cost, and what it bought

Four rounds. Round 1 filed 8 blocking groups and 14 MAJORs; rounds 2–4 each surfaced a defect
*introduced by the previous fix* — S1 a fabricated authority, S2a a splitter that cut two dates in
half. That pattern is the finding worth carrying forward more than any individual verdict: **on this
corpus, remediation is itself a defect source at roughly the same rate as authorship**, and both
regressions passed the full validator suite (12/12) and the quotation sweep untouched.

Two detectors now exist because of it, both cheap and both adopted into the standing brief:

1. **Named-authority rule (round 3)** — a document title, government act, programme statement or
   methodology named *outside* quotation marks needs a cached-source hit or its own citation. This
   is what „programové prohlášení vlády z roku 2022" and „bod 3.8 Obecných zásad pro hodnocení
   dopadů regulace" had in common, and only the second one was inside quote marks where the sweep
   could see it.
2. **Date-split detector (round 4)** — `/\b\d{1,2}\.\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/` over reader-facing
   fields. It costs one regex, and on this batch it returned the two real splits plus twelve
   inspectable false positives.

Both close blind spots that no quotation sweep can cover, because both defects live in prose that
carries no quotation marks at all.

## Carried forward (explicitly not gating)

The upstream graph `sponsors`-prop defect (`psp-tisky-roles`, pass 34) is **unfixed** and carried as
its own regen+audit item: two error shapes (wrong join on tisk 87 — 42 cross-club names with the
sole real submitter absent; over-inclusion on tisky 6 and 116), 3 `origin:"mp"` bills carrying n>1
(70, 87, 124), 23 bills carrying n=0 including `mp` bills with a named submitter (85, 88), and a
`submitter` string prop that is correct throughout and disagrees with the array with nothing
reconciling them. **The verdict layer is fully insulated:** all three affected verdicts (6, 87, 116)
use only print-verified submitter names and each discloses the discrepancy in its own text. The free
detector — `sponsors` vs `submitter` disagreement — remains unbuilt and flags every affected bill
today.
