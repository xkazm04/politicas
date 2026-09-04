/*
 * [G5] The writers' half of the provenance contract, proven on a real store COPY.
 *
 * Two things are asserted here and nowhere else:
 *
 *  1. THE STAMP LANDS AND THE COLUMNS SEE IT. Every writer now builds
 *     {source, ingest_run_id, pass, ref, writer} through makeProvenance and
 *     refuses an unstamped write; the generated columns project it, so a row
 *     written by a writer is joinable to `ingest_run` and countable per source
 *     the moment it is written.
 *  2. THE MERGE-PRESERVING IDIOM SURVIVED THE CHANGE. Every one of these
 *     writers is on the list of scripts that once erased other passes' props
 *     (memory/kg-upsert-replaces-props.md: kg-compute wiped the whole effort
 *     layer off all 207 MPs). A provenance change touches the same object
 *     literal those bugs lived in, so a later-pass prop written before the
 *     stamped write is read back afterwards — on a store, not in a mock.
 *
 * The store is a COPY of the test template (lib/testing/pglite-fixture.ts). The
 * live `./.pglite` is never opened from here; the coordinator migrates it.
 */

import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";

import { pgliteFixtureDir } from "@/lib/testing/pglite-fixture";

const dataDir = pgliteFixtureDir("politicas-g5-writers-");
process.env.PGLITE_PATH = dataDir;

const { open, PGLITE_KEY } = await import("@/lib/db/pglite/internals");
const { makeKgRepo } = await import("@/lib/db/pglite/repositories/kg");
const { guardStampedRows, makeProvenance, UNKNOWN_SOURCE } = await import("@/lib/kg/provenance");
const { toRows } = await import("./kg-promote");
const { moneyGraphToKgRows } = await import("./kg-money-ingest");

afterAll(async () => {
  const g = globalThis as Record<string, unknown>;
  const held = g[PGLITE_KEY] as Promise<{ close(): Promise<void> }> | undefined;
  if (held) await held.then((pg) => pg.close());
  delete g[PGLITE_KEY];
  rmSync(dataDir, { recursive: true, force: true });
});

describe("[G5] what the writers stamp", () => {
  it("kg-promote refuses to invent a source and counts the verdict as unattributed instead", () => {
    const v = {
      target: "bloc:test",
      summary: "s",
      nodes: [{ id: "bloc:test:1", kind: "bloc", label: "L", rationale: "r" }],
      edges: [],
      patterns: [],
      featureOpportunities: [],
      frontier: [],
    };
    const unnamed = toRows(v as never, 7, "2026-09-04T00:00:00.000Z");
    expect(unnamed.nodes[0]!.provenance).toMatchObject({
      source: UNKNOWN_SOURCE,
      pass: 7,
      ref: "bloc:test",
      writer: "kg-promote",
      ingest_run_id: null,
    });
    // …and honours a named one when the operator can actually say.
    const named = toRows(v as never, 7, "2026-09-04T00:00:00.000Z", "psp-hlasovani");
    expect((named.nodes[0]!.provenance as { source: string }).source).toBe("psp-hlasovani");
    // The legacy keys are not dropped — this contract is additive over history.
    expect(named.nodes[0]!.provenance).toMatchObject({ method: "verdict" });
  });

  it("kg-money-ingest stamps per registry, because this feed lands rows from two", () => {
    const graph = {
      nodes: [
        { id: "company:ico:00000001", kind: "company" as const, label: "Co", props: { ico: "00000001" } },
        { id: "contract:x", kind: "contract" as const, label: "C", props: {} },
      ],
      edges: [
        { src: "company:ico:00000001", rel: "supplies" as const, dst: "contract:x", weight: 1, props: {} },
        { src: "psp:person:1", rel: "linked_to" as const, dst: "company:ico:00000001", weight: null, props: {} },
      ],
      stats: {},
    };
    const { nodes, edges } = moneyGraphToKgRows(graph as never, {
      pass: 9,
      computedAt: "2026-09-04T00:00:00.000Z",
      ref: "money-feed:test",
    });
    const sourceOf = (p: unknown) => (p as { source: string }).source;
    expect(sourceOf(nodes[0]!.provenance)).toBe("dataor-justice-cz"); // company → OR/ARES bulk
    expect(sourceOf(nodes[1]!.provenance)).toBe("smlouvy-gov-cz"); // contract → contract register
    expect(sourceOf(edges[0]!.provenance)).toBe("smlouvy-gov-cz"); // supplies
    expect(sourceOf(edges[1]!.provenance)).toBe("dataor-justice-cz"); // linked_to
    expect(nodes[0]!.provenance).toMatchObject({ writer: "kg-money-ingest", pass: 9, ingest_run_id: null });
  });

  it("carries an ingest run through when the writer opened one", () => {
    const { nodes } = moneyGraphToKgRows(
      { nodes: [{ id: "company:ico:2", kind: "company", label: "C", props: {} }], edges: [], stats: {} } as never,
      { pass: 9, computedAt: "2026-09-04T00:00:00.000Z", ref: "r", ingestRunId: 77 },
    );
    expect((nodes[0]!.provenance as { ingest_run_id: number }).ingest_run_id).toBe(77);
  });

  it("guardStampedRows refuses an unstamped write, and only the migration pass may pass", () => {
    const rows = [{ provenance: { pass: 1 } }];
    expect(() => guardStampedRows(rows, { label: "test writer" })).toThrow(/refusing to write row #0/);
    expect(guardStampedRows(rows, { label: "test writer", allowUnstamped: true })).toEqual({
      checked: 1,
      unstamped: 1,
    });
  });
});

describe("[G5] the merge-preserving idiom, on a store copy", () => {
  it("a later pass's props survive a stamped rewrite of the same node", async () => {
    const pg = await open();
    const kg = makeKgRepo(pg);
    const id = "psp:person:g5-merge";

    // Pass A: the origin writer creates the row, stamped.
    await kg.upsertKgNodes([
      {
        id,
        kind: "person",
        label: "G5",
        props: { contribution_score: 61 },
        firstSeenPass: 1,
        provenance: {
          ...makeProvenance({ source: "psp-poslanci", pass: 1, ref: "kg-compute:person", writer: "kg-compute" }),
        },
      },
    ]);

    // Pass B: an ENRICHMENT writer merges props and keeps the row's own stamp —
    // the idiom kg-contribution-ingest and persist-batch use.
    const stored = (await kg.listKgNodes({}))!.find((n) => n.id === id)!;
    await kg.upsertKgNodes([
      {
        ...stored,
        props: { ...stored.props, effort_tenure_class: "veteran" },
        provenance: stored.provenance,
      },
    ]);

    const after = (await kg.listKgNodes({}))!.find((n) => n.id === id)!;
    expect(after.props.contribution_score).toBe(61); // pass A survived pass B
    expect(after.props.effort_tenure_class).toBe("veteran");

    // And the generated columns read the stamp the origin writer set, not the
    // enrichment's — which is the point of not letting an enrichment claim origin.
    const { rows } = await pg.query<{ source: unknown; ingest_run_id: unknown }>(
      `select source, ingest_run_id from kg_node where id = $1`,
      [id],
    );
    expect(String(rows[0]!.source)).toBe("psp-poslanci");
    expect(rows[0]!.ingest_run_id).toBeNull();

    await pg.query(`delete from kg_node where id = $1`, [id]);
  });
});
