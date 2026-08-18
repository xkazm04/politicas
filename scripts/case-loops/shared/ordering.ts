/* Total-order comparators for the deterministic case-loop triages.
 *
 * A triage sort that ranks on the score ALONE is not a total order: two units
 * with an equal computed score fall back to input-array order, so which one
 * lands on a sliced batch boundary (top-N / bottom-N / army fill) — and the
 * rank/batch that gets PERSISTED to ledger.json off that position — silently
 * reshuffles when an upstream read reorders its rows, with no code change.
 *
 * `byScoreThenId` breaks every such tie on a stable node identity, so batch
 * membership and persisted rank are reproducible run-to-run regardless of the
 * order the rows arrived in (the stable-identity law). Same discipline the
 * money loop's `reviewRank` and the stake-winner tiebreak already use.
 */

/**
 * Descending by `score`, ties broken ASCENDING by a stable `id` (numeric ids
 * compare numerically, string ids by locale-independent code-unit order). The
 * result is a TOTAL order: equal-score rows always resolve the same way no
 * matter their input position.
 */
export function byScoreThenId<T>(
  score: (x: T) => number,
  id: (x: T) => number | string,
): (a: T, b: T) => number {
  return (a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    const ia = id(a);
    const ib = id(b);
    if (typeof ia === "number" && typeof ib === "number") return ia - ib;
    return String(ia) < String(ib) ? -1 : String(ia) > String(ib) ? 1 : 0;
  };
}
