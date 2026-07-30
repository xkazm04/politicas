# Moonshots — Knowledge Graph Explorer

> Group: Knowledge Graph Explorer · Contexts: 1 · Proposals: 2

## Graph Playground

### M1. Evidence Permalinks — the citation infrastructure for Czech political journalism
- **Tier**: 1
- **Category**: civic-network-effects
- **Feasibility**: high
- **Time-horizon**: months
- **What it is**: Every view of the graph becomes a durable, citable artifact. A lens + selection + viewport on /graf serializes into a stable permalink (`/graf?lens=penize-poslancu&node=…`) that renders server-side into (a) an OG/social image of exactly that subgraph, (b) a machine-readable evidence bundle (JSON-LD: nodes, edges, per-edge `review_state`, per-node provenance `pass/method/ref/computedAt`, and the registry deep-links from `sourceLinksFor`), and (c) an embeddable iframe card. A journalist writing about an MP's company ties doesn't screenshot the playground — they cite it, and the citation carries the provenance chain and the human-gate status of every edge at the moment of citation (content-hash stamped, so the artifact says "as verified on 2026-07-30").
- **Why it's a moonshot**: It turns a viewer into infrastructure — if Czech newsrooms and watchdog NGOs cite politicas permalinks instead of screenshots, every published article becomes an inbound distribution channel and the graph becomes the reference layer for money-in-politics claims. Falsifiable: within two quarters of shipping, external domains embed or link evidence permalinks without us asking.
- **Grounded in**: `features/graph/graphLoader.ts` already computes everything server-side and caches per-process (getMapData, getTrails, getNodeDetail with provenance + `citableId`); `lib/kg/sourceLinks.ts` builds registry deep-links; `features/graph/components/GraphStage.tsx` exposes `edgeKey` and a lens model (`StageLens`) that is already a serializable set of node/edge ids; `features/graph/graphActions.ts` shows the validated-server-action pattern; edges carry `pending` (review_state) end to end.
- **Path to implementation**:
  1. Lift lens/selection/variant state into URL search params on `/graf` (today it's `useState` + localStorage in `GraphPage.tsx`/`VariantMapa.tsx`) — deep links into any graph view work immediately, zero new backend.
  2. Add a server route `app/graf/citace/[slug]` that resolves a serialized lens into a static, no-canvas SSR rendering (reuse trail columns from `VariantTrasy` as the fallback typesetting) with the full provenance ledger listed below the figure.
  3. Emit the JSON-LD evidence bundle from the same loader data (nodes, edges, provenance, registry links, generatedAt, dataset revision) at `…/citace/[slug].json`.
  4. Add an OG-image renderer (Next `ImageResponse` or node-canvas reusing `kindStyle` glyph tracing) so shared links unfurl with the actual subgraph.
  5. Content-hash the bundle and print the hash + "stav ověření k datu" on the artifact — the citation is honest about pending vs verified edges at snapshot time.
  6. Embed widget: a `<iframe>`-safe minimal page + copy-embed button in `NodeInspector`/lens panel.
- **Dependencies / risks**:
  - Graph is process-cached and batch-recomputed — permalinks must pin the dataset revision (already exposed as `computedAt`/provenance) or clearly render "data moved on since this citation".
  - Legal sensitivity: an embeddable card accusing nobody is the point — the pending/verified dashed-edge distinction must survive into every export format, not just canvas.
- **What changes if we ship it**: politicas stops being a site people visit and becomes the thing other publications cite — the provenance doctrine becomes distribution.

### M2. Trail Engine — from 4 curated trails to "any two entities, show me the evidence path"
- **Tier**: 2
- **Category**: intelligence-layer
- **Feasibility**: high
- **Time-horizon**: weeks
- **What it is**: A "Spoj dva body" mode: the reader picks any two nodes (an MP and a ministry supplier, a company and a law) and the server computes the shortest evidence paths between them over `kg_edge` — excluding `co_votes_with`, ranked by verified-over-pending and money weight — and returns them as a generated Trail rendered through the existing lens machinery: landscape dims, the path lights up hop by hop, each hop labeled with its relation, review state and provenance. The four curated trails stop being the product and become the demo; the product is an unlimited, deterministic question-answering surface where every answer is a walkable chain of sourced facts, never a claim.
- **Why it's a moonshot**: It multiplies the playground's answer space from 4 hand-picked questions to ~5M node-pair questions with zero editorial cost per answer — the "is there a connection between X and Y?" question every journalist starts with becomes self-serve. Falsifiable: median generated path renders in <300ms and users run more generated trails than curated ones within a month.
- **Grounded in**: `features/graph/graphLoader.ts` `getTrails` already proves the whole pattern (server-computed nodes+edges+columns, client formats money) and `graphIndex` holds the full adjacency ingredients in memory (~3,200 core nodes — BFS over this is microseconds); `lib/db/pglite/repositories/kg.ts` keeps the indexed `kgNeighbours` query noted as "returns with the winner's drill-down" in the loader header; `VariantMapa.tsx` lens + `fitBounds` + `StageLens` render any node/edge set with no new canvas work; `NodeSearch.tsx` is the ready-made picker for both endpoints; `graphActions.ts` gives the validated action shape (`pathAction(srcId, dstId)`).
- **Path to implementation**:
  1. Build an in-memory adjacency map alongside `GraphIndex` in `buildIndex` (edges are already fetched there for degree counting — store them instead of discarding) and a `findPaths(src, dst, k=3)` BFS/k-shortest over evidence edges; unit-test on fixture graph.
  2. Add `pathAction` in `graphActions.ts` returning a `Trail`-shaped payload (hop columns = path steps) so both variants can render it unchanged.
  3. UI: a second endpoint slot in the search overlay ("odkud → kam"); result plugs into the existing `activeTrail`/lens flow in `VariantMapa.tsx`, with hop-by-hop step-through (reuse `focusId`).
  4. Rank paths: verified edges beat `pending_review`, higher `supplies` weight beats lower; show the runner-up paths as alternates.
  5. Guardrail copy: "no path found within N hops" is itself a first-class, screenshot-able answer (absence of evidence, stated honestly) — and every generated trail feeds M1's permalink pipeline for free.
- **Dependencies / risks**:
  - Path ranking is editorial-adjacent — the ranking rule must be printed on the result (same doctrine as the dashboard's slice-selection rule) or it becomes an implicit accusation machine.
  - Hub nodes (parties, big organs) make everything 2 hops from everything — need a hop-cost on high-degree nodes so paths stay meaningful, disclosed in the method note.
- **What changes if we ship it**: the playground graduates from a gallery of four answers into an evidence query engine — the graph's value scales with questions asked, not editor hours spent.
