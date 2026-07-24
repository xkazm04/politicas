# Contradictions — where a re-analysis disagreed with a stored finding

A distinct benefit of *writing knowledge back* (design §7): when a later pass
re-touches a node or re-derives an edge, diff the new finding against the stored
one and **log every disagreement here**. This catches data-refresh degradation and
model drift on a dataset that is otherwise static — a stored fact that a fresh pass
can no longer reproduce is a signal, not noise.

Each entry: the node/edge, the stored value, the new value, the pass that found the
disagreement, and the resolution (which won, and why). Append only.

See [[graph-log]] for what each pass added and [[coverage-ledger]] for the
reuse-rate / contradiction-rate metrics that quantify the flywheel.

---

## C1 — 2026-07-23 (pass 4) — "procedure is process churn" is refuted

- **Stored (pass 3):** [[patterns]] P5 + opportunity **O5** framed
  `theme:parliamentary-procedure` as low-signal "process churn" — the VoteTrack
  proposal was to *default-hide* it so citizens see policy, not repetition. The
  spawned hypothesis F14 predicted procedure votes would be near-unanimous.
- **New (pass 4, F11, deterministic):** procedure is one of the *most* contested
  themes — `opposed_fraction` **0.763** (bloc B carries the agenda at 0.90 support,
  bloc A resists at 0.38). Agenda control is a partisan battleground, not neutral
  housekeeping. See [[cluster-bloc-theme]].
- **Resolution:** the pass-4 deterministic result **wins** (it measures actual bloc
  positions; P5 inferred low-signal from raw vote *volume*, which conflated repetition
  with consensus). **F14 → answered (refuted).** **O5 revised:** VoteTrack should still
  separate procedure from policy for *volume* reasons, but must NOT hide it — it is a
  distinct partisan signal. Volume ≠ consensus is the lesson.

## C2 — 2026-07-23 (pass 6) — "bloc B holds governing control" is corrected

- **Stored (pass 4):** [[cluster-bloc-theme]]'s "directional read" inferred that **bloc B**
  (ODS-STAN-Piráti-KDU-ČSL-TOP09) held governing control this window, from its high
  *support* on budget/procedure/confidence.
- **New (pass 6, F17, deterministic):** by **win-rate** (whose majority matches the vote
  outcome), **bloc A** (ANO-SPD-MS, the 114-seat majority) controls the chamber — it wins
  ~0.99 of decisive votes from Jan 2026 on, while bloc B's win-rate collapses to ~0.2–0.5.
  See [[cluster-agenda-control]].
- **Resolution:** F17 **wins** — *support ≠ control*. Bloc B voted **yes** on the outgoing
  caretaker government's FY2026 budget and lost; the new bloc-A majority **rejected** it.
  High support with low win-rate is the signature of an opposition backing measures that
  fail. The pass-4 directional read is **revised** (bloc A governs; bloc B is the losing
  opposition). Lesson: measure control by *who wins*, not *who says yes*.

## C3 — 2026-07-23 (pass 11) — a borderline theme classification was sample-dependent

- **Stored (pass 4):** [[cluster-bloc-theme]] scored contestedness over the **47 head subjects
  only**. `oversight-interpellations` came out `opposed_fraction` **0.50 → "contested"**;
  [[patterns]] P9 said "8 of 13 themes contested."
- **New (pass 11, F18, full coverage):** re-scoring over all **179** themed subjects,
  `oversight-interpellations` is **0.348 → "mixed"** (12 → 23 scored votes). Most themes drifted
  slightly *down* as the more-consensual long tail (procedure/appointments) was added; oversight
  crossed the 0.5 line. Now **7 of 14 themes contested**.
- **Resolution:** F18 (fuller coverage) **supersedes** — the pass-4 numbers were correct *for the
  head sample* but a borderline theme (12 votes) was sample-sensitive. The headline finding is
  **unchanged** (fiscal-budget sharpest 0.87, procedure partisan 0.72, consensus only symbolic/
  technical). Lesson: report borderline classifications with their sample size; re-score on
  coverage change. (New: `foreign-affairs-treaties` scores 0.133 — treaty ratification is
  bipartisan **consensus**.)

