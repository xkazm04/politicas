/*
 * [G5] The migration pass, dry-run on a FIXTURE that mirrors the shapes the live
 * graph actually carries — the five legacy stamps the seven writers left behind.
 *
 * The point of the fixture is the ratio it produces: how many rows the migration
 * can honestly attribute, and how many it must count as `unknown`. That second
 * number is the deliverable. A migration whose unknown count is zero would mean
 * it guessed.
 */

import { describe, expect, it } from "vitest";

import { UNKNOWN_SOURCE } from "@/lib/kg/provenance";
import {
  deriveRowProvenance,
  planBackfill,
  renderBackfillReport,
} from "./kg-provenance-backfill";

/** The legacy stamp shape every pre-contract writer produced. */
const legacy = (ref: string, pass = 11) => ({ pass, method: "deterministic", ref, computedAt: "2026-08-01T00:00:00Z" });

const FIXTURE_NODES = [
  { id: "psp:person:1", kind: "person", provenance: legacy("kg-compute:person", 50) },
  { id: "psp:person:2", kind: "person", provenance: legacy("kg-compute:person", 50) },
  { id: "psp:organ:1", kind: "party", provenance: legacy("kg-compute:party", 50) },
  { id: "psp:organ:2", kind: "organ", provenance: legacy("kg-compute:organ", 50) },
  { id: "bill:tisk:1", kind: "bill", provenance: legacy("psp-tisky") },
  { id: "law:1", kind: "law", provenance: legacy("psp-tisky") },
  { id: "company:ico:1", kind: "company", provenance: legacy("money-feed:hlidac+ares+registr-smluv", 24) },
  { id: "contract:1", kind: "contract", provenance: legacy("money-feed:hlidac+ares+registr-smluv", 24) },
  // The verdict-promoted interpretive layer: a target string, not a registry.
  { id: "bloc:1", kind: "bloc", provenance: { pass: 8, method: "verdict", ref: "bloc-discovery-batch-3" } },
  // And the genuinely unreconstructable: a row with no ref at all.
  { id: "theme:1", kind: "theme", provenance: {} },
];

const FIXTURE_EDGES = [
  { src: "psp:person:1", rel: "co_votes_with", dst: "psp:person:2", provenance: legacy("kg-compute:co_votes_with", 50) },
  { src: "psp:person:1", rel: "rebels_against", dst: "psp:organ:1", provenance: legacy("kg-compute:rebels_against", 50) },
  { src: "company:ico:1", rel: "supplies", dst: "contract:1", provenance: legacy("money-feed:x", 24) },
  { src: "psp:person:1", rel: "linked_to", dst: "company:ico:1", provenance: legacy("money-feed:x", 24) },
  { src: "bill:tisk:1", rel: "amends", dst: "law:1", provenance: legacy("psp-tisky") },
  { src: "bloc:1", rel: "about", dst: "theme:1", provenance: { pass: 8, ref: "bloc-discovery-batch-3" } },
];

describe("[G5] what the backfill can derive", () => {
  it("resolves kg-compute's two landings apart — nodes off the register, edges off the ballots", () => {
    expect(deriveRowProvenance({ kind: "person", provenance: legacy("kg-compute:person") }).stamp.source).toBe(
      "psp-poslanci",
    );
    expect(
      deriveRowProvenance({ rel: "co_votes_with", provenance: legacy("kg-compute:co_votes_with") }).stamp.source,
    ).toBe("psp-hlasovani");
  });

  it("maps the legislation ingest's ref to the atlas key it was never the same as", () => {
    const d = deriveRowProvenance({ kind: "bill", provenance: legacy("psp-tisky") });
    expect(d.stamp).toMatchObject({ source: "psp-tisky-law", ref: "psp-tisky", writer: "kg-legislation-ingest" });
  });

  it("splits the money feed by kind and rel, because its ref alone is ambiguous", () => {
    const m = (scope: { kind?: string; rel?: string }) =>
      deriveRowProvenance({ ...scope, provenance: legacy("money-feed:x", 24) }).stamp.source;
    expect(m({ kind: "company" })).toBe("dataor-justice-cz");
    expect(m({ kind: "contract" })).toBe("smlouvy-gov-cz");
    expect(m({ rel: "supplies" })).toBe("smlouvy-gov-cz");
    expect(m({ rel: "linked_to" })).toBe("dataor-justice-cz");
    // A money-feed row of some other kind resolves to neither and is COUNTED.
    expect(m({ kind: "person" })).toBe(UNKNOWN_SOURCE);
  });

  it("carries the row's own pass and ref through rather than inventing a vintage", () => {
    const d = deriveRowProvenance({ kind: "person", provenance: legacy("kg-compute:person", 50) });
    expect(d.stamp.pass).toBe(50);
    expect(d.stamp.ref).toBe("kg-compute:person");
  });

  it("lands a ref no writer declares on `unknown`, and says so", () => {
    const d = deriveRowProvenance({ kind: "bloc", provenance: { pass: 8, ref: "bloc-discovery-batch-3" } });
    expect(d.outcome).toBe("unknown");
    expect(d.stamp.source).toBe(UNKNOWN_SOURCE);
    expect(d.why).toContain("never guessed");
  });

  it("does not repair a row with no stamp at all into something plausible", () => {
    const d = deriveRowProvenance({ kind: "theme", provenance: {} });
    expect(d.stamp).toMatchObject({ source: UNKNOWN_SOURCE, pass: 0, ref: "unreconstructed", writer: "unreconstructed" });
  });

  it("never attaches a run to a historical row — it would join a seal that never covered it", () => {
    expect(deriveRowProvenance({ kind: "person", provenance: legacy("kg-compute:person") }).stamp.ingest_run_id).toBeNull();
  });

  it("is a no-op over a row already under contract, unless asked to restamp", () => {
    const stamped = {
      source: "psp-poslanci",
      ingest_run_id: null,
      pass: 51,
      ref: "kg-compute:person",
      writer: "kg-compute",
    };
    expect(deriveRowProvenance({ kind: "person", provenance: stamped }).outcome).toBe("already-stamped");
    expect(deriveRowProvenance({ kind: "person", provenance: stamped }, { restamp: true }).outcome).toBe("derived");
  });
});

describe("[G5] the migration plan over the fixture", () => {
  const { report } = planBackfill(FIXTURE_NODES, FIXTURE_EDGES);

  it("attributes what is attributable and counts the rest", () => {
    expect(report.nodes).toEqual({ "already-stamped": 0, derived: 8, unknown: 2 });
    expect(report.edges).toEqual({ "already-stamped": 0, derived: 5, unknown: 1 });
  });

  it("groups the derived rows by the source they landed on", () => {
    expect(report.derivedBySource).toEqual(
      expect.arrayContaining([
        { source: "psp-poslanci", count: 4 },
        { source: "psp-tisky-law", count: 3 },
        { source: "psp-hlasovani", count: 2 },
        { source: "smlouvy-gov-cz", count: 2 },
        { source: "dataor-justice-cz", count: 2 },
      ]),
    );
  });

  it("groups the unknowns by the ref nobody could resolve — the burn-down list", () => {
    expect(report.unknownByRef).toEqual([
      { ref: "bloc-discovery-batch-3", count: 2 },
      { ref: "unreconstructed", count: 1 },
    ]);
  });

  it("prints the unknown count rather than folding it into a success line", () => {
    const text = renderBackfillReport(report, false);
    expect(text).toContain("DRY RUN");
    expect(text).toContain(`2 ${UNKNOWN_SOURCE}`);
    expect(text).toContain("the number to burn down, printed");
    expect(text).toContain("bloc-discovery-batch-3");
  });
});
