# Tender batch 003 — seven months, three size walls, and a map that must not draw

Case ④ needles · 2026-08-24 · **pass 68**.

## 1. The corpus: Jan–Jul 2026, CPV 45

**48 647 tender lots** (from 61 017 scoped rows across the files), 12 467 new company
nodes (namespace → 16 194), **165 716 edges** (48 626 procures / 86 089 bids_on /
31 001 wins). 226 830 rows, `props-check` clean, backups `pass67-pre`/`pass68-pre`.

## 2. Three size walls, each caught before it lied

1. **Monthly files overlap.** January carries 71 377 records and April 240 598 — the files
   re-publish UPDATED snapshots of older procedures (`casova_znacka` is a record-update
   time, not an event time). Cross-month dedupe by lot id, LAST month wins:
   61 017 → 48 647. Without it the corpus would have counted the same lot up to 5×.
2. **April decompresses to 4,95 GB** — past execFileSync's buffer AND V8's ~512 MB string
   cap (the dataor 2,4 GB lesson, met before it bit this time). `filter-month.py` streams
   each month with ijson and keeps only scoped records… and its first output — a single
   JSON document — was STILL ~650 MB for April. The working format is **NDJSON** (one
   record per line, streamed on both sides; `loadMonth.ts` is the one reader). No
   document-sized string exists anywhere in the path now.
3. **The map cannot draw this layer.** The first `/graf` map request after pass 68 burned
   **> 900 s of CPU and never finished** — the force layout is quadratic and the company
   core had grown 3,7 k → 16 k. Fix in two steps, measured: procurement-only companies
   (no edge outside procures/bids_on/wins) leave the force core; and the whole
   procurement layer is **disclosed, not drawn** — `omitted` now carries
   `tendersTotal: 48 647 · procurementCompaniesTotal: 15 937`, because a ~60 k-node
   payload is the b013 contract mistake with a new kind. Map: **10,5 s cold, 2 825
   nodes.** Tender nodes stay searchable and openable in detail; the mass canvas states
   what it omits. A dedicated procurement surface is the product answer, later.

## 3. What one command can now answer

The whole seven-month scoped market sits behind `wins`/`bids_on`/`procures` edges next to
the MP graph. b004 computes the first flags over it per the b001 calibration.

## 4. Lessons

1. **"Dated" fields in bulk exports are snapshot times.** Treating file membership as
   event time would have quintupled April.
2. **A filtered file can still be too big — formats, not sizes, are the fix.** NDJSON ends
   the whole class; the two earlier fixes (bigger buffer, pre-filter) only moved the wall.
3. **Ingest volume is a product event, not just a data event.** The map didn't degrade —
   it stopped completing. The b013 rule generalises: a new bulk kind must arrive with its
   drawing policy, and "disclose, don't draw" is a legitimate policy.
