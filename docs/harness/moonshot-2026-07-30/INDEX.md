# Moonshot-Architect Scan — politicas, 2026-07-30

> Idea-generation scan (moonshot lens): ambitious 10x opportunities, NOT defects.
> 9 group-level subagent runs (one per context group), 2 proposals per context.
> HEAD at scan: `3431012`. Prior lens history: combined bug+UI scan 2026-07-26 (11 fix waves merged); ideas backlog empty at scan start.

---

## Totals

| | Tier 1 (10x, category-defining) | Tier 2 (3–5x step-change) | Tier 3 (directional) | **Total** |
|---|---:|---:|---:|---:|
| Across 25 contexts | 26 | 23 | 1 | **50** |

Feasibility: 24 high · 25 medium · 1 low. Time-horizon: 10 weeks · 25 months · 15 quarters.

## Per-group breakdown

| Group | Contexts | Proposals | T1 | Report |
|---|---:|---:|---:|---|
| Data Layer | 5 | 10 | 6 | `data-layer.md` |
| Infrastructure & Observability | 4 | 8 | 4 | `infrastructure-observability.md` |
| Financial Transparency | 3 | 6 | 3 | `financial-transparency.md` |
| Data Ingestion | 3 | 6 | 3 | `data-ingestion.md` |
| MP Profiles & Rankings | 3 | 6 | 3 | `mp-profiles-rankings.md` |
| Landing & Navigation | 2 | 4 | 2 | `landing-navigation.md` |
| Voting & Legislation | 2 | 4 | 2 | `voting-legislation.md` |
| Shared UI Primitives | 2 | 4 | 2 | `shared-ui-primitives.md` |
| Knowledge Graph Explorer | 1 | 2 | 1 | `knowledge-graph-explorer.md` |

---

## Theme clusters (across all 50)

| Theme | Count | Signature proposals |
|---|---:|---|
| **trust-layer** — provenance becomes product | ~10 | Tamper-Evident Ledger, Provenance Capsule, Civic Claim Gate, Reproducibility Certificate, Doctrine Compiler, Deník důkazů, Otevřený index |
| **platform-distribution** — embeddable/exportable artifacts | ~9 | Specimen Syndication Engine, Evidence cards, Trail Protocol, Referendum o metodice, eslint-plugin-civic-transparency, Newsroom Evidence Terminal |
| **intelligence-layer** — graph starts computing conclusions | ~9 | Vote-Collision Engine, Tripwires, Trail Engine, Volební kompas naruby, civic seismograph change events, Municipal Money Trail |
| **data-as-moat** — coverage/history depth | ~7 | Every Town's Mirror (6,254 municipalities), Paměť zákona, Deník republiky ×2, Data Releases, Numbers That Testify |
| **foundational-primitive** — canonical machine-readable surfaces | ~6 | Spis API, Open Scoring Standard, Bitemporal Graph, Evidence Packet Compiler, ⌘K omnisearch |
| **civic-network-effects** — other actors join the system | ~5 | Evidence Permalinks, Verification Network, czech-civic-data stdlib, Občanská schránka, Jurisdiction Kernel |
| **interface-expansion** | ~4 | Uncensorable Instrument (in-browser graph), Poster Mode, Můj kraj, Forenzní režim |

### Convergence & overlap notes (dedupe at triage)

1. **"Deník republiky" proposed twice independently** (Landing Page M2 + Velin Dashboard M1) — same core idea (daily deterministic provenance-stamped edition). Strong convergence signal; merge into one goal if accepted.
2. **Embeddable-evidence cluster**: Evidence Permalinks (Graph), Evidence cards (Velin), Specimen Syndication Engine (Bootstrap), Trail Protocol cards (FTM) all build "citable, embeddable, self-citing artifact" machinery — one shared substrate could serve all four.
3. **Multi-parliament cluster**: Parliament-agnostic adapter kit (Sources), Jurisdiction Kernel (i18n), Parliament-in-a-Box (Sample Fallback) are three angles on the same internationalization bet.
4. **Provenance-receipt cluster**: Provenance Capsule (SourceNote), Byte-level provenance (Ingest), Numbers That Testify (format layer) — same receipt idea at three depths.

---

## All 50 proposals

Format: **Context — Title** [Tier · feasibility · horizon]. Full detail in the group report.

### Landing & Navigation (`landing-navigation.md`)
1. App Shell — **Občanská schránka**: personal civic inbox, follow anything, provenance-stamped deltas [T1 · med · quarters]
2. App Shell — **Celografová omnisearch**: ⌘K over the entire republic [T2 · high · weeks]
3. Landing — **Referendum o metodice**: shareable, embeddable citizen-weighted index [T1 · high · months]
4. Landing — **Deník republiky**: the landing as a daily deterministic edition [T2 · med · months]

### MP Profiles & Rankings (`mp-profiles-rankings.md`)
5. Velin — **Deník republiky**: daily provenance-stamped diff of the state (RSS/JSON, per-entity watch) [T1 · med · months]
6. Velin — **Evidence cards**: every graph slice as a signed, embeddable exhibit [T2 · high · weeks]
7. Dossier — **Spis API**: canonical machine-readable dossier of every Czech MP [T1 · high · months]
8. Dossier — **Kariérní spis**: the MP file across parliamentary terms [T2 · med · quarters]
9. Leaderboard — **Otevřený index**: the reader re-weights the republic [T1 · high · weeks]
10. Leaderboard — **Můj kraj**: the constituency ballot card [T2 · high · weeks]

### Voting & Legislation (`voting-legislation.md`)
11. LawWatch — **Paměť zákona**: per-paragraph authorship of the Czech statute book [T1 · med · quarters]
12. LawWatch — **Kolizní radar**: live early-warning for the drafting process [T2 · high · months]
13. VoteTrack — **Volební kompas naruby**: personal alignment over 406k real ballots [T1 · med · quarters]
14. VoteTrack — **Seismograf sněmovny**: real discipline/rebellion over the full ledger, per-vote permalinks [T2 · high · months]

### Financial Transparency (`financial-transparency.md`)
15. BudgetMirror — **Every Town's Mirror**: all 6,254 municipalities on live MONITOR data [T1 · high · months]
16. BudgetMirror — **Municipal Money Trail**: join town budgets to contract graph by IČO [T2 · med · months]
17. Money Review — **Verification Network**: one token → accredited reviewer web [T1 · med · quarters]
18. Money Review — **Evidence Packet Compiler**: graph-assembled dossiers with citation gate [T2 · high · months]
19. FTM Graph — **Vote-Collision Engine**: "hlasoval o penězích své firmy," computed [T1 · med · quarters]
20. FTM Graph — **Trail Protocol**: embeddable verified-fact cards + country-adapter kit [T2 · high · months]

### Knowledge Graph Explorer (`knowledge-graph-explorer.md`)
21. Graph — **Evidence Permalinks**: citation infrastructure for Czech political journalism [T1 · high · months]
22. Graph — **Trail Engine**: any two entities → shortest evidence path [T2 · high · weeks]

### Data Ingestion (`data-ingestion.md`)
23. Admin — **Deník důkazů**: review console becomes a public evidence wire [T1 · high · months]
24. Admin — **Loop mission control**: machine-readable loop state that can drive, not just watch [T2 · med · months]
25. Normalization — **czech-civic-data**: the shared standard library for Czech civic tech [T1 · high · quarters]
26. Normalization — **Byte-level provenance**: click any number, see the source line [T2 · med · months]
27. Adapters — **Parliament-agnostic adapter kit**: the ingestion engine goes multi-country [T1 · med · quarters]
28. Adapters — **Civic seismograph**: diff-derived change events and public alerts [T2 · high · months]

### Data Layer (`data-layer.md`)
29. Sample Fallback — **Parliament-in-a-Box**: sample layer as portable onboarding contract for any parliament [T1 · med · quarters]
30. Sample Fallback — **Counterfactual Chamber**: reader-driven what-if over the deterministic scorer [T2 · high · weeks]
31. Scoring — **Open Scoring Standard**: reproducible-build discipline for political scores [T1 · med · months]
32. Scoring — **Civic Claim Gate as product**: fabrication-proofing for every Czech newsroom [T1 · med · quarters]
33. KG Domain — **Tripwires**: the graph stops being a record and starts being a watchman [T1 · med · months]
34. KG Domain — **Open-Data Quality Atlas**: federate the context catalog beyond one corpus [T3 · high · months]
35. Repos — **Tamper-Evident Ledger**: hash-chain the audit trail, publish the roots [T1 · high · weeks]
36. Repos — **Bitemporal Graph**: every claim gets a history, every surface a time slider [T2 · med · months]
37. Store — **Uncensorable Instrument**: ship the whole graph into the reader's browser [T1 · med · quarters]
38. Store — **Data Releases**: readiness floors become a public versioned release train [T2 · high · weeks]

### Shared UI Primitives (`shared-ui-primitives.md`)
39. Rentgen — **Newsroom Evidence Terminal**: resurrect /rentgen wired to real kg as press-facing product [T1 · med · quarters]
40. Rentgen — **Forenzní režim**: archived direction becomes a live second lens on every module [T2 · med · months]
41. Primitives — **Provenance Capsule**: SourceNote becomes a click-through verifiable receipt [T1 · high · months]
42. Primitives — **Skóre s pamětí**: AnimatedScore/RankDelta become time-scrubbing instruments [T2 · med · months]

### Infrastructure & Observability (`infrastructure-observability.md`)
43. ESLint — **Doctrine Compiler**: evidence-citation as compile-time guarantee [T1 · med · months]
44. ESLint — **eslint-plugin-civic-transparency**: export the discipline publicly [T2 · high · weeks]
45. Tests — **Reproducibility Certificate**: golden parliament every published number must replay from [T1 · med · quarters]
46. Tests — **Live-Graph Sentinel**: test layer runs nightly against the real ingested graph [T2 · high · weeks]
47. Bootstrap — **Specimen Syndication Engine**: every figure an embeddable self-citing artifact [T1 · med · quarters]
48. Bootstrap — **Poster Mode**: election-season print pipeline in the stylesheet layer [T2 · high · weeks]
49. i18n — **Jurisdiction Kernel**: from Czech-first app to deployable parliament-transparency platform [T1 · low · quarters]
50. i18n — **Numbers That Testify**: provenance-bound formatting emitting a claim corpus [T2 · high · months]

---

## Conversion sequence

Moonshots do not go into fix waves. Each accepted item becomes an entry in the Vibeman ideas backlog; a picked backlog item converts into a Pipeline-A-style goal (plan → implement → verify) in this or a future session. Quick-win candidates (T1/T2 with `weeks` horizon, high feasibility): Otevřený index (#9), Tamper-Evident Ledger (#35), Trail Engine (#22), Celografová omnisearch (#2), Counterfactual Chamber (#30), Data Releases (#38), Evidence cards (#6), Můj kraj (#10), Live-Graph Sentinel (#46), Poster Mode (#48).

## How this scan was run

Moonshot-architect role prompt from Vibeman registry (`agent_moonshot_architect`), Pipeline B bent per the moonshot adaptation: Tier×Feasibility×Horizon instead of severity, no baseline capture, group-level dispatch (9 subagents, strongest model), 2 proposals per context enforced. Shared brief: `_SCAN-BRIEF.md`. Counts verified two ways (per-file `### M` headers = reply tallies = 50).
