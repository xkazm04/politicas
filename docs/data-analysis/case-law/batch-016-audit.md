# batch-016 closure audit — adversarial, independent

**VERDICT: NOT READY.** Do not run the pass-50 write.

**10 BLOCKING · 17 MAJOR · 17 MINOR.** The four MEDIUM verdicts carry the worst of it: **three
of the four rest their `medium` severity on "the důvodová zpráva never mentions this"
claims that the důvodová zpráva demonstrably does mention** — verified line-by-line against
the cached texts, not from memory. One of them (162) additionally asserts a harm the bill's
own scheme excludes. Separately, `evidence` is split across two incompatible contracts inside
one batch, and the render path silently drops one of them, so three of the four MEDIUM
verdicts would publish their effects with **no source attribution at all**.

The batch also **re-introduces the exact pipeline-jargon class its own P3 sweep is removing
from the old 27** — in 5 of the 10 new verdicts.

The batch's novel artifact, the amended-§ census, is arithmetically clean and uncorrupted but
its **cross-check points the wrong way**: on the ten bills of this batch the graph is right in
**9 of 9** disagreements, and across the corpus **≥68 % of the 87 "graph-only" refs are
extractor blindness**, not graph defects. **0 of its 8 text-only leads survive verification**
(3 are the literal string `"unknown"`). Acting on those leads would write false `amends` edges.

**What is clean and should ship:** the P3 jargon sweep (all 5 rewrites verified — digits,
meaning, grammar, gates), verdict 228 (one honest correction away), verdict 186's honest RUD
negative and 88's data-gap flag as *forms*, verdict 125's ownership work, verdict 75's
disclosure that its ownership-class input is missing, and the census's own hygiene.

Method: every verdict read against its cached `tisk-<n>/*.txt` (NFC + whitespace-normalized);
every `„…"` span and every `evidence` string tested for locatability programmatically; every
sponsor tie reconciled against `batch-016-targets.json`; every cross-batch corroboration
re-derived from the payload it cites rather than accepted. Where I could not substantiate a
suspicion I say so.

---

## BLOCKING

### B1 — `verdicts-016/verdict-162.json` › `unstatedEffects[1]` · a harm the bill excludes, and a "never mentioned" that is mentioned at length

The effect asserts:

> "Zvláštní část i obecná část důvodové zprávy … **nezmiňují, že bezprostředním důsledkem
> nezaplacení je zastavení řízení** — tedy že **žalobce bez prostředků na zálohu ztrácí
> přístup k soudu** … bez ohledu na důvodnost nároku."

Both halves are false against `tisk-162/269165.txt`:

1. The zvláštní část discusses the consequence repeatedly and justifies it —
   line 1817: *"V případě, že nespolupracujícím účastníkem je žalobce, soud řízení zastaví."*;
   line 1823: *"Pro žalobce se jeví jako nejvhodnější následek zastavení řízení…"*;
   line 1856: *"zálohu nezaplatí navrhovatel, riskuje tím zastavení řízení…"*.
   The bill text itself closes §141 odst. 2 with *"O následku nesložení zálohy musí být
   účastník poučen."* (line 120–121) — the verdict's own `evidence` quote is the sentence
   immediately before it.
2. The indigent-plaintiff harm is excluded by the scheme. Obecná část, lines 895–897:
   *"Pro případy osob, které by neměly na složení zálohy finanční prostředky, navrhovaná
   úprava … **vylučuje složení zálohy** tehdy, kdy je účastník osvobozen od placení zálohy
   jako součásti práva na osvobození od soudních poplatků … **Zálohu v takovém případě
   platí stát.**"*

An "unstated effect" whose central harm the source expressly forecloses is not a lead; it is
a false accusation about a named ministry's bill.

**And the bill uses this exact pattern twice, saying so both times.** New § 198 odst. 3
(line 150-155) closes identically: *"Nesloží-li žalobce jistotu, soud řízení zastaví; **o tom
musí být žalobce poučen.**"* The verdict's "nezmiňují" premise is not a close call.

**Missed forensic finding, same bill.** Čl. II bod 2 (line 224) reads *"Povinnost složit
jistotu podle **§ 198 odst. 2**"* — but jistota is in **§ 198 odst. 3**; odst. 2 is the
representation-by-a-legal-person rule, and čl. I bod 11 (line 176) cites odst. 3 correctly.
A government bill's přechodné ustanovení pointing at the wrong odstavec of the provision it
governs is precisely the class of finding this loop exists to surface. Verdict 162 spent both
effect slots on claims that are false and did not see it.

### B2 — `verdict-88.json` › `researchedContext` + `conflictAssessment` · contradicts the corpus's own twice-published confirmed collision

The verdict says of the 88↔85 identity on § 21 odst. 2 písm. e) of 108/2006:

> "jde o fakt sdíleného legislativního rodokmenu dvou návrhů, **nikoli o věcnou kolizi**,
> protože obě novelizace míří na totéž písmeno e) odstavce 2 **stejnou úpravou**."

`payloads/collision-close-reads-batch009.json` › `pairs["85-88"]` classifies this exact pair
on this exact provision as **`confirmed-collision`**, with the reasoning the verdict's own
sentence contradicts:

> "Oba tisky vydávají k § 21 odst. 2 písm. e) … doslova totožný pokyn … Bude-li přijat
> kterýkoli z nich jako druhý, jeho pokyn míří na část věty, kterou ten první už odstranil,
> takže je při nabytí účinnosti **neproveditelný**."

Re-confirmed in `collision-close-reads-batch014-gB.json` (`"potvrzuje se tím dřívější nález
o byte-identické kolizi 85×88"`) and in `batch-014.md` § P3, which fixed the rubric
corpus-wide: *"same-§ genuine instructions on both sides ⇒ at least coordination-risk."*
The verdict inverts the rubric — it grants the **different-odstavec** pair (125) coordination
risk while denying the **identical-instruction** pair (85) any collision status at all.

Compounding: `collision-close-reads-batch004.json` records a **second** confirmed 85×88
collision — both bills inserting a differently-worded `bod 12` into § 7 odst. 2 písm. h) of
110/2006. Verdict 88 describes that very instruction (*"Čl. III vkládá do § 7 odst. 2 písm. h)
… nový bod 12"*) and never mentions the collision.

The byte-identity claim itself is CORRECT (verified: `tisk-88/267095.txt:54-56` vs
`tisk-85/266984.txt:27-29`, identical instruction and identical preceding novela enumeration).
It is the legal consequence the verdict gets wrong, in the direction of understating.

### B3 — `verdict-46.json` › `unstatedEffects[1]` · "the DZ nowhere discusses this" is false

> "Zvláštní ani obecná část důvodové zprávy tuto změnu určující autority **nijak nerozebírá**
> a řadí ji mezi prostá terminologická přizpůsobení digitalizaci justiční spolupráce."

`tisk-46/265675.txt:1290-1301` is a dedicated zvláštní-část entry **"K bodu 3 (§ 65a odst. 1)"**
whose entire content is that change and its rationale:

> "Vzhledem k tomu, že v návaznosti na občas probíhající reorganizace Policie České republiky
> dochází ke změnám útvaru … a na tyto změny je třeba pružně reagovat, navrhuje se nově
> vymezit příslušný útvar … jako útvar, který je výkonem této agendy pověřený policejním
> prezidentem. Tímto útvarem je aktuálně Národní centrála proti terorismu, extremismu
> a kybernetické kriminalitě SKPV…"

The mechanism the verdict describes is accurate; the "unstated" premise that makes it an
unstated effect is not.

### B4 — `verdict-214.json` › `unstatedEffects[0]` · self-contradicting, and the DZ states it

The effect claims the DZ presents the shift *"aniž by zmínila, že nový mechanismus je …
dostupným pouze samotnému stíhanému zákonodárci"*. The verdict's OWN `researchedContext`
says the opposite four sentences earlier: *"Zvláštní část důvodové zprávy k tomuto ustanovení
**potvrzuje**, že jde o žádost podávanou stíhaným zákonodárcem jeho vlastní komoře."*

The DZ is explicit (`tisk-214/271359.txt`, "K novému odstavci 3"):
> "Pokud však zákonodárce nabude dojmu, že stíhání je účelové a má mu bránit ve výkonu
> mandátu, **může podat komoře odůvodněnou žádost** o vyloučení stíhání po dobu mandátu."

Re-derivation of the mechanics themselves: **CORRECT.** New čl. 27 odst. 3 does remove
chamber-consent-to-prosecute (*"K trestnímu stíhání … se nevyžaduje souhlas komory"*) and
does add the opt-in shield on the prosecuted member's reasoned request; odst. 4 preserves the
zadržení/vazba regime; the přestupky immunity is repealed (confirmed by the DZ's
*"K vypuštění původního odstavce 3"*). The bill is described correctly. The *effect* is not
unstated.

### B5 — the `evidence` contract is split inside one batch, and the render path drops half of it

`ARMY-CONTRACT.md`: *"`evidence` MUST be a source string that ALSO appears in your
`citations` list."*

- **URL form (contract-compliant):** 106, 113, 125, 186, 214, 75, 88 — 12 effects.
- **Verbatim-quote form (non-compliant):** **228, 46, 162** — 6 effects. None of those six
  strings appears in the verdict's `citations`.

`validateLawVerdict` does not enforce the rule (`law-verdict.ts` only requires a non-empty
string), so `gate-verdicts-011.ts --batch=016` passes **10/10** and sees none of this.

The consequence is not cosmetic. `features/lawwatch/components/BillDetail.tsx:489`:

```tsx
{/^https?:\/\//.test(u.evidence) && ( <a href={u.evidence} …> )}
```

A non-URL `evidence` renders **nothing** — no quote, no link. So the six effects carrying the
batch's *best* evidence (verbatim statutory text, all six verified locatable in the cached
texts) publish on `/zakony` with zero source attribution, while the twelve weaker ones get a
citation chip. That is a direct brand-rule violation, and it lands on three of the four
MEDIUM verdicts.

Either the gate must enforce the contract, or the contract and the renderer must be changed
to carry verbatim quotes — but not one verdict in each register.

### B6 — three of the four MEDIUM severities are not earned on the evidence as written

`severity` orders `/zakony` and drives the review queue.

| tisk | effects | status after re-derivation |
|---|---|---|
| 228 | 2 | **medium survives** on effect[0] — the DPIA genuinely never considers police access (verified: DPIA section from line 1601 contains no police mention; the only two are the amending instruction at 428 and a one-sentence zvláštní část at 3307). Strike the unsupported "automatizovaně" (M3). |
| 46 | 2 | effect[1] falsified (B3); effect[0]'s premise mischaracterizes the zvláštní část (M2). **Not earned.** |
| 162 | 2 | effect[1] falsified (B1); effect[0] falsified (M10). **Not earned.** |
| 214 | 2 | effect[0] falsified (B4); effect[1] thin and partly answered by the DZ (*"Podmínkou … je striktní ústavní kritérium"*). Conflict dimension absent by the verdict's own conclusion. **Not earned — this is a `low` with an honest-negative conflict finding.** |

Answering the brief's question directly: **no, `medium` is not earned on tisk 214.** A
constitutional-procedure bill with no conflict dimension, whose one surviving observation is
"the criterion is generally worded", is the loop's textbook `low`.

### B7 — the batch re-introduces the pipeline-jargon class its own P3 sweep is removing

P3 rewrites 5 strings on the old 27 to strip pipeline tokens from reader-facing prose. The
**new** verdicts put them back, in forms the gate's regexes do not cover:

| verdict | field | token | count |
|---|---|---|---|
| 106 | `conflictAssessment`, `citations[5].claim` | `pspId` | 8 |
| 125 | `conflictAssessment`, `citations[5-8].claim` | `pspId` | 7 |
| 88 | `conflictAssessment` | „v tomto **dávkovém** přehledu" | 1 |
| 186 | `researchedContext` | „pořadí **v dávce**" | 1 |
| 75 | `conflictAssessment` | „tento **payload**", „v tomto **payloadu**" | 2 |
| 75 | `conflictAssessment` | „**steward** role", „(**owner/manager/steward**)" | 2 |

`LAW_PIPELINE_JARGON` catches `psp:person:N` (urn form) but not the bare prop name `pspId`;
it catches `dávk\p{L}*\s+0\d{2}` and `dávkov\p{L}*\s+scan` but not „dávkovém přehledu" or
„v dávce"; it has no entry for `payload` or for the /penize tie-class vocabulary. `payload`
and `steward` are also **English** tokens that `czechGateErrors` passed.

This is B-grade because the whole point of P3 is that *"prose rules do not survive the next
army; only code does"* (`law-verdict.ts` comment) — and the next army has just proved it
again, in the same batch.

I re-ran the **render-time** gate (`czechCopyOrNull` + `lawJargonIssues`, the pair
`features/lawwatch/getLawData.ts` applies) over every reader-facing field of all ten verdicts:
**zero withholdings, zero issues.** So every token in the table above would publish to
`/zakony` as-is. The sweep is cleaning strings the render gate already catches while the new
batch ships strings it does not.

---

## MAJOR

**M1 — `verdict-162.json`: „položka 14" is wrong, four times.**
The bill (`tisk-162/269165.txt:231-239`): *"V příloze **položce 22** … se za bod 13 vkládá
nový **bod 14**"*, followed by *"Dosavadní body 14 a 15 se označují jako body 15 a 16."*
The verdict says "nová položka 14" in `researchedContext`, `unstatedEffects[0].effect`,
`citations[1].claim` and `citations[6].claim`. Položka 22 is the odvolání item; „položka 14"
points a reader at a different, existing item. The relettering cascade (bodů 14/15 → 15/16)
is not mentioned at all.

**M2 — `verdict-46.json` `researchedContext`: the bank-secrecy power is attributed to the police.**
Verdict: *"může příslušný orgán — u evropského uchovávacího příkazu **útvar Policie** —
požadovat i údaje kryté bankovním tajemstvím"*.
§ 395f odst. 3 (`265675.txt:358-361`): *"Orgán uvedený v odstavci 1 a v případě, **že jím je
útvar Policie, justiční orgán uvedený v § 395b odst. 2 na návrh útvaru Policie**, může
požadovat údaje, které jsou předmětem bankovního tajemství…"* — where the competent organ is
the police unit, the request runs through the judicial organ on the unit's motion. The verdict
also contradicts itself: its closing sentence says *"vlastní zajištění dat policií bez soudní
kontroly z textu nevyplývá."*
The two numbers themselves are **CORRECT and verbatim**: `2 %` of global annual turnover
(odst. 5, line 366) and `10 000 000 Kč` where turnover cannot be established (line 370), and
the purpose-limitation (*"nelze využít pro jiný účel než pro uložení pořádkové pokuty"*) is
reported accurately.

**M3 — `verdict-228.json`: "automatizovaně" is unsupported.**
`unstatedEffects[0]` and `statedReasoning` say the police may *"**automatizovaně** žádat
poskytnutí informací"*. Neither the amending instruction (`277290.txt:428-431`) nor the
zvláštní část says so — the latter reads, in full: *"Do výčtu evidencí, u kterých může policie
žádat o poskytnutí informací, se doplňují registry ve vzdělávání."* (line 3307). No text of
§ 66 odst. 2 in its current wording is in the cached corpus, so nothing in the batch supports
the qualifier. Strike it; the effect stands without it.

**M4 — `verdict-106.json` `unstatedEffects[1]`: a fabricated range, and a claim its own source denies.**
Verdict: *"odhadovaným **2 831 až 4 121 provozovatelům** … mezi nimiž důvodová zpráva
**výslovně počítá i s poskytovateli v rámci „kolaborativní ekonomiky"**"*.
Source (`tisk-106/267576.txt:1738-1743`): 4 121 is a count of **IUZ (facilities)** from a
2012–2013 survey; 2 831 is a count of **provozovatelů** who applied for a 2021 COVID subsidy
— *"(**bez** poskytovatelů ubytování v rámci sdíleného ubytování, kteří nebyli zahrnuti mezi
oprávněné žadatele)"*. Two different units, two different vintages, presented as one range of
operators; and the shared-economy inclusion is the exact thing the cited parenthetical
excludes. All other 106 figures verified correct: 56 obcí at 38–50 Kč (line 1610), 397 mil. Kč
in 2021 (1632), 216–792 mil. Kč (1947), § 3d 50 Kč → 100 Kč (789).

**M5 — `verdict-113.json`: "deseti orgánům" — there are eleven.**
`§ 5 odst. 1` (`tisk-113/267651.txt:86-97`) lists a) ČOI, b) ČBÚ, c) MD, d) Drážní úřad,
e) SZPI, f) MŽP, g) ÚSKVBL, h) SÚKL, i) ÚKZÚZ, j) KHS, k) SEI = **11**. The verdict says ten
in `citations[0].claim` and "stávající desítku dozorových orgánů" in `conflictAssessment`.
The penalty range 500 000 – 20 000 000 Kč is correct (lines 231, 296).

**M6 — `verdict-214.json`: four quotations attributed to the DZ are not verbatim, one expressly so.**
Programmatic locatability test (NFC + whitespace-normalized, case-insensitive) against both
cached files:

| quoted as | actual text |
|---|---|
| „automatickou procesní imunitu" | *"Opouští se koncept automatick**é** procesní imunit**y**"* |
| „obrácený model ochrany mandátu" | *"model, který by se **mohl nazvat** obrácen**ým** model**em** ochrany mandátu"* |
| „neoprávněného privilegia" | *"**v očích veřejnosti** často působí jako neoprávněn**é** privilegi**um**"* |
| „teoretické riziko politicky motivovaných či šikanózních stíhání" | *"zabránilo se teoretick**ému** rizik**u** politicky motivovaných či šikanózních stíhání"* |

The fourth is labelled in `researchedContext` as **"(vlastní formulace zprávy)"** — an
explicit claim of verbatim quotation that is false. The third also mis-attributes stance: the
DZ reports a *public perception*, it does not assert the privilege is unjustified.
Separately, the constitutional criterion is quoted as „**vyžaduje** ochrana nezávislého výkonu
mandátu", dropping the conditional — the enacted text is *"vyžaduje-**li to** ochrana
nezávislého výkonu mandátu"*. Quoting a constitutional provision inexactly is not a nit.

**M7 — `verdict-214.json` `conflictAssessment`: the only verdict rendering graph money without the gate.**
It lists ten ties by name and amount — including SOMPO, a.s. 9 174 258 Kč, PEVAK Pelhřimov,
družstvo 1 234 888 Kč, Via rustica z.s. 2 008 259 Kč, Nadační fond Gymnázia Kutná Hora
200 000 Kč — and **never states they are `pending_review`**. Verdicts 46 (*"všechny vazby
čekají na lidskou kontrolu"*), 125 and 106 all do. Counts and amounts reconcile exactly
against `batch-016-targets.json` (Rakušan 4, Vlček 6, the other three sponsors 0) — the
figures are right; the gate disclosure is missing.

**M8 — `verdict-214.json` `conflictAssessment`: no ownership verification before a commercial framing.**
The ties are characterised only as *"obchodní společnosti, družstvo a spolky"*. SOMPO, a.s. and
PEVAK Pelhřimov, družstvo are municipally-controlled utilities of the Pelhřimov region; the
verdict neither verifies nor discloses that it did not. Contrast `verdict-125.json`, which
does the work correctly (*"Jde o **veřejné instituce** (příspěvkové organizace…), nikoli
o soukromé podnikatelské subjekty"*), and `verdict-106.json`
(*"komunálně vlastněný subjekt"*), and `verdict-75.json`, which honestly discloses that the
class flag is absent from its input. Within one batch the rule is applied four different ways.

**M9 — `verdict-88.json` `conflictAssessment`: the data-gap reason is false.**
> "Bez záznamu peněžních vazeb k jeho osobě **v této datové sadě** nelze provést hodnocení
> střetu zájmů."

`batch-016-targets.json` carries four Aleš Juchelka ties in the **same file**, under tisk 125:
ČESKÁ TELEVIZE (IČO 00027383, 19 557 459 056 Kč), ČESKÝ ROZHLAS (IČO 45245053,
3 995 330 864 Kč), YOU STORY UP! s.r.o. (4 641 238 Kč), OCCAM PR s.r.o. (177 870 Kč).
**The gap flag itself is exemplary and must be kept** — *"jde o mezeru v evidovaných datech
k tomuto tisku, nikoli o zjištění, že by taková vazba neexistovala"* is precisely the honest
form, and it answers the brief's question: yes, it is stated as a gap, not a clearance. Only
its stated *reason* is wrong, and the fix is a one-line cross-reference to tisk 125's row.

**M10 — `verdict-162.json` `unstatedEffects[0]`: "výhradně … aniž by zvažovala" is false.**
The zvláštní část to čl. III (`269165.txt:2165-2184`) does nothing but weigh access to court:
it cites three Ústavní soud nálezy on čl. 36 odst. 1 Listiny (I. ÚS 1415/18, II. ÚS 510/19,
I. ÚS 868/21), and sets the fee expressly *"tak, aby **nepředstavovala nepřiměřenou bariéru
v přístupu k soudu**"*. The verdict also never states the fee amount — **2 000 Kč**, equal to
the filing fee — which is the single most load-bearing number for the barrier claim it makes.

**M11 — `scripts/case-loops/law/sweep-old27-015.ts`: a batch-016 commit would stamp the batch-015 provenance ref.**
`ref: "old27-jargon-sweep-015"` is hard-coded at the write; `--pass` defaults to **49** while
the pending write is pass **50**; and `--in=`/`--out=` still default to the *batch-015*
payload paths. A pass-50 commit therefore lands data claiming `{pass: 50, ref:
"old27-jargon-sweep-015"}`. This repo's own hardest-won lesson (`CLAUDE.md`, the pass-42
`/zebricek` episode) is that a correction is not applied until the DATA carries its correct
provenance ref — and that nothing in the suite could see the difference. Nothing here can
either.

**M12 — `features/lawwatch/getDependencyData.ts:24-25` documents a safety behaviour the code does not implement.**
Header: *"a bill whose hit counts disagree between them is **dropped** rather than
mis-paired."* `buildDependencyView.ts:163-169` does not drop it — it silently degrades to the
triage payload's own 120-char prefix, which the same file's lines 20-23 state *"did not
contain the placeholder they exist to show"* in 16 of 18 cases. Unreachable on today's data
(all 10 bills aligned), untested.

**M13 — `buildDependencyView.ts:90-117`: the dedupe representative rule is inert on 100 % of real data, and its test can only pass by bypassing the gate.**
The rule claims to keep the longest excerpt; `dedupeHits` compares the **gated** context, and
`centeredExcerpt` caps at `CONTEXT_MAX_CHARS = 220`. Recomputed over the live payload, every
real group ties (153: 221×5 + 220; 210/53/64: 221,221), so `group[0]` decides every row and
the documented branch never fires. `getDependencyData.test.ts:155-177` passes only because it
uses `passthroughGate`. The shipped behaviour is unpinned.

**M14 — `buildDependencyView.ts:171-184`: the dedupe key can collapse two genuinely different companions (latent).**
A hit whose context passes the gate but whose subject fails has `likelyCompanionTisk` forced
to `null`; two such hits naming *different* companion prints key identically as
`[null, null, false]` and merge into one `×2` row whose note asserts "one dependency counted
twice". Not reachable today (`withheldHitCount === 0`), pinned by nothing.

**M15 — `getDependencyData.ts:101` + `buildDependencyView.ts:175`: `weakEvidence` and the dedupe key are computed on a 220-char-truncated subject.**
A hedge past char 220 is lost — the row then drops its "vazba nejistá" marker and gains a live
`/zakony/<tisk>` link asserting a dependency the evidence declines to assert. Longest real
subject is 195 chars: a 25-char margin. Untested.

Answering the brief's Q1 directly: on **today's** corpus no wrong collapse occurs. Different
companion tisk, different bill, different direction and different collision class all provably
do not collapse (two pinned by tests; class is constant because only
`companion_dependency` survives the filter). Tisk 153's six hits *do* collapse across four
different amended statutes, which is defensible under the section's stated
enactment-order semantics but discards five of six excerpts behind a bare `×6`.

---

## MINOR

1. **`verdict-228.json` `researchedContext`** — *"170,6 mil. Kč na 8 530 ředitelství …
   **zřizovaných kraji a obcemi**"*. The source (line 1426-1430) files this under
   *"Finanční dopad na územní samosprávné celky"* and adds *"Zde jsou zahrnuta i ředitelství
   zřizovaná **dobrovolnými svazky obcí**."* All other 228 figures verified exact and the
   arithmetic closes: 201,92 (MŠMT, incl. 200 vývoj) + 170,6 (ÚSC) + 0,16 (ostatní
   ministerstva) = **372,68 mil. Kč**; the summary's 172,68 / 8 634 subjects is consistent
   with the 170,6 / 8 530 subset. Both `evidence` quotes verbatim-located.
2. **`verdict-228.json` `unstatedEffects[1]`** — the 170,6 mil. municipal cost is *not*
   unstated: the DZ gives it its own section and says *"Tyto náklady nelze přenést na státní
   rozpočet."* The verdict hedges honestly to *"aniž by v **obecném shrnutí** zdůraznila"*,
   but the summary at line 1344-1359 does break out 172,68 mil. for implementation. A thin
   effect, honestly framed.
3. **`verdict-46.json` `unstatedEffects[0]`** — its lead sentence says the DZ treats the fine
   as mere technical implementation *"které pouze jednotně stanovuje výši sankce"*; the
   zvláštní část to § 395f (lines 1837-1852) explains the investigative tools at length,
   including *"např. informací o bankovních účtech, cenných papírech a investičních
   nástrojích"*. The narrower surviving claim (the obecná část does not quantify the
   bank-secrecy intrusion) is defensible.
4. **`verdict-46.json`** — inline „**pověřeným** policejním prezidentem" is inflected; the
   enacted words are „pověřený policejním prezidentem" (its own `evidence` quote has it right).
5. **`verdict-75.json`** — inline „profesionalizaci provozu" is inflected (source has
   *profesionalizace*); „soustavou" matches only case-insensitively.
6. **`verdict-75.json` `conflictAssessment`** — MERO ČR, a.s. is state-owned (MF ČR), not
   *"obecně nebo krajsky ovládan[ý]"*. Safe direction (still public), but imprecise. The
   paragraph's disclosure that the ownership-class flag is absent from its input, and that the
   classification therefore rests on prior doctrine, is otherwise **exemplary**.
7. **`verdict-125.json` `conflictAssessment`** — Nemocnice Jablonec nad Nisou, p.o. is founded
   by the *city*, not *"zřízené krajem"*. ZZS Libereckého kraje is kraj-founded.
8. **`verdict-125.json`** — *"šesti dalších ustanoveních"* while listing eight discrete
   provisions (§ 13 odst. 2; 14a odst. 1; 16 odst. 1; 16 odst. 2; 25 odst. 1; 26 odst. 1
   písm. b); 29 odst. 1 písm. c); 29 odst. 7). Six *sections*, eight *provisions*; the
   "nejméně" hedge saves it. The core claim is **verified correct**: `268378.txt:61`
   *"7. V § 21 odstavec 1 zní:"* — a wholesale replacement, and the new list runs a) … k) =
   **eleven** items, matching "jedenáctipoložkovým". The two-stage relettering
   („písm. d)" → „e)" → „i)") is real. Numbers verified: 2 900 Kč (266), 53 677 500 /
   60 485 100 Kč (274), § 90 odst. 2 zákona č. 90/1995 Sb. correct.
9. **`verdict-125.json`** — treats the 88/85 § 21 relationship as an unverified hypothesis
   (*"nebylo zde přímo ověřeno"* — honest, and correct practice) while the corpus already
   holds the answer in `collision-close-reads-batch014-gB.json`. Verdict 88 cited those
   records; 125 did not. Inconsistent depth within one batch.
10. **`verdict-186.json` `researchedContext`** — *"na základě **společného předkladatele**"*
    is false: tisk 186 is Zastupitelstvo hl. m. Prahy, the two RUD bills are Pardubický kraj.
    They share only the *class* of proposer.
11. **`verdict-186.json` `citations[3].claim`** — renders the raw organ code *"garančním
    výborem **HV**"* and the raw status enum *"stavem **navrženo**"*. Both reconcile to
    `committeeRouting` (`{organ:"HV", status:"navrzeno", assignedOn:"2026-06-03"}`), but a
    reader gets a code. All other committee claims verified: 228 → VVVMS ✓, 46 → ÚPV
    přikázáno 24. 3. 2026 ✓, 162 → ÚPV ✓.
12. **`verdict-88.json`** — the only verdict making graph claims (*"pole předkladatelů je
    prázdné"*) with **no `graph_fact` citation at all**; `verdict-186.json` cites
    `bill:tisk:43307` for the structurally identical situation.
13. **`sweep-old27-015.ts`** — two brittle spots: `(props.forensic_provenance as
    Record<…>).jargon_sweep = …` throws if a bill carries `forensic_severity` but no
    `forensic_provenance` (the extract's own filter admits exactly that shape); and
    `/\(churn 6: tisky/g` hard-codes the count, so a `churn 5:` string would reach the
    post-rewrite jargon check and abort. Both fail loudly, neither corrupts.

---

## P3 — the residual jargon sweep: **PASSES**

All five rewrites in `batch-016-old27-sweep.json` verified programmatically against the
live `lawJargonIssues` + `czechGateErrors` + the script's own invariants:

| # | tisk · field | digits identical | jargon before → after | Czech gate | Cyrillic | NFC |
|---|---|---|---|---|---|---|
| 1 | 173 · researched_context | ✓ | `churn` → none | clean | none | ✓ |
| 2 | 196 · researched_context | ✓ | `churn` → none | clean | none | ✓ |
| 3 | 216 · researched_context | ✓ | `churn` → none | clean | none | ✓ |
| 4 | 248 · conflict_assessment | ✓ | `případu law` → none | clean | none | ✓ |
| 5 | 248 · citations[8].claim | ✓ | `případu law` → none | clean | none | ✓ |

- **„(churn 6: tisky 111, 115, 173, 196, 207, 216)" → „(6 souběžných novel téhož zákona:
  tisky 111, 115, 173, 196, 207, 216)"** — the count **6** and all six tisk numbers survive
  verbatim; the digit invariant confirms it mechanically. Meaning is preserved and improved:
  „churn 6" was an opaque metric name, „6 souběžných novel téhož zákona" says what it counts.
- **„již gatovanému" → „již prověřenému"** — acceptable but not ideal. Read in its own
  sentence (*"Vůči již prověřenému tisku 115 z dřívějšího zpracování … archivovaný posudek
  k tisku 115"*) it denotes the bill's *processing state*, which is what „gatovaný" meant. But
  „prověřený" is the same root the corpus uses for substantive human verification, and every
  one of these findings is `pending_review`. **Recommended:** „již dříve zpracovanému" — same
  slot, same case, no verification connotation. Not blocking.
- The remaining rewrites (`v grafu případu law` → `v datovém grafu tohoto projektu`;
  `(uzel sněmovní tisk N)` → `(záznam sněmovního tisku N)`) are faithful and grammatical.
- **`--commit` path re-read: sound.** It re-verifies `props[field] === before` and throws
  otherwise, clones props (merge-preserving), and parses the `field[i].sub` form correctly.
  The digit and syntax invariants (paren balance, no new mid-sentence full stop) run before
  anything is emitted. Its two defects are M11 (provenance ref/pass) and MINOR 13.

One structural note, not a defect of this sweep: `lawJargonIssues` returns the **first** match
per regex, and `churn` and `gatovan` share one alternation — so a string carrying both reports
only one. Here tisk 173 carried both and the sweep fixed both, but the inventory would have
under-reported a string where the sweep's rule set covered only the reported token.

---

## P4 — the amended-§ census: **NOT FIT TO SHIP AS A CROSS-CHECK ARTIFACT**

The artifact is a faithful, uncorrupted, deterministic product of its script — and its central
cross-check output points the wrong way. Two independent re-derivations (mine from the ten
batch bills, a second full reimplementation of `operativeSlice` +
`partitionParagraphsByStatute` + `amendsParagraph` over all 141 cached prints) agree.

### Verified CORRECT

- **Arithmetic closes exactly.** Recounted from `rows`: 141 bills (141 distinct `cislo`,
  ascending), **3 171** operative pairs, **48** bills with graph-only refs, **8** with
  text-only refs — all four match the header fields. `billsSkippedNoText: 0` is consistent
  with 141 cache dirs for 141 bills.
- **The payload is exactly what the script produces** — an independent reimplementation
  reproduced **3 171/3 171 pairs, 0 bills mismatching**. No post-generation editing, no sweep
  tampering.
- **Zero corruption.** 0 Cyrillic codepoints, 0 mojibake (`Ã.`, `â€`, `Ð`), byte-identical to
  its own NFC normalization, every `lawRef` matches `^(\d+/\d{4}|unknown)$`, every § token
  `^\d+[a-z]*$`, all arrays sorted as claimed, no operative/citedOnly overlap, no duplicate
  statute within a bill.
- **`§ 12a`-style suffixed refs** are extracted and normalized correctly (`35ba`, `19a`,
  `24j`, `38gb` all present).
- **tisk 64 is structurally sound.** 150 `ČÁST` headings / 160 `Čl. N` lines → 147 statute
  buckets, 144 with operative pairs, 895 pairs; memo correctly trimmed (660 352 of 2 505 417
  chars). Sampled single-instruction parts resolve correctly (`V § 37a odst. 5 zákona
  č. 44/1988 Sb.` → `{44/1988, ["37a"]}`; `V § 1 zákona č. 92/1991 Sb.` → `{92/1991, ["1"]}`).
  **Answering the brief: yes, its row plausibly covers its ~150 parts.**

### B8 (BLOCKING) — the cross-check's direction is inverted: the graph is right and the extractor is blind, in most of the 87 disagreements

`graphOnlyRefs` is documented and named as "a graph edge whose statute the text never
operatively touches = topology lead". Measured, that is mostly false. **87 (bill, ref)
disagreement pairs across 48 bills, 69 distinct refs** — the header discloses only the bill
count.

On the **ten bills of this very batch**, I checked all 9 graph-only refs by hand against the
cached texts. **The graph is right 9 out of 9:**

| bill | graph-only ref | why the extractor missed it |
|---|---|---|
| 214 | 1/1993 | the Ústava is structured in **články, not §§** — a §-based extractor is blind by construction. Row is `statutes: []`, contributing 0 pairs. |
| 162 | 549/1991 | amended **only via the příloha** (čl. III: *"V příloze položce 22 … se za bod 13 vkládá nový bod 14"*) — no § exists to find. |
| 228 | 273/2008, 561/2004 | both operatively amended with named §§ (`277290.txt:428` *"V § 66 odst. 2 zákona č. 273/2008 Sb. … vkládají slova"*; ČÁST TŘETÍ amends §§ 28/49/66/108 of 561/2004) — the **partitioner** folded all 32 §§ under 111/1998, the first statute named. |
| 125 | 300/2025, 358/2022 | both operatively amended (čl. IV amends 300/2025 directly). |
| 88 | 152/2025 | čl. V operatively amends it. |
| 106 | 159/1999, 455/1991, 565/1990, 89/1995 | all four DO appear in `statutes[]` — with `operativeParagraphs: 0` and 29/7/3/1 cited-only §§. The **discriminator** rejected every instruction, including `267576.txt:789` *"1. V § 3d se částka „50 Kč" nahrazuje částkou „100 Kč""* — a textbook `V § N se … nahrazuje` form. |

The second re-derivation classified the full set: **≥59 of the 87 (68 %) are statutes the text
demonstrably DOES operatively amend**, with three verified verbatim —
`64 → 360/2004` (*"Čl. XCI / V zákoně č. 360/2004 Sb., …, § 9 včetně nadpisu zní:"*),
`64 → 317/2025`, `100 → 292/2013` (*"Čl. V / Změna zákona č. 292/2013 Sb. …"*). All three of
tisk 64's graph-only refs are extractor misses. Two systematic causes: the instruction
anchor cannot fire after `Sb., ` or after `v části třetí, `, and the 60-char lookahead cannot
cross the `.` in `odst. 3`.

**tisk 205 is the clean proof.** Its entire operative content is one statute, one §, one
instruction (*"zákon č. 2/1969 Sb., … v části třetí, § 28, odst. 3 nově zní:"*). Its row:
`operativeParagraphs: []`, `citedOnlyParagraphs: ["28"]`, `graphOnlyRefs: ["2/1969"]`. A
perfectly correct small bill yields **zero pairs** and files its only amended statute as a
graph defect.

Publishing 48/87 as a "census gap vs topology lead" split invites a reviewer to correct the
graph against a blind extractor. That is a write-shaped hazard, and it is the reason this is
blocking rather than major.

### B9 (BLOCKING) — the text-only leads are not real: 8 leads, 0 verified genuine

Answering the brief's highest-risk question directly.

- **3 of 8 are the literal string `"unknown"`** — tisky 100, 101, 243. That is the
  partitioner's no-citation sentinel (`collision-core.ts:79,90`), reported as "a statute the
  text amends but the graph lacks". Uninterpretable as a lead. (8 bills carry an `unknown`
  bucket: 67, 87, 100, 101, 107, 111, 114, 243.)
- **tisk 144 → 326/1999 is verified FALSE.** tisk 144 is a **brand-new** cizinecký zákon with
  19 ČÁSTs and **zero `Čl.` blocks**, so the whole 858 035-char slice fell into one bucket
  labelled by the first citation in it — which sits at offset 795 912 inside a přechodné
  ustanovení (*"řízení zahájené podle zákona č. 326/1999 Sb. … přede dnem nabytí účinnosti
  tohoto zákona"*). A pure cross-reference. The bill **replaces** 326/1999; it issues no
  amending instruction against it. All six "operative" §§ are §§ of the **new act**, matched
  only because a pdftotext line-wrap put `v § 77` at column 0. **A reviewer acting on this
  lead would add a spurious `amends` edge.**
- **The remaining 4** (10 → 250/2017, 54 → 499/2004, 69 → 220/1991, 113 → 20/1993) are all
  new-act bills with the same zero-`Čl.` single-bucket collapse. tisk 69 is the clearest tell:
  it files `§ 1784`, `§ 1826`, `§ 3033` (občanský zákoník) and `§ 323–326` (its own new act)
  under **220/1991 (Česká lékařská komora)**.

### B10 (BLOCKING) — the tisk 250 claim in the batch brief is not supported by the artifact

The brief states the census "now shows four previously-missing statutes as operative" for
tisk 250. `rows[cislo=250]` carries **exactly one** statute (`330/2025`, 38 operative §§) and
**zero** `textOnlyRefs`, with nine graph-only refs.

Ground truth from `tisk-250/277952.txt`: the bill operatively amends **ten** statutes, each
under its own `ČÁST` heading — 2/1969 (ČÁST DRUHÁ), 64/1986 (TŘETÍ), 505/1990 (ČTVRTÁ),
539/1992 (PÁTÁ), 20/1993 (ŠESTÁ), 22/1997 (SEDMÁ), 634/2004 (OSMÁ), 87/2023 (DEVÁTÁ),
387/2024 (DESÁTÁ), 330/2025 (JEDENÁCTÁ). **The graph carries 10/10 and is exactly correct.**
`grep -c "Čl\." tisk-250/277952.txt` → **0**, so the partitioner produced one bucket, labelled
`330/2025` because that is the first `č. …/… Sb.` in the document — **footnote 2, line 156**.
Every one of the 38 §§ is filed under a statute it does not belong to.

Whatever batch note asserts the four-statute improvement must be withdrawn.

### M16 (MAJOR) — 22 of 141 bills (16 %) got no partition at all, and nothing in the payload says so

`partitionParagraphsByStatute` splits on `\n\s*Čl\.\s*(roman|digits)\.?\s*\n` only; it does
**not** handle `ČÁST DRUHÁ / Změna zákona č. X` headers. Bills with zero `Čl.` blocks fall back
to one whole-document bucket labelled by the first citation anywhere in it: **6, 10, 52, 54,
55, 62, 63, 69, 76, 87, 101, 113, 114, 116, 144, 163, 189, 219, 222, 228, 250, 261.** They
contribute 112 of 3 171 pairs (3,5 %) but 100 % of their statute labels are a coin-flip. No
field flags them. Additionally, 6 bills (6, 52, 55, 87, 114, 116) lack the
`ČÁST PRVNÍ`/`Čl. I` start anchor and tisk 100 has no `Důvodová zpráva` marker, so their
"operative slice" is the whole document, memo included.

### M17 (MAJOR) — the method note transfers a batch-009 validation onto a population it never covered

`method`: *"the measured instruction-vs-citation discriminator"*; script header
(`amended-paragraph-census-016.ts:5-7`): *"the same partitioner and the
instruction-vs-citation discriminator **whose false-drop rate was measured to 0 on the hand
set in batch-009**"* and *"no new text heuristics are introduced"*.

Both statements are literally true and jointly misleading. Batch-009's hand set was
collision pairs among **amending** bills; this census runs over the whole corpus including
**new acts**, **ČÁST-structured omnibuses**, **článek-structured constitutional acts** and
**annex-only amendments**. On that population the false-drop rate is demonstrably not 0
(tisk 205: 1 of 1; tisk 106: 3 of 3; tisk 214: total blindness).

**Answering the brief's question on honesty: the note is honest that nothing is written and
that both directions are reported. It is NOT honest about extractor limits — it states none,
and the field name `graphOnlyRefs` frames every extractor blindness as a graph deficiency.**

### MINOR (census)

14. Ranges lose all but the first §: `použijí se § 338 až 340` → `"338"` only; same for
    `§ 12 a 13`.
15. `odst.` / `písm.` granularity is absent — `targetedOdstavce()` exists in `collision-core`
    and this script never calls it. Every pair is §-level only.
16. The regexes are compiled `"iu"`; recompiling case-sensitively drops **3 171 → 3 160**.
    The 11 `/i`-only pairs are `46:299`, `46:395b`, `101:{3,12,211}`, `144:{77,84,228,283,529,569}`
    — i.e. **two of the eight text-only leads rest entirely on that flag**. Aggregate impact
    0,3 %; lead-level impact 25 %. `collision-core.ts:107` comments *"Anchored so a
    mid-sentence `podle § N` cannot match"* — not true on this corpus.
17. The payload carries no evidence and no diagnostics — no quoted instruction, no offset, no
    per-bill `Čl.`-block count or fallback flag. A reviewer cannot triage a lead without
    re-reading the print.

### What P4 needs before it is useful

Rename and re-frame: `graphOnlyRefs` is an **extractor-recall** report, not a topology lead,
until recall is measured. Add a `partitionFallback: true` flag per bill, drop `"unknown"`
buckets from the lead set, teach the partitioner `ČÁST N / Změna zákona …` headers, and either
handle článek-structured and annex-only amendments or exclude those bills from the cross-check
and say so in the header.

---

## P6 — standing sweeps across all 10 verdicts

| check | result |
|---|---|
| Deterministic gate (`gate-verdicts-011.ts --batch=016`) | **10/10 pass** |
| Homoglyphs (Cyrillic in Czech strings) | **none** in any reader-facing field |
| NFC normalization | **all clean** |
| Czech-first (`czechGateErrors`) | passes — but see B7: `payload`, `steward`, `owner/manager/steward` are English and slipped through |
| Fabricated statute numbers | **none** — every `č. N/RRRR Sb.` in prose is in `knownLawRefs` |
| `whoBenefits` unsigned | **all 18 effects unsigned** — either „Nelze jednoznačně určit" or a named institutional class. No verdict attributes benefit to a person. ✓ |
| Sponsor tie counts / amounts vs `batch-016-targets.json` | **exact on all 10** (46: 3 ties 0/594/0 ✓; 214: Rakušan 4 + Vlček 6 + three at 0 ✓; 125: Juchelka 4 + Pastuchová 3 + Hendrych 0 ✓; 106: Horák 1, six at 0 ✓; 75: Hladík 5 + Niemiec 1 + Langšádlová 1 ✓; 162/228 single sponsor, 0 ties ✓; 186/88 empty ✓) |
| `pending_review` stated for graph money | 46 ✓, 125 ✓, 106 ✓, 75 ✓ (via doctrine + explicit class-gap note) · **214 ✗ (M7)** |
| Quotation locatability — all 18 `evidence` strings | 6 verbatim quotes: **6/6 located** in the cached texts. 12 URLs: contract-compliant but see B5. |
| Quotation locatability — all 38 inline `„…"` spans | **31 located, 7 not.** All 7 misses are in 214 (4, see M6), 46 (1, MINOR 4), 75 (2, MINOR 5). Verdicts 106, 113, 125, 162, 186, 228, 88: **clean**. |
| Arithmetic closure of stated counts | 228 ✓ (372,68 = 201,92 + 170,6 + 0,16) · 125 ✓ (a–k = 11) · **113 ✗ (M5, 11 not 10)** · **106 ✗ (M4, false range)** · 162 n/a |
| Temporal claims | 88's *"o více než dva roky"* (to 1. 6. 2028) and 125's *"o téměř dva roky"* (1. 7. 2026 → 1. 6. 2028) both correct · 186's 1. 1. 2027 účinnost ✓ · 214's 1. 1. 2027 ✓ |

---

## What must change before pass-50

1. Withdraw or rewrite `unstatedEffects` on **162 (both)**, **46[1]**, **214[0]** — each rests
   on a "the DZ does not say this" premise the DZ contradicts (B1, B3, B4).
2. Correct **verdict 88**'s treatment of the 85×88 pair to the corpus's published
   `confirmed-collision`, and surface the second (110/2006 § 7) confirmed collision (B2).
3. Resolve the `evidence` contract split — either enforce it in `validateLawVerdict`, or
   teach `BillDetail.tsx:489` to render a verbatim quote. Do not ship both registers (B5).
4. Re-grade **46, 162, 214** to `low` unless surviving effects are found (B6).
5. Extend `LAW_PIPELINE_JARGON` with `pspId`, `payload`, the bare `dávkov\p{L}*` / `v dávce`
   forms, and the /penize tie-class tokens; then re-run the gate over verdicts-016 (B7).
6. Fix the four §-citation / count errors: 162's „položka 14" (M1), 113's ten-vs-eleven (M5),
   106's fabricated 2 831–4 121 range (M4), 228's „automatizovaně" (M3).
7. Add the `pending_review` sentence and an ownership note to 214's `conflictAssessment`
   (M7, M8); fix 88's data-gap reason (M9).
8. Before committing the sweep: pass `--pass=50` **and** change the hard-coded
   `ref: "old27-jargon-sweep-015"` (M11).
9. Dependency view: implement or delete the documented drop-on-misalignment guard (M12), pin
   the real representative rule (M13), and move `weakEvidence` off the truncated subject (M15).
10. Census: re-frame `graphOnlyRefs` as an extractor-recall report, drop the `"unknown"` and
    fallback-bucket bills from the lead set, teach the partitioner `ČÁST N / Změna zákona …`,
    and withdraw the tisk-250 four-statute claim (B8, B9, B10, M16, M17).

## Regression probes for the next round

Cheap, decisive re-checks so a fix round can be verified rather than trusted:

- `npx tsx scripts/case-loops/law/gate-verdicts-011.ts --batch=016` must still be 10/10 **and**
  must now fail on `pspId` / `payload` / `v dávce` if B7 was fixed in code rather than prose.
- Re-run the inline-quotation locatability scan: 38 spans, **31 located today**; a fix round
  should reach 38/38 or convert the 7 to paraphrase without quote marks.
- `verdict-214.json` must contain the substring `kontrol` in `conflictAssessment` (M7).
- `verdict-162.json` must contain no occurrence of `položka 14` / `položky 14` (M1).
- `verdict-113.json` must say `jedenácti`, not `deseti` (M5).
- Census: `rows[205].statutes[0].operativeParagraphs` must be `["28"]`, and
  `rows[250].statutes.length` must be `10` — both are single-assertion tests of the two
  systematic extractor faults.
- Sweep: after `--commit`, every touched bill's `forensic_provenance.jargon_sweep.ref` must
  name batch 016, not 015 (M11).

---

# Closure check (post-fix)

**VERDICT: REOPENED (narrow).** All 10 BLOCKING are substantively closed and verified against
the current files. **Two MAJOR defects were introduced by the fixes themselves** — both
one-sentence corrections, both in the audit's own named recurring classes. This is the
batch-014 Round-2 shape: do not run the pass-50 write until N1 and N2 are corrected;
nothing else needs re-litigating.

Re-verified independently against primary sources, not against the coordinator's account.

## The ten BLOCKING — all CLOSED

| # | status | verification |
|---|---|---|
| **B1** 162 | **CLOSED** | Both false effects dropped. The DZ's own reasoning (2 000 Kč pegged to the filing fee, the three ÚS nálezy, the fee-exemption where *"zálohu … hradí stát"*, and the zastavení consequence) is now recorded in `statedReasoning` as faithful summary — the honest place for it. Sole effect is the §198 finding. |
| **B2** 88 | **CLOSED** | Both published collisions now stated with the correct legal consequence, and *"Tato analýza tento dřívější nález přebírá, nikoli jej zpochybňuje."* Re-verified from primary text, not the payloads: `tisk-85/266984.txt:19-20` „…se vkládá nový bod 12, který zní: „12. **příjmu plynoucího z** dávky státní sociální pomoci,"" vs `tisk-88/267095.txt:47-48` „…nový bod 12, který zní: „12. dávky státní sociální pomoci,"" — same slot in § 7 odst. 2 písm. h) of 110/2006, different wording. The § 21 odst. 2 písm. e) byte-identity re-confirmed. |
| **B3** 46 | **CLOSED** | The false "DZ nowhere discusses § 65a" effect is gone; the DZ's actual explanation (Police reorganizace, NCTEKK) is folded into `statedReasoning`. The replacement effect is **genuinely unstated and stronger**: I read the whole privacy chapter (`265675.txt:1197-1226`) — it concludes *"Zvýšené dopady … se nepředpokládají."* (line 1222, verbatim) and contains **no** mention of § 395f, bank secrecy, or turnover. Confirmed by grep over the chapter's full span: zero hits. |
| **B4** 214 | **CLOSED** (but see N1) | The self-contradicting effect is gone; the DZ's confirmation is now stated in `researchedContext`. The replacement — no transitional provision — is real: Čl. II is účinnost only (1. 1. 2027), there is no přechodné ustanovení anywhere in the print, and the DZ's *"K čl. II (účinnost)"* discusses only legisvakance. **Truly unstated: yes.** |
| **B5** | **CLOSED** | `BillDetail.tsx` now branches — URL → link, otherwise renders the sentence under a `forensic.evidenceLabel` heading; `messages/cs.json` „zdroj:" / `messages/en.json` "source:" both present. All **16** evidence entries re-tested: **0 quoted-span misses**; every `„…"` inside every textual evidence string is verbatim-locatable in the bill's own cached text. |
| **B6** | **CLOSED** | 162 medium · 46 low · 214 low · 228 medium — matches the re-derivation. |
| **B7** | **CLOSED** | Detector extended (`law-verdict.ts:132`: `pspId`, `payloadu?`, `steward*`, `dávkov* přehled*`, `pořadí v dávce`), 11/11 tests pass, and a full re-scan of all ten verdicts finds **zero** occurrences of any flagged token. The 15× `pspId`, `payload`/`steward` in 75, `dávkovém přehledu` in 88, `pořadí v dávce` in 186 are all gone — and 186's false same-proposer claim beside it is corrected to *"stejnou třídu předkladatele … nikoli o týž konkrétní subjekt"*, naming Prague vs the earlier Pardubický-kraj bills. |
| **B8** | **CLOSED** | Fields renamed `extractorMissedRefs` / `extractorExtraRefs`; header fields likewise. The method note now states the graph is **PRESUMED RIGHT**, cites the 9/9 hand-verification, and adds the correct scope caveat: *"Per-§ rows are trustworthy exactly where a bill's diagnostics are clean."* The direction of trust is inverted, which is the whole ask. |
| **B9** | **CLOSED** | `"unknown"` buckets dropped — **0 remain** (re-scanned all 141 rows). Extras 8 → **5**, and the five survivors are reframed as *"partition labels the graph does not corroborate (typically cross-reference wins)"* — a diagnostic, not a lead. tisk 144 → 326/1999 is no longer actionable as a lead. |
| **B10** | **CLOSED** | The artifact no longer supports the claim in either direction, and `batch-016.md` is not yet written — the four-statute claim is unpublished. **Standing caution:** it must not appear when that file is authored. tisk 250 still resolves to 1 statute + 9 missed refs; that is now labelled honestly rather than fixed. |

Header arithmetic re-closes after regeneration: 141 bills, **3 166** pairs recounted from
`rows` = header, 48 missed / 5 extra = recounted bill sets.

## MAJORs — verified fixed

M1 „položka 14" residue **0**; now *"do přílohy položky 22 … nový bod 14"* plus the
`body 14/15 → 15/16` cascade · M2 46 now states the § 395f odst. 3 routing correctly and adds
*"přímý přístup útvaru Policie … text nezakládá"* · **M3 228 fixed and better than asked** —
rather than deleting „automatizovaně", it now discloses the gap: *"Text novely neurčuje, zda
je poskytnutí informací automatizované nebo probíhá k jednotlivé žádosti"* · M4 106's
fabricated range replaced with an explicit two-measure split (*"dva nesourodé údaje, které
nejde sečíst ani spojit do jednoho rozpětí"*), both units named, and the shared-economy
exclusion stated the right way round — **the rebuilt effect is stronger, as claimed** ·
M5 113 „jedenáct", no `deseti`/`desítka` residue · M7/M8 214 now states *"všechny čekají na
lidskou kontrolu"* twice and names SOMPO/PEVAK as *"municipálně ovládané … nikoli soukromé
podnikatelské subjekty"*, with an honest note that the other four lack such verification ·
M9 88's gap reason corrected and the gap flag kept · MINOR 7 125 now *"zřízenou statutárním
městem Jablonec nad Nisou"*.

**M12–M15 by code-read (two required, four done).** `dedupeKey()` (`buildDependencyView.ts:125`)
is now `[_rawTisk, _rawSubject, weakEvidence]` — raw, pre-gate, pre-truncation identity, so the
`[null, null, false]` collapse of M14 is structurally impossible. `weakEvidence`
(line 238) runs `WEAK_EVIDENCE_RE` against `rawSubject`, not the 220-char gated string — M15
closed with the 25-char margin removed as a concern. `misalignedDroppedCount` exists, is
incremented on the misaligned branch (line 216) and is disclosed in the type contract
(line 63) — M12 closed. `_rawContextLen` drives the representative pick — M13 closed.
**57/57 tests pass**; `lib/analysis/law-verdict.test.ts` 11/11; gate 10/10.

## N1 — MAJOR, fix-induced: `verdict-214.json` › `unstatedEffects[0]` cites the wrong odstavec of the outgoing Ústava

> "Podle dosavadní úpravy (**čl. 27 odst. 3** ve znění účinném do 31. prosince 2026) odepření
> souhlasu komory se stíháním brání zahájení trestního stíhání…"

In the Ústava as in force, čl. 27 **odst. 3** is the **přestupky** provision; the consent rule
and its blocking effect (*"Odepře-li komora souhlas, je trestní stíhání po dobu trvání mandátu
vyloučeno"*) are **odst. 4**. The bill's own DZ says so — *"K vypuštění původního odstavce 3:
Vypuštěním ustanovení o **přestupcích**…"* — and the verdict's own `researchedContext` lists
both rules inside "odstavce 3 až 5" without assigning either.

This is load-bearing: the effect's entire premise is what the outgoing provision does, and it
names the wrong one. It is the §-citation-precision class, on a constitutional provision,
newly introduced by the rebuild.

Compounding: the outgoing text is **not in the cached corpus** — `271361.txt` renders čl. 27
as (1), (2) and the two NEW paragraphs only — and the effect's `evidence` is the psp.cz bill
URL, which does not carry it. The premise is uncited external knowledge, in the same sentence
that elsewhere carefully hedges *"v cachovaném textu"*.

**Fix:** `odst. 3` → `odst. 4`, and cite the outgoing wording to a source that carries it (or
state that the cached print does not).

## N2 — MAJOR, fix-induced: `verdict-88.json` › `conflictAssessment` renders graph money without the gate

The M9 correction moved Juchelka's four ties into verdict 88 — *"ČESKÁ TELEVIZE, IČO
00027383, úhrn veřejných smluv 19 557 459 056 Kč; ČESKÝ ROZHLAS … 3 995 330 864 Kč; …"* — and
did **not** carry the `pending_review` disclosure with them. Re-scanned across the batch: 106,
125, 214 and 46 all state *"čekají na lidskou kontrolu"*; **88 alone does not.**

This is the defect M7 raised against 214, relocated into 88 by the fix for M9. Nineteen and a
half billion crowns are attached to a named MP with no statement that the tie is unverified.

**Fix:** one clause. (Note the sibling verdict 125 states it for the identical four ties.)

## N3 — MINOR, fix-induced: English pipeline vocabulary re-entered reader prose

`cach*` now appears in reader-facing fields the detector does not cover: „v **cachovaném**
textu" (214 `researchedContext`, 214 `unstatedEffects[0].effect`) and „v **cache** dostupný
text" (228 `unstatedEffects[0].effect`). `cache` is the same English pipeline class as
`payload`, which B7 has just added — the detector was extended token-by-token rather than by
class, so the next head form passes. The intent behind these sentences is good (they hedge to
the corpus actually consulted); the vocabulary is not. Suggested Czech: „v dostupném textu
tisku" / „v archivovaném textu".

## N4 — MINOR: the new evidence idiom cites a coordinate a reader cannot resolve

B5's fix made `evidence` public, and four strings now read „… — úplný text tisku na psp.cz,
**řádek 224 strojového přepisu**" (162, 228 ×2, 46). The quoted sentences are all verbatim and
locatable — that part is exactly right — but a line number in a machine transcript of a PDF is
an internal artifact coordinate, not a citation a reader can follow. The quote plus the
psp.cz link already carry the burden; the line number is for us.

## N5 — MINOR: census method note carries a typo and omits its largest cause

The note names three causes of `extractorMissedRefs` — *"article-structured bills, annex-only
amendments, the substitution form beginning with the word **častka**"*. „častka" is not a Czech
word; it should be **„částka"**. And the three do not include the **ČÁST-header single-bucket
collapse**, which is the largest single cause: it accounts for all 9 of tisk 250's missed refs
and both of tisk 228's, plus the 22-bill fallback class of M16. `partitionFallback` was not
added, so a reader still cannot tell a clean partition from a collapsed one.

## N6 — MINOR: the sweep's provenance default is still wrong

`--ref` is now parameterized (`sweep-old27-015.ts:156`) — the capability exists. But the
default is still `"old27-jargon-sweep-015"`, `--pass` still defaults to **49**, and the usage
line (line 10) documents only `[--commit] [--pass=49]` — `--ref` is undocumented. An operator
who runs `--commit` without both flags still stamps pass 49 with the batch-015 ref. Given the
pass-42 lesson, prefer deriving the ref from `--pass` or failing closed when it is unset.
„již dříve zpracovanému" applied as recommended; digits preserved on all five rewrites.

## Regression scan — nothing else broke

Re-ran the full battery over the current files: **48 inline quotations, 44 exact-match**; the
four non-matches are all benign and verified — 214's „podmínkou…" and 46's „zvýšené dopady…"
lowercase a sentence-initial capital (standard mid-sentence quoting; both match
case-insensitively), 88's „12. příjmu plynoucího…" is a correctly-attributed **cross-bill**
quote located in `tisk-85/266984.txt:20`, and 75's „soustavou" is the pre-existing MINOR 5.
**0 Cyrillic, 0 non-NFC, 0 flagged jargon tokens, 0 fabricated statute numbers, all 18
`whoBenefits` unsigned, sponsor tie counts and amounts still exact against
`batch-016-targets.json`.** Census: 0 `unknown` buckets, header arithmetic re-closes at 3 166.
No new English-gate failures beyond N3.

## Verdict

**REOPENED (narrow) — two one-sentence MAJOR corrections (N1, N2) gate the pass-50 write.**
No BLOCKING remains. N3–N6 are recorded, not gating. The remediation is otherwise substantial
and, in three places (46's privacy-chapter effect, 106's two-measure split, 228's
„automatizovaně" disclosure), materially better than the defect it replaced.

---

# Final closure note (round 3)

**VERDICT: CLOSED. Pass-50 is cleared to write.**

Four items checked against the current files, plus a full residual scan. All pass. No new
defect introduced by this round.

## N1 — `verdict-214.json` › `unstatedEffects[0]` · **CLOSED**

The premise sentence now reads:

> "Podle popisu dosavadní úpravy v důvodové zprávě (**čl. 27 odst. 4** ve znění účinném
> do 31. prosince 2026; **samotné dosavadní znění Ústavy archiv tisku nenese**) odepření
> souhlasu komory se stíháním brání zahájení trestního stíhání poslance nebo senátora po dobu
> mandátu."

`odst. 4` is now correct **and** — this is the part worth recording — it is fully derivable
from the archived print alone, so the honest disclosure does not leave the number hanging:

1. Čl. I: *"se **odstavce 3 až 5** v článku 27 nahrazují odstavci 3 a 4"* → the outgoing set
   is {3, 4, 5};
2. DZ line 129: *"**K vypuštění původního odstavce 3**"* — the přestupky provision → outgoing
   3 is spoken for;
3. DZ line 145: *"Jde o drobně upravený **současně platný odstavec 5**"* → outgoing 5 is the
   zadržení/vazba regime;
4. ∴ outgoing **4** is the consent rule.

The uncited-premise half of N1 is resolved by the explicit archive note. Nothing renders a
provision the corpus does not carry.

*Optional strengthening, not a finding:* the parenthetical attributes the numbering to the
DZ's description, whereas the DZ pins outgoing 3 and 5 and the 4 follows by elimination. „Podle
struktury čl. I návrhu a popisu v důvodové zprávě" would be exact. Wording only.

## N2 — `verdict-88.json` › `conflictAssessment` · **CLOSED**

The four amounts now close with *"— **všechny částky jsou úhrny veřejných smluv firem
a všechny vazby čekají na lidskou kontrolu**"*, inside the same parenthesis as the figures, so
the disclosure cannot be read apart from them. Re-scanned the batch: **5 of 5** verdicts that
render graph money now carry the gate phrase (46, 88, 106, 125, 214). The money rule holds
corpus-wide for the first time in this batch.

## N3 — the cache rewrite · **CLOSED**

Checked the 228 occurrence specifically: *"Text novely neurčuje, zda je poskytnutí informací
automatizované nebo probíhá k jednotlivé žádosti — **archivovaný text tisku** tuto podrobnost
neuvádí."* — the hedge survives intact, the English token is gone, and the sentence is better
Czech than the original. 214's two occurrences likewise.

The detector was widened by class this time, not by token
(`law-verdict.ts:132` now carries `\bcache\b|(?<!\p{L})cachovan\p{L}*`), 11/11 tests, gate
10/10. **Full residual scan across all ten verdicts: 0 hits** for `cach*`, `payload`, `pspId`,
`steward*`, `dávkový přehled`, `pořadí v dávce`; 0 Cyrillic; 0 non-NFC.

## N5 — the census method note · **CLOSED**

„částka" is spelled correctly, and the note now leads its causal list with the real one:
*"(the LARGEST cause: an article-structured bill without statute headers collapses into
a single partition bucket; also annex-only amendments and the substitution form beginning with
the word „částka")"*. That is the cause behind all 9 of tisk 250's missed refs, both of tisk
228's, and the 22-bill fallback class. `totalOperativeBillParagraphPairs` is **3 166** and
recounts to 3 166 from `rows` — the regeneration changed the prose and nothing else.

## N6 — the sweep usage line · **CLOSED**

Documents `[--commit] [--pass=N] [--ref=<provenance ref>] [--in=…] [--out=…]` and carries the
warning in the header itself: *"defaults are the batch-015 paths/ref; later batches MUST pass
their own --pass/--ref — the batch-016 audit caught a pass-50 run that would have stamped the
015 ref."* The trap is now documented where the operator reads it.

## N4 — recommendation (open design question, as framed)

Recorded, not gating. The idiom is a genuine improvement on raw cache paths and its quotes are
all verbatim-locatable. My recommendation for the next batch's contract:

**Anchor evidence to the bill's own structural coordinate, not to our transcript's line
number.** Verdict 162 already does this in the same string — *"jak správně cituje **Čl. I
bod 11**"* — and it is both renderable and checkable: a reader opening the psp.cz PDF can find
`Čl. I bod 11` or `Čl. II bod 2` or a named DZ chapter, whereas `řádek 224 strojového přepisu`
is reproducible only against our own pdftotext output and drifts if the extraction is ever
re-run with a different tool or version. Concretely: keep `„<verbatim quote>" — <structural
anchor>, úplný text tisku na psp.cz`, and if a line number is still wanted for our own
tooling, carry it in a non-rendered field rather than in the sentence the public reads.

## Standing items carried forward (not gating)

- The tisk-250 "four previously-missing statutes now operative" claim must **not** appear in
  `batch-016.md` when that file is authored — the artifact does not support it in either
  direction (B10).
- `partitionFallback` was not added to the census rows; a reader still cannot tell a clean
  partition from a collapsed one without re-deriving it (M16). The method note now names the
  cause, which was the gating half.
- The jargon detector remains a growing list of literals. Three rounds have each added a
  token class after it shipped (`pspId`/`payload`/`steward`, then `cache`). A structural rule
  — e.g. flagging any ASCII-only Latin word of length ≥ 4 in a Czech reader-facing field that
  is not in an allowlist of genuine loanwords and proper nouns — would end the cycle.

## Closure

Ten BLOCKING closed in round 2, two fix-induced MAJORs and four MINORs closed in round 3, with
no regression detected in either round's re-scan. Gate 10/10 · `law-verdict` 11/11 ·
`features/lawwatch` 57/57 · census arithmetic 3 166 = 3 166 · 48 inline quotations with 44
exact matches and all four exceptions individually verified benign · sponsor ties exact
against `batch-016-targets.json` · money rule now satisfied on 5 of 5 · 0 residual pipeline
tokens, 0 homoglyphs, 0 non-NFC, 0 fabricated statutes.

**CLOSED — pass-50 may be written.**
