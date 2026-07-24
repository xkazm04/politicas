import { describe, expect, it } from "vitest";
import {
  citedEntityUrns,
  kgVerdictJsonSchema,
  validateKgVerdict,
  type KgVerdict,
} from "./kg-verdict";

const KNOWN = ["psp:person:6790", "psp:person:6791", "psp:organ:174"];

function base(): KgVerdict {
  return {
    target: "F1: voting blocs over the co-voting matrix",
    summary: "A coalition bloc emerges from the co-voting matrix.",
    nodes: [
      { id: "bloc:coalition", kind: "bloc", label: "Vládní koalice", rationale: "Dense co-voting among coalition clubs." },
    ],
    edges: [
      { src: "psp:person:6790", rel: "belongs_to", dst: "bloc:coalition", weight: 0.94, rationale: "Agreement >0.9 with the bloc core." },
    ],
    patterns: [
      { statement: "The coalition votes as one on procedural motions.", evidence: "median agreement 0.95; e.g. psp:person:6790." },
    ],
    featureOpportunities: [
      { module: "VoteTrack", title: "Bloc discipline board", evidence: "belongs_to edges + cohesion", proposal: "Show bloc-level agreement, not just club." },
    ],
    frontier: [
      { kind: "expand-node", target: "themes the coalition bloc coheres on", why: "blocs found → ask what binds them", priority: 4 },
    ],
  };
}

describe("validateKgVerdict — happy path", () => {
  it("accepts a well-formed verdict whose endpoints are known or declared", () => {
    const r = validateKgVerdict(base(), { knownIds: KNOWN });
    expect(r.ok).toBe(true);
    expect(r.value?.nodes[0].id).toBe("bloc:coalition");
  });

  it("lets an edge point at a node the same verdict declares (a brand-new bloc)", () => {
    // bloc:coalition is NOT in KNOWN, only declared in nodes[] — still valid.
    expect(validateKgVerdict(base(), { knownIds: KNOWN }).ok).toBe(true);
  });
});

describe("validateKgVerdict — the membership gate (fabrication)", () => {
  it("rejects an edge endpoint that is neither known nor declared", () => {
    const v = base();
    v.edges[0].src = "psp:person:999999"; // not a real MP
    const r = validateKgVerdict(v, { knownIds: KNOWN });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("999999") && e.includes("fabricated"))).toBe(true);
  });

  it("rejects a hallucinated MP urn cited only in prose", () => {
    const v = base();
    v.patterns.push({ statement: "MP X always rebels.", evidence: "see psp:person:888888" });
    const r = validateKgVerdict(v, { knownIds: KNOWN });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("888888") && e.includes("hallucinated"))).toBe(true);
  });

  it("skips id checks entirely when no knownIds are supplied (schema-only mode)", () => {
    const v = base();
    v.edges[0].src = "psp:person:999999";
    expect(validateKgVerdict(v).ok).toBe(true);
  });
});

describe("validateKgVerdict — shape enforcement", () => {
  it("rejects an invented top-level key", () => {
    const v = { ...base(), notes: "extra" };
    const r = validateKgVerdict(v, { knownIds: KNOWN });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("notes") && e.includes("unexpected key"))).toBe(true);
  });

  it("rejects a missing required section", () => {
    const v = base() as Partial<KgVerdict>;
    delete v.frontier;
    const r = validateKgVerdict(v, { knownIds: KNOWN });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("frontier") && e.includes("missing"))).toBe(true);
  });

  it("rejects an out-of-vocabulary node kind, edge rel, module, and frontier kind", () => {
    const bad = base();
    bad.nodes[0].kind = "faction" as never;
    bad.edges[0].rel = "friends_with" as never;
    bad.featureOpportunities[0].module = "Overview" as never;
    bad.frontier[0].kind = "explore" as never;
    const r = validateKgVerdict(bad, { knownIds: KNOWN });
    expect(r.ok).toBe(false);
    expect(r.errors.filter((e) => e.includes("expected one of")).length).toBe(4);
  });

  it("rejects a non-numeric edge weight and an out-of-range priority", () => {
    const v = base();
    (v.edges[0] as { weight: unknown }).weight = "0.9";
    v.frontier[0].priority = 9;
    const r = validateKgVerdict(v, { knownIds: KNOWN });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("weight"))).toBe(true);
    expect(r.errors.some((e) => e.includes("priority"))).toBe(true);
  });
});

describe("citedEntityUrns", () => {
  it("extracts distinct psp urns from anywhere in the verdict, ignoring derived ids", () => {
    const urns = citedEntityUrns(base());
    expect(urns).toContain("psp:person:6790");
    expect(urns).not.toContain("bloc:coalition");
  });
});

describe("kgVerdictJsonSchema", () => {
  it("locks every object with additionalProperties:false (no invented fields)", () => {
    expect(kgVerdictJsonSchema.additionalProperties).toBe(false);
    expect(kgVerdictJsonSchema.properties.nodes.items.additionalProperties).toBe(false);
    expect(kgVerdictJsonSchema.properties.edges.items.additionalProperties).toBe(false);
  });
});
