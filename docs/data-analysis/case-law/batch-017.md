# Batch 017 — verdict wave 85/12/47/131/135/193/260/50/110/72 · structural jargon gate · §-level sector attribution (pass 51)

Date: 2026-08-05. Driver + 3 Sonnet verdict groups + fresh Opus auditor (three
rounds). Coverage after this batch: **99/141 bills carry a gated verdict**
(22 medium), all `pending_review`. Store writes: pass 51 = 10 verdicts +
25-string retroactive jargon sweep over 15 nodes (`jargon-sweep-017`). Backup:
`.pglite-backup-20260805-pass51`. Probe EXPECT: `withF: 99`, passes `…,50,51`.

## Verdicts — 10 (4 medium / 6 low)

- **12 & 131 (medium ×2) — the headline.** Tisk 131's Čl. I is a **word-for-word
  subset** of tisk 12's Čl. I: 8 of 15 points byte-identical under machine
  comparison (re-derived independently by the auditor), no provision 12 lacks.
  Same senate sponsor (Canov), filed four months apart, neither DZ mentions the
  other (grep-backed), different transitional regimes and effective dates —
  before the October 2026 municipal elections. The 68⊂90 containment shape, third
  occurrence in the corpus. Verdict-12 enumerates all SEVEN omitted points incl.
  bod 5 (§ 45/4 preferential-vote threshold), and „neproveditelná" is
  differentiated: full-replacement points would re-enact identical text.
- **85 (medium).** Juchelka's 85↔88 pair carries **five** incompatible
  instruction pairs (byte-identical § 21/2/e deletion; conflicting bod-12
  insertions into § 7/2/h; three mutually-destructive rewrites of Čl. LXIII of
  152/2025 incl. 1. května vs 1. srpna 2026). Cross-row money disclosure with the
  attribution rule honored: 4 819 108 Kč attributable (owner-operator pair)
  stated separately from the ČT/ČRo steward ties (institution's money, registry
  unconfirmed, never attributed).
- **260 (medium).** Bod 15's +5 re-lettering of § 16/2 silently moves the address
  tisk 7 amends (old n) → new s); tisk 7's own text supplies the letter's content
  (ÚDHPSH remote access). Bod 30 correctly read as PRESERVING the
  vrcholné-vedení carve-out (relocated; DZ: „věcně se nemění") on § 53's
  profit-share payout prohibition.
- **47 (low) + the 47↔217 companion ruling.** Tisk 47 IS the constitutional
  companion tisk 217's DZ names (four-way confirmation incl. the deliberately
  identical 1. 7. 2026 date). The gap effect became a coordination observation;
  the two verdicts now tell one story.
- **72 (low).** The real finding is the bill's INTERNAL tension: § 67/2's
  blanket-worded exemption sentence vs its own §§ 54(5)/(6) caps that bind the
  Speaker; only the president and members of government stay uncapped (čl. 38/2
  Ústavy noted). Babiš's June-2026 předseda-vlády position (from tisk 260's
  signature block in this corpus) disclosed against the k-datu-podání framing.
- **193 (low).** Single-incumbent reading of the <3 % AOS cap (EKO-KOM correctly
  NOT named — the corpus doesn't carry it); all DZ locations verified against
  measured offsets after the audit found three misattributed (two swapped).
- **50 & 110 (low ×2).** Coordinated Jurečka pension package; fiscal profiles
  stated with the decline path (2,3 mld peak → 1,3 mld po 25 letech), no
  combined-figure extrapolation. **135 (low)** clean on first audit.

## The audit cycle (the real story of this batch)

Fresh Opus audit: **5 BLOCKING / 12 MAJOR / 14 MINOR** — including the
steward-money class RECURRING in 3 verdicts (~119,7 mld Kč attributed across 5
citations before remediation, a 4 800× overstatement in Juchelka's case), a
subset count that didn't close (15−8=7, both verdicts said six), three DZ
locations exactly swapped, a cross-verdict contradiction (47 asserting the gap
217 filled), and a misread safeguard replacement in 260. All remediated
driver-side; the closure check (round 2) then found the remediation itself had
introduced the batch's sharpest lesson:

**M9b — asymmetric dispositions.** The sector-attribution payload's first
adjudication map disclosed only EXCULPATORY closures and withheld the two
adjudications that cut against sponsors (verdict-67's credible 100/2001 channel;
verdict-221's medium). Accusation-by-omission, inverted. The final payload
carries dispositions on **29/29 rows** (every flagged bill has a published
verdict), inculpatory and exculpatory alike, with the count derived, never a
prose literal.

**M11 — data correction beats disclosure.** Insertion instructions („Za § N se
vkládá nový § M", both word orders) are now corrected IN the census: inserted §§
operative, anchors demoted unless independently amended. 333 corrections
corpus-wide (3 166→3 317 operative bill→§ pairs), and the corrections
resolved two extractor-vs-graph disagreements (48→46), corroborating the
direction of trust. Tisk 221's rows now ship § 14r (the provision its verdict
turns on) operative and `diagnosticsClean: true`.

Round 3: **CLOSED.** One non-blocking gate over-rejection (sentence-initial
„Dávka 12 mSv") fixed same-session with the capitalized nominative pinned.

## Artifacts

- `lib/analysis/law-verdict.ts` — structural rules hardened at closure: global
  camelCase rule (every match clears the allowlist — the first-match `continue`
  let one allowlisted name void the gate for the rest of the sentence),
  `[\p{L}\p{N}_]*` tail (eSbírka/eObčanka were dead entries), unit symbols
  allowlisted, `scan`/`steward` bounded to bare tokens (Scania/stewardka pass),
  bare `amends`/`pending` gated, unicode snake rule, prop-shape extensions,
  dávka-with-unit dose/benefit filter. 19 tests.
- `payloads/batch-017-jargon-{scan,sweep}.json` — the widened detector found
  **25** live strings (18 before the amends/pending rules); all swept under the
  digit + syntax invariants, 0 residual issues. Store-wide manifestation after
  pass 51: **0 withheld reader-facing fields on 99 verdicts**.
- `payloads/batch-017-amended-paragraph-census.json` — the census regeneration
  under its OWN filename (the committed batch-016 artifact restored untouched —
  overwriting a committed payload in place is an undisclosed rewrite);
  `partitionFallback` + `insertionCorrections` per row, corrected method note
  (bills with NO Čl. headers collapse).
- `payloads/batch-017-sector-attribution-para.json` — 29 flags / 27 with
  operative §§ / 29 with verdict dispositions; every row `derived-ungated` with
  per-bill extractor diagnostics; fallback rows publish no § lists at all.
- `payloads/batch-017-verdicts-combined.json`, `verdicts-017/…`,
  `batch-017-audit.md` (the three-round record), ledger `batch017Verdicts`.

## Carried forward

- 42 bills still without a verdict.
- Evidence-coordinate migration for pre-016 verdicts (transcript line refs
  survive in e.g. verdict-217) — flagged again by this audit as the contrast.
- The sector-attribution surface on /zakony (build phase): the payload is ready,
  incl. the doctrine that a rendered flag must carry its disposition.
- N4 line-number question and the 012⊂131-style dependency handling on
  /zakony/kolize remain open from earlier batches.
