# Law loop — STATE (resume here)

> **Regenerated every batch. Read THIS first.** This case never had a `ledger.md`: its
> resume state was spread across `handoff.md` (the orientation document, still
> authoritative for doctrine) and 37 `batch-*.md` / `batch-*-audit.md` notes. Those stay
> as the full record; this page is the short current state (2026-08-22 architecture review).

**As of:** batch 021 · 2026-08-06 · last graph write **pass 55** (12 verdicts) · corpus
**CLOSED** — staleness-driven mode.

## Where the case stands

| fact | value |
|---|---|
| forensic verdicts | **141/141 PSP10 bills** — 0 high / 34 medium / 107 low — **all `pending_review`** |
| reader-facing gate | `lib/analysis/law-verdict.ts` at persist AND render; live **0 withheld** fields |
| collision census | 176 partitioned pairs; `/zakony/kolize` renders 136, 63 confirmed |
| amended-§ census | 3 317 operative bill→§ pairs (insertion-corrected, b017/018) |
| `provenance-probe.ts` EXPECT | `{withF: 141, laws: 293, amends: 582, passes: 45–55}` — run at every batch start/end |
| sector attribution | b020 surface: dispositions verbatim, gate failures disclose |

## Doctrine (kept in `handoff.md` §"verification doctrine" — read it before writing)

Closure gates the write (a FRESH Opus auditor returns CLOSED before any persist); the
named failure classes in the order paid for; standing detectors (quotation sweep,
named-authority rule, date-split regex, `43\d{3}` node-id scan, could-it-have-known
chronology check). **Remediation is a defect source at roughly the rate authorship is.**

## Open items (priority order)

1. **The graph `sponsors` prop is wrong upstream** (pass 34 `psp-tisky-roles`): over-
   inclusion (tisk 116: 6 names vs 3) and a wrong join (tisk 87: 42 cross-club names,
   real submitter absent); 3 `mp` bills with n>1, 23 with `[]` beside a named submitter.
   No published verdict misattributes sponsorship (the three affected disclose). Needs a
   regen pass + audit + the free `sponsors`-vs-`submitter` consistency detector. Any
   surface reading `sponsors` directly (check /zakony sponsor chips) inherits it until then.
2. **The human review gate** — 141 verdicts await it; the console pattern exists
   (`/penize/kontrola`) and has never been exercised for law.
3. Q-money-13 residue: **14 items** held here (stale IČO prop mentions).
4. Backlog from b016 (accusation-by-omission class): a STRUCTURAL jargon rule (three
   batches, three new token classes — the literal list wants a closed form); evidence
   anchored to structural coordinates (done at passes 52–53).

## Durable tools (`scripts/case-loops/law/`, see its README)

`triage.ts` + `triage-core.ts` · `prepare-batch.ts` · `gate-verdicts.ts` ·
`verify-close-reads.ts` · `collision-check.ts` + `collision-core.ts` ·
`amends-census.ts` / `amends-regen.ts` / `apply-amends-regen.ts` /
`validate-amends-regen.ts` · `esbirka-sparql-diff.ts` / `esbirka-versions.ts` ·
`provenance-probe.ts` · `company-sectors.ts` · `build-bill-summaries.ts` ·
`build-cz-verdict-patch.ts` · `ingest-missing-laws.ts`. Army brief: `ARMY-CONTRACT.md`.
