# Batch 020 — verdict wave 35/208/48/138/130/99/199/82/42/36 · the /zakony sector surface ships (pass 54)

Date: 2026-08-06. Driver + 3 Sonnet verdict groups + 1 build agent + 1 remediation agent
+ fresh Opus auditor (two rounds). Coverage after this batch: **129/141 bills carry a
gated verdict** (3 medium / 7 low this batch). Store writes: pass 54 = 10 verdicts.
Backup: `.pglite-backup-20260806-pass54`. Probe EXPECT: `withF: 129`, passes `…,53,54`.

## Verdicts — 10 (3 medium / 7 low)

- **42 (medium) — the two-track Prague pursuit, closed from both sides.** Confirmed:
  tisk 42 (Zastupitelstvo hl. m. Prahy, čl. VIII bod 1 zákona č. 465/2023 Sb.) IS the
  parallel bill published verdict-49 documented — the same practical goal (extending the
  expiring Prague ring-road EIA opinion) via a different statute, criticized by the
  minister for its nationwide, category-based reach. The audit forced precision the first
  cut lacked: tisk 42 PREDATES tisk 49 by a week, so its DZ could not have referenced it
  (the omission accusation was chronologically impossible and is gone), and the „shared
  referral date" is a session-batched scheduling artifact, disclosed as such.
- **82 (medium).** Zákon o podpoře bydlení (175/2025) amended within a year of enactment
  under a „čistě technická, technologická a implementační, nikoli koncepční" framing that
  its own budget table undercuts by a precise 185 mil. Kč (790 → 605, with the 605
  figure's own condition stated); signed 11–12 days after the law took effect.
- **130 (medium).** The scrivener's-error find: the transitional provisions cite „zákon
  č. 95/2024 Sb." where the amended 95/2004 is meant — and 95/2024 happens to be a real
  statute, so no citation gate can catch it; plus a deferred-reaccreditation gap.
- **Lows**: 35 (the sponsors' pay-freeze lowers their own salary growth — the
  self-interest runs backwards; urgency premise already lapsed), 208 (drug-policy board
  made obligatory; the government's later nesouhlas stated as the plain 25-day sequence
  it is), 99 (registry-of-contracts: the advance-notice window lets pre-cutoff
  natural-person contracts permanently escape publication), 48, 199 (the bill's own DZ
  admits a national disclosure duty beyond the EU text it transposes), 138, 36.

## The audit cycle — the chronology rule

Round 1: **6 BLOCKING / 11 MAJOR** — re-inflected quotations (fourth consecutive batch;
now including one inside a citation field), two accusations of omission that were
CHRONOLOGICALLY IMPOSSIBLE (faulting a DZ for not mentioning a bill distributed a week
later; faulting a May-signed DZ for a June government position), wrong/uncited dates on
the batch's headline pairing, and a false interval („dva měsíce" for eleven days). A
dedicated remediation agent worked from the audit file under the accumulated method
rules and its own 98-quotation self-sweep caught hidden re-inflections beyond the
audit's list; round 2 CLOSED with an independent 99-span sweep corroborating
(0 fabricated / 0 re-inflected / 0 spliced / 0 imported), plus two same-commit string
fixes (208's machine tokens → Czech; the new build copy's own „pipeline" token failing
the repo's own gate — the gate caught its own disclosure sentence).

**The rule this batch adds:** an omission claim needs a COULD-IT-HAVE-KNOWN check —
grep is necessary but not sufficient; the accused document must postdate the thing it
allegedly ignores. Both instances survived three verdict groups and the driver because
nobody compared signature dates.

## The build — /zakony sector attribution ships

`features/lawwatch/sectorAttribution.ts` (+13 tests) · `loadSectorAttributionIndex()`
in getLawData · `SectorAttributionBlock` in BillDetail · `lawwatch.sector.*` +
`lawwatch.detail.sectorAttribution.*` messages · the feature's first messages test.
8 of 141 bills render their flags: company + sector + statute, operative §§ where the
census isolated them, the verdict DISPOSITION verbatim (batch-017's M9b doctrine on the
reader's screen), and the `ungated` label imported from /overeni's gateVocabulary — one
vocabulary, not a copy. At closure the failure mode was corrected from drop to
DISCLOSE: a flag whose disposition fails the language/jargon gates renders with a
withheld-sentence, never vanishes and never shows the failing text. Deferred (recorded
in the audit): a drop count in the loader, `diagnosticsClean` on the wire, the wire
projection.

## Artifacts

`payloads/verdicts-020/…` + `batch-020-verdicts-combined.json` · `batch-020-targets.json`
+ `prepare-batch-020.ts` · `batch-020-audit.md` (two rounds + two independent quotation
sweeps) · the build files above · ledger `batch020Verdicts`.

## Carried forward

- **12 bills remain** — the final verdict batch (021) closes the corpus.
- Build deferrals: drop count, diagnosticsClean, wire projection for the sector block.
- The 82 elided-qualifier lesson: the exculpatory-inverse rule applies at CITATION
  granularity too — a marked elision that drops a qualifier cutting in the bill's favour
  is the same class one level down (fixed this batch; worth a gate idea).
