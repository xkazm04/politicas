// One test per rendered state. The banner and the graph footer used to be literals that
// the review console could falsify with a single click; these are the four cases the copy
// must have a sentence for.

import { describe, expect, it } from "vitest";
import { reviewSummary } from "./reviewSummary";

describe("reviewSummary — the phase the copy renders", () => {
  it("all-pending: nothing has been through the gate (the live store today, 211/211)", () => {
    const s = reviewSummary({ verified: 0, pending: 211, rejected: 0 });
    expect(s.phase).toBe("all-pending");
    expect(s.total).toBe(211);
    expect(s.decided).toBe(0);
  });

  it("mixed: one confirmation is enough to make the all-pending sentence false", () => {
    const s = reviewSummary({ verified: 1, pending: 210, rejected: 0 });
    expect(s.phase).toBe("mixed");
    expect(s.decided).toBe(1);
    expect(s.total).toBe(211);
  });

  it("mixed counts a REJECTION as decided too — rejected is terminal (D7), not pending", () => {
    const s = reviewSummary({ verified: 0, pending: 5, rejected: 2 });
    expect(s.phase).toBe("mixed");
    expect(s.decided).toBe(2);
    expect(s.total).toBe(7);
  });

  it("all-decided: the queue is empty, and the page may finally say so", () => {
    const s = reviewSummary({ verified: 8, pending: 0, rejected: 3 });
    expect(s.phase).toBe("all-decided");
    expect(s.decided).toBe(11);
    expect(s.total).toBe(11);
  });

  it("empty: no tie resolved at all — say nothing rather than '0 of 0 confirmed'", () => {
    expect(reviewSummary({ verified: 0, pending: 0, rejected: 0 }).phase).toBe("empty");
  });

  it("never counts a tie twice: decided + pending === total, in every case", () => {
    for (const c of [
      { verified: 0, pending: 211, rejected: 0 },
      { verified: 3, pending: 4, rejected: 5 },
      { verified: 9, pending: 0, rejected: 0 },
    ]) {
      const s = reviewSummary(c);
      expect(s.decided + s.pending).toBe(s.total);
      expect(s.total).toBe(c.verified + c.pending + c.rejected);
    }
  });
});
