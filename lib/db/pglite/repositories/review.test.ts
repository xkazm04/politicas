import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated PGlite data dir — NEVER point this (or any test) at ./.pglite or
// ./.pglite-copy-money, the live/working directories. Set BEFORE importing
// anything that calls open(), since pglitePath() reads process.env.PGLITE_PATH
// lazily but open() memoises its connection on globalThis for the process.
const dataDir = mkdtempSync(join(tmpdir(), "politicas-review-repo-"));
process.env.PGLITE_PATH = dataDir;
// getVerificationQueue() reads the shared money layer, which enforces the cardinality
// floors (207 persons / 196 companies / 2 287 contracts on the real graph). This file
// seeds a handful of rows on purpose, so the gate is bypassed here exactly as
// lib/testing/loaders.test.ts does; the floors themselves are tested there.
process.env.KG_READINESS_OFF = "1";

const { open } = await import("../internals");
const { makeReviewRepo } = await import("./review");
const { verifyAuditChain } = await import("../ledger");
const { getVerificationQueue } = await import("../../../../features/money/getVerificationData");
// D5 (batch 004): REVIEWER_TOKEN/NAME must be set BEFORE this import, same lazy-env-read
// discipline as PGLITE_PATH above — submitReviewDecision reads process.env at call time,
// not import time, but setting it here keeps all env setup together and explicit.
process.env.REVIEWER_TOKEN = "test-token";
process.env.REVIEWER_NAME = "tester";
const { submitReviewDecision } = await import("../../../../features/money/reviewActions");

const SRC = "psp:person:6790";
const DST = "kg:company:ico:111";

describe("ReviewRepository.setTieReviewState", () => {
  let pg: Awaited<ReturnType<typeof open>>;
  let repo: ReturnType<typeof makeReviewRepo>;

  beforeAll(async () => {
    pg = await open();
    repo = makeReviewRepo(pg);

    // Seed a minimal linked_to tie, pending_review, plus the node rows the
    // verification-queue loader needs so test (d) below can exercise the real
    // pending-queue filter rather than a re-derived copy of it.
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ($1, 'person', 'Testovací Poslanec', '{}'::jsonb, 1, '{}'::jsonb),
        ($2, 'company', 'Testovací s.r.o.', $3::jsonb, 1, '{}'::jsonb)`,
      [SRC, DST, JSON.stringify({ ico: "111" })],
    );
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values ($1, 'linked_to', $2, null, $3::jsonb, $4::jsonb)`,
      [
        SRC,
        DST,
        JSON.stringify({ role: "jednatel", source: "test-source · 2020-01-01–ongoing", review_state: "pending_review" }),
        JSON.stringify({ pass: 1 }),
      ],
    );
  });

  // NOTE: pg is NOT closed here — open() memoises ONE connection on globalThis per
  // process/data-dir, and every describe block in this file shares the same dataDir.
  // Closing it here would break the later D7/D5 describe blocks. The final describe
  // block in the file closes the connection and removes the temp dir.

  it("errors honestly when the tie doesn't exist", async () => {
    const result = await repo.setTieReviewState(
      "psp:person:0",
      "kg:company:ico:0",
      "confirm",
      "tester",
      null,
    );
    expect(result).toEqual({ ok: false, error: "tie not found" });
  });

  it("(a) writes an audit row BEFORE flipping state, with the correct prior_state", async () => {
    const before = await repo.listReviewAudit({ src: SRC, dst: DST });
    expect(before).toHaveLength(0);

    const result = await repo.setTieReviewState(SRC, DST, "needs-more", "tester", "chybí ARES VR doklad");
    expect(result.ok).toBe(true);

    const audit = await repo.listReviewAudit({ src: SRC, dst: DST });
    expect(audit).toHaveLength(1);
    expect(audit[0].decision).toBe("needs-more");
    expect(audit[0].reviewer).toBe("tester");
    expect(audit[0].note).toBe("chybí ARES VR doklad");
    // the edge was pending_review before this decision — audit must record that.
    expect(audit[0].priorState).toBe("pending_review");
  });

  it("(c) needs-more does NOT set review_state to verified (stays pending_review)", async () => {
    // reject's own terminal-state behavior (D7, batch 004: reject → "rejected") is
    // covered by the dedicated "D7 — reject sets a terminal rejected state" describe
    // block below — exercising it on THIS tie here would take it out of the pending
    // queue and break tests (d) and (b)+(d) further down, which rely on this tie
    // staying pending_review until the explicit confirm step.
    const { rows } = await pg.query<{ props: Record<string, unknown> }>(
      `select props from kg_edge where src=$1 and rel='linked_to' and dst=$2`,
      [SRC, DST],
    );
    expect(rows[0].props.review_state).toBe("pending_review");

    const needsMoreResult = await repo.setTieReviewState(SRC, DST, "needs-more", "tester", "chybí doklad");
    expect(needsMoreResult).toEqual({ ok: true, reviewState: "pending_review" });

    const { rows: rows2 } = await pg.query<{ props: Record<string, unknown> }>(
      `select props from kg_edge where src=$1 and rel='linked_to' and dst=$2`,
      [SRC, DST],
    );
    expect(rows2[0].props.review_state).toBe("pending_review");
    expect(rows2[0].props.last_decision).toBe("needs-more");

    // two decisions so far → two audit rows, second one's prior_state is "pending_review" too
    const audit = await repo.listReviewAudit({ src: SRC, dst: DST });
    expect(audit).toHaveLength(2);
  });

  it("(d) a pending tie appears in getVerificationQueue()'s pending list", async () => {
    const queue = await getVerificationQueue();
    expect(queue).not.toBeNull();
    expect(queue!.ties.some((t) => t.src === SRC && t.dst === DST)).toBe(true);
  });

  it("(b)+(d) confirm sets review_state to verified, and the tie drops from the pending queue", async () => {
    const result = await repo.setTieReviewState(SRC, DST, "confirm", "tester", null);
    expect(result).toEqual({ ok: true, reviewState: "verified" });

    const { rows } = await pg.query<{ props: Record<string, unknown> }>(
      `select props from kg_edge where src=$1 and rel='linked_to' and dst=$2`,
      [SRC, DST],
    );
    expect(rows[0].props.review_state).toBe("verified");

    const audit = await repo.listReviewAudit({ src: SRC, dst: DST });
    expect(audit).toHaveLength(3);
    expect(audit[0].decision).toBe("confirm"); // newest first
    expect(audit[0].priorState).toBe("pending_review");

    const queue = await getVerificationQueue();
    expect(queue!.ties.some((t) => t.src === SRC && t.dst === DST)).toBe(false);
  });
});

// D7 (batch 004): reject → a terminal "rejected" state, distinct from pending_review,
// that must not be re-served in the pending queue forever (same guarantee as verified).
describe("D7 — reject sets a terminal rejected state", () => {
  const REJ_SRC = "psp:person:6791";
  const REJ_DST = "kg:company:ico:222";
  let pg: Awaited<ReturnType<typeof open>>;
  let repo: ReturnType<typeof makeReviewRepo>;

  beforeAll(async () => {
    pg = await open();
    repo = makeReviewRepo(pg);
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ($1, 'person', 'Druhý Poslanec', '{}'::jsonb, 1, '{}'::jsonb),
        ($2, 'company', 'Druhá s.r.o.', $3::jsonb, 1, '{}'::jsonb)`,
      [REJ_SRC, REJ_DST, JSON.stringify({ ico: "222" })],
    );
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values ($1, 'linked_to', $2, null, $3::jsonb, $4::jsonb)`,
      [
        REJ_SRC,
        REJ_DST,
        JSON.stringify({ role: "jednatel", source: "test-source · 2020-01-01–ongoing", review_state: "pending_review" }),
        JSON.stringify({ pass: 1 }),
      ],
    );
  });

  // NOT closed here — see the note on the shared connection above; the final
  // describe block in this file owns close()/rmSync().

  it("appears in the pending queue before rejection", async () => {
    const queue = await getVerificationQueue();
    expect(queue!.ties.some((t) => t.src === REJ_SRC && t.dst === REJ_DST)).toBe(true);
  });

  it("reject sets review_state to the terminal 'rejected' (not pending_review)", async () => {
    const result = await repo.setTieReviewState(REJ_SRC, REJ_DST, "reject", "tester", null);
    expect(result).toEqual({ ok: true, reviewState: "rejected" });

    const { rows } = await pg.query<{ props: Record<string, unknown> }>(
      `select props from kg_edge where src=$1 and rel='linked_to' and dst=$2`,
      [REJ_SRC, REJ_DST],
    );
    expect(rows[0].props.review_state).toBe("rejected");
  });

  it("a rejected tie disappears from getVerificationQueue() — never re-served", async () => {
    const queue = await getVerificationQueue();
    expect(queue!.ties.some((t) => t.src === REJ_SRC && t.dst === REJ_DST)).toBe(false);
  });
});

// The gate's output must BE the next render's input. A class recorded on the edge is the
// human/analyst judgement the product is built to publish; it has to survive the write
// path's props merge AND win over `classifyTie` when the loader reads the tie back.
describe("a stored tie_class survives the gate and wins at read time", () => {
  const CLS_SRC = "psp:person:6793";
  // "s.r.o." + role "jednatel" → classifyTie() says owner-operator. The stored class says
  // steward (the real IČO-24227901 shape: an SVJ recorded as a steward, not a supplier).
  const CLS_DST = "kg:company:ico:444";
  const NOCLS_DST = "kg:company:ico:555"; // no stored class → the heuristic, labelled derived
  let pg: Awaited<ReturnType<typeof open>>;

  beforeAll(async () => {
    pg = await open();
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ($1, 'person', 'Čtvrtý Poslanec', '{}'::jsonb, 1, '{}'::jsonb),
        ($2, 'company', 'Čtvrtá s.r.o.', $4::jsonb, 1, '{}'::jsonb),
        ($3, 'company', 'Pátá s.r.o.',   $5::jsonb, 1, '{}'::jsonb)`,
      [CLS_SRC, CLS_DST, NOCLS_DST, JSON.stringify({ ico: "444" }), JSON.stringify({ ico: "555" })],
    );
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values ($1, 'linked_to', $2, null, $4::jsonb, $6::jsonb),
              ($1, 'linked_to', $3, null, $5::jsonb, $6::jsonb)`,
      [
        CLS_SRC,
        CLS_DST,
        NOCLS_DST,
        JSON.stringify({
          role: "jednatel",
          source: "test · 2020-01-01–ongoing",
          review_state: "pending_review",
          tie_class: "steward",
        }),
        JSON.stringify({ role: "jednatel", source: "test · 2020-01-01–ongoing", review_state: "pending_review" }),
        JSON.stringify({ pass: 1 }),
      ],
    );
  });

  it("the loader renders the STORED class, and names both it and the guess it beat", async () => {
    const queue = await getVerificationQueue();
    const tie = queue!.ties.find((t) => t.src === CLS_SRC && t.dst === CLS_DST)!;
    expect(tie).toBeDefined();
    expect(tie.tieClass).toBe("steward"); // not "owner-operator"
    expect(tie.tieClassOrigin).toBe("stored");
    expect(tie.tieClassHeuristic).toBe("owner-operator");
  });

  it("an edge with no stored class falls back to the heuristic, labelled derived", async () => {
    const queue = await getVerificationQueue();
    const tie = queue!.ties.find((t) => t.src === CLS_SRC && t.dst === NOCLS_DST)!;
    expect(tie.tieClass).toBe("owner-operator");
    expect(tie.tieClassOrigin).toBe("derived");
  });

  it("the queue's stats count the two origins and the disagreement", async () => {
    const queue = await getVerificationQueue();
    const { classOrigin, classDisagreements, pending } = queue!.stats;
    expect(classOrigin.stored + classOrigin.derived).toBe(pending);
    expect(classOrigin.stored).toBeGreaterThanOrEqual(1);
    expect(classDisagreements).toBeGreaterThanOrEqual(1);
  });

  it("END TO END: a decision through the gate leaves the stored class intact for the next render", async () => {
    // "needs-more" keeps the tie in the pending queue, so the SAME loader call that a
    // reviewer's next page load makes can be asserted against.
    const result = await submitReviewDecision({
      src: CLS_SRC,
      dst: CLS_DST,
      decision: "needs-more",
      note: "ověřit v ARES VR",
      token: "test-token",
    });
    expect(result).toMatchObject({ status: "ok", reviewState: "pending_review" });

    const queue = await getVerificationQueue();
    const tie = queue!.ties.find((t) => t.src === CLS_SRC && t.dst === CLS_DST)!;
    expect(tie.tieClass).toBe("steward");
    expect(tie.tieClassOrigin).toBe("stored");
  });
});

// A review gate a human cannot correct is a one-way write, not a gate (2026-08-04).
// A decided tie stays reachable (queue.decided) WITH its history, the decision can be
// reversed through the product, the reversal is an APPEND to the tamper-evident chain,
// and the chain still verifies afterwards.
describe("a decision is reversible, and the reversal is itself audited", () => {
  const REV_SRC = "psp:person:6794";
  const REV_DST = "kg:company:ico:666";
  let pg: Awaited<ReturnType<typeof open>>;
  let repo: ReturnType<typeof makeReviewRepo>;

  /** Every chained row in the store, ascending — the shape verifyAuditChain expects. */
  async function chainedRows() {
    const { rows } = await pg.query<Record<string, unknown>>(
      `select * from review_audit where chain_pos is not null order by chain_pos asc`,
    );
    return rows.map((r) => ({
      id: String(r.id),
      src: String(r.src),
      rel: String(r.rel),
      dst: String(r.dst),
      decision: String(r.decision),
      reviewer: String(r.reviewer),
      note: r.note == null ? null : String(r.note),
      decidedAt: new Date(r.decided_at as string).toISOString(),
      priorState: r.prior_state == null ? null : String(r.prior_state),
      chainPos: Number(r.chain_pos),
      prevHash: String(r.prev_hash),
      rowHash: String(r.row_hash),
    }));
  }

  beforeAll(async () => {
    pg = await open();
    repo = makeReviewRepo(pg);
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ($1, 'person', 'Pátý Poslanec', '{}'::jsonb, 1, '{}'::jsonb),
        ($2, 'company', 'Šestá s.r.o.', $3::jsonb, 1, '{}'::jsonb)`,
      [REV_SRC, REV_DST, JSON.stringify({ ico: "666" })],
    );
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values ($1, 'linked_to', $2, null, $3::jsonb, $4::jsonb)`,
      [
        REV_SRC,
        REV_DST,
        JSON.stringify({ role: "jednatel", source: "test · 2020-01-01–ongoing", review_state: "pending_review" }),
        JSON.stringify({ pass: 1 }),
      ],
    );
    // Decide it, so the rest of the block works on a DECIDED tie.
    await repo.setTieReviewState(REV_SRC, REV_DST, "confirm", "tester", "doklad z ARES VR sedí");
  });

  it("keeps a decided tie reachable — with its history, newest first", async () => {
    const queue = await getVerificationQueue();
    expect(queue!.ties.some((t) => t.src === REV_SRC && t.dst === REV_DST)).toBe(false);
    const tie = queue!.decided.find((t) => t.src === REV_SRC && t.dst === REV_DST);
    expect(tie).toBeDefined();
    expect(tie!.reviewState).toBe("verified");
    // The history comes from the provenance capsule's own assembler (gateFromEdge).
    expect(tie!.gate?.status).toBe("verified");
    expect(tie!.gate?.reviewer).toBe("tester");
    expect(tie!.gate!.audit.length).toBeGreaterThanOrEqual(1);
    expect(tie!.gate!.audit[0].decision).toBe("confirm");
    expect(tie!.gate!.audit[0].priorState).toBe("pending_review");
    // newest first, and every entry belongs to THIS tie
    const dates = tie!.gate!.audit.map((a) => a.decidedAt);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it("refuses a reversal with no stated reason — nothing at all is written", async () => {
    const beforeRows = await chainedRows();
    const result = await submitReviewDecision({
      src: REV_SRC,
      dst: REV_DST,
      decision: "needs-more",
      note: "   ",
      token: "test-token",
    });
    expect(result).toEqual({ status: "reason-required" });

    const { rows } = await pg.query<{ props: Record<string, unknown> }>(
      `select props from kg_edge where src=$1 and rel='linked_to' and dst=$2`,
      [REV_SRC, REV_DST],
    );
    expect(rows[0].props.review_state).toBe("verified"); // untouched
    expect(await chainedRows()).toHaveLength(beforeRows.length); // no bare row in the chain
  });

  it("reverses the decision, appends an audit row, and returns the tie to the queue", async () => {
    const before = await chainedRows();
    const result = await submitReviewDecision({
      src: REV_SRC,
      dst: REV_DST,
      decision: "needs-more",
      note: "rejstřík mezitím zapsal konec role — vracím ke kontrole",
      token: "test-token",
    });
    expect(result).toMatchObject({ status: "ok", reviewState: "pending_review", reviewer: "tester" });

    const audit = await repo.listReviewAudit({ src: REV_SRC, dst: REV_DST });
    expect(audit[0].decision).toBe("needs-more");
    // THE point of the reversal record: it says what it overturned.
    expect(audit[0].priorState).toBe("verified");
    expect(audit[0].note).toContain("vracím ke kontrole");

    const after = await chainedRows();
    expect(after).toHaveLength(before.length + 1); // append-only: nothing rewritten
    expect(after.slice(0, before.length)).toEqual(before);

    const queue = await getVerificationQueue();
    expect(queue!.ties.some((t) => t.src === REV_SRC && t.dst === REV_DST)).toBe(true);
    expect(queue!.decided.some((t) => t.src === REV_SRC && t.dst === REV_DST)).toBe(false);
  });

  it("leaves the tamper-evident chain valid across the reversal", async () => {
    const verdict = verifyAuditChain(await chainedRows());
    expect(verdict.ok).toBe(true);
  });

  it("refuses to stamp an anonymous row when REVIEWER_NAME is unset", async () => {
    const before = await chainedRows();
    const saved = process.env.REVIEWER_NAME;
    delete process.env.REVIEWER_NAME;
    try {
      const result = await submitReviewDecision({
        src: REV_SRC,
        dst: REV_DST,
        decision: "confirm",
        note: null,
        token: "test-token",
      });
      expect(result.status).toBe("misconfigured");
    } finally {
      process.env.REVIEWER_NAME = saved;
    }
    // The chain gained NOTHING — no row under the old literal "reviewer" identity.
    expect(await chainedRows()).toHaveLength(before.length);
    expect(verifyAuditChain(await chainedRows()).ok).toBe(true);
  });
});

// D5 (batch 004): submitReviewDecision must reject a malformed `decision` at the
// runtime boundary, BEFORE it ever reaches the store — TS types erase at the server
// action boundary, so a hand-crafted client payload could otherwise write an arbitrary
// string to review_audit.decision (which now also has a DB CHECK constraint, see
// lib/db/pglite/ddl.ts, as defense in depth).
describe("submitReviewDecision — D5 runtime decision whitelist", () => {
  const D5_SRC = "psp:person:6792";
  const D5_DST = "kg:company:ico:333";
  let pg: Awaited<ReturnType<typeof open>>;

  beforeAll(async () => {
    pg = await open();
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ($1, 'person', 'Třetí Poslanec', '{}'::jsonb, 1, '{}'::jsonb),
        ($2, 'company', 'Třetí s.r.o.', $3::jsonb, 1, '{}'::jsonb)`,
      [D5_SRC, D5_DST, JSON.stringify({ ico: "333" })],
    );
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values ($1, 'linked_to', $2, null, $3::jsonb, $4::jsonb)`,
      [D5_SRC, D5_DST, JSON.stringify({ role: "jednatel", source: "x", review_state: "pending_review" }), JSON.stringify({ pass: 1 })],
    );
  });

  // Last describe block in the file — owns closing the shared connection and removing
  // the temp data dir.
  afterAll(async () => {
    await pg.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("rejects a malformed decision before touching the store — edge and audit trail untouched", async () => {
    const result = await submitReviewDecision({
      src: D5_SRC,
      dst: D5_DST,
      // @ts-expect-error — deliberately malformed to prove the runtime guard, not just the type
      decision: "delete-everything",
      note: null,
      token: "test-token",
    });
    expect(result).toEqual({ status: "error", message: "invalid decision" });

    const { rows } = await pg.query<{ props: Record<string, unknown> }>(
      `select props from kg_edge where src=$1 and rel='linked_to' and dst=$2`,
      [D5_SRC, D5_DST],
    );
    expect(rows[0].props.review_state).toBe("pending_review"); // untouched

    const audit = await pg.query<{ n: number }>(
      `select count(*)::int as n from review_audit where src=$1 and dst=$2`,
      [D5_SRC, D5_DST],
    );
    expect(audit.rows[0].n).toBe(0); // no audit row was written either
  });

  it("accepts a valid decision and writes through to the store", async () => {
    const result = await submitReviewDecision({ src: D5_SRC, dst: D5_DST, decision: "confirm", note: null, token: "test-token" });
    expect(result).toMatchObject({ status: "ok", reviewState: "verified" });
  });
});
