# Money loop — STATE (resume here)

> **Regenerated every batch. Read THIS first, `ledger.md` only for history.** The ledger
> is 1 100+ lines of append-only batch log; loading it to resume cost every session
> ~80 KB of prose before it could act (2026-08-22 architecture review). Open items live
> in `ledger.json → openItems` and are mirrored here by hand until a generator exists.

**As of:** batch 018 · 2026-08-23 · last graph write **pass 64** · backups
`.pglite-backup-2026-08-23-pass61-pre`, `…-pass62-pre` (checkpointed, via `npm run db:backup`).

## The numbers the surface renders

| figure | value | since |
|---|---|---|
| `/penize` attributable headline | **17 417 308 400 CZK** (unchanged b017–018) | b016 |
| steward bucket | 459 167 182 951 CZK | b016 |
| total reachable (unchanged since b013) | 476 584 491 351 CZK | b012 |
| excluded — register names a different recipient | 11 771 399 766 CZK / 128 contracts | b014 |
| kept but shared — several named recipients, no split | 1 331 071 128 CZK / 117 | b014 |
| **ownership-not-published** (attributable, unverified) | **9 companies · 16 768 454 356 CZK** — PRE + ČSOB Pojišťovna = 16,2 mld. of it; the other 37 were private (owners recorded) once `spolecnik[]` was read | b018 |
| private (evidenced) | 37 companies · 637 464 307 CZK | b018 |
| publicly-owned (company axis) | **53 companies · 324 845 206 394 CZK** — 4 moved to steward (b015–016), 49 steward-by-role corroborated by the register (b017–018) | b015–018 |
| `owns_stake` layer | **113 edges** (33 → 62 dataor → 113 + ARES VR) · 84 current stakes · 350 company nodes | b017–018 |
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
- `ownershipRecord()` reads BOTH VR shapes — `akcionari[].clenoveOrganu[]` and
  `spolecnici[].spolecnik[]` (with `sharePct`/dates); for an s.r.o. VR lists every
  společník, for an a.s. only a sole akcionář (b018). `public-mandate-sweep` never
  downgrades a live `publicly-owned` (depth-2 proof beats an own-record absence).

## Open items (priority order)

1. **Review-queue lane for the 9 `ownership-not-published`** (PRE, ČSOB Pojišťovna, VaK
   Vsetín, VaK Vyškov, RERA, SOMPO, Horní Labe, PEVAK, Družstvo Nárožní dům — 16,77 mld.):
   all multi-shareholder a.s./družstva the OR cannot resolve (sole-akcionář rule); each
   needs a document-source citation (Praha's majetkové účasti for PRE). **PRE is CLOSED
   as unanswerable from the register** (b018) — not a graph gap, a source gap.
2. **90 steward-by-role companies still without a company-axis verdict** — run
   `public-mandate-sweep` over the steward class (ARES only, cheap) to finish the
   corroboration.
3. Prague s.r.o. register — history only now (current owners covered by VR); retry
   `ownership-sweep.ts --fetch-budget=1` on a day dataor serves > 75 MB per connection.
4. `npm run build` logs 40 degraded loader reads — NOT a product defect (all routes dynamic,
   measured b016), but it trains everyone to ignore `reportLoaderFailure`. Skip, don't fail.
5. UNMEASURED since b010: steward-class sweep, ČSOB, České dráhy. SZIF subsidy channel
   absent from the corpus. Q-money-13 residue: 21 items with law (14) / effort (7).
6. **What corrupted `./.pglite` in b015 is UNKNOWN** — the build hypothesis was refuted (b016).

## Durable tools (`scripts/case-loops/money/`, see its README)

`triage.ts` · `reconcile-ares-vr.ts` · `public-mandate-sweep.ts` · `ownership-sweep.ts`
(`--plan` first; dataor bulk) · **`ownership-from-vr.ts`** (per-IČO, `--which=ownership-vr`) ·
`ownership-depth2.ts` · `legal-form-audit.ts` · `verify-surface.ts` ·
`validate-payloads.ts` ·
`harvest-contract-dumps.ts` + `persist-contract-harvest.ts` (raw data in `data/raw/`).
Write paths: `scripts/case-loops/persist-batch.ts --pass=<n>` (props-merge) and
`scripts/case-loops/apply-batch.ts --which=ownership-sweep|ownership-vr` (inserts). Next pass: **65**.
