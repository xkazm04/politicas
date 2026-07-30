# Moonshots — Voting & Legislation

> Group: Voting & Legislation · Contexts: 2 · Proposals: 4

## LawWatch

### M1. Paměť zákona — per-paragraph authorship of the Czech statute book
- **Tier**: 1
- **Category**: data-as-moat | foundational-primitive
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: Invert LawWatch from bill-centric to statute-centric: a permanent dossier route per statute (`/zakony/predpis/[ref]`) that stitches every real e-Sbírka §-diff, every `amends` edge, every ranked sponsor, rapporteur, floor speaker and amendment author into a versioned timeline of the law itself — so a reader can click **§ 35ba of 586/1992** and see who wrote each change, when, under what committee routing, and with what money flags. The end state is a provenance-stamped answer to "kdo napsal tento paragraf českého práva" for the whole 24,774-law e-Sbírka registry, statute by statute as diffs accrete.
- **Why it's a moonshot**: No Czech (or arguably European) public tool attributes statute text at paragraph granularity to named legislators with sourced money context; if shipped, the falsifiable claim is that journalists cite politicas statute dossiers instead of raw psp.cz within one election cycle.
- **Grounded in**: `features/lawwatch/getLawData.ts` already builds `topLaws`, `diffsByLawRef`, `sponsors_ranked`, `rapporteurs`, `speakers`, `amendmentAuthors` and `amendedLawsFull` census; real verbatim §-hunks live in `docs/data-analysis/case-law/payloads/diffs/*.json` (producer `scripts/case-loops/law/esbirka-sparql-diff.ts`); the e-Sbírka registry is already joined (`esbirka_title` on `law:sb:*` nodes).
- **Path to implementation**:
  1. Add `/zakony/predpis/[ref]` route that reuses `getLawData()` + `findBillByCislo`-style pure lookup to pivot the already-loaded data by statute (zero new store reads).
  2. Render the statute timeline: bills sorted by `fatePublishedOn`, each with its §-diff hunks, sponsors, committee routing and conflict flag — all existing view fields.
  3. Extend `esbirka-sparql-diff.ts` from hand-picked bills to a batch loop over every enacted bill's `amendedLaws`, writing artifacts to the same diffs dir.
  4. Add per-fragment attribution: join hunk `fragment` strings against `proposes_amendment` document metadata to name the amendment author of a specific § where the psp.cz sd_dokument text allows it (drop, never guess — resolver discipline from FollowTheMoney).
  5. Cross-link from MP dossiers ("paragrafy, které tento poslanec napsal") and from LawWatch `topLaws`.
- **Dependencies / risks**:
  - e-Sbírka SPARQL endpoint rate limits and version-alignment edge cases at batch scale.
  - Per-fragment attribution will be sparse at first — must ship with honest "attribution unknown" states per the census-undercount disclosure pattern.
- **What changes if we ship it**: politicas stops being a bill tracker and becomes the citable public record of who authored Czech law, a moat no fast-follower can rebuild without the graph.

### M2. Kolizní radar — a live early-warning system for the drafting process itself
- **Tier**: 2
- **Category**: platform-distribution | civic-network-effects
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: Promote the collisions view from a retrospective forensic artifact (63 close-read pairs, batches 001–009) into a continuously running detector: every newly ingested tisk is §-scoped and checked against all live prints by the existing deterministic overlap pre-check, and confirmed clusters publish as a subscribable feed (RSS/JSON + per-statute e-mail watch) with embeddable Konstrukt collision cards. The users are the drafting process's own participants — committee staff, legislativní rada, journalists — who today discover incompatible edits to the same § only after enactment.
- **Why it's a moonshot**: It moves politicas from observing parliament to being infrastructure parliament's ecosystem consumes; falsifiably, a collision flagged by the radar gets cited in a committee usnesení or mainstream outlet before the second bill's third reading.
- **Grounded in**: `features/lawwatch/getCollisionData.ts` (clusters grouped by statute+§, classification normalization, Czech gate), `scripts/case-loops/law/collision-check.ts` `--v2` partitioned pre-check, `features/lawwatch/CollisionsPage.tsx`, ingestion adapters `lib/ingest/sources/psp-legislation.ts`.
- **Path to implementation**:
  1. Add a stable JSON export route for the existing `CollisionData` clusters (pure serialization of what `/zakony/kolize` already loads).
  2. Wire `collision-check.ts --v2` into the ingest loop so each pass over new tisky emits fresh candidate pairs into the same payload dir.
  3. Route only *new* surviving candidates to the LLM close-read + grep-verify (P49) queue, landing `pending_review` per the existing gate.
  4. Ship RSS/Atom per statute and per cluster; add an `<iframe>`/OG-image collision card renderer reusing the CollisionsPage cluster markup.
  5. Add a "sledovat tento zákon" watch (e-mail or feed token) keyed by `lawRef`.
- **Dependencies / risks**:
  - Close-read throughput and cost as candidate volume grows; mitigated by the deterministic pre-check doing the filtering.
  - Framing risk: must keep the "drafting-process finding, never wrongdoing" language on every distributed surface, including embeds.
- **What changes if we ship it**: collisions become something politicas *prevents* rather than documents, and every embed/feed subscription is a distribution channel compounding into the elections.

## VoteTrack

### M1. Volební kompas naruby — personal alignment over 406k real ballots
- **Tier**: 1
- **Category**: intelligence-layer | civic-network-effects
- **Feasibility**: medium
- **Time-horizon**: quarters
- **What it is**: A reverse election compass: instead of scoring parties on promises, a voter picks the themes they care about (the Silver-layer `vote_tag` themes already exist) and takes positions on ~20 real, plainly-summarized roll-calls; politicas then computes — deterministically, from the actual 406k-ballot record — which sitting MPs and clubs voted *with* them, with every number linking to the psp.cz roll-call. Shareable, per-voter result cards land right before the elections the README positions the product for.
- **Why it's a moonshot**: Every existing Czech volební kalkulačka scores stated intentions; this one scores revealed behavior, which no competitor can replicate without the ingested ballot graph — falsifiably, it 10x's reach if a single election-season share wave brings more sessions than all five modules combined today.
- **Grounded in**: real PSP10 `vote_events` + `listVoteTags` already joined in `features/votetrack/getVoteThemes.ts`; theme taxonomy in `features/votetrack/themeTypes.ts` / `themeLabels.ts`; per-MP ballots already render on profiles; deterministic scorer discipline in `lib/analysis/contribution.ts`; hemicycle renderer `features/votetrack/VoteHemicycle.tsx` for the result card.
- **Path to implementation**:
  1. Add a store read for per-MP ballots on a chosen vote set (repositories in `lib/db/pglite/repositories/votes.ts` already hold them) and a pure alignment scorer with fixture tests, mirroring `contribution.ts`.
  2. Curate the question set deterministically: top-N tagged votes per theme by salience (close margins, high attendance), each with the bill-summary one-liner where LawWatch's `bill-summaries-cz.json` covers it.
  3. Build the `/kompas` flow: theme picker → vote cards (pro/proti/přeskočit) → ranked MP/club alignment with per-vote receipts.
  4. Result card as OG image + permalink; no accounts, state in the URL.
  5. Cross-link each result row to `/poslanec/[id]` and the roll-call detail.
- **Dependencies / risks**:
  - Question curation must be provably non-editorial (publish the deterministic selection rule, like the dashboard's ascending-pspId disclosure).
  - Election-season traffic spikes vs the embedded PGlite single-connection model — may force precomputed static alignment matrices.
- **What changes if we ship it**: politicas gains a mass consumer front door that converts voters into users of the accountability graph, not just readers of it.

### M2. Seismograf sněmovny — real discipline, rebellion and cohesion over the full ledger, with per-vote permalinks
- **Tier**: 2
- **Category**: trust-layer | interface-expansion
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: Retire the mock `ROLL_CALLS` spine: compute club discipline, the line matrix, and the rebellion chronicle deterministically over the entire real PSP10 ballot record, add a coalition-cohesion time series ("seismograf" — spikes where the government's line cracked), and give every roll-call a permalink route (`/hlasovani/[id]`) with the sticky hemicycle + party breakdown as an embeddable, OG-imaged specimen card. VoteTrack sections 01–03 currently render `lib/civic` sample data while 406k real ballots sit one repository call away.
- **Why it's a moonshot**: It converts VoteTrack from a designed demonstration into the canonical citable record of every chamber vote — the falsifiable 3–5x claim is that per-vote permalinks become the standard link Czech journalists use instead of psp.cz's frame-era pages.
- **Grounded in**: `features/votetrack/VoteTrackPage.tsx` (sections 01–03 still import `ROLL_CALLS` from `lib/civic/data`), `getVoteThemes.ts` proving the store path, `components/DisciplineBoard.tsx` / `Rebellions.tsx` / `ChamberDetail.tsx` as ready renderers, per-MP ballot rows in `lib/db/pglite/repositories/votes.ts`, rebellion scoring precedent in `lib/civic/votes.ts`.
- **Path to implementation**:
  1. Extend the real loader (mirror `getVoteThemes.ts`) to emit per-vote party breakdowns and a club-line/discipline aggregate from stored ballots, fixture-tested.
  2. Swap `VoteLedger`/`ChamberDetail` to the real feed with graceful mock fallback, per the LawWatch `RealLawWatch`/`MockLawWatch` pattern.
  3. Recompute DisciplineBoard + Rebellions from the aggregate; add the cohesion time series as a small multiples strip.
  4. Add `/hlasovani/[id]` permalink route reusing ChamberDetail, with generateMetadata + OG card.
  5. Feed rebellion events into the dashboard's dated-facts ledger (`features/dashboard/datedFacts.ts`) as sourced facts.
- **Dependencies / risks**:
  - Defining "the club line" needs a disclosed deterministic rule (majority of cast votes per club) to survive methodological scrutiny.
  - 406k-ballot aggregation on request is too slow — precompute per-vote aggregates into the analysis repository at ingest time.
- **What changes if we ship it**: the chamber's actual voting behavior — not a sample — becomes the load-bearing product surface, and every vote gets a permanent, sourced public address.
