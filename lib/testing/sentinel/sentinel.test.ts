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
const { evaluateSentinel, sampleForRecompute, RECOMPUTE_SAMPLE_SIZE } = await import("./invariants");
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
    // An empty chain and an empty edge set are honestly valid.
    expect(check(report, "audit-chain").status).toBe("ok");
    expect(check(report, "orphan-edges").status).toBe("ok");
    expect(check(report, "determinism").status).toBe("ok");
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
    expect(check(report, "audit-chain").detail).toContain("2 chained rows verify");
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

afterAll(async () => {
  const pg = await open();
  await pg.close();
  rmSync(dataDir, { recursive: true, force: true });
});
