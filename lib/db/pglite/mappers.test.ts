/**
 * The row mappers are the ONE place a Postgres row becomes a typed row, and until
 * 2026-09-02 they were the largest untested module in lib/db (243 lines, 10 mappers —
 * docs/architect/decisions/2026-07-26-loader-test-coverage.md, "mappers" was step 4).
 *
 * Two things are pinned here, and they are different kinds of claim:
 *
 * 1. COLS ↔ MAPPER PARITY. Every table is "one pair (COLS + map)" — the column
 *    array an upsert binds against and the mapper a read goes through. Nothing
 *    kept the two in step: a column added to the array but not to the mapper is
 *    written and never read back; a key the mapper reads that the array does not
 *    bind is always undefined and coerces silently (num → 0, str → ""). The parity
 *    check is mechanical: the mapper's output keys must be exactly the camel-case
 *    of the array, no more, no less.
 *
 * 2. COERCION IS TOTAL AND HONEST. PGlite hands back numbers as numbers or numeric
 *    strings, dates as Date or string, jsonb as object or string; a mapper must
 *    accept every shape and never throw — one throw becomes `null` in a loader and
 *    `null` becomes the labelled mock on a public surface (the `'infinity'` timestamp
 *    that blanked a whole dossier, memory/infinity-timestamp-collapses-a-whole-surface).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ABSENCE_COLS,
  BALLOT_COLS,
  KG_EDGE_COLS,
  KG_NODE_COLS,
  MANDATE_COLS,
  MEMBERSHIP_COLS,
  ORGAN_COLS,
  PERSON_COLS,
  RELEASE_COLS,
  VOTE_EVENT_COLS,
  mapAbsence,
  mapBallot,
  mapKgEdge,
  mapKgNode,
  mapMandate,
  mapMembership,
  mapOrgan,
  mapPerson,
  mapRelease,
  mapVoteEvent,
} from "./mappers";

const camel = (col: string): string => col.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** A row where every column carries a value the mapper cannot mistake for absence. */
function fullRow(cols: readonly string[]): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const c of cols) r[c] = c === "raw" || c === "props" || c === "provenance" ? { c } : c === "kind" ? "member" : "1";
  return r;
}

const PAIRS: [string, readonly string[], (r: Record<string, unknown>) => object][] = [
  ["person", PERSON_COLS, mapPerson],
  ["organ", ORGAN_COLS, mapOrgan],
  ["mandate", MANDATE_COLS, mapMandate],
  ["membership", MEMBERSHIP_COLS, mapMembership],
  ["vote_event", VOTE_EVENT_COLS, mapVoteEvent],
  ["vote_ballot", BALLOT_COLS, mapBallot],
  ["absence", ABSENCE_COLS, mapAbsence],
  ["source_release", RELEASE_COLS, mapRelease],
  ["kg_node", KG_NODE_COLS, mapKgNode],
  ["kg_edge", KG_EDGE_COLS, mapKgEdge],
];

describe("COLS ↔ mapper parity — one pair per table, nothing written that is never read", () => {
  for (const [table, cols, map] of PAIRS) {
    it(`${table}: the mapper reads exactly the columns the upsert binds`, () => {
      const out = map(fullRow(cols));
      expect(Object.keys(out).sort()).toEqual(cols.map(camel).sort());
    });
  }

  it("every column array is unique and snake_case — a duplicate would double-bind a value", () => {
    for (const [table, cols] of PAIRS) {
      expect(new Set(cols).size, table).toBe(cols.length);
      for (const c of cols) expect(c, `${table}.${c}`).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe("coercion is total — every shape PGlite can hand back maps without throwing", () => {
  it("numeric strings become numbers; absent numbers become 0 (required) or null (optional)", () => {
    const p = mapPerson({ id: "x", psp_id: "42", name_full: "N", name_norm: "n", source: "s", source_url: "u" });
    expect(p.pspId).toBe(42);
    expect(p.ingestRunId).toBeNull();
    const e = mapKgEdge({ src: "a", rel: "r", dst: "b", weight: "0.75", props: null, provenance: null });
    expect(e.weight).toBe(0.75);
    expect(mapKgEdge({ src: "a", rel: "r", dst: "b" }).weight).toBeNull();
    expect(mapKgNode({ id: "n", kind: "k", label: "l" }).firstSeenPass).toBe(0);
  });

  it("dates: a Date becomes an ISO date/instant, a string is passed through, null stays null", () => {
    const d = new Date("2026-08-14T10:20:30.000Z");
    const p = mapPerson({ id: "x", psp_id: 1, birth_date: d, fetched_at: d, died_at: "2026-01-02", changed_at: null });
    expect(p.birthDate).toBe("2026-08-14");
    expect(p.fetchedAt).toBe("2026-08-14T10:20:30.000Z");
    expect(p.diedAt).toBe("2026-01-02");
    expect(p.changedAt).toBeNull();
    // A missing fetched_at is the empty string, never a throw — Provenance.fetchedAt is required.
    expect(mapBallot({ id: "b", vote_psp_id: 1, mandate_psp_id: 2, code: "A", choice: "yes" }).fetchedAt).toBe("");
  });

  it("an invalid Date ('infinity' from Postgres) maps to a string, never a RangeError", () => {
    const inf = new Date(Number.POSITIVE_INFINITY);
    expect(() => mapMembership({ id: "m", person_psp_id: 1, kind: "member", target_psp_id: 2, to_at: inf })).not.toThrow();
    expect(typeof mapMembership({ id: "m", person_psp_id: 1, kind: "member", target_psp_id: 2, to_at: inf }).toAt).toBe(
      "string",
    );
  });

  it("jsonb: an object is kept, a JSON string is parsed, garbage and arrays become {}", () => {
    expect(mapKgNode({ id: "n", kind: "k", label: "l", props: { a: 1 } }).props).toEqual({ a: 1 });
    expect(mapKgNode({ id: "n", kind: "k", label: "l", props: '{"a":1}' }).props).toEqual({ a: 1 });
    expect(mapKgNode({ id: "n", kind: "k", label: "l", props: "{not json" }).props).toEqual({});
    expect(mapKgNode({ id: "n", kind: "k", label: "l", props: [1, 2] }).props).toEqual({});
    expect(mapKgNode({ id: "n", kind: "k", label: "l" }).provenance).toEqual({});
  });

  it("booleans accept Postgres' 't'/'true'/1 and nothing else", () => {
    const row = (v: unknown) => mapAbsence({ id: "a", term_psp_id: 1, mandate_psp_id: 2, day: "2026-01-01", whole_day: v });
    expect(row("t").wholeDay).toBe(true);
    expect(row("true").wholeDay).toBe(true);
    expect(row(1).wholeDay).toBe(true);
    expect(row("f").wholeDay).toBe(false);
    expect(row(null).wholeDay).toBe(false);
    expect(row("yes").wholeDay).toBe(false);
  });
});

describe("mapMembership narrows `kind` and SAYS so", () => {
  afterEach(() => vi.restoreAllMocks());

  it("an unrecognized kind coerces to 'member' with one warning per distinct value, not one per row", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const base = { id: "m", person_psp_id: 1, target_psp_id: 2 };
    expect(mapMembership({ ...base, kind: "function" }).kind).toBe("function");
    expect(mapMembership({ ...base, kind: "member" }).kind).toBe("member");
    expect(mapMembership({ ...base, kind: "observer-2026-09-02" }).kind).toBe("member");
    expect(mapMembership({ ...base, kind: "observer-2026-09-02" }).kind).toBe("member");
    const ours = warn.mock.calls.filter((c) => String(c[0]).includes("observer-2026-09-02"));
    expect(ours).toHaveLength(1);
  });
});
