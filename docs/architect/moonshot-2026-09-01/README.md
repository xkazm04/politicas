# Moonshot build plan — waves of parallel builders (started 2026-09-04)

The 34 accepted cards of [../moonshot-2026-09-01.md](../moonshot-2026-09-01.md) are
grouped by **write set** (files, not contexts) so five builders can run at once in
separate worktrees and merge without colliding. Each wave has one design file per
group under `wave-N/`; a design names the cards, the wave's bounded slice of their
Flow, the owned paths, the forbidden paths, the hot-file policy, gates, and the
report the builder returns. The coordinator merges every branch into `master`,
runs `npm run check` on the merged tree, migrates the store when DDL changed, and
writes unfinished slices as the next wave's carry-over.

Deck ranks (`#n`) refer to the card numbers in the deck.

## Groups

| Wave | Group | Cards | Spine |
| --- | --- | --- | --- |
| 1 | G1 as-of spine | #1 #9 #10 #13 | asOf lifted into Store; /zdroj, /overeni, /graf/p, schránka show both sides |
| 1 | G2 review door | #5 #12 | review_audit generalised to claim kinds; bill + effort verdicts get the door |
| 1 | G3 vote→bill spine | #30 #29 | `decides` edge from the agenda join; club-at-vote windows |
| 1 | G4 graph explorer | #36 #28 #41 | three-state gate, derivation stamp, on-demand neighbourhoods |
| 1 | G5 provenance + certification | #22 #26 | structured kg provenance columns; sentinel-certified releases |
| 2 | G6 dated money | #23 #27 | world time on edges; aligned reach |
| 2 | G7 municipality | #20 #19 | municipality subject; obec-keyed deník |
| 2 | G8 claims everywhere | #3 #7 #15 | figure receipts; chamber readings; vote claims |
| 2 | G9 money channels | #24 #44 | subsidy + donation edges; NACE codes |
| 2 | G10 index history | #32 #46 | formula revision ledger; legislative substance |
| 3 | G11 citations | #4 #11 | citation registry; claim-ref lint ratchet |
| 3 | G12 gate protocol | #8 #16 | verification JSON/batch; export addresses |
| 3 | G13 identity + perimeter | #14 #17 | identity ledger; attribution perimeter + exposure lane |
| 3 | G14 statute text | #39 #47 | statute version graph; whole-corpus collisions |
| 3 | G15 velín | #2 #45 | sealed instrument readings; reader-seeded slices |
| 4 | G16 deník votes | #33 | roll calls in the deník (needs G3 + G7) |
| 4 | G17 link sentinel | #43 | registry-link contract sentinel |
| 4 | G18 sitemap | #21 | release-stamped entity sitemap |
| 4 | carry-overs | — | whatever waves 1–3 reported as remaining |

## Rules every builder follows

- Worktree, own branch, real `npm ci` (no `node_modules` junction — Turbopack breaks;
  see `memory/isolated-dev-server-needs-a-worktree.md`). No `.pglite` in a worktree:
  tests run on the PGlite template lane; the live store is migrated by the
  coordinator after merge with `npm run db:migrate`.
- Edit only the owned paths named in the design plus their tests and the route
  records in `docs/routes/` they owe. A needed change outside them is reported, not
  made.
- Hot files are append-only in the named slot (see each design). Never reformat a
  hot file.
- One atomic Conventional Commit per Flow step; `git add <path>` per file; every
  commit under `lib/analysis/**` or `lib/db/**` owes `Doc-sync(<doc>): <reason>`
  trailers for coupled docs it does not touch (the commit-msg hook lists them).
- Gates before the final report: `npm run typecheck && npm run lint && npm run test`
  (whole suite, in the worktree) and the touched route docs updated.
- Report: branch name, worktree path, HEAD sha, commits, what shipped per Flow step,
  what remains (carry-over), and any path outside the write set that turned out to be
  needed.

## Log

- 2026-09-04 — wave 1 dispatched (G1–G5).
