import { describe, expect, it } from "vitest";
import {
  QUALITY_CRITERIA,
  parseAndValidateVerdict,
  validateVerdict,
  verdictJsonSchema,
  type AnalysisVerdict,
} from "./verdict";

function goodVerdict(): AnalysisVerdict {
  return {
    slice: "psp-hlasovani×PSP10×vote_event",
    rowsAnalyzed: 2030,
    quality: Object.fromEntries(
      QUALITY_CRITERIA.map((c) => [c, { score: 4, reason: "ok" }]),
    ) as AnalysisVerdict["quality"],
    composite: 4,
    entityGaps: [],
    miscategorized: [],
    patterns: ["short titles empty corpus-wide"],
    opportunities: [],
    backlog: [{ title: "add agency-fallback", kind: "data-quality", why: "coverage" }],
  };
}

describe("validateVerdict", () => {
  it("accepts a conforming verdict", () => {
    const r = validateVerdict(goodVerdict());
    expect(r.ok).toBe(true);
    expect(r.value?.slice).toContain("PSP10");
  });

  it("rejects an invented quality dimension (the sweep failure mode)", () => {
    const v = goodVerdict();
    (v.quality as Record<string, unknown>).accuracy = { score: 3, reason: "x" };
    const r = validateVerdict(v);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("accuracy"))).toBe(true);
  });

  it("rejects a score outside 1-5", () => {
    const v = goodVerdict();
    v.quality.volume = { score: 9, reason: "too big" };
    expect(validateVerdict(v).ok).toBe(false);
  });

  it("rejects a backlog kind outside the enum", () => {
    const v = goodVerdict();
    v.backlog = [{ title: "t", kind: "market" as never, why: "w" }];
    expect(validateVerdict(v).ok).toBe(false);
  });

  it("rejects a cited entityId that is not a row in the slice", () => {
    const v = goodVerdict();
    v.entityGaps = [{ entityId: "all 2030 rows", field: "titleShort", note: "empty" }];
    const r = validateVerdict(v, { knownEntityIds: ["psp:hlasovani:86327"] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("not an entity id"))).toBe(true);
  });

  it("accepts a cited entityId that IS a row in the slice", () => {
    const v = goodVerdict();
    v.entityGaps = [{ entityId: "psp:hlasovani:86327", field: "titleShort", note: "empty" }];
    expect(validateVerdict(v, { knownEntityIds: ["psp:hlasovani:86327"] }).ok).toBe(true);
  });

  it("collects ALL errors, not just the first", () => {
    const r = validateVerdict({ slice: "", rowsAnalyzed: -1, quality: {}, composite: 99 });
    expect(r.errors.length).toBeGreaterThan(2);
  });
});

describe("parseAndValidateVerdict", () => {
  it("extracts a fenced json block from prose", () => {
    const text = "Here is my verdict:\n```json\n" + JSON.stringify(goodVerdict()) + "\n```\nDone.";
    expect(parseAndValidateVerdict(text).ok).toBe(true);
  });
  it("reports no-block when there is no JSON", () => {
    expect(parseAndValidateVerdict("no json here").ok).toBe(false);
  });
});

describe("verdictJsonSchema", () => {
  it("locks the six criteria and forbids extra quality keys", () => {
    expect(verdictJsonSchema.properties.quality.required).toEqual([...QUALITY_CRITERIA]);
    expect(verdictJsonSchema.properties.quality.additionalProperties).toBe(false);
  });
});
