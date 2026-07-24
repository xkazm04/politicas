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

const { open } = await import("../internals");
const { makeReviewRepo } = await import("./review");
const { getVerificationQueue } = await import("../../../../features/money/getVerificationData");

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

  afterAll(async () => {
    await pg.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

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

  it("(c) reject/needs-more do NOT set review_state to verified", async () => {
    const { rows } = await pg.query<{ props: Record<string, unknown> }>(
      `select props from kg_edge where src=$1 and rel='linked_to' and dst=$2`,
      [SRC, DST],
    );
    expect(rows[0].props.review_state).toBe("pending_review");

    const rejectResult = await repo.setTieReviewState(SRC, DST, "reject", "tester", null);
    expect(rejectResult).toEqual({ ok: true, reviewState: "pending_review" });

    const { rows: rows2 } = await pg.query<{ props: Record<string, unknown> }>(
      `select props from kg_edge where src=$1 and rel='linked_to' and dst=$2`,
      [SRC, DST],
    );
    expect(rows2[0].props.review_state).toBe("pending_review");
    expect(rows2[0].props.last_decision).toBe("reject");

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
