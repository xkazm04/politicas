import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Live-Graph Sentinel (batch-7 item 7E) — every invariant proven BOTH ways
// against fixture stores: a clean seeded store passes, then each targeted
// corruption makes exactly its invariant fire. Same isolation discipline as
// leaderboard-loader.test.ts: isolated PGLITE_PATH tmpdir set BEFORE any
// import that reaches open() (which memoises on globalThis).
const dataDir = mkdtempSync(join(tmpdir(), "politicas-sentinel-test-"));
process.env.PGLITE_PATH = dataDir;

const { open } = await import("../../db/pglite/internals");
const { GENESIS_HASH, computeAuditRowHash } = await import("../../db/pglite/ledger");
const { collectSentinelFacts } = await import("./facts");
const {
  evaluateSentinel,
  sampleForRecompute,
  unevaluableSentinelReport,
  RECOMPUTE_SAMPLE_SIZE,
  SENTINEL_CHECK_LABELS,
  SENTINEL_CHECK_ORDER,
} = await import("./invariants");
const { parseSentinelReport, renderSentinelSummary, serializeSentinelReport, SENTINEL_SCHEMA } =
  await import("./report");
const { CARDINALITY_FLOORS } = await import("../../db/readiness");
const { computeContribution, CONTRIBUTION_FORMULA_REF } = await import("../../analysis/contribution");

type Facts = Awaited<ReturnType<typeof collectSentinelFacts>>;
type Report = ReturnType<typeof evaluateSentinel>;

// Fixed evaluation instant: seeded runs finish "now", so freshness is čerstvé.
const NOW = "2026-07-31T12:00:00.000Z";
const OPTS = { now: NOW, storePath: dataDir, copiedFrom: null };

async function audit(): Promise<Report> {
  const pg = await open();
  const a = await collectSentinelFacts(pg);
  const b = await collectSentinelFacts(pg);
  return evaluateSentinel(a, b, OPTS);
}

function check(report: Report, id: string) {
  const c = report.checks.find((x) => x.id === id);
  expect(c, `check ${id} present`).toBeDefined();
  return c!;
}

async function seedKind(kind: string, count: number, props: (i: number) => Record<string, unknown>) {
  const pg = await open();
  const chunk = 250;
  for (let start = 0; start < count; start += chunk) {
    const n = Math.min(chunk, count - start);
    const params: unknown[] = [];
    const tuples: string[] = [];
    for (let i = 0; i < n; i++) {
      const idx = start + i;
      params.push(`fx:${kind}:${idx}`, kind, `${kind} ${idx}`, JSON.stringify(props(idx)));
      const base = params.length - 4;
      tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb, 1, '{}'::jsonb)`);
    }
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance) values ${tuples.join(",")}`,
      params,
    );
  }
}

/**
 * A person node exactly as a healthy contribution pass leaves it: the score and every
 * published input are the OUTPUT of the real formula over a deterministic input, and the
 * provenance names that formula. Seeding a bare `contribution_score` (as this fixture did
 * until 2026-08-04) is precisely the store shape the sentinel could not judge.
 */
function scoredPerson(i: number, opts: { ref?: string; pass?: number } = {}) {
  const seats = Array.from({ length: i % 5 }, (_, k) => ({
    organPspId: 700_000 + k,
    organType: "Výbor",
    functionType: k === 0 && i % 3 === 0 ? "předseda" : null,
  }));
  const p = computeContribution({
    personPspId: i,
    seats,
    ballotsWithPosition: 600 + (i % 300),
    rollCallsHeld: 1000,
    excusedDays: i % 40,
    sessionDays: 1000,
    billsAuthored: i % 4,
    interpellations: i % 3,
    speechTurns: i % 60,
  });
  return {
    contribution_score: p.contributionScore,
    committee_count: p.committeeCount,
    leadership_count: p.leadershipCount,
    participation_rate: p.participationRate,
    absence_rate: p.absenceRate,
    bills_authored: p.billsAuthored,
    interpellations: p.interpellations,
    speech_turns: p.speechTurns,
    contribution_provenance: {
      pass: opts.pass ?? 42,
      method: "deterministic",
      ref: opts.ref ?? CONTRIBUTION_FORMULA_REF,
    },
  };
}

describe("live-graph sentinel against fixture stores", () => {
  // First test in the file pays the PGlite WASM boot (30s file-level timeout
  // comes from vitest.config.ts).
  it("empty store: unreleased + below floors + stale + unscored fire; chain/orphans/determinism hold", async () => {
    const report = await audit();
    expect(report.verdict).toBe("violation");
    expect(check(report, "manifest-bounds").status).toBe("violation");
    expect(check(report, "manifest-bounds").detail).toContain("no released version");
    expect(check(report, "readiness-floors").status).toBe("violation");
    expect(check(report, "freshness").status).toBe("violation");
    expect(check(report, "score-sample").status).toBe("violation");
    expect(check(report, "formula-ref").status).toBe("violation");
    expect(check(report, "provenance-uniformity").status).toBe("violation");
    expect(check(report, "components-sum").status).toBe("violation");
    expect(check(report, "recompute-sample").status).toBe("violation");
    // An empty edge set is honestly valid — every edge that exists resolves.
    expect(check(report, "orphan-edges").status).toBe("ok");
    expect(check(report, "determinism").status).toBe("ok");
    // An empty LEDGER is not. Nobody has decided anything, so the chain proves
    // nothing about tamper-evidence — that is "not evaluated", never a pass
    // (this row said `ok` / "trivially valid" until 2026-08-13).
    expect(check(report, "audit-chain").status).toBe("unevaluable");
    expect(check(report, "audit-chain").detail).toContain("no rows");
  });

  it("clean fixture store: every invariant passes", async () => {
    // Floors exactly met (lib/db/readiness.ts is the ground truth being read).
    await seedKind("person", CARDINALITY_FLOORS.person, (i) => scoredPerson(i));
    await seedKind("company", CARDINALITY_FLOORS.company, () => ({}));
    await seedKind("bill", CARDINALITY_FLOORS.bill, () => ({}));
    await seedKind("law", CARDINALITY_FLOORS.law, () => ({}));
    await seedKind("contract", CARDINALITY_FLOORS.contract, () => ({}));

    const pg = await open();
    // Two well-formed edges between existing nodes.
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance) values
        ('fx:person:0', 'member_of', 'fx:company:0', 1, '{}'::jsonb, '{}'::jsonb),
        ('fx:person:1', 'author_of', 'fx:bill:0', 1, '{}'::jsonb, '{}'::jsonb)`,
    );
    // One finished ok run per cadenced source (lib/analysis/atlas.ts
    // SOURCE_CADENCE_DAYS is the ground truth) — finished "now" ⇒ čerstvé,
    // and the newest one cuts the release version.
    await pg.query(
      `insert into ingest_run (source, started_at, finished_at, status, rows_written) values
        ('psp-poslanci', $1, $1, 'ok', 10),
        ('psp-hlasovani', $1, $1, 'ok', 10),
        ('pumper-psp-opendata', $1, $1, 'ok', 10)`,
      [NOW],
    );
    // A two-row hash chain, hashed by the ledger's own pure primitives.
    const rowA = {
      id: "audit-1", src: "fx:person:0", rel: "linked_to", dst: "fx:company:0",
      decision: "confirm", reviewer: "sentinel-fixture", note: null,
      decidedAt: "2026-07-31T10:00:00.000Z", priorState: null,
    };
    const hashA = computeAuditRowHash(GENESIS_HASH, rowA);
    const rowB = {
      id: "audit-2", src: "fx:person:1", rel: "linked_to", dst: "fx:bill:0",
      decision: "reject", reviewer: "sentinel-fixture", note: "fixture",
      decidedAt: "2026-07-31T11:00:00.000Z", priorState: "confirmed",
    };
    const hashB = computeAuditRowHash(hashA, rowB);
    await pg.query(
      `insert into review_audit
         (id, src, rel, dst, decision, reviewer, note, decided_at, prior_state, chain_pos, prev_hash, row_hash)
       values
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$11),
         ($12,$13,$14,$15,$16,$17,$18,$19,$20,2,$21,$22)`,
      [
        rowA.id, rowA.src, rowA.rel, rowA.dst, rowA.decision, rowA.reviewer, rowA.note,
        rowA.decidedAt, rowA.priorState, GENESIS_HASH, hashA,
        rowB.id, rowB.src, rowB.rel, rowB.dst, rowB.decision, rowB.reviewer, rowB.note,
        rowB.decidedAt, rowB.priorState, hashA, hashB,
      ],
    );

    const report = await audit();
    expect(report.checks.map((c) => [c.id, c.status])).toEqual([
      ["manifest-bounds", "ok"],
      ["readiness-floors", "ok"],
      ["audit-chain", "ok"],
      ["orphan-edges", "ok"],
      ["freshness", "ok"],
      ["score-sample", "ok"],
      ["formula-ref", "ok"],
      ["provenance-uniformity", "ok"],
      ["components-sum", "ok"],
      ["recompute-sample", "ok"],
      ["determinism", "ok"],
    ]);
    expect(report.verdict).toBe("ok");
    expect(report.manifestVersion).toBe("2026.07.31");
    expect(check(report, "audit-chain").detail).toContain("all 2 review_audit rows are chained");
    // The roster is load-bearing: a real audit emits exactly the pinned check
    // list, in the pinned order — the same rows an unevaluable run emits, so
    // the two are diffable.
    expect(report.checks.map((c) => c.id)).toEqual([...SENTINEL_CHECK_ORDER]);
    // A run with nothing skipped says so in the old words.
    expect(renderSentinelSummary(report)).toContain(`all ${report.checks.length} invariants hold`);
    expect(renderSentinelSummary(report)).not.toContain("NOT EVALUATED");
  });

  it("orphan edge fires exactly the orphan-edges invariant", async () => {
    const pg = await open();
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values ('fx:person:0', 'linked_to', 'fx:ghost:404', 1, '{}'::jsonb, '{}'::jsonb)`,
    );
    const report = await audit();
    const c = check(report, "orphan-edges");
    expect(c.status).toBe("violation");
    expect(c.detail).toContain("fx:ghost:404");
    expect(report.verdict).toBe("violation");
    expect(report.checks.filter((x) => x.status === "violation").map((x) => x.id)).toEqual(["orphan-edges"]);
    await pg.query(`delete from kg_edge where dst = 'fx:ghost:404'`);
  });

  it("tampered audit row fires the audit-chain invariant with the divergence", async () => {
    const pg = await open();
    await pg.query(`update review_audit set note = 'tampered after the fact' where chain_pos = 2`);
    const report = await audit();
    const c = check(report, "audit-chain");
    expect(c.status).toBe("violation");
    expect(c.detail).toContain("row-hash-mismatch");
    expect(c.detail).toContain("pos 2");
    await pg.query(`update review_audit set note = 'fixture' where chain_pos = 2`);
  });

  // ── THE ERASURE PROOF ────────────────────────────────────────────────────
  // Tampering with ONE row fired the invariant above. Wiping the WHOLE chain
  // used to PASS: every chain read filters `where chain_pos is not null`, so
  // nulling the column empties the read, verifyAuditChain([]) reports a valid
  // empty chain of length 0, and the old check answered "chain is empty —
  // trivially valid". The cheapest attack on a tamper-evident ledger was the
  // one attack the sentinel endorsed. Verified before the 2026-08-13 fix: this
  // exact store produced audit-chain `ok`.
  it("a chain wiped by nulling every chain_pos is a VIOLATION, not an empty chain", async () => {
    const pg = await open();
    await pg.query(`update review_audit set chain_pos = null`);
    const report = await audit();
    const c = check(report, "audit-chain");
    expect(c.status).toBe("violation");
    // Both counts are named — "0 of 2" is a different finding from "0 of 0".
    expect(c.detail).toContain("0 of 2");
    expect(c.detail).toContain("OUTSIDE the tamper-evident chain");
    expect(report.verdict).toBe("violation");
    expect(report.checks.filter((x) => x.status === "violation").map((x) => x.id)).toEqual([
      "audit-chain",
    ]);

    await pg.query(`update review_audit set chain_pos = 1 where id = 'audit-1'`);
    await pg.query(`update review_audit set chain_pos = 2 where id = 'audit-2'`);
    expect((await audit()).verdict).toBe("ok");
  });

  // Half an erasure is still an erasure — and the count says which half.
  it("one row dropped out of the chain fires the same invariant with both counts", async () => {
    const pg = await open();
    await pg.query(`update review_audit set chain_pos = null where id = 'audit-2'`);
    const c = check(await audit(), "audit-chain");
    expect(c.status).toBe("violation");
    expect(c.detail).toContain("1 of 2");
    await pg.query(`update review_audit set chain_pos = 2 where id = 'audit-2'`);
    expect((await audit()).verdict).toBe("ok");
  });

  // A source that writes into ingest_run without a declared cadence was
  // INVISIBLE to the freshness check: not stale, not fresh, not mentioned — so
  // a green line covered an unknown fraction of the sources. It is not a
  // violation (nobody declared a promise to break), but it is never silent.
  it("freshness names the sources it did NOT judge, without failing on them", async () => {
    const pg = await open();
    await pg.query(
      `insert into ingest_run (source, started_at, finished_at, status, rows_written) values
        ('fx-source-without-cadence', $1, $1, 'ok', 1)`,
      [NOW],
    );
    const c = check(await audit(), "freshness");
    expect(c.status).toBe("ok");
    expect(c.detail).toContain("fx-source-without-cadence");
    expect(c.detail).toContain("NOT COVERED");
    await pg.query(`delete from ingest_run where source = 'fx-source-without-cadence'`);
    const clean = check(await audit(), "freshness");
    expect(clean.status).toBe("ok");
    expect(clean.detail).not.toContain("NOT COVERED");
  });

  it("a run older than 2× its cadence fires the freshness invariant", async () => {
    const pg = await open();
    // pumper-psp-opendata cadence is 7 days (atlas ground truth; corrected from
    // the aspirational 1 day after the 2026-07-31 sentinel finding) — 20 days
    // > cadence × 2 = zastaralé.
    await pg.query(
      `update ingest_run set started_at = $1, finished_at = $1 where source = 'pumper-psp-opendata'`,
      ["2026-07-11T12:00:00.000Z"],
    );
    const report = await audit();
    const c = check(report, "freshness");
    expect(c.status).toBe("violation");
    expect(c.detail).toContain("pumper-psp-opendata");
    expect(c.detail).toContain("zastaralé");
    await pg.query(
      `update ingest_run set started_at = $1, finished_at = $1 where source = 'pumper-psp-opendata'`,
      [NOW],
    );
  });

  it("a person without a finite score fires the score-sample invariant", async () => {
    const pg = await open();
    await pg.query(`update kg_node set props = props - 'contribution_score' where id = 'fx:person:0'`);
    const report = await audit();
    const c = check(report, "score-sample");
    expect(c.status).toBe("violation");
    expect(c.detail).toContain("fx:person:0");
    await pg.query(
      `update kg_node set props = jsonb_set(props, '{contribution_score}', $1::jsonb) where id = 'fx:person:0'`,
      [JSON.stringify(scoredPerson(0).contribution_score)],
    );
  });

  // ── THE PROOF ────────────────────────────────────────────────────────────
  // Reconstructs the store as it stood 2026-07-29 → 2026-08-04: the code counted
  // DISTINCT BODIES while every person node still carried pass-11 numbers — committee
  // breadth counted psp.cz membership ROWS (a led body files as two rows), rates
  // published at 1 decimal, and provenance ref "contribution". That store served a
  // wrong ranking for six days and the sentinel called it healthy, because
  // `contribution_score` was finite on all of them and the determinism check compares
  // the store to itself. Both new invariants must fire on it, or nothing has changed.
  it("the pass-11 store (stale ref + row-counted committees) fires formula-ref AND recompute-sample", async () => {
    const pg = await open();
    const legacy = (i: number) => {
      const p = computeContribution({
        personPspId: i,
        seats: Array.from({ length: i % 5 }, (_, k) => ({
          organPspId: 700_000 + k,
          organType: "Výbor",
          functionType: k === 0 && i % 3 === 0 ? "předseda" : null,
        })),
        ballotsWithPosition: 600 + (i % 300),
        rollCallsHeld: 1000,
        excusedDays: i % 40,
        sessionDays: 1000,
        billsAuthored: i % 4,
        interpellations: i % 3,
        speechTurns: i % 60,
      });
      return {
        ...scoredPerson(i),
        // ROWS, not bodies: psp.cz files a led body twice, so pass 11 counted it twice.
        committee_count: p.committeeCount + p.leadershipCount,
        // Pass-11 published its rates at ONE decimal while scoring from the raw ratio.
        participation_rate: Math.round(p.participationRate * 10) / 10,
        absence_rate: Math.round(p.absenceRate * 10) / 10,
        contribution_provenance: { pass: 11, method: "deterministic", ref: "contribution" },
      };
    };
    const persons = await pg.query<{ id: string }>(`select id from kg_node where kind = 'person' order by id`);
    for (const row of persons.rows) {
      const i = Number(row.id.split(":").pop());
      await pg.query(`update kg_node set props = $1::jsonb where id = $2`, [JSON.stringify(legacy(i)), row.id]);
    }

    const report = await audit();
    const ref = check(report, "formula-ref");
    expect(ref.status).toBe("violation");
    expect(ref.detail).toContain("scored by a DIFFERENT formula");
    expect(ref.detail).toContain("contribution");
    expect(ref.detail).toContain("kg-contribution-recompute.ts");

    const recompute = check(report, "recompute-sample");
    expect(recompute.status).toBe("violation");
    expect(recompute.detail).toContain("NOT what this formula produces");

    // Provenance is UNIFORM here (the whole chamber is stale) — the ref invariant is what
    // catches a fully-applied wrong formula; uniformity catches the half-applied one.
    expect(check(report, "provenance-uniformity").status).toBe("ok");
    expect(report.verdict).toBe("violation");

    // Restore the healthy fixture for the tests that follow.
    for (const row of persons.rows) {
      const i = Number(row.id.split(":").pop());
      await pg.query(`update kg_node set props = $1::jsonb where id = $2`, [JSON.stringify(scoredPerson(i)), row.id]);
    }
    expect((await audit()).verdict).toBe("ok");
  });

  // A recompute that stopped halfway publishes ONE ranking built by TWO formulas.
  it("a half-recomputed chamber fires provenance-uniformity", async () => {
    const pg = await open();
    await pg.query(
      `update kg_node set props = jsonb_set(props, '{contribution_provenance,pass}', '11')
        where kind = 'person' and id in (select id from kg_node where kind = 'person' order by id limit 5)`,
    );
    const report = await audit();
    const c = check(report, "provenance-uniformity");
    expect(c.status).toBe("violation");
    expect(c.detail).toContain("2 distinct provenances");
    expect(c.detail).toContain("pass 11");
    // The ref is untouched, so the ref invariant is silent — the two see different things.
    expect(check(report, "formula-ref").status).toBe("ok");
    await pg.query(
      `update kg_node set props = jsonb_set(props, '{contribution_provenance,pass}', '42') where kind = 'person'`,
    );
    expect((await audit()).verdict).toBe("ok");
  });

  it("the recompute sample is deterministic — same store, same MPs, no clock or RNG", async () => {
    const pg = await open();
    const facts = await collectSentinelFacts(pg);
    const a = sampleForRecompute(facts.persons).map((p) => p.id);
    const b = sampleForRecompute([...facts.persons].reverse()).map((p) => p.id);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(RECOMPUTE_SAMPLE_SIZE);
    expect(new Set(a).size).toBe(a.length);
  });

  it("dropping below a cardinality floor fires readiness-floors AND degrades the manifest", async () => {
    const pg = await open();
    await pg.query(`update kg_node set kind = 'x-person' where kind = 'person' and id like 'fx:person:14%'`);
    const report = await audit();
    expect(check(report, "readiness-floors").status).toBe("violation");
    expect(check(report, "readiness-floors").detail).toContain("person");
    expect(check(report, "manifest-bounds").status).toBe("violation");
    expect(check(report, "manifest-bounds").detail).toContain("DEGRADED");
    await pg.query(`update kg_node set kind = 'person' where kind = 'x-person'`);
    expect((await audit()).verdict).toBe("ok");
  });

  it("drifted facts between the two passes fire the determinism invariant (pure)", async () => {
    const pg = await open();
    const a = await collectSentinelFacts(pg);
    const b: Facts = { ...a, persons: a.persons.map((p, i) => (i === 0 ? { ...p, score: 99.9 } : p)) };
    const report = evaluateSentinel(a, b, OPTS);
    const c = check(report, "determinism");
    expect(c.status).toBe("violation");
    expect(c.detail).toContain("leaderboard sample drifted");
  });
});

describe("sentinel report codec", () => {
  it("round-trips through canonical serialization", async () => {
    const report = await audit();
    const wire = serializeSentinelReport(report);
    const parsed = parseSentinelReport(wire);
    expect(parsed).toEqual(report);
    // Canonical bytes: re-serializing the parse yields identical bytes.
    expect(serializeSentinelReport(parsed)).toBe(wire);
    expect(parsed.schema).toBe(SENTINEL_SCHEMA);
    // The human summary states the verdict it carries.
    expect(renderSentinelSummary(report)).toContain("VERDICT: OK");
  });

  it("rejects an unknown schema, a verdict/checks disagreement, and non-JSON", async () => {
    const report = await audit();
    expect(() => parseSentinelReport(serializeSentinelReport(report).replace("politicas.sentinel/1", "bogus/9")))
      .toThrow(/unknown sentinel schema/);
    const lying = { ...report, verdict: "violation" as const };
    expect(() => parseSentinelReport(JSON.stringify(lying))).toThrow(/does not agree/);
    expect(() => parseSentinelReport("not json")).toThrow(/not JSON/);
  });
});

// ── A run that never reached the data ──────────────────────────────────────
//
// Until 2026-08-13 the store-unreadable path (scripts/sentinel/run.ts) wrote no
// report at all, so "ran and passed" and "never ran" left the same artifact:
// none. These pin the third state end to end — the shape, the headline, and the
// one sentence it may never print.
describe("unevaluable report (the run never reached the store)", () => {
  const OPTS_MISSING = {
    now: "2026-08-13T00:00:00.000Z",
    storePath: "/nowhere/.pglite",
    copiedFrom: null,
    reason: "store directory not found: /nowhere/.pglite",
  };

  it("carries the SAME rows in the SAME order as a real audit, every one unevaluable", async () => {
    const real = await audit();
    const none = unevaluableSentinelReport(OPTS_MISSING);
    expect(none.checks.map((c) => c.id)).toEqual(real.checks.map((c) => c.id));
    expect(none.checks.map((c) => c.label)).toEqual(real.checks.map((c) => c.label));
    expect(none.checks.map((c) => c.id)).toEqual([...SENTINEL_CHECK_ORDER]);
    expect(new Set(none.checks.map((c) => c.status))).toEqual(new Set(["unevaluable"]));
    for (const c of none.checks) expect(c.detail).toContain(OPTS_MISSING.reason);
    // No store was read, so there is no release to name — a version from
    // anywhere else would be a claim about data this run never saw.
    expect(none.manifestVersion).toBeNull();
    expect(none.manifestHash).toBeNull();
  });

  it("verdict is unevaluable — never ok — and the headline never claims the invariants hold", () => {
    const none = unevaluableSentinelReport(OPTS_MISSING);
    expect(none.verdict).toBe("unevaluable");
    const summary = renderSentinelSummary(none);
    expect(summary).toContain("VERDICT: NOT EVALUATED");
    expect(summary).toContain(`0 of ${none.checks.length} invariants`);
    expect(summary).not.toContain("invariants hold");
    expect(summary).not.toContain("VERDICT: OK");
    expect(summary).toContain("[UNEVAL]");
  });

  it("round-trips through the codec (a report of nothing is still a valid report)", () => {
    const none = unevaluableSentinelReport(OPTS_MISSING);
    const wire = serializeSentinelReport(none);
    const parsed = parseSentinelReport(wire);
    expect(parsed).toEqual(none);
    expect(serializeSentinelReport(parsed)).toBe(wire);
  });

  it("the parser refuses a green headline over checks that were never evaluated", () => {
    const none = unevaluableSentinelReport(OPTS_MISSING);
    expect(() => parseSentinelReport(JSON.stringify({ ...none, verdict: "ok" }))).toThrow(
      /does not agree/,
    );
    expect(() => parseSentinelReport(JSON.stringify({ ...none, verdict: "vymyslene" }))).toThrow(
      /ok\|violation\|unevaluable/,
    );
  });

  it("a mixed report counts the unevaluated rows in its headline instead of hiding them", () => {
    const none = unevaluableSentinelReport(OPTS_MISSING);
    const mixed = {
      ...none,
      verdict: "ok" as const,
      checks: [
        { ...none.checks[0], status: "ok" as const, detail: "held" },
        ...none.checks.slice(1),
      ],
    };
    const summary = renderSentinelSummary(mixed);
    expect(summary).toContain(`1 of ${mixed.checks.length} invariants hold`);
    expect(summary).toContain(`${mixed.checks.length - 1} NOT EVALUATED`);
    // The old sentence is the one thing a partially-evaluated run may not say.
    expect(summary).not.toContain(`all ${mixed.checks.length} invariants hold`);
    expect(parseSentinelReport(JSON.stringify(mixed)).verdict).toBe("ok");
  });

  it("every roster id carries a label — the unevaluable report cannot ship a blank row", () => {
    for (const id of SENTINEL_CHECK_ORDER) {
      expect(SENTINEL_CHECK_LABELS[id], `label for ${id}`).toBeTruthy();
    }
    expect(new Set(SENTINEL_CHECK_ORDER).size).toBe(SENTINEL_CHECK_ORDER.length);
    expect(SENTINEL_CHECK_ORDER.length).toBe(Object.keys(SENTINEL_CHECK_LABELS).length);
  });
});

afterAll(async () => {
  const pg = await open();
  await pg.close();
  rmSync(dataDir, { recursive: true, force: true });
});
