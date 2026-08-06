# Case ③ Law loop — handoff at corpus close (batch 021 / pass 55, 2026-08-06)

> The batch-009 handoff is preserved verbatim as `handoff-batch-009.md` (its predecessor
> as `handoff-batch-008.md`). This handoff supersedes both for orientation purposes; the
> per-batch notes `batch-011.md` … `batch-021.md` + `batch-*-audit.md` are the full record.

## State: the verdict corpus is COMPLETE

**141/141 PSP10 bills carry a gated forensic verdict** (0 high / 34 medium / 107 low),
written across batches 011–021 (law passes 45–55), every one:

- Czech, validated by `lib/analysis/law-verdict.ts` at persist AND at render
  (`features/lawwatch/getLawData.ts` withholds on the same gates — live: 0 withheld
  reader-facing fields);
- quotation-swept against the NFC-normalized text cache (verbatim or paraphrase-outside-
  marks; marked elisions may not drop bill-favourable qualifiers);
- citing psp.cz structural coordinates (0 cache paths, 0 transcript line numbers,
  0 PDF filenames anywhere in the reader-facing layer — migrated at passes 52–53);
- **`pending_review`** — the human gate was never delegated. The corpus is a QUEUE for
  human review, not a substitute for it.

Around the verdicts: the collision census (176 partitioned pairs; /zakony/kolize renders
136, 63 confirmed), the amended-§ census (3 317 operative bill→§ pairs, insertion-
corrected, batch-017/018 filenames), the dependency surface, and the sector-attribution
surface (batch-020 build: dispositions verbatim, gate failures disclose, /overeni's
ungated vocabulary imported).

## The verification doctrine, as built (what a future batch MUST keep)

1. Closure gates the write: no live persist until a FRESH Opus auditor returns CLOSED on
   the final file state; the driver's own gates are necessary, never sufficient.
2. `provenance-probe.ts` at every batch start/end (EXPECT currently
   `{withF: 141, laws: 293, amends: 582, passes: 45–55}`); named `.pglite-backup-*`
   after every persist; every write replayable from committed payloads.
3. The named failure classes, in the order the loop paid for them: pipeline jargon;
   English prose; fabricated statutes; steward-money attribution; §/count precision;
   quotation fabrication/re-inflection/splicing/importing; DZ-section misattribution;
   accusation-by-omission + the exculpatory inverse (to marked-elision granularity);
   cross-verdict contradiction; sweep-introduced corruption; asymmetric dispositions;
   node-ids-as-tisk-numbers; field-parallelism breaks; chronologically impossible
   omissions; procedural-verb inflation; fabricated authorities OUTSIDE quote marks;
   automation-split dates. The last two are batch-021's: **remediation is a defect
   source at roughly the rate authorship is** — re-audit fixes at full depth.
4. Standing detectors beyond the code gates: the quotation sweep; the named-authority
   rule (titles/acts/programme statements outside quote marks need a cached-source hit
   or a citation); the date-split regex (`\b\d{1,2}\.\s+[A-ZÁ-Ž]`, numbered-list false
   positives known); the `43\d{3}` node-id scan; the could-it-have-known chronology
   check before any omission claim.

## Open items, priority order

1. **The graph `sponsors` prop is wrong (upstream, pass 34 `psp-tisky-roles`)** — two
   shapes: over-inclusion (tisk 116: 6 names vs the print's 3) and a wrong join (tisk
   87: 42 cross-club names, real submitter absent); 3 `mp` bills with n>1, 23 with
   `[]` beside a named submitter. No published verdict misattributes sponsorship (the
   affected three use print-verified names and disclose the discrepancy). Needs its own
   regen pass + audit, plus the free `sponsors`-vs-`submitter` consistency detector.
   Any surface reading `sponsors` directly (check /zakony sponsor chips) inherits the
   defect until then.
2. **The human review gate** — 141 verdicts await it; the review console pattern exists
   on /penize (`review_audit`, reversible decisions). Designing the law-side gate is a
   product decision, not a batch.
3. Sector-surface build deferrals (batch-020 audit): drop count in the loader,
   `diagnosticsClean` on the wire, the wire projection.
4. Verdict-106's platné-znění annex carries one § 9o cross-reference (the § tisk 107
   would need) — a census/collision footnote if either bill moves.
5. Older-batch minors the audits explicitly left (each named in its batch's audit file);
   none publishes a false claim.

## Rebuild-from-zero pointers

Target prep: `prepare-batch-0NN.ts` (clone-and-edit chain, 017→021). Gate:
`gate-verdicts-011.ts --batch=0NN`. Persist: `kg-forensics.ts --write
--verdicts=<combined> --pass=NN --commit`. Ledger: `update-ledger-011.ts --batch=0NN
--pass=NN`. Sweeps: `sweep-old27-015.ts` (jargon, parameterized),
`evidence-coordinate-{scan,apply}-018.ts`, `summary-source-migrate-019.ts`. The store
incident of 2026-08-05 (a concurrent session restored `.pglite` from a stale backup)
is why the probe and the replayable-payload rule exist — see
`memory/live-store-can-be-restored-under-you.md`.
