# Case ③ Law loop — batch 012 P1: the fresh independent audit, and what it proved (2026-08-04)

Solo run, same day as batch-011. This is the P1 the batch-011 note committed to: a SECOND,
independent Opus audit (max effort, no shared context with the authors or the first auditor) of
the remediated batch-011 verdicts — because an author remediating their own audit findings is
not a second check, and batch-006 already paid to learn that.

**The doctrine held, twice.** The fresh audit (`batch-012-p1-audit.md`) found:
1. **All nine first-audit findings genuinely closed** — 9/9, each re-derived from the primary
   source, not from the remediation's account of itself.
2. **The remediation had introduced 1 BLOCKING + 6 MAJOR defects of its own** that nobody had
   audited — five of seven in the money-touching class again. The blocking one: both of the
   batch's largest money figures (Bendl × Energie - stavební a báňská, 20,79 mld; Šťastný ×
   Pražské služby, 53,27 mld) were asserted as PRESENT-TENSE ties while the registry shows the
   roles ended 23. 2. 2001 and January 2012. The remediation had visited the very registry page
   carrying the end date and brought back only the ownership fact.

## What was fixed (F1–F7 + residual minors, all driver-applied, all closure-checked)

- **F1**: both ties dated with cited sources (podnikatel.cz permalink for Bendl's 1996–2001
  dozorčí rada; Aktuálně.cz 12. 1. 2012 for Šťastný's departure) and both figures restated as
  registry-of-contracts totals, never current holdings.
- **F2**: verdict-67's `komu prospívá` no longer names IMOBA/Hartenberg as beneficiaries of an
  effect the verdict says it has not signed — it now leads „Nelze jednoznačně určit".
- **F3**: verdict-221's one-word inversion (`RUŠÍ` → `ROZŠIŘUJE`).
- **F4**: the `skutečný majitel` premise stated as UNVERIFIED (a board seat is not beneficial
  ownership; the case file carries no beneficial-owner data) in both fields it carries.
- **F5**: verdict-189's citation now lists the same seven riders as its own effect and states
  the EET tax credit is not among them.
- **F6**: the combined persist artifact moved out of the gated directory and the gate's filter
  hardened to `/^verdict-\d+\.json$/` — the gate exits 0 on its own shipped payload again.
- **F7**: verdict-67 confidence 4 → 3 while the § 55a channel stays sign-undetermined.
- Residuals: §339 (3–12) vs §340 (3–10) separated in verdict-213 (both grep-verified);
  typos; the two-companies-one-URN citation split; the Pražák citation claim narrowed to what
  the cited page carries; § 4b/§ 11a attribution corrected.

The closure check (same fresh auditor, against the files, not my account) returned **CLOSED
WITH NOTES**: every finding fixed, two new MINORs found in MY fixes (a parenthetical inserted
mid-statutory-reference by a regex whose `[^.]*` stopped at the dot in „odst."; and the Šťastný
date being weaker than the fetchable source allowed) — both fixed and re-verified same session.
The corrected six verdicts (64, 67, 103, 189, 213, 221) were re-persisted as **pass 44**;
final gate 12/12, `getLawData` renders 39 forensic blocks with 0 withheld strings.

## The lesson, stated once

Three rounds deep, every round of REMEDIATION introduced new defects in the same class it was
fixing (money-touching prose), and every round of INDEPENDENT AUDIT found them. The loop's
safety property is not "authors get it right eventually" — it is "an independent reader with
the primary sources always runs before a reader with trust does." Also concretely: **a registry
page that names a role carries its dates three lines away — a money disposition that cites the
page must carry the dates too**, and a temporal qualifier belongs next to every CZK figure that
could read as a current holding (`/penize` renders this as the ARES-VR badge; verdict prose has
no badge, so the sentence itself must say it).

## Files

- `batch-012-p1-audit.md` — both audit passes (initial REOPENED + post-fix closure).
- `payloads/batch-012-p1-corrected-verdicts.json` — the six corrected verdicts as persisted
  (pass 44).
- Modified: 6 × `payloads/verdicts-011/verdict-*.json`, `gate-verdicts-011.ts` (filter),
  `ledger.json` (confidence sync), `graph-log.md` (pass 44); the combined batch-011 artifact
  moved to `payloads/batch-011-verdicts-combined.json`.

## Open for batch-012 proper

Unchanged from batch-011 §6: 60 collision pairs unread; union-inflation fix not wired into
`triage-core.ts`; SECTOR_OVERRIDES ARES sweep owed; tisk 87 ingest gap. P1 is done — the three
medium verdicts (67, 213, 221) now stand on twice-audited evidence, still `pending_review`,
awaiting the human gate.
