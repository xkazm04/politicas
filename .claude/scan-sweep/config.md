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
- 2026-09-06 — dashboard-instruments, first sweep (28 lenses, 3 S built). Two pages in one
  context are a standing pair: a rule one of them adopted with a dated record (velín 2026-08-12,
  `hidden sm:block`; exhibit `f.int(pass)`) is a finding wherever the sibling still lacks it -
  grep the sibling for the exact string the record names.
- 2026-09-06 — dashboard-state-graph, first sweep (28 lenses, 3 S built). Commit split trap:
  a source-grep test file shared by several findings must be committed with EVERY helper it
  declares in use - a truncated version can fail the pre-commit lint (unused helper) and the
  next commit then carries the test ahead of its fix. Truncate by removing helpers too, or
  commit the shared test with the last finding.
- 2026-09-06 — db-hybrid-benchmarks, first sweep (28 lenses, 2 S built). A benchmark harness
  that also WRITES product data (materialize-tags → vote_tag) is an ingest path and gets the
  ingest doctrine: a parse fallback that invents a default label is a fabrication, not
  resilience. Scripts with a top-level main() get the kg-promote isDirectRun guard before a
  test imports them. A 'second implementation' finding needs its figure - the NFD folder
  differed from asciiFold on 0 of 400 names and was rejected, not built.
- 2026-09-06 — db-repositories, first sweep (28 lenses, 3 S built). A read that picks ONE row per
  key with no ORDER BY is a defect even when today's plan returns the right row - write the
  test, and when it does not go red say so in the commit rather than claiming a reproduction.
  A new PGlite-booting test must be registered in lib/testing/lanes.ts (PGLITE_LANE_FILES) -
  the lane list is explicit and lane-partition.test.ts enforces it.
- 2026-09-06 — db-store, first sweep (28 lenses, 1 docs fix). A context whose invariants are
  already pinned by ~120 tests yields comments, not code: grep its headers for counts and
  writer names and diff them against the declarations they describe. A comment inside
  CORE_DDL changes the schema snapshot - regenerate with `npm run db:snapshot` in the
  same commit or CI's drift check goes red.
- 2026-09-06 — effort-case-loop, first sweep (28 lenses, 4 S built). Case-loop scripts are where
  lib vocabularies get re-typed: grep every `new Set(["` and every `"a" | "b"` union in
  scripts/ against lib/analysis exports. A date literal that was a run date is a defect on
  the second run - make it `--reference=` with today as default and let the payload record it.
  Evidence scripts from a finished batch (divergence-retune) are left with their literals.
- 2026-09-06 — eslint-rules-shims, first sweep (28 lenses, 0 built, 3 cards). A shim-only context
  has no defects of its own; its findings live in the test that guards it. A guard that SKIPs on
  MODULE_NOT_FOUND without first checking the directory exists cannot tell 'no shims' from
  'one shim missing' - grep every try/catch SKIP in a test runner for what it actually tests.
- 2026-09-06 — graph-admin-data-routes, first sweep (28 lenses, 1 S built over 5 files). A rule a
  sibling route family adopted (feeds: 503 => no-store) is a finding on every other machine
  route until one test names them all; when the routes span contexts, the test belongs in
  lib/testing next to the other repo-wide guards, and the commit says so.
- 2026-09-06 — graph-explorer, first sweep (28 lenses, 9 built over 14 files, 1 prior card withdrawn).
  A catalog (messages/*.json) is a hand-maintained list: test it against the enum it labels,
  never against itself - `graph.kinds`/`graph.rels` were 9 labels behind KG_NODE_KINDS/KG_EDGE_RELS.
  A card written from another context's vantage must be re-read from inside the context before
  it is built: the round-20 'cesta cannot report rejected' card died on trailPath.ts:185.
  Tooling: a Czech „…" quote inside a JS double-quoted test title ends the string (twice this
  round) - use ‚…‘ in titles; node:fs globSync returns backslashes on Windows - normalise.
- 2026-09-06 — ingest-external-sources, first sweep (28 lenses, 6 S built over 4 adapters). In an
  adapter folder the pairs are: one retry doctrine vs N loops (grep `res.ok`/`status ===` per
  file), one fold rule vs the stem lists it is applied to (assert asciiFold(stem) === stem), and
  two decoders of one grammar (feed both the same string). A resume/retry branch that `break`s
  out of its loop is worth one temp-dir test - the post-loop code decides what the break meant.
- 2026-09-06 — ingest-psp-sources, first sweep (28 lenses, 3 built: 1 instrument + 1 dedupe + 1 key
  fix). A context whose primary file has 0 tests while its siblings have dozens: build the fixture
  first (an in-memory stored zip is 30 lines) - the round's other findings then have somewhere to
  land. A 'mirror of X' comment is a pair claim: diff the two builders (here firma:<ico> raw vs
  canonical) before trusting it. Fixture bytes for windows-1250: only á é í ó ú ý survive latin1.
  lib/ingest/sources/ is a REGISTRY directory (atlas.test.ts derives the adapter list from it):
  a helper file there fails the FULL gate, not the unit run - the gate runs before the ledgers.
- 2026-09-06 — round-23 close-out lesson: the ledgers commit 1e6f2ae said 'exit 0' while the pglite
  lane was red (changes.test.ts still asserted the raw firma key 005767e canonicalised). The grep
  matched the presence of CHECK_EXIT, not '=0' - always grep 'CHECK_EXIT=0' and read the Test Files
  lines of BOTH lanes before writing 'exit 0'. A contract fix owes every consumer test its new value.
- 2026-09-06 — kg-analysis, first sweep (28 lenses, 4 built in 3 commits). Three 'contract' modules
  that mirror each other (verdict/kg-verdict/law-verdict) share prologue code by copy: grep the
  first exported helper of one in the other two. A module's own doctrine comment ('never zero-
  faked', 'three states') is a checklist for the module - two of four findings were the doctrine
  unapplied to one more field in the same file.
- 2026-09-06 — kg-pipeline, first sweep (28 lenses, 7 built). A scripts folder is where the same
  20 lines get pasted per script: grep `^async function <name>` and `const <name> = (` across the
  folder before reading any one file. A sibling's header that says 'a re-run of X would erase Y'
  is a finding on X. A frozen literal where 8 siblings derive a value (pass, cap) is a pair.
  Files a context map does not own (kg-vote-bill-ingest, the provenance test/backfill) are
  named in the round, never edited - veto 1 covers 'nobody's' files too.
- 2026-09-06 — landing-page, first sweep (28 lenses, 6 built in 5 commits). A UI context's pairs
  are comments: 'týž vzorec jako X', 'drž v sync s Y', 'týž seznam jako Z' each named a second
  copy of one rule held by prose - grep the context for `sync`, `týž`, `same list` before any
  lens. A write path's OWN doctrine (aggregate rule 1: sum 0 is no vote) is a checklist for its
  door: the action accepted what the aggregate skipped. Server actions need the same three
  states as loaders (ok / refused / unavailable) and the client needs a catch for the fourth.
- 2026-09-07 — law-amends-analysis, first sweep (28 lenses, 6 built in 4 commits). A case-loop folder
  with an archive/ is read live-files-in-full, archive-by-header: the archive is history and is
  never edited, but its headers say what the live copy lacks ('kept unchanged for history' on
  the LIVE file means archive/ holds the newer method - that is a card). A script that writes a
  cache under its final name while streaming is the dataor .part class again - grep
  `createWriteStream(` next to `existsSync(` before reading the script. When appending one doc
  paragraph per atomic commit, base the rewrite on the round's START commit, not HEAD.
- 2026-09-07 — law-collision-analysis, first sweep (28 lenses, 5 built in 4 commits, 0 cards). A
  regex module that documents its own hand-validated cases is a test waiting to be written - run
  the documented cases through it FIRST (a tsx probe), because one of them may already be red
  (the `az` range was). A keyword net under /i needs `\b` on BOTH sides of a short token; probe
  the real corpus for the false-positive count before building so the card carries a figure.
  When a source test spans two commits, commit the describe with the change it pins - an
  intermediate commit here carried one red describe for one commit.
- 2026-09-07 — law-triage-batch, first sweep (28 lenses, 5 built in 3 commits, 1 card). A gate that
  exists in three places (what the worker is told, what the pre-write gate checks, what the
  write-time gate accepts) is three definitions until one module is imported by at least the
  first two - diff the id-kind lists, they will differ. A 'bootstrap' script that writes a file
  every later script merge-writes is a durability hazard: grep `writeFileSync(` on ledgers and
  ask what refuses. A recorded formula string is copy - compare it to the code it describes.
- 2026-09-07 — lawwatch, first sweep (28 lenses, 5 built in 2 commits, 1 card). A loader that keys
  a per-row attribute (batch, source, date) by an id that the loader's OWN comment says is not
  unique is a defect waiting for a probe: count the duplicates in the real payloads before
  reading the rendering code. Two comments that say 'shodně s X' / 'same as X' in one file are
  two parity tests. When the context map lists 22 of a folder's 34 files, read the unmapped ones
  as pair partners - the types and the wire live there.
- 2026-09-07 — money-analysis-triage, first sweep (28 lenses, 6 built in 4 commits, 2 cards). A
  literal `limit:` in a script is measured against the corpus the docs record (batch notes carry
  the row counts) - 100_000 under 152 702 is a defect, not a style point. A file whose header
  says 'copies replaced by imports on <date>' still has copies: grep the shared module's export
  list against the file. An always-empty field in a published payload (`.slice(0, 0)`) is copy
  that lies by shape. Never name an archive/ path in a live file's prose - the quarantine test
  (lib/testing/archivedScripts.test.ts) reads comments too; it cost one red gate this round.
