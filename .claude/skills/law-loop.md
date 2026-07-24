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

## Batch-004 priorities (set at batch-003 integration)

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

Batch 001 (pass 15): 8 verdicts + routing render + e-Sbírka scoping. Batch
002 (pass 18): 10 verdicts + collision pre-check + THE first real §-diff
(SPARQL). Batch 003 (pass 20): 8 verdicts + census (140/141) + 3 confirmed
collisions + 4 more diffs (15 bills render). All 27 gated verdicts severity
low — two independent conflict signals agree. Ledger:
`docs/data-analysis/case-law/`.
