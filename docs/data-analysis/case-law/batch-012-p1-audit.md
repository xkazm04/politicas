# Batch-012 P1 — fresh independent audit of the REMEDIATED batch-011 verdicts

**Auditor:** second independent adversarial pass (Opus, max reasoning), 2026-08-04. No prior involvement
with batch-011; the first audit (`batch-011-audit.md`) and the remediation (`batch-011.md` §3) were read
as *claims to be tested*, not as findings to be trusted.
**Scope:** the 12 remediated verdicts in `payloads/verdicts-011/`, the two close-read payloads
`collision-close-reads-batch011-g{A,B}.json`, and every NEW factual claim the remediation introduced.
**Method:** every quantitative and legislative claim re-derived from the primary cached text
(`.data/law-collision-cache/tisk-<n>/*.txt`), NFC-normalised before matching (`readFileSync(...,'utf8')
.normalize('NFC')` then a line regex — plain `rg` is unsafe on these PDF extractions). Money claims
re-derived from `batch-011-targets.json` by regrouping `attributedSectorLeads` and enumerating
`sponsors[].moneyTies` independently. Six URLs / registry sources fetched or searched. The batch's own
gate was re-run.
**No verdict or close-read file was modified. No git command was run. No PGlite database was opened.**

---

## VERDICT: **REOPENED**

All nine first-audit findings are genuinely closed — I re-derived each one from the primary source rather
than from the remediation's own account of itself, and **9/9 are FIXED**, several of them well. The
Lovochemie double-booking is gone and the lead groups are now disjoint and sum to 14; the VAT dismissal is
retracted in the analyst's own voice and replaced by a correctly-signed, explicitly unquantified channel;
SynBiol is disposed on a mechanism I verified is *literally the same statutory sentence* as the EIA
one-stop-shop; verdict-64's new arithmetic reproduces to the line; verdict-189's three missing riders are
all verbatim where cited; and gB's `classificationCounts` now equals its own `pairs[]`.

But **the remediation introduced defects of its own that no one has audited until now: 1 BLOCKING and
6 MAJOR.** The pattern is not random. Five of the seven sit in the *money-touching* claim class — the same
class the first audit found broken — and the two most serious are a class of defect the first audit never
tested for at all: **both newly-written money dispositions attach a multi-billion-koruna figure to a named
politician in the present tense, and in both cases the underlying registry relationship has been over for
years.** The remediation went to the company register to fix an ownership premise and did not bring back
the temporal fact sitting in the same record.

Additionally the batch's own machine gate, which `batch-011.md` §2 reports as passing 12/12, **now exits 1**.

None of this is fabrication. Every statute cited anywhere in the 12 verdicts is real, every legislative
excerpt I re-checked is verbatim, and the hedged `pending_review` register is intact throughout. The
defects below are misdating, mislabelling and one reversed word — but they are on a public surface that
names Andrej Babiš, Petr Bendl, Boris Šťastný, Radek Vondráček and David Pražák.

---

## Job 1 — closure of the nine first-audit findings

| # | Finding (as tabulated in `batch-011.md` §3) | Status | Evidence I checked |
|---|---|---|---|
| **B1** | verdict-67: Lovochemie placed in the 100/2001 group it is not attributed to | **FIXED** | Re-grouped `attributedSectorLeads` for tisk 67 in `batch-011-targets.json` myself: `100/2001` → exactly {CS CABOT, PRECHEZA, Fatra, Synthesia}; `139/2002` → {AGROFERT, Kostelecké uzeniny, AGROPROFIT, **Lovochemie**, AGRONOVA CS}. `unstatedEffects[1].whoBenefits` now names only the four, and adds an explicit parenthetical placing Lovochemie et al. under 139/2002. Groups disjoint; the self-contradiction with `conflictAssessment` is gone. |
| **M2** | verdict-67: "bez věcného dopadu na DPH" cleared four leads | **FIXED** | `conflictAssessment` now states in the analyst's own voice that *"dřívější tvrzení tohoto verdiktu, že jde o změnu „bez věcného dopadu“, bylo nesprávné a je zde opraveno"*, names § 55a "Dodání pozemku", and declines to model direction/magnitude. Instruction verified verbatim at `tisk-67/266188.txt:6832-6834`; the *platné znění* confirming § 55a odst. 2 písm. a) **is** the definition of stavební pozemek at `266190.txt:22315-22326`. The cited line ranges (6829–6834, 22315–22326) both land exactly. The new `unstatedEffects[2]` states the direction correctly: widening `stavební pozemek` shrinks the § 55a odst. 1 exemption. |
| **M3** | verdict-67: "12" leads claimed, 14 in the data; SynBiol undisposed | **FIXED** | `conflictAssessment` opens *"14 sektorových vazeb (nikoli 12)"*; the four groups sum 5 + 4 + 4 + 1 = 14 ✓. SynBiol is group (4) and is disposed on a stated mechanism, not silently. **I verified the mechanism is sound, not just present:** the § 77 odst. 2 text this batch inserts into 258/2000 (`266188.txt:6257-6265`) is word-for-word the same one-stop-shop clause as the § 151 odst. 2 it inserts into 541/2020 (`266188.txt:7423-7430`). Folding the health lead into the EIA channel is correct. |
| **M4** | verdict-67: Šťastný × Pražské služby silently skipped | **FIXED** (disposal present and cited; but see **F1**) | The tie is now explicitly vypořádána. Amount 53 271 958 488 Kč ✓ matches `sponsors[Boris Šťastný].moneyTies[60194120]` and is indeed the largest single tie of any sponsor on the bill (next: Synthesia 1 012 541 747 Kč). The odpady mechanism is real and material — `266188.txt:7384-7430`: competence moves to the stavební úřad (§ 93a bod 2, § 126 bod 4, new § 146a bod 7), *"9. § 149 se včetně nadpisu zrušuje."*, and bod 10 rewrites § 151 odst. 2 into the EIA one-stop-shop ✓. Prague's 100 % ownership since 2018 confirmed by web search (squeeze-out of the remaining ~4 %, finalised December 2018). |
| **M5** | verdict-64: medium rested on a census artefact + a premise the DZ refutes | **FIXED** | `severity` is now `low`. The census note is demoted out of `unstatedEffects` into `researchedContext` and explicitly labelled *"Poznámka k datům tohoto batche, nikoli zjištění o samotném návrhu zákona"*. The staggered-effectiveness effect is **deleted**, and `citations[1]` now affirmatively states the DZ explains the two-year deferral. `unstatedEffects[0]` is now a claim about the bill. |
| **M6** | verdict-221: "výhradně ministři" false | **FIXED** (in substance; but see **F3**) | Two-track restatement present. I read Čl. I and Čl. X myself: bod 3 *"§ 4b se zrušuje."* (`tisk-221/271529.txt:30`) ✓; new § 4c odst. 2 binding *"člen zastupitelstva územního samosprávného celku, který je poskytovatelem dotace"* at lines 40-46 ✓; new § 48 odst. 8 (zadavatel podle § 4 odst. 1 písm. a), funkcionář *"stojící v čele ústředního správního úřadu"*) at 457-462 and odst. 9 (zadavatel podle § 4 odst. 1 písm. d) = ÚSC, člen zastupitelstva) at 464-469 ✓. The DZ's own *"Pro zachování symetrie…se navrhuje jeho rozšíření"* is verbatim at 604-605 ✓. Both sponsors' councillor seats web-verified (below). |
| **M7** | verdict-103: company attributed to the wrong sponsor; "nikoli o soukromé vlastnictví" false | **FIXED** (but see **F2**) | Enumerated all ten sponsors' `moneyTies`. *Vodárny a kanalizace Karlovy Vary, a.s.* (221 321 239 Kč) is now correctly listed under **Jan Bureš** ✓. Every figure in the new inventory matches the targets file exactly (Bureš ×5, Bendl ×5, Černochová ×3 — all verified). The blanket "nikoli o soukromé vlastnictví" is gone; *Energie - stavební a báňská a.s.* is named as private, **and it is** (registry aggregators show shareholders Osner / Jágr family, no public body). The verdict now explicitly states the case file carries **no `tie_class`** and declines to assert one — exactly the repo doctrine the first audit invoked. |
| **M8** | verdict-189: rider inventory missed 3 of 7 bundled tax changes | **FIXED** (but see **F5**) | All three grep-verified verbatim: **VAT 21→12 % on non-alcoholic restaurant drinks** at `tisk-189/270143.txt:1380-1388` and 1723-1727 (quoted sentence exact at 1725-1727) ✓; **§ 46 nedobytné pohledávky** 6→3 months and 10 000→20 000 Kč at 1390-1403 and 1741-1744 ✓; **§ 6 odst. 9 písm. d) bod 4** social-services exemption, all six named services verbatim at 618-626, with its unquantifiable-impact note at 3217 ✓. The list is honestly hedged as *"nejméně sedmice"*, which is the right call — the same bill also bundles a rekreace/zájezd exemption (bod 3, line 619-620) and raises the annual nedobytné-pohledávky cap 20 000→100 000 Kč (1745-1746). |
| **M9** | gB `classificationCounts` contradicted its own `pairs[]` | **FIXED** | Recounted both files from `pairs[].classification`. `gA`: stored 7/1/0, actual 7/1/0 ✓. `gB`: stored **6/1/1**, actual **6/1/1** ✓. Sum = **13 confirmed / 2 coordination-risk / 1 incidental**, which now matches the batch headline. `coverage` (8/8) correct in both. |

**Closure result: 9/9 FIXED.**

---

## Job 2 — adversarial audit of what the REMEDIATION itself introduced

### F1 — **BLOCKING** · `verdict-103.json` · `conflictAssessment` (and the same class in `verdict-67.json`)

**A multi-billion money tie is asserted against a named MP in the present tense, and the registry says the
relationship ended in 2001.**

- Field: `verdict-103.json` · `conflictAssessment` — *"Petr Bendl na … **Energie - stavební a báňská a.s.
  (20 790 731 132 Kč – jeho jednotlivě nejvyšší tíha)** …"*, and the closing sentence which reasons about
  *"Energie - stavební a báňská a.s. jako stavební/báňské firmy"* as one of Bendl's holdings.
- How I checked: fetched `https://www.podnikatel.cz/rejstrik/energie-stavebni-a-banska-a-s-45146802/` —
  it records **Petr Bendl as `člen dozorčí rady`, "První vztah: 8. 11. 1996 – Poslední vztah: 23. 2. 2001"**,
  with no current position. Cross-checked `https://rejstrik-firem.kurzy.cz/45146802/energie-stavebni-a-banska-as/`:
  the current bodies (as recorded 3. 3. 2025) are Vytiska / Osner / Jágr / Jágrová / Osnerová — **no Bendl**.
  A domain search for `Petr Bendl "Energie - stavební a báňská" dozorčí rada` surfaced no later relation.
- Why blocking: the remediation **visited this very registry** to establish the ownership premise
  (`citations[4]` sources or.justice.cz for exactly this company) and returned with the ownership fact while
  leaving behind the temporal fact recorded three lines away. The result is that the corrected sentence
  publishes "Petr Bendl → 20,79 mld. Kč" as a live holding on a public-accountability page. The repo's own
  money doctrine is unambiguous that this must be dated — `/penize/[pspId]` renders every tie with an
  ARES-VR temporal badge, `periodTo`, a `prior_term` note and a `stale-ongoing-in-graph` flag precisely so
  that an expired registry role is never read as a current one. The verdict surface renders none of that, so
  the verdict prose is the only place the qualification could live, and it does not.
- The same defect, one degree milder, is in **`verdict-67.json` · `conflictAssessment`**: *"nese největší
  jednotlivou peněžní vazbu ze všech sponzorů tohoto tisku **Boris Šťastný — Pražské služby, a.s.** …
  53 271 958 488 Kč … u něhož **je** vazba na Šťastného institucionální/svěřeneckou rolí"* — present tense.
  Checked: `https://zpravy.aktualne.cz/regiony/praha/zmeny-v-prazskych-sluzbach-dozorci-radu-opusti-stastny/…`,
  dated **12. 1. 2012**: *"Bývalý předseda pražské ODS Boris Šťastný končí v dozorčí radě Pražských služeb."*
  It is milder because "municipal company, therefore not a private stake" is a status that holds regardless
  of when he sat — but the figure and the role are still stated as current, and 53,3 mld Kč is the largest
  number in the batch.
- Fix: date both ties, or state that the case file carries no period and the relation could not be confirmed
  as current. Do not repair by deletion — the disposals themselves are correct and were the point of M4/M7.

### F2 — **MAJOR** · `verdict-67.json` · `unstatedEffects[2].whoBenefits`

**Two named Babiš-linked companies are printed under the label "KOMU PROSPÍVÁ" for an effect whose direction
the same verdict expressly refuses to determine — and whose stated mechanism is, on its face, a burden.**

- Field: `unstatedEffects[2].whoBenefits` — *"…v kontextu sponzorských vazeb jde o stejný okruh realitních
  developerů jako u prvního zjištění (**IMOBA, a.s. a Hartenberg Holding, s.r.o.**), u kterých je tedy tento
  mechanismus druhým, dosud nekvantifikovaným kanálem…"*
- How I checked: `features/lawwatch/components/BillDetail.tsx:463-465` renders this field verbatim behind the
  literal Czech label **`komu prospívá:`**. Meanwhile the sibling `effect` field states the mechanism as
  *"rozšiřuje se … okruh pozemků, které se pro účely DPH považují za **stavební (zdanitelné)**, oproti
  pozemkům osvobozeným od daně"* — i.e. **fewer** exempt land supplies — and `researchedContext` says outright
  *"Směr a míru čistého fiskálního/transakčního dopadu … tento verdikt nemodeluje."*
- So the page tells a Czech reader that a change benefits IMOBA and Hartenberg, on a Babiš-sponsored bill,
  in a verdict that says it does not know whether it benefits them. This is the mirror image of M2: the first
  audit caught an unsupported assertion of *absence* of effect; the remediation replaced it with an
  unsupported assertion of *direction* of effect, and put two real companies' names on it.
- Fix: the field must carry the affected class without the benefit claim (the prose already has the right
  words — *"u nichž změna hranice osvobození ovlivňuje DPH režim"* — they just need to be what renders), or
  the effect must state the direction it actually established.

### F3 — **MAJOR** · `verdict-221.json` · `researchedContext`

**One reversed word makes the remediated sentence assert the opposite of the finding, in the one verdict
whose remediation was *about* removing a self-contradiction.**

- Field, verbatim: *"Podle důvodové zprávy jde o vědomé **rozšíření** dosavadního rámce („pro zachování
  symetrie … se navrhuje jeho **rozšíření** na obchodní společnosti, jejichž skutečným majitelem je člen
  zastupitelstva územního samosprávného celku“) – tato větev tedy okruh dotčených osob spíše **RUŠÍ**, protože
  dosud § 4b a § 4c na členy zastupitelstev ÚSC vůbec nemířily."*
- How I checked: the DZ quotation is verbatim at `tisk-221/271529.txt:604-605`, and the operative § 4c odst. 2
  is at 40-46 — both say **expansion**. The word `RUŠÍ` (abolishes) is capitalised for emphasis, so it renders
  loudly, and the clause after it (*"protože dosud … vůbec nemířily"*) is the reasoning for **ROZŠIŘUJE**, not
  for `RUŠÍ`. Every other field in the file — `unstatedEffects[1]`, `conflictAssessment`, `citations[7]` — says
  expansion.
- Almost certainly a one-word slip, but it lands in a reader-facing field of a `medium` verdict that names two
  sitting MPs, and it inverts the mechanism that the whole M6 remediation exists to state correctly.

### F4 — **MAJOR** · `verdict-221.json` · `unstatedEffects[1]` + `conflictAssessment`

**The load-bearing premise — that the two MPs are the `skutečný majitel` of their companies — is asserted, not
verified, and it is exactly the class-assertion the first audit forbade in M7.**

- Field: *"na jejich vlastní společnosti (MAE invest a.s., AGROCENTRUM JIZERAN a.s.) **by se nové omezení
  vztahovalo**"* / *"Jejich společnosti … tak **nově spadají do okruhu dotčeného** § 4c odst. 2 a § 48 odst. 9"*.
- How I checked: both new provisions bind a company *"jejímž **skutečným majitelem** je člen zastupitelstva
  ÚSC"* (`271529.txt:44-46`, `465-466`) — a defined legal status with its own registry (evidence skutečných
  majitelů). `batch-011-targets.json` carries only `{ico, name, urn, contractCzk}` per tie: **no ownership
  stake, no beneficial-owner flag, no `tie_class`**. The verdict consults neither the beneficial-owner registry
  nor any substitute. Independent search does show David Pražák in AGROCENTRUM JIZERAN's statutory bodies
  (board member 2003-2007, deputy chairman since 2007) — but a board seat is **not** beneficial ownership, and
  that is the precise distinction the provision turns on.
- Why it matters even though the claim is exculpatory: verdict-103's remediation earned its fix by refusing to
  assert an unrecorded tie class; verdict-221's remediation asserts one in the same batch. The doctrine cannot
  hold on one file and not the other. The hedge that *is* present (*"pokud by tyto společnosti žádaly o
  nenárokovou dotaci"*) covers the transaction, not the ownership premise.

### F5 — **MAJOR** · `verdict-189.json` · `citations[2].claim`

**The remediation completed the rider list in `unstatedEffects[0]` and left a second, different, internally
false list of "seven" in the citation beside it.**

- Field: `citations[2].claim` — *"…zákon souběžně zavádí **sedm věcně nesouvisejících daňových změn**:
  **daňovou úlevu na evidenci tržeb**, slevu za umístění dítěte, slevu na studenta, zrušení zastropování
  volnočasových benefitů, osvobození spropitného v gastronomii, snížení sazby DPH na nealkoholické nápoje …
  a zkrácení lhůty u malých nedobytných pohledávek…"*
- How I checked: compared it against `unstatedEffects[0].effect`, which enumerates its own seven: (1) sleva za
  umístění dítěte … (7) **osvobození příspěvku zaměstnavatele na vybrané sociální služby**. The two lists are
  **not the same seven** — the citation swaps in the EET tax credit and drops the social-services exemption.
- And the swapped-in item is wrong on its face: the *daňová úleva na evidenci tržeb* is the credit that
  compensates businesses **for** EET. The cached text books it under its own heading *"Zavedení daňové úlevy na
  evidenci tržeb"* directly beneath the EET revenue estimate (`270143.txt:3227-3234`), and this verdict's own
  `statedReasoning` describes the 14,4 mld as *"kompenzovanými mimo jiné zavedením daňové úlevy na evidenci
  tržeb"*. Calling it one of the changes *"nesouvisejících s evidencí tržeb"* contradicts the file twice over
  and inflates the count that is the verdict's entire finding.

### F6 — **MAJOR** · `scripts/case-loops/law/gate-verdicts-011.ts` × `payloads/verdicts-011/`

**The batch's own gate no longer passes. `batch-011.md` §2's "All 12 pass `gate-verdicts-011.ts`" is not
reproducible today.**

- How I checked: ran it. Output ends `GATE: 12/13 batch-011 verdicts pass.`, **exit code 1**.
- Cause: the gate globs `readdirSync(DIR).filter(f => f.endsWith(".json"))` (line 25), and the persist step
  dropped **`batch-011-verdicts-combined.json`** — a 12-element *array* — into the gated directory. It fails
  the very first shape check (`root: expected a JSON object`).
- I confirmed this is a hygiene defect and **not** a content-integrity one: I diffed all 12 entries of the
  combined file against the individual files key-by-key — **12/12 byte-identical after canonical JSON
  serialisation**. So what was persisted at pass 43 is the remediated text either way.
- Why MAJOR anyway: this is the one automated check standing between a drifted verdict and a Czech reader.
  A gate that exits 1 on its own shipped payload is noise, and the next operator learns to ignore its exit
  code — which is precisely how the pass-42 lesson recorded in `CLAUDE.md` (a correction that never reached
  the data because nothing in the suite could see the difference) repeats itself. Move the combined artifact
  out of `verdicts-011/`, or have the gate skip non-`verdict-*.json` names.

### F7 — **MINOR** · `verdict-67.json` · `confidence` raised 3 → 4

Defensible, and I am recording the tension rather than asking for a change. The argument *for* 4: the
remediation did not weaken the verdict, it strengthened it — the EIA one-stop-shop finding is exactly verified
(`266188.txt:14481-14486`), the odpady mechanism is verified, and the § 55a channel is a **third** independent
route rather than a doubt about the first two. The finding being expressed is *"the lead sponsor is a
documented beneficiary of several sectors this bill favours"*, and that is now better evidenced than before.
The argument *against*: the verdict simultaneously holds a channel open with an undetermined sign and leaves
two of fourteen leads (IF Holding, IF FACILITY) closed on a web-sourced business-description rather than a
registry check. A 4 is the top of the "no further research would likely change this" band; a 3 would cost the
batch nothing. **Recommend 3, do not block on 4.**

### Carried-forward and residual MINORs

- **`verdict-64.json`** — the typo `durvodové zprávy` appears **twice**, once in `unstatedEffects[0].evidence`
  and once in `citations[2].claim`; both render. Separately, `unstatedEffects[0].whoBenefits` names a party
  that is *harmed* (*"Přehlednost pro Parlament a veřejnost je oslabena"*), under the label `komu prospívá`.
  **The new arithmetic is otherwise exact and I reproduced all of it independently**: 150 `ČÁST` headings
  (first at line 13, last `ČÁST STO PADESÁTÁ` at 12758); ČÁST DVACÁTÁ TŘETÍ = lines 915-4416 = **3 501**;
  second-largest ČÁST STO DESÁTÁ (auditoři) = **591** → **5,92×**; third ČÁST TŘICÁTÁ DEVÁTÁ (oceňování
  majetku) = **504** → **6,95×**; ČÁST PRVNÍ → Čl. CLX (line 12762) = **12 749** lines, so part 23 is
  **27,5 %** — the verdict's *"přibližně čtvrtinu … (3 501 z cca 12 750 řádků)"* is if anything conservative.
  The four parts it ranks next (investiční společnosti 414, kapitálový trh 411, obchodní korporace 410,
  rozpočtová pravidla 382) all fall inside the stated 380–420 band ✓. **`severity: low` is now correct.**
- **`verdict-221.json`** — typo `netranspoinovala` in `citations[1].claim` (renders). `citations[4]` still
  bundles **two** companies (AGROCENTRUM JIZERAN + MAE invest) under the single URN `company:ico:60914351`;
  the first audit's three-company version is improved but not resolved. `citations[9]` sources Pražák's
  *"od roku 2022 místostarostou města Semily"* to hlidacstatu.cz, whose functions page (fetched) lists only
  the councillor role from 2015 — **the claim is true** (independently confirmed) but the cited page does not
  carry it. `conflictAssessment`'s opening attributes the non-exclusivity to *"§ 4b a navazující § 11a"*,
  whereas it is the **new** § 4c odst. 2 / § 48 odst. 9 that reach ÚSC councillors; § 11a does key on
  § 2 odst. 1 písm. c) only.
  **Both councillor seats verified:** Vondráček — zastupitel Zlínského kraje since 2024 and Kroměříž
  zastupitel + místostarosta 2014-2017 ✓ (hlidacstatu.cz, fetched; note he appears to hold a Kroměříž seat
  again from 2022, which the verdict omits — an understatement, not an error). Pražák — zastupitel Libereckého
  kraje since 2024, Semily zastupitel since 2015, místostarosta since 2022 ✓. All three money figures match
  the graph exactly (405 232 883 / 3 040 369 / 912 000 Kč).
- **`verdict-103.json`** — *"jeho jednotlivě nejvyšší **tíha**"* is not idiomatic Czech for a money tie
  (the arithmetic is right: 20,79 mld > Povodí Vltavy 11,90 mld). `citations[4]` is an **or.justice.cz search
  URL** (`rejstrik-$firma?nazev=…`), not a permalink to the entity — a weak source anchor for an ownership
  claim about a named MP's company, and the same lookup that would have surfaced F1.
- **`verdict-213.json`** — the first audit's advisory MINOR is **still open**: `researchedContext` and
  `citations[2]` attach *"3 až 12 let"* to the pair "§ 339 a § 340". It is § 339's; § 340's new qualified
  offence is 3–10. Not one of the nine, so not a closure failure.
- **Register / self-serving formula** — the first audit's batch-level recommendation was partly taken:
  verdict-103's and verdict-221's instances are gone (221 now says *"zde závěr o absenci osobního konfliktu
  obstojí"* **with the reason stated**). It survives verbatim in **verdict-7** (*"to je zde věcný, nikoli jen
  formální závěr"*) and **verdict-77** (*"Absence konfliktu je zde očekávaný a hodnotný závěr"*) — both
  untouched by the remediation and both, on inspection, resting on real work that names the provisions checked.

### What I confirmed is sound (so the batch keeps the credit)

- **All 12 verdicts satisfy the contract.** Every one of the twelve `verdict-*.json` passes
  `validateLawVerdict` with `requireCzech` on and the full anti-fabrication scope loaded; the single gate
  failure is the stray combined artifact (F6), not a verdict.
- **No fabrication.** Every `č. N/RRRR Sb.` in every file resolves inside the scope. Every legislative excerpt
  I re-read — 11 passages across tisky 64, 67, 189, 221 — is verbatim at or inside the cited line range.
- **Hedged `pending_review` register intact.** No verdict phrases a finding as established wrongdoing;
  verdict-67 still closes *"nikoli jako doklad konkrétního korupčního zvýhodnění jednotlivé transakce"* and
  verdict-189 still frames its rider finding as *"procesní/legislativně-technickou otázkou … nikoli osobním
  konfliktem zájmů"*. `pending_review` correctly remains a persistence-time state, not a payload field.
- **Severity/confidence are consistent with evidence** on 11 of 12 (see F7 for the twelfth): the three mediums
  are carried by real, verified mechanisms (67: EIA one-stop-shop + odpady + § 55a; 213: general
  third-country-national scope under a Ukraine title; 221: kogentní→fakultativní procurement narrowing), and
  verdict-64's demotion to `low` removes the batch's only unsupported medium.

---

## Required before any of the three mediums is promoted past `pending_review`

| # | Sev | File · field | Fix |
|---|---|---|---|
| F1 | **BLOCKING** | `verdict-103.json` · `conflictAssessment`; same class in `verdict-67.json` · `conflictAssessment` | Date the money ties or state that the case file carries no period. Bendl × *Energie - stavební a báňská a.s.* is a registry relation that **ended 23. 2. 2001**; Šťastný left Pražské služby' dozorčí rada in **January 2012**. Neither may render as a present holding. |
| F2 | MAJOR | `verdict-67.json` · `unstatedEffects[2].whoBenefits` | Renders under `komu prospívá:` — must not name IMOBA / Hartenberg as beneficiaries of an effect the verdict says it has not signed. |
| F3 | MAJOR | `verdict-221.json` · `researchedContext` | `RUŠÍ` → `ROZŠIŘUJE`; as written the sentence inverts its own quoted DZ and the rest of the file. |
| F4 | MAJOR | `verdict-221.json` · `unstatedEffects[1]`, `conflictAssessment` | The `skutečný majitel` premise is asserted, not checked; a board seat is not beneficial ownership. Verify or hedge. |
| F5 | MAJOR | `verdict-189.json` · `citations[2].claim` | Its "seven" is a different and internally false list; the EET tax credit is not a change unrelated to EET. Align with `unstatedEffects[0]`. |
| F6 | MAJOR | `payloads/verdicts-011/batch-011-verdicts-combined.json` × `gate-verdicts-011.ts` | The gate exits **1** on the shipped payload. Move the combined artifact out of the gated directory (content verified identical to the 12 files — no re-persist needed). |
| F7 | MINOR | `verdict-67.json` · `confidence` | 4 is defensible; 3 is the safer call while a channel is held open with an undetermined sign. |

Residual MINORs, non-blocking: verdict-64's `durvodové` ×2 and its `whoBenefits` naming a harmed party;
verdict-221's `netranspoinovala`, its two-companies-one-URN citation, its hlidacstatu citation not carrying
the místostarosta fact, and its `§ 4b/§ 11a` attribution; verdict-103's *"tíha"* and its search-URL source;
verdict-213's carried-forward § 339/§ 340 range; the self-affirming closing formula in verdict-7 and
verdict-77.

---

## P1 closure check (post-fix)

**Auditor:** same independent P1 auditor, same session, 2026-08-04, after the driver's remediation and
re-persist (pass 44; six changed verdicts 64, 67, 103, 189, 213, 221; combined payload
`payloads/batch-012-p1-corrected-verdicts.json`).
**Method:** every fix re-checked against the CURRENT file text and, where it asserts a fact, against the
primary source or the live URL — not against the driver's account of the fix. Two URLs re-fetched, both
sentencing ranges re-grepped from the cached text, the gate re-run, the combined payload diffed against
the twelve files, and all nine original closures re-tested for regression.
**No verdict or close-read file was modified. No git command was run. No PGlite database was opened.**

### CLOSURE VERDICT: **CLOSED WITH NOTES**

All seven of my findings (F1–F7) and every residual MINOR I listed are fixed in the current files, and I
could not break any of them. The nine first-audit closures all survive intact — I re-tested each one, so
the remediation did not buy F-fixes by regressing M-fixes. The combined payload contains exactly the six
changed verdicts and all six are byte-identical to the files on disk, so pass 44 persisted what I audited.
The gate exits 0 at 12/12 with a hardened filter.

**One new MINOR defect was introduced by the fixes** (N1 below) — a misplaced parenthesis that splits a
statutory reference. It is a text-position fix with no factual impact, but it sits in a `medium` verdict's
`conflictAssessment` and should be corrected before promotion. Nothing BLOCKING or MAJOR remains open.

### Finding-by-finding

| # | Status | What I checked in the CURRENT file |
|---|---|---|
| **F1** | **CLOSED** | **verdict-103** now reads *"částka je úhrn smluv firmy z registru smluv, nikoli údaj o aktuální držbě — podle obchodního rejstříku byl Bendl členem dozorčí rady pouze od 8. 11. 1996 do 23. 2. 2001 a žádný novější vztah rejstřík neeviduje; případový soubor u vazby časové období nenese"*, with a new `citations[7]` pointing at the podnikatel.cz permalink. The dates match what I independently derived. The added disambiguation of *what the 20,79 mld actually is* goes beyond what I asked and is the more important half of the fix — it removes the "Bendl holds 20,79 bn" reading outright. **verdict-67** meets the bar by its second route: *"částka je úhrn smluv firmy z registru smluv, nikoli údaj o aktuální roli; … případový soubor u vazby časové období nenese a **jako aktuální se vztah ověřit nepodařilo**"*, plus *"(bez ohledu na její trvání)"* on the institutional classification. That is literally F1's alternative wording. **I verified the new citation myself**: `https://www.hlidacstatu.cz/osoba/Funkce/boris-stastny` does read *"(od 2010) - Pražské služby, a.s."* with **no end date** — `citations[12]` is accurate. See N2 for the stronger fact that is available. |
| **F2** | **CLOSED** | `verdict-67.unstatedEffects[2].whoBenefits` now opens *"**Nelze jednoznačně určit** — dotčeni jsou vlastníci a nabyvatelé pozemků…"* and closes *"…jako druhý, nekvantifikovaný a **znaménkem neurčený** kanál … — **nikoli jako zjištěné zvýhodnění**."* Rendered behind `komu prospívá:` (`BillDetail.tsx:463-465`) the first words a reader now sees are the disclaimer, not the two company names. Correct fix. |
| **F3** | **CLOSED** | `RUŠÍ` → **`ROZŠIŘUJE`**. The sentence now agrees with its own quoted DZ (`271529.txt:604-605`), with `unstatedEffects[1]`, with `conflictAssessment` and with the operative § 4c odst. 2. |
| **F4** | **CLOSED** | `unstatedEffects[1].effect` now states it outright: *"případový soubor batche u těchto vazeb žádný údaj o skutečném majiteli nenese, **členství ve statutárním či dozorčím orgánu skutečným majitelstvím není** a tento verdikt status skutečného majitele neověřoval. Zda tedy … do nově zavedeného okruhu spadají, **zůstává neověřeno**"*, `whoBenefits` carries *"(podmíněno neověřeným statusem skutečného majitele)"*, and `conflictAssessment` softened *"tak nově spadají"* → *"tak **mohou** nově spadat"*. The board-seat/beneficial-ownership distinction is stated in the verdict's own words. |
| **F5** | **CLOSED** | `verdict-189.citations[2].claim` now enumerates the **same seven** as `unstatedEffects[0]` (child-placement credit, student credit, benefit-cap repeal, tipping exemption, 21→12 % VAT, § 46 nedobytné pohledávky, social-services exemption), uses the same *"nejméně sedm"* hedge, and adds *"samotná daňová úleva na evidenci tržeb mezi ně nepatří — je kompenzací přímo spojenou se zavedením EET"* — which is what the cached text says (`270143.txt:3227-3234`). |
| **F6** | **CLOSED** | Re-ran the gate: **`GATE: 12/12 batch-011 verdicts pass.`, exit code 0**. Filter hardened to `/^verdict-\d+\.json$/` with a comment recording why. `verdicts-011/` now holds exactly the twelve `verdict-*.json` and nothing else; the combined artifact lives at `payloads/batch-012-p1-corrected-verdicts.json`. |
| **F7** | **CLOSED** | `verdict-67.confidence` = **3** (severity unchanged at `medium`, correctly — the finding stands, only its certainty was over-stated). |
| **213** | **CLOSED — and I re-verified both ranges myself, not the claim about them** | `researchedContext` and `citations[2]` now split them: § 339 → 3–12, § 340 → 3–10. Grep-verified in `tisk-213/271314.txt`: § 339's new odst. 3 *"Odnětím svobody na **tři léta až dvanáct let**"* at line **1555**; § 340's new odst. 4 *"Odnětím svobody na **tři léta až deset let**"* at line **1588**. I also checked the part the fix could have got wrong: `citations[2]`'s *"mimo jiné za stavu ohrožení státu nebo za válečného stavu"* is applied to **both** provisions, and both new qualified offences genuinely carry that condition — § 339 odst. 3 písm. c) at line **1560**, § 340 odst. 4 písm. c) at line **1594**. |
| **64 minors** | **CLOSED** | `durvodov` now appears **0** times (7 correct `důvodov`). `unstatedEffects[0].whoBenefits` now names an actual beneficiary — *"Ve výhodě je předkladatel, jehož věcně nejtěžší změny takto procházejí pod souhrnným technickým rámováním"* — resolving the category slip, and the garbled *"než zbylých 149 dohromady v poměru k jejich individuální délce"* is now clean. |
| **221 minors** | **CLOSED** | `netranspoinovala` → correct spelling (**0** occurrences of the typo). The bundled citation is split into three, each on its own URN: `citations[3]` KORID LK `27267351`, `citations[4]` AGROCENTRUM JIZERAN `60914351`, `citations[5]` MAE invest `29186315`. `citations[10]` narrowed to *"od roku 2015 zastupitelem města Semily"* — dropping the místostarosta-2022 claim the cited page does not carry (the claim was true, but the citation now matches its scope, which is the right correction). The § 4b/§ 11a attribution is fixed: *"(na ně míří dosavadní § 4b a navazující § 11a přes § 2 odst. 1 písm. c) …): nový § 4c odst. 2 a nový § 48 odst. 9 … rozšiřují obdobný režim i na členy zastupitelstev ÚSC"*. |
| **103 minor** | **CLOSED** | *"jeho jednotlivě nejvyšší **tíha**"* → *"jeho jednotlivě nejvyšší **peněžní vazba**"*. (Arithmetic still right: 20,79 mld > Povodí Vltavy 11,90 mld.) |

### New defects introduced by the fixes

**N1 — MINOR · `verdict-221.json` · `conflictAssessment` — the F4 parenthetical was inserted *inside* a
statutory reference and splits it.**

Current text, verbatim: *"…tak mohou nově spadat do okruhu dotčeného **§ 4c odst. (Podmínkou je status
„skutečného majitele“, který případový soubor nenese a tento verdikt jej neověřoval.) 2** a § 48 odst. 9,
pokud by žádaly…"*

The qualifier landed between `odst.` and `2`, so the operative provision renders as `§ 4c odst. (…) 2`.
How I checked: swept every `odst.` occurrence in all twelve files; this is the **only** broken statutory
reference in the batch — every other one in verdicts 14, 67, 77, 189, 201 and 221 is well-formed. It
introduces **no false claim** and the reference is recoverable, which is why it is MINOR and not MAJOR;
but the qualifier belongs after `§ 48 odst. 9` (or as its own sentence), and precision in statutory
references is the one thing this product's gate exists to protect. One-line fix.

**N2 — MINOR · `verdict-67.json` · `conflictAssessment` / `citations[12]` — the Šťastný branch states the
weaker fact, and the stronger dated one is retrievable from this environment.**

The fix satisfies F1 and asserts nothing false. Two notes for the record:

1. The January-2012 article **is fetchable here** — I retrieved it twice this session, most recently after
   the fix: `https://zpravy.aktualne.cz/regiony/praha/zmeny-v-prazskych-sluzbach-dozorci-radu-opusti-stastny/…`,
   dated **12. 1. 2012**, headline *"Bývalý předseda pražské ODS Boris Šťastný končí v dozorčí radě
   Pražských služeb."* So the Šťastný branch could carry a dated end the way verdict-103's now does,
   rather than an open interval.
2. More importantly, *"od roku 2010 bez uvedení konce"* is **exactly** the open-ended-registry artefact
   this repo has already named and paid for: the `stale-ongoing-in-graph` flag class, which
   `CLAUDE.md` records as covering **42 of 211** ties — a start with no end that reads as ongoing and is
   not. Citing it without saying so re-imports the pattern the money surfaces flag on sight. The verdict's
   *"jako aktuální se vztah ověřit nepodařilo"* does neutralise the inference for an attentive reader,
   which is why this is MINOR — but naming the record as open-ended-and-therefore-unreliable would cost
   one clause.

### Still open, unchanged, non-blocking

- `verdict-103.citations[4]` remains an **or.justice.cz search URL** rather than an entity permalink. Much
  less load-bearing now that `citations[7]` carries a permalink for the registry facts.
- `verdict-221.citations[2]` (zakonyprolidi.cz) still returns **403** to fetch; the proposition is
  independently confirmed by the bill's own text, as the first audit established.
- The self-affirming closing formula survives in **verdict-7** and **verdict-77** — never in scope for
  either remediation, and in both cases resting on work that names the provisions actually checked.

### Notes on process

- **The Czech-gate incident is correct behaviour, not a defect.** A first draft of the new Šťastný citation
  led with *"Evidence…"* and failed `requireCzech`; it now reads *"Přehled veřejných funkcí…"*. This is the
  documented stopword-homograph false positive (`lib/analysis/language-gate.ts` calls 14 of 211 genuinely
  Czech reviewer notes English precisely because registry Czech is full of homographs like *evidence*,
  *OR*, *ARES VR*). The repo's own rule is that the gate binds **the copy we write** and not the evidence we
  show — this citation `claim` is copy we write, so the gate was right to bind it and the rewrite is the
  right response.
- **Persist integrity verified.** `batch-012-p1-corrected-verdicts.json` holds exactly the six changed
  verdicts {64, 67, 103, 189, 213, 221}, and each is byte-identical to its file after canonical JSON
  serialisation — so pass 44 wrote the text audited above.
- **No regression on the nine first-audit closures.** Re-tested each in the current files: verdict-67 still
  carries *"14 sektorových vazeb (nikoli 12)"*, all four disjoint lead groups (139/2002 · 100/2001 ·
  235/2004 · 258/2000), the SynBiol disposal, the M2 retraction and the Pražské služby disposal;
  verdict-103 still declines to assert `tie_class` and still books VaK Karlovy Vary under Bureš;
  verdict-64 still labels the census note a non-finding; verdict-189 still hedges *"nejméně sedmice"*.
