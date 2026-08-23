# Money batch 018 — the open items, overcome by changing the source

Case ① FollowTheMoney · 2026-08-23 · **passes 62 + 63 + 64**.

> Batch 017 left two open items: the three s.r.o. registers the server would not serve,
> and Pražská energetika's owner. One was solved by not needing the file; the other was
> proved unanswerable from the register — and the attempt exposed a reader defect that had
> been hiding 37 private owners.

## 1. The three registers — two fetched, one never will be today

A 20-second probe at 10:15 gave 3,2 MB/s (0,24 the night before). At that speed Brno
(71 MB gz) and Ostrava (47 MB) clear the server's ~90 s/~70 MB cliff: both landed —
**812 MB and 521 MB decompressed, scanned by the streaming finder**, the first real proof
of the batch-017 path on files past V8's string cap. Prague did not: `full` (216 MB) and the
new `--fallback-actual` (`sro-actual-praha`, 121 MB) both terminated on all 8 attempts. The
cap is byte-based (~70–75 MB), not ours, not the transport's.

## 2. So: stop needing the file

For an **s.r.o., ARES VR lists every společník** — legal or natural person — **with the share
in percent and dated periods**, per IČO, token-free. For an a.s. it lists only a sole
akcionář; that is the register's rule. Bulk was never the best source for "who owns this
s.r.o.": the per-IČO endpoint was, and the 19 Prague companies are all s.r.o.

`ownership-from-vr.ts` reads VR for every tied company and known parent (226), takes the
legal-person owners, and emits `owns_stake` in `apply-batch`'s shape (`--which=ownership-vr`).
**461 dated rows, 127 with a stated share, 117 parents not yet in the graph.** Dry run:
117 nodes, **91 edges (51 new + 40 merged onto the dataor layer)**, 334 share-less rows
excluded by the adapter's contract. **Pass 62.** The layer: **62 → 113 edges, 84 current
stakes.** Complement, not replacement — dataor keeps history and seats; VR is the per-IČO
source no bulk cap can block.

## 3. The reader defect: the classifier had never seen an s.r.o. owner

Looking at the VR JSON to mine it showed why batch 015 had so many `ownership-not-published`:
akcionáři sit under `akcionari[].clenoveOrganu[]` — which `ownershipRecord()` read — but
společníci sit under **`spolecnici[].spolecnik[]`**, each wrapping `osoba` and `podil[]`, which
it did not. **SPOLANA s.r.o. has ORLEN Unipetrol RPA at 100 % since 2021 and was filed
"ownership not published".** Fixed (both shapes, plus `sharePct`/`validFrom`/`validTo` on
`Shareholder`, pinned by tests on the verbatim structure).

The corrected `public-mandate-sweep` over the 57 attributable companies: **`ownership-not-
published` 47 → 10, `private` 5 → 37**, `unknown` 1 → 6 (foreign owners with no legal form
— honestly unknown). And one guard it needed immediately: the resweep would have
**downgraded Plzeňská teplárenská** from depth-2 `publicly-owned` (pass 59, proved from the
parent's record) to `ownership-not-published` (its own record names nobody). A stronger
verdict is never re-litigated by a weaker source; the sweep now keeps a live
`publicly-owned` unless it also finds public ownership. **Pass 63: 55 nodes.**

## 4. Depth 2 over the wider layer

With 117 new parents, `ownership-depth2.ts` resolved **24 more** `publicly-owned`: municipal
s.r.o. (Čistá Plzeň, Lesy a parky Trutnov, Vsetínská sportovní …), **Povodí Vltavy / Ohře /
Moravy ← Ministerstvo zemědělství**, KORID LK and the Liberec záchranná služba ← Liberecký
kraj, Nadační fond Českého rozhlasu ← ČESKÝ ROZHLAS (forma 361). **Pass 64.**

`publicly-owned` across tied companies: 29 → **53 companies, 324 845 206 394 CZK** of
steward money now registry-corroborated. Never-swept steward set 114 → 90.

## 5. Pražská energetika — closed as structurally unanswerable from the OR

Neither PRE (60193913) nor Pražská energetika Holding a.s. (26428059) carries **any**
corporate shareholder in the OR: both are multi-shareholder a.s. (Holding 58 % / EnBW;
Praha 51 % of the Holding), and the register records an akcionář only when sole. Depth 2
through the register cannot reach it. The honest verdict stays `ownership-not-published`;
the route is a document source — the city's published majetkové účasti or the company's
výroční zpráva — which by doctrine enters as a cited lead in the review lane, never as a
graph edge. `ownership-not-published` is now **9 companies / 16,77 mld.**, and PRE + ČSOB
Pojišťovna are 16,2 mld. of it: the remaining unverified headline is two companies.

## 6. Two filename traps, one rule

`public-mandate-sweep` overwrote the committed pass-58 payload (fixed batch filename), and
`ownership-depth2` — "dated" since this morning — overwrote the pass-61 payload on a
same-day rerun. Both restored from git; both tools now stamp to the **minute**. A tool
writes a new file; a committed payload is never rewritten.

## 7. Gate

`npm run check` green — **3 002 tests** (+4); `props-check` clean after registering
`owns_stake.apply_batch_018_ownership-chains_note`; **0 non-8-digit company ids** after 117
inserts; headline unchanged at 17 417 308 400 CZK through `getMoneyData()`. Backup
`pass62-pre` (pruned to 2).

## 8. Lessons

1. **When the source blocks you, ask whether you needed that source.** The per-IČO endpoint
   answered the s.r.o. question better than the bulk file ever could — with share and dates.
2. **A reader that handles one shape handles one shape.** `clenoveOrganu` vs `spolecnik`
   was invisible until the JSON was read for a different purpose; 37 private companies sat
   in "unpublished" for three batches.
3. **A weaker source must not overwrite a stronger verdict.** The resweep was right about
   what PRE's own record says and wrong to let that erase what Plzeň's record proved.
4. **"Dated" is not unique.** Timestamp to the minute, or a rerun is a rewrite.
5. **Closing an item as structurally unanswerable is a result**, when it names the reason
   (sole-akcionář rule) and the source that can answer it instead.
