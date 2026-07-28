import { describe, expect, it } from "vitest";

import { componentWinner, duelOutcome } from "./duel";

describe("duelOutcome — a dead heat is not a lead", () => {
  const a = { score: 95.4, name: "Vesecká" };
  const b = { score: 95.4, name: "Malá" };

  it("reports a tie instead of crowning whichever MP was passed first", () => {
    const out = duelOutcome(a, b);
    expect(out.tied).toBe(true);
    expect(out.leader).toBeNull();
    expect(out.diff).toBe(0);
    // …and the answer does not depend on the argument order.
    expect(duelOutcome(b, a).tied).toBe(true);
  });

  it("names the real leader and the absolute gap when there is one", () => {
    const higher = { score: 95.4, name: "Vesecká" };
    const lower = { score: 90.6, name: "Šrámková" };
    expect(duelOutcome(lower, higher)).toEqual({ tied: false, leader: higher, diff: 4.8 });
    expect(duelOutcome(higher, lower)).toEqual({ tied: false, leader: higher, diff: 4.8 });
  });

  it("does not manufacture a lead out of float noise below the published precision", () => {
    expect(duelOutcome({ score: 70.1 }, { score: 70.1 + 1e-12 }).tied).toBe(true);
  });
});

describe("componentWinner — no winner where both sides print the same value", () => {
  it("returns null on equal points", () => {
    expect(componentWinner(13.3, 13.3)).toBeNull();
    expect(componentWinner(0, 0)).toBeNull();
  });

  it("returns the genuinely higher side", () => {
    expect(componentWinner(20, 13.3)).toBe("a");
    expect(componentWinner(13.3, 20)).toBe("b");
  });

  it("separates values that a whole-number display would have collapsed", () => {
    // 12,6 and 13,4 both printed "13" before, with one of them coloured as winner.
    expect(componentWinner(12.6, 13.4)).toBe("b");
  });
});
