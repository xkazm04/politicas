---
name: evidence-citation-doctrine
description: Every rendered number cites its source; non-partisanship is structural, not tonal. The brand rule.
---

# Evidence-first + structural non-partisanship — the brand rule

The product's credibility position is that **every rendered number carries a
source citation** (dataset + cadence), via the canonical primitive
`features/shared/components/SourceNote.tsx`. A surface that drops citations to
look cleaner is off-brand *by definition* (politicas.md §6). This is not
decoration — it is the whole positioning as an empirical, methodology-
transparent source for the elections.

Non-partisanship is enforced in the data model, not just the copy:
- Unverified money ties **never feed the CivicScore** — gated on
  `MoneyTie.verified`; unverified ties render as pending, dated, sourced facts.
- Money ties render as **dated sourced facts, never accusations**.
- Rebellion / vote deviation is framed as *measured deviation from the party
  line*, never as a value judgment.

**Why it matters:** a well-meaning "cleaner" redesign that hides sources, or a
feature that lets an unverified tie affect a score, breaks the product's reason
to exist. Treat citations and the verified-gate as load-bearing, not polish.
