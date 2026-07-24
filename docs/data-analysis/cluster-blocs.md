# Cluster: voting blocs — PSP10

Per-cluster note for [[frontier]] **F1** (pass 2, 2026-07-23). Blocs are *named*
by a gated Sonnet subagent but *defined* by the deterministic co-voting matrix
(20 496 `co_votes_with` edges; positional yes/no basis, voided votes excluded).
The verdict is at `.kg-analysis/verdicts/F1.json`; it passed the gate
(`da:validate-kg-verdict`) against 11 072 known ids and was promoted to
`kg_node`/`kg_edge` at pass 2. See [[graph-log]], [[patterns]], [[graph-schema]].

## Finding — two blocs, cleanly separated

The eight clubs collapse into **exactly two blocs**, not eight independent actors.
Within-bloc club pairs score **0.913–0.985**; cross-bloc pairs score **0.369–0.457**
— a gap with *no intermediate cases* (highest cross-bloc ODS–SPD 0.457 vs lowest
within-bloc ODS–Piráti 0.913).

| bloc node | clubs | seats | intra-bloc agreement |
|---|---|---|---|
| `bloc:ano2011-spd-ms` | ANO2011 (84), SPD (16), MS (14) | **114** (majority) | 0.974–0.985 |
| `bloc:ods-stan-pirati-kdu-top09` | ODS (27), STAN (22), Piráti (19), KDU-ČSL (16), TOP09 (9) | 93 | 0.913–0.985 |

`belongs_to` edges (club → bloc) carry each club's mean intra-bloc agreement as
weight (ANO2011 0.984 … TOP09 0.968; ODS lowest at 0.933).

## Notable sub-structure (fed to the frontier)

- **ODS is the weakest-integrated coalition member** — mean intra-bloc 0.933 vs
  0.957–0.970 for the other four. Possible swing/sub-bloc position → spawned F8.
- **A perfect ANO2011↔MS core**: the four strongest cross-club MP pairs in the whole
  chamber (agreement **1.0** over 849–1090 shared votes) all link ANO2011 and MS —
  Okleštěk↔Barták, Krňanský↔Pařil, Okleštěk↔Krňanský, Klempíř↔Mrázová. Suggests a
  2+1 (ANO+MS core, SPD looser) structure → spawned F9.

## Caveat carried forward

Agreement bands may partly reflect near-unanimous procedural votes; whether the
two-bloc split *holds on contested (close) votes* is the highest-value open question
→ spawned F7 (and it dovetails with the CivicScore contested-rebellion hypothesis F3).
