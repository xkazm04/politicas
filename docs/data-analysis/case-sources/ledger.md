# case-sources — cross-case ingest-adapter vault

Not a case loop in its own right (no unit ledger, no signal-yield triage) —
this folder holds handoffs for **new open-data source adapters** built under
the case-loops kernel's "Ingest authority" (`docs/case-loops.md`) that feed
MULTIPLE case loops at once, so they don't fit inside one case's own vault
(`docs/data-analysis/case-{money,effort,law}/`).

## Batches

| Batch | Source | Adapter | Feeds | Status |
|---|---|---|---|---|
| 006 | `kiosek.justice.cz/opendata` (national úřední desky) | `lib/ingest/sources/kiosek.ts` | Case ③ law (statute citations), Case ① money (unanonymized IČOs) | Slice built + Opus-verified; NOT applied to the graph (payload gated, pending `kg-verdict.ts` enum additions — see `handoff.md`) |

See `batch-006.md` for the full batch note and `handoff.md` for the
orchestrator-facing handoff (payloads, enum additions, commit plan).
