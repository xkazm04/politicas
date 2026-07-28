// Souboj (head-to-head) — the two comparison rules, as pure functions, because both
// were getting them wrong in ways that STATED SOMETHING FALSE about the data.
//
//  1. A zero difference is not a lead. `leader = diff >= 0 ? a : b` declared the
//     left-hand MP the winner of a dead heat and printed "vede o 0,0 b kompozitu"
//     — 36 of the 21 321 possible pairs tie exactly on the published index.
//  2. A component is only won where the two sides differ. The duel used to print a
//     ROUNDED integer while colouring the winner from the unrounded value, so 672
//     of 127 926 component cells showed the same number on both sides with one of
//     them painted as the winner.
//
// Both are display rules over numbers the graph already carries — nothing here
// recomputes, reweights or re-rounds the index.

/** Which side leads the composite, or neither. */
export type DuelOutcome<T> = { tied: true; leader: null; diff: 0 } | { tied: false; leader: T; diff: number };

/**
 * Compare two composites. `diff` is the ABSOLUTE gap at the precision the index is
 * published to (one decimal); a gap that rounds to zero is a tie, not a win by a
 * hair the number does not carry.
 */
export function duelOutcome<T extends { score: number }>(a: T, b: T): DuelOutcome<T> {
  const diff = Math.round((a.score - b.score) * 10) / 10;
  if (diff === 0) return { tied: true, leader: null, diff: 0 };
  return { tied: false, leader: diff > 0 ? a : b, diff: Math.abs(diff) };
}

/**
 * Which side (if either) wins one component. Compares the values that are actually
 * PRINTED — component points are published to one decimal, so this is the same
 * comparison a reader makes with their eyes.
 */
export function componentWinner(pointsA: number, pointsB: number): "a" | "b" | null {
  if (pointsA === pointsB) return null;
  return pointsA > pointsB ? "a" : "b";
}
