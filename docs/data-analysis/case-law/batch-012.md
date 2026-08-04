# Case ③ Law loop — batch 012 (2026-08-04)

Solo run, same day as batch-011 and its P1. Army: 1 Sonnet ARES auditor, 2 Sonnet collision
readers, 3 Sonnet verdict groups, 1 fresh Opus adversarial auditor (max effort) who also ran two
closure passes. P1 (the fresh independent audit of batch-011's remediated payload) is recorded
separately in `batch-012-p1.md`; this note covers P2–P5.

**The pass in one line:** the conflict signal got its systematic hygiene (ARES sweep + the
attributed wiring, both landing as honest nulls at the bill level), the verdict backlog moved
another 10 bills (102 → 92 pending, two new mediums on state-power findings), and the collision
wave closed the §88 star into a full 6-pair cluster while naming tisk 207 as a two-pattern hub.

## P2 — SECTOR_OVERRIDES ARES sweep (the audit batch-010 demanded)

All 27 companies in `company-sectors.ts`'s two lists verified against ARES (NACE) + ownership
(ARES VR / company sources): **25 confirmed, 2 corrections** —
- **SynBiol, a.s.** → `environment`: no health NACE at all despite the "bio" name; fuels,
  lubricants, hazardous chemicals; AGROFERT-family (2013 spin-off, Babiš trust funds).
- **EAST BOHEMIAN AIRPORT a.s.** → `MUNICIPAL_SOE_EXPLICIT`: 66 % City of Pardubice + 34 %
  Pardubice Region after the buyout — a board seat there must not feed the conflict signal.
All 8 municipal entries (incl. SOMPO) re-confirmed as genuinely publicly owned.
Payload: `payloads/batch-012-sector-audit.json` (every ownership claim carries a fetched URL).

## P3 — the attributed signal is WIRED (batch-010's open item closed)

`triage-core.ts` no longer builds a bill's domain set from the union of all amended laws — a
sponsor company's sector must be carried by a NAMED amended law's own label (`viaLaw` on every
adjacency entry) or the bill's own title. The merge-preserving re-triage
(`retriage-009.ts --batch=012`) ran over the live topology with both P2 corrections in:
**sectorAdjacencyHits 8 → 8, zero bills flipped** — the attributed wiring and both sector fixes
are honest nulls at the bill level (batch-010 predicted the first; the second means neither
mis-entry was any bill's sole flag-driver). 12 rows moved, all severity-band arithmetic from
batch-011's verdicts entering the score. 28 hand-written totals blocks preserved.

## P4 — 10 verdicts on the unflagged churn-7 head (pass 45)

Targets: tisky 65, 16, 69, 56, 10, 54, 172, 250, 13, 100 — the pending head after re-triage;
none sector-flagged (all 8 flagged bills already carry batch-011 verdicts), so honest negatives
on conflict were the expected output and all ten delivered exactly that. **2 medium / 8 low**:
- **tisk 69** (zákon o digitální ekonomice, medium/3): §§40–41 create a court-triggered ISP
  website-blocking mechanism not foregrounded in the "určení příslušných orgánů" framing. (The
  ČTÚ-concentration claim was KILLED by the audit — the DZ discloses and justifies it with its
  own RIA; an audit-caught false "unstated" premise, not a finding.)
- **tisk 10** (mediální služby/EMFA, medium/3): the new media-ownership registry is assigned to
  the Ministry of Culture — an executive body under the sponsoring minister — rather than the
  independent RRTV, which runs comparable registries; reasoned only on scope grounds in the DZ.
Findings among the lows worth naming: tisk 172's passport-suspension power with the DZ itself
admitting the holder may never be notified; tisk 65's expansion of what personal-data categories
private financial groups may pull from state registries; tisk 250's **amends undercount** —
the bill amends 10 statutes, the graph carries 6 edges (505/1990, 539/1992, 387/2024, 330/2025
missing — the C8 class; audit hand-counted and confirmed exactly). Same defect found live on
tisk 69 (7 parts vs 6 edges, 132/2010 missing). **Q-law: the amends census owes these two.**

### The audit cycle, honestly
The fresh Opus audit returned **NOT READY**: 3 blocking + 11 major. The batch-011 money/temporal
class did NOT recur (the brief's temporal rule held — 17/17 `whoBenefits` clean, no present-tense
registry roles, no unsupported tie class); the new classes were **§-citation precision** (Article
22 power cited as §6, is §7; a sanction regime placed in §604, is §603a odst. 2; a fine in §17d,
is §17a odst. 5), **count precision** ("pět" vs eight listed vs eleven real), and one **uncited
insinuation** (verdict-250's capture framing on wrong §-mechanics). All remediated by the
authors; the closure check found the remediation had again introduced a defect (the SOMPO role
sourced as graph_fact and mis-ranked vs a stale corpus snapshot) — resolved by fetching ARES VR
directly: Vlček IS předseda představenstva since 2024-12-03, now dated and cited as web; a
final N6 (my own prior-history parenthetical contradicting the ARES record's fine structure)
was closed by dropping the contested history. Three audit rounds, each catching the previous
round's fixes — the doctrine's third same-day confirmation.

Persisted: `kg-forensics --pass=45 --commit`, 10 nodes, `pending_review`. Ledger synced
(`update-ledger-011.ts --batch=012 --pass=45`; the updater + scoped gate are now parameterized
rather than copied). Verdicts total **27 → 49** (92 pending).

## P5 — collision wave: 16 pairs, the §88 star closes

16 of the 60-pair backlog (ranked by genuine-§ count): **8 confirmed-collision /
6 coordination-risk / 2 incidental**, all 32 E-CHECKs pass the P49 guard (one excerpt repaired
deterministically from the cached text before the guard went green). Headlines:
- **The §88 trestní zákoník cluster is now a complete 6-pair coordination cluster** — all
  C(4,2) sides among tisky 7/111/207/213 read; each edits a different substring of the
  confiscation predicate-offense enumeration in §88 odst. 2 písm. c).
- **Tisk 207 is a hub of two distinct patterns**: coordination on §88, and DESTRUCTIVE
  confirmed collisions with tisky 67 and 14 — its wholesale rewrite of §§296/298a/299/300
  (EU directive 2024/1203) destroys the odstavce their narrow edits target; on §298a it reuses
  the label for unrelated content and its own DZ admits relocating tisk 14's subject to §298b.
- **Tisk 64's renumbering habit confirmed on four more statutes** (218/2000, 586/1992 §24 & §25,
  256/2004 §118) — including the proof-by-annex case where its bod 260 "písm. t)" matches the
  ORIGINAL písm. za) text, shown from tisk 40's own platné-znění annex.
- **Tisk 53's platné-znění annex bakes in tisk 16's insertions** — drafted assuming tisk 16
  already in force; an enactment-order dependency, a new collision shape for the case.
- The deterministic pre-check's `odstavecOverlap` both under- and over-flags (missed the
  218/2000 §20 renumbering collision; flagged a disjoint §12) — close reading remains the unit.
Wired into `/zakony/kolize` (94 pairs render, 56 confirmed, czechPending 0). Backlog 60 → 44.

## Not done — disclosed

- **44 collision pairs remain unread.**
- **The amends census undercount on tisky 250 and 69** (4 + 1 missing edges) — found, disclosed
  in the verdicts, NOT fixed this batch (edge-topology change → orchestrator-class work, and the
  census scripts should regenerate it rather than hand-editing edges).
- **tisk 87 ingest gap** unchanged.
- The §-level sector-adjacency rework (batch-004's warning) — the attributed law-level wiring
  shipped; per-§ attribution still needs the amended-§ census.
- Repo-wide typecheck still blocked by the pre-existing effort-case `gate.ts` error (untouched,
  another session's uncommitted work).

## Metrics

| | |
|---|---|
| units | 27 companies audited + 141 rows re-triaged + 10 verdicts + 16 pairs |
| verdicts total | 39 → **49** (2 medium / 8 low new; mediums now 5 of 49) |
| confirmed collisions rendered | 48 → **56** |
| signal hygiene | ARES sweep 25/27 confirmed + 2 fixes; attribution wired; both honest nulls at bill level |
| audit rounds | 3 (initial NOT READY 3B/11M → closure REOPENED 1B → final CLOSED); batch-011's failure class did not recur |
| graph writes | 10 nodes (pass 45, props-merge, pending_review) |
| data-quality yield | 2 live amends-undercount finds (250: 6/10, 69: 6/7) |

## Files

New: `scripts/case-loops/law/{prepare-batch-012,prepare-collision-queue-012}.ts`,
`payloads/{batch-012-targets,batch-012-collision-queue,batch-012-sector-audit,batch-012-sector-audit-input,batch-012-verdicts-combined}.json`,
`payloads/verdicts-012/` (10), `payloads/collision-close-reads-batch012-g{A,B}.json`,
`batch-012-audit.md`, this note.
Modified: `scripts/case-loops/law/triage-core.ts` (attributed adjacency),
`company-sectors.ts` (2 corrections), `gate-verdicts-011.ts` + `update-ledger-011.ts`
(parameterized `--batch=`), `features/lawwatch/getCollisionData.ts` (batch-012 wired),
`ledger.json` (141 rows re-triaged + 10 verdict rows + totals blocks), `graph-log.md` (pass 45).
