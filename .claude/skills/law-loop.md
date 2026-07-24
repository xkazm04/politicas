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

- **Forensic severity + `flagged_conflict`** — the 65 bills whose sponsors
  carry Case-① money ties, ranked by `sponsor_contract_czk`.
- **Repeat-amendment targets** — laws amended by many prints (586/1992 daně
  z příjmů leads with 7): high-churn statutes are where quiet riders hide.
- **Origin × routing anomalies** — mp_group bills skipping the expected
  gestor committee; bills whose garanční committee's owned themes don't match
  the amended law's domain (use pass-12 `assigned_to` vs F12 `owns`).
- **EU-transposition flags** (O7) and effective-date urgency.

## Stages per unit (bill)

1. **clean** — validate amended_laws refs resolve to law nodes; sponsors
   resolve to persons; routing status current vs psp.cz historie.
2. **enrich** — the legislative dossier: e-Sbírka consolidated text of each
   amended law (what does the change actually DO — the substance the title
   hides); the 3rd-reading roll call (psp.cz hist → vote_event linkage);
   committee treatment (did the garanční výbor amend it?); submitter context;
   media only as narrative context.
3. **wire** — proposals: `voted_in` edges (bill → vote_event, deterministic
   from hist — new rel via handoff/finalize), paragraph-diff artifacts as
   structured props/tables, per-bill **forensic verdicts through the
   `law-verdict.ts` gate** (severity, conflict assessment, unstated effects,
   citations — always `pending_review`, always rendered as derived).
4. **signal** — story-worthiness + the one-line what-this-actually-changes.

## Case gates

Kernel gates plus: (a) NEVER fabricate legal text — a paragraph diff exists
only if both versions were actually fetched from e-Sbírka; (b) forensic
claims pass the law-verdict gate and render as derived/gated, never as fact;
(c) a bill→vote link requires the psp.cz hist record, not title matching;
(d) the `č. N/RRRR Sb.` citation is the only sanctioned bill→law hinge.

## Seed build backlog

1. **Real paragraph diffs on `/zakony`.** Ingest e-Sbírka consolidated
   versions (SPARQL/API — open, autonomous; index texts tsvector+GIN per
   R9–R11), compute §-level before/after for the amended laws — restoring
   the flagship mock feature with real data. The killer differentiator.
2. Bill detail page: dossier + routing + vote + forensic block
   (`/zakony` drill-down or `/zakony/<tisk>`).
3. Forensic verdicts at scale: the ranked head of the 65 flagged bills
   through the gate (Opus for high-severity candidates).
4. Vote→law→impact chain UI: roll call → bill → amended § → effective date
   (closes the loop with `/hlasovani`).

## First batch (calibration)

Top ~8 bills by triage (forensic severity → flagged_conflict CZK → amends
count). Full stages; establish the dossier + diff-artifact schema,
signal-yield baseline, cost/unit. Then reflect and steer.
