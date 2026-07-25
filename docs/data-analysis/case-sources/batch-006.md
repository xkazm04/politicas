# Batch 006 — kiosek.justice.cz/opendata ingest slice

Fleet run (money/law/effort case loops running concurrently in the same
working tree — see their own `docs/data-analysis/case-{money,law,effort}/`
batch notes from the same session). This batch built the FIRST SLICE of an
ingest adapter for `kiosek.justice.cz/opendata` per
`docs/data-analysis/justice-sources-kiosek.md` (the discovery spec).

## Scope (no silent truncation)

- **Institutions**: the 5 already-cached (`.justice-samples/`, gitignored) —
  MS Praha (201000), Obvodní soud pro Prahu 1 (201010), Vrchní soud v Praze
  (221000), Nejvyšší soud (222000), KSZ Praha (302000). NOT all 208 —
  the spec doc's own sampling found commercial/regional court seats carry
  the real join-key value; appellate/supreme/prosecutor institutions skew
  administrative (confirmed again in this batch's full-corpus classification,
  see below).
- **Postings metadata**: ALL 2,302 postings across those 5 institutions
  parsed and classified (no sampling on the JSON-LD side).
- **PDF text extraction**: bounded — the 5 already-cached PDFs (matched back
  to their real posting via the attachment uuid in the download URL) + 18
  additional substantive-classified MS Praha postings from the
  Obchodní/Insolvenční řízení/Veřejné rejstříky/Správní soudnictví agendas
  (budget was up to 20; 18 fetched — 154 candidates existed, capped by the
  batch's PDF-fetch budget, not availability). 23 PDFs extracted total.

## Yield (deterministic, re-run with `npx tsx scripts/case-loops/sources/kiosek-slice.ts`)

Classification, full 2,302-posting corpus:

| Institution | total | boilerplate | substantive | administrative | unclassified |
|---|---|---|---|---|---|
| 201000 (MS Praha) | 516 | 182 | 160 | 14 | 160 |
| 201010 (Obvodní Praha 1) | 1420 | 104 | 146 | 1113 | 57 |
| 221000 (Vrchní soud) | 38 | 0 | 0 | 37 | 1 |
| 222000 (Nejvyšší soud) | 84 | 0 | 0 | 84 | 0 |
| 302000 (KSZ Praha) | 244 | 0 | 0 | 237 | 7 |
| **total** | **2302** | **286** | **306** | **1485** | **225** |

PDF extraction (23 postings): 87 statute-citation mentions (11 distinct
`law:sb:*`), 115 IČO mentions (23 distinct IČOs, 5 mentions/3 distinct IČOs
flagged `personLikely` — court-appointed liquidators/attorneys, an OSVČ
IČO, not a company).

## Join-key validation against the real graph (read-only copy)

```
cp -r .pglite .pglite-copy-kiosek
PGLITE_PATH=./.pglite-copy-kiosek npx tsx scripts/case-loops/sources/kiosek-validate.ts
rm -rf .pglite-copy-kiosek
```

Graph at validation time: 101 `law` nodes, 195 `company` nodes.

- **Statute hit rate: 4/11 distinct citations (36.4%)** resolve to an
  existing `law:sb:*` node (`150-2002`, `549-1991`, `89-2012`, `99-1963`).
  7 unresolved (`121-2008`, `177-1996`, `221-2003`, `292-2013`, `304-2013`,
  `65-2022`, `90-2012`) — real citations, no node minted yet; flagged for
  Case ③ law, not fabricated.
- **IČO hit rate: 0/23 (0%)** — expected and honest: the graph's 195
  `company` nodes come from Registr smluv contract data (a different
  population), not from kiosek/dataor company registrations, so zero
  overlap is a real finding, not a bug. This is exactly the "restores a
  linkage the anonymized source lost" value proposition (Case ① money would
  need to mint these nodes to realize it).

## Classifier accuracy evidence

Vocabulary NOT guessed — pulled by scanning `název` (title, first-word
histogram) and `agenda` values across the real 2,302-posting corpus before
writing the classifier (see `lib/ingest/sources/kiosek.ts`'s
`classifyPosting`). Spot-checked against a manual read of all 23
PDF-extracted postings: every "Usnesení"/"Rozsudek"-titled posting that was
extracted did in fact contain a real court order (5/5 liquidation-order
postings matched the "Usnesení o naříz. likvidace..." pattern exactly).

**Known classifier gap, found and documented (not silently absorbed)**: 83
postings have titles starting with the bare prefix "C-" (e.g. "C- rozsudek",
"C- usnesení - (Slezská)") in the Preventivní restrukturalizace agenda —
only 4 of the 83 contain the word "usnesení" and match `SUBSTANTIVE_TITLE`;
the rest (including the real asylum judgment sample, whose actual `název`
field is literally "C- rozsudek", not "Rozsudek" as assumed from the
PDF's visible letterhead) fall through to `unclassified`. The cached-sample
PDFs bypass this (extracted unconditionally, regardless of classification),
so this batch's PDF sample wasn't blinded by the gap, but a future
harvester that gates PDF fetch strictly on `label === "substantive"` would
miss this "C-" class. Flagged for a future batch, not fixed here (would
need more real-title sampling of the Preventivní restrukturalizace agenda
to derive a safe pattern rather than guessing).

## Opus verification (kernel-required, money-touching claim)

Ran via the `Agent` tool, `model: "opus"`, maximum-depth instruction, full
23-posting extraction sample (statute citations + all IČO/entity-name pairs
with source posting id + raw snippet). Verbatim verdict summary — full text
in `handoff.md`:

- **(a) IČO checksum** — PASS on data (22/22 distinct IČOs independently
  recomputed valid) but caught a **real bug**: the shipped checksum
  function's r=0 edge case mapped to check digit 0 instead of the
  mathematically correct 1 (11 mod 10 wraps to 1, not 0). No sample IČO hit
  r=0 so the bug was silent in this batch, but would have produced false
  negatives (~1/11 of IČO-space) on a wider corpus. **Fixed** in
  `isValidIco()` before this handoff was written; regression test added
  (`kiosek.test.ts`, the r=0 edge-case test with a constructed `00000001`
  vector).
- **(b) textual adjacency** — PASS, zero cross-attribution across ~90
  mentions (multi-IČO postings like the liquidation order correctly keep
  company vs. liquidator separated). Two CONCERNs raised and addressed:
  natural-person (OSVČ) IČOs mixed into the IČO stream (now flagged
  `personLikely` and routed OUT of the proposed `concerns`/company edge set
  in the payload builder) and `nameContext` being a truncated raw window,
  not a resolved name (documented — a future ingest should resolve via ARES
  by IČO, never trust `nameContext` as a clean name).
- **(c) statute misparse** — PASS on the final (post-fix) citation list.
  Caught, mid-run, the actual bug this batch fixed: two citations
  ("4682/2025", "4683/2025") were `Sb. NSS` (Nejvyšší správní soud's own
  case-law reporter) misparsed as Sbírka-zákonů statutes — added a
  corpus-specific post-filter in `extractStatuteCitations` (NSS/SDEU
  suffix guard, layered on top of the verbatim-imported `LAW_CITATION`
  regex, not a fork of it).
- Additional Opus finding: **2 of 23 postings (9442186, 9406572) returned
  zero IČOs despite being structurally identical to postings that returned
  5–8** — precision is demonstrated, recall is NOT, and no recall claim
  should be made from this sample.

Full text of the Opus response is quoted verbatim in `handoff.md`.

## What's NOT done (honest gaps, not silently dropped)

- Only 5/208 institutions. No corpus-wide count across all institutions.
- PDF extraction budget was 23 postings, not the full 306 classified
  "substantive" (MS Praha alone has 160 substantive postings; this batch
  extracted PDFs for 21 of them — the 5 cached + subset of 18 fetched, since
  some of the 18 fetched came from non-MS-Praha-only agenda combinations
  actually all were MS Praha per the script's filter).
- No overlap test against `rozhodnuti.justice.cz` (flagged, not tested, per
  the spec doc's own honest-gaps list — out of scope for this batch too).
- The classifier's "C-" prefix gap (above).
- Recall of the IČO extractor is unmeasured (2/23 zero-yield postings that
  "should" have an IČO per Opus's structural read).
