# Cluster: bloc × theme — PSP10

Per-cluster note for [[frontier]] **F11** (pass 4, 2026-07-23). **Fully deterministic**
— it fuses pass-2 blocs ([[cluster-blocs]], `belongs_to`) + pass-3 themes
([[cluster-themes]], `about`) + the raw ballots. No LLM; the computation *is* the
finding, so there is no verdict to gate (trusted by construction, like the pass-1 seed).
The graph write enriches each `theme` node's props with contestedness (its own nested
deterministic provenance; the node's identity provenance stays `verdict`). See [[graph-log]].

**Metric.** For each theme's non-voided votes: each bloc's majority position;
`opposed_fraction` = share of votes where the two blocs' majorities differ (the
battleground measure). `bloc_support` = pooled yes/(yes+no) of the bloc's positional
ballots on the theme. Blocs: **A = `bloc:ano2011-spd-ms`**, **B = `bloc:ods-stan-pirati-kdu-top09`**.

## Finding — the chamber is polarized on nearly everything

| theme | opposed | votes | A support | B support | class |
|---|---|---|---|---|---|
| Fiscal & Budget | **0.913** | 276 | 0.18 | 0.92 | contested |
| Government Confidence | 0.889 | 18 | 0.29 | 0.88 | contested |
| Parliamentary Procedure | **0.763** | 803 | 0.38 | 0.90 | contested |
| Civil Service & Public Admin | 0.661 | 62 | 0.64 | 0.72 | contested |
| Housing & Construction | 0.658 | 199 | 0.40 | 0.81 | contested |
| Animal Welfare & Environment | 0.60 | 25 | 0.65 | 0.86 | contested |
| Social & Health | 0.587 | 75 | 0.54 | 0.94 | contested |
| Oversight & Interpellations | 0.50 | 12 | 0.65 | 0.95 | contested |
| Justice & Criminal Law | 0.44 | 9 | 0.68 | 0.97 | mixed |
| EU Transposition (digital/transport) | 0.375 | 16 | 0.81 | 0.80 | mixed |
| Financial-Market Regulation | 0.364 | 33 | 0.73 | 0.91 | mixed |
| Public Appointments | 0.291 | 55 | 0.88 | 0.64 | mixed |
| State Honours & Symbolic | 0.215 | 177 | 0.86 | 0.97 | mixed |

> **⟳ Re-scored at pass 11 (F18)** over the full 179-subject coverage — the `kg_node` props now
> hold the updated values. Headline unchanged (fiscal 0.87, procedure 0.72); most themes drifted
> slightly down; `oversight-interpellations` crossed to **mixed** (0.348, [[contradictions]] C3);
> the new `foreign-affairs-treaties` is **consensus** (0.133). Now 7 of 14 themes contested.
> The table above is the original pass-4 (head-47) computation, kept for the audit trail.

- **8 of 13 themes are contested** (blocs on opposite sides a majority of the time);
  **none is a true consensus zone** — the least-contested (state honours, 0.215) still
  splits the blocs a fifth of the time.
- **The budget is the sharpest battleground** (0.913): bloc B supports it (0.92), bloc A
  opposes (0.18). Government-confidence (0.889) and procedure (0.763) follow.
- **Even procedure is partisan.** Agenda-setting ("Pořad schůze") is a battleground, not
  neutral housekeeping — bloc B carries the agenda (0.90 support), bloc A resists (0.38).
- **Consensus is technical, not political.** The lowest-opposition themes are symbolic
  honours, appointments, EU-transposition and financial-market technicalities — never a
  core policy domain.

## Directional read (⚠ CORRECTED at pass 6 — see [[contradictions]] C2)

Across budget, confidence, and agenda votes bloc **B** (ODS-STAN-Piráti-KDU-ČSL-TOP09)
is consistently in the *supporting* position and bloc **A** (ANO-SPD-MS) opposes.

> **⚠ This pass read that as "bloc B holds governing control" — WRONG.** Pass 6 (F17,
> [[cluster-agenda-control]]) measured *win-rate* and found **bloc A** (the 114-seat
> majority) controls the chamber (wins ~0.99 of decisive votes from Jan 2026). Bloc B
> *supports* the outgoing government's FY2026 budget and **loses** — the signature of an
> **opposition**, not a government. **Support ≠ control.** Bloc A governs; bloc B is the
> losing opposition.

## Self-correction (→ [[contradictions]])

This **refutes pass-3's premise** (F14 / opportunity O5) that procedure is low-signal
"process churn" to hide. Procedure is one of the *most* contested themes — hiding it
would bury a major partisan battleground. O5 is revised accordingly; F14 is answered
(refuted). This is the flywheel's contradiction-detection (§7) working on the first
re-touch of a prior finding.
