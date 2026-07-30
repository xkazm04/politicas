import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Isolated PGlite data dir — NEVER the live ./.pglite. Set BEFORE any import that
// calls open() (same discipline as review.test.ts).
const dataDir = mkdtempSync(join(tmpdir(), "politicas-ledger-repo-"));
process.env.PGLITE_PATH = dataDir;

const { open, PGLITE_KEY } = await import("../internals");
type GlobalWithPglite = typeof globalThis & { [PGLITE_KEY]?: unknown };
const { makeReviewRepo } = await import("./review");
const { makeLedgerRepo } = await import("./ledger");
const { EMPTY_MERKLE_ROOT, GENESIS_HASH } = await import("../ledger");

const TIES = [
  { src: "psp:person:9001", dst: "kg:company:ico:9001" },
  { src: "psp:person:9002", dst: "kg:company:ico:9002" },
  { src: "psp:person:9003", dst: "kg:company:ico:9003" },
];

async function seedTies(pg: Awaited<ReturnType<typeof open>>) {
  for (const t of TIES) {
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values ($1, 'linked_to', $2, null, $3::jsonb, '{}'::jsonb)`,
      [t.src, t.dst, JSON.stringify({ role: "jednatel", review_state: "pending_review" })],
    );
  }
}

describe("tamper-evident review-audit chain (DB integration)", () => {
  afterAll(async () => {
    const pg = await open();
    await pg.close();
    delete (globalThis as GlobalWithPglite)[PGLITE_KEY];
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("EMPTY CHAIN: verifies ok with null head before any decision exists", async () => {
    const pg = await open();
    const ledger = makeLedgerRepo(pg);
    expect(await ledger.verifyReviewChain()).toEqual({ ok: true, length: 0, headHash: null });
    expect(await ledger.getReviewChainHead()).toBeNull();
  });

  it("APPEND + VERIFY: decisions through the review write path form a verifiable chain", async () => {
    const pg = await open();
    await seedTies(pg);
    const review = makeReviewRepo(pg);
    const ledger = makeLedgerRepo(pg);

    expect((await review.setTieReviewState(TIES[0].src, TIES[0].dst, "confirm", "tester", null)).ok).toBe(true);
    expect((await review.setTieReviewState(TIES[1].src, TIES[1].dst, "needs-more", "tester", "chybí doklad")).ok).toBe(true);
    expect((await review.setTieReviewState(TIES[2].src, TIES[2].dst, "reject", "tester", null)).ok).toBe(true);

    // rows carry contiguous positions, genesis prev on the first, and linked hashes
    const { rows } = await pg.query<Record<string, unknown>>(
      `select chain_pos, prev_hash, row_hash from review_audit order by chain_pos asc`,
    );
    expect(rows.map((r) => Number(r.chain_pos))).toEqual([1, 2, 3]);
    expect(rows[0].prev_hash).toBe(GENESIS_HASH);
    expect(rows[1].prev_hash).toBe(rows[0].row_hash);
    expect(rows[2].prev_hash).toBe(rows[1].row_hash);

    const v = await ledger.verifyReviewChain();
    expect(v).toEqual({ ok: true, length: 3, headHash: rows[2].row_hash });
    expect((await ledger.getReviewChainHead())?.chainPos).toBe(3);
  });

  it("RESTART: the chain survives close + reopen and keeps extending from the same head", async () => {
    let pg = await open();
    const headBefore = await makeLedgerRepo(pg).getReviewChainHead();
    await pg.close();
    delete (globalThis as GlobalWithPglite)[PGLITE_KEY]; // simulate a fresh process over the same data dir

    pg = await open();
    const ledger = makeLedgerRepo(pg);
    expect(await ledger.getReviewChainHead()).toEqual(headBefore);
    expect((await ledger.verifyReviewChain()).ok).toBe(true);

    // appending after "restart" links onto the persisted head
    const review = makeReviewRepo(pg);
    expect((await review.setTieReviewState(TIES[1].src, TIES[1].dst, "confirm", "tester", null)).ok).toBe(true);
    const v = await ledger.verifyReviewChain();
    expect(v.ok).toBe(true);
    expect(v.length).toBe(4);
  });

  it("TAMPER: a bit-flipped note is reported at its exact chain position, then restores clean", async () => {
    const pg = await open();
    const ledger = makeLedgerRepo(pg);
    const { rows } = await pg.query<{ note: string | null }>(
      `select note from review_audit where chain_pos = 2`,
    );
    const originalNote = rows[0].note;

    await pg.query(`update review_audit set note = 'zpětně upraveno' where chain_pos = 2`);
    const v = await ledger.verifyReviewChain();
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.firstDivergence.chainPos).toBe(2);
      expect(v.firstDivergence.reason).toBe("row-hash-mismatch");
    }

    await pg.query(`update review_audit set note = $1 where chain_pos = 2`, [originalNote]);
    expect((await ledger.verifyReviewChain()).ok).toBe(true);
  });

  it("TAMPER: deleting a mid-chain row is reported as a gap at the deletion point", async () => {
    const pg = await open();
    const ledger = makeLedgerRepo(pg);
    const { rows: backup } = await pg.query<Record<string, unknown>>(
      `select * from review_audit where chain_pos = 3`,
    );
    await pg.query(`delete from review_audit where chain_pos = 3`);

    const v = await ledger.verifyReviewChain();
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.firstDivergence.reason).toBe("gap-in-chain-pos");
      expect(v.firstDivergence.chainPos).toBe(4);
    }

    const b = backup[0];
    await pg.query(
      `insert into review_audit (id, src, rel, dst, decision, reviewer, note, decided_at, prior_state, chain_pos, prev_hash, row_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [b.id, b.src, b.rel, b.dst, b.decision, b.reviewer, b.note, b.decided_at, b.prior_state, b.chain_pos, b.prev_hash, b.row_hash],
    );
    expect((await ledger.verifyReviewChain()).ok).toBe(true);
  });

  it("MERKLE: sealing an ingest run is deterministic; empty run seals to the pinned constant", async () => {
    const pg = await open();
    const ledger = makeLedgerRepo(pg);

    const { rows: runRows } = await pg.query<{ id: number }>(
      `insert into ingest_run (source, source_url) values ('test-source', null) returning id`,
    );
    const runId = Number(runRows[0].id);
    for (const key of ["r1", "r2", "r3"]) {
      await pg.query(
        `insert into source_release (id, pumper_app, pumper_dataset, record_key, source, source_url, fetched_at, ingest_run_id, raw)
         values ($1, 'pumper', 'ds', $2, 'test-source', 'https://example.test', now(), $3, '{}'::jsonb)`,
        [`test:release:${key}`, key, runId],
      );
    }

    const first = await ledger.sealIngestRun(runId);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.leafCount).toBe(3);
    expect(first.merkleRoot).toMatch(/^[0-9a-f]{64}$/);

    // idempotent over unchanged data
    const again = await ledger.sealIngestRun(runId);
    expect(again).toEqual(first);

    // the root is persisted and visible through the heads API
    const heads = await ledger.getLedgerHeads();
    expect(heads.sealedRuns.some((r) => r.runId === runId && r.merkleRoot === first.merkleRoot)).toBe(true);
    expect(heads.reviewChain?.length).toBe(4);

    // empty run → pinned empty root; unknown run → honest error
    const { rows: emptyRun } = await pg.query<{ id: number }>(
      `insert into ingest_run (source) values ('empty-source') returning id`,
    );
    const sealedEmpty = await ledger.sealIngestRun(Number(emptyRun[0].id));
    expect(sealedEmpty).toEqual({ ok: true, merkleRoot: EMPTY_MERKLE_ROOT, leafCount: 0 });
    expect(await ledger.sealIngestRun(999_999)).toEqual({ ok: false, error: "ingest run not found" });
  });

  it("MERKLE tamper: changing one stored row changes the recomputed root", async () => {
    const pg = await open();
    const ledger = makeLedgerRepo(pg);
    const heads = await ledger.getLedgerHeads();
    const sealed = heads.sealedRuns.find((r) => r.leafCount === 3)!;
    expect(sealed).toBeDefined();

    await pg.query(`update source_release set description = 'zpětně upraveno' where id = 'test:release:r2'`);
    const resealed = await ledger.sealIngestRun(sealed.runId);
    expect(resealed.ok).toBe(true);
    if (resealed.ok) expect(resealed.merkleRoot).not.toBe(sealed.merkleRoot);
  });
});
