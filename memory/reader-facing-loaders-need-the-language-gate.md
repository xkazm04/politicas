---
name: reader-facing-loaders-need-the-language-gate
description: Analyst prose reaches Czech readers as English unless the loader itself imports lib/analysis/language-gate.ts — the leak has recurred surface-by-surface across three passes.
metadata:
  type: project
---

Politicas is `lang="cs"`, but the analyst loops (case-money / case-effort / case-law) write their
prose — verdicts, close-read reasoning, summaries — in **English**, and it renders verbatim unless
a loader stops it. This has now been found and fixed **three times on three different surfaces**,
each time after the previous fix was declared done:

- pass 33 — 27 `forensic_*` verdicts on `/zakony`, plus 0/141 bill summaries
- batch 009 — **44 of 44** close-read analyses on `/zakony/kolize`, written *after* the kernel's
  presentation gate was documented

**How to fix it, and the reason prose alone never works:** `lib/analysis/language-gate.ts` is the
canonical module (deterministic stopword classifier, no model call — a diacritics test fails here
because the English originals are dense with `č. 586/1992 Sb.`, `Kč`, `důvodová zpráva`). Use it at
**both** ends, mirroring `lib/analysis/public-copy.ts`:

- **persist time** — `assertCzech` / `czechGateErrors` so English can't enter the graph
- **render time** — `czechCopyOrNull` in the loader, with `CZECH_WITHHELD_CZ` as the visible
  placeholder. Withholding is deliberately non-destructive: the English stays as ground truth and
  simply does not ship. Never machine-translate, never render a partial.

Then add a test that fails on the next English string — see the presentation-gate test in the
collision-loader suite. **Treat any reader-facing `get*Data.ts` without this import as an
unguarded surface**, and check it before assuming a surface is clean; the defect is invisible to
accuracy-only review because an English sentence can be perfectly true, cited and gated against
fabrication. Related: [[evidence-citation-doctrine]].

A second trap found alongside it, worth the same reflex: **"the data just needs wiring in" is a
claim to verify, not an estimate.** A payload whose classification vocabulary differs from what the
loader filters on (`confirmed` vs `confirmed-collision`) drops every row silently, and a
dropped-at-filter failure looks exactly like "that batch found nothing". Check the payload's
vocabulary and required fields against what the loader consumes, not just that the file exists.
