# Active runs — politicas

One entry per live session in this checkout. Move to "Recently completed" at wrap.

## Live

(none)

## Recently completed

- **golden-path coverage fix-set (Phase-D writer)** — COMPLETE + PUSHED
  2026-08-18. 5 commits `26d695a` (sort-missing-id-tiebreaker ×13),
  `4105424` (catch-reaches-no-door: getAdminData ×6), `c210d19`
  (error-response-missing-no-store: schranka 503 ×3), `b6ef334`
  (silent-retry-no-log: dataor), `98c65ec` (graph-explorer trio:
  EXCLUDED_RELS authority + permalinkSources reuse + combobox
  aria-activedescendant). tsc 0, eslint 0 on touched files, full Vitest
  2915/2915, pre-push green. No CLASS-1 site skipped (all had a stable id).
  Deploy session's dirty files (docs/deploy/vercel.md, next.config.ts) left
  untouched.

- **resolve pass batch 4 (Landing & Navigation + Civic Feed & Transparency +
  Voting & Legislation)** — COMPLETE 2026-08-17, resolve agent, one working tree
  (only resolve agent; completes politicas' 48 contexts). Scanned all 13
  contexts / ~227 non-test source files via 3 read-only subagents (one per
  group), verifying each candidate by hand against the 4 FIX lenses. **1 fix
  shipped** (`9474883`, votetrack-ledger): Mock ChamberDetail/DisciplineBoard
  rendered club names via `name.split(" ")[0]` → „ANO"/„TOP" instead of
  „ANO 2011"/„TOP 09" — the exact truncation clubStyle.ts documents as defect
  83cb8a9 (fixed on Real surfaces, missed on the illustrative fallback). tsc 0 +
  scoped eslint 0. **Deferred (dead-code / intentional / cleanup):**
  entityLinks.companyCaseFileHref (dead but test-locked), publicWire
  PUBLIC_MONEY_KEYS (test anchor), feedIndex.feedAddressCount (dead wrapper,
  test-locked), schranka novinky.json `od` default asymmetry (intentional; raw
  endpoint = "everything from threshold", in-app clients always pass `od`),
  deriveRadar RadarDay.flags dead branch (flags always 0 by design — no wrong
  output). No other correctness/error-handling/type bug found; the three
  field-report shards independently found 0 violations repo-wide. Deploy
  session's dirty files (docs/deploy/vercel.md, next.config.ts) untouched.

- **resolve pass batch 3 (Financial Transparency + MP Profiles & Rankings +
  Shared UI Primitives)** — COMPLETE 2026-08-17, Fable resolve agent, one working
  tree (only resolve agent in this checkout). Scanned all 13 contexts / 217
  non-test source files via 3 read-only subagents (one per group), each verifying
  candidates by hand against the 4 FIX lenses (correctness / swallowed-error /
  dead-code / type-hole). **0 fixes — every context clean.** HEAD stays
  `7817e4c`; nothing committed, nothing to push (master already == origin).
  Honored field-report held-as-trades (metric-tile null-affordance, long-list
  caps, scoring sub-scores→0). Notable dismissals (all verified NOT bugs):
  public-body.ts:213 clenoveOrganu shape (correct per ARES VR), amountBasis.ts:179
  noVatBasis (intentional headline+breakdown), getLeaderboardData histogram
  hi-bound (strict-above-max by design), COMPONENT_FILL Record<string> (can't
  tighten — referendum/og indexes with plain string), lib/kg glyph/sourceLinks
  switches (KG_NODE_KINDS == KgNodeKind, exhaustive). Test-seam exports
  (resetSuppliesMemo etc.) live by design. One deferred-as-noise observation:
  lib/civic/votes.ts:45,56 unguarded byParty deref — unreachable (mock-only,
  data invariant holds all 7 party codes), below the fix bar. Deploy session's
  dirty files (docs/deploy/vercel.md, next.config.ts) untouched.

- **resolve pass batch 1 (Data Ingestion + Data Layer)** — COMPLETE 2026-08-17,
  Fable resolve agent, one working tree (no siblings observed). Scanned all 12
  contexts / 219 files via 6 read-only subagents, verified each finding by hand.
  **4 fixes shipped** (`68a906e → 7817e4c`, PUSHED; pre-push green: 206 files /
  2915 tests, tsc 0): kg-pipeline `c5026cc` (promote-verdicts: dead `rejected`
  tracker + missing dry-run store.close), effort-case-loop `b5751ed` (zero-pad
  batch paths for batch>=10), ingest-psp-sources `7314076` (3 dead exported
  column consts), money-analysis-triage `7817e4c` (dead OSVC-purge no-op).
  Data Layer (db-store/db-repositories) verified **clean** — exemplary, 0 fixes.
  **Deferred (behaviour/judgment):** changes.ts throw-in-map (fail-loud vs
  resilient), volby.ts unmatchable banker stems (classifier output),
  smlouvy-dump.ts hex-entity gap, collision-check-005/008 default-run clobbers a
  reference artifact, `_apply-missing-law-nodes-copy.ts` delete (repo keeps
  numbered batch history), 2 effort live-write-guard gaps, reachable-metric
  slice(0,0), triage stale formula label. Deploy session's `docs/deploy/vercel.md`
  + `next.config.ts` left untouched.

- **/perfect round 18 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-13,
  ONE Director session, **no builder deaths, no wave left in flight, no
  DECISION NEEDED**. Phase 0 reconciliation PROVED rather than cited: map
  provenance `personas-context-scan` v2, `project.root` = this checkout, 48
  contexts / 10 groups, unchanged since `b43e7ac`; the local app DB's
  `dev_contexts` was copied and read read-only and diffs **empty in both
  directions** against the map's 48 names. Vault: 44 notes claim all 48 map
  contexts (0 unclaimed, 0 orphans). Cursor spent entirely on NEVER-PROPOSED
  contexts — civic-kg-primitives, ingest-external-sources, ingest-psp-sources,
  kg-pipeline, observability — and **all five shipped their first direction**
  (ever-shipped count 22 → 27 of 48). 6/6 directions shipped + 2 rider sets + 7
  Director-inline, master `3119ef0 → 8c25d35` (ff-only, 18 commits; gate green
  on branch AND master: **206 test files / 2 915 tests**, lint 0 errors (12
  pre-existing warnings in three untouched files), 8 plugin rule suites,
  `next build --webpack` exit 0), **PUSHED to origin**. Commits: c453605,
  dcf31ac, 7732a86, a8ad5d1, eab0354, 44c4f07, a615ea0, 73a866f, 69124ae,
  6a30205, abb709f, 0d89056, 5707bd4, afa9778, 4f62ca4, 37271a4, c5c838b,
  8c25d35. Coverage stays 48/48. Deploy session's dirty files
  (`docs/deploy/vercel.md`, `next.config.ts`) untouched. Wave branch deleted.
  **Headline: every CZK total the product publishes about a named MP or firm
  silently mixed two tax bases the contract register itself calls not summable**
  (82 918 bezDph vs 36 580 vcetneDph), while `amountBasis` — the field that says
  which — sat on every `supplies` edge with zero readers. Runner-up: **the
  vault's own `frontier.md` F5, status `open`, instructed an operator to run a
  command that erases the effort layer from all 207 MPs** and, with `--reset`,
  deletes ~154 k nodes / ~178 k edges; a second copy of that instruction sat in
  `.claude/skills/knowledge-graph/SKILL.md`. Also: `/graf` memoised a null index
  for the whole process lifetime (an empty graph reading as a real empty graph)
  with the lint rule for that class switched off for the folder and a test
  pinning the gap as the contract; ~153 k contract nodes cited a query about
  their supplier while carrying their own canonical registry URL; the ownership
  block's „100 %" was a regex on the word „jediný"; and `vote_event.quorum`
  finally let /hlasovani say that **32 roll calls needed 101 or 120 votes**
  rather than a simple majority.
  **Handoffs (both still open, neither this session's to fix):**
  `docs/deploy/vercel.md:41` lists a stale `contract 1 500` floor — commit
  `2146121` raised it to 100 000; root `DESIGN.md:158` carries a false Fraunces
  sentence and is a generated mirror needing `/impeccable document`.
  **New handoff:** `features/graph/getPermalinkData.ts` still lacks
  `import "server-only"`, and the two `row.kind as KgNodeKind` casts in
  `graphLoader.ts` still want `asUnion` — left open deliberately because it
  changes what a malformed row does (a behaviour ruling, not a tidy-up);
  recorded in `memory/architect-graph-deferrals.md`.

- **/perfect round 17 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-13,
  ONE Director session, no builder deaths, nothing left in flight. Phase 0
  reconciliation done (map provenance verified: `personas-context-scan` v2,
  `project.root` = this checkout, 48 contexts, unchanged since `b43e7ac`;
  **48/48 claimed**, 0 missing, 0 orphans). Cursor spent entirely on
  NEVER-PROPOSED contexts — all five scouted (testing-sentinel,
  graph-admin-data-routes, app-shell, kg-analysis, analysis-quality) produced
  shipped work. 6/6 directions shipped + 1 Director-inline + catalog + doc-sync,
  master `b2c4461 → 3119ef0` (ff-only, gate green on branch AND master:
  **204 test files / 2 823 tests**, lint 0 errors (12 pre-existing warnings in
  three files the wave never touched), 8 plugin rule suites, production build
  exit 0), **PUSHED to origin**. Commits: 821a107, cc16ee8, 8cc7e65, e7bea5c,
  6f844c9, 52f0f4a, 8f5ea00, c14e32b, 3119ef0. Coverage stays 48/48 (the sweep
  closed at round 10); 22 of 48 contexts have now shipped at least one
  direction. Deploy session's dirty files (`docs/deploy/vercel.md`,
  `next.config.ts`) untouched. Wave branch deleted.
  **Headline: all 211 money ties told readers their class was „written by an
  analysis pass OR A HUMAN REVIEW, not guessed"** — both halves false for the
  whole corpus, proved from the write path (`setTieReviewState` cannot touch
  `tie_class`; 245 of ~260 classes came from the same `classifyTie` the read
  path calls a guess), and that drift is why two named municipal water utilities
  carry `manager` and have their public contract volume hung on named MPs. Also:
  the sentinel could not tell *checked* from *never looked* and scored a WIPED
  audit chain greener than a tampered one; the repo had **no 404 page at all**;
  both error boundaries claimed a crash report had been sent with no DSN
  configured; the rail shipped invented Czech people and invented IČOs to every
  reader on every route; Fraunces was preloaded everywhere (47 % of the font
  budget) and rendered by nothing; the graph citation card never read
  `view.fresh`; and the impossible-date bound was forked four ways, letting
  `/rozpocty` publish a contract history running to **2043**.
  **Handoff (unchanged from round 16, still open):** `docs/deploy/vercel.md:41`
  lists a stale `contract 1 500` floor — commit `2146121` raised it to 100 000.
  Left untouched because the file is the deploy session's.
  **New handoff:** root `DESIGN.md:158` now carries a false sentence about
  Fraunces; it is a generated mirror that forbids hand-editing and needs
  `/impeccable document` to regenerate (`docs/DESIGN.md`, its stated authority,
  IS correct).

- **/perfect round 16 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-13,
  ONE Director session. It first landed the round-15 wave left in flight
  (three dead builders wip-snapshotted, three finishers re-briefed, all six
  diffs reviewed, master `2fd5ec0 → c0529d0`, pushed), then ran a full round.
  6/6 directions shipped + 2 Director-inline, master `c0529d0 → b2c4461`
  (ff-only, gate green on branch AND master: **201 test files / 2 752 tests**,
  lint 0 errors (12 pre-existing warnings, none in touched files), 8 plugin
  rule suites, production build exit 0), **PUSHED to origin**. Commits:
  774dcf6, b3aa8cb, 2146121, 4c37087, 710241b, 721961e, 5dcfd3b, 760fed2,
  798318d, b2c4461. Coverage stays 48/48; what moved is its quality — five
  contexts that had a round-10 sweep verdict but had never produced a
  direction now have shipped work (data-releases ×2, atlas ×2, dukazy ×2,
  shell-navigation, shared-primitives). Deploy session's dirty files
  (docs/deploy/vercel.md, next.config.ts) untouched. Wave branch deleted.
  **Handoff to the deploy session:** `docs/deploy/vercel.md:41` lists the
  cardinality floors including `contract 1 500`; commit `2146121` raised that
  floor to **100 000**, so that parenthetical is now stale. Left untouched
  because the file is yours.

- **/perfect round 15 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-13,
  TWO Director sessions (the first gated 6/6, briefed 3 builders on one branch,
  landed 3 directions and then died mid-build; the second wip-snapshotted the
  three dead builders' work, re-briefed three finishers, reviewed all six diffs,
  ran the gates and landed). 6/6 directions shipped + 1 Director-inline test fix,
  master `2fd5ec0 → c0529d0` (ff-only, gate green on branch AND master:
  **194 files / 2 633 tests**, lint 0 errors (12 pre-existing warnings, none in
  touched files), 8 plugin suites, production build exit 0 / 60 routes),
  **PUSHED to origin**. Commits: 3073832, 968a42b, 919cbcb, 7f5def0, b70b97a,
  ee1bd5f, d3e43da, 44c0801, c0529d0. Coverage stays 48/48. Deploy session's
  dirty files untouched. Wave branch deleted.

- **/perfect round 14 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-12,
  TWO Director sessions (the first gated 6/6, briefed 3 builders on one branch
  and landed all 8 commits incl. the combined catalog delta and doc-sync, then
  died before the integration gate; the second reviewed the un-reviewed lot C,
  ran the gates and landed). 6/6 directions shipped, master `5177cb1 → 2fd5ec0`
  (ff-only, gate green on branch AND master: **189 files / 2 518 tests**, lint
  0 errors (15 pre-existing warnings, none in touched files), 8 plugin suites,
  production build exit 0 / 60 routes), **PUSHED to origin**. Commits: af527ea,
  63241e8, 344fc5f, 7c9bd7e, 0ead37c, 3093230, 3952e0d, 2fd5ec0. Coverage stays
  48/48. Deploy session's dirty files untouched. Wave branch deleted.

- **/perfect round 13 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-12,
  TWO Director sessions (the first gated 6/6, briefed 3 builders, committed
  all 6 directions + catalog + doc-sync, then died before the integration
  gate; the second reviewed all 9 diffs, ran the gates and landed). 6/6
  directions shipped, master `b53a70f → 5177cb1` (ff-only, gate green on
  branch AND master: **186 files / 2 400 tests**, lint 0 errors (15
  pre-existing warnings in untouched files), 8 plugin suites, build exit 0),
  **PUSHED to origin**. Commits: 79d151a, 8a703cd, 0686c51, 4dd8d74, 7984b15,
  d004a43, 8038a6d, 4ca88b3, 5177cb1. Coverage stays 48/48 (Phase 0
  reconciliation by the first session: 0 missing, 0 orphans, map unchanged
  since b43e7ac). Store stayed held by the concurrent dev server :3411 the
  whole round — no direct .pglite access, as planned. Deploy session's dirty
  files untouched. Wave branch deleted.

- **/perfect round 12 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-12,
  TWO Director sessions (the first died mid-build after landing 3 direction
  commits; the second resumed from vault+git, reviewed everything and landed
  the wave). 6/6 directions shipped + 3 Director-inline fixes, master
  `e6472bb → b53a70f` (ff-only, gate green on branch AND master: **183 files /
  2 325 tests**, lint 0 errors, 8 plugin suites, build exit 0), **PUSHED to
  origin**. Commits: 617e509, 98c9f3c, 04a955f, 5ca4c06, 79dcb34, f01ca85,
  343ead2, 555cd1a, b53a70f. Coverage stays 48/48 (reconciliation re-verified:
  0 missing, 0 orphans). Catalog protocol amended for the resumed wave:
  builders edited messages/*.json in-tree only, Director committed the delta
  once at quiescence. Dead `lawwatch.dependency.*` namespace deleted (11 keys,
  false provenance claim). Deploy session's dirty files untouched.

- **/perfect round 11 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-12.
  Post-sweep opportunity round over the recorded deferral return paths: 6/6
  directions shipped + 2 Director-inline fixes + 1 memory entry, master
  `f0a42e2 → e6472bb` (ff-only, gate green on branch AND master: 177 files /
  2 182 tests, lint 0 errors, 8 plugin rule suites, build exit 0), **PUSHED
  to origin**. Commits: 92e9065, a01cfb3, d54c71c, 1adf463, b747ff2, d75adc6,
  c1dcbb1, 83cb8a9, 724297b, 2edf301, e6472bb. Coverage stays 48/48
  (reconciliation re-verified: 0 uncovered, 0 orphans). Rejected: kompas-og
  (2nd time, share affordance unreachable at vote_tag=0), sector chip
  (premise broken). ⚠ Mid-round „store corruption" was a FALSE ALARM: a
  concurrent `next dev -p 3411` holds the single-connection ./.pglite since
  14:12 and serves real pass-42 data — held ≠ corrupt, NO restore performed,
  lesson in memory/held-store-mimics-corruption.md. Deploy session's files
  untouched; the dev server left running (not this session's).

- **/perfect round 10 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-12.
  The coverage-sweep round: map↔vault reconciliation (48 contexts, provenance
  verified, 30 new notes, 14 aliased), **coverage 18/48 → 48/48**. 6/6
  directions shipped + 4 Director-inline fixes, landed on master
  `b408538 → f0a42e2` (ff-only, gate green: 171 files / 2 062 tests, lint 0
  errors, plugin rule suites gating for the first time, build exit 0) and
  **PUSHED to origin**. Commits: f1bdd25, 6799ad4, 7e0d18d, eaf65f0, 4c49ab7,
  511adbe, d20a0fa, f85d85e, c80ea51, 9f35ec5, 045f18c, f0a42e2. Two Director
  sessions (first died mid-build; second resumed losslessly), two recovered
  git incidents (orphaned catalog hunks after an amend; a bare --amend
  sweeping a sibling's staged files — both documented in the vault). Deploy
  session's files untouched.

- **/perfect round 9 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-11.
  6/6 directions shipped, landed on master `1810a76 → b408538` (ff-only, gate
  green: 1 959 tests / 164 files, lint 0 errors, CI-mode build exit 0).
  Commits: e8b6b0f, 1726012, 1cd4cc8, 543d182, de71dec, 4b997b0, 19a5758,
  f9f4cf8, b408538. First Director session died mid-scout (zero loss); this
  session re-scouted, self-gated at cap 6, built with 3 concurrent builders on
  one branch, reviewed every diff, landed. Master has 30 unpushed commits —
  push left to the operator. Deploy session's files untouched. Finding:
  `vote_tag` = 0 rows on the live store — /kompas silver layer never populated
  (batch job, backlogged in the vault).

- **/perfect round 8 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-11.
  6/6 directions shipped, landed on master `96d2f14 → 3ff8fc9` (ff-only, gate
  green: 1 901 tests / 159 files, lint 0 errors). Commits: 90ee105, f4d0a3a,
  323925e, fff12da, 61f5af3, e53e5fa, 5c79fe3, 682d5ec, 2adf4c7, 3ff8fc9
  (doc-sync). Wave branch deleted. Master has 20 unpushed commits — push left
  to the operator. Deploy session's files untouched. Also: killed six zombie
  tsx store-holders from a dead 2026-08-05 session before the live probe.

- **/perfect round 7 (autonomous, Athena-dispatched)** — COMPLETE 2026-08-10.
  6/6 directions shipped, landed on master `375845b → b05554f` (ff-only, gate
  green: 1 850 tests / 156 files). Commits: 536ac5c, 6b9c5b3, c46682b, 4fb4488,
  d52e335, 441aaf9, 1e46ef9, 553111c, b05554f, 96d2f14 (memory). Wave branch
  deleted. Master has 10 unpushed commits — push left to the operator. Deploy
  session's files untouched.

- /perfect rounds 1–6 (2026-07-28 → 2026-08-04) — 54 directions shipped; see
  vault `personas/politicas/Perfect/Perfect.md`.
- law-loop batches 019–021 (2026-08-05/06) — corpus closed 141/141, pass 55;
  commits a514ddf, ab7a9de, 8b39a0f, 375845b.
