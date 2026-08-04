# batch-012 — independent pre-persist audit

**Auditor:** fresh, no prior involvement in batch-012 authorship. Every claim below was
re-derived from the primary artefacts in this repo: the ten verdict files, the two close-read
payloads, `payloads/batch-012-targets.json`, and the NFC-normalized cached bill texts under
`.data/law-collision-cache/tisk-<n>/*.txt`. No verdict or close-read file was edited; no git
operation and no PGlite read was performed.

Grep method used throughout (mixed Unicode normalization inside single documents makes a raw
`rg` unreliable):

```bash
# scratchpad/audit_grep.py — reads utf-8, unicodedata.normalize("NFC", …), regex per line
PYTHONIOENCODING=utf-8 python audit_grep.py <cached.txt> "<pattern>" <context> <max>
```

---

## VERDICT: **NOT READY**

Three BLOCKING defects, eleven MAJOR, twelve MINOR. Two of the three BLOCKING items sit in the
two MEDIUM verdicts — i.e. in the two findings the batch asks the public to take most seriously.
The batch-011 failure class (money-touching prose, unlabelled gate state, over-smooth negative
findings) recurs: it is **narrower** than in batch-011 (no present-tense registry role, no
beneficiary of an unsigned effect, no tie-class assertion) but **not closed**.

Positive findings are recorded in §6 — several central claims, including the one data-quality
claim about our own platform (tisk 250), are exactly right and survived independent re-derivation.

---

## 1. Priority 1 — the two MEDIUM verdicts

### 1.1 BLOCKING · verdict-69 · `unstatedEffects[0].effect` — the "unstated" premise is false

The effect reads: the act concentrates DSA / P2B / DGA supervision in ČTÚ *"aniž by důvodová
zpráva tuto koncentraci pravomocí u jednoho úřadu pojmenovala jako samostatný záměr nad rámec
pouhého plnění transpoziční povinnosti."*

The důvodová zpráva names it, analyses it and justifies it, in one continuous passage:

```
.data/law-collision-cache/tisk-69/266214.txt, lines 2966–2977
2966: ČTÚ je navrhován jako příslušný orgán, který odpovídá za dozor a vymáhání nařízení o správě dat a nařízení
2967: o digitálních službách, protože z analyzovaných variant má k regulované problematice nejblíže, a potřebné
2968: rozšíření jeho kompetencí by tak znamenalo nejnižší náklady pro státní rozpočet. Většina ostatních členských
2969: států určila nebo plánuje určit jako koordinátora digitálních služeb orgán regulující oblast telekomunikací
…
2972: … Návrh ČTÚ je rovněž v souladu s usnesením vlády České republiky č. 590 ze dne
2973: 16. srpna 2023 k nelegislativnímu materiálu „Informace o řešení koncepčního institucionálního zakotvení
2974: digitální legislativy EU“…
2976: … (Analýza ke zvolení ČTÚ jako příslušného orgánu pro nařízení DGA a DSA a ÚOOÚ jako
2977: dalšího příslušného orgánu pro nařízení DSA je uvedena v Závěrečné zprávě z hodnocení dopadů regulace.)
```

Compounding it: the P2B leg is not a new concentration at all. The same DZ states the designation
already exists in law —

```
lines 2721–2725: … Do českého právního řádu je implementováno zákonem č. 58/2023 Sb., kterým se mění ZSIS.
                 … Dozorovým orgánem ve smyslu nařízení P2B byl určen Český telekomunikační úřad …
```

— so `§ 26` of tisk 69 re-enacts an existing allocation into the new act. The verdict presents
three concurrent grants where the text supports two new ones plus one recodification.

*What survives:* the mechanism itself is real and correctly cited. `§ 23`–`§ 24` (L605–L618) and
`§ 26` (L633–L639) designate "Úřad", and "Úřad" is defined as Český telekomunikační úřad at
L386. The `§ 40`–`§ 41` blocking mechanism is real and correctly described, including the ISP
duty (`§ 41 odst. 4`, L974–L977) and the machine-readable list (L955–L958). The 6 % turnover cap
is real and repeatedly enacted (L1282, L1353, L1387, L1461, L1518, L1611…). **The finding is
sound; its "unstated" framing is not.** As written, `unstatedEffects[0]` cannot be published.

*Fix shape:* restate the effect as what the evidence supports — a concentration the DZ justifies
on cost and precedent grounds, whose *institutional-independence* dimension the DZ does not
discuss — or drop it and let `unstatedEffects[1]` (the blocking mechanism, which is genuinely
under-signalled by the bill's own framing as "určení příslušných orgánů") carry the medium.

**Is medium justified?** Yes, on `unstatedEffects[1]` alone: a statutory ISP website-blocking
duty is a materially larger effect than the bill's self-description. Confidence 3 is right.
Hedges in `conflictAssessment` are intact ("Nelze jednoznačně určit", "souhrnem veřejných smluv
… nikoli osobním příjmem poslance", "v datech tedy není doložen"). All statutes named are real.

### 1.2 BLOCKING · verdict-10 · wrong paragraph for the Article-22 merger power

`unstatedEffects[1].evidence` and `citations[1].claim` both say **"§ 6 tisku 10 ukládá účastníkovi
spojení na mediálním trhu oznámit RRTV záměr…"**. In the cached text `§ 6` is *"Postup Rady ve
vztahu k mediálním službám pocházejícím ze států, které nejsou členskými státy…"* (L99–L114).
The merger-review provision is **§ 7**:

```
.data/law-collision-cache/tisk-10/265040.txt
118: §7
120: Posouzení spojování na mediálním trhu
128:    (3) Účastník spojení na mediálním trhu…, který není mikropodnikem, je povinen oznámit
129: Radě své spojení… před podáním návrhu na zápis spojení… do obchodního rejstříku…
133:    (4) Rada posoudí dopad oznámeného spojení… podle kritérií uvedených v čl. 22 odst. 2
```

A wrong statutory address in the citation of a MEDIUM verdict on a public accountability page is
not a typo class — it is the one thing the ARMY-CONTRACT's citation rule exists to prevent. Two
fields carry it.

*Everything else in this verdict's core is correct and stronger than the verdict claims.* The
ministry-vs-regulator finding is verbatim supported:

```
tisk-10/265040.txt, lines 1734–1738 (důvodová zpráva)
1734: V českém právním řádu je nutné upravit, který orgán povede tuto povinnou evidenci (databázi)
1736: vlastnictví médií… Vzhledem k tomu, že se má jednat o evidenci všech mediálních služeb, jeví se
1737: jako vhodné, aby ji vedlo Ministerstvo kultury, a nikoli např. Rada pro rozhlasové a televizní
1738: vysílání, jejíž působnost se týká pouze audiovizuálních služeb.
```

and the enacting text confirms it (`§ 5 odst. 1`, L86–L89: *"Ministerstvo kultury … vede evidenci
vlastnictví médií"*). The verdict's characterisation — the choice is justified only by subject-matter
scope, never by independence of media oversight — is **exactly what the DZ says**. The
"zájmy, vazby nebo činnosti … v jiných odvětvích" criterion is likewise in the DZ verbatim
(L1901–L1906). Medium is justified; confidence 3 is right; all four statutes named are real.

### 1.3 MINOR · verdict-10 · `citations[2]` attributes source protection to the wrong provision

*"Tisk 10 v § 3 posiluje ochranu novinářských zdrojů … před sledováním a domovními prohlídkami"*.
`§ 3` (L37–L60) grants a right to **refuse to provide information or hand over a thing**. The
safeguards against *sledování* and searches are in **`§ 12` of the bill**, which inserts a new
`§ 12a` into the trestní řád — including the four-month cap on `sledování osob a věcí` at
`§ 12a odst. 4` (L361–L364). `researchedContext` compounds it: *"v § 3 a navazujících
ustanoveních trestního řádu"* — `§ 3` is not in the trestní řád.

### 1.4 MINOR · verdict-10 · register contents sourced from the Regulation, cited as bill text

`researchedContext` describes the register as containing *"údaje o vlastnících, skutečných
majitelích a příjmech z veřejné i zahraniční reklamy"*. `§ 5 odst. 1` says only *"údaje podle
čl. 6 odst. 1 Evropského aktu o svobodě médií"*. The itemisation comes from EMFA Art. 6(1), which
was not fetched. Separately, the state-advertising **database** (`§ 8 odst. 3`, L184–L189) is the
**RRTV's**, not the ministry's — the sentence risks reading as if the ministry holds both.

---

## 2. Priority 2 — four of the eight low verdicts

### 2.1 tisk 65 — VERIFIED, with an internal count contradiction

**Verified.** The expanded private-law data categories are exactly as claimed
(`tisk-65/266164.txt`): bod 9 adds *rodné příjmení* (L117), bod 10 adds *pohlaví* (L119–L121),
bod 12 adds *"i) rodinný stav nebo registrované partnerství"* and *"j) omezení svéprávnosti"*
(L127–L132). The SSVÚ group-sharing provision is bod 8, new `§ 38ae odst. 3` (L110–L115). The
`§ 18a odst. 4` delegation is čl. III (L186–L190) and the verdict's **verbatim quote is exact**:

```
tisk-65/266164.txt, lines 2205–2207
2205: … Zákon úmyslně neřeší případný vztah státního
2206: orgánu či právnické osoby k Ministerstvu vnitra ani formu delegačního aktu, aby byla
2209: umožněna co největší variabilita řešení.
```

**MAJOR (M3).** `researchedContext` says *"všech **pět** dalších novelizovaných předpisů"* and
then lists **eight**. The bill actually amends **eleven** (eleven `Změna zákona` parts at
L14/L42/L183/L194/L342/L562/L798/L877/L898/L965/L1047; `amendsCount: 11` in the targets file).
The sentence is self-contradictory in prose the site renders.

**MAJOR (M11).** `conflictAssessment` says *"předkladatelem je ministerstvo, nikoli poslanec
s vlastní peněžní vazbou na dotčený sektor. Uvedený **spolupředkladatel** Marian Jurečka…"*.
The targets file gives `submitter: "min. práce a soc. věcí"` and the sole sponsor as Jurečka —
who **is** the MPSV minister. The sentence separates two roles held by one person and, in doing
so, states the opposite of the situation: the submitting ministry's own head is the MP carrying
the money tie. The conclusion (no sectoral overlap with AGRO 2000) still holds; the reasoning
that reaches it does not.

**MINOR.** `unstatedEffects[1]` is presented as unstated but its own evidence is the DZ's explicit
passage (L1160–L1167 *"…zůstal opomenut aspekt výslovné možnosti sdílení SSVÚ … v rámci jedné
propojené finanční skupiny"*; L1254–L1263). Same structural issue as §1.1 — the batch is using
`unstatedEffects` for effects understated in the *bill's short framing*, not effects absent from
the DZ, and does not say so.

**Good:** the CZK figure (253 958 310 Kč) carries both required qualifiers — *"jde o souhrn
veřejných zakázek firmy, nikoli o osobní majetek jmenované osoby"* and *"vazba je v grafu vedena
jako čekající na kontrolu"*. This is the correct pattern; see M2 for the verdict that omits it.

### 2.2 tisk 172 — VERIFIED in full

Every central claim re-derived from `tisk-172/269548.txt`:

- `§ 27` suspension: L324–L329 (*"Platnost cestovního pasu se pozastavuje po dobu trvání zápisu
  evropského zatýkacího rozkazu…"*).
- Police as editor of the entry: L2689–L2691 (*"Zápis a výmaz údaje … provede Policie České
  republiky."*).
- The DZ's own admission, quoted almost verbatim by the verdict: L3036–L3039 (*"Držitel
  cestovního pasu, jehož platnost byla pozastavena, se o této skutečnosti nemusí dozvědět,
  z tohoto důvodu se skutková podstata přestupku upravuje tak, aby tento případ nezahrnovala."*).
- Biometric reuse: bod 35, `§ 21a odst. 3` (L234–L238); DZ K bodu 35 at L2527–L2531.

Hedging is correct; `whoBenefits` names no beneficiary. **MINOR only:** both
`unstatedEffects[].evidence` strings are prose descriptions rather than source strings appearing
in `citations` (ARMY-CONTRACT gate rule); the substance is separately cited, and
`lib/analysis/law-verdict.ts:139–146` does not enforce the linkage.

### 2.3 tisk 250 — the data-quality count is EXACTLY RIGHT

This is the claim the brief said must be exactly right. I counted the novelizační parts myself
from `tisk-250/277952.txt`:

| ČÁST | § | law |
|---|---|---|
| DRUHÁ | 49 | 2/1969 (kompetenční) |
| TŘETÍ | 50 | 64/1986 (ČOI) |
| ČTVRTÁ | 51 | **505/1990 (metrologie)** |
| PÁTÁ | 52 | **539/1992 (puncovní)** |
| ŠESTÁ | 54 | 20/1993 |
| SEDMÁ | 55 | 22/1997 |
| OSMÁ | 56 | 634/2004 |
| DEVÁTÁ | 57 | 87/2023 (L1639) |
| DESÁTÁ | 58 | **387/2024 (L1669)** |
| JEDENÁCTÁ | 59 | **330/2025 (L1694)** |

ČÁST DVANÁCTÁ is `ZRUŠOVACÍ USTANOVENÍ`, ČÁST TŘINÁCTÁ is `ÚČINNOST`. `§ 53` is a transitional
provision inside ČÁST PÁTÁ (L1440–L1466), not a twelfth part. **Ten laws, confirmed.** The
targets file carries six `amends` refs (`2/1969, 20/1993, 22/1997, 634/2004, 64/1986, 87/2023`),
so the four the verdict names as missing — 505/1990, 539/1992, 387/2024, 330/2025 — are **exactly
the four missing**. Claim verified; all four statute numbers are real and appear in the text.

**BLOCKING (B3).** `unstatedEffects[1]` does not survive. It reads: the Rada is *"dozorového
orgánu Agentury"*, part-appointed on the nomination of industry legal persons, *"přičemž tatáž
Agentura následně stanovuje ceník za placený přístup k normám a databázi (§ 21 odst. 2)"*.

```
tisk-250/277952.txt
208:  (1) Rada je orgánem Agentury, který zajišťuje její nezávislost a nestrannost. …
212:  (2) Rada má 5 členů, jejím předsedou je předseda Úřadu. Další členy Rady jmenuje
213: předseda Úřadu, z toho jednoho na návrh ministerstva a ostatní na návrh právnických osob,
214: jejichž činnost souvisí s oblastí normalizace. …
222:  § 12 (1) Dozorčí rada je orgánem Agentury, který dohlíží na její hospodaření. …
371:  (2) Příjmem z vedlejší činnosti podle § 8 odst. 2 písm. a) až c) jsou přijaté úplaty … za cenu,
372: jejíž výše je stanovena v ceníku Agentury. Ceník Agentura vydává po předchozím projednání
373: Dozorčí radou a souhlasu Úřadu a uveřejňuje ho na svých internetových stránkách.
```

Three errors, all pushing the same direction: (a) the **Rada is not the supervisory organ** — `§ 11`
makes it the independence organ and `§ 12` creates the Dozorčí rada; (b) the Agency does **not**
set the price list alone — it requires prior discussion by the Dozorčí rada **and the Úřad's
consent**, both omitted; (c) `§ 21 odst. 2` covers only the *vedlejší činnost* price list, while
the *poplatek za sponzorovaný přístup* is a statutory fee whose budget is treated as a public
budget (`§ 20 odst. 4`, L355–L356). And the whole effect is **uncited** — none of the eight
citations covers `§ 11 odst. 2` or `§ 21 odst. 2`, contrary to the contract's "No uncited
accusation". This is an insinuation of regulatory capture, resting on a misdescription of the
text, on a page that names two sitting MPs. It must not persist as written.

**MINOR.** *"Přibližně 40 % věcného záběru tohoto tisku není zachyceno"* — 4/10 is a count of
statutes, not of substance; the sentence should say which.

### 2.4 tisk 56 — VERIFIED, with an internal contradiction

**Verified.** `tisk-56/266014.txt`: bod 12 inserts `§ 17a odst. 5` — *"Za přestupek podle
odstavce 3 lze uložit pokutu až do výše 10 000 000 Kč nebo do výše 5 % z čistého obratu pachatele
přestupku…"* (L120–L124). The offence it punishes is bod 10's new `§ 17a odst. 3`, addressed to
*"Provozovatel sítě nebo subjekt veřejného sektoru podle nařízení…"* (L85–L86). Bod 15 (L134) is
*"Za § 17c se vkládá nový § 17d"* — quoted correctly.

**MAJOR (M5).** `researchedContext` says of `§ 17d`: *"Nové ustanovení rozděluje projednávání
přestupků … a **stanoví pokutu až do výše 10 000 000 Kč nebo 5 % čistého obratu**."* It does not.
`§ 17d` (L135–L147) allocates jurisdiction only — inspektorát, Zeměměřický úřad, Ministerstvo
obrany, ČTÚ, plus collection of ČTÚ fines. The fine lives in `§ 17a odst. 5`. The verdict's own
`citations[1]` gets this right, so the payload asserts both.

**MAJOR (M7).** `conflictAssessment`: *"Absence dokladu o střetu zájmů je zde věcným zjištěním,
nikoli mezerou v datech — **pole peněžních vazeb předkladatele je úplné** a žádnou takovou vazbu
neobsahuje."* Nothing in the batch establishes that the graph's money-tie coverage for an MP is
complete; every one of the graph's 211 `linked_to` ties is `pending_review`. An "absence of
evidence is evidence of absence" claim needs a coverage statement it does not have. Milder
versions of the same over-smoothing: verdict-54 and verdict-250 (*"Jde o odůvodněný negativní
nález"*), verdict-100 (*"čestný nález negativního výsledku, nikoli … mezera v dostupných
datech"*).

---

## 3. Priority 3 — the money / temporal sweep across all ten verdicts

Sweep performed over every verdict file (CZK regex, `whoBenefits` prefix test, tie-class scan,
present-tense role scan), then each hit re-checked by hand against `batch-012-targets.json`.

**Clean across the batch (batch-011's exact failures did NOT recur):**

- **No beneficiary of an unsigned effect.** All 17 `whoBenefits` fields lead with *"Nelze
  jednoznačně určit"*. Verified programmatically over all ten files.
- **No present-tense registry or board role.** No verdict asserts ownership, a board seat or a
  statutory-body role for any MP. The only present-tense roles are public offices taken from the
  targets `submitter` field.
- **No tie-class assertion.** The targets file carries no class for any tie (`moneyTies` holds
  only `ico / name / urn / contractCzk`), and no verdict asserts one — no "vlastní nebo řídí",
  no owner/steward split. Correct, given the payload the analysts had.
- **Ground-truth checks requested:** Jurečka × AGRO 2000 s.r.o. (IČO 25586521, 253 958 310 Kč) is
  his **only** tie in the targets file — verdicts 65 and 54 are right to treat it as such. Vlček's
  tie list is six entries: SOMPO a.s. (25172263, 9 174 258), PEVAK Pelhřimov družstvo (26039907,
  1 234 888), W.H.V. Projekt (26109859, 0), Via rustica z.s. (26982170, 2 008 259), PRO VYSOČINU
  (27043843, 0), SVJ Nádražní 767 Pacov (28095405, 0). Every `company:ico:` urn cited by a verdict
  appears in that MP's own tie list.

**MAJOR (M2) · verdict-54 — a CZK figure against a named MP with no gate label.**
`conflictAssessment` and `citations[5]` both render *253 958 310 Kč* for Jurečka × AGRO 2000 with
the aggregate disclaimer (*"souhrn veřejných zakázek této společnosti, nikoli osobní majetek
jmenovaného"*) but **without** the `pending_review` state. verdict-65, in the same batch, on the
same MP, the same company and the same figure, does carry it (*"vazba je v grafu vedena jako
čekající na kontrolu"*). Two surfaces of one batch state a different confidence in the same fact.

**MAJOR (M6) · verdict-69 — the largest money tie is dropped from its own enumeration.**
`conflictAssessment` enumerates Vlček's ties as *"vodárenskému družstvu, projekční firmě, dvěma
občanským spolkům a společenství vlastníků jednotek"* — five entities. The targets file gives
six. The omitted one is **SOMPO, a.s.** (IČO 25172263), his **largest** at 9 174 258 Kč, and the
only joint-stock company among them, i.e. the only one none of the five labels covers. verdict-56
repeats the same five-item list by reference (*"se stejnými evidovanými peněžními vazbami jako
u tisku 69"*), so the omission propagates. The conclusion (no digital/telecom sector overlap) is
almost certainly unaffected — SOMPO is regional waste management — but a conflict assessment that
silently drops the biggest number in its own evidence set cannot be published as complete.

**MINOR · verdicts 69, 10, 56 name MP↔company ties without stating the gate state.** No CZK figure
is rendered in any of the three, which is why this is MINOR rather than MAJOR, but all 211 ties in
the graph are `pending_review` and the prose (*"evidované peněžní vazby"*) does not say so.

**MINOR · role/person conflation on government bills.** verdict-10 (*"Předkladatelem je ministr
kultury a jediným poslaneckým sponzorem … je Martin Baxa"*) and verdict-13 (*"Předkladatelem je
ministr financí a jediným poslaneckým sponzorem … Zbyněk Stanjura"*) present as two parties what
is one person — Baxa signs tisk 10 as ministr kultury (`tisk-10/265040.txt` L2236–L2237). The
severe form of this is M11 in verdict-65.

**MINOR · verdict-10 omits one tie from its enumeration** (*Sdružení měst a obcí Plzeňského kraje*,
IČO 69972061); the nine ties are otherwise fairly characterised and the largest, Plzeňské městské
dopravní podniky at 13,4 mld Kč, is deliberately not rendered as a number — correct.

---

## 4. Priority 4 — four close-reads re-derived

### 4.1 `14-207-40-2009` (confirmed-collision) — VERIFIED IN FULL

Both quoted spans occur verbatim in the named bill.

- tisk 14, bods 1–2: `tisk-14/265109.txt` L1888 (*"V nadpisu § 298a se doplňují slova „a
  fluorovanými skleníkovými plyny""*) and L1890–L1892.
- tisk 207 relocates the ozone content to `§ 298b`: bod 29 replaces `§ 298 a 298a`
  (`tisk-207/271152.txt` L321), bod 30 inserts `§ 298b až 298j` (L389), and the new `§ 298a` is
  *"Neoprávněné nakládání s odpady z nedbalosti"* — a different subject.
- **Its own DZ admits it, verbatim as quoted:**

```
tisk-207/271152.txt, lines 2012–2015
2012: S ohledem na předřazení jiných nově zaváděných trestných činů bylo zapotřebí dnešní § 298a
2013: tr. zák. přeznačit na § 298b tr. zák. a jeho nedbalostní formu … na § 298c tr. zák.
```

- The close-read's further claim that tisk 207's platné-znění annex knows about tisk 14 is also
  exact: `tisk-207/271154.txt` L3–L5 (*"Změna trestního zákoníku (ve znění sněmovního tisku 14)"*)
  and L550–L554 (*"§ 298a / znění dle tisku 14 s účinností od 1. 7. 2026 / … a fluorovanými
  skleníkovými plyny"*).

Classification `confirmed-collision` holds. No defect.

### 4.2 `40-64-586-1992` (confirmed-collision) — evidence VERIFIED, one inference unshown

The load-bearing textual claim is exact. tisk 40 targets current `§ 25 odst. 1 písm. t)` =
*výdaje na reprezentaci* (`tisk-40/265587.txt` L42–L47), and its own platné-znění annex confirms
the baseline at the lines the close-read cites:

```
tisk-40/265589.txt
 90: t) výdaje na reprezentaci, kterými jsou zejména výdaje na pohoštění, občerstvení a dar; …
131: za) nájemné za umělecká díla a výdaje (náklady) za restaurování uměleckých děl, která nejsou součástí
132: staveb a budov, … s
133: výjimkou uvedenou v § 24 odst. 2 písm. zf),
```

tisk 64's cascade and bod 260 are verbatim as quoted (`tisk-64/266153.txt`): bod 245 L3052–L3053,
bod 252 L3073–L3074, bod 256 L3084–L3085, bod 259 L3092–L3093, bod 260 L3095. The deleted strings
*"a výdaje (náklady) za restaurování uměleckých děl"* and *", s výjimkou uvedenou v § 24 odst. 2
písm. zf)"* occur **only** in current `za)`, never in current `t)`. Two bills therefore use the
identical citation `§ 25 odst. 1 písm. t)` for two different provisions — the classification is
supported.

**MINOR.** The reasoning states as fact that after tisk 64's four renumbering waves the label
`t)` lands on the umělecká-díla clause. The payload does not compute that mapping, and my own
reconstruction of the letter inventory from `tisk-40/265589.txt` does not reproduce it (the
inventory contains `ch)`, omits `q)`, and does not balance against bod 245's own
`d) … zq)` → `a) … zm)` restatement — it is off by one whichever way I resolve it). The
classification does not need the arithmetic; the sentence should not assert it.

### 4.3 `16-53-634-1992` (confirmed-collision) — VERIFIED IN FULL

- tisk 16, bod 9: `tisk-16/265180.txt` L91–L105 — new `§ 24 odst. 17`, then *"Dosavadní odstavce
  17 až 24 se označují jako odstavce 18 až 25."* — verbatim.
- tisk 53, bod 29: `tisk-53/265983.txt` L200–L204 — new `§ 24 odst. 18` (záruční list per
  `§ 2174a odst. 1` OZ), then *"Dosavadní odstavce 18 až 25 se označují jako odstavce 19 až 26."*
  — verbatim.
- **The decisive claim — that tisk 53's platné-znění annex bakes in tisk 16 — is confirmed
  directly.** `tisk-53/265985.txt` L847–L855 already carries the *finished* text of tisk 16's new
  odstavec 17 (`§ 1843 odst. 1`, `§ 1844a`, `§ 1843a`, `§ 1845` offences), and the annex's dozor
  clause at L582–L584 already lists `1830a`, `1843a`, `1844a` — all tisk-16 insertions. tisk 53's
  bod 28 (*"V § 24 odst. 16 se na konci písmene r) doplňuje slovo „nebo""*, L199) presupposes
  písm. `r)`, which tisk 16's bod 8 creates (`tisk-16/265180.txt` L80).

Classification holds; the reasoning's side-note about `§ 23`/`§ 23b` being disjoint is consistent
with tisk 53 bods 18–19 (L170–L174). No defect.

### 4.4 `67-207-40-2009` (confirmed-collision, my choice) — VERIFIED IN FULL

- tisk 67 bod 1 (`tisk-67/266188.txt` L6901–L6904: *"V § 296 se doplňuje odstavec 4…"*) and bods
  3–7 (L6920–L6937, partial edits to `§ 299` odst. 1–4) — quoted correctly, including the
  *"dlouhodobě nebo nevratně poškodí místní populaci zvláště chráněného druhu…"* insertion.
- tisk 207 bod 27 (`tisk-207/271152.txt` L285: *"§ 296 a 297 včetně nadpisů znějí"*, new subject
  *Neoprávněné vypuštění znečišťujících látek z lodi*) and bod 31 (L616: *"§ 299 a 300 včetně
  nadpisů znějí"*) — quoted correctly.

Wholesale replacement against partial substitution into the replaced text. Classification holds.

### 4.5 Counts and coverage — consistent

| | confirmed | coordination-risk | incidental | pairs | coverage |
|---|---|---|---|---|---|
| gA | 5 | 2 | 1 | 8 | `pairsRead 8 / pairsAssigned 8` |
| gB | 3 | 4 | 1 | 8 | `pairsRead 8 / pairsAssigned 8` |
| **total** | **8** | **6** | **2** | **16** | — |

Each group's `classificationCounts` matches a direct tally of its own `pairs` array, and the
batch total matches the stated 16 close-reads (8 / 6 / 2). No defect.

---

## 5. Priority 5 — reflection, counts, and the G1 URL disclosure

### 5.1 Stated counts hold

- **10 verdicts, 2 medium / 8 low.** Files present: 10, 13, 16, 54, 56, 65, 69, 100, 172, 250.
  medium = {69, 10}; low = the other eight. Matches.
- **Gate.** `npx tsx scripts/case-loops/law/gate-verdicts-011.ts --batch=012` → **10/10 pass**.
  Note what that does *not* prove: `lib/analysis/law-verdict.ts:139–146` checks only that
  `unstatedEffects[i].{effect,whoBenefits,evidence}` are non-empty strings. The ARMY-CONTRACT rule
  that `evidence` must be a source string also present in `citations` is **not machine-enforced**,
  and three verdicts (172 ×2, 54 ×1, 250 ×1) deviate from it. For 172 and 54 the substance is
  cited elsewhere (MINOR); for **250 it is not** (part of B3).

### 5.2 Internal contradictions found

1. verdict-56 attributes the same fine to `§ 17d` (researchedContext) and `§ 17a odst. 5`
   (citations). (M5)
2. verdict-65 says "pět" and lists eight, of eleven. (M3)
3. verdict-54 omits the `pending_review` label that verdict-65 applies to the identical fact. (M2)
4. **Cross-verdict inconsistency in how a text/graph amends mismatch is treated.** verdict-250
   raises it to an `unstatedEffect` with four dedicated citations. verdict-69 has the same defect
   in the same batch and is silent about it — see M4 immediately below.

### 5.3 MAJOR (M4) · verdict-69 states the graph's amends count as the bill's own content

`statedReasoning`: *"a mění **šest** dalších předpisů (autorský zákon, trestní řád, zákon
o zvláštních řízeních soudních, zákon o ochraně spotřebitele, zákon o správních poplatcích
a občanský zákoník)"*. That list is `batch-012-targets.json` → `amendedLaws` for tisk 69, verbatim
and in the same order-of-content. The **enacting text amends seven**:

```
tisk-69/266214.txt  — ČÁST DRUHÁ (§68) trestní řád · TŘETÍ (§69) ochrana spotřebitele ·
ČTVRTÁ (§70) autorský zákon · PÁTÁ (§71) správní poplatky ·
ŠESTÁ (§72, L2199–L2211) zákon č. 132/2010 Sb., o audiovizuálních mediálních službách na vyžádání ·
SEDMÁ (§73) občanský zákoník · OSMÁ (§74) zákon o zvláštních řízeních soudních ·
DEVÁTÁ (§75) ÚČINNOST
```

`132/2010` is missing from the graph **and** from the verdict. Worse for our own data: the bill's
DZ describes **ten** parts including `181/2014` (L3073) that the enacting text does not contain —
so the census source and the enacted text disagree, and nobody in the batch noticed. The same
class of finding that earns tisk 250 an `unstatedEffect` passes silently in tisk 69.

### 5.4 The G1 URL disclosure — per-citation dependency assessment

G1 disclosed that it cited psp.cz URLs it did not fetch live, reading the cached renders of the
same documents instead. Assessed per citation across all ten verdicts:

**`bill_text` (the large majority) — no claim depends on unfetched live content.** The cached
`.txt` under `.data/law-collision-cache/tisk-<n>/` *is* the render of the document behind that
URL. Every substantive claim I re-derived above was found in the cache, including the three that
turned out to be **wrong** (verdict-10's `§ 6`, verdict-13's `§ 604`, verdict-56's `§ 17d`) —
which is the point: the cache would have caught all three. The disclosure is honest and, on the
evidence, materially harmless for this citation kind.

**MINOR (provenance precision).** Every `bill_text` source is
`https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=<n>&ct1=0` — the tisk **index** page. The quoted
spans come from the PDF/txt behind it (`266214.txt`, `265040.txt`, …). A reader following the
citation lands one hop from the quoted text. Not a fabrication; worth one sentence of accuracy.

**MAJOR (M8) — the three `web` citations are the real problem, and they are not bill text.**

| verdict | claim | targets `committeeRouting` |
|---|---|---|
| 65 | "garanční výbor VSR, stav navrženo k 2025-12-17" | `VSR / garancni / navrzeno / 2025-12-17` |
| 16 | "garanční výbor RV, stav přikázáno k 2026-03-24" | `RV / garancni / prikazano / 2026-03-24` |
| 100 | "garanční výbor VSR, stav navrženo k 2026-03-04" | `VSR / garancni / navrzeno / 2026-03-04` |

Each restates the targets file field-for-field and is declared `kind: "web"` against a
`historie.sqw` URL that was not fetched. No claim **depends** on live content — but the
provenance label is wrong in the direction that overstates it: a graph fact presented to the
reader as a fetched registry page. Under this repo's brand rule (every rendered number cites the
source it actually came from) these should be `graph_fact`, or the pages should be fetched.

**`law` citations.** All statute numbers named across the ten verdicts are real. verdict-250's four
"missing" refs (505/1990, 539/1992, 387/2024, 330/2025) were each located in the bill text at the
line numbers in §2.3. verdict-69's `89/2012` / `121/2000` and verdict-10's `231/2001` / `46/2000`
are correct.

**One genuine live dependency, MINOR:** verdict-10's description of the register's *contents* and
of the Art. 22(2) criteria comes from Regulation (EU) 2024/1083 itself, not from the bill. The
merger criteria happen to be paraphrased in the bill's DZ (L1901–L1906), so that half is covered;
the register-contents itemisation is not, and is cited as `bill_text`. See §1.4.

### 5.5 Over-smooth claims

Beyond M7: the batch's negative conflict findings are written with more certainty than the data
supports — *"odůvodněný negativní nález"* (54, 250), *"čestný nález negativního výsledku, nikoli
… mezera v dostupných datech"* (100), *"pole peněžních vazeb předkladatele je úplné"* (56). The
honest form is verdict-16's: *"nebyl **na základě dostupných dat** zjištěn"*. The non-partisan
symmetry doctrine makes a clean negative valuable — it does not make it certain.

---

## 6. What the audit confirms (record this too)

An audit that only lists defects mis-states the batch. Independently re-derived and **correct**:

- **verdict-250's 10-vs-6 amends claim** — the batch's one data-quality claim about our own
  platform. Ten parts counted by hand, four missing refs identified exactly. (§2.3)
- **verdict-10's central finding** — the EMFA ownership register goes to the Ministry of Culture,
  and the DZ justifies it only by RRTV's subject-matter scope, never by independence. Verbatim at
  `tisk-10/265040.txt` L1734–L1738. Medium is earned.
- **verdict-69's `§ 40`–`§ 41` blocking mechanism** — real, correctly described, including the ISP
  duty and the 6 % turnover cap. Medium is earned on this effect.
- **verdict-172** — every claim verbatim, hedges intact, no defect above MINOR.
- **verdict-65's `§ 18a odst. 4` quote and data-category list** — exact.
- **verdict-56's `§ 17a odst. 5` fine and bod 15 text** — exact (only the researchedContext
  attribution is wrong).
- **verdict-16's "nad rámec" effect** — verbatim at `tisk-16/265180.txt` L770–L772; the eleven
  amended laws counted and confirmed.
- **All four audited close-reads** — every quoted span occurs verbatim in the named bill under NFC
  normalization; all four classifications hold; both groups' counts and coverage are consistent.
- **The three batch-011 money failures did not recur** — no beneficiary of an unsigned effect, no
  present-tense registry role, no unsupported tie class.

---

## 7. Blocking list for the driver

Persist is blocked on B1–B3. M1–M11 should be fixed in the same pass; a batch whose MEDIUM
verdicts carry wrong paragraph numbers cannot be defended by "the low ones were fine".

| id | file · field | fix |
|---|---|---|
| B1 | verdict-10 · `unstatedEffects[1].evidence`, `citations[1].claim` | `§ 6` → `§ 7` (odst. 3 for the notification duty, odst. 4 for the assessment) |
| B2 | verdict-69 · `unstatedEffects[0].effect` | drop or restate the "unstated" premise; note that the P2B leg re-enacts 58/2023 |
| B3 | verdict-250 · `unstatedEffects[1]` | correct Rada vs Dozorčí rada, add the Dozorčí-rada + Úřad consent on the ceník, and cite `§ 11 odst. 2` / `§ 21 odst. 2` — or drop the effect |
| M1 | verdict-13 · `unstatedEffects[1].evidence`, `citations[1].claim` | `§ 604 odst. 1` → new `§ 603a odst. 2` (bod 177) |
| M2 | verdict-54 · `conflictAssessment`, `citations[5]` | add the `pending_review` label verdict-65 carries |
| M3 | verdict-65 · `researchedContext` | "pět" → the real count; reconcile the list with the eleven amended laws |
| M4 | verdict-69 · `statedReasoning` | seven amended laws in the text; name `132/2010`; flag the graph gap as verdict-250 does |
| M5 | verdict-56 · `researchedContext` | move the fine from `§ 17d` to `§ 17a odst. 5` |
| M6 | verdict-69 · `conflictAssessment` (and verdict-56's reference to it) | include SOMPO, a.s. (IČO 25172263, 9 174 258 Kč) |
| M7 | verdict-56 · `conflictAssessment` | delete "pole peněžních vazeb předkladatele je úplné"; use verdict-16's hedge |
| M8 | verdicts 65 / 16 / 100 · the `historie.sqw` citation | `kind: "web"` → `graph_fact`, or fetch the page |
| M11 | verdict-65 · `conflictAssessment` | Jurečka is the MPSV minister *and* the sponsor — one person, not two parties |

---

# Closure check (post-fix)

Run against the **current files on disk** (`verdicts-012/*.json`, mtimes 2026-08-04 17:48–17:51),
not against the authors' account of them. Same method as the initial pass: NFC-normalized greps
of the cached bill texts, plus `batch-012-targets.json` for every graph assertion.

## RESULT: **REOPENED**

Ten of the eleven listed findings are genuinely closed, three of them (B3, M3, M1) closed *better*
than asked. But the remediation of **M6** — the one finding that touched an MP's money ties —
introduced a **new BLOCKING defect in two files**: it promotes a sitting MP to a company office
the corpus does not give him, in the present tense, without a date, under a `graph_fact` citation.
This is the batch-011 failure class reproduced inside the fix intended to close it.

Gate unchanged: `npx tsx scripts/case-loops/law/gate-verdicts-011.ts --batch=012` → **10/10**.
Counts unchanged: 2 medium (69, 10) / 8 low. Close-read payloads untouched (mtimes 17:11/17:12);
their `classificationCounts` still tally against their own `pairs` arrays (gA 5/2/1, gB 3/4/1).
`whoBenefits` regression check: 17/17 effects still lead *"Nelze jednoznačně určit"*.

---

## A. Original findings — closure status

| id | status | evidence |
|---|---|---|
| **B1** verdict-10 `§ 6` → `§ 7` | **CLOSED** | `unstatedEffects[1].evidence` and `citations[1].claim` both now read `§ 7`; matches `tisk-10/265040.txt` L118–L137 (`§7 Posouzení spojování na mediálním trhu`, odst. 3 notification, odst. 4 čl. 22 odst. 2 assessment). |
| **B2** verdict-69 false "unstated" premise | **CLOSED** | `unstatedEffects[0]` dropped entirely. `statedReasoning` now credits the DZ's own comparative analysis — lowest budget cost, *"soulad s usnesením vlády č. 590 ze dne 16. srpna 2023"*, other Member States' practice, RIA referral — all verbatim at `tisk-69/266214.txt` L2966–L2977; and states the P2B role *"ČTÚ plní už od roku 2023 na základě zákona č. 58/2023 Sb.; tento tisk ji nezavádí"*, matching L2721–L2725. Both corrections re-derived and correct. |
| **B3** verdict-250 Rada/Dozorčí rada/ceník | **CLOSED, materially improved** | Every new assertion verified: three organs `§ 9 odst. 1` (L152–L160); Rada = 5 members, chaired by předseda Úřadu, part-nominated by industry legal persons `§ 11 odst. 1–2` (L208–L215); Dozorčí rada = 5 members, chair appointed by the minister, others by předseda Úřadu *"především ze zástupců ústředních správních úřadů"* `§ 12 odst. 1–2` (L222–L230); ceník *"po předchozím projednání Dozorčí radou a souhlasu Úřadu"* `§ 21 odst. 2` (L371–L374); sponsored-access fee separate, budget public `§ 20 odst. 4` (L355–L356). The three new `bill_text` citations are each verbatim-grounded. The capture insinuation is gone, replaced by an accurate description of which organ industry actually reaches. |
| **M1** verdict-13 `§ 604` → `§ 603a` | **CLOSED, improved** | Both fields now cite *"Nový § 603a odst. 2 (bod 177)"* and correctly tie it to `§ 603a odst. 1` / `§ 37b`. Matches `tisk-13/265099.txt` L2421 (bod 177), L2425–L2435 (obhospodařovatel otevřeného fondu, `§ 37b`), L2437–L2447 (300 000 000 Kč / 10 % / 2×). The flat-300M limb I flagged as a MINOR omission is now included too. |
| **M2** verdict-54 missing `pending_review` | **CLOSED** | `conflictAssessment`: *"vazba je v grafu vedena jako čekající na kontrolu (pending_review), tedy dosud lidsky neověřená"*; `citations[5]` carries the same. The over-smooth *"Jde o odůvodněný negativní nález"* was removed in the same pass. |
| **M3** verdict-65 "pět"/eight/eleven | **CLOSED, independently re-verified** | New text: *"z jedenácti novelizovaných předpisů má deset vlastní odůvodňující pasáž … zákon o svobodném přístupu k informacím jako jediný z jedenácti ji nemá"*. I recounted oddíl 1 of the obecná část in `tisk-65/266164.txt`: ten `K zákonu o …` subsections at L1118, L1133, L1170, L1186, L1214, L1246, L1258, L1265, L1282, L1304 — and **no** subsection for 106/1999. The verdict's list of ten matches that sequence one-for-one and in order; the explanation does first appear in the zvláštní část (L2197). Arithmetic and fact both now hold. |
| **M4** verdict-69 "šest" → seven | **CLOSED on the count** (see N3 for what the fix broke) | Recounted independently: ČÁST DRUHÁ–OSMÁ = seven amending parts, `§ 68`–`§ 74`; the verdict names each with its § and its law, and names `132/2010` (ČÁST ŠESTÁ, `§ 72`, L2199–L2211) as the one the graph omits. New `citations[2]` states the same. Correct. |
| **M5** verdict-56 fine attributed to `§ 17d` | **CLOSED** | `researchedContext` now: *"Samotnou výši sankce stanoví jiné … ustanovení téže novely — nový § 17a odst. 5 (bod 12) … § 17d jen určuje, který orgán kterou skupinu přestupků projednává."* Matches `tisk-56/266014.txt` L120–L124 (bod 12) and L134–L147 (bod 15). The internal contradiction is gone. |
| **M6** verdict-69/56 SOMPO omitted | **CLOSED as an omission — REOPENED as a fabrication** | SOMPO is now named with its figure in both files. But the sentence added alongside it is **N1**. |
| **M7** verdict-56 completeness claim | **CLOSED** | *"pole peněžních vazeb předkladatele je úplné"* deleted. verdict-16, -100 and -172 likewise softened to *"nebyl na základě dostupných dat zjištěn"* / *"v datech dostupných platformě"*. Residual: verdict-13 still ends *"Jde o věcnou absenci dokladu o střetu zájmů, kterou lze u tohoto tisku konstatovat přímo"* — outside the coordinator's fix list, still MINOR. |
| **M8** `web` → `graph_fact` re-tag | **CLOSED, checked as instructed** | The three re-tagged citations now read *"Podle grafových dat o projednávání tisku N je garančním výborem X se stavem Y k DATE"* on urns `bill:tisk:43172` (65), `bill:tisk:43123` (16), `bill:tisk:43210` (100). **All three urns are the exact `billNodeId` of their own target and all three are present in `batch-012-targets.json → knownIds`** (checked against the full 883-id set; all ten targets' node ids resolve). Each claim restates `committeeRouting` field-for-field — `VSR/garancni/navrzeno/2025-12-17`, `RV/garancni/prikazano/2026-03-24`, `VSR/garancni/navrzeno/2026-03-04`. The claims stay inside graph data; no `historie.sqw` URL is asserted as fetched any more. |
| **M11** verdict-65 Jurečka role separation | **CLOSED** | *"jediným uvedeným sponzorem tisku je Marian Jurečka — tedy tatáž osoba, která je ministrem práce a sociálních věcí, nikoli osoba odlišná od předkládajícího ministerstva"*, and `citations[4]` now carries *"Jurečka je zároveň ministrem předkládajícího resortu"*. The negative conclusion is preserved and the reasoning that reaches it is now true. |

**Unaddressed MINORs from the initial pass** (none were in the coordinator's fix list; all still
stand): verdict-10 `citations[2]` attributing source protection to `§ 3` rather than `§ 12` / the
new `§ 12a` tr. ř.; verdict-10's EMFA-sourced register contents cited as `bill_text`; verdict-13's
minister/sponsor role separation; verdict-16's *"o bankách"* where the amended law is *o České
národní bance* (6/1993, not 21/1992); the `tiskt.sqw` index-page hop on every `bill_text` source;
and the close-read MINOR on `40-64-586-1992`'s unshown letter arithmetic (those files untouched).

---

## B. New defects introduced by the remediation

### N1 · **BLOCKING** · verdict-69 and verdict-56 — an MP promoted to an office the corpus does not give him

Both files now assert, in the present tense, with no date and no source:

- `verdict-69.json` → `conflictAssessment`: *"…Vlček v ní **zastává funkci předsedy představenstva**."*
- `verdict-69.json` → `citations[3].claim`: *"…SOMPO, a.s. … komunálně vlastněnou společnost založenou 117 obcemi, **kterou vede jako předseda představenstva**."* · `kind: "graph_fact"` · `source: "company:ico:25172263"`
- `verdict-56.json` → `conflictAssessment` and `citations[2].claim`: the same two sentences.

The **only** role datum for this MP-company pair anywhere in the corpus says something different:

```bash
node -e "const s=require('fs').readFileSync('docs/data-analysis/case-law/payloads/batch-003-targets.json','utf8'); \
         const i=s.indexOf('25172263'); console.log(s.slice(i-60,i+140))"
```
```json
"urn": "company:ico:25172263",
"name": "SOMPO, a.s.",
"role": "místopředseda představenstva",
"contractCzk": null
```

**`místopředseda` — vice-chairman.** The verdicts print `předseda`. Four separate failures in one
sentence:

1. **Factually wrong** against the only record the repo holds, and wrong in the direction that
   makes the MP more senior. This is a real, named, sitting MP.
2. **Present tense with no date.** `batch-003-targets.json` is a snapshot; batch-011's blocking
   defect was precisely a role asserted in the present tense when the registry carried an end
   date. Nothing in batch-012 establishes the role is current, and the batch-012 targets file
   carries no `period_from` / `period_to` for it.
3. **The `graph_fact` citation cannot support it.** `batch-012-targets.json → targets[].sponsors[].moneyTies[]`
   has exactly four fields — `ico`, `name`, `urn`, `contractCzk` — verified programmatically over
   the file. There is no role field in the batch-012 graph payload at all, so a `graph_fact` on
   `company:ico:25172263` asserts something the cited node does not carry.
4. **It is load-bearing.** The whole "municipal/SOE, therefore not a conflict" disposal turns on
   what office he holds and when.

*Fix shape:* either state the role as the corpus has it, dated and sourced (*"v grafovém snímku
batch-003 veden jako místopředseda představenstva; aktuálnost ani období nejsou v datech
doloženy"*), or drop the office entirely — the municipal-ownership disposal does not need it.

### N2 · MAJOR · verdict-69 and verdict-56 — right fact, wrong provenance on SOMPO's ownership

*"založena v roce 1997 sto sedmnácti obcemi jako akcionáři"*, *"odpadovým hospodářstvím (NACE 38)"*
and *"komunálně vlastněná"* are **true and grounded in this batch** — `batch-012-sector-audit.json`,
SOMPO row: `"SOMPO was founded in 1997 by 117 member municipalities as its shareholders"`,
`nace: [… "38", "38210"]`, `verdict: "CONFIRMED"`, with `ownershipSources` = the ARES VR endpoint
plus `https://www.sompo.cz/sompo/zakladni-informace/`. But both verdicts attach them to a
`graph_fact` citation on `company:ico:25172263`, which carries none of it. Under this repo's brand
rule a figure cites the source it actually came from; here the reader is told "graph" for a fact
that came from a registry sweep. Re-point the citation at the sector audit's sources, or split it
into a `web` citation carrying the ARES URL.

### N3 · MINOR · verdict-69 — a methodology sentence borrowed from verdict-250 that is false here

`researchedContext`: *"Přímým součtem novelizačních částí (ČÁST DRUHÁ až ČÁST OSMÁ, **každá
s vlastním „Zákon č. …, se mění takto"**)…"*. Four of the seven parts do not open that way:

```
tisk-69/266214.txt
1918: V zákoně č. 141/1961 Sb., o trestním řízení soudním (trestní řád), ve znění …
2151: V § 47 odst. 5 zákona č. 121/2000 Sb., o právu autorském, … se slova
2169: V položce 109 přílohy k zákonu č. 634/2004 Sb., o správních poplatcích, … se doplňují písmena
2204: V § 18 zákona č. 132/2010 Sb., o audiovizuálních mediálních službách na vyžádání …
```

The phrase is verbatim from verdict-250's `researchedContext`, where it **is** accurate
(`tisk-250/277952.txt` L946: *"Zákon č. 2/1969 Sb., … se mění takto"*). The count of seven is
correct and independently re-verified; only the stated method is wrong. Copying a sibling
verdict's methodology sentence without re-checking it against this bill is how a batch drifts.

### N4 · MINOR · verdict-69 and verdict-56 cite an internal batch artefact in reader-facing copy

*"podle ustálené doktríny těchto případů (batch-010) se taková vazba posuzuje jako municipální/SOE
role"*. `/zakony` renders this prose to a reader who has no batch-010. State the rule, not its
internal provenance.

### N5 · MINOR · verdict-250 — Czech-language surface error in new copy

`unstatedEffects[0].effect`: *"Čtyři **ze deseti** novelizovaných zákonů"* — should be *z deseti*.
Verdict copy is pinned to the Czech language gate elsewhere in this repo; a grammatical error in a
newly written, publicly rendered sentence is worth one edit.

---

## C. The specific checks the coordinator asked for

- **Re-tagged `graph_fact` citations** — urns exist, are the correct `billNodeId` per target, are
  in `knownIds`, and the claims restate `committeeRouting` verbatim. **Clean.** (M8)
- **verdict-250's new `bill_text` citations** — all three verbatim-grounded in the cached text at
  the line numbers in §A. **Clean.**
- **Recounted numbers** — verdict-65's "ten of eleven" recounted from the DZ's oddíl 1 and correct;
  verdict-69's "seven" recounted from the enacting text and correct. **Both clean.** (The
  parenthetical *how* verdict-69 says it counted is N3.)
- **verdict-69's internal consistency with effect[0] gone** — `statedReasoning`, `researchedContext`
  and the single remaining effect now tell one story: the DZ is credited for what it does disclose
  (the ČTÚ choice), and the medium rests solely on `§§ 40–41`. Severity **medium still reads as
  earned from the file alone**: a statutory duty on every Czech ISP to block listed websites is
  materially larger than the bill's self-presentation, the mechanism is quoted, and
  `confidence: 3` is right for a one-effect finding. The effect's new yardstick —
  *"shrnutí novely v podkladech tisku nezmiňuje"* — is the platform's own summary field
  (`targets[].summary.summary` = *"Nový zákon o digitální ekonomice a o změně některých
  souvisejících zákonů."*), which is honest and consistent with how verdicts 13 and 54 phrase the
  same move. No dangling reference to the deleted effect survives anywhere in the file.

---

## D. Blocking list for the driver — round 2

| id | file · field | fix |
|---|---|---|
| **N1** | verdict-69 `conflictAssessment` + `citations[3].claim`; verdict-56 `conflictAssessment` + `citations[2].claim` | `předseda představenstva` is wrong (`batch-003-targets.json` has **místopředseda**), present-tense, undated, and not carried by the cited `graph_fact`. Correct-and-date it, or drop the office. |
| **N2** | the same four fields | re-point the 1997 / 117-obcí / NACE-38 provenance at `batch-012-sector-audit.json`'s ARES + sompo.cz sources instead of `graph_fact`. |
| N3 | verdict-69 `researchedContext` | drop *"každá s vlastním „Zákon č. …, se mění takto""* — false for 4 of the 7 parts. |
| N4 | verdict-69, verdict-56 `conflictAssessment` | remove the `(batch-010)` internal reference from reader-facing copy. |
| N5 | verdict-250 `unstatedEffects[0].effect` | *ze deseti* → *z deseti*. |

Persist stays blocked on **N1**. Everything else on this list is a same-pass edit.

**Standing observation, now three rounds old:** money-touching prose is the only class that has
failed in every round — batch-011 initial, batch-011 remediation, batch-012 initial, and now
batch-012 remediation. This time it failed *while fixing a money-tie finding*, and the gate passed
10/10 throughout, because no machine check reads a role assertion back against the corpus. That
check is worth writing before batch-013: for every person-company sentence in a verdict, assert
that any named role string appears verbatim in some `*-targets.json` `role` field, and that a
present-tense role carries a date.

---

## Final closure (N-findings)

Scoped re-check of the fields named by the driver, against the current files
(`verdict-69` / `-56` / `-250` / `-13`, mtimes 2026-08-04 18:03). Gate re-run: **10/10**.
`whoBenefits` regression check: still 17/17 leading *"Nelze jednoznačně určit"*.

**I verified the ARES claim myself** rather than take it on report, by fetching the URL the
verdicts now cite — `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/25172263`
— and asking it for the verbatim records behind each date:

```json
{ "datumZapisu": "2025-02-04",
  "clenstvi": { "clenstvi": {"vznikClenstvi": "2024-12-03"},
                "funkce":   {"vznikFunkce": "2024-12-03", "nazev": "předseda představenstva"} },
  "fyzickaOsoba": { "jmeno": "LUKÁŠ", "prijmeni": "VLČEK" } }        ← open, no zanik*
{ "datumZapisu": "2023-10-16",
  "clenstvi": { "clenstvi": {"zanikClenstvi": "2024-10-31"},
                "funkce":   {"zanikFunkce": "2024-10-31", "nazev": "předseda představenstva"} },
  "fyzickaOsoba": { "jmeno": "LUKÁŠ", "prijmeni": "VLČEK" } }
{ "datumZapisu": "2016-02-24",
  "clenstvi": { "clenstvi": {"vznikClenstvi": "2015-12-17"} },
  "fyzickaOsoba": { "jmeno": "LUKÁŠ", "prijmeni": "VLČEK" } }
```

**The driver's core correction is confirmed.** Lukáš Vlček *is* předseda představenstva of
SOMPO, a.s., `vznikFunkce 2024-12-03`, and that record carries **no** `zanikClenstvi` /
`zanikFunkce` — it is the open, current office. My N1 was right that `batch-003-targets.json`
could not support the claim; it was wrong to treat that stale snapshot as the ceiling on the
fact. Fetching the registry, not the corpus, was the correct move.

| finding | status | evidence |
|---|---|---|
| **N1** role assertion | **CLOSED** | Rank correct and now dated and sourced in both files: *"zastává funkci předsedy představenstva **od 3. 12. 2024**"* + a `kind:"web"` citation on the ARES VR URL, in `verdict-69` (`citations[6]`) and `verdict-56` (`citations[5]`). The present tense is now anchored to an open registry record I confirmed myself. |
| **N2** provenance | **CLOSED** | Both `graph_fact` citations on `company:ico:25172263` now claim only what the graph holds — *"peněžní vazbu … ve výši 9 174 258 Kč (úhrn veřejných smluv firmy, vazba čeká na lidskou kontrolu)"*; the gate state is stated, and the role + municipal-ownership facts moved to two `kind:"web"` citations (ARES VR, `sompo.cz/sompo/zakladni-informace/`). |
| **N3** false uniform-formula parenthetical | **CLOSED** | `verdict-69.researchedContext` now reads *"Přímým součtem novelizačních částí (ČÁST DRUHÁ až ČÁST OSMÁ)"* — the *"každá s vlastním „Zákon č. …, se mění takto""* clause is gone; the seven-law enumeration and the `132/2010` gap are unchanged and still correct. |
| **N4** internal batch reference | **CLOSED** | *"(batch-010)"* removed from both files; now *"podle ustáleného pravidla tohoto projektu"*. Grep-confirmed: 0 occurrences of `batch-010` in either verdict. |
| **N5** Czech surface error | **CLOSED** | `verdict-250.unstatedEffects[0].effect` now *"Čtyři **z deseti**"*; 0 occurrences of *ze deseti* remain in the file. |
| M7 residual (verdict-13) | **CLOSED** | Now scoped to the data — *"u kterého případový soubor neeviduje žádnou peněžní vazbu (pole je v datech přítomné a prázdné)"*, with the conclusion explicitly framed as *"v datech"*. |

### N6 · MAJOR (new, from the N1 fix) — two prior-history details contradict the ARES record now cited

The fix got the live office right and the history around it wrong. Both claims below sit in
`verdict-69.conflictAssessment` + `citations[6].claim` and `verdict-56.conflictAssessment` +
`citations[5].claim`, i.e. inside the very `web` citation whose source refutes them:

1. *"předtím byl **místopředsedou** do 31. 10. 2024"* — ARES shows the office that ended
   `2024-10-31` was **`"nazev": "předseda představenstva"`**, not místopředseda. (His vice-chair
   term is an older record, `2015-12-22 → 2020-02-27`.) The sentence swaps the two ranks.
2. *"členem orgánů společnosti je **nepřetržitě** od 17. 12. 2015"* — the record shows
   `zanikClenstvi 2024-10-31` followed by a fresh `vznikClenstvi 2024-12-03`: a ~33-day break.
   Membership since 2015 is right; *continuous* is not, on the face of the cited record.

Neither error touches the disposal — SOMPO is municipally owned, the tie is not a conflict, and
the current-office claim is sound — so this is **not** a persist blocker on its own. But a `web`
citation must not assert what its own URL contradicts. Fix: state *"předtím předsedou
představenstva do 31. 10. 2024"* and replace *nepřetržitě* with *"v orgánech společnosti od
17. 12. 2015, s přerušením mezi 31. 10. a 3. 12. 2024"* — or drop the prior history and keep only
the dated current office, which is all the disposal needs.

**Lesson for the loop, restated:** the corpus snapshot is a floor on what is known, not a ceiling
on what is true — N1 was correctly raised against the snapshot and correctly resolved by fetching
the registry. The remaining error is the mirror image: once the registry was fetched, the *detail*
around the headline fact was written from memory rather than read off the record. A role sentence
should be assembled field-by-field from the `clenstvi` objects, never paraphrased.
