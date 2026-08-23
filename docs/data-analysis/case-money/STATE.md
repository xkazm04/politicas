# Money loop — STATE (resume here)

> **Regenerated every batch. Read THIS first, `ledger.md` only for history.** The ledger
> is 1 100+ lines of append-only batch log; loading it to resume cost every session
> ~80 KB of prose before it could act (2026-08-22 architecture review). Open items live
> in `ledger.json → openItems` and are mirrored here by hand until a generator exists.

**As of:** batch 020 · 2026-08-23 · last graph write **pass 66** · backups
`.pglite-backup-2026-08-23-pass65-pre`, `…-pass66-pre` (checkpointed, via `npm run db:backup`).

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
| company-axis coverage | **194 / 195 tied companies verdicted** — publicly-owned 61 · public-body 8 · private 70 · unpublished 40 · unknown 15 | b019 |
| publicly-owned (company axis) | **61 companies · 325 522 781 381 CZK** — 4 moved to steward (b015–016), the rest steward-by-role corroborated by the register | b015–019 |
| role × register contradictions | **18 ties** (steward class at a private BUSINESS — Lovochemie, PRECHEZA, Fatra, Kostelecké uzeniny, Nemocnice AGEL VM, Nemocnice Valtice, Rybářství Třeboň …) flagged in the console, none re-classed by the loop | b019 |
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

0. **First real human-gate session: the 18 role×register contradictions** — `/penize/kontrola`
   lane **„rozpor role × rejstřík"** (b020) opens on exactly them; confirm or re-class
   (`REVIEWER_TOKEN` + `REVIEWER_NAME`, see `.env.example`). **The loop's next analytical
   step waits on this** — a re-classed `tie_class` changes the attributable population.
1. **Citations for the `ownership-not-published`**: done for PRE (chart k 31. 12. 2025: PRE
   Holding 58,05 % / EnBW 41,40 %) and ČSOB Pojišťovna (KBC Verzekeringen NV) as
   `ownership_disclosed` (pass 66, cited, layered, never an edge). Remaining 7 attributable
   hold 0,56 mld. — cheap if their výroční zprávy name the owners (PRE, ČSOB Pojišťovna, VaK
   Vsetín, VaK Vyškov, RERA, SOMPO, Horní Labe, PEVAK, Družstvo Nárožní dům — 16,77 mld.):
   all multi-shareholder a.s./družstva the OR cannot resolve (sole-akcionář rule); each
   needs a document-source citation (Praha's majetkové účasti for PRE). **PRE is CLOSED
   as unanswerable from the register** (b018) — not a graph gap, a source gap.
2. `unknown` 15 companies / 48,8 mld. — foreign owners without a legal form (CS CABOT,
   IMOBA …) and forms 745/999; a human ruling per company.
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
`scripts/case-loops/apply-batch.ts --which=ownership-sweep|ownership-vr` (inserts). Next pass: **67**.
