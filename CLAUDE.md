@AGENTS.md

# Politicas

Public-accountability platform for Czech politics: five interconnected modules
(CivicScore, VoteTrack, FollowTheMoney, BudgetMirror, LawWatch) over one shared
entity graph (person ↔ party ↔ company ↔ contract ↔ vote ↔ budget ↔ law),
positioned as an empirical, methodology-transparent source for the next
elections. **All content is Czech-first** (Czech data and market; `lang="cs"`,
decimal commas via `lib/format.ts`).

**Design & architecture source of truth:** `C:\Users\kazda\kiro\opendata\docs\politicas.md`
(plus `politicas-data-augmentation.md`). Module interaction models come from
the prototypes in `C:\Users\kazda\kiro\opendata\src\cases\`.

## Status — executing the design doc (2026-07-22)

**Konstrukt won** (Sutnar functionalist poster) — canonical reference:
**[docs/DESIGN.md](docs/DESIGN.md)** (read before any UI work). Runner-up
**Rentgen** is a living reference at `features/labs/rentgen/` (`/rentgen`,
noindex). Future surface exploration uses the `prototype` skill.

Route map (politicas.md roadmap execution, sample data):
- `/` — landing (features/landing)
- `/dashboard` — **Velín** (features/dashboard): chamber overview, leaderboard
  → profiles, graph-event feed, module tiles. Winner of the dashboard
  prototype round, polished to the landing bar.
- `/poslanec/[id]` — **Spis** (features/profile): the Person profile —
  politicas.md §3's "real product". Fused from the losing dashboard variant:
  poster header + score/trend, pillars, roll-call votes (rebel markers),
  money ties as dated sourced facts (+ empty state), prev/next file nav.
- `/hlasovani` — **VoteTrack** (features/votetrack): fusion of all three
  prototype variants — Deník (chronological ledger as master), Sál (sticky
  chamber detail: hemicycle + party breakdown it drives), Linie (club
  discipline board, line matrix, rebellion chronicle). Feeds pillars
  Aktivita/Docházka/Nezávislost; pure vote logic in `lib/civic/votes.ts`.
- `/penize` — **FollowTheMoney** (features/money): the Rentgen money-graph's
  production home, translated to Konstrukt — entity-trail graph (hover lights
  edges), kniha vazeb grouped by MP with verified/pending-review states, and
  the trail methodology (IČO join + human gate). Feeds pillar Integrita.
- `/zebricek` — **CivicScore** (features/civicscore): full 200-MP leaderboard —
  score histogram + computed chamber summary, party filter + name search, mini
  weighted-breakdown bars per row, and Souboj (pick two via "vs" → mirrored
  pillar-by-pillar comparison). The 195 non-sample MPs come from
  `lib/civic/leaderboard.ts` — a deterministic, test-pinned mock generator
  (sample anchors at exact ranks, party seats reconciled, composite(pillars)
  == score, no Math.random so SSR == CSR). Dashboard chamber aggregates are
  test-pinned to its computed CHAMBER_SUMMARY.
- `/rozpocty` — **BudgetMirror** (features/budget): town vs peer-group mirror —
  metric duos against the computed peer median, debt-per-capita trend lines
  (town vs median), sortable peer table. Stewardship feeds only executive
  roles — stated explicitly on the page.
- `/zakony` — **LawWatch** (features/lawwatch): paragraph diffs (before/after)
  linked back to the roll-call that voted them + sample votes, and the
  legislative pipeline (bill stage steppers incl. rejected state). Closes the
  vote → impact loop with /hlasovani.
- `/rentgen` — archived art direction.

All five politicas.md modules now have surfaces (Phase 1–3 complete on sample
data). Next: real ingestion to replace the mock layer, or election-cycle
hardening per §9 Phase 4.

## Code structure (patterns adopted from the personas repo)

```
app/                    thin routes only (page.tsx mounts a feature component)
features/landing/       the landing feature: LandingPage.tsx (orchestrator:
                        state + layout) + components/ + palette.ts (chart hex
                        mirror of tokens)
features/labs/          archived art directions — fixed hexes allowed
features/shared/components/  domain-agnostic primitive catalog (@catalog tags);
                        lint-enforced boundary: NO imports from features/* or
                        lib/civic — pass data via props
lib/civic/              domain data + colocated vitest tests
lib/format.ts           Czech number formatting (the only .toFixed for display)
eslint-rules/           custom lint rules (see below)
docs/DESIGN.md          design-system source of truth
```

Conventions:
- **Routes stay thin** — a page.tsx only mounts a feature and sets metadata.
- **Check the shared catalog before building a widget**; new reusable
  primitives go into `features/shared/components/` with a `@catalog` JSDoc
  one-liner, not into a feature folder.
- **Colors originate in `app/globals.css` tokens only** — see docs/DESIGN.md §1
  for the three declared exceptions. Enforced by lint.
- **Every rendered number cites its source** (`SourceNote`) — the brand rule.
- Sample data lives in `lib/civic/data.ts`; extend it, don't inline mocks.
  `score` must equal `composite(pillars)` — the colocated test enforces it.

## Quality gates

```bash
npm run dev          # dev server (Turbopack)
npm run check        # THE gate: typecheck + lint + test — run before calling work done
npm run typecheck    # tsc --noEmit
npm run lint         # eslint incl. 4 custom rules
npm run test         # vitest (lib/**/*.test.ts)
npm run build        # production build
```

Custom ESLint rules (`eslint-rules/`, ported/adapted from personas, all at
error level — keep it that way while the codebase is young):
- `custom/no-hardcoded-colors` — token discipline (politicas-specific)
- `custom/no-silent-catch` — empty catch blocks swallow errors
- `custom/role-button-requires-keydown` — a11y for click-role elements
- `custom/enforce-reduced-motion-fallback` — WCAG 2.3.3 for looping motion

CI: `.github/workflows/ci.yml` (typecheck → lint → test → build). NOTE: it
activates once politicas becomes its own repo — inside the kiro monorepo,
GitHub only reads workflows from the repo root; `npm run check` is the local
equivalent. Same for `lefthook.yml` (pre-commit staged lint, pre-push
typecheck+test) — install lefthook only after the repo split.

## Git discipline (ported from personas' parallel-safety primitives)

- Stage per-file (`git add <path>`) — never `git add -A`/`.`/`-u`; other
  sessions may have in-flight work in this tree.
- Never `git stash` work that isn't yours.
- Atomic commits per task; Conventional Commits format (`feat: …`, `fix: …`)
  — CI will enforce it after the repo split.
- Before commit: `git diff --cached --stat` and verify the staged count
  matches what you intended.

## Known gotchas

- recharts `ResponsiveContainer` inside a CSS grid track needs `min-w-0` on
  the track and a fixed-aspect `overflow-hidden` wrapper — otherwise the page
  livelocks in a resize loop (hit 2026-07-22; see docs/DESIGN.md §4).
- SVG coordinates from trig must be rounded (2 decimals) or SSR/CSR float
  drift trips React hydration (see `Hemicycle.tsx`).
- Stack: Next 16.2 (App Router), React 19.2, Tailwind v4, framer-motion,
  recharts 3, vitest, lucide-react. Fonts in `app/layout.tsx`: `font-sans`
  Archivo, `font-mono` IBM Plex Mono, `font-serif` Fraunces (reserved).
