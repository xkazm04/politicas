# Money batch 019 — the company axis finishes, and the console learns to show it

Case ① FollowTheMoney · 2026-08-23 · **pass 65**.

> Two of STATE's open items: finish the company-axis corroboration over the 90 steward
> companies that never got a verdict, and give the 9 `ownership-not-published` companies a
> lane in the review console. Both done; the first produced a signal class nobody had asked
> for.

## 1. The steward class, swept

`public-mandate-sweep --scope=unverdicted` over the 90 tied companies with no verdict (all
steward by role). First run: 30 `unknown` — nine legal-form codes the batch-016 tables did
not carry (117 Nadace, 118 nadační fond, 141 o.p.s., 145 SVJ, 161 ústav, 722, 733, 745,
999). The batch-016 rebuild had removed the mislabelled 771 „Nadace" row and never added the
real codes. Seven added as private-law (verified against the číselník); **745 Hospodářská/
Agrární komora and 999 Ostatní stay unmapped** — arguable and empty respectively. Re-audit:
0 drift. Second run, **pass 65 (89 nodes)**:

| verdict | companies | CZK |
|---|---|---|
| public-body (OSS, kraj, příspěvkové …) | 8 | 54 346 328 916 |
| publicly-owned | 8 | 677 574 987 |
| private | 33 | 4 735 151 829 |
| ownership-not-published | 31 | 25 734 324 846 |
| unknown | 9 (745/999 or foreign owners) | 48 828 595 979 |

Across all 195 tied companies the company axis is now **194/195 verdicted** (the one
`nezjištěno` carries 0 CZK): publicly-owned 61, public-body 8, private 70, unpublished 40,
unknown 15. Headline unchanged at 17 417 308 400 CZK — the axis only removes.

## 2. The signal nobody asked for: steward by role, private business by register

Sweeping stewards made a contradiction measurable for the first time: ties classed `steward`
(a supervisory seat in a public/nonprofit body — by the NAME heuristic or a stored class)
whose company the register says is **privately owned**. Raw: 36 ties. Two thirds are o.p.s.,
nadace, ústavy — private-law *nonprofit* forms, which is exactly what steward means, so no
contradiction. `roleRegisterContradiction()` fires only on business forms: **18 ties** —
`dozorčí rada` seats at **Lovochemie, PRECHEZA, Fatra, Kostelecké uzeniny** (AGROFERT
group), **Nemocnice AGEL Valašské Meziříčí**, **Rybářství Třeboň**, Wellness sv. Markéta,
NEXNET, MAE invest; a **jednatel** of Nemocnice Valtice s.r.o.; Výzkumný Ústav Železniční
(ČD-owned — depth 3, a false positive of the register's own sole-akcionář rule).

The attribution rule may only remove, so none of that money moved into the headline — it
is simply not counted, which is the conservative error. But a steward class at an AGROFERT
chemical company is a class that may be wrong, and the human gate should see it. The console
now flags it on the card: „rozpor: steward podle role, soukromý vlastník podle rejstříku —
ověřit třídu". **No `tie_class` was changed** — the loop never flips a class; it shows the
reviewer the register.

## 3. The console learns the second axis

`/penize/kontrola` showed the tie class, the ARES-VR temporal badge and the review tier — and
nothing about the company. A reviewer deciding Teplárny Brno could not see that the firm is
100 % the city's. Now each card carries **„firma: …"** from `publicMandateInfo()` (one Czech
reading shared with the ledger), the named public owner where it exists, „k doložení mimo
rejstřík" where the register names nobody, and the contradiction flag above. And a new lane
in the sticky filter — **„vlastník neuveden"** — selects exactly the `ownership-not-published`
ties, the list STATE called hand-sized (9 attributable companies, 16,8 mld., plus the 31
stewards). `publicMandateLegalForm` travels over the wire for the flag; `publicWire` classifies
it public.

## 4. Gate

`npm run check` green (see ledger); `props-check` clean; headline unchanged through
`getMoneyData()`; backup `pass65-pre`.

## 5. Lessons

1. **A table fixed by removal is a table with a hole.** Batch 016 removed the wrong row and
   never asked what the right row was; the steward sweep paid for it with 30 `unknown`.
2. **Sweeping the population you did not need for the money finds the defects in the
   population you did.** The steward class carried no money question — and exposed that
   the tie class itself is sometimes wrong.
3. **A contradiction flag needs the same discipline as a triage signal**: 36 raw → 18 after
   reading the survivors. Nonprofit forms are steward by definition, not by accident.
4. **The reviewer must see both axes on one card**, or the console is asking for a decision
   with half the evidence the public surface already renders.
