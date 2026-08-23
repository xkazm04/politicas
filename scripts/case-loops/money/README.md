# `scripts/case-loops/money/` — durable tools vs archived probes

**Convention (2026-08-22 architecture review).** A case accumulated 25–70 one-off scripts
named by batch (`*-b14`, `*-0xx`, `pass42-*`), most dead the moment their batch closed.
The batch note captures the method and the JSON evidence captures the output, so a
probe's only remaining value is reproducibility — which git already provides.

- **Top level = durable tools**: things the NEXT batch will run again (triage, gates,
  verify, sweeps, ingest adapters, payload validators). Names carry no batch suffix.
- **`archive/` = batch probes**: one-shot diagnostics, kept runnable (relative imports
  repointed to `../`), never touched again. When a probe turns out to be reusable, it is
  renamed and moved up — that is how `legal-form-audit.ts`, `public-mandate-sweep.ts`,
  `ownership-depth2.ts` and `verify-surface.ts` got here.
- A new script starts at top level only if the batch note can say what the next batch
  will use it for; otherwise it is born in `archive/`.

Resume state for the case: `docs/data-analysis/case-money/STATE.md`.

## Durable tools

| tool | what it does |
|---|---|
| `triage.ts` | deterministic tie ranking → `ledger.json` / `triage-dump.json` (PGlite copy) |
| `reconcile-ares-vr.ts` · `reverify-open-vs-live-ares-vr.ts` | ARES VR period reconciliation of all ties (b002) |
| `public-mandate-sweep.ts` | ownership-based `public_mandate` verdict per attributable company (b015) |
| `ownership-sweep.ts` | the `owns_stake` layer at full population: `--plan`, then `--fetch-budget=N` (b017) |
| `ownership-depth2.ts` | company-axis verdict one hop up via `owns_stake`, dated outputs (b016–017) |
| `legal-form-audit.ts` | drift guard: legal-form tables vs the ARES číselník (b016) |
| `verify-surface.ts` | what `/penize` renders, through `getMoneyData()` itself |
| `validate-payloads.ts` | schema + membership gate for any money payload |
| `harvest-contract-dumps.ts` → `persist-contract-harvest.ts` | Registr smluv bulk-dump ingest (raw data in `data/raw/registr-smluv/`) |
| `dataor-corroborate.ts` | bulk OR export corroboration of ties (`dataor-ownership-chains.ts` → archived, superseded by `ownership-sweep.ts`) |
| `company-contract-sweep.ts` · `parent-contract-sweep.ts` · `agrofert-sweep.ts` | live Registr smluv sweeps (party-search) |
| `indirect-ownership-exposure.ts` · `indirect-ownership-breadth2.ts` | exposure through ownership parents |
| `supplies-coverage-audit.ts` · `reachable-metric-audit.ts` · `contract-corpus-snapshot.ts` | corpus census tools |
| `canonicalize-ico-nodes.ts` · `purge-osvc.ts` · `prak-repoint.ts` · `migrate-review-audit-check.ts` | one-time corrections kept because they document a rule |
| `kiosek-watch.ts` | úřední desky watch |

Write path (shared): `scripts/case-loops/persist-batch.ts --payload=… --pass=<n> --commit`.
