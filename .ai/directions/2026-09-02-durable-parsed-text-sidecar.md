---
subject: software-engineering/import-normalization
project: politicas
raised_by: intake intake-lightrag-0902 (peer comparison)
source: librarian/sources/2026-09-02-lightrag.md
stage: immediately after parse, before extraction — between lib/ingest/sources/kiosek-pdf.ts and its callers in scripts/case-loops/sources/
size: 2 files / ~90 lines / S
status: accepted
---

## Why the scope implies it

`scope.does` names *"ingestion adapters for public data"* as a first-class capability, and the tree
carries thirteen of them. Twelve parse formats that are cheap and deterministic to re-parse: UNL
inside ZIP (`packages/czech-civic-data/src/unl.ts`, `zip.ts`), JSON-LD (`kiosek.ts`), CSV
(`volby.ts`, `dataor.ts`), XML (`smlouvy-dump.ts`). One is neither: **PDF text extraction**.
`lib/ingest/sources/kiosek-pdf.ts:1-15` is *"the one file that touches `unpdf`"*, and its header
records that the dependency was chosen under constraint — pure-JS, no native bindings, because the
Next app already carries one wasm dependency (PGlite) and a second was avoided. That is a stage whose
cost and whose availability are both real.

Today its output is thrown away. `extractPdfText` (`kiosek-pdf.ts:24-27`) is called at
`scripts/case-loops/sources/kiosek-slice.ts:125` and `:171`. The **raw bytes** are cached —
`CACHE_DIR = ".kiosek-cache/pdfs"` (`kiosek-slice.ts:41`), written at `:170`, gitignored
(`.gitignore:57`) — but the extracted **text is not**. The `PdfExtraction` record carries
`textLength: number` (`kiosek-slice.ts:76`, populated at `:136` and `:180`) and no `text` field. What
survives is only the *structured* result — statute citations and IČO mentions
(`extractStatuteCitations`, `extractIcos`) — in the git-tracked
`docs/data-analysis/case-sources/kiosek-slice-extract.json` (`:216`).

So every re-run re-parses, and — the part that actually costs work — **a change to either extractor
cannot be re-applied to the corpus without re-parsing it.** A new statute-citation pattern, a
refinement to the OSVČ-vs-company IČO discrimination that `kiosek.ts:149` already flags as a live
distinction, or a third extractor added tomorrow, all require a full `unpdf` sweep over every cached
PDF. That is the exact force `intermediate-representation` declines to model: it states in its own
words that the IR is *"not the host's persistence model. It is a staging shape"*, and its whole value
is the N×M→N+M waist at import time. This is a different force — parse cost and parser availability —
and the corpus has the home without the mechanism.

**The strongest argument is that this project already made this decision once and kept it.** The law
loop persists extracted PDF text: `scripts/case-loops/law/collision-core.ts:19`
`CACHE_DIR = ".data/law-collision-cache"` with `readCachedBillText` at `:22-25` reading back
`tisk-<cislo>/*.txt` beside the source PDF, and
`scripts/case-loops/law/archive/measure-precision-006.ts:7`, `:153` describe re-running precision
measurements over text that is *"all pre-cached, zero new fetch"*. So this is not a new mechanism; it
is one lane adopting a sibling lane's proven idiom, and the argument for it is the argument the law
loop already won.

What the peer adds is the **contract language** that turns a cache into a commitment. LightRAG's
sidecar (`lightrag/sidecar/writer.py:115-119`, format spec `docs/LightRAGSidecarFormat.md:3`) is
*"the only reliable source of truth for the subsequent pipeline"*, and its resume rule at
`docs/FileProcessingPipeline.md:1162` is *"**Always skip parsing** (do not call `parse_*` again)"*.
The clause worth copying verbatim is `FileProcessingPipeline.md:1166`: an engine mismatch is
**warned, never re-parsed**, because *"The extracted content is an immutable fact; re-running a
different engine would produce inconsistency."*

## What the first context contains

A small module — `lib/ingest/parsedText.ts` — plus its wiring into the one caller.

**It contains:**
- `parsedTextPath(cacheDir, pdfFile): string` — the path convention, `<pdfFile>.txt` beside the
  cached bytes, matching what the law loop already does so the two lanes converge rather than fork.
- `readOrExtractText(cacheDir, pdfFile, bytes): Promise<{text, source: "sidecar" | "parsed"}>` — the
  single door. Sidecar present → read it and report `"sidecar"`; absent → call `extractPdfText`,
  write the sidecar atomically (`.part` then rename, the discipline `dataor.ts:721-723` already
  states: *"a partial download must never be mistaken for a cached one"*), report `"parsed"`.
- A one-line stamp beside the text recording the extractor identity — `unpdf@<version>` — so the
  mismatch case is *detectable*. On mismatch: **warn, keep the existing text, do not re-parse**. The
  extracted text is an immutable fact about a byte-identical PDF; a mixed corpus where some documents
  were read by one extractor version and some by another is worse than a consistently stale one,
  because nothing downstream could tell which was which.
- An explicit `--reparse` flag on the caller for the deliberate override, following the repo's
  established `--refetch` (`ingest.ts`) and `--supersede` (`kg-compute.ts`) convention: a destructive
  or expensive re-derivation is always a named flag, never a default.

**Its boundary — what it must NOT absorb:**
- **Not the extractors.** `extractStatuteCitations` and `extractIcos` stay in `kiosek.ts` and keep
  running on every invocation. The whole point is that they become cheap to re-run; making them part
  of the cached artifact would defeat it.
- **Not a general IR.** This stores *text*, not a block structure, not headings, not tables.
  LightRAG's `blocks.jsonl` with placeholders and an assets directory is the right shape for a
  multimodal pipeline; here the postings are *"short usneseni/rozsudky, not multi-volume documents,
  so page boundaries carry no extraction-relevant information"* (`kiosek-pdf.ts:19-22`). A structured
  sidecar would be inventing a requirement the source explicitly denies.
- **Not the contract-dump lane, and this is a hard boundary.**
  `scripts/case-loops/money/harvest-contract-dumps.ts:9-12` deletes each ~26 GB dump immediately
  after filtering *"no bulk personal-data corpus is ever retained (the publisher's GDPR condition
  makes the recipient a data controller)"*. A sidecar-beside-the-source there would be a compliance
  violation, not an optimisation. That lane already has its durable IR in the filtered
  `contracts-harvest.jsonl` and needs nothing.
- **Not the psp.cz ingest.** `scripts/data-analysis/ingest.ts:106`, `:143` re-run the UNL parse from
  cached bytes every time, correctly — PGlite is that lane's parsed store, and the parse is a
  deterministic decode with no dependency risk.
- **Not git-tracked.** `.kiosek-cache/` stays gitignored. The text is a rebuildable derived artifact,
  and the postings are court notices about named private individuals.

## The measurable

**Primary: `unpdf` invocations on a warm re-run of `kiosek-slice.ts`.** Today it is N (one per cached
PDF, currently the five seeded samples plus up to `MAX_ADDITIONAL_PDFS = 18`,
`kiosek-slice.ts:64`). After: **0**, with wall time falling by the parse share. Both numbers are
already trivially observable — the script prints its scope line at `:154-156` and can print a
`sidecar hits / parses` count beside it.

**The number that decides whether it was worth it, though, is the second one: re-extraction turnaround.**
Time from "a new statute pattern is written" to "the corpus is re-scored against it", measured over
the existing cache. Today that includes a full parse sweep; after, it is regex-over-text. If the
answer is that a re-score currently takes seconds anyway, the direction paid for nothing.

**Falsify it first with test T1** in the study: run `kiosek-slice.ts` on a warm byte cache and time
it, with and without a hand-written sidecar for one PDF. Building before measuring is the failure
mode this repo has already written up elsewhere — *"a gate nobody has watched fail is not a gate"*
(`lib/db/pglite/accounting.ts:115-117`).

## What would make this wrong

- **The corpus is too small for the parse to cost anything.** Twenty-three PDFs of short court
  notices may parse in under two seconds total, in which case the sidecar buys convenience and adds a
  cache-coherence surface. The kiosek slice is deliberately bounded (`MAX_ADDITIONAL_PDFS = 18`,
  *"kept conservative given the throttle cost"*, `kiosek-slice.ts:62-63`), so this is the likeliest
  falsifier and T1 answers it before any code is written. The counter-argument, which the owner
  should weigh rather than assume: the slice is bounded *today* because fetching is throttled, and
  `kiosek.ts:1-11` describes 208 courts refreshed hourly.
- **The lane is about to be replaced.** If the kiosek work is a closed case-loop batch rather than a
  standing ingest, caching its intermediate output optimises something that will not run again.
  `docs/data-analysis/case-sources/` should say which; if the case is closed, decline.
- **A sidecar that outlives its source becomes a second authority.** If the cached bytes are pruned
  but the text sidecar is not, the tree ends up holding extracted text with no way to re-derive or
  check it — a claim with no source, which is precisely what this product refuses everywhere else.
  The module must delete the sidecar with the bytes, and if that cannot be guaranteed, the sidecar
  should not exist.
- **The extractor stamp turns out to be unavailable.** The "warn, never re-parse" rule depends on
  being able to record which `unpdf` version produced the text. If the version cannot be read at
  runtime, the mismatch case is undetectable and the immutable-fact framing collapses into an
  ordinary stale cache — still useful, but it should then be documented as a cache, not as a
  contract.
