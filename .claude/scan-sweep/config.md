# scan-sweep — project overlay (politicas)

Runs on the skill defaults; this file exists for the improvement log below.

## Skill improvement log

- 2026-09-01 — `moonshot-architect` is an operator-named ad-hoc lens (absent from
  `references/lenses.md`). Run as a 10-scout per-group fan-out (develop, L+ only);
  snapshot scope `moonshot:all-groups`, `lens_keys: []` so it never counts as coverage.
  The durable deck is `docs/architect/moonshot-2026-09-01.md`; the outbox holds only
  the top 29 bodies. Re-running the lens must read that doc first and not re-propose
  its 47 titles.
- 2026-09-01 — analysis-quality, first sweep (23 lenses, 6 S built, 1 contract
  finding to `docs/architect/backlog.md`). Two repo facts every round needs:
  (1) commit with `git commit --only <paths>` — a concurrent session's staged
  files otherwise ride along (memory: shared-index-needs-commit-only); (2) the
  commit-msg hook `doc-sync` owes a `Doc-sync(<doc>): <reason>` trailer for every
  coupled doc not touched — `lib/analysis/**` is coupled to `AGENTS.md` and
  `docs/hybrid-benchmark-plan.md`, so every commit there needs both trailers.
  (3) The outbox's 30-finding cap was full after the moonshot round; check the
  count BEFORE the round and route overflow to the architect backlog.
