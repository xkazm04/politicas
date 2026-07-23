# Politicas — Roadmap Status

Snapshot of where the build stands against the design doc
(`C:\Users\kazda\kiro\opendata\docs\politicas.md`, §9 roadmap), written at the
close of the founding build session (2026-07-22). Future sessions: read this
first, then `CLAUDE.md` (conventions + route map) and `docs/DESIGN.md`
(visual system).

## Done — Phases 1–3 on sample data

All five modules of the grouped platform have live, interconnected surfaces.
Everything is Czech-first, evidence-cited (every number carries its source),
and runs on a **deterministic, test-pinned sample-data layer** — no live
ingestion yet.

| Route | Surface | Notes |
|---|---|---|
| `/` | Landing (Konstrukt) | winner of 3-variant prototype round; hemicycle, live re-weightable score, standings |
| `/dashboard` | Velín | chamber aggregates (computed, test-pinned), leaderboard → spisy, graph-event feed, module tiles |
| `/zebricek` | CivicScore | full 200-MP leaderboard (deterministic generator, anchors at 1/2/3/74/193), histogram, Souboj head-to-head |
| `/poslanec/[id]` | Spis (Person profile) | "the real product" — pillars, votes with rebel markers, sourced money ties, SSG over sample MPs |
| `/hlasovani` | VoteTrack | fusion of 3 prototype variants: ledger (master) + chamber hemicycle (detail) + discipline board/matrix/rebellions |
| `/penize` | FollowTheMoney | entity-trail graph (ported from archived Rentgen), kniha vazeb with verified/pending states, IČO-join methodology |
| `/rozpocty` | BudgetMirror | town vs computed peer median, debt trends, peer table; stewardship = executive roles only |
| `/zakony` | LawWatch | paragraph diffs → linked roll-call votes (closes vote→impact loop), bill pipeline incl. rejected state |
| `/rentgen` | archived art direction | living reference for investigative sub-surfaces; hexes allowed there |

### Decisions taken (do not relitigate casually)

- **Visual philosophy: Konstrukt** (Sutnar functionalist poster) won over
  Broadsheet (fused into survivors) and Rentgen (archived). Tokens in
  `app/globals.css`; page grammar in `docs/DESIGN.md` §5.
- **Prototype workflow** (`.claude/skills/prototype/skill.md`) is how new
  pillar surfaces get designed: directional variants behind a dock →
  prune/fuse → consolidate. Used for landing (3), dashboard (2), VoteTrack (3,
  fused all three).
- **Quality baseline** ported from personas: feature modules + lint-enforced
  shared-catalog boundary, 4 custom ESLint rules (token discipline,
  silent-catch, a11y keydown, reduced motion), vitest referential-integrity
  tests over all sample data (22), `npm run check` as the gate.
- **Non-partisan posture is structural**: unverified money ties never feed the
  score (`MoneyTie.verified`), ties render as dated sourced facts, rebellion
  framed as measured deviation.

### Sample-data layer (`lib/civic/`)

`data.ts` (entities: MPs, parties+seats, roll calls with per-party breakdowns,
money ties, events, towns, law changes, bills) · `votes.ts` (party lines,
discipline — computed, not hardcoded) · `leaderboard.ts` (200-MP deterministic
generator + CHAMBER_SUMMARY) · `data.test.ts` pins the invariants (sums
reconcile, anchors hold, composite(pillars)==score, cross-references resolve).
**Mock is clearly labeled in the UI** ("ilustrativní mock nad tvarem …").

## Next — in rough priority order

1. **Real ingestion (Phase 1 spine, for real)** — replace `lib/civic` mocks:
   psp.cz `hl*.zip` UNL dumps (votes, daily), Hlídač API (persons/ties/donors;
   confirm reuse license — flagged in politicas.md §4.1), ARES v3, Registr
   smluv dumps. Entity-resolution service with confidence + human-review gate
   is the critical component. Postgres per politicas.md §5. Keep the current
   data shapes — the UI is already built against them.
2. **Repo split** — politicas → own repository. This activates the dormant
   `.github/workflows/ci.yml` and `lefthook.yml` (documented in both files),
   plus conventional-commit enforcement.
3. **Phase 4 (politicas.md §9)** — public read API for newsrooms (the "API
   pro redakce" CTA exists on the landing), RiskLens enrichment decision
   (see `opendata/docs/politicas-data-augmentation.md`), election-cycle
   hardening, methodology v1.4 → published methodology page (the
   "Read methodology" links are still stubs).
4. **Smaller known stubs** — leaderboard pagination/virtualization when real
   200 rows get pillar detail pages; module cross-links marked `href="#"`
   (none left on main surfaces); i18n second locale (deliberately skipped —
   Czech-only for now); OG images/favicon branding.

## Known gotchas (hard-won this session)

Documented in `CLAUDE.md` + `docs/DESIGN.md` §4: recharts `ResponsiveContainer`
needs `min-w-0` grid tracks + fixed-aspect `overflow-hidden` wrapper (page
livelock otherwise); SVG trig coordinates must be rounded (SSR/CSR float
drift); no `<p>`-nested SourceNote (renders `<div>` for this reason); no
`toLocaleDateString` (ICU drift — use `czechDate`); no `Math.random`/`Date` in
data generation (SSR == CSR).
