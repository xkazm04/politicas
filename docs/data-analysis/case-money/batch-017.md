# Money batch 017 — widening the ownership layer, and what stood in the way

Case ① FollowTheMoney · 2026-08-22/23 · **passes 60 + 61**.

> Batch 016's steering item 1: "widen `owns_stake` — 33 edges for 214 companies is why
> depth-2 resolved 1 of 48". The widening itself was one script. What it took to run was
> four defects in the ingest adapter, three of them silent, plus a server that cannot serve
> a file larger than ~70 MB today.

## 1. Why 33: a bounded first slice nobody lifted

`dataor-ownership-chains.ts` (batch 006) capped new dataset fetches at 12, priority classes
only: **153 of 195 tied companies were never attempted**. It produced 55 proposals → 33
edges, and no batch widened it for ten batches. `ownership-sweep.ts` replaces it: all tied
companies + known parents (depth 2), a `--plan` mode that groups by dataset and reports
what is cached, an explicit `--fetch-budget`, 8-padded IČOs by construction, and the payload
in `apply-batch`'s reviewed shape — so the multi-period merge and board-seat exclusion are
the rules batch 007 audited, not new ones.

## 2. The four adapter defects the plan exposed

**(a) The slug table was built from the wrong code list — 9 of 11 rows wrong.** `PRAVNI_FORMA_TO_SLUG`
mapped ARES `pravniForma` codes to dataor file slugs, and both sides were unverified: `117`
was read as komanditní (ARES: **Nadace**), `325` as státní podnik (ARES: organizační složka
státu — not in the OR at all), `801` as příspěvková organizace (ARES: **Obec**), and
`nevlad_org` — which dataor's own package titles define as *Mezinárodní nevládní
organizace* — carried every spolek and nadace. Each wrong row could only ever answer „IČO
not present in <wrong file>", which reads exactly like an honest negative. Rebuilt from the
two authoritative sources (ARES číselník labels × CKAN `package_show` titles): 19 verified
pairs incl. `301→sp` (státní podnik), `205→dr`, `117→nad`, `706→spolek`, `331→prisp`,
`771`-owners' `obec`, and **`961→sf` — svěřenský fond**, the AGROFERT post-2017 structure
batch 006 recorded as "may use a mechanism this extractor doesn't recognize". It does not;
dataor publishes it. Re-planning under the corrected table moved **18 companies from
unresolved into real files** (37 → 19 unresolved).

**(b) Whole-file strings: a 512 MB ceiling nobody had hit.** The adapter read every dataset
into one JS string. Measured against the live catalog: `sro-full-praha-2026.csv` is
**2 452 MB**, `sro-full-brno-2026.csv` **812 MB** — the two s.r.o. registers where
owner-operator chains live were unreadable by construction, failing as `Invalid string
length` (which the caller logged as a fetch failure). A streaming path now exists:
`ensureDatasetCached` (gunzip to disk as a stream), `findRecordsByIcosInFile` (one rolling-
buffer pass, every target IČO at once, rows accepted only when provably complete), and
`fetchAndFindRecord` routed through them so `dataor-corroborate.ts` gains it without a
changed line.

**(c) `readCsvRow` dropped `""`-escaped quotes.** `segments.join('"') + tail` put one quote
*between* segments and none before the tail: a field with a single escaped quote lost it
entirely. Pre-existing, never covered; the streaming finder's chunk-boundary tests (five
`highWaterMark` sizes cutting inside a quoted newline) found it in the first run.

**(d) Two cache-name rules.** The sweep accepted `<id>.csv.gz` as cached; the adapter
reads only `<id>.csv`. The `.gz` files were truncated leftovers from an old run, so the
sweep spent no budget while the adapter re-downloaded 68 MB from CKAN **per company** —
27 minutes of silent re-fetching from one filename disagreement. The sweep now imports the
adapter's rule; a partial gunzip of my own made it worse once more (a 704 MB `.csv` the
adapter then trusted), which is why every cache write now goes through `.part` + rename.

## 3. The server, today

After all four fixes the Prague and Brno registers still did not arrive: every transport —
Node fetch, curl alone, uncontended — delivers **~55–72 MB and then resets or stalls at
~90 s**; `Range` requests answer 200 (no resume); the http URL is a `302` to https. Speed
today 0,24–2,9 MB/s against the 216 MB gzip. Batch 006's 183 MB and 288 MB caches prove
it worked on a better day. So **38 companies (19 Praha + 13 Brno + 6 Ostrava s.r.o.) are
recorded `not attempted — server too slow this run`**, and `downloadResumable` (stall
watchdog, no overall deadline, resume when the server ever allows it) is in place for the
retry. This is the open item, not a code gap.

## 4. What the sweep found

Over **43 cached datasets, 156 companies**: **148 chain rows — 104 dated stakes, 44 board
seats** (excluded by the adapter, by contract), **19 new parent nodes, 105 honest negatives**
(the register names no corporate shareholder — natural-person-owned), 57 not attempted
(38 server, 15 not in the OR — obce, kraje, OSS —, 3 ARES-absent, 1 unresolved).

**Pass 60** (apply-batch, `EXPECTED_COUNTS` pinned from the dry run): 19 nodes inserted,
**62 `owns_stake` edges (29 new + 33 re-merged)**. The layer goes **33 → 62**.

Among the 39 current (open) stakes, **27 sit over tied companies and 26 of those parents are
public bodies** — Zlínský kraj ×4, Statutární město Brno ×4, HLAVNÍ MĚSTO PRAHA ×3,
Středočeský/Ústecký/Karlovarský/Královéhradecký kraj, Ministerstvo financí, VZP, České
dráhy, and four svazky obcí (the `771` form batch 016 reclassified). All 26 were already
**steward by role**, so no koruna moved; what they lacked was the COMPANY-axis verdict,
because batch 015 swept only attributable companies. `ownership-depth2.ts` now also covers
never-swept companies with a known parent → **pass 61: 26 `publicly-owned` verdicts**.
`publicly-owned` 4 → **29 companies, 289 384 080 794 CZK** of steward money now carrying
registry-recorded public ownership; the never-swept steward set 139 → 114.

The original depth-2 question (`ownership-not-published` → public parent) resolved **0 of
47**: the unpublished-ownership companies' parents, where known, are private (SynBiol,
AGROFERT, ČSOB) or themselves unresolved (Valašská vodohospodářská a.s. — a holding of
towns, depth 3). Pražská energetika still has no parent in the graph.

## 5. A committed payload is history

`ownership-depth2.ts` wrote to fixed `batch-016-*` filenames; re-run in this batch it
silently overwrote the **committed pass-59 payload with an empty one** — which would have
made a restore-and-replay of pass 59 replay nothing. Restored from git; the tool now writes
dated files. Rule: a tool writes a new file; a payload that has been persisted is never
rewritten.

## 6. Gate

`npm run check` green (see ledger for the count); `props-check` clean after registering
`owns_stake.apply_batch_017_ownership-chains_note`; 0 non-8-digit company ids after the
insert. Backups `pass60-pre`, `pass61-pre` (checkpointed, pruned to 2).

## 7. Lessons

1. **A lookup table with two unverified sides is two guesses multiplied.** Every wrong row
   produced a plausible negative, and ten batches of "IČO not present" were partly this.
2. **A size ceiling you have never hit is invisible until the important file is past it.**
   The a.s. registers fit; the s.r.o. ones — where owner-operators live — never did.
3. **Guards that cut inside the data find bugs the data never showed.** The `""` defect was
   found by tests that slice a file at every offset, not by any real file.
4. **Two layers that name the same thing differently will eventually disagree about whether
   it exists** — and the cost lands on the network, silently.
5. **"Server too slow" is a finding with a retry plan, not a failure to report as a gap.**
   38 companies are named, the tool that retries them exists, and the file sizes are on
   record so the next run knows what it is asking for.
