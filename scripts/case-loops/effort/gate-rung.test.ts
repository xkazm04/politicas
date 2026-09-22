// The one rule the effort gate enforces about REVIEW STATE: a batch may author
// the bottom rung and nothing above it.
//
// This is a pure-logic test of `verdictRungViolations` alone — the rest of
// gate.ts needs a store, which is exactly why the rule was written as an
// exported pure function rather than inline in the loop.

import { describe, expect, it } from "vitest";
import { verdictRungViolations } from "./gate";

describe("verdictRungViolations", () => {
  it("passes a proposal with no effort_provenance at all", () => {
    expect(verdictRungViolations({})).toEqual([]);
    expect(verdictRungViolations({ effort_provenance: { computedAt: "2026-07-24T00:00:00Z" } })).toEqual([]);
  });

  it("passes the rung merge-batch stamps", () => {
    expect(
      verdictRungViolations({
        effort_workhorse: true,
        effort_provenance: {
          computedAt: "2026-07-24T00:00:00Z",
          verdicts: { effort_workhorse: { review_state: "machine" } },
        },
      }),
    ).toEqual([]);
  });

  it("REFUSES a batch that arrives already claiming `verified`", () => {
    // The whole point of the door: a human raises the rung, leaving an audit
    // row. A payload cannot mint a human-confirmed label about a named person.
    const v = verdictRungViolations({
      effort_provenance: { verdicts: { effort_workhorse: { review_state: "verified" } } },
    });
    expect(v).toHaveLength(1);
    expect(v[0]).toContain("effort_workhorse");
    expect(v[0]).toContain('only "machine" may be authored by a batch');
  });

  it("refuses an invented `pending_review` too — pending means a human sent it back", () => {
    expect(
      verdictRungViolations({
        effort_provenance: { verdicts: { effort_low_score_reason: { review_state: "pending_review" } } },
      }),
    ).toHaveLength(1);
  });

  it("refuses a decided_by on the way in, even beside a legal `machine`", () => {
    const v = verdictRungViolations({
      effort_provenance: { verdicts: { effort_workhorse: { review_state: "machine", decided_by: "redakce" } } },
    });
    expect(v).toHaveLength(1);
    expect(v[0]).toContain("only the review door names a decider");
  });

  it("names every offending field, not just the first", () => {
    const v = verdictRungViolations({
      effort_provenance: {
        verdicts: {
          effort_workhorse: { review_state: "verified" },
          effort_low_score_reason: { review_state: "rejected" },
        },
      },
    });
    expect(v).toHaveLength(2);
  });

  it("reports a malformed verdict entry rather than skipping it", () => {
    expect(
      verdictRungViolations({ effort_provenance: { verdicts: { effort_workhorse: "machine" } } }),
    ).toEqual(["effort_workhorse — verdict entry is not an object"]);
  });
});
