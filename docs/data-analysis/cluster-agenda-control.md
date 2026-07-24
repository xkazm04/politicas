# Cluster: agenda control over time — PSP10

Per-cluster note for [[frontier]] **F17** (pass 6, 2026-07-23). **Fully deterministic** —
crosses vote *dates* with the bloc split ([[cluster-blocs]]). No LLM. For each decisive
vote (outcome accepted/rejected), a bloc's majority is "winning" if it matches the
outcome; **win-rate** per bloc per month = who controls the chamber. The graph write adds
a `control_timeline` to the two bloc nodes. Blocs: **A = `bloc:ano2011-spd-ms`** (114 seats),
**B = `bloc:ods-stan-pirati-kdu-top09`** (93 seats).

## Finding — control never *shifted*; the *mode* did (consensus → majoritarian)

| month | votes | decisive | win A | win B | proc win B | note |
|---|---|---|---|---|---|---|
| 2025-11 | 113 | 113 | 1.00 | **0.91** | 0.89 | chamber opens — broad consensus |
| 2025-12 | — | — | — | — | — | recess (no votes) |
| 2026-01 | 171 | 171 | 0.99 | **0.40** | 0.27 | ◀ confidence vote — polarization begins |
| 2026-02 | 99 | 99 | 0.98 | 0.39 | 0.30 | |
| 2026-03 | 389 | 389 | 0.98 | 0.32 | 0.29 | |
| 2026-04 | 193 | 193 | 0.99 | 0.25 | 0.14 | |
| 2026-05 | 281 | 281 | 0.99 | 0.18 | 0.07 | opposition at its lowest |
| 2026-06 | 417 | 417 | 0.96 | 0.53 | 0.14 | partial consensus returns (overall, not agenda) |
| 2026-07 | 351 | 351 | 0.99 | 0.30 | 0.27 | |

- **Bloc A (the majority) controls throughout** — win-rate ~0.98 overall, never below 0.96.
  There is **no hand-over of control between blocs**.
- **The chamber flips from consensus to majoritarian rule** at the **Jan 2026 confidence
  vote**. November 2025 (opening) is broadly consensual — *both* blocs win ~everything
  (B at 0.91). From January, bloc B's win-rate collapses to ~0.2–0.5 (overall ~0.38) and its
  **agenda** win-rate falls further (proc win B 0.07–0.30): the majority sets the agenda and
  the opposition loses.
- The **June 2026** blip (B overall 0.53) is *overall*, not agenda (proc B still 0.14) —
  some cross-bloc substantive bills passed that month while agenda control stayed with A.

## Correction of pass 4 (→ [[contradictions]] C2)

This **corrects** the pass-4 directional read that "bloc B holds governing control."
By *win-rate*, **bloc A governs** (wins ~0.99); bloc B *supports* the outgoing caretaker
government's FY2026 budget and **loses** — the signature of an opposition, not a government.
**Support ≠ control.** Pass 4 measured who votes yes; F17 measures who wins.
