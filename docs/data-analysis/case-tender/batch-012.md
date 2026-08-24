# Tender batch 012 — the electoral arena: signals meet the ballot

Case ④ needles · 2026-08-24 · **pass 74** (5 240 authority nodes,
`tender_authority_category` + `electoral_arena`, ns=arena). Evidence
`arena-census-cpv45-*.json`. First batch of the **synthesis track** (user
decisions R1–R4, recorded in STATE).

## 1. The bridge that was already in the data

The voter's question — „whom should I distrust on *my* ballot?" — needs a link
from authority behavior to the election that holds the authority accountable.
RVZ carries it: `kategorie_zadavatele`, parsed by `isvz.ts` since b002 but
never persisted. Recovered from the local NDJSON (no downloads — pure
post-processing per R4), last-snapshot-wins per IČO:

| arena | authorities | lots | flagged | CZK floor |
|---|---|---|---|---|
| **statni** (sněmovní volby) | 539 | 21 211 | 6,1 % | 90,8 mld. |
| **krajske** (krajské volby) | 2 006 | 18 768 | 7,7 % | 117,2 mld. |
| **komunalni** (komunální volby) | 1 521 | 7 506 | **3,7 %** | 48,6 mld. |
| **nejasne** (ownership hop needed) | 1 575 | 13 898 | **10,0 %** | 134,8 mld. |

93 % of authorities mapped deterministically; 401 carry no category (disclosed,
unmapped — absence ≠ zero).

## 2. What the census says before any composition

1. **Havířov is an outlier, not the norm** — the komunální arena has the LOWEST
   signal share (3,7 %). That sharpens every municipal finding: a conveyor city
   sits at 9× its arena's baseline, and the baseline is now a citable number.
2. **The biggest money is in the unresolved class** — 134,8 mld. of CZK floor
   sits with „Jiná právnická osoba / Jiný zadavatel": state enterprises (ŘSD
   6 845 lots, Správa železnic, Lesy ČR) and city companies (TSK Praha). Their
   category legally hides their principal; an **ownership hop resolves them**
   (the money case's `public-body.ts` legal-form machinery + ARES), and until
   then they render as „nejasné", never guessed.
3. Krajské arena is the largest by money among the resolved (117 mld.) — mostly
   příspěvkové organizace krajů (hospitals, road maintenance).

## 3. The synthesis doctrine (answers R1 — recorded for every batch after this)

A **finding (nález)** is the composed object between signals and the reader:

```
finding = arena (who answers for it, at which ballot)
        × term window (decided_on inside the responsible term)
        × shape (species / circle / dependence / signal mix, all persisted)
        × evidence bundle (every input, threshold, and register link)
```

Rules are deterministic; candidates are **hand-read before persisting** (the
kernel gate, unchanged); the rendered language is „otázky pro zastupitele /
radu / ministerstvo" — questions the reader can ask the accountable body,
never accusations. Person names appear ONLY via the existing gated /penize
lane. Draft rule set for b013's composer:

- **N1 konvejer** — komunalni/krajske authority, conveyor species, signal share
  ≥ 3× arena baseline, ≥ 1 fully-dependent supplier.
- **N2 dvorní dodavatel** — circle3_share high with LOW switch_rate (lock).
- **N3 rotace** — circle3_share high with HIGH switch_rate.
- **N4 krátké lhůty jako praxe** — authority's short_deadline share far above
  arena baseline (per-class thresholds already computed).

Coverage note that makes findings election-clean: the corpus (2024-12 →) sits
**entirely inside the current municipal term** (elected autumn 2022) and the
current regional term (autumn 2024, krajské signals from then on) — no shape
leaks in from a previous council.

## 4. Decisions recorded (user, 2026-08-24)

- **R1**: new module approved; the gap is synthesis → this track exists.
- **R2**: name **„Radar zakázek"** approved.
- **R3**: UX north star is **lookup-first** — „Kde volíte?" → your
  municipality/region's radar and findings; the national board is context, not
  the entry. Board loudness acceptable within species.
- **R4**: no new data campaigns until post-processing yields clear benefits;
  then full power to UI/UX. (CPV 72 postponed accordingly.)

## 5. Next (b013)

1. Resolve the „nejasne" class by ownership/legal form (ARES právní forma —
   státní podnik → statni; city-owned a.s. → komunalni; sector buyers stay
   disclosed).
2. Build `compose-findings.ts` on rules N1–N4, hand-read the candidates, and
   decide the finding's graph representation (new node kind vs props layer)
   before any persist.
