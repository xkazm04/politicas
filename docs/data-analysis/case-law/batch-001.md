# Case ③ Law loop — batch-001 (calibration)

**Run:** 2026-07-24 · fleet mode (law loop; money + effort siblings concurrent) · read-only on
`.pglite-copy-law`, no live writes. **Unit:** bill (print). **Batch size:** 8. **Model tiering:**
Opus for the 3 highest conflict-substance candidates (121, 119, 115); Sonnet for 248, 120, 244, 4, 40.

## Headline

**8/8 top-triage flagged bills → 0 detected self-dealing conflicts.** Every verdict landed
`severity: low`, `pending_review`. This is a *finding*, not a null result: the batch is the
non-partisan-symmetry doctrine at scale — the deterministic money signal (`sponsor_contract_czk`)
flagged these bills, but forensic research found **no channel** from any sponsor's money ties to any
bill's subject. These are general tax / pension / criminal-code statutes whose provisions flow to
statutory *classes* (all parents, all third-pillar savers, all maintenance debtors), not to
sponsor-linked companies or contracts. The value the batch produced is a different, richer class of
signal: **data-quality, legislative-process, and cross-bill** leads (below).

Every verdict was gated against `lib/analysis/law-verdict.ts` (schema + anti-fabrication:
every `č. N/RRRR Sb.` cited is a real statute in the 24,774-law e-Sbírka registry; every unstated
effect cited; graph_facts are real ids). **8/8 pass** the widened gate; **7/8** the canonical gate
(see reflect: tisk 248's real-bill-id graph_fact).

## Triage (deterministic, lexicographic: severity → sponsorCzk → amends → routing)

Two triage signals proved **degenerate** on real data (documented for steering):

1. **`sponsor_contract_czk` saturates.** The raw top-10 by sponsor money were all identical
   5,397,460,397 CZK — Petr Hladík's **ARENA BRNO** municipal-stadium figure, which the prior
   tisk-58 verdict already established is *not* a self-dealing channel. A single municipal-board CZK
   figure swamps the ranking. Fix applied this batch: log-scale the money band so it can't dominate;
   let churn/amends lead. Proposed durable fix: exclude municipal / publicly-owned-company board
   roles from the conflict money signal (handoff).
2. **Routing-anomaly over-fires: 126/141 (89%).** The F12 `owns` remit has only 30 edges over a few
   committees, so "garanční committee's themes don't cover the amended law" fires almost everywhere.
   Uninformative as a discriminator until F12 taxonomy is denser. Down-weighted to a last-key tiebreak.

The re-weighted batch head (churn-led, diverse committees/origins):

| # | tisk | origin | amends | churn* | garanční | sponsor money (worst) | signal | severity |
|---|------|--------|--------|--------|----------|----------------------|--------|----------|
| 1 | 121 | mp_group | 3 (586/1992,117/1995,187/2006) | 7 | VSP | Hladík ARENA 5.39B (municipal) | 2 | low |
| 2 | 248 | mp | 5 (586,427,256,262,324) | 7 | — | none (clean) | 2 | low |
| 3 | 119 | mp_group | 2 (427/2011,586/1992) | 7 | RV | Šťastný Pražské služby 1.47B | 2 | low |
| 4 | 120 | mp_group | 1 (586/1992) | 7 | RV | Kovářová ČEPRO 235M | 2 | low |
| 5 | 244 | mp_group | 1 (586/1992) | 7 | — | Kovářová ČEPRO 235M | 2 | low |
| 6 | 4 | mp_group | 1→**4 real** | 7 | RV | none (clean) | 2 | low |
| 7 | 40 | other (kraj) | 1 | 7 | RV | none (regional) | 2 | low |
| 8 | 115 | mp_group | 2 (40/2009,45/2013) | 6 | ÚPV | Babiš AGROFERT (Synthesia 797M) | 2 | low |

*churn = max #prints amending any target statute. 586/1992 (daně z příjmů) leads at 7; 40/2009
(trestní zákoník) at 6. The whole head clusters on the income-tax act — the term's busiest statute.

## Dossiers — what each bill ACTUALLY changes

### tisk 121 — KDU-ČSL family package (Opus, conf 4)
Raises the child tax advantage (§35c: 1st child 15,204→22,380, 3rd+ 27,840→37,176 Kč), lifts parental
allowance 350k→400k with a faster draw (70%→100% cap), extends paternity (6 wk→12 mo) and unifies
ošetřovné at 16 days. ~+20 bn Kč/yr; **Government issued formal "nesouhlas".** Conflict: none —
universal benefits to statutory classes; Teleky's hospitals are the closest adjacency (Part 3 touches
sickness insurance) but ošetřovné pays individuals, not providers. **Unstated:** lifting the 70% cap
favours higher-earning parents.

### tisk 248 — five-law "third pillar" interoperability omnibus (Sonnet, conf 4)
Single-MP (Pivoňka Vaňková, clean). Makes DPS+DIP time count cumulatively toward the 120-month tax
condition, penalty-free 50% transfers between them, extends the under-30 state match to DIP, cuts
pension-company performance fee 15%→10%, and adds a **new labour-code employer-match right** (§224a):
employer must add ≥500 Kč/mo once the employee proves 500 Kč/mo. RIA: ~+9.8 bn Kč/yr employer cost,
~5.3–5.9 bn/yr net public-budget loss. **Unstated:** the 500 Kč self-fund trigger structurally
skews the "help for below-median workers" toward those who can already afford to save; the fee-cap +
transfer rails **favour DIP providers (banks) over pension companies**.

### tisk 119 — locked-in pension participants remedy (Opus, conf 5) — **ENACTED**
Only batch bill that **completed the whole process** (3rd reading 27 May, Senate 8 Jul, President
signed 16 Jul 2026, promulgated). Gives ~150k third-pillar savers stripped of the state contribution
by zák. 462/2023 a penalty-free exit (new §28a of 427/2011) and refunds ~16k who already exited, at
~60M Kč. Follows Constitutional Court nález Pl. ÚS 18/24. Conflict: none (Nacher's Operátor ICT,
Šťastný's Pražské služby are municipal, not pension-sector). **Unstated:** a 6-month *preclusive*
claim deadline forfeits relief for the least-informed; the state keeps unclaimed sums.

### tisk 120 — basic-credit refundability reform (Sonnet, conf 4)
Converts the flat non-refundable 30,840 Kč/yr basic taxpayer credit into a **refundable** bonus
(capped at paid social/health insurance), for §6 employees only, cutting the bottom-quintile
effective rate 33.6%→32.3%; net −0.5 bn Kč/yr. **Notable:** DZ discloses a **PAQ Research lobbying
footprint** (via Petr Vilím) under the 2025 lobbying-transparency law — transparently, not hidden.
Conflict: none (ČEPRO / school foundation / small municipal cos. don't touch a personal-credit
mechanism).

### tisk 244 — spousal→child credit shift (Sonnet, conf 4) — **cross-bill collision**
Repeals the married-couple spousal credit (§35ba/§35bb), replaces it with a bigger under-3 child
credit (+1,000 Kč/mo, +4,000 with ZTP/P), refundable & marital-status-neutral. **Cross-bill signal:**
tisk 244 and its sibling **tisk 120 both amend §35ba of 586/1992 with renumbering instructions that
assume different starting letterings** — if 120 enacts first, 244's clause strikes the wrong
provision. A concrete legislative-drafting collision. Conflict: none (Kovářová ČEPRO unrelated).

### tisk 4 — Pirate income-tax bill (Sonnet, conf 5) — **data-quality lead**
Richterová/Bartoš, clean. Raises & indexes the basic credit, equalises 1st-child credit, indexes
parental allowance. **Data-quality signal:** the actual bill text amends **four statutes**, but the
graph's title-regex `amends` recorded **one** (586/1992) — the title-only extraction *undercounts*
the real amended set. It also carries a **new 2,340 Kč/hl excise on still wine** riding under an
income-tax title — a rider the title hides.

### tisk 40 — Jihomoravský kraj wine/beer promo-gift deduction (Sonnet, conf 4)
Regional-initiative bill (Art. 41 Ústavy). Restores wine — and newly adds beer — as a ≤500 Kč
tax-deductible promotional gift, reversing a 2023 consolidation carve-out. **Signal:** a parallel
**SPD amendment on unrelated legislation reportedly already delivered the wine half** (17 Jul 2026),
so tisk 40 now mainly carries the beer clause. Institutional (not personal) "conflict": a region
using national law to favour Moravian viticulture (some wineries sold 40%+ of output as promo gifts)
— openly disclosed.

### tisk 115 — Babiš criminal-code amendment (Opus, conf 5) — **highest-scrutiny, honest low**
Re-criminalises intentional non-payment of child support >4 months (§196 trestní zákoník), reversing
zák. 270/2025 which had freed 500+ prisoners. Sponsored by Babiš + Válková (criminologist) + Malá
(ex-justice minister). **The forensic question was sharp** — Babiš holds massive AGROFERT
state-contract exposure (Synthesia 797M, Kostelecké uzeniny 202M) and a documented subsidy-fraud
history (Čapí hnízdo). Finding: the amendment touches **only child-support enforcement** — nothing
on economic crime, subsidy fraud, damage thresholds, or limitations. Direction is *more* criminal
liability, not less. Honest **low**. **Unstated (watch-item):** opening the criminal code creates a
vehicle to which germane economic-crime amendments could be attached at committee/2nd reading;
written amendments were tabled for the 27th session — flagged, not alleged.

## Cross-cutting signals (the batch's real yield)

1. **Title-regex `amends` undercounts** (tisk 4: 4 real vs 1 recorded). The graph's bill→law edges
   miss statutes amended in the body but not named in the title. → `[[contradictions]]` + a data fix.
2. **Legislative-drafting collision** tisk 120 ↔ 244 (§35ba renumbering). A genuine cross-unit
   discovery only visible because the loop reads sibling bills together. → `[[patterns]]`.
3. **Omnibus riders hide under a headline title** (tisk 4 wine-excise under an income-tax title;
   tisk 40 beer added beyond the stated wine scope). → the "quiet rider" hypothesis, confirmed.
4. **Enacted ≠ young term** (tisk 119 completed the full process incl. Senate + President). The term
   is *mixed*: some prints are enacted, most are in committee. Bears on vote-linkage feasibility.
5. **Lobbying-footprint disclosures are now in the DZ** (tisk 120 PAQ Research) under zák. 168/2025 —
   a new, structured, citable transparency surface worth ingesting.
6. **`sponsor_contract_czk` is a poor conflict proxy** — saturated by municipal-board roles
   (ARENA BRNO, Pražské služby, Operátor ICT, ČEPRO are all publicly-owned). 8/8 flagged, 0 real.

## Coverage

- Units this batch: **8 / 141** (5.7%). Cumulative forensic-covered: **9 / 141** (incl. tisk 58 batch-0).
- Severity histogram: low 8, medium 0, high 0.
- Signal yield: **2.0 / unit** (army self-scored; all story-worthy-but-low-conflict).
- Skips/truncation: none — all 8 targets fully processed; every bill's DZ PDF fetched (pdftotext).
