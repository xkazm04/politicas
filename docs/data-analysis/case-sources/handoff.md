# Handoff — batch 006, kiosek.justice.cz/opendata ingest slice

Fleet run. Boundary respected: only touched `lib/ingest/sources/kiosek*`,
`scripts/case-loops/sources/` (new dir), `docs/data-analysis/case-sources/`
(new dir), `package.json`/`package-lock.json` (one new dependency, `unpdf`),
and `.gitignore` (one new entry, `.kiosek-cache/`). No live `.pglite` write,
no shared vault file (`frontier.md`, `feature-opportunities.md`,
`graph-log.md`, `patterns.md`, `contradictions.md`) edited, `lib/analysis/
kg-verdict.ts` not edited (additions proposed below only). No commit made.

See `batch-006.md` for the full scope/yield/classifier note. This file is
the orchestrator-facing summary: payloads, schema additions, commit plan,
lessons learned.

## Files created / modified

New:
- `lib/ingest/sources/kiosek.ts` — the adapter (types, pure parsers,
  classifier, statute/IČO extractors, throttle helper, IO wrappers).
- `lib/ingest/sources/kiosek-pdf.ts` — `unpdf`-backed PDF text extraction,
  isolated so the pure parsers stay dependency-free/testable.
- `lib/ingest/sources/kiosek.test.ts` — 21 tests, all passing.
- `scripts/case-loops/sources/kiosek-slice.ts` — builds the bounded slice
  (parses all 2,302 postings' metadata, extracts 23 PDFs, writes
  `docs/data-analysis/case-sources/kiosek-slice-extract.json`).
- `scripts/case-loops/sources/kiosek-validate.ts` — join-key validation
  against a read-only `.pglite` copy, writes `kiosek-validation.json`.
- `scripts/case-loops/sources/kiosek-build-payload.ts` — builds the gated
  proposal payload, writes `kiosek-payload.json`.
- `docs/data-analysis/case-sources/{ledger.md, batch-006.md, handoff.md,
  kiosek-slice-extract.json, kiosek-validation.json, kiosek-payload.json,
  kiosek-opus-input.json}`.

Modified:
- `package.json` / `package-lock.json` — added `unpdf` (^1.8.0) as the PDF
  text-extraction dependency. No PDF library existed before this batch
  (`grep -i pdf package.json` returned nothing). Chose `unpdf` over
  `pdf-parse` (documented footgun: executes a bundled test fixture on a
  bare `require` of its default entry) and over raw `pdfjs-dist` (the
  heavier, lower-level dependency `unpdf` itself wraps). Pure ESM, no
  native bindings, actively maintained (unjs org).
- `.gitignore` — added `.kiosek-cache/` (raw PDF cache for newly-fetched
  attachments; `.justice-samples/` was already gitignored and reused
  as-is for the 5 pre-cached institutions/PDFs).

## Re-runnable pipeline

```
npx tsx scripts/case-loops/sources/kiosek-slice.ts          # metadata + PDF extraction → kiosek-slice-extract.json
cp -r .pglite .pglite-copy-kiosek
PGLITE_PATH=./.pglite-copy-kiosek npx tsx scripts/case-loops/sources/kiosek-validate.ts   # → kiosek-validation.json
rm -rf .pglite-copy-kiosek
npx tsx scripts/case-loops/sources/kiosek-build-payload.ts  # → kiosek-payload.json (gated proposal)
```

## Join-key hit rates (the headline numbers)

- **Statute citations**: 4/11 distinct extracted citations (36.4%) resolve
  to an existing `law:sb:*` node in the live graph (101 law nodes at
  validation time).
- **IČOs**: 0/23 distinct extracted IČOs (0%) resolve to an existing
  `company:ico:*` node (195 company nodes at validation time, sourced from
  Registr smluv contracts — a disjoint population from kiosek's court
  postings, so 0% is an honest finding, not a defect).

Both numbers are re-derivable via the commands above; `kiosek-validation.json`
lists every resolved/unresolved id explicitly.

## Proposed schema additions (exact text — orchestrator/human applies to `lib/analysis/kg-verdict.ts`)

```ts
// KG_NODE_KINDS — add "notice":
export const KG_NODE_KINDS = ["person", "party", "organ", "bloc", "theme", "company", "contract", "bill", "law", "notice"] as const;

// KG_EDGE_RELS — add "cites" and "concerns":
export const KG_EDGE_RELS = [
  "co_votes_with", "rebels_against", "belongs_to", "about", "owns", "influential_in",
  "linked_to", "supplies", "sponsors", "amends", "assigned_to", "cites", "concerns",
] as const;
```

`notice` props (per node, see `kiosek-payload.json`): `agenda: string[]`,
`institutionCode: string`, `institutionIco: string | null`,
`spisovaZnacka: string | null`, `postingId: string` (the original kiosek
posting URL — the stable dedup key for a future poll-forward harvester).

`cites` (notice → law) and `concerns` (notice → company) edges carry
`rationale` citing the exact PDF text matched. **Do NOT add
`concerns_person_ico`** to `KG_EDGE_RELS` — it is an internal-only marker
`kiosek-build-payload.ts` uses to route natural-person IČO mentions OUT of
the graph proposal (see below), not a rel meant for the graph.

**Caveat on `concerns`**: 5 of the 116 proposed edges (3 distinct IČOs) are
excluded from the `concerns` set entirely — they're court-appointed
liquidators/attorneys with a personal (OSVČ) IČO, not a company (Opus
verification finding, see below). They're present in
`kiosek-payload.json` under `rel: "concerns_person_ico"` purely so the
data isn't silently dropped, but the recommendation is a future `person`
node kind + a `person:ico:*` id space if this class is worth modeling, not
folding them into `company`.

## Payload summary

`docs/data-analysis/case-sources/kiosek-payload.json`: 20 `notice` node
proposals, 116 edge proposals (36 `cites`/`concerns` to existing graph
targets, 75 `cites`/`concerns` to `law:sb:*`/`company:ico:*` ids that don't
exist yet — each flagged `targetExists: false` with a `wouldNeed` note
naming which case owns minting it, never silently dropped — and 5
`concerns_person_ico`, excluded from the money-edge set per the Opus
finding above). **PROPOSAL ONLY — not applied to any `.pglite`.** Requires
the enum additions above before the orchestrator can gate/apply it through
`validateKgVerdict` (which currently rejects the unknown `notice`
kind/`cites`/`concerns` rels by design).

## Opus verification (kernel-required, money-touching claim) — verbatim

Ran via `Agent` tool, `model: "opus"`, instructed to reason at maximum
depth, given the full 23-posting extraction sample
(`kiosek-opus-input.json`: postingId, title, spisovaZnacka, agendas, all
statute citations, all IČO/name-context/snippet triples).

> **(a) IČO checksum correctness — PASS on data, CONCERN on algorithm**
> I recomputed all 22 distinct IČOs in the sample (not just 5) with weights
> 8,7,6,5,4,3,2 over digits 1–7. All 22 validate, including both
> hand-verified claims: 07043694 (Σ=117, r=7, check 4 ✓) and 03007740
> (Σ=78, r=1, check 0 ✓)... Zero failures.
> But the stated algorithm is not the correct Czech rule. The real MOD-11
> rule is: r=0 → check digit 1; r=1 → check digit 0; else 11−r. The
> adapter's stated rule collapses r∈{0,1} → 0, which is wrong for r=0...
> No sample IČO has r=0, so this sample is unaffected — but the validator
> should be corrected before broader ingest.
>
> **(b) Textual adjacency / false pairing — PASS, with two modeling CONCERNs**
> Every one of the ~90 mentions I checked has a snippet that independently
> confirms the IČO immediately follows the named entity. No
> cross-attribution... CONCERN 1 — individual (OSVČ) IČOs modeled as
> companies. Real, should be flagged in the handoff. 72015594 (JUDr. Patrik
> Graňák), 69908664 (Mgr. Bc. David Vandrovec), 03536106 (JUDr. Markéta
> Čermáková) are natural persons acting as court-appointed liquidators.
> Emitting them as company:ico:* would create phantom companies and, worse,
> pollute any downstream "MP → company → public money" traversal with
> court-officer nodes that co-occur across dozens of unrelated liquidations
> — a high-degree false hub... CONCERN 2 — nameContext is unreliable as a
> name... Names must be resolved from ARES by IČO, never from nameContext.
>
> **(c) Statute citation misparse — PASS**
> Every remaining citation is plausible for its document type... No
> treaty-collection or reporter artifacts survive. Residual false-positive
> classes to watch (none present here, but unguarded by the current regex):
> Sb. rozh. obč./tr. and SbNU reporters... and — the one that will actually
> bite — NNN/YYYY Sb. numbers appearing inside "ve znění zákona č. X/YYYY
> Sb." amendment clauses. Those are real Sbírka entries but are amending
> acts, not the law the court applied.
>
> **Additional findings**: FAIL (recall, not precision): 2 postings show
> silent extraction misses (9442186, 9406572 return zero IČOs despite being
> structurally identical to postings that return 5–8)... precision is
> demonstrated, recall is not. CONCERN: entity-identity conflict on tax
> offices (72080043 attributed to two different Finanční úřad names; one
> name, two IČOs across the sample) — a source/registry-semantics issue,
> not a parser bug. CONCERN: mentions are not deduplicated. Note: 9426716
> names liquidator "Mgr. Robert Hynek" with no IČO in the text — role
> coverage is asymmetric.
>
> **Overall**: Fit to record as Opus-verified with caveats... With [the
> five caveats] recorded, this sample is safe to promote.

**Actions taken on the Opus findings, same session**:
1. Fixed the r=0 checksum bug in `isValidIco()` (was `r∈{0,1}→0`, now
   `r=0→1, r=1→0, else 11-r`), added a regression test with a constructed
   r=0 test vector (`00000001`). Re-ran the full pipeline — no sample IČO
   changed (none hit r=0), confirming the fix was needed for correctness,
   not for this batch's specific numbers.
2. Added `personLikely: boolean` to `IcoMention` (birth-date-clause /
   person-title-prefix heuristic) and routed `personLikely` mentions out of
   the `concerns` edge set in the payload builder (`concerns_person_ico`
   marker, not a real graph rel).
3. `nameContext`-as-name and tax-office identity-conflict caveats recorded
   here and in `batch-006.md`, not code-fixed (out of this batch's scope —
   a future ARES-resolution pass owns cleaning names, not this adapter).
4. Recall gap (2/23 zero-yield postings) recorded as an honest unmeasured
   gap, no recall claim made anywhere in this handoff or the batch note.

(The `Sb. NSS` statute misparse Opus's prompt references as "already fixed
before you saw this data" was caught by the SAME Sonnet pass, mid-run,
before the Opus call — via manual inspection of an unexpectedly implausible
citation, `4682/2025` / `4683/2025`, a 4-digit law number outside the
plausible range for real Czech statute numbering. Fixed in
`extractStatuteCitations` with an NSS/SDEU suffix guard layered on the
verbatim-imported `LAW_CITATION` regex; test added.)

## `npm run check` status

**This batch's own files: typecheck clean, lint clean, 21/21 unit tests
passing. Repo-wide `npm run check`: RED, but from TWO SIBLING fleet
loops' in-progress files, not from this batch.**

```
npx eslint lib/ingest/sources/kiosek.ts lib/ingest/sources/kiosek-pdf.ts lib/ingest/sources/kiosek.test.ts \
  scripts/case-loops/sources/kiosek-slice.ts scripts/case-loops/sources/kiosek-validate.ts \
  scripts/case-loops/sources/kiosek-build-payload.ts
# → clean, zero errors
```

Full suite: `npx vitest run` → 264/264 tests pass across all 26 test files
(21 of them this batch's own `kiosek.test.ts`).

Two separate, unrelated repo-wide failures observed, BOTH in sibling fleet
loops' actively-being-edited files (confirmed via `git status` — neither
path is under this batch's boundary):

1. `npm run lint` fails on `lib/ingest/sources/dataor.ts` (2 errors: an
   unused var, an empty catch block) — Case ① money's batch-006 dataor
   ingest (untracked, alongside `dataor.test.ts`,
   `scripts/case-loops/money/dataor-*.ts`).
2. `npx tsc --noEmit` fails on `scripts/case-loops/effort/triage.ts`
   (`TS2304: Cannot find name 'printConvergenceVerdict'`) — Case ②
   effort's own batch-006 work (`git status` shows it modified, not
   touched by this run).

Neither is fixed here — not mine to touch, and both were observed to
change between two consecutive check runs in this same session (evidence
the sibling loops are live-editing concurrently, per the kernel's fleet
mode). Flagged for the orchestrator: `npm run check` will stay red
repo-wide until BOTH sibling batches finish and pass their own checks,
independent of this handoff.

## Commit plan (NOT executed — fleet rule, orchestrator commits)

```
git add lib/ingest/sources/kiosek.ts lib/ingest/sources/kiosek-pdf.ts lib/ingest/sources/kiosek.test.ts \
        scripts/case-loops/sources/kiosek-slice.ts scripts/case-loops/sources/kiosek-validate.ts \
        scripts/case-loops/sources/kiosek-build-payload.ts \
        docs/data-analysis/case-sources/ \
        package.json package-lock.json .gitignore

git commit -m "$(cat <<'EOF'
feat(ingest): kiosek úřední-desky adapter — batch-006 first slice

Parses kiosek.justice.cz/opendata's national court-notice-board JSON-LD
feed (5 institutions, 2,302 postings classified) and extracts two join
keys from attached PDFs via unpdf: statute citations (mirroring
psp-legislation.ts's LAW_CITATION regex, plus a corpus-specific Sb. NSS
case-law-reporter guard) and modulo-11-checksum-validated Czech IČOs
(restoring the unanonymized company linkage rozhodnuti.justice.cz's
anonymization removed). Opus-verified; caught and fixed a checksum r=0
edge-case bug and an Sb.-NSS statute misparse in the process. Proposal
payload only (notice/cites/concerns are not yet in kg-verdict.ts's
enums — see docs/data-analysis/case-sources/handoff.md for the exact
additions and the gated payload).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

## Lessons learned

- **A shared-regex import is stronger than a mirrored copy, but the corpus
  still needs its own guard.** Importing `LAW_CITATION` (and, after the
  fix, using it directly rather than the `extractAmendedLaws` wrapper)
  guarantees zero drift from the law case's parser — but psp-legislation.ts
  was only ever exercised against bill TITLES, which never contain
  case-law-reporter citations. A judgment's full PDF text is a genuinely
  different corpus with its own false-positive classes (`Sb. NSS`, and per
  Opus, `Sb. rozh.`/`SbNU`/amendment-clause citations as unaddressed
  residual risk). "Reuse verbatim" and "the corpus needs a validator" are
  not in tension — layering a corpus-specific filter ON TOP of an unforked
  shared regex is the right shape, not a fork.
- **A hand-verified-looking checksum can still hide a real bug** — the
  first `isValidIco()` passed both real sample IČOs (07043694, 03007740)
  and looked "confirmed" in the code comments, but neither sample IČO
  happened to exercise the r=0 branch. Opus re-deriving the algorithm from
  first principles (not just checking self-consistency against the given
  samples) is exactly the value the kernel's money-touching-claim
  verification requirement is for — a same-tier Sonnet spot-check likely
  would not have caught this since the existing samples "passed."
- **Deterministic classifiers built from a real vocabulary scan still miss
  edge classes** — the "C-" prefix gap (79/83 postings) wasn't visible from
  reading 5 hand-picked PDF samples; it only showed up because ALL 2,302
  postings' titles were histogrammed before writing the classifier. Even
  so, a title that visually reads as "ROZSUDEK JMÉNEM REPUBLIKY" inside the
  PDF can have a completely different `název` field ("C- rozsudek") in the
  JSON-LD metadata — a reminder that the metadata and the document content
  are two different texts, and a classifier trained on one can't assume it
  matches the other.
- **0% is sometimes the honest number, not a bug to chase.** The IČO join
  hit rate (0/23) looked alarming at first glance but is fully explained by
  population disjointness (the existing 195 `company` nodes come from
  Registr smluv contracts, kiosek's IČOs come from court-notice postings) —
  exactly the "restores a linkage the anonymized source lost" case the
  source doc predicted; the 0% IS the finding that this source adds NEW
  reach, not overlapping reach.
- **Fleet mode's shared-file boundary means `npm run check` is not a
  reliable end-of-batch gate on its own** in a multi-loop session — a
  sibling loop's genuinely broken WIP file (dataor.ts, money case) turns
  the repo-wide command red regardless of this batch's own correctness.
  Scoped `eslint <my files>` + full `vitest run` + `tsc --noEmit` is the
  right substitute evidence when that happens, and it should be stated
  explicitly (not just "check failed") so the orchestrator doesn't
  misattribute the failure.
