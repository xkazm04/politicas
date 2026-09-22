import { describe, expect, it } from "vitest";

import { parseLabels } from "./semop";

const batch = [
  { id: "v1", title: "a" },
  { id: "v2", title: "b" },
  { id: "v3", title: "c" },
];

describe("parseLabels (2026-09-08, parity-auditor)", () => {
  it("a stated confidence is kept and clamped to 0..1", () => {
    const out = parseLabels('[{"id":"v1","match":true,"confidence":0.9},{"id":"v2","match":false,"confidence":7}]', batch);
    expect(out.map((l) => [l.id, l.match, l.confidence])).toEqual([
      ["v1", true, 0.9],
      ["v2", false, 1],
    ]);
  });

  it("a MISSING confidence is 0, not an invented 0.5 — the row escalates, like a row the model dropped", () => {
    // materialize-tags refuses such a row outright; here the cascade's contract is
    // "unstated certainty escalates", so the value is the floor, never a guess.
    const out = parseLabels('[{"id":"v1","match":true}]', batch);
    expect(out).toEqual([{ id: "v1", match: true, confidence: 0 }]);
  });

  it("an unparseable batch yields no labels (the caller fills the rows as confidence-0 negatives)", () => {
    expect(parseLabels("nonsense", batch)).toEqual([]);
  });
});
