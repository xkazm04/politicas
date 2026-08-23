---
name: dataor-transport-and-limits
description: dataor.justice.cz bulk files — which ones exceed V8's string cap, the ~70 MB/~90 s per-connection server cap with no Range support, the slug table that was wrong in 9 of 11 rows, and the streaming/resumable path that now exists.
metadata:
  type: reference
---

Paid for in money batch 017 (2026-08-22/23), widening `owns_stake` from 33 to 62 edges.

**Sizes (decompressed CSV, measured via HEAD):** `sro-full-praha-2026` **2 452 MB**,
`sro-full-brno-2026` 812 MB, `as-full-praha-2026` 289 MB, `sro-full-ceske_budejovice` 183 MB.
V8 caps a string at ~512 MiB, so a whole-file `readFile(…,'utf8')` fails on the two s.r.o.
registers with `Invalid string length` — and a caller that catches generically logs it as a
fetch failure. Use the STREAMING path: `ensureDatasetCached(id)` → `.csv` on disk, then
`findRecordsByIcosInFile(path, icos)` (one pass, all IČOs) / `fetchAndFindRecords`.
`fetchAndFindRecord` (singular) already routes through it.

**The server:** resource URLs are `http://` → **302** to https; **no `Range` support** (206
never comes, a ranged request gets 200 + full length); and on 2026-08-23 every transport —
Node fetch, curl, uncontended — delivered ~55–72 MB then reset or stalled at ~90 s, at
0,24–2,9 MB/s. Files ≤ ~70 MB gz download fine; batch 006's 183/288 MB caches prove larger
ones work on a better day. `downloadResumable` (stall watchdog, no overall deadline,
`.part` + rename) is the downloader; `fetchRetry`'s 180 s `AbortSignal.timeout` binds the
BODY too and can never finish a big file.

**Slug table:** `PRAVNI_FORMA_TO_SLUG` maps ARES `pravniForma` → dataor file slug and was
wrong in 9 of 11 rows (built from a non-ARES code list). Now verified both sides (ARES
číselník × CKAN `package_show` titles), pinned by `dataor.test.ts`. Notable: **`961 → sf`
svěřenský fond exists** (AGROFERT post-2017); `nevlad_org` = *Mezinárodní nevládní
organizace*, never spolek; `325` (OSS) is not in the OR at all.

**Cache hygiene:** the adapter reads ONLY `<id>.csv`; anything else in `.dataor-cache/` is
junk (the `.csv.gz` leftovers were truncated). Every write goes through `.part` + rename.
A tool that emits payloads writes files stamped TO THE MINUTE — a committed payload is
never overwritten (`ownership-depth2.ts` blanked pass 59's with a fixed name, then pass
61's with a same-DAY date; `public-mandate-sweep` overwrote pass 58's).

**The better source for s.r.o. ownership is ARES VR, per IČO (batch 018):**
`spolecnici[].spolecnik[]` (each wrapping `osoba` + `podil[].velikostPodilu` = share %,
dated) lists EVERY společník of an s.r.o.; `akcionari[].clenoveOrganu[]` lists only a SOLE
akcionář of an a.s. (register rule — a multi-shareholder a.s. like Pražská energetika has
no corporate owner in the OR at all). `ownershipRecord()` reads both shapes since b018;
`ownership-from-vr.ts` mints `owns_stake` from it (`--which=ownership-vr`). Use bulk
dataor for history and seats; VR for current owners when bulk is capped. A weaker
own-record verdict must never overwrite a depth-2 `publicly-owned`.

**How to run the sweep:** `ownership-sweep.ts --plan` first (groups 213 targets by dataset,
says what is cached), then `--fetch-budget=N [--skip-datasets=…]`; apply via
`apply-batch.ts --which=ownership-sweep` (pin `EXPECTED_COUNTS` from the dry run).

Related: [[attribution-has-two-axes]], [[ico-node-id-canonical-form]],
[[registr-smluv-token-free-access]].
