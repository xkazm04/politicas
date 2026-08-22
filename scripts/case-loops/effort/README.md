# `scripts/case-loops/effort/` — durable tools vs archived probes

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

Resume state for the case: `docs/data-analysis/case-effort/STATE.md`.

## Durable tools

| tool | what it does |
|---|---|
| `triage.ts` · `roles-triage.ts` | contribution-outlier ranking vs club baselines |
| `gate.ts` | public-copy + committee-claims + score-citation gates over a payload |
| `extract-dossiers.ts` · `extract-role-inputs.ts` · `extract-q16-inputs.ts` | army inputs files |
| `merge-batch.ts` · `finalize-ledger.ts` | army outputs → payload → ledger |
| `measure-baseline.ts` · `tenure.ts` · `psp9-contribution.ts` · `rapporteur-load.ts` | deterministic substrate |
| `divergence-retune.ts` · `role-window-mismatch.ts` · `workhorse-flavour.ts` | signal calibration |
