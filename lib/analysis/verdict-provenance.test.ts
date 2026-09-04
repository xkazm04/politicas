import { describe, expect, it } from "vitest";
import {
  EFFORT_VERDICT_FIELDS,
  effortVerdictDecider,
  effortVerdictState,
  isEffortVerdictField,
  readVerdictRung,
  rungKey,
  tallyVerdictRungs,
  type VerdictRung,
} from "./verdict-provenance";

/** A person node's props as the effort loop writes them. */
function node(verdicts: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    effort_workhorse: true,
    effort_low_score_reason: "late_mandate",
    effort_provenance: { computedAt: "2026-07-24T17:41:34.737Z", pass: 14, verdicts },
    ...extra,
  };
}

describe("the closed field vocabulary", () => {
  it("holds exactly the three verdict props that take the door", () => {
    expect([...EFFORT_VERDICT_FIELDS]).toEqual([
      "effort_low_score_reason",
      "effort_rapporteur_load",
      "effort_workhorse",
    ]);
  });

  it("excludes the prose fields — they ride the public-copy guard, not this door", () => {
    expect(isEffortVerdictField("effort_notes")).toBe(false);
    expect(isEffortVerdictField("effort_public_role")).toBe(false);
    expect(isEffortVerdictField("effort_workhorse")).toBe(true);
  });
});

describe("readVerdictRung", () => {
  it("returns null — NOT machine — when nothing was recorded for the prop", () => {
    // The load-bearing refusal: defaulting an unstamped prop to `machine` would
    // be a guess about provenance, printed as provenance.
    expect(readVerdictRung(node({}), "effort_workhorse")).toBeNull();
    expect(readVerdictRung({}, "effort_workhorse")).toBeNull();
    expect(readVerdictRung({ effort_provenance: null }, "effort_workhorse")).toBeNull();
    expect(readVerdictRung({ effort_provenance: { verdicts: [] } }, "effort_workhorse")).toBeNull();
  });

  it("reads the machine rung, and refuses to name a decider on it", () => {
    // Even if a stale decided_by survives on the entry, „strojově odvozeno" may
    // never be printed beside a person's name.
    const v = readVerdictRung(
      node({ effort_workhorse: { review_state: "machine", decided_by: "redakce", decided_at: "2026-08-01T00:00:00Z" } }),
      "effort_workhorse",
    );
    expect(v).toEqual({ rung: "machine", decidedBy: null, decidedAt: null, withholds: false });
  });

  it("reads verified with who and when", () => {
    const v = readVerdictRung(
      node({ effort_workhorse: { review_state: "verified", decided_by: "redakce", decided_at: "2026-09-04T08:00:00Z" } }),
      "effort_workhorse",
    );
    expect(v).toEqual({
      rung: "verified",
      decidedBy: "redakce",
      decidedAt: "2026-09-04T08:00:00Z",
      withholds: false,
    });
  });

  it("verified with no recorded decider still renders as verified, undated and unattributed", () => {
    const v = readVerdictRung(node({ effort_workhorse: { review_state: "verified" } }), "effort_workhorse");
    expect(v?.rung).toBe("verified");
    expect(v?.decidedBy).toBeNull();
    expect(v?.decidedAt).toBeNull();
  });

  it("maps the writer's `pending_review` onto the pending rung — a human looked and sent it back", () => {
    const v = readVerdictRung(node({ effort_workhorse: { review_state: "pending_review" } }), "effort_workhorse");
    expect(v?.rung).toBe("pending");
    expect(v?.withholds).toBe(false);
  });

  it("rejected WITHHOLDS — the surface must show a refusal, never nothing", () => {
    const v = readVerdictRung(
      node({ effort_workhorse: { review_state: "rejected", decided_by: "redakce" } }),
      "effort_workhorse",
    );
    expect(v?.rung).toBe("rejected");
    expect(v?.withholds).toBe(true);
    expect(v?.decidedBy).toBe("redakce");
  });

  it("an unrecognised stored state is not coerced into a rung", () => {
    // A value this module does not know is not a value it gets to interpret.
    expect(readVerdictRung(node({ effort_workhorse: { review_state: "schváleno" } }), "effort_workhorse")).toBeNull();
    expect(readVerdictRung(node({ effort_workhorse: { review_state: 7 } }), "effort_workhorse")).toBeNull();
  });

  it("is per-field: one prop's rung says nothing about its neighbour's", () => {
    const props = node({
      effort_workhorse: { review_state: "rejected" },
      effort_low_score_reason: { review_state: "machine" },
    });
    expect(readVerdictRung(props, "effort_workhorse")?.rung).toBe("rejected");
    expect(readVerdictRung(props, "effort_low_score_reason")?.rung).toBe("machine");
  });
});

describe("the raw readers the writer and the sentinel share", () => {
  it("effortVerdictState returns the stored string verbatim, unmapped", () => {
    expect(effortVerdictState(node({ effort_workhorse: { review_state: "pending_review" } }), "effort_workhorse")).toBe(
      "pending_review",
    );
  });

  it("effortVerdictDecider treats an empty decided_by as no decider", () => {
    expect(effortVerdictDecider(node({ effort_workhorse: { review_state: "verified", decided_by: "" } }), "effort_workhorse")).toBeNull();
  });

  it("effortVerdictDecider drops an empty decided_at rather than printing one", () => {
    const d = effortVerdictDecider(
      node({ effort_workhorse: { review_state: "verified", decided_by: "redakce", decided_at: "" } }),
      "effort_workhorse",
    );
    expect(d).toEqual({ by: "redakce", at: null });
  });
});

describe("rungKey", () => {
  it("gives every rung a key under shared.verdict.*", () => {
    const rungs: VerdictRung[] = ["machine", "pending", "verified", "rejected"];
    for (const r of rungs) expect(rungKey(r)).toBe(`shared.verdict.${r}`);
  });
});

describe("tallyVerdictRungs — a denominator, never a bare rate", () => {
  it("counts only the nodes that CARRY the claim", () => {
    // An MP with no workhorse verdict is not an ungated workhorse verdict.
    const nodes = [
      node({ effort_workhorse: { review_state: "machine" } }),
      node({ effort_workhorse: { review_state: "verified", decided_by: "r" } }),
      node({ effort_workhorse: { review_state: "rejected" } }),
      node({}), // carries the prop, no rung recorded
      { effort_low_score_reason: "x" }, // no workhorse claim at all
    ];
    expect(tallyVerdictRungs(nodes, "effort_workhorse")).toEqual({
      total: 4,
      unrecorded: 1,
      machine: 1,
      pending: 0,
      verified: 1,
      rejected: 1,
    });
  });

  it("an empty population is a zero total, not a division", () => {
    expect(tallyVerdictRungs([], "effort_workhorse")).toEqual({
      total: 0,
      unrecorded: 0,
      machine: 0,
      pending: 0,
      verified: 0,
      rejected: 0,
    });
  });
});
