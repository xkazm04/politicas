# Batch 021 — the corpus closes: 141/141 (pass 55)

Date: 2026-08-06. Driver + 3 Sonnet verdict groups + 1 remediation agent + fresh Opus
auditor (four rounds). **Coverage: 141/141 — every PSP10 bill in the graph carries a
gated forensic verdict**, all `pending_review`, all rendering with zero withheld
reader-facing fields. Store writes: pass 55 = 12 verdicts. Backup:
`.pglite-backup-20260806-pass55`. Probe EXPECT: `withF: 141`, passes `…,54,55`.

## Verdicts — 12 (6 medium / 6 low; the filed `high` demoted at audit)

- **101 (medium, filed high).** Non-conviction-based confiscation of unexplained wealth:
  10-year lookback, semi-shifted burden of proof, retroactive reach argued via ECHR/ÚS,
  RIA skipped per the government's legislative plan, and the print's own admission
  „neuplatní se zásada presumpce neviny" (now quoted). Demoted per the batch-018
  precedent: everything grave is stated and defended by the drafter; the loop grades
  UNSTATED effects — the carrying mechanism is § 12's unreviewable prosecutorial
  discretion not to file.
- **76 (medium).** An MP bill replacing the whole civil-service framework (234/2014)
  with private-law employment — government-scale reform with no RIA, no comment round,
  and reduced administrative-court review.
- **63 (medium).** The new accounting act: „no significant financial impact" one
  sentence before admitting unquantified one-off costs; 39 decree delegations counted.
- **55 (medium).** ČTÚ pricing-dispute decisions final with no rozklad/review; an
  undefined Defence/Interior critical-infrastructure carve-out via opatření obecné
  povahy.
- **116 (medium, filed low).** Repeal of the nomination law — the audit found the real
  unstated effect the verdict missed: the safeguard migrates to „interních pravidel
  vlády", running processes finish outside the regime, no legisvakance, no transitions.
- **144 (medium).** The new aliens act resurrects PSP9's tisk 782/0 with a January-2024
  RIA declared „nadále platné" verbatim; discontinuance grounds chosen over rejection
  expressly to skip a notice step; a ~1/3 late-processing admission with digitization as
  the only fix.
- **Lows**: 6 (ONE PACKAGE with tisk 7 — same filing minute-pair, reciprocal
  cross-listing; the capture-channel design pre-exists in §§ 19c/19e and the bill
  preserves it; graded against its low companion), 114 (demoted from medium — both
  load-bearing findings were falsified by the print, which HAS a privacy section and
  grounds the secrecy breach in čl. 13(2)/25(4) CBAM; the surviving „není clem ani
  daní" vs daňový-řád tension carries a low), 98 (a tripled fine ceiling surfaced only
  in the paragraph commentary), 52, 87, 129.

## The audit cycle — four rounds, and the remediation-regression lesson

Round 1 blocked on 8 groups: quotation defects (fifth consecutive batch), two findings
falsified by the print (114), a fabricated procedural history (144), verb/date
inflation, an unearned high, an intra-batch contradiction (87↔76 on the same ties),
SOMPO misclassified against four published verdicts, and an empty-effects verdict that
had missed the print's own strongest admission (116). Rounds 2–4 each surfaced a defect
INTRODUCED BY THE PREVIOUS FIX: a fabricated authority written outside quote marks
(S1 — invisible to the quotation sweep), then two Czech dates split at the ordinal dot
by an automated insertion (S2a — invisible to all three validators). The auditor's
closing observation, worth its weight: **on this corpus, remediation is a defect source
at roughly the rate authorship is.** Two detectors join the standing battery because of
it: the NAMED-AUTHORITY rule (any document title/act/programme statement outside quote
marks needs a cached-source hit or its own citation) and the DATE-SPLIT regex
(`\b\d{1,2}\.\s+[A-ZÁ-Ž]` over reader-facing prose, with known numbered-list false
positives).

## The sponsor-prop discovery (upstream, carried)

G1 found — and the audit scoped corpus-wide — that the graph's `sponsors` prop
(`psp-tisky-roles`, pass 34) is wrong in two shapes: over-inclusion (tisk 116: 6 names
vs the print's 3) and a wrong join (tisk 87: 42 cross-club names, the real submitter
absent). 3 `mp` bills carry n>1, 23 carry an empty array beside a named submitter.
**No published verdict misattributes sponsorship** — the audit sampled three earlier
batches and all match their prints' signature blocks; the three affected batch-021
verdicts use only print-verified names and disclose the discrepancy. Carried forward:
the prop regen (its own pass + audit) and the free `sponsors`-vs-`submitter` detector.

## The corpus, closed — eleven batches (011–021), passes 45–55 of the law track

141 gated verdicts (0 high / 34 medium / 107 low at close), every one Czech,
gate-validated at persist AND render, quotation-swept, and citing psp.cz coordinates.
Around them: the collision census (176 pairs, /zakony/kolize), the amended-§ census
(3 317 operative bill→§ pairs with insertion correction), the dependency and
sector-attribution surfaces on /zakony, the evidence-coordinate and summary-source
migrations (0 cache paths or line refs anywhere in the reader-facing layer), and the
jargon/language gates hardened through eleven adversarial audit cycles. The named
failure classes the loop learned to catch, in the order it paid for them: pipeline
jargon; English prose; fabricated statutes; steward-money attribution; §/count
precision; quotation fabrication/re-inflection/splicing/importing; DZ-section
misattribution; accusation-by-omission and its exculpatory inverse (down to marked
elisions); cross-verdict contradiction; sweep-introduced corruption; asymmetric
dispositions; node-ids-as-tisk-numbers; field-parallelism breaks; chronologically
impossible omissions; procedural-verb inflation; fabricated authorities outside quote
marks; automation-split dates. Every verdict remains `pending_review` — the human gate
was never delegated, and the corpus is a queue for it, not a substitute.

## Artifacts

`payloads/verdicts-021/…` + `batch-021-verdicts-combined.json` · `batch-021-targets.json`
+ `prepare-batch-021.ts` · `batch-021-audit.md` (four rounds) · ledger
`batch021Verdicts` (coverage 141/141).
