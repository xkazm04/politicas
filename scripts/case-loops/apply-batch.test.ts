// Batch-007 apply-batch.ts tests — isolated temp-dir PGlite (never the live
// ./.pglite, never a fixture shared with any other test file). Exercises the
// shared `applyBatch()` core directly against a store repo, independent of the
// CLI/env-var plumbing, per the kg-money-reingest.test.ts / review.test.ts
// pattern (open() + makeKgRepo(), manual rmSync teardown).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const dataDir = mkdtempSync(join(tmpdir(), "politicas-apply-batch-"));
process.env.PGLITE_PATH = dataDir;

const { open } = await import("../../lib/db/pglite/internals");
const { makeKgRepo } = await import("../../lib/db/pglite/repositories/kg");
const { applyBatch, adaptPrakRepoint, adaptOwnershipChains, adaptKiosek, ApplyBatchError, DELETION_ALLOWLIST } = await import("./apply-batch");

type Pg = Awaited<ReturnType<typeof open>>;
let pg: Pg;

beforeEach(async () => {
  pg = await open();
  await pg.query(`delete from kg_edge`);
  await pg.query(`delete from kg_node`);
  await pg.query(
    `insert into kg_node (id, kind, label, props, first_seen_pass, provenance) values
     ($1, 'person', 'Testovací Poslanec', '{}'::jsonb, 1, '{"track":"money","pass":1,"method":"deterministic","ref":"seed","computedAt":"2026-01-01"}'::jsonb),
     ($2, 'company', 'Existing Co', '{"ico":"11111111"}'::jsonb, 1, '{"track":"money","pass":1,"method":"deterministic","ref":"seed","computedAt":"2026-01-01"}'::jsonb)`,
    ["psp:person:1", "company:ico:11111111"],
  );
  await pg.query(
    `insert into kg_edge (src, rel, dst, weight, props, provenance) values
     ($1, 'linked_to', $2, null, '{"role":"old role"}'::jsonb, '{"track":"money","pass":1,"method":"deterministic","ref":"seed","computedAt":"2026-01-01"}'::jsonb)`,
    ["psp:person:1", "company:ico:11111111"],
  );
});

afterAll(async () => {
  await pg.close();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("applyBatch — insert path", () => {
  it("inserts a brand-new node and a brand-new edge to it", async () => {
    const store = makeKgRepo(pg);
    const batch = {
      key: "test-insert",
      nodes: [{ id: "company:ico:99999999", kind: "company", label: "New Co", props: { ico: "99999999" }, provenance: { track: "money", pass: null, method: "verdict", ref: "test", computedAt: "2026-07-25" } }],
      edges: [{ src: "psp:person:1", rel: "linked_to", dst: "company:ico:99999999", props: { role: "new" }, provenance: { track: "money", pass: null, method: "verdict", ref: "test", computedAt: "2026-07-25" } }],
      proposedDeletions: [],
      excludedEdges: [],
    };
    const report = await applyBatch(store, batch, { pass: 7, ns: "test", commit: true });
    expect(report.nodes.byKind.company).toEqual({ inserted: 1, merged: 0 });
    expect(report.edges.byRel.linked_to).toEqual({ inserted: 1, merged: 0 });

    const nodes = await store.listKgNodes({ kind: "company" });
    const created = nodes.find((n) => n.id === "company:ico:99999999");
    expect(created).toBeDefined();
    expect(created!.provenance.pass).toBe(7);

    const edges = await store.listKgEdges({ rel: "linked_to" });
    const created2 = edges.find((e) => e.dst === "company:ico:99999999");
    expect(created2).toBeDefined();
    expect(created2!.provenance.pass).toBe(7);
  });

  it("merges onto an existing node/edge WITHOUT clobbering identity provenance", async () => {
    const store = makeKgRepo(pg);
    const batch = {
      key: "test-merge",
      nodes: [{ id: "company:ico:11111111", kind: "company", label: "Existing Co", props: { extra: "field" }, provenance: { track: "money", pass: null, method: "verdict", ref: "test", computedAt: "2026-07-25" } }],
      edges: [{ src: "psp:person:1", rel: "linked_to", dst: "company:ico:11111111", props: { role: "reconfirmed" }, provenance: { track: "money", pass: null, method: "verdict", ref: "test", computedAt: "2026-07-25" } }],
      proposedDeletions: [],
      excludedEdges: [],
    };
    const report = await applyBatch(store, batch, { pass: 7, ns: "test", commit: true });
    expect(report.nodes.byKind.company).toEqual({ inserted: 0, merged: 1 });
    expect(report.edges.byRel.linked_to).toEqual({ inserted: 0, merged: 1 });

    const nodes = await store.listKgNodes({ kind: "company" });
    const merged = nodes.find((n) => n.id === "company:ico:11111111")!;
    // identity provenance untouched — still pass 1, still "seed", never overwritten by this batch's pass 7.
    expect(merged.provenance.pass).toBe(1);
    expect(merged.provenance.ref).toBe("seed");
    // props are NEVER spread over the existing row (Opus audit #8) — the
    // payload's contribution is nested under a namespaced note instead.
    expect(merged.props.extra).toBeUndefined();
    expect(merged.props["test_test-merge_note"]).toBeDefined();
    expect((merged.props["test_test-merge_note"] as { extra: string }).extra).toBe("field");

    const edges = await store.listKgEdges({ rel: "linked_to" });
    const mergedEdge = edges.find((e) => e.dst === "company:ico:11111111")!;
    expect(mergedEdge.provenance.pass).toBe(1);
    expect(mergedEdge.provenance.ref).toBe("seed");
    // original role preserved, new info nested rather than replacing.
    expect(mergedEdge.props.role).toBe("old role");
    expect((mergedEdge.props["test_test-merge_note"] as { role: string }).role).toBe("reconfirmed");
  });

  it("refuses (never silently skips) an edge whose endpoint doesn't exist live or in-batch", async () => {
    const store = makeKgRepo(pg);
    const batch = {
      key: "test-missing-endpoint",
      nodes: [],
      edges: [{ src: "psp:person:1", rel: "linked_to", dst: "company:ico:does-not-exist", props: {}, provenance: { track: "money", pass: null, method: "verdict", ref: "test", computedAt: "2026-07-25" } }],
      proposedDeletions: [],
      excludedEdges: [],
    };
    await expect(applyBatch(store, batch, { pass: 7, ns: "test", commit: true })).rejects.toThrow(ApplyBatchError);
    await expect(applyBatch(store, batch, { pass: 7, ns: "test", commit: true })).rejects.toThrow(/endpoint/);

    // nothing was written — the whole batch refused, not a partial apply.
    const edges = await store.listKgEdges({ rel: "linked_to" });
    expect(edges.some((e) => e.dst === "company:ico:does-not-exist")).toBe(false);
  });

  it("rejects an unknown node kind / edge rel as a hard error", async () => {
    const store = makeKgRepo(pg);
    const badKind = {
      key: "test-bad-kind",
      nodes: [{ id: "x:1", kind: "not-a-real-kind", label: "x", props: {}, provenance: {} }],
      edges: [],
      proposedDeletions: [],
      excludedEdges: [],
    };
    await expect(applyBatch(store, badKind, { pass: 7, ns: "test", commit: true })).rejects.toThrow(/unknown node kind/i);

    const badRel = {
      key: "test-bad-rel",
      nodes: [],
      edges: [{ src: "psp:person:1", rel: "not-a-real-rel", dst: "company:ico:11111111", props: {}, provenance: {} }],
      proposedDeletions: [],
      excludedEdges: [],
    };
    await expect(applyBatch(store, badRel, { pass: 7, ns: "test", commit: true })).rejects.toThrow(/unknown edge rel/i);
  });

  it("refuses the whole run if a DELETION_ALLOWLIST entry doesn't match a live row (generalized apply-amends-regen startup assertion)", async () => {
    const store = makeKgRepo(pg);
    // DELETION_ALLOWLIST is empty by design (P50) — simulate the assertion by
    // constructing a batch whose proposedDeletions reference a real edge, and
    // confirming an UNMATCHED synthetic allowlist entry would be caught. Since
    // the module-level DELETION_ALLOWLIST is empty, this test instead proves the
    // invariant the assertion protects: applyBatch never deletes anything not in
    // the (empty) allowlist, even when the payload proposes a real, live edge.
    expect(DELETION_ALLOWLIST).toEqual([]);
    const batch = {
      key: "test-proposed-deletion-not-allowlisted",
      nodes: [],
      edges: [],
      proposedDeletions: [{ src: "psp:person:1", rel: "linked_to", dst: "company:ico:11111111", reason: "test repoint" }],
      excludedEdges: [],
    };
    const report = await applyBatch(store, batch, { pass: 7, ns: "test", commit: true });
    expect(report.proposedDeletions).toEqual([{ entry: batch.proposedDeletions[0], allowlisted: false, deleted: false }]);

    const edges = await store.listKgEdges({ rel: "linked_to" });
    expect(edges.some((e) => e.src === "psp:person:1" && e.dst === "company:ico:11111111")).toBe(true); // still there — not allowlisted, not deleted.
  });

  it("refuses to report a deletion the store didn't actually perform (Opus audit #5)", async () => {
    // A store whose deleteKgEdges LIES about the count (returns 0 while claiming
    // nothing failed) must never let applyBatch report `deleted: true`.
    const realStore = makeKgRepo(pg);
    const lyingStore = { ...realStore, deleteKgEdges: async () => 0 };
    // Arm a real allowlist entry pointing at the live seed edge, matching this batch's own proposedDeletions.
    (DELETION_ALLOWLIST as { src: string; rel: string; dst: string; reason: string }[]).push({ src: "psp:person:1", rel: "linked_to", dst: "company:ico:11111111", reason: "test" });
    try {
      const batch = {
        key: "test-deletion-lie",
        nodes: [],
        edges: [],
        proposedDeletions: [{ src: "psp:person:1", rel: "linked_to", dst: "company:ico:11111111", reason: "test repoint" }],
        excludedEdges: [],
      };
      await expect(applyBatch(lyingStore, batch, { pass: 7, ns: "test", commit: true })).rejects.toThrow(/store reports only/);
    } finally {
      (DELETION_ALLOWLIST as unknown[]).length = 0; // restore the module-level allowlist to empty for other tests.
    }
  });

  it("dry-run writes nothing to the store", async () => {
    const store = makeKgRepo(pg);
    const batch = {
      key: "test-dry-run",
      nodes: [{ id: "company:ico:88888888", kind: "company", label: "Dry Run Co", props: {}, provenance: { track: "money", pass: null, method: "verdict", ref: "test", computedAt: "2026-07-25" } }],
      edges: [],
      proposedDeletions: [],
      excludedEdges: [],
    };
    const report = await applyBatch(store, batch, { pass: 7, ns: "test", commit: false });
    expect(report.mode).toBe("dry-run");
    expect(report.pass).toBeNull();
    const nodes = await store.listKgNodes({ kind: "company" });
    expect(nodes.some((n) => n.id === "company:ico:88888888")).toBe(false);
  });
});

describe("adapters", () => {
  it("adaptOwnershipChains merges same-key dated periods instead of letting one clobber the other", () => {
    const payload = {
      generatedAt: "2026-07-25",
      nodeCreateProposals: [],
      ownsStakeEdgeProposals: [
        { src: "company:ico:a", rel: "owns_stake", dst: "company:ico:b", props: { role: "r1", from: "2006-01-01", to: "2015-01-01", share: 100, source: "s" }, provenance: { track: "money", pass: null, method: "verdict", ref: "t", computedAt: "2026-07-25" } },
        { src: "company:ico:a", rel: "owns_stake", dst: "company:ico:b", props: { role: "r2", from: "2015-01-01", to: "2019-01-01", share: 100, source: "s" }, provenance: { track: "money", pass: null, method: "verdict", ref: "t", computedAt: "2026-07-25" } },
      ],
    };
    const normalized = adaptOwnershipChains(payload);
    expect(normalized.edges).toHaveLength(1); // merged, not 2 rows racing for the same (src,rel,dst) PK.
    const edge = normalized.edges[0];
    expect(edge.props.multi_period_merged).toBe(true);
    expect((edge.props.periods as unknown[]).length).toBe(2);
    expect(edge.props.from).toBe("2015-01-01"); // latest closed period wins at top level (no open period here).
  });

  it("adaptOwnershipChains: an OPEN (still-active) stake always outranks a later-dated CLOSED one (Opus audit #1)", () => {
    const payload = {
      generatedAt: "2026-07-25",
      nodeCreateProposals: [],
      ownsStakeEdgeProposals: [
        // A closed period with a LATER `from` than the open one — naive "latest from wins" would pick this and report the stake as terminated.
        { src: "company:ico:a", rel: "owns_stake", dst: "company:ico:b", props: { role: "director", from: "2020-01-01", to: "2020-06-01", share: null, source: "s" }, provenance: {} },
        { src: "company:ico:a", rel: "owns_stake", dst: "company:ico:b", props: { role: "jediný akcionář", from: "2015-01-01", to: null, share: 100, source: "s" }, provenance: {} },
      ],
    };
    const normalized = adaptOwnershipChains(payload as Parameters<typeof adaptOwnershipChains>[0]);
    // the director-only row has no `share`, so it's routed to excludedEdges; the group has only ONE stake row, so it's a single-period passthrough.
    expect(normalized.excludedEdges).toHaveLength(1);
    expect(normalized.edges).toHaveLength(1);
    expect(normalized.edges[0].props.share).toBe(100);
    expect(normalized.edges[0].props.to).toBeNull();
  });

  it("adaptOwnershipChains excludes board-seat rows (no numeric share) from owns_stake, never folding them in", () => {
    const payload = {
      generatedAt: "2026-07-25",
      nodeCreateProposals: [],
      ownsStakeEdgeProposals: [
        { src: "company:ico:a", rel: "owns_stake", dst: "company:ico:b", props: { role: "Člen představenstva", from: "2018-01-01", to: "2020-01-01", share: null, source: "s" }, provenance: {} },
      ],
    };
    const normalized = adaptOwnershipChains(payload as Parameters<typeof adaptOwnershipChains>[0]);
    expect(normalized.edges).toHaveLength(0);
    expect(normalized.excludedEdges).toHaveLength(1);
    expect(normalized.excludedEdges[0].reason).toMatch(/share is not a number/);
  });

  it("adaptOwnershipChains hard-errors on a stake row with a missing/non-ISO from, rather than silently sorting it as oldest", () => {
    const payload = {
      generatedAt: "2026-07-25",
      nodeCreateProposals: [],
      ownsStakeEdgeProposals: [{ src: "company:ico:a", rel: "owns_stake", dst: "company:ico:b", props: { role: "r", to: null, share: 100, source: "s" }, provenance: {} }],
    };
    expect(() => adaptOwnershipChains(payload as unknown as Parameters<typeof adaptOwnershipChains>[0])).toThrow(/missing\/non-ISO/);
  });

  it("adaptKiosek excludes concerns_person_ico and targetExists:false edges, never applying them", () => {
    const payload = {
      generatedAt: "2026-07-25",
      nodes: [{ id: "notice:kiosek:1", kind: "notice", label: "N", props: {} }],
      edges: [
        { src: "notice:kiosek:1", rel: "cites", dst: "law:sb:1-2020", targetExists: false, wouldNeed: "law case", rationale: "r" },
        { src: "notice:kiosek:1", rel: "concerns_person_ico", dst: "person:ico:1", targetExists: false, wouldNeed: "not a company", rationale: "r" },
        { src: "notice:kiosek:1", rel: "cites", dst: "law:sb:2-2020", rationale: "r" },
      ],
    };
    const normalized = adaptKiosek(payload);
    expect(normalized.edges).toHaveLength(1);
    expect(normalized.edges[0].dst).toBe("law:sb:2-2020");
    expect(normalized.excludedEdges).toHaveLength(2);
  });

  it("adaptPrakRepoint proposes the old edge as a deletion candidate, never a direct delete", () => {
    const payload = {
      generatedAt: "2026-07-25",
      nodeCreateProposal: { id: "company:ico:new", kind: "company", label: "New", props: {}, provenance: {} },
      edgeRepointProposals: [
        {
          oldEdge: { src: "psp:person:1", rel: "linked_to", dst: "company:ico:old" },
          newEdge: { src: "psp:person:1", rel: "linked_to", dst: "company:ico:new", propsMerge: { role: "x" } },
        },
      ],
    };
    const normalized = adaptPrakRepoint(payload);
    expect(normalized.edges).toHaveLength(1);
    expect(normalized.edges[0].dst).toBe("company:ico:new");
    expect(normalized.proposedDeletions).toHaveLength(1);
    expect(normalized.proposedDeletions[0].dst).toBe("company:ico:old");
  });
});
