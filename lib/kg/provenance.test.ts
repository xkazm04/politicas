import { describe, expect, it } from "vitest";

import { INGESTED_SOURCES } from "@/lib/analysis/atlas";
import {
  assertProvenance,
  isKgProvenance,
  makeProvenance,
  PROVENANCE_KEYS,
  PROVENANCE_SOURCES,
  provenanceProblems,
  readProvenanceSource,
  UNKNOWN_SOURCE,
  withProvenance,
} from "./provenance";
import { PROP_REGISTRY } from "./propRegistry";

const valid = {
  source: "psp-tisky",
  ingest_run_id: 42,
  pass: 51,
  ref: "kg-compute:co_votes_with",
  writer: "kg-compute",
};

describe("the source vocabulary", () => {
  it("is the atlas's own list — never a second copy of it", () => {
    for (const s of INGESTED_SOURCES) expect(PROVENANCE_SOURCES).toContain(s.source);
    expect(PROVENANCE_SOURCES).toHaveLength(INGESTED_SOURCES.length + 1);
  });

  it("admits `unknown` as a first-class value, because a migration must never guess", () => {
    expect(isKgProvenance({ ...valid, source: UNKNOWN_SOURCE })).toBe(true);
  });

  it("refuses a plausible-looking source nobody declared", () => {
    const problems = provenanceProblems({ ...valid, source: "psp-tisky-2" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("not a declared INGESTED_SOURCES key");
  });
});

describe("provenanceProblems", () => {
  it("accepts a complete stamp", () => {
    expect(provenanceProblems(valid)).toEqual([]);
  });

  it("accepts a null run — a writer that opened none must not invent one", () => {
    expect(provenanceProblems({ ...valid, ingest_run_id: null })).toEqual([]);
  });

  it("names every problem rather than the first", () => {
    const problems = provenanceProblems({ source: 3, ingest_run_id: "x", pass: "51", ref: "", writer: " " });
    expect(problems).toHaveLength(5);
  });

  it.each([null, undefined, 7, "psp-tisky", ["psp-tisky"]])("refuses %p as a stamp", (bad) => {
    expect(isKgProvenance(bad)).toBe(false);
  });

  it("refuses a non-integer run id (a float is a bug, not a run)", () => {
    expect(provenanceProblems({ ...valid, ingest_run_id: 4.5 })).toHaveLength(1);
  });
});

describe("assertProvenance", () => {
  it("throws with the context named, so a writer's refusal says which row", () => {
    expect(() => assertProvenance({ ...valid, ref: "" }, "kg_edge supplies")).toThrow(
      /invalid provenance on kg_edge supplies/,
    );
  });

  it("passes a valid stamp through silently", () => {
    expect(() => assertProvenance(valid)).not.toThrow();
  });
});

describe("makeProvenance", () => {
  it("defaults the run to null and validates on the way out", () => {
    expect(makeProvenance({ source: "psp-tisky", pass: 1, ref: "r", writer: "w" })).toEqual({
      source: "psp-tisky",
      ingest_run_id: null,
      pass: 1,
      ref: "r",
      writer: "w",
    });
  });

  it("refuses to build a stamp nobody could score", () => {
    expect(() => makeProvenance({ source: "made-up", pass: 1, ref: "r", writer: "w" })).toThrow();
  });
});

describe("withProvenance", () => {
  it("PRESERVES the legacy keys — this contract is additive over history", () => {
    const merged = withProvenance(
      { method: "deterministic", computedAt: "2026-08-01T00:00:00.000Z", pass: 11 },
      makeProvenance({ source: "psp-tisky-law", pass: 51, ref: "psp-tisky", writer: "kg-legislation-ingest" }),
    );
    expect(merged.method).toBe("deterministic");
    expect(merged.computedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(merged.pass).toBe(51);
    expect(merged.source).toBe("psp-tisky-law");
  });

  it("tolerates a row that carried nothing", () => {
    expect(withProvenance(null, valid)).toEqual(valid);
  });
});

describe("readProvenanceSource", () => {
  it("reads a stamped row, and does not decide what absence means", () => {
    expect(readProvenanceSource({ source: "smlouvy-gov-cz" })).toBe("smlouvy-gov-cz");
    expect(readProvenanceSource({ pass: 4 })).toBeNull();
    expect(readProvenanceSource({ source: "  " })).toBeNull();
    expect(readProvenanceSource(null)).toBeNull();
  });
});

describe("the registry mirror", () => {
  it("declares exactly the five contract keys — the writers and the registry are one list", () => {
    expect(PROP_REGISTRY.provenance).toEqual([...PROVENANCE_KEYS].sort());
  });
});
