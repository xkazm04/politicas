# Money loop — STATE (resume here)

> **Regenerated every batch. Read THIS first, `ledger.md` only for history.** The ledger
> is 1 100+ lines of append-only batch log; loading it to resume cost every session
> ~80 KB of prose before it could act (2026-08-22 architecture review). Open items live
> in `ledger.json → openItems` and are mirrored here by hand until a generator exists.

**As of:** batch 017 · 2026-08-23 · last graph write **pass 61** · backups
`.pglite-backup-2026-08-23-pass60-pre`, `…-pass61-pre` (checkpointed, via `npm run db:backup`).

## The numbers the surface renders

| figure | value | since |
|---|---|---|
| `/penize` attributable headline | **17 417 308 400 CZK** (unchanged b017) | b016 |
| steward bucket | 459 167 182 951 CZK | b016 |
| total reachable (unchanged since b013) | 476 584 491 351 CZK | b012 |
| excluded — register names a different recipient | 11 771 399 766 CZK / 128 contracts | b014 |
| kept but shared — several named recipients, no split | 1 331 071 128 CZK / 117 | b014 |
| **ownership-not-published** (attributable, unverified) | **46 companies · 17 085 120 965 CZK — 98 % of the headline** | b015 |
| publicly-owned (company axis) | **29 companies · 289 384 080 794 CZK** — 4 moved to steward (b015–016) + 25 steward-by-role corroborated by the register (b017) | b015–017 |
| `owns_stake` layer | **62 edges** (33 → 62, pass 60) · 39 current stakes · 26 public parents | b017 |
| ties · review state | **211 · all `pending_review`** — the human gate has never been exercised | — |

Headline history: 42,89 bn (pre-014) → 31,12 (b014) → 18,37 (b015) → 17,42 (b016).

## Rules now in code (do not re-derive)

- `moneyReachesCompany()` — a `supplies` edge with `direction: non-recipient | payer` is
  NOT reach (`features/money/reachableMoney.ts`, b014).
- `tieIsAttributable()` — TWO axes: role (`tie_class`) AND company (`public_mandate`);
  the mandate axis only ever removes attribution (b015).
- `toReachableTie()` — the only way to build a `ReachableTie` (b015).
- `lib/analysis/public-body.ts` — `ownership-not-published` ≠ `private`; legal-form tables
  audited against the ARES číselník, drift guard `legal-form-audit.ts` (b016).
- `lib/ingest/sources/dataor.ts` — ARES-code → dataor-slug table verified both sides
  (`961→sf` svěřenský fond exists); STREAMING read path (`fetchAndFindRecords`) for the
  > 512 MB registers; `downloadResumable` with stall watchdog; `""` escape fixed (b017).

## Open items (priority order)

1. **Retry the three s.r.o. registers** — 38 companies (Praha 19 / Brno 13 / Ostrava 6),
   where owner-operator chains live; `ownership-sweep.ts --fetch-budget=3` on a day the
   server serves > 70 MB per connection (sizes 216 / 71 / 47 MB gz; no `Range`; try the
   `.xml.gz` variant or off-hours if it still caps).
2. **Pražská energetika, 10,95 mld.** — still no parent in the graph; reach it FROM the
   holding's record (Pražská energetika Holding a.s., in the cached `as-full-praha`).
3. **Review-queue lane for `ownership-not-published`** (46 companies) — where the 98 % lives.
4. `npm run build` logs 40 degraded loader reads — NOT a product defect (all routes dynamic,
   measured b016), but it trains everyone to ignore `reportLoaderFailure`. Skip, don't fail.
5. UNMEASURED since b010: steward-class sweep, ČSOB, České dráhy. SZIF subsidy channel
   absent from the corpus. Q-money-13 residue: 21 items with law (14) / effort (7).
6. **What corrupted `./.pglite` in b015 is UNKNOWN** — the build hypothesis was refuted (b016).

## Durable tools (`scripts/case-loops/money/`, see its README)

`triage.ts` · `reconcile-ares-vr.ts` · `public-mandate-sweep.ts` · **`ownership-sweep.ts`**
(`--plan` first) · `ownership-depth2.ts` · `legal-form-audit.ts` · `verify-surface.ts` ·
`validate-payloads.ts` ·
`harvest-contract-dumps.ts` + `persist-contract-harvest.ts` (raw data in `data/raw/`).
Write paths: `scripts/case-loops/persist-batch.ts --pass=<n>` (props-merge) and
`scripts/case-loops/apply-batch.ts --which=ownership-sweep` (inserts). Next pass: **62**.
