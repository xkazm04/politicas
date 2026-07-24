# Feature opportunities — grounding the vague app from evidence

The app's five modules are **under-specified by design** (see politicas CLAUDE.md);
this loop grounds them from what the data actually shows. **Every opportunity cites
the entities/patterns that motivate it** — the product decision is evidence-backed,
not vibes. The loop appends here; each item tags its module and links its evidence.

Modules: **CivicScore** · **VoteTrack** · **FollowTheMoney** · **BudgetMirror** ·
**LawWatch**. An opportunity's `module` is machine-enforced (`APP_MODULES` in
`lib/analysis/kg-verdict.ts`). Evidence must cite real entity ids — the gate rejects
a hallucinated MP. See [[frontier]] for the analyses that will fill this out and
[[graph-schema]] for what's computable today vs blocked.

---

## CivicScore

- **O1 — Independence pillar should weight *contested-vote* rebellion, not raw rebellion.**
  *Status:* hypothesis, pending [[frontier]] F3.
  *Evidence available now:* `rebellion_rate` is computed per MP (203 `rebels_against`
  edges); rates are low (max 0.082, Pikora/MS) because most roll calls are lopsided,
  so raw rebellion barely separates MPs. Weighting rebellion on *close* votes (where
  defection actually costs) should differentiate far better.
  *Needs:* a per-vote contestedness measure (margin) — F3 produces it, then this
  becomes a concrete pillar-weight proposal citing MP ids.
- **O8 — Independence pillar should weight votes on *contested themes*** (pass 4, F11).
  *Evidence:* themes now carry a deterministic `contested`/`opposed_fraction` prop
  ([[cluster-bloc-theme]]); 8 of 13 themes are contested, fiscal-budget highest (0.913),
  while honours/appointments barely split the blocs. A rebellion or a cross-bloc vote on
  the *budget* is far more meaningful than one on a symbolic honours motion. *Proposal:*
  weight an MP's independence/rebellion signal by the `opposed_fraction` of the theme the
  vote belongs to — grounded in the `about` + contestedness props already in the graph.
  Complements O1/F3 (contested *votes*) at the theme grain.
  **✅ Computed (pass 5, F16):** person nodes now carry `contested_rebellion_score`
  ([[cluster-theme-rebellion]]). The reweighting *works* — the top raw rebel Pikora (mostly
  symbolic honours) drops below Babka/Haas (who break on contested themes). The pillar can
  read this prop directly; the reordering vs raw rebellion is the evidence it matters.

## VoteTrack

- **O3 — Bloc Cohesion Tracker** (pass 2, F1). *Evidence:* the two-bloc split
  ([[cluster-blocs]]) with a 0.913-vs-0.457 gap between the lowest intra-bloc club
  (ODS) and highest cross-bloc club (SPD); MS has the chamber's highest mean
  rebellion (0.015) despite bloc alignment. *Proposal:* a "blocs" view showing the
  two detected blocs with per-club/per-MP cohesion updated as roll calls arrive,
  flagging any club or MP whose rolling agreement with its bloc drifts toward the
  ~0.5 cross-bloc threshold — an early defection signal.
- **O4 — Cross-Bloc Bridge MPs** (pass 2, F1). *Evidence:* the four perfect-agreement
  ANO2011↔MS MP pairs (1.0 over 849–1090 shared votes; [[patterns]] P4). *Proposal:*
  an "MP alliance pairs" widget on profile pages listing each MP's top cross-club
  co-voters — showing which legislators anchor inter-club cohesion within a bloc.
- **O5 — Theme lens on MP voting records** (pass 3, F2; **revised pass 4**). *Evidence:*
  13 themes cover >90% of titled votes ([[cluster-themes]]); parliamentary-procedure is
  807 votes (~40% of the chamber). *Proposal:* filter/aggregate an MP's votes by theme,
  separating `theme:parliamentary-procedure` out for *volume* reasons. **⚠ Revised
  ([[contradictions]] C1):** do NOT default-*hide* procedure — pass 4 found it is one of
  the most *contested* themes (opposed 0.763), a real partisan battleground. Separate it
  by volume, but keep it visible as its own signal.
- *(now unblocked by F2)* rebellion / discipline / attendance metrics come from the
  deterministic layer (`rebels_against`, cohesion, absence); the `about` edges let
  VoteTrack group any roll call by theme.

## FollowTheMoney

- **O2 — the money sub-graph is the module's spine. ✅ POPULATED (pass 10, 2026-07-24).**
  *Status:* **unblocked** (was [[frontier]] F6). The edge shape `MP —linked_to→ Company
  —supplies→ Contract` is live: **196 `company` + 2 287 `contract` nodes, 260 `linked_to`
  + 2 290 `supplies` edges**, ~18.7 bn CZK reachable public money across 73 MPs (Hlídač ⋈
  ARES IČO join, `lib/analysis/kg-money.ts` + `money-feed.ts`). **All 260 `linked_to` ties
  are `pending_review`** — the human gate holds; none feeds the Integrity pillar until a
  person verifies it. `/penize` renders this directly (unverified ties shown as such).
  See [[graph-schema]] track note.

## BudgetMirror

- **O6 — Unified fiscal-budget & tax-cycle timeline** (pass 3, F2). *Evidence:*
  `theme:fiscal-budget` aggregates 276 votes across 5 subjects — FY2026 budget core
  (135) + companion (4), veřejné rozpočty (45), evidence tržeb (86) + EU companion (6).
  *Proposal:* stitch these subjects into one chronological "state budget & tax
  administration" view showing amendment-by-amendment votes toward the final budget law.
- *(data-blocked)* town-vs-peer budget opportunities captured once budget sources ingest.

## LawWatch

- **O7 — EU-transposition tracker spanning themes** (pass 3, F2). *Evidence:* 8 EU-tagged
  subjects (46 votes) split across four themes rather than one bloc ([[patterns]] P7).
  *Proposal:* tag every `- EU` subject regardless of theme and surface a cross-theme
  EU-transposition-deadline view, so citizens see harmonisation-bill progress by domain.
- **O9 — bill → law amendment graph. ✅ POPULATED (pass 11, 2026-07-24).** The legislation
  source ingested: **141 `bill` + 101 `law` nodes, 150 `amends` (bill→law) + 528 `sponsors`
  (person→bill) edges** (`lib/ingest/sources/psp-legislation.ts`). Bill nodes carry `origin`
  (government/mp/senate), `amended_laws`, `flagged_conflict` (Case-① money-tie overlap on a
  sponsor), and one carries a gated `forensic_*` verdict (tisk 58, `pending_review`). `/zakony`
  renders bills→laws grouped by most-amended statute.
  *Honest gap:* the graph carries **no paragraph before/after diffs and no pipeline-stage**
  data — the `č. N/RRRR Sb.` title citation is the only structured bill→law link psp.cz
  publishes. `/zakony` dropped the mock's diff/stepper views rather than fabricate them.
