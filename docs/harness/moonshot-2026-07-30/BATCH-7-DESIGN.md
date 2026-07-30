# Batch 7 — Second Surfaces (design doc) — THE FINALE

> 5 features, one parallel wave. Last batch of the 35-moonshot campaign.
> Package narrative: **new audiences, and everything becomes findable.** The shell becomes a
> personal civic inbox and finally gets nav entries for every surface shipped in batches 1–6;
> the landing invites citizens to weigh the methodology themselves; /rentgen returns as a
> press-facing evidence terminal; a forensic second lens can be switched on; and a sentinel
> watches the real graph nightly.

## Shared design contract

**The full chain binds: BATCH-1 § Shared design contract + BATCH-2 add. 10–12 + BATCH-3
add. 13–15 + BATCH-4 add. 16–17 + BATCH-5 add. 19–22 + BATCH-6 add. 23–25.**

Batch-7 additions:

26. **The shell embargo lifts — for 7A only.** features/shell/** and app/layout.tsx belong
    exclusively to builder 7A this batch. Everyone else keeps out, as always.
27. **The tree after six batches** — public routes now live at: /denik(+feeds), /data(+manifest,
    snapshot), /dukazy(+feeds), /svedectvi, /zdroj/[ref], /overeni, /atlas(+json), /kompas,
    /kraj(+[kraj]), /plakat/[view], /graf/p/[ref], /zakony/predpis(+[ref]), /zakony/kolize
    (radar+feeds), /penize/strety, /penize/[pspId]/paket, /rozpocty/[ico]. Packages in
    packages/. Doctrine lint active. Claims registry in lib/claims/registry.ts.
28. **No hollow toggles.** 7D's forensic mode ships with at least one complete reference
    integration that visibly transforms; a mode that changes three colors is a failed feature.

## Items

### 7A. Občanská schránka — the shell becomes a personal civic inbox (+ nav wiring)
- **Source proposal**: `landing-navigation.md` § App Shell & Navigation M1. Read fully.
- **Surface (exclusive)**: `features/shell/**`, `app/layout.tsx`, NEW `features/schranka/**` +
  `app/schranka/**`.
- **Essence** (two mandates):
  a. **Schránka**: follow any MP / bill / company / town — no accounts: follows live in
     localStorage; a "Sledovat" affordance API other features can adopt later (export a small
     client component; wire it on 2–3 surfaces you can reach via the shell, not by editing other
     features). /schranka renders "co se změnilo od minulé návštěvy": per-followed-entity deltas
     derived from change_event + deník + dukazy loaders (read-only), provenance-stamped,
     last-visit timestamp in localStorage. Sidebar shows a badge when followed entities have
     news.
  b. **Nav wiring**: reorganize navModel.ts so all batch-1–6 surfaces are reachable and
     comprehensible — group under the five modules + a "Záznam" (record: denik, dukazy, data,
     atlas, overeni) cluster; /kompas + /kraj surfaced for the election-season reader; /zdroj,
     /plakat, /svedectvi stay unlisted (deep-link surfaces) — your call with UX judgment,
     documented in the reply. Mobile nav must keep parity.
- **Tests**: delta derivation (followed-entity filter, since-timestamp), follow-list codec,
  navModel completeness check (every public route reachable or deliberately unlisted — as a
  test with an explicit allowlist).

### 7B. Referendum o metodice — citizens weigh the republic
- **Source proposal**: `landing-navigation.md` § Landing Page M1. Read fully.
- **Surface (exclusive)**: `features/landing/**`, NEW `app/referendum/**` + `app/embed/**`,
  optionally additive `lib/db/pglite/ddl.ts` + NEW `repositories/weights.ts` (only if you ship
  the aggregate; additive-only as always).
- **Essence**: the landing invites the visitor to set their own pillar weights (reuse the
  Otevřený-index `?vahy=` codec READ-ONLY from features/civicscore/lens.ts — do not fork the
  codec): a landing section with 3 editorial presets + a "nastav si váhy" flow at /referendum,
  producing a shareable link (OG card via next/og showing the weight fingerprint + top-5 under
  that lens) and an embeddable widget route /embed/zebricek?vahy= (iframe-safe, minimal chrome,
  cites source). If feasible, an anonymous aggregate: store submitted weight vectors (additive
  table, no identity, k-anonymity floor disclosed — show the median only when n ≥ 20) rendered
  as "jak váží Česko" beside the published methodology.
- **Tests**: preset/codec passthrough (no fork), OG payload derivation, aggregate median +
  k-floor honesty, embed route param safety.

### 7C. Newsroom Evidence Terminal — /rentgen returns as a press product
- **Source proposal**: `shared-ui-primitives.md` § Archived Art Direction M1. Read fully.
- **Surface (exclusive)**: `features/labs/rentgen/**`, `app/rentgen/**`.
- **Essence**: the archived Rentgen direction, wired to the REAL knowledge graph: the money-graph
  treatment over live verified ties (moneyLoader read-only), a live provenance tail-log strip
  (latest review decisions + change events, read-only loaders), press-facing affordances
  everywhere: every element links to its citation surface (/zdroj, /graf/p, /dukazy anchors),
  a "pro novináře" header explaining the terminal + linking /overeni and the packet compiler.
  Keep the noindex.
- **Tests**: terminal view-model derivation from fixture graph (verified-only discipline),
  tail-log merge ordering.

### 7D. Forenzní režim — a second lens you can switch on
- **Source proposal**: `shared-ui-primitives.md` § Archived Art Direction M2. Read fully.
- **Surface (exclusive)**: NEW `features/shared/forensic/**`, `app/globals.css` (one clearly
  marked additive layer), reference integration in `features/graph/**` (free this batch).
- **Essence**: a forensic display mode — `?rezim=forenzni` (URL-carried, shareable, no
  persistence) flips a root data attribute; the forensic layer restyles tokens (Rentgen's
  x-ray voice: inverted paper, evidence-first density) AND changes behavior where wired:
  the reference integration is /graf — in forensic mode the graph defaults to verified-only
  edges, provenance labels render inline, and hover cards show review states without clicks.
  Ship the mechanism (provider/hook + layer + toggle component) + a documented adoption guide
  (in-code) for other modules; per addition 28, the /graf transformation must be complete and
  obviously different, not cosmetic.
- **Tests**: mode codec/propagation, forensic view-model derivation for the graph reference
  (verified-only filter), reduced-motion + a11y preserved in the layer.

### 7E. Live-Graph Sentinel — nightly tests against the real record
- **Source proposal**: `infrastructure-observability.md` § Test Utilities M2. Read fully.
- **Surface (exclusive)**: `lib/testing/**`, NEW `scripts/sentinel/**`, `package.json` (additive
  script only), optionally ONE NEW workflow file `.github/workflows/sentinel.yml` (do not touch
  existing workflows; the file is a proposal — note it in your reply so the orchestrator flags
  it at review).
- **Essence**: `npm run sentinel` opens the real store read-only and runs invariant assertions
  against the live graph: counts within released-manifest bounds, audit chain verifies, no
  orphan edges, readiness floors hold, freshness within atlas cadence, sampled derivations
  (score/leaderboard) deterministic across two runs. Output: human summary + machine JSON +
  non-zero exit on violation. The workflow file schedules it nightly (cron) if adopted.
- **Tests**: each invariant against fixture stores (violation fires, clean passes), report
  codec. The sentinel itself must also RUN live in your session — include its live verdict in
  your reply.

## Cross-feature coherence

- 7A's nav must include 7B's /referendum and keep /rentgen unlisted-but-linked from the
  "pro novináře" contexts (7C) — coordinate via this doc: 7A lists /referendum under Záznam or
  landing cluster; /rentgen stays out of the main rail (noindex product).
- 7C and 7D share the Rentgen visual heritage — 7D's layer may reference the same token
  values, but neither imports from the other.
- 7E's invariants read the manifest (3D) and atlas cadences (6D) as ground truth — cite which.

## Orchestration

Single wave, 5 parallel builders, exclusive surfaces, no git. Commits `vibeman(moonshot-b7)`.
Gates: typecheck, lint (0 errors, warnings ≤30), full vitest (≥1183), `next build`. Then the
campaign close: BATCH-7-REPORT + campaign summary, vault refresh, push/PR decision with the user.
