# Batch 018 — independent adversarial audit (verdict wave 61/70/78/107/133/153/190/192/231/261 · evidence-coordinate migration, pass 52 pending)

Date: 2026-08-05. Fresh auditor, no prior involvement in any batch. Read-only throughout —
no payload, source or store file was edited; no git; PGlite opened for SELECT only.

# ⛔ BLOCK

**Five blocking defects.** Four are in the verdicts (one fabricated quotation, one fabricated
cross-reference that also contradicts a published verdict, one exculpatory clearance falsified
by the project's own corpus, one absence claim falsified by a grep of the very DZ section it
names). The fifth is in the migration payload itself: a rewritten coordinate that points at the
wrong article **of the wrong act**, introduced by the sweep — the legacy line reference it
replaced resolved correctly.

The corpus's first `high` verdict is not earned. The migration is not safe to apply.

Method: every cached text was NFC-normalized and U+200B-stripped before matching (the pdftotext
render carries ZERO-WIDTH SPACE after list markers; a naive match falsely reports real
quotations absent). All offsets below are into that normalized string. Money classes are read
from `docs/data-analysis/case-money/ledger.json` `units[].tieClass`.

---

## BLOCKING

### B1 — verdict-107 `researchedContext`: the collision's central quotation is fabricated

`payloads/verdicts-018/verdict-107.json` → `.researchedContext`, verbatim:

> „Přímé srovnání textů obou tisků ukazuje, že oba používají **naprosto stejnou
> legislativně-technickou formuli „Za § 9d se vkládá nový § 9e"** (tisk 107, čl. I bod 1;
> tisk 106, body 22-24)"

Measured over `.data/law-collision-cache/tisk-106/267576.txt` (NFC, 267 561 chars):
**the string `Za § 9d se vkládá nový § 9e` occurs ZERO times.** The single `Za § 9d` occurrence
is at offset **6 554** and reads:

> „22. Za § 9d se vkládá **označení dílu 2**, které včetně nadpisu zní: „Díl 2 / Práva a
> povinnosti spojené s poskytováním ubytování"."

and the § 9e instruction is bod 23 @6 785: „**Za označení a nadpis dílu 2** se vkládá nový § 9e,
který zní:" (bod 24 @7 274 then re-enacts it: „§ 9e zní:"). Three different instructions, none of
them the quoted formula.

The verdict's own `citations[4]` states the correct one („Tisk 106 vkládá **za označení a nadpis
nového dílu 2** nový § 9e…"), so the verdict contradicts itself: the quoted evidence in the
research field and the citation that is supposed to support it describe different instructions.
The quoted formula is the sole basis for the claim of an identical drafting act — the sharpest
sentence in the batch's only `high` verdict — and it is not in the source.

*What survives:* the substantive collision holds. Both prints do land a new § 9e immediately
after § 9d in zákon č. 159/1999 Sb. with incompatible content (106 = registry definitions,
107 = obecní nařízení), which I re-derived independently. The finding must be re-stated from
what the prints actually say.

### B2 — verdict-231 `citations[5]`: fabricated cross-reference, direction inverted, contradicts the published record

`verdict-231.json` → `.citations[5].claim`, verbatim:

> „…a jeho [tisku 47] zvláštní část **výslovně odkazuje na navazující novelu zákona o NKÚ
> podanou jako sněmovní tisk 217**."

Measured over `.data/law-collision-cache/tisk-47/265737.txt` (NFC, 11 479 chars):
**`\b217\b` → 0 hits. `tisk` (any case) → 0 hits.** Tisk 47 names only the *law*
(„…je … „rozpracována" v zákoně č. 166/1993 Sb., o Nejvyšším kontrolním úřadu"), never a print.
The reference runs the other way: `.data/law-collision-cache/tisk-217/271419.txt` @2 429 —
„…návrh ústavního zákona … (**senátní tisk č. 47**, 10. volební období), a fakticky jej provádí".

Cross-verdict contradiction: `payloads/verdicts-017/verdict-47.json` → `.unstatedEffects[0].effect`
states the opposite verbatim — „…novelou zákona č. 166/1993 Sb., o Nejvyšším kontrolním úřadu,
**kterou ale sama nejmenuje**. Prováděcí novela byla mezitím podána jako samostatný sněmovní tisk
217 …, **jehož důvodová zpráva na tisk 47 výslovně odkazuje**." That verdict is live on the store
(pass 51). Batch 018 publishes the inverse of a published finding, as a `bill_text` citation.

### B3 — verdict-70 `conflictAssessment`: a categorical clearance falsified by this project's own corpus

`verdict-70.json` → `.conflictAssessment`, verbatim closing sweep:

> „**Mezi předkladateli tisku 70 ani mezi jejich evidovanými vazbami se tedy nenachází žádná
> vazba na VZP ČR** ani na žádnou ze šesti zaměstnaneckých zdravotních pojišťoven, které novela
> přímo finančně zvýhodňuje; věcný střet zájmů podle dostupných dat zjištěn nebyl."

`payloads/batch-018-targets.json` → `targets[billTisk=70].sponsors[8]` = `{pspId: 6534, name:
"Jiří Mašek"}`. The published corpus record for that node,
`docs/data-analysis/case-effort/payloads/batch-002-group-B.json`, `proposals[id=psp:person:6534]`:

- `props.effort_committee_focus`: „**Předseda Výboru pro zdravotnictví**; … **volený člen dozorčí
  rady VZP (od 28.1.2026)**"
- `headline`: „Předseda zdravotního výboru dovedl vládní novelu pojistného přes vlastní výbor až
  do zákona (71/2026 Sb.) — a **sedí v dozorčí radě VZP** i ve vyšetřovací komisi Dozimetr, jejíž
  záběr VZP zahrnuje."

`targets[70].committeeRouting` = `{organ: "VZ", role: "garancni", status: "prikazano",
assignedOn: "2026-01-28"}` — the garanční výbor he chairs, assigned the same day his VZP
supervisory seat begins. The bill moves **7 879 000 000 Kč** out of VZP ČR to six employee
insurers.

The verdict's sentence is not scoped to money ties (a supervisory seat is a registry role, not a
contract — and correctly, `ledger.json` carries 0 units for 6534). As written it is a categorical
statement about *any* tie to VZP ČR, and the corpus falsifies it. This is batch-017's **M9b —
asymmetric disposition** recurring: the exculpatory facts are published in full and the single
most inculpatory fact available on this print appears nowhere.

### B4 — verdict-192 `researchedContext`: absence claim falsified by a grep of the section it names

`verdict-192.json` → `.researchedContext`, verbatim:

> „Text zákona **ani zvláštní část důvodové zprávy neobsahují žádné bližší kritérium**, podle
> kterého má Národní knihovna posuzovat, co má takovou „politickou" hodnotu pro archivaci"

Measured over `.data/law-collision-cache/tisk-192/270237.txt` (NFC, 163 252 chars;
`Zvláštní část` @104 002): `kritéri` → **15 hits, 7 of them inside the zvláštní část**, and three
form one continuous passage answering exactly this question:

- @105 608 — „Uvedená **kritéria** musí být in concreto při činnosti Národní knihovny pojímána
  flexibilně, s možností operativní změny (v mezích zákona)"
- @106 022 — „**Kritéria, jaké webové stránky budou harvestovány, tedy určí primárně Národní
  knihovna. Je nepraktické tato kritéria určovat zákonem**, neboť se mohou (a někdy i operativně
  musí) v čase měnit. **Národní knihovna má stanovenou tzv. collection policy** sestávající ze tří
  typů sklizní (výběrová, celoplošná, tematická)."

The zvláštní část names who sets the criteria, why they are deliberately not statutory, and the
instrument that carries them. The sentence is the premise of `unstatedEffects[0]` and of
`citations[1]`.

*Precision to preserve in the fix:* the narrower forms survive the grep and are clean —
`metodik` → 0, `přezkum` → 0, `diskre|uvážen` → 0 across the whole 163 k document. Scoping the
sentence to the statute and stating what the DZ actually says (criteria delegated to the
institution's own collection policy, expressly because they must be changeable) yields a
*stronger* finding, not a weaker one.

### B5 — migration payload, tisk 83: the new coordinate points at the wrong article of the wrong act — sweep-introduced

`payloads/batch-018-evidence-sweep.json` → `patched[cislo=83, field="forensic_researched_context"]`,
`after` verbatim:

> „…povinnost anonymizace nebo pseudonymizace osobních údajů zpracovávaných poskytovateli služeb
> inteligentních dopravních systémů **(Čl. II bod 4, § 39a odst. 6 zákona o silniční dopravě)**…"

Measured over `.data/law-collision-cache/tisk-83/266860.txt` (NFC, 2 002 lines):

| item | line | text |
|---|---|---|
| the passage | **420** | „4. V § 39a se na konci odstavce 6 doplňuje věta…" (→ „a) anonymizovat, nebo" l. 424) |
| enclosing `Čl.` | **370** | `Čl. V` — „Zákon č. **13/1997 Sb., o pozemních komunikacích**…" |
| enclosing `ČÁST` | **367** | `ČÁST PÁTÁ` — „Změna zákona **o pozemních komunikacích**" |
| the cited `Čl. II` | **82** | „Zákon č. **111/1994 Sb., o silniční dopravě**…", under `ČÁST DRUHÁ` (l. 79); its own bod 4 is „V § 35 se za odstavec 7 vkládají nové odstavce 8 a 9" — unrelated |

The correct coordinate is **Čl. V bod 4, § 39a odst. 6, zákon č. 13/1997 Sb., o pozemních
komunikacích (ČÁST PÁTÁ)** — 338 lines away, in a different ČÁST governing a different statute.
`bod 4` and `§ 39a odst. 6` are right; the article and the act name are both wrong, and wrong
*consistently* (Čl. II genuinely is „o silniční dopravě"), so the false citation reads as
authoritative and resolves to a real-but-different provision.

The legacy `before` („řádky 410–429") resolved **correctly** to line 420. The migration
introduces the error — the sweep-introduced-corruption class, on the payload whose entire purpose
is citation accuracy. And it passes every guard the applier has (see M19): nothing in the
verification block checks that a new structural coordinate is *true*.

---

## MAJOR

**M1 — verdict-107 `.severity`: `high` is unearned against the loop's own revealed ladder.**
Measured across `payloads/verdicts*/`: **56 low · 25 medium · 1 high**, the high being this
verdict — the first in the corpus. Same-class precedents, both `medium`: batch-017 tisk 85 ↔ 88,
**five** mutually incompatible instruction pairs incl. three destructive rewrites of one article
and conflicting `1. května` vs `1. srpna 2026` dates; batch-017 tisk 131 ⊂ tisk 12, word-for-word
subset, 8 of 15 points byte-identical. Tisk 107 ↔ 106 is **one** § designation claimed twice.
The verdict's own `whoBenefits` says „Nejde o prospěch žádné strany" **twice**, and
`.unstatedEffects[0].effect` states the remedy in-line („např. pozměňovacím návrhem
přečíslujícím jeden z tisků"); both prints sit at `stav = "1. čtení"` on the store. A finding
whose beneficiary analysis is *nobody* and whose harm is *a bill needing one amendment* cannot be
the corpus's single highest severity while a five-pair collision is medium. **Should be `medium`.**
(The „K § 9o" heading is excellent forensics — but it is a drafting-quality fact, not a harm
escalation.)

**M2 — cross-verdict §-range inconsistency: 107 and 106 do not tell one story.**
`verdict-107.researchedContext` rests its numbering hypothesis on „po vložení **§§ 9e až 9n**
tiskem 106". `verdicts-016/verdict-106.json` → `.statedReasoning` published „nový **§ 9e až § 9m**".
Measured in tisk-106: insertion instructions for 9e @6 785, 9f @8 161, 9g+9h @15 046, 9i+9j
@20 350, 9k @21 547, 9l @23 414, 9m @24 166, **9n @25 260**; `§ 9o` → **0 hits**. 107 is right,
106 is wrong — but under 106's *published* claim the next free number is 9n, not 9o, so the
published record currently refutes the new verdict's hypothesis. Reconcile explicitly.

**M3 — verdict-231 `.unstatedEffects[0].effect`: self-contradiction inside one field.**
Sentence 1: „Obecná část důvodové zprávy uvádí v jediném odstavci dva souběžné vládní závazky —
… zajistit transparentní kontrolu jejich hospodaření **prostřednictvím NKÚ**". Sentence 3:
„Tisk 231 naproti tomu **ani jednou nezmiňuje NKÚ**". Measured: the abbreviation `NKÚ` → **0 hits**,
but `Nejvyšš\w*\s+kontroln\w*` → **1 hit @13 829**, and it is precisely the sentence the verdict's
`statedReasoning` and `citations[0]` are built on. The verdict's own thesis requires the mention it
denies. (The rest of the clause is grep-verified true: `\b47\b` → 0, `\b217\b` → 0,
`sněmovní tisk` → 0.) Graded MAJOR, not BLOCKING: the error runs against the verdict's own
accusation and misrepresents nothing external.

**M4 — verdict-231: DZ-section misattribution (measured).** `.unstatedEffects[1].effect` and
`.researchedContext` place the „částka je stanovena přímo v zákoně" guarantee inside the obecná
část, bod 12 (Zhodnocení korupčních rizik). Measured: bod 12 spans **55 409–55 945** and contains
no such guarantee; `přímo v zákoně` occurs **once, @63 945**, i.e. in the **zvláštní část**
(boundary @58 741). The nearest obecná-část equivalent is bod 3 @19 316 („pevnou výši"), not bod 12.

**M5 — verdict-231 `.unstatedEffects[1].effect`: inexact quotation, modality changed.**
Quoted inside „…": „**může** zvyšovat riziko politického tlaku…". Print @55 851: „Bez dostatečných
garancí by rozpočtové financování **mohlo** zvyšovat riziko…". `může zvyšovat riziko` → **0 hits**
in the print. The same verdict's `.researchedContext` quotes „mohlo" correctly — two fields quote
one sentence two ways, and the altered one converts a conditional into an admission.

**M6 — verdict-231 `.statedReasoning`: a claim attributed to the DZ that the DZ does not make.**
„…tvrdí, že fixace částky přímo v zákoně a automatický valorizační mechanismus **vylučují riziko**
ad hoc politického ovlivňování". `ad hoc` → 1 hit @55 495, inside bod 12, framed as what
transparent statutory rules should *prevent*, immediately followed by the admission that the risk
may rise. The EMFA passage claims only „…tyto principy nijak nenarušuje". Nowhere does the DZ claim
exclusion.

**M7 — verdict-70: submission date contradicted by the only primary document in the cache.**
`.researchedContext` / `.citations[2]`: „Návrh podal poslanec Adam Vojtěch **12. 12. 2025**"
(`kind: "web"`, `historie.sqw`, not cached). Cached primaries: `tisk-70/266238.txt` signature
block „**V Praze dne 15.12.2025**"; `tisk-70/index.html` „**Rozesláno poslancům 15. prosince 2025
v 12:45**". A DZ signed on the 15th cannot have been filed on the 12th. Mitigation the driver must
weigh: three case-effort payloads also carry „podán 12. 12. 2025", so the corpus is internally
inconsistent and the verdict did not invent the date — but it asserts it without disclosing the
conflict, and the print outranks a derived payload.

**M8 — verdict-70 `.conflictAssessment`: a count that contradicts itself inside one clause.**
Verbatim: „byla … ověřena **jediná** vlastnická/řídící vazba **s nenulovou částkou** v registru
smluv, **a to nulová**: Patrik Pařil drží vlastnickou/řídící vazbu na RAPAJA s.r.o. **a** RMPJ
s.r.o." — „jediná" then names two (`ledger.json` `tie:7031:06386237` and `tie:7031:09187944`, both
`owner-operator`), and „s nenulovou částkou … a to nulová" is incoherent. The underlying facts are
correct; the sentence is unreadable, in the batch's most sensitive field.

**M9 — verdict-70 `.conflictAssessment`: false precedent analogy.** „Jde o mezeru v pokrytí dat
**obdobnou té, kterou u senátních předkladatelů popisují dřívější hodnocení tisků 12 a 131**".
`verdicts-017/verdict-12.json` describes a *structural* gap („pro senátory … tato datová sada …
žádné záznamy peněžních vazeb neobsahuje"). Adam Vojtěch is not a senator — he is a PSP10 person
node fully inside the money graph's population (`case-effort/payloads/batch-008-roles-triage.json`,
pspId 6491), with 0 units in `ledger.json`. The correct statement is „no registry-corroborated
company tie is recorded for him", not „cannot be confirmed nor excluded". A measured absence is
recast as an unfalsifiable data gap.

**M10 — verdict-70: asymmetric disclosure (inverse direction).** `.unstatedEffects[1]` argues the
fixed 7,879 mld is „odklon od standardního mechanismu". The DZ answers that charge @6 800 and the
verdict quotes neither the answer nor its existence: „**Nejedná se přitom o řešení, které by bylo
v systému veřejného zdravotního pojištění nové. V roce 2012 došlo naopak k přerozdělení části
zůstatků zaměstnaneckých zdravotních pojišťoven směrem k VZP ČR**…". Nor @6 166, where the DZ
itself concedes „nad rámec současných přerozdělovacích mechanismů" — the concession the verdict
presents as unaddressed.

**M11 — verdict-190 `.researchedContext`: the load-bearing exculpatory premise is unsupported as
written.** Verbatim: „**Mezi tiskem 190 a tisky 12 či 131 tedy nebylo nalezeno žádné ustanovení,
které by upravovalo tutéž otázku** zákona č. 491/2001 Sb. — přímá kolize mezi nimi nebyla
zjištěna", resting on an enumeration of what 12/131 touch („vícemandátových volebních obvodů,
hranice pro postup … a doplňovacích voleb"). Measured: **tisk 12 bod 15** (`tisk-12/265094.txt`
@9 527) reads „15. V **příloze k zákonu** se slova „ , popřípadě volební obvod" a slova
„ , popřípadě volebního obvodu" zrušují." — and that annex is (`tisk-12/265096.txt` @20 665)
„Příloha k zákonu č. 491/2001 Sb. — **Počty podpisů na peticích podle § 21 odst. 1**", precisely
the instrument tisk 190 Čl. IV bod 5 routes the autumn-2026 count through („Při určení potřebného
počtu podpisů voličů na petici…", `tisk-190/270179.txt` @7 164). The verdict never mentions the
annex or bod 15; its enumeration silently drops them. Whether this is a *legal* collision is
arguable (12's edit is a wording cleanup, not a number change, and tisk 12 is unapproved) — the
categorical negative as printed is not supported.

**M12 — verdict-78 `.conflictAssessment`: the case file's only sponsor row is never assessed.**
`batch-018-targets.json` → `targets[78].sponsors` contains **exactly one** entry, and it is not
Babiš: `{pspId: 6165, "Radek Vondráček"}`, carrying `49451871 Vodovody a kanalizace Kroměříž, a.s.
— 391 010 121 Kč`, ledger `tieClass: manager` (**attributable**). The verdict opens „Jediným
předkladatelem tisku je Andrej Babiš", analyses his 14 ties (correctly — see clean list), and
never names Vondráček. Babiš as sole signatory is text-supported („V Praze dne 12. ledna 2026 /
Ing. Andrej Babiš v. r."), so the substance is right — but the divergence is undisclosed and the
closing „V datech proto není zjištěn střet zájmů" rests on a set the data does not contain.
`verdict-153` in the same batch *does* disclose the analogous artefact („v datech je u tisku
evidován poslanec Karel Havlíček v roli garančního výboru … nikoli jako věcný předkladatel") —
inconsistent handling inside one batch.

**M13 — verdict-78: a text declared unavailable that is cached, and decisive twice.**
`.conflictAssessment`: „…tisk (č. 238) … **jeho konkrétní znění nebylo v rámci tohoto zpracování
k dispozici**, takže případnou textovou kolizi … nelze ani potvrdit, ani vyloučit."
`.data/law-collision-cache/tisk-238/277551.txt` and `277553.txt` both exist. `277551.txt` @780
carries the amendment chain „…zákona č. 279/2024 Sb. **a zákona č. 59/2026 Sb.**" — the corpus's
own corroboration of tisk 78's fate, which the verdict presents as web-only; and tisk 238 inserts
„28. srpen – Den Orla," at a different position from 78's „30. březen – Den české vlajky,"
(already present as in-force text @780 of `277553.txt`) — **no collision, determinable from the
cache**. A non-finding published where a finding was available.

**M14 — verdict-261 `.conflictAssessment`: „pouze svěřenecké vazby" is falsified by the money
reference.** Verbatim: „Petr Bendl drží **pouze svěřenecké vazby** (Vzdělávací centrum pro
veřejnou správu ČR, Energie - stavební a báňská a.s., MERO ČR, Svaz měst a obcí ČR, Povodí
Vltavy)." `ledger.json` carries **six** rows for `personPspId: 346`; the sixth is
`{"id":"tie:346:49683144","company":"PRAK spol. s r.o.","role":"člen představenstva",
"tieClass":"manager","corroboration":"conflicting"}` — an **attributable** class, i.e. the one
the attribution rule treats as the MP's own money. Five of six named, exclusivity asserted over
the one dropped. Materiality is low (0 Kč), the assertion is the defect. (`batch-018-targets.json`
disagrees with the ledger on that row's IČO — `61858111 / "PRaK, a.s. v likvidaci"` — a data
question the driver should resolve, but under either source the count is six.)

**M15 — verdict-261: drops the dated registry finding the published record already carries.**
`.conflictAssessment` cites the prior tisk-103 assessment only for the ownership point.
`payloads/verdicts-011/verdict-103.json` → `.citations[]` also records verbatim: „Petr Bendl byl
podle obchodního rejstříku členem dozorčí rady Energie - stavební a báňská a.s. **od 8. 11. 1996
do 23. 2. 2001** (historický vztah); žádný aktuální vztah rejstřík neeviduje." verdict-261 omits
that dating — the single most decisive fact about the tie — while devoting a long passage to the
*absence* of dating on the Svaz měst a obcí tie. Registry roles need dates; this one had one.

**M16 — verdict-133 `.statedReasoning`: a week-on-week figure restated as year-on-year.**
Verbatim: „k 7. 3. 2026 zpráva eviduje **meziroční** nárůst ceny nafty o 8,2 % a benzínu o 4,3 %
**v řádu jednoho týdne**". Measured over `tisk-133/268573.txt`: `mezitýdenní` → **2 hits
(@7 101, @7 220)**, `meziroč` → **0 hits**. Print: „motorová nafta: 35,47 Kč/l (**mezitýdenní**
nárůst oproti 28. únoru +2,68 Kč/l, tj. +8,2 %)". Different comparison bases, self-contradictory
in one clause, and it is the urgency premise `unstatedEffects[0]` then tests — the reader checking
the finding is handed the wrong denominator.

**M17 — verdict-153: three structural misattributions (all measured, `tisk-153/268952.txt`).**
(a) `.researchedContext` + `.citations[2]`: „Obecná část zprávy (**bod A**) sama výslovně přiznává
…„Odstraňuje se nadbytečná regulace reklamy…"" — the passage occurs once @**73 528**; section
headers `A` @60 010, `B` @67 380, **`C` @71 142**, `D` @74 058 ⇒ it sits in **bod C**.
(b) `.researchedContext`: „**Bod 27 (§ 5k odst. 1)** … doplňuje nový § 5k odst. 8" — bod 27
@22 671 = „V § 5k odstavce 1 a 2 … znějí"; **bod 29** @27 760 = „V § 5k se doplňuje odstavec 8".
`.citations[5]` says 29 — the verdict states both numbers for one instruction.
(c) `.citations[4]`: „**Bod 2 Části druhé** vkládá … § 53b … a nový § 62b" — bod 2 @56 516 inserts
§ 53b; **bod 3** @58 777 inserts § 62b.

**M18 — verdict-192 `.unstatedEffects[0].effect`: „aniž by zákon stanovil kritéria výběru" over a
statute that enumerates a closed list.** Operative text @1 298: „trvalou hodnotu danou jejich
politickým, hospodářským, právním, historickým, kulturním, vědeckým nebo informačním významem",
which the DZ characterises as an „**uzavřený výčet** jednotlivých kategorií". Coarse — arguably
too coarse, which is the defensible version — but not absent. Attached: the verdict renders that
quotation declined („trvalé hodnoty dané…") inside marks that assert verbatim, and
`.statedReasoning` describes only new letter c) where the bill inserts „nová písmena **c) a d)**"
(@1 120).

**M19 — the migration guards cannot establish what the header comment claims.**
`scripts/case-loops/law/evidence-coordinate-apply-018.ts` lines 58–67 verify: Czech gate, jargon
gate, no line reference, digits preserved, quotations preserved. Three holes, all confirmed by
running the applier's own verification block over mutated copies in scratch:

- **digit guard is a `Set`** (l. 60–63: `const afterDigits = new Set(digitsOf(p.after))`), so any
  *permutation* of existing digit tokens survives („z 21 % na 12 %" → „z 12 % na 21 %" PASSES),
  and adding digits is explicitly allowed (l. 11–12), so any amount can be **inflated**
  („na 20 000 Kč" → „na 20 000 000 Kč" PASSES) and any § renumbered to a token already present
  („§ 26 odst. 1" → „odst. 2" PASSES).
- **`refDigits` laundering** (l. 59) whitelists the *deletion anywhere* of every digit appearing
  inside a legacy line reference — 2 rows (tisk 171[0], tisk 246[1]) whitelist the token `8`,
  which also occurs in the substantive „zrušení odst. 6 až 8".
- **quotation guard truncates at the first nested closing guillemet** (l. 65,
  `/„[^“]+“/gu`); Czech legislative quotations nest, so in tisk 228[0] the connective „vkládají
  slova" belongs to no match and is freely editable („vkládají" → „vypouštějí" PASSES).
- **nothing guards against ADDITION** — `after` may assert any new claim not in `before`.

And decisively: **no guard checks that a new structural coordinate is correct**, which is exactly
how B5 passed all five.

**M20 — carried forward, not a pass-52 gate: 141/141 bill summaries still cite a local cache
path, and it renders.** `payloads/bill-summaries-cz.json` rows carry
`"source": ".data\\law-collision-cache\\tisk-4\\265051.txt"`; I observed the same string live on
the store (`bill:tisk:43236 :: summary_source = .data\law-collision-cache\tisk-107\268015.txt`),
and it is rendered at `features/lawwatch/components/BillDetail.tsx:77` via
`getLawData.ts:451`. This is the forbidden cache-path class on a reader-facing citation at 100 %
coverage. **Outside the scan's declared scope** — `batch-018-evidence-scan.json.method` says
„Every reader-facing **forensic** field", and `summary_source` is not one — so it does not block
pass 52, but it belongs in the next evidence batch.

---

## MINOR

- **m1 — verdict-107 `.conflictAssessment`: the tie class is never stated and the role is
  undated.** „Jiří Horák, **ve funkci** člena představenstva Vodovody a kanalizace Vyškov, a.s."
  — present tense, no period. Ledger: `tie:6803:49454587`, `tieClass: manager` (**attributable**,
  not steward), `corroboration: registry-confirmed`. The verdict dismisses it purely on sector
  irrelevance. The figure itself is class-safe („úhrn veřejných smluv **firmy** 124 508 316 Kč",
  exact to targets, firm-scoped — no over-attribution).
- **m2 — verdict-107: an unsourced factual assertion.** „Jde o regionální vodárenskou společnost
  **ovládanou obcemi vyškovského okresu**" carries no citation; `verdicts-016/verdict-106.json`
  sources the identical claim to `https://www.vakvyskov.cz/` (`kind: "web"`). Brand rule.
- **m3 — verdict-107 `.researchedContext`: „přiděleny témuž garančnímu výboru"** overstates
  `targets[107].committeeRouting[0].status = "navrzeno"` (org. výbor recommended; both prints are
  `stav = "1. čtení"` on the store). `.citations[2]` states it correctly („Organizační výbor
  doporučil … a určil").
- **m4 — verdict-107's psp.cz history is entirely uncorroborated offline.** Neither bill node
  carries a filing date, a rapporteur or a government-position prop (I dumped both:
  `bill:tisk:43216`, `bill:tisk:43236`). The 10. 2. 2026 filings, the 10. 3. / 31. 3. government
  positions and „Mgr. Jan Papajanovský" rest solely on `kind: "web"`. Only `Rozesláno poslancům
  3. března 2026` (107) and `13. února 2026` (106) are in the cached `index.html`, and both match.
- **m5 — verdict-70: four date claims rest solely on an uncached `kind:"web"` citation** —
  vláda 16. 12. 2025, hlasování č. 86 / usnesení č. 130 (0 hits repo-wide), Senát 6. 5. 2026,
  účinnost 27. 5. 2026. Corroborated elsewhere in the corpus: 25. 3. 2026, 19. 5. 2026,
  26. 5. 2026, zákon č. 71/2026 Sb.
- **m6 — verdict-70 `.unstatedEffects[0].effect`: interval overstated.** „bezmála **devět týdnů**
  po skončení měsíce"; 2026-03-31 → 2026-05-27 = 57 days = 8,14 weeks. `.researchedContext` gets
  it right („více než osm týdnů").
- **m7 — verdict-70: „měsíc březen 2026" is a composition, not a print string.** `v měsíci březnu`
  → 4 hits; `březen` (nominative) → 0. The reading is the only sensible one, but the verdict
  states it as the provision's own wording without disclosing the reconstruction.
- **m8 — verdict-70 `.unstatedEffects[0].evidence` cites the enacted law** („§ 21b odst. 3
  **zákona č. 71/2026 Sb.**") while only the submitted bill is cached; the whole temporal-gap
  thesis assumes verbatim enactment through committee and does not disclose the assumption.
- **m9 — verdict-231: two small label errors.** `.researchedContext` „čl. IV ruší **dvanáct
  předpisů**" vs `.citations[2]`, which correctly reads one whole law + parts of eleven; and
  „V bodě 8 **(slučitelnost s právem EU)**" — the heading @48 789 is „8. Zhodnocení, zda návrhem
  zákona není zakládána veřejná podpora" (slučitelnost s právem EU is bod 5).
- **m10 — verdict-231 `.conflictAssessment`: unverifiable organ expansion.**
  `targets[231].committeeRouting[0].organ = "VMZ"` is expanded to „Výbor pro vědu, vzdělání,
  kulturu, mládež a tělovýchovu", which nothing in the payload supports.
- **m11 — verdict-190: two imprecisions.** „ve **vícejmenných** senátních obvodech" (Senate
  constituencies are single-member); „garančním výborem **byl určen**" vs
  `committeeRouting[0].status = "navrzeno"` — the distinction verdicts 231 („navrženo") and 153
  („přikázáno") both render correctly. Also `.unstatedEffects[1]` „**jedinou větou**": the
  parenthetical @24 437 is inside a sentence and the exception is restated ~300 chars later; the
  substance holds, the count does not. Čl. II's § list omits § 76 (bod 4).
- **m12 — verdict-261: two incomplete enumerations and one inconsistent disclaimer.** Bureš named
  6 of 8 ledger ties (omitted: `02504421`, `29156271`, both steward, both 0 Kč); Marek Benda's
  steward SVJ figure („2 590 Kč", `tie:4:24227901`) is class-labelled but lacks the
  „peníze instituce" sentence that the Bendl figure in the same paragraph carries.
  `.researchedContext` also asserts „30. 7. 2026 byl přikázán Výboru pro životní prostředí se
  zpravodajem Ondřejem Babkou" while `targets[261].committeeRouting` = `[]`.
- **m13 — verdict-78 `.conflictAssessment` mis-states the project's own attribution rule.**
  „Ani vazby v řídicí funkci (**jediné**, které by … mohly představovat dosažitelné peníze
  předkladatele)…" — per `reachableMoney`/`isAttributable`, **both** `owner-operator` and `manager`
  are attributable. No CZK figure is printed anywhere in the verdict, so nothing is overstated.
- **m14 — verdict-192 `.unstatedEffects[1].effect`: an English word in reader-facing Czech.**
  „ale **part** věnovaná hospodářskému a finančnímu dopadu…" — should be „část". Passes both the
  stopword language gate and `lawJargonIssues`.
- **m15 — verdict-61 `.researchedContext`: ungrammatical clause.** „Žádné z jedenácti bodů se
  netýká jiné materie, než jakou **stanovená rozsudku** Spišák … vyžadují".
- **m16 — quotation-mark style split across the batch.** Five verdicts use ASCII `"` for quoted DZ
  text instead of the corpus's „…": **107** (16 occurrences), **190**, **261**, **70**, **78**.
  Verdicts 133/153/192/231/61 are correct. No mismatched pairs anywhere.
- **m17 — migration: 7 rows get a coordinate but no psp.cz URL** (67, 83, 89, 187, 189, 217 ctx,
  217 `.effect`). The payload's `method` states this as policy; the doctrine as written is
  „structural coordinates **plus a psp.cz URL**". Also asymmetric: tisk 171[0] links only 171 while
  comparing against 246, whereas 246[1] links both.
- **m18 — migration: `forensic_provenance.evidence_migration` is written unguarded** (l. 88); a
  bill lacking that prop would throw at write time rather than be reported in PREPARE.
- **m19 — residual line/page shapes outside the 34 rows** (live store, read-only):
  `bill:tisk:43171 :: forensic_researched_context` — „cca 39 000 **řádků** strojového přepisu"
  (the same relative-length shape batch-018 deliberately preserved and documented for tisk 64, but
  left unscanned here); `bill:tisk:43222 :: forensic_citations[0].claim` + its `_en` mirror —
  „(**t011200.pdf** s důvodovou zprávou…)", a psp.cz filename rather than a structural coordinate.
  Zero hits store-wide for `str. N` / `strana N` / `line N` / `p. N`.
- **m20 — derived artifacts written into the evidence cache.** Three `.nfc.txt` files now sit in
  `.data/law-collision-cache/` (`tisk-107/268015.nfc.txt`, `tisk-78/266724.txt.nfc.txt`,
  `tisk-78/266726.txt.nfc.txt`, all dated 2026-08-05). I verified the originals are **untouched**
  (`268015.txt` is still non-NFC; the `.nfc.txt` equals `NFC(original)` exactly), so nothing is
  corrupted — but the cache is the evidence baseline and `summary_source` props already glob into
  those directories. Normalizations belong in scratch.

---

## Verified clean — re-derived and confirmed

**verdict-107, everything except the quoted formula.** Tisk 107 čl. I bod 1 verbatim @746:
„Za § 9d se vkládá nový § 9e, který včetně nadpisu a poznámky pod čarou č. 24 zní: „§ 9e /
Nařízení obce"". Odst. 2's EK notification duty („podle čl. 15 odst. 7 směrnice o službách na
vnitřním trhu24) prostřednictvím kontaktního místa … Ministerstvo průmyslu a obchodu") ✓; Čl. II
„účinnosti dnem 1. 1. 2027" ✓. **„K § 9o" is exact**: the zvláštní část begins @14 945 and its
sole section header is at @14 960 — 15 chars later — and it is the *only* `K § 9x` header in the
document. The numbering hypothesis holds on measured offsets: tisk 106 inserts §§ 9e–9n and
carries **0** occurrences of `§ 9o`, so 9o is the next free number. Fakultativní regulace @9 117
(„Regulace je koncipována jako fakultativní, nikoliv plošná") ✓; C-724/18 Cali Apartments @11 573
✓; Golemio @4 178 ✓; korupční rizika @14 607 („S navrhovanou právní úpravou nejsou spojena
korupční rizika") ✓; rozpočtové dopady @9 879 („nemá přímé dopady na státní rozpočet" / „Dopady na
rozpočty územních samosprávných celků … pouze v omezeném rozsahu") ✓. **The absence claim is
grep-backed**: `sněmovní tisk` → 0 in tisk 107, and tisk 106's only 2 hits are to tisk 761 from
PSP9 — neither DZ mentions the other ✓.

**Money / temporal rule — no steward total is presented anywhere as an MP's money.** Every CZK
figure beside a name was class-checked against `ledger.json`. Textbook handling in verdict-70
(Mádlová + Richter, five steward ties: „jsou … svěřenecké, tedy jde o peníze instituce, nikoli o
osobní příjem předkladatele", and the 19 143 682 971 Kč / 1 452 287 949 Kč totals correctly
**withheld**), verdict-78 (all 14 Babiš ties classed 4 owner-operator / 4 manager / 6 steward,
matching the ledger name for name, no figure printed), verdict-133 (Kupka / MAS Nad Prahou
3 968 570 Kč, steward: „bylo možné přičíst nanejvýš instituci, nikoli poslanci"), and verdict-261's
Bendl / Svaz měst a obcí paragraph — the strongest in the batch: exact figure (57 751 425 Kč,
matching targets), the „rozporná" grade matching `corroboration: conflicting`, the missing dating
disclosed, and „**jsou penězi instituce, nikoli Bendlovým osobním příjmem**". **Batch-017's
4 800× steward-attribution shape does not recur.** Every stated CZK value matches
`ledger.json` / `batch-018-targets.json` to the koruna.

**Jargon gate and the verdict contract.** `lawJargonIssues` + `validateLawVerdict` (defaults, so
the Czech gate ran) over every reader-facing field of all ten verdicts — `statedReasoning`,
`researchedContext`, `conflictAssessment`, each `unstatedEffects[].effect` / `.whoBenefits` /
`.evidence`, each `citations[].claim`: **0 jargon issues, 10/10 valid**, and still valid when
re-run scoped with the batch's `knownLawRefs` (24 774) and `knownIds` (888) — no fabricated
statute reference, no unknown graph id.

**`whoBenefits` — 19/19 non-empty and signed** (127–474 chars): named classes (six insurers by
name in 70; „Výrobci a distributoři zdravotnických prostředků" in 153; „Kolektivní správci
autorských práv" in 192), explicit no-beneficiary („Nejde o prospěch žádné strany" ×2 in 107;
„Nikdo z účastníků legislativního procesu z tohoto zpoždění neprofituje" in 78), or a hedge with
a stated locus. None attributes benefit to a named individual.

**Evidence doctrine in the ten NEW verdicts — clean.** Regex
`řádek|řádk|na řádku|ř\.\s*\d|str\.\s*\d|strana|line\s*\d|\.data|\.txt|\.pdf|cache|\d{6}` over
every `unstatedEffects[].evidence` and `citations[].source`: **no transcript line reference, no
page reference, no cache path.** The only 6-digit hits are IČO digits inside `graph_fact` sources,
where the contract says urns belong.

**Quotations — 27 probes across 9 verdicts, 0 absent.** Every quoted string I or the sweep located
verbatim post-NFC, including the ones most likely to be invented: 261's „bude jejich případné
opětovné přeschválení **naprosto hladké a bezproblémové**" @6 942, inside the **zvláštní část,
K čl. II** (Zvl @6 198) exactly as the verdict places it — the apparent exact-substring miss is a
pdftotext line wrap after „jejich", not a fabrication; 153's bod-G self-disclosure @~74 650,
verbatim „…**dojde k rozvolnění, které podnikatelům může přinést konkurenční výhody**, přitom však
je zachována ochrana veřejného zájmu…", inside section G (80 124–81 161 by the sweep's measure) —
the DZ literally says „konkurenční výhody" for „podnikatelé", so the verdict's framing („jde tedy
o zprávou přiznanou, nikoli utajenou deregulaci") is **reporting, not inflating**; 231's korupční-
rizika sentence; 190's „to neplatí pro hlasovací lístky ve volbách do zastupitelstev obcí" @609
(Čl. I bod 2) and „s ohledem na jejich povahu" @24 437 (zvláštní část @24 207); 70's bod F and
bod B quotes, both inside the obecná část; 192's bod-2 § 9 odst. 2 písm. h) instruction @2 549.
The only fabricated quotation in the batch is B1's.

**verdict-261's dual-track reading is sound, not an over-reading.** Čl. I bod 2 @1 173 verbatim:
„(4) Návrh podle odstavce 3 se považuje za dohodnutý, pokud souhlas s dohodou vyjádří nadpoloviční
počet přítomných členů rady delegovaných podle odstavce 2 věty první **a zároveň** nadpoloviční
počet přítomných členů rady jmenovaných orgánem ochrany přírody podle odstavce 2 věty druhé." That
is a concurrent-majority condition on one vote, and the verdict describes it exactly so; the label
„dvoukolejné hlasování" is the **bill's own** („tzv." in the verdict, „mechanismus odděleného
(tzv. dvoukolejného) hlasování" @3 083). Its membership-count absence claim is grep-confirmed
(`počet čl` → 0, `kolik` → 0).

**verdict-190's no-collision ruling contains no cross-verdict contradiction.** Batch-017 ruled
tisky 12 ↔ 131 a collision *with each other*; verdict-190 rules 190 ↔ 12 and 190 ↔ 131, and
explicitly acknowledges the earlier finding. Different pairs. Its budget-gap effect is precisely
evidenced (bod 6 @20 638, „indiferentní" / „cca 2 milionů korun na jedny volby"), and
`targets[190].sponsors = []` makes „neeviduje žádného poslance jako předkladatele" exact. The
defect is M11's premise, not the enactment claims.

**Counts close** (spot-checked, all PASS): 231's 5 741 826 000 + 2 065 766 000 = 7 807 592 000 →
„cca 7,81 mld. Kč ročně", both components verbatim in the print, and the compact figure correctly
never quoted as a print string (`7,81` / `7 807` → 0 hits); 70's per-insurer table 1 190 + 2 138 +
1 224 + 705 + 248 + 2 374 = **7 879** mil. against „Celkem ZZP 7 879", with 7 879 000 000 verbatim
at 5 offsets, and 10 511 − 2 632 = 7 879; 78's 14 = 4 + 4 + 6 against the ledger; 61's eleven body
of čl. I counted; 133's 3,5–4,5 mld = 3,2–4,0 + 0,3–0,4; sponsor counts of 4 / 7 / 8 / 10 all
matching targets name for name.

**Absence claims — 20 tested by grep, 17 clean.** Confirmed: 192's `metodik` → 0, `přezkum` → 0,
`diskre|uvážen` → 0; 133's deferral mechanism (`kolize|souběžn|paraleln` → 0); 107's mutual
non-mention; 261's membership count; 70's „neobsahuje žádné přechodné ustanovení" (`přechodn` → 0
in `266238.txt`); 78's Senate-return non-mention; 61's § 89j korektiv; 190's uncosted difference;
231's Česká pošta figure. Falsified: B4 (192), M3 (231). Over-reaching but salvageable: 133's „na
riziko zpoždění **vůbec neupozorňuje**" — the DZ does say „**Každý týden prodlení** představuje
prodloužení doby…" @16 565, as an argument *for* urgency; narrow the wording, keep the effect.

**Unicode hygiene — clean.** Recursive scan of every string value in all ten verdict JSONs:
**0 non-NFC codepoints, 0 Cyrillic/Greek homoglyphs, 0 U+200B/U+00A0/U+2060/U+00AD/U+200E-F
invisibles, 0 mismatched „…" pairs.** (m16 is a style split between „…" and ASCII `"`, not a broken
pair.) The Czech language gate rejects nothing.

**Migration — the parts that hold.** I ran the applier myself in PREPARE (no `--commit`,
`--pass` or `--ref`): `34 field rewrites across 20 bills verified (0 skipped rows). / PREPARE only`
— which also proves every `before` is byte-identical to the live prop (lines 81/84 would throw).
**No row still carries a navigational line/cache reference in `after`**: the regex sweep returns
2 hits, both in tisk 64's documented relative-length exception („= 3 501 **řádků** novelizačního
textu", „(zákon o auditorech, 591 **řádků**)"), against 66 hits in `before`; zero `.txt` / `.pdf` /
`.data` / `cache` / `str.` / `line N` anywhere. All 27 appended URLs are well-formed with `o=10`
and `ct` matching the row. Seven of the eight spot-checked rows land exactly where claimed —
**162** (Čl. II bod 2 @12 684 and Čl. I bod 11 @10 591), **201** (Čl. I bod 9 @2 877, quote
character-for-character), **64** (ČÁST DVACÁTÁ TŘETÍ / `Čl. XXIII` @48 919, and its relative-length
exception is honest: I re-derived all 151 ČÁST spans — 3 501 lines vs 591 lines, exactly as
claimed, and the note says in its own words that it measures the machine transcript), **189**
(the source-mislabel correction is right: the passages at lines 1 723/1 729 were labelled
*zvláštní část* when the „II. Zvláštní část" heading is at line 4 001 — they sit in kapitola 2 of
the *obecná* část, and the rewrite drops the false label instead of propagating it), **25**, **46**,
**228**. Only tisk 83 is wrong.

**Severity across the batch is otherwise consistent.** 1 high / 3 medium / 6 low, against 017's
4 medium / 6 low and 016's 2 medium / 8 low. The three mediums are mutually comparable and each
earns it: **70** (a 7,879 mld. Kč transfer pinned to a month that had passed weeks before the law
took effect, no transitional rule), **231** (a 7,81 mld. Kč mandatory outlay decoupled from the
oversight the government's own programme pairs it with), **261** (a transitional clause that can
retroactively unmake approved park documents). The six lows are drafting-quality or disclosure-gap
findings with no quantified harm. 192's `confidence: 3` — the batch's lowest — is the one verdict
carrying a falsified premise, so it is at least directionally honest. **The only miscalibration is
verdict-107 (M1).**

---

## Required before closure

1. **B1** — restate verdict-107's collision from what tisk 106 actually says (bod 22 inserts the
   Díl 2 designation after § 9d; bod 23 inserts § 9e after that heading; bod 24 re-enacts it). The
   collision survives; the quoted formula does not.
2. **B2** — delete or invert `verdict-231.citations[5]`'s cross-reference and reconcile it with
   `verdicts-017/verdict-47.json`.
3. **B3** — verdict-70's conflictAssessment must disclose Mašek's dated VZP dozorčí-rada seat and
   his chairmanship of the garanční výbor, and scope the „no VZP tie" sentence to money ties.
4. **B4** — scope verdict-192's absence claim to the statute and state what the zvláštní část
   actually says.
5. **B5** — correct the tisk-83 row to `Čl. V bod 4, § 39a odst. 6 zákona č. 13/1997 Sb.,
   o pozemních komunikacích`, re-verify, and re-run PREPARE. **Do not apply pass 52 until then.**
6. **M1** — `verdict-107.severity` → `medium`.
7. **M19** — before the next evidence batch is authored under this harness: make the digit guard
   a multiset, forbid unexplained digit *additions* in numeric contexts, fix the quotation regex
   for nested guillemets, and add a coordinate-verification step (a rewrite must be checked against
   the cached text, not merely against `before`).


---

# CLOSURE CHECK — 2026-08-05, same auditor

Re-verified against the **actual file state**, not the remediation summary. Every claim below was
re-derived from the prints (NFC-normalized, U+200B stripped), from `ledger.json`, or by running the
code myself.

## ✅ CLOSED

### The five BLOCKING defects

**B1 — verdict-107 `researchedContext` · FIXED.** No shared-formula claim survives (`naprosto
stejnou` → 0 occurrences). 107's instruction is quoted verbatim and is verbatim in the print
(„Za § 9d se vkládá nový § 9e“, tisk-107 @746); 106's path is now described as bod 22 (Díl 2
označení a nadpis after § 9d) → bod 23 („za označení a nadpis dílu 2“ — verbatim @6 785) → bod 24
(„§ 9e zní“ @7 274), each matching the cache. The conclusion is restated as the measured fact:
„Výsledkem obou cest je nové ustanovení § 9e na témže místě téhož zákona se dvěma neslučitelnými
obsahy.“

**B2 — verdict-231 `citations[5]` · FIXED.** Now „…jeho zvláštní část odkazuje na navazující změnu
zákona č. 166/1993 Sb., o Nejvyšším kontrolním úřadu, **kterou ale sama nejmenuje žádným číslem
tisku**.“ Re-measured in `tisk-47/265737.txt`: `\b217\b` → **0**, `tisk` → **0** ✓. Direction stated
in `unstatedEffects[0]`: „tisk 47 sám žádné číslo tisku nejmenuje — odkaz vede jen jedním směrem“,
matching `tisk-217/271419.txt` @2 429 („senátní tisk č. 47“) and reconciling with the published
`verdicts-017/verdict-47.json` („kterou ale sama nejmenuje“).

**B3 — verdict-70 `conflictAssessment` · FIXED, and well.** The clearance is explicitly scoped:
„**V PENĚŽNÍCH datech (smlouvy firem, které poslanec vlastní nebo řídí)** tedy není evidována žádná
vazba na VZP ČR…“. Mašek is disclosed with the facts I measured: „spolupředkladatel Jiří Mašek je
předsedou Výboru pro zdravotnictví - garančního výboru, jemuž byl tisk přikázán 28. 1. 2026 - a od
28. 1. 2026 je zároveň voleným členem dozorčí rady VZP ČR, tedy orgánu pojišťovny, jíž tato novela
snižuje měsíční platbu o 7 879 000 000 Kč“, closing „souběh … je však okolnost, kterou by hodnocení
střetu zájmů u tohoto tisku zamlčet nesmělo.“ Accurate to
`case-effort/payloads/batch-002-group-B.json` (`psp:person:6534`), correctly framed as a public
oversight role rather than personal gain, and not softened away. No sentence anywhere still denies a
VZP tie categorically.

**B4 — verdict-192 · FIXED.** The absence claim is scoped to the statute („Samotný text zákona
vymezuje výběr jen tímto uzavřeným výčtem kategorií hodnoty a neobsahuje schvalovací ani přezkumný
mechanismus“), and the zvláštní část is now quoted for what it actually says — „jaké webové stránky
budou harvestovány, tedy určí primárně Národní knihovna“ and „je neprakticke tato kritéria určovat
zákonem“ (both verbatim @106 022), plus the collection policy and its three sklizeň types.
`unstatedEffects[0]` is aligned and lands on the defensible finding (no published methodology, no
review mechanism, delegation admitted by the DZ). M18 folded in: the quotation is
nominative-verbatim („trvalou hodnotu danou jejich politickým, hospodářským, právním, historickým,
kulturním, vědeckým nebo informačním významem“, operative text @1 298) and „písmenem d)“ is stated.

**B5 — migration tisk 83 · FIXED.** The row now reads „(**ČÁST PÁTÁ, Čl. V bod 4 — § 39a odst. 6
zákona č. 13/1997 Sb., o pozemních komunikacích**)“, exactly matching my measurement (passage
l. 420; `Čl. V` l. 370; `ČÁST PÁTÁ` l. 367). A `note` records the correction and names the error.

### The MAJOR set

M1 `severity: medium` ✓ (gate output confirms; the corpus now carries **no** `high`). M2 states the
measured §§ 9e–9n, names the archived 9e–9m and says this measurement corrects it ✓. M3–M6 (231)
all fixed — the NKÚ sentence is now „mimo tuto jedinou zmínku … kontrolní závazek nijak nerozvádí“,
true against my counts (`NKÚ` → 0, `Nejvyšš\w*\s+kontroln\w*` → 1 @13 829); „přímo v zákoně“
attributed to the zvláštní část; the quotation restored to the conditional („mohlo zvyšovat riziko“
present, „může zvyšovat riziko“ → **0 occurrences anywhere in the verdict**). M7–M10 (70) fixed —
both dates disclosed in `researchedContext` and `citations[2]` with the print outranking the web
source, „dvě vlastnické/řídící vazby, obě s nulovým úhrnem“, the senate analogy replaced by
„změřená absence záznamu, nikoli mezera v pokrytí dat“, and the DZ's own concession plus the 2012
precedent carried. M11 (190), M12–M13 (78: Vondráček disclosed and assessed — manager class,
391 010 121 Kč as the **firm's** total, no nexus, pending review; the tisk-238 comparison done from
the cache incl. the 59/2026 Sb. corroboration), M14–M15 (261: six ties incl. PRAK as manager class,
the targets-vs-ledger IČO discrepancy disclosed **and left undecided**, the dated 1996–2001 Energie
registry finding restored), M16 (133), M17 (153) — all verified fixed. m6–m18 verified.

### Mechanical re-verification (my own runs)

| check | result |
|---|---|
| `gate-verdicts-011.ts --batch=018` | **10/10 pass**, 4 medium / 6 low, no high |
| applier PREPARE, real payload | **36 field rewrites across 21 bills verified (0 skipped)**, no write |
| `npm run check` | **exit 0** — 149 test files, **1712 tests passed** |
| line/page/cache refs in `after` (36 rows) | **63 → 0** |
| line/page/cache refs in the 10 verdicts' `evidence` + `citations[].source` | **0** |
| `whoBenefits` non-empty | **18/18** |
| ASCII `"` in reader-facing fields (m16) | **0** (was 40+ across five verdicts); all „…“ pairs balanced |
| non-NFC codepoints · invisibles · Cyrillic/Greek homoglyphs | **0 · 0 · 0** |
| `.nfc.txt` artifacts in the cache (m20) | **0**; originals intact (`tisk-107/268015.txt` still non-NFC, 22 856 chars) |
| substantive prose added by the migration | **none** — I diffed all 36 rows; the two suspicious tisk-187 sentences are present verbatim in `before` |

### Guard mutation battery (my own probes, real guard code, isolated payload copies)

| probe | result |
|---|---|
| inflation (`100 000 Kč` → `100 000 000 Kč`) | **THROWS** — DIGIT GUARD, „000“ added outside coordinate/URL context |
| figure deletion (a 3-digit token → prose) | **THROWS** — DIGIT GUARD, „501“ removed outside a line/cache reference |
| renumber to an existing article (`Čl. V bod 4` → `Čl. II bod 4`) | **THROWS** — COORDINATE GUARD, § 39a not inside Čl. II — **this is B5 caught by construction** |
| false coordinate (`ČÁST DEVATENÁCTÁ, Čl. XIX`) | **THROWS** — coordinate not found in the cached print |
| in-quotation edit (a word inside a **nested** guillemet span) | **THROWS** — quotation lost (depth tracking works) |
| benign control (whitespace) | **PASSES** — no false positive |

## Surviving items (none blocking)

1. **MINOR — a digit PERMUTATION still passes.** Demonstrated on the tisk-83 row: swapping the two
   tokens `83` and `2023` yields „úplného textu tisku **2023** na psp.cz“ and „směrnice **83**/2661“,
   and the applier reports `1 field rewrites … verified`. A multiset is order-invariant by
   construction, so this is inherent to the chosen guard rather than an oversight — and it cannot
   arise from this migration's mechanical shape (replace a line reference, append a coordinate and a
   URL; nothing reorders text). The payload was independently coordinate-checked row by row. Worth a
   position-aware check whenever this harness is reused for a rewriting (rather than appending) pass.
2. **MINOR — additions remain unguardable by design.** My `added_claim` probe (a fabricated sentence
   appended with no digits and no quotations) passes every guard. It must: the migration's own
   operation is additive. Mitigated for this payload by the full-diff scan above (0 substantive
   additions). The control is review, and it has to stay review.
3. **MINOR — a gate-name footgun for the next operator.** `gate-verdicts.ts` accepts **no** `--batch=`
   flag (its `DIR` is hardcoded to the stale English `payloads/verdicts/`); invoked as
   `gate-verdicts.ts --batch=018` it silently ignores the flag and reports **0/27**. The correct
   command is `gate-verdicts-011.ts --batch=018` (parameterized since batch 012), which I ran: 10/10.
   Nothing is wrong with this batch's artifacts — worth a line in the batch report so the next
   session does not chase a phantom failure.
4. **MINOR (new, introduced by the remediation) — two scare-quote artefacts in verdict-231.**
   (a) `unstatedEffects[1].effect` contrasts „rozdíl mezi „zákonnou“ a „ústavní“ garancí stability“;
   `zákonnou` (accusative) occurs **0 times** in any of the five relevant cached texts (the print
   carries `zákonná` / `zákonných`). It is an intra-verdict scare quote, not an evidentiary
   quotation, and asserts nothing about the print — but under the letter of the verbatim rule a
   quoted string should be locatable. Drop the marks or use the nominative. (b) `NKÚ` as an
   abbreviation appears **0 times** in tisky 231/47/217; the verdict defines it and then uses it as
   its own shorthand, including when describing tisk 47's content. Not a false claim — but on the
   same page as the M3 finding it invites the reader to think the prints use it.
5. **Carried forward as previously scoped — M20**, the 141/141 bill-summary cache paths rendering at
   `BillDetail.tsx:77`. Outside this batch's declared migration scope
   (`batch-018-evidence-scan.json.method` binds *forensic* fields); first item of the next evidence
   batch. Also still open: `bill:tisk:43171 forensic_researched_context` („cca 39 000 řádků
   strojového přepisu“, the documented relative-length shape). The `t011200.pdf` pair is now **fixed**
   as rows 35–36 of the payload.

## CLOSURE: CLOSED

Pass 52 is cleared to write: the 10 verdicts and the 36-row / 21-bill migration payload.


---

## CLOSURE AMENDMENT — evidence that landed after the ruling above

A final re-derivation pass over the six verdicts I had spot-checked rather than fully re-measured
returned items my closure list did not carry. I verified every one of them myself before amending;
the ruling stands, with **one pre-write condition** added.

### MAJOR (new, introduced by the remediation) — verdict-190 `citations[3].claim`

The M11 fix corrected the prose and stopped there. Measured in `batch-018-targets.json`:
`targets[190].committeeRouting[0] = {organ: "ÚPV", role: "garancni", status: "navrzeno",
assignedOn: "2026-05-27"}`. The verdict now says **both**:

- `researchedContext` — „garančním výborem byl 27. 5. 2026 **navržen** Ústavně právní výbor“ ✓
- `citations[3].claim` — „garančním výborem byl **určen** Ústavně právní výbor“ ✗

One verdict, two verbs, on the same fact. Graded MAJOR rather than MINOR precisely because the shape
is the one I called blocking in B1 — a field contradicting its own citation — even though what is
misstated here is a procedural status verb, not the content of a source. It is a one-word edit
requiring no re-derivation, and it should be made before the write: a published record must not
contradict itself on a field the remediation just touched.

### MINOR (verified, not gating)

1. **verdict-133 `researchedContext` + `citations[4]`** — „Organizační výbor … **určil** garančním
   výborem Rozpočtový výbor“ against `targets[133].committeeRouting[0].status = "navrzeno"`.
   **Uniform**, so unlike (MAJOR) it does not contradict itself — the same class I graded MINOR in
   round 1 as m3 (tisk 107) and m11 (tisk 190), and graded identically here. Untouched by this round.
   Note the mitigation that applies to both: verdict-190 asserts the bill was enacted (zákon
   č. 108/2026 Sb., 25. 6. 2026), which would mean the committee WAS assigned and the store's
   `navrzeno` is a stale snapshot — which is why the honest defect is the inconsistency, not
   necessarily the fact.
2. **verdict-153 `statedReasoning`** — „poznatky z praxe“ quoted in guillemets; the print reads
   „na základě **poznatků** z praxe“ @**70496** and `poznatky z praxe` → **0 hits**. Declension altered
   inside quotation marks — the inverse of the B4(c) defect just corrected on 192. MINOR rather than
   MAJOR: a two-word noun phrase adapted to the surrounding syntax, with no claim resting on it
   (contrast M5's může/mohlo, which flipped a conditional into an admission). Pre-existing, not
   introduced by the remediation, and missed by round 1.
3. **verdict-261 `conflictAssessment`** — „PRAK spol. s r.o. … s nulovým úhrnem veřejných smluv“.
   Measured: `ledger.json` carries **no CZK field on any unit**, so the 0 Kč can only come from
   `targets`, where it belongs to **IČO 61858111 / „PRaK, a.s. v likvidaci“** — the other side of the
   identification the verdict expressly declines to decide. Materially harmless (0 Kč is the most
   conservative possible value and nothing in the ledger contradicts it), logically inconsistent.
4. **verdict-78 `conflictAssessment`** — Vondráček carries **3** ledger ties
   (`49451871` manager, `26232987` NEXNET steward, `29186315` MAE invest steward); only the manager
   tie is named. „s jedinou vazbou řídícího typu“ is literally true, but verdict-70 and verdict-261 in
   this same batch both enumerate steward ties by name — an internal consistency gap, not a false
   statement.
5. **verdict-190 `unstatedEffects[0].whoBenefits`** — „vyčísleno na korunu přesně“ against a print that
   says „**cca** 2 milionů korun … (výše může být proměnlivá…)“. Unsupported rhetorical contrast.
6. **verdict-153 `conflictAssessment`** expands „VZ“ → „Výbor pro zdravotnictví“ — the
   shorthand-expansion pattern 192 and 231 were corrected away from this round (m10). Here the
   expansion happens to be right; the inconsistency is the point.
7. **Cosmetic (192, 133)** — sentence-initial capitals lowered inside quotation marks („je
   nepraktické…“ for „**J**e…“ @106002; „každý týden prodlení“ for „**K**aždý…“ @16553). Standard
   mid-sentence integration; noted for completeness, not for action.

### What did NOT change

None of the new items touches a gating class: no fabricated quotation, no fabricated citation, no
falsified clearance, no unsupported absence claim, no steward money attributed to an MP, no false
coordinate. The five BLOCKING remediations I verified personally against the prints all hold, and
the migration payload is untouched by any of this.

## CLOSURE: CLOSED — conditional on one pre-write edit

Pass 52 is cleared to write once `verdict-190.citations[3].claim` reads „navržen“ in place of
„určen“, matching the verdict's own corrected prose and the store's `navrzeno`. That edit needs no
re-derivation and no re-audit. Everything else on the list above is a next-batch item.
