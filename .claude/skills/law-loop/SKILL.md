---
name: law-loop
description: Run the Law-forensics analyst-builder loop over the 141 PSP10 bills and 101 laws — triage-rank by forensic severity, sponsor-money conflict flags and amendment patterns, dispatch a subagent army bill-by-bill (e-Sbírka text diffs, vote linkage, committee routing, gated forensic verdicts at scale), and ship /zakony increments (real paragraph diffs first). Use when the user says "run the law loop", "process the bills", "scale the forensics", or wants Case ③ to advance.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebSearch, WebFetch
---

# Law loop — Case ③ legislation-forensics analyst-builder

Extends the shared kernel — **read `docs/case-loops.md` first**, then
`lib/analysis/law-verdict.ts` (the gated forensic-verdict contract),
`lib/ingest/sources/psp-legislation.ts` (tisky + e-Sbírka + committee
routing), and the bill/law rows of `[[graph-schema]]`.
Vault home: `docs/data-analysis/case-law/`.

## Population & unit

**141 `bill` nodes** (`bill:tisk:<id>`; props: cislo, druh, origin, submitter,
amended_laws, sponsors, flagged_conflict — 65/141, sponsor-money props; 1
gated `forensic_*` verdict on tisk 58) → **101 `law` nodes** (`law:sb:<n>-<rok>`,
e-Sbírka refs) via **150 `amends`**, **528 `sponsors`**, and — since pass 12 —
**150 `assigned_to`** edges (formal committee routing: role garanční/další,
status přikázáno/navrženo/iniciativně, assignedOn; 10 bills honestly
unrouted).

## Triage signals (deterministic)

*(re-weighted after batch 001 — P32, two signals proved degenerate)*

- **Repeat-amendment targets LEAD** — laws amended by many prints (586/1992
  ×7): high-churn statutes are where quiet riders hide, and churn-led triage
  found them (wine excise in tisk 4, beer in 40).
- **Conflict by SECTOR-ADJACENCY, not raw CZK** — `sponsor_contract_czk`
  saturates on municipal/SOE board roles (ARENA BRNO 5.39B ranked ten bills
  identically) and the top-8 flagged bills yielded 0 real conflicts. Rank by
  the tie company's sector vs the amended law's domain; exclude
  municipal/SOE board roles; log-scale any money term. **Absence of conflict
  is the expected, valuable output for general legislation.**
- **Origin × routing anomalies — only after `owns` densifies** (currently 30
  edges → 89% false-positive rate; Q-law-1 basis work first).
- **EU-transposition flags** (O7) and effective-date urgency.

## Stages per unit (bill)

1. **clean** — validate amended_laws refs resolve to law nodes; sponsors
   resolve to persons; routing status current vs psp.cz historie.
2. **enrich** — the legislative dossier: e-Sbírka consolidated text of each
   amended law (what does the change actually DO — the substance the title
   hides); the 3rd-reading roll call (psp.cz hist → vote_event linkage);
   committee treatment (did the garanční výbor amend it?); submitter context;
   media only as narrative context.
3. **wire** — proposals: paragraph-diff artifacts as structured props/tables,
   per-bill **forensic verdicts through the `law-verdict.ts` gate** (severity,
   conflict assessment, unstated effects, citations — always
   `pending_review`, always rendered as derived). ⚠ `voted_in` (bill →
   vote_event) is a documented DEAD-END from cached data: `hist.unl` col 5
   is a document/usnesení id (58xxx), NOT the vote_event id-space (86xxx) —
   the real join needs the hlasovani-agenda ingest (`hl-*.zip` `bod_schuze`
   cross-ref, Q-law-2). Never link by title matching.
4. **signal** — story-worthiness + the one-line what-this-actually-changes.
   **Explicitly solicit non-conflict lead classes** (batch 001's richest
   yield): drafting collisions between sibling prints on the same §
   (120↔244), quiet riders under headline titles, data-quality gaps (the
   `amends` undercount, C6), enacted-vs-pending status surprises.

## Case gates

Kernel gates plus: (a) NEVER fabricate legal text — a paragraph diff exists
only if both versions were actually fetched from e-Sbírka; (b) forensic
claims pass the law-verdict gate and render as derived/gated, never as fact;
(c) a bill→vote link requires the psp.cz hist record, not title matching;
(d) the `č. N/RRRR Sb.` citation is the only sanctioned bill→law hinge —
BUT it undercounts systematically for government omnibus bills (C8: 7–8
real statutes vs 1 recorded); treat `amends` as incomplete for that class
until the body-text parse lands (Q-law-6); (e) a `graph_fact` citation may
only assert what the cited node's own props hold — web-researched substance
(ownership, private status) cites its URL as `web` (batch-002 gate-
improvement candidate for `gate-verdicts.ts`).

## Seed build backlog

1. **Real paragraph diffs on `/zakony` — ✅ SHIPPED (batch 002) via the
   e-Sbírka SPARQL endpoint.** The canonical method is now
   `scripts/case-loops/law/esbirka-sparql-diff.ts` — point-query access to
   any statute/version/§ at negligible bandwidth (supersedes the shelved
   1.24GB bulk plan; keep `esbirka-versions.ts` only for a future
   full-corpus tsvector ingest, Q-law-7). First artifact live: §35ba of
   586/1992, 2021→2024, 8 hunks. Two distinct pipelines still hold:
   **historical** (enacted↔enacted — the shipped method) vs **prospective**
   (pending bill vs current — needs tisk-PDF novelization instructions;
   pending bills have NO enacted "after"). Anti-fabrication: before AND
   after are verbatim fetched fragment text; HTML stripped only at render.
   Next diffs are one command each (§35c child credit queued).
2. Bill detail page: dossier + routing + vote + forensic block
   (`/zakony` drill-down or `/zakony/<tisk>`).
3. Forensic verdicts at scale: the ranked head of the 65 flagged bills
   through the gate (Opus for high-severity candidates).
4. Vote→law→impact chain UI: roll call → bill → amended § → effective date
   (closes the loop with `/hlasovani`).

## Batch-006 priorities (set at batch-005 integration)

1. **P1: independent re-audit of the batch-005 remediated payload** — the
   driver fixed 6 of the 11 defects its OWN Opus audit found; that is not
   equivalent to a second independent check. Audit
   `batch-005-amends-regen.json`/`batch-005-missing-law-nodes.json` fresh
   before any live apply.
2. **Full precision measurement on all 567 regenerated edges** (only 3
   hand-proven false cases were fixed; a ~6.3% proxy false-positive rate
   flagged pre-remediation was never re-measured post-fix) — run the
   amending-context proxy as a reported metric, not a spot-check.
3. **A durable apply path** (D3/D4) — `persist-batch.ts` is shared and
   props-merge-only; this and every future case that needs to GROW the
   node/edge set (not just annotate) needs an insert-capable path,
   node-then-edge ordered, preserving pre-existing edges' provenance rather
   than blind-overwriting it.
4. **Re-triage** the moment the regen applies (churn ranking flips, 40/2009
   takes #1; sector-adjacency needs §-level recomputation, not naive
   re-run over the new edge set — see batch-004's reflection warning).
5. **Collision army wave** on the remaining ~171 partition-survivor pairs
   (583 raw / 186 partitioned, only 15 close-read so far) — WITH a properly
   validated ranking signal first; batch-005's `moneyLiteral` candidate was
   found NOT statistically distinguishable from the partition-survivor
   baseline (Fisher p=1.00) and should not be trusted to order the sweep
   as-is.

## Batch-005 priorities (DONE — see ledger/batch-005.md/handoff.md; kept for history)

1. **P1 (paired, land together): missing-law-node ingest** (Q-law-12 — 188
   statutes / 289 citations = 50.6% have no node; e-Sbírka SPARQL resolves
   ELIs cheaply, autonomous authority) **+ apply the validated 282-edge
   amends regeneration** (Q-law-11's set-difference trigger first; the
   payload passed 282/282 and is HELD at the orchestrator). — DONE:
   187/187 statutes resolved (e-Sbírka bulk registry, not SPARQL — see
   batch-005.md §1 for why), regen closes to 567 edges/0 missing. Opus
   audit found the first pass NOT READY (11 defects), 6 remediated
   same-batch; a FRESH audit is batch-006's P1, not a formality.
2. Re-run the collision pre-check on the regenerated topology (~5× candidate
   universe; expect ~170 surviving pairs) — feed `/zakony/kolize`. — DONE:
   583 raw / 186 partitioned pairs, 15 close-read (5 confirmed / 7
   coordination-risk / 3 incidental), rendered as a labeled batch-5/
   post-regen-pending section.
3. Ranking-signal validation for the sweep order (P52 — shared-§ count does
   not discriminate). — DONE, result is NULL: the proposed replacement
   (moneyLiteral) was implemented and honestly found NOT statistically
   validated at n=15 against the partition-survivor baseline — do not
   treat it as proven before a larger sample runs.

## Batch-004 priorities (DONE — see ledger; kept for history)

1. **Q-law-8 — amends edge regeneration decision:** `amended_laws_full`
   census props are live on 53 bills (420 unrecorded citations; gov omnibus
   2.3× worse, tisk 64 = 148 vs 1). Regenerating the `amends` edges from
   them re-ranks churn and most-amended statutes — coordinate with the
   orchestrator (edge topology change, not a props merge).
2. **Q-law-9 — the remaining 58 collision pairs:** 25% confirmed hit rate on
   the first 12 means this backlog is undervalued; partition omnibus PDFs by
   statute first (Q-law-10, the tisk 248 contamination fix).
3. More SPARQL diffs — each is one command; target the §s the collision
   clusters fight over (§35ba cluster, §134l, §88).
4. Czech legal-text parsing rules now in force: word-boundary keywords
   (P42), amendment-lineage citations are noise (P48), grep verifies
   presence claims (P49).

## History

**THE VERDICT CORPUS IS COMPLETE (batch 021 / pass 55, 2026-08-06): 141/141
bills carry a gated forensic verdict** (0 high / 34 medium / 107 low, all
`pending_review` — the human gate was never delegated). Batches 011–021
(passes 45–55) ran the closure-gates-the-write cycle: verdict army → driver
gates → FRESH Opus audit → remediation → closure → persist. Read
`docs/data-analysis/case-law/handoff.md` (corpus-close edition) FIRST for the
verification doctrine, the seventeen named failure classes, the standing
detectors, and the open items (the graph `sponsors`-prop regen is #1; the
human review gate for the 141-verdict queue is #2). A future batch here is a
CORRECTION or ENRICHMENT batch, not coverage — the same gates apply, plus
batch-021's lesson: remediation is a defect source at authorship rate.

Early history — Batch 001 (pass 15): 8 verdicts + routing render + e-Sbírka
scoping. Batch 002 (pass 18): 10 verdicts + collision pre-check + THE first
real §-diff (SPARQL). Batch 003 (pass 20): 8 verdicts + census (140/141) + 3
confirmed collisions + 4 more diffs (15 bills render). Ledger:
`docs/data-analysis/case-law/`.
