# Case ③ Law loop — batch 011 (2026-08-04)

Solo run. Analysis on `.pglite-copy-law-011` (fresh copy of live); the ONE live write is the
gated verdict persist (§4). Subagent army available again after two solo-restricted batches:
3 Sonnet verdict groups + 2 Sonnet collision readers + 1 Opus adversarial audit at maximum
reasoning effort.

**The pass in one line:** the forensic-verdict backlog finally moved — 12 new gated verdicts on
the AUDITED triage head (the first batch to run on a validated signal since the head doubled),
the case's first three medium-severity findings in 39 verdicts, and 16 more collision pairs
close-read, 13 of them confirmed.

---

## 1. Triage — no new signal work, deliberately

Batch-010 audited the sector-adjacency signal (SOMPO fix, attribution). This batch spent that
audit: the 12 targets are the top-9 pending bills by `triageScoreV2` (64, 67, 7, 102, 213, 14,
189, 77, 154) plus the three attributed sector-adjacency survivors outside the head (221, 103,
201). One prep defect caught before dispatch: the targets builder first read the bill's original
`amended_laws` prop (tisk 64: 1 ref) instead of the regenerated `amends` edge topology (147) —
the same C8-undercount class the census fixed; `prepare-batch-011.ts` now derives amended laws
from edges only.

## 2. Verdicts — 12/12 through the gate, Czech-native from birth

First batch where the army wrote Czech directly against `requireCzech` (no rewrite pass needed).
All 12 pass `gate-verdicts-011.ts` — a DB-free scoped gate reading the anti-fabrication scope
(24 774 statute refs ∪ 883 graph ids) from the targets file, so army agents self-checked in
parallel without touching the single-connection store. The 27 archived English originals under
`payloads/verdicts/` are out of its scope by construction.

Final severities after audit remediation (§3): **medium — tisk 67 (conf 4), 213 (conf 3),
221 (conf 3); low — the other nine.**

The three mediums, one line each:
- **tisk 67** (Babiš et al., stavební zákon): of 14 attributed sector leads, the 139/2002 and
  terminology-only groups are honest negatives, but the bill's EIA one-stop-shop (100/2001)
  reaches the AGROFERT chemical operators, and the 235/2004 change edits § 55a — the DEFINITION
  of stavební pozemek, i.e. the VAT-exemption boundary — with Hartenberg/IMOBA active in
  real estate; that channel is held OPEN, not cleared. Šťastný's Pražské služby tie (53,3 mld,
  the batch's largest) is explicitly disposed as municipal (100 % hl. m. Praha, cited).
- **tisk 213** (security omnibus): § VIII amends general foreigner-residency law for ALL
  third-country nationals — real scope-beyond-title under the Ukraine framing.
- **tisk 221** (conflict-of-interest reform): two tracks — it LOOSENS the procurement exclusion
  for ministers while CREATING a new restriction class covering ÚSC councillors; both sponsors
  (Vondráček, Pražák) are themselves regional councillors whose companies fall in the new class
  with respect to their own councils (hlidacstatu.cz cited). Not self-dealing — the new rule
  binds them — but the original "cleared" framing was false and is gone.

## 3. The Opus audit earned its cost — 1 BLOCKING + 8 MAJOR, all remediated same-session

`batch-011-audit.md` (adversarial, max effort, independent re-derivation): no fabrication
anywhere (all statutes real, all 21 re-read excerpts verbatim), but the money-claim class
failed exactly as the kernel predicts — six of nine findings were money-touching:

| # | file | defect | fix |
|---|---|---|---|
| B1 | verdict-67 | Lovochemie tied to 100/2001 (its lead is 139/2002) — false attribution + self-contradiction | attribution corrected, groups now disjoint |
| M2 | verdict-67 | "bez věcného dopadu na DPH" cleared 4 leads while the edit moves the exemption boundary | claim retracted, channel reopened as unresolved |
| M3 | verdict-67 | "12" leads claimed, 14 in the data, SynBiol silently undisposed | all 14 accounted |
| M4 | verdict-67 | Šťastný's largest-in-batch tie silently skipped | disposed as municipal, cited |
| M5 | verdict-64 | medium rested on a self-referential census effect + a premise the DZ refutes | effects rebuilt, severity → low |
| M6 | verdict-221 | "výhradně ministři" cleared both leads; the bill's own § 4c/§ 48 reaches ÚSC councillors | two-track restatement, sponsors' seats verified |
| M7 | verdict-103 | company attributed to the wrong sponsor; "nikoli o soukromé vlastnictví" false (Energie - stavební a báňská is private) | premises corrected, conclusion re-derived |
| M8 | verdict-189 | rider inventory missed 3 of 7 bundled tax changes | all 7 named, grep-verified |
| M9 | gB payload | `classificationCounts` contradicted its own `pairs[]` | counts recomputed from pairs, both files |

Remediation was done by the SAME agents that wrote the verdicts (resumed with the findings) and
re-gated 12/12. **Per the batch-006 doctrine, driver-side remediation is not a second
independent check — a FRESH audit of the remediated payload is batch-012's P1**, before any of
the three mediums is promoted past `pending_review` by a human.

## 4. Persist — pass 43, and the manifestation check that follows it

`kg-forensics.ts --write --pass=43 --commit`: 12 bill nodes enriched with `forensic_*` props,
`pending_review`, provenance `{track: law, pass: 43}`. Ledger updated merge-preservingly
(`update-ledger-011.ts` — refuses to touch a row carrying another batch's verdict).

Rendering verified by running the loaders, not by assuming: `getLawData` → 141 bills, **39
forensic blocks, 0 withheld strings, 12/12 batch-011 targets render**; `getCollisionData` → **80
pairs (48 confirmed / 32 coordination-risk), 15 batch-11 pairs, czechPending 0**.

That last zero is new: the hardcoded batch-002 prior pair 111-207 carried English
loader-authored reasoning that the render gate had been silently withholding since pass 33 —
`czechPendingCount` was permanently 1 and nobody asked why. Rewritten in Czech (substance
unchanged from batch-002.md §3).

## 5. Collision wave — 16 read, 13 confirmed, and tisk 64 is a collision machine

16 pairs from the 76-pair backlog (ranked by genuine-§ count; the 7 closed 68⊂90 pairs and all
previously read pairs excluded — with one instructive miss, see below). All 16 pass the P49
presence guard (32 E-CHECKs) after one deterministic excerpt repair. Results: **12
confirmed-collision / 2 coordination-risk / 2 incidental** as written, plus one pair
(120-244) re-confirming batch-001's first-ever finding with verbatim evidence it never had —
that read SUPERSEDES the loader's hardcoded `PRIOR_PAIRS` entry (English, no excerpts), which
is deleted; the new card discloses the lineage.

Two mechanisms dominate:
- **Tisk 64 (147-amendment účetnictví omnibus) inserts/deletes a letter and renumbers the rest**
  — breaking other bills' letter-addressed edits on FOUR statutes (240/2013 § 604, 21/1992
  § 36c/§ 26, 542/2020 § 124, 256/2004 § 136). A structural authoring habit, not
  statute-specific: 7 of the batch's confirmed collisions involve tisk 64.
- **586/1992 § 35ba odst. 1 is a three-way collision** — tisky 120, 189, 244 each delete or
  insert different letters of the slevy-na-dani list and renumber; all three pairings confirmed.
  With batch-001/003/004's findings this § now carries a 5-bill cluster.

The 68⊂90 containment held byte-identically on both new statutes (23/2017, 250/2000) — the
64×68 and 64×90 pairs are classified identically with the family disclosed per pair.

Queue-exclusion miss worth recording: the "already read" filter keyed off
`collision-close-reads*.json` files only, so the narrative-era pair 120-244 (batch-001, recorded
in prose) was re-queued. The re-read produced strictly better evidence, so the miss was
profitable this once — but the filter now needs the prior pairs in scope if the narrative era
ever grows.

PairId hygiene: same-bill pairs on different statutes now carry statute-suffixed ids
(`64-143-21-1992`), because `sourceBatchOf` keys on pairId alone and two cross-file clashes
(13-64, 65-154 — earlier batches, DIFFERENT statutes) would have mislabeled the older pairs'
source batch.

## 6. Not done — disclosed

- **60 partitioned pairs remain unread** (76 − 16). The queue file ranks them.
- **Union-inflation fix still not wired into `triage-core.ts`** (batch-010's open item) — the
  attributed computation exists (`sector-adjacency-010.ts`) but does not order the ledger yet.
- **SECTOR_OVERRIDES full ARES audit** still owed (batch-010 found SOMPO by reading, not sweep).
- **Fresh independent audit of the remediated verdicts** — batch-012 P1 (see §3).
- **tisk 87 cached-PDF ingest gap** (no summary) — unchanged, an ingest task.
- Repo-wide `npm run check` is blocked by a PRE-EXISTING typecheck error in
  `scripts/case-loops/effort/gate.ts` — another session's uncommitted in-flight work, outside
  this batch's boundary, not introduced here (this batch's files: typecheck/lint clean; vitest
  1358 passed + 3 file-level PGlite hook timeouts that pass in isolation, a load transient from
  the concurrent army).

## 7. Metrics

| | |
|---|---|
| units processed | 12 bills (verdict stage) + 16 collision pairs |
| verdicts total | 27 → **39** (114 → 102 pending) |
| severity distribution (new) | 3 medium / 9 low |
| confirmed collisions total | 35 → 48 rendered |
| signal yield | high — 2 real mechanisms (tisk-64 renumbering habit; § 35ba three-way), 1 systemic surface fix (czechPending), 9 audit-caught defect classes |
| Opus cost | 1 audit (xhigh); caught 9 real defects — the armed trigger fired for the first time on genuine mediums |
| graph writes | 12 nodes (pass 43, props-merge, pending_review) |

## 8. Files

New: `scripts/case-loops/law/{prepare-batch-011,gate-verdicts-011,update-ledger-011}.ts`,
`payloads/batch-011-targets.json`, `payloads/batch-011-collision-queue.json`,
`payloads/verdicts-011/` (12 verdicts + combined), `payloads/collision-close-reads-batch011-g{A,B}.json`,
`batch-011-audit.md`, this note.
Modified: `features/lawwatch/getCollisionData.ts` (batch-011 files wired, 120-244 prior pair
superseded, 111-207 reasoning Czech), `docs/data-analysis/case-law/ledger.json` (12 rows +
`totals.batch011Verdicts`), `docs/data-analysis/graph-log.md` (pass 43).
