# scan-sweep — project overlay (politicas)

Runs on the skill defaults; this file exists for the improvement log below.

## Skill improvement log

- 2026-09-01 — `moonshot-architect` is an operator-named ad-hoc lens (absent from
  `references/lenses.md`). Run as a 10-scout per-group fan-out (develop, L+ only);
  snapshot scope `moonshot:all-groups`, `lens_keys: []` so it never counts as coverage.
  The durable deck is `docs/architect/moonshot-2026-09-01.md`; the outbox holds only
  the top 29 bodies. Re-running the lens must read that doc first and not re-propose
  its 47 titles.
