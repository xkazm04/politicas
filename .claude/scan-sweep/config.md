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
- 2026-09-05 — app-config, first sweep (28 lenses, 1 S built, 5 cards to backlog.md;
  outbox finding cap still full). Two facts for the next round: (1) under a full
  `npm run check` the unit lane can time out `lib/testing/archivedScripts.test.ts`
  at its 5 s budget (6,3 s measured; 1,9 s alone) — rerun the file alone before
  calling the gate red, and still run the stages `check` skipped. (2) `next.config.ts`
  imported under tsx is double-wrapped (`.default.default`) before `headers()` is
  reachable — the header contract test in the backlog needs that unwrap.
- 2026-09-05 — app-shell, first sweep (28 lenses, 3 S built). (1) `git commit --only <path>`
  REFUSES an untracked path ("pathspec did not match") — `git add` the new file first,
  and never pipe the commit through `grep`: the refusal scrolled away and `git log -1`
  showed a concurrent session's commit instead. (2) Next file conventions (error.tsx)
  export no prop types; a minor upgrade (16.2 -> 16.3, `unstable_retry` -> `retry`) broke
  both boundaries with tsc green. Check every convention file against
  `node_modules/next/dist/docs/.../03-file-conventions/` whenever the Next version moves.
