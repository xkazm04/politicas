# Moonshot Execution — Batch Plan (35 accepted items, 7 batches of 5)

> Triage 2026-07-30: 35 accepted / 14 rejected ("not the priority now"). Vibeman scan `0a446d3e-7185-45e7-8d13-a567b71a27ca`.
> Each batch = 5 features developable in parallel (disjoint file surfaces), one design doc per batch,
> one builder subagent per item, orchestrator reviews + commits + gates per batch.
> Branch: `vibeman/moonshot-exec-2026-07-30` (off master `3431012`). Baseline: tsc 0 errors, 630/630 tests.

| # | Batch | Package narrative | Items |
|---|---|---|---|
| 1 | **Citizen Instruments** | The reader stops consuming and starts interrogating: re-weight the index, trace evidence paths, read real discipline, and take every figure away as a poster or exhibit. | Otevřený index · Trail Engine · Seismograf sněmovny · Poster Mode · Evidence cards |
| 2 | **Provenance & Trust** | Every rendered claim becomes a verifiable receipt, every review decision a public event, and unsourced claims become build errors. | Provenance Capsule · Tamper-Evident Ledger · Deník důkazů · Doctrine Compiler · Numbers That Testify |
| 3 | **The Daily Record** | The state gets a diary: daily provenance-stamped diffs, citable permalinks, time-sliced history. | Deník republiky (merged) · Evidence Permalinks · Bitemporal Graph · Data Releases · Kariérní spis |
| 4 | **Money** | Financial transparency at full depth: every municipality, budget-to-contract joins, computed vote collisions. | Every Town's Mirror · Municipal Money Trail · Vote-Collision Engine · Evidence Packet Compiler · Kolizní radar |
| 5 | **Legislation & Alignment** | The statute book gets authorship, voters get real-ballot alignment, the graph gets tripwires. | Paměť zákona · Volební kompas naruby · Civic seismograph · Tripwires · Můj kraj |
| 6 | **Ecosystem** | The discipline goes public: stdlib, lint plugin, claim gate, quality atlas. | czech-civic-data · eslint-plugin-civic-transparency · Civic Claim Gate · Open-Data Quality Atlas · Loop mission control |
| 7 | **Second Surfaces** | New audiences: personal civic inbox, citizen-weighted methodology, the press terminal, forensic lens. | Občanská schránka · Referendum o metodice · Newsroom Evidence Terminal · Forenzní režim · Live-Graph Sentinel |

Ordering rationale: Batch 1 front-loads weeks-horizon/high-feasibility reader-facing wins; Batch 2 builds the trust substrate later batches cite; Batch 3 depends on Bitemporal concepts introduced in B3 itself (Deník can start shallow); money/legislation depth in B4-5; outward-facing bets last.

Per-batch loop: design doc → 5 parallel builders (disjoint scopes, no git) → orchestrator review vs design doc → per-item commits → gates (tsc/lint/vitest vs baseline, next build) → wave doc + vault ledger updates → user checkpoint.
