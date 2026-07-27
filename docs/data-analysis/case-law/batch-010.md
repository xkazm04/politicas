# Case ③ Law loop — batch 010 (2026-07-27)

Solo run. Analysis on `.pglite-copy-law-010`, a read-only copy of the live store; **no live
`.pglite` writes**. Subagents unavailable (operator instruction), so this is a single focused
audit rather than a wave.

**The pass in one line:** batch-009's re-triage reported the case's primary conflict signal
doubling (5 → 12 bills). Before writing a single verdict on it, this batch asked whether that was
real. The answer is *mostly yes, and one company in it was wrong* — a municipally-owned waste
company mis-classified as private finance, driving four false conflict flags against one MP.

---

## 1. Why this and not forensic verdicts

The obvious next pass was to run the refreshed triage head through the forensic gate — 114 of 141
bills carry no verdict. It was not taken, deliberately: the triage head is *ordered by* a
conflict signal that had just doubled for a reason nobody had checked. Writing verdicts on an
unvalidated ranking is how this case produced its two falsified signals. The kernel's own rule —
*validate discriminative power before it ranks anything* — applies to a signal that changes,
not just to a new one.

## 2. The hypothesis: union inflation — **confirmed as a phenomenon, falsified as the cause**

`triage-core.ts` builds a bill's domain set from the union of its title plus **every** amended
law's ref and label, then flags a conflict when any sponsor's private company's sector appears
anywhere in that union. As the `amends` topology grew, so did the union:

| amends | mean domains matched (of 10) | title-only |
|---|---|---|
| 0 | 0.73 | 0.73 |
| 1–2 | 0.76 | 0.56 |
| 3–5 | 1.66 | 0.62 |
| 6–15 | 3.05 | 0.68 |
| **16+** | **8.25** | 0.75 |

Tisk 77 matches **9 of 10** sectors; tisk 67 matches 8. At that width a bill adjacency-matches
essentially any sponsor company — textbook degeneracy, and it looked like the whole explanation
for 5 → 12.

**It wasn't.** Re-scoring with *attribution* — the company's sector must be carried by a **named**
amended law's own label, not merely appear somewhere in the union — dropped **0 of 12**. Every
flag had a specific attributable statute. The sector buckets turn out not to be degenerate either:
`economy` matches 15% of the 288 law nodes, every other bucket 1–11%, and **47% of laws match no
domain at all**.

So: the inflation is real and will bite as `amends` grows further, but it is not what produced the
doubling. Recorded as a null for my own hypothesis, with the same weight a confirmation would get.

## 3. The real defect: a municipal waste company classified as private finance

Reading the surviving flags, one entry did not look right — `SOMPO, a.s.` sat in
`SECTOR_OVERRIDES` as `"economy"` with the comment `// insurance/finance`. It is neither.

Verified against primary registries rather than assumed (the case's web-research doctrine —
ARES/VR outranks everything, and a negative from the plain endpoint is not a negative):

- **ARES** (IČO 25172263): NACE **38** and **38210** — waste collection and treatment.
- **ARES VR**: *Město Pacov* acquiring shares in the 2005–2006 capital increases; **MP Lukáš
  Vlček chairman of the board since 2024-12-03**.
- **Company record**: SOMPO was **founded in 1997 by 117 member municipalities as its
  shareholders**, successor to the municipal association for waste management; a *dobrovolný
  svazek obcí Sompo* exists to represent those 117 municipal shareholders.

So the MP's tie is a **board seat in a municipally-owned company** — precisely the class
batch-001 proved degenerate and this case's skill instructs excluding. Moved to
`MUNICIPAL_SOE_EXPLICIT`, where `isMunicipalOrSoe()` short-circuits before `sectorOf()` is
reached. Same city-name-derived-acronym gap that hid `CHOMUTOVSKÁ BYTOVÁ a.s.` until batch-002,
and worse, because this one was also mis-sectored.

**Impact: sectorAdjacencyHits 12 → 8. Four false conflict flags removed (tisky 56, 69, 120, 206)
— all four on the same MP.**

### 3a. It had not reached a reader, and one thing was already right

`sectorAdjacency` lives in `ledger.json` and no loader reads it, so **no false conflict claim was
published**. It was ordering the work queue through `triageScoreV2`, and would have become a
public claim the moment anyone rendered it. Stated plainly rather than framed as a near-miss.

More interesting: tisk 120's **published** forensic verdict already characterised SOMPO correctly
— *"drobné společnosti typu městských/komunálních"*. The analyst prose was right and the
deterministic classifier was wrong. That is the opposite of this case's usual failure direction,
where code is right and prose overclaims, and it is worth remembering before assuming the
machine-checkable artifact is the trustworthy one.

## 4. What ships anyway: attribution

The attributed computation (`sector-adjacency-010.ts`) is kept even though it changed no counts,
because it changes what a flag can *say*. Each surviving flag now names the statute that puts the
sponsor in the bill's path — "CS CABOT (environment) via 100/2001, the EIA act" rather than
"environment appears somewhere among 42 amended statutes". That is the difference between a
checkable claim and an unfalsifiable one, and it is the law-level increment of the §-level rework
deferred since batch-004. It still does not reach individual §s; that needs an amended-§ census.

## 5. The 8 survivors

Legible adjacencies, strongest first — these are *leads for the forensic gate*, never verdicts:

- **tisk 67** (Babiš et al., stavební zákon, 42 amends) — CS CABOT (environment) via 100/2001
  EIA; Kostelecké uzeniny / Lovochemie / AGROPROFIT / AGRONOVA (agriculture) via 139/2002 land
  consolidation; Fatra, Synthesia (environment) via 100/2001.
- **tisk 221** — AGROCENTRUM JIZERAN (agriculture) via 252/1997 agriculture act.
- **tisk 121** — Teleky Medicus (health) via 187/2006 sickness insurance.
- **tisk 77** — NEXNET (digital) via 12/2020 digital services.
- Plus tisky 11, 103, 154, 201, whose ties are `economy`-bucket and correspondingly weaker.

## 6. Not done — disclosed

- **No new forensic verdicts.** The 27 stand; 114 bills remain unassessed. That is the next pass,
  and it can now run on a signal that has been audited rather than assumed.
- **The union inflation is unfixed**, only shown not to be biting yet. It should be fixed before
  `amends` grows again — the attributed path in `sector-adjacency-010.ts` is the fix, it just is
  not wired into `triage-core.ts` scoring.
- **No systematic ARES audit of the other flag-driving companies.** SOMPO was found by reading;
  the rest were not re-verified against the registry. A full pass over `SECTOR_OVERRIDES` is owed.
- **76 collision pairs** still unread, prioritised in `batch-009-collision-sweep.json`.

## 7. Files

New: `scripts/case-loops/law/sector-adjacency-010.ts`,
`docs/data-analysis/case-law/payloads/batch-010-sector-adjacency.json`, this note.
Modified: `scripts/case-loops/law/company-sectors.ts` (SOMPO → municipal, with its sources
inline), `scripts/case-loops/law/retriage-009.ts` (a `--batch=` arg so the merge-preserving
re-triage is reused by later batches rather than copied), `docs/data-analysis/case-law/ledger.json`
(141 rows recomputed, 25 hand-written blocks preserved, `batch010SectorAdjacency` added).
