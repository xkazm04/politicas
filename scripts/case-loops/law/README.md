# `scripts/case-loops/law/` — durable tools vs archived probes

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

Resume state for the case: `docs/data-analysis/case-law/STATE.md`.

## Durable tools

| tool | what it does |
|---|---|
| `triage.ts` + `triage-core.ts` | forensic-severity ranking of the 141 bills |
| `prepare-batch.ts` | army inputs file for a batch |
| `gate-verdicts.ts` | `law-verdict.ts` gates over a payload before persist |
| `verify-close-reads.ts` | "two documents share text" claims must find the text in both |
| `collision-check.ts` + `collision-core.ts` | bill-pair collision detection |
| `amends-census.ts` · `amends-regen.ts` · `apply-amends-regen.ts` · `validate-amends-regen.ts` · `diff-amends-regen-deletions.ts` | amended-§ census pipeline |
| `esbirka-sparql-diff.ts` · `esbirka-versions.ts` | e-Sbírka point queries |
| `provenance-probe.ts` | EXPECT `{withF, laws, amends, passes}` at batch start/end |
| `company-sectors.ts` · `sector-attribution-para-017.ts`* | sector attribution |
| `build-bill-summaries.ts` · `build-cz-verdict-patch.ts` · `ingest-missing-laws.ts` | corpus builders |
| `inspect-hist.ts` · `inspect-votes.ts` | read-only inspectors |
| `ARMY-CONTRACT.md` | the brief every verdict agent receives |

\* kept top-level despite the suffix: it is the current attribution implementation.
