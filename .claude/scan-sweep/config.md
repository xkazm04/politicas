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
- 2026-09-05 — budget-mirror, first sweep (28 lenses, 2 S built, 2 cards). (1) The outbox
  is at its 200-line cap and holds 30 findings: this round emitted NOTHING there; coverage
  lives only in the snapshot until the app drains the file. (2) Czech test titles use the
  „ … “ pair (U+201E/U+201C); an ASCII `"` as the closing quote terminates the string and
  esbuild reports it as a leading-zero decimal error at the next number. (3) `features/budget/**`
  owes four dismissal trailers per commit: README.md, AGENTS.md, docs/ROADMAP.md,
  docs/data-analysis/budget-sources.md (+ docs/DESIGN.md for BudgetMirrorPage.tsx).
- 2026-09-05 — civic-chronicle, first sweep (28 lenses, 4 S built, 0 cards). The two
  real defects were both PAIRS across the two journals (raw vs canonical IČO in
  registry links; a placeholder key that one side emits and the other side's
  `isEntityKey` refuses) — on a context this mature, grep the shared symbol
  (`canonicalIco`, `isEntityKey`) across both features first. Source-grep a11y tests
  (features/*/a11y.test.ts) are the accepted instrument here; jsdom is absent on purpose.
  Gate note: a second load-sensitive timeout this session — `lib/db/pglite/premigration.test.ts`
  „restores…“ hit its 60 s budget inside a full `npm run check` (5,4 s alone). Same recipe:
  rerun the file alone, then run every stage `check` skipped.
- 2026-09-05 — civic-feeds-verification, first sweep (28 lenses, 3 S built). Route handlers
  ARE unit-testable here: `vi.mock("next/headers")` + `vi.mock("./get<Loader>")` and
  `await import("@/app/<route>/route")` (the `server-only` alias in vitest.config.ts makes
  the import legal). Two suites now exist as templates: features/dukazy/feedRoutes.test.ts,
  features/schranka/feedRoutes.test.ts. A mocked `SchrankaDeltas.coverage` needs all six
  NovinkyCoverage flags (dukazy, recompute too) or tsc goes red on the test file.
- 2026-09-05 — civic-kg-primitives, first sweep (28 lenses, 3 S built, 1 card). `lib/**`
  may not import `features/**`; when a lib helper must agree with a features helper
  (canonical IČO), write the lib copy and pin the two together in the lib TEST, which
  MAY import features. A whole-tree `tsc` + two vitest runs + eslint in one chain exceeds
  the 300 s foreground budget — run multi-step build chains with run_in_background.
- 2026-09-05 — civic-transparency-eslint-plugin, first sweep (28 lenses, 4 built). The
  plugin's gate is `node packages/eslint-plugin-civic-transparency/__tests__/run-all.mjs`
  (seconds) + eslint on the touched .cjs/.mjs; tsc does not cover the package, so a chain
  of four fixes fits one background call. `packages/**` is coupled to no doc in the map —
  the rule's own `docs/rules/<rule>.md` is the record and must move with the matcher.
  Three opt-out matchers (`citation-ok`, `reduced-motion-ok`, `raw-format-ok`) are one
  rule in three copies: grep all three whenever one changes.
- 2026-09-05 — civicscore-leaderboard, first sweep (28 lenses, 2 S built). A commit that
  threads a new prop through "every badge" (9853059) is a pair-hunt target by itself: grep
  the badge's opening tag across ALL surfaces that render it and diff the attribute lists —
  here 6 of 12 sites were missed, on the duel and on the one surface that gets PRINTED.
  `features/civicscore/**` owes seven dismissal trailers (README, CLAUDE, AGENTS, ROADMAP,
  DESIGN, routes/metodika.md, routes/poslanec.md) when zebricek.md is the record touched.
- 2026-09-05 — civicscore-lens-duel, first sweep (28 lenses, 2 S built). A module that
  "mirrors" another (lens.ts mirrors the loader's sort / median / histogram) is a standing
  pair: every later fix to the original is a candidate finding here — diff the two rule
  sets, not the code. When the original is `server-only` and the mirror is client code,
  the parity instrument is a TEST that imports both (the vitest alias allows it).
- 2026-09-06 — claim-verifier, first sweep (28 lenses, 6 S built). `?? 0` on a nullable count
  that reaches a sentence is a missing-is-not-zero defect every time - grep `?? 0` in every
  page and follow the type to where null is produced. A `slice(0, N)` with no sentence
  after it is a silent truncation; a hash/algorithm NAME printed as a literal beside a value
  computed elsewhere is a parity pair. A test title containing `#1234` trips the colour lint.
- 2026-09-06 — contribution-scoring, first sweep (28 lenses, 2 S built, 3 cards). A pure-lib
  context whose defects are contracts its CONSUMERS inherit (a `?? 0` on a nullable prior
  count is printed by a component in another context) cannot be fixed in-context under
  veto 1 - route the type change as a contract card, name the consumer file, and build
  only what the module can prove alone (a completeness test, a validator).
- 2026-09-06 — czech-civic-data-parsing, first sweep (28 lenses, 4 S built). A codec that
  range-checks a date (1-12, 1-31) is the same defect as one that shape-checks it; and a
  container reader that skips the checksum its container carries contradicts its own
  "reject loudly" header. Stage discipline: when two findings edit the same file, commit
  the first BEFORE applying the second - `--only <file>` stages the whole file.
