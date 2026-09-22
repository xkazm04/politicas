// The G2 review door, kind by kind: bill forensic verdicts and person-level
// effort verdicts going through the SAME writer, the same audit chain and the
// same terminal-reject rule as money ties.
//
// Its own data dir, and deliberately its own FILE, because the mixed-tag test
// below needs a chain whose FIRST rows are v1 — and `verifyAuditChain` refuses a
// v1 row appended after a v2 one, so the legacy row has to be written before any
// decision goes through the door.

import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgliteFixtureDir } from "../../../testing/pglite-fixture";

const dataDir = pgliteFixtureDir("politicas-review-kinds-");

const { open, PGLITE_KEY } = await import("../internals");
type GlobalWithPglite = typeof globalThis & { [PGLITE_KEY]?: unknown };
const { makeReviewRepo, effortVerdictState, effortVerdictDecider } = await import("./review");
const { makeLedgerRepo } = await import("./ledger");
const { GENESIS_HASH, computeAuditRowHash } = await import("../ledger");

const BILL = "bill:tisk:141";
const PERSON = "psp:person:6790";
const TIE_SRC = "psp:person:6791";
const TIE_DST = "kg:company:ico:8801";

type Pg = Awaited<ReturnType<typeof open>>;
let pg: Pg;
let repo: ReturnType<typeof makeReviewRepo>;

async function nodeProps(id: string): Promise<Record<string, unknown>> {
  const { rows } = await pg.query<{ props: Record<string, unknown> }>(
    `select props from kg_node where id = $1`,
    [id],
  );
  return rows[0]?.props ?? {};
}

beforeAll(async () => {
  pg = await open();
  repo = makeReviewRepo(pg);

  // A bill whose forensic verdict the pipeline wrote and NOBODY could decide.
  await pg.query(
    `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
     values ($1, 'bill', 'Sněmovní tisk 141', $2::jsonb, 1, '{}'::jsonb)`,
    [BILL, JSON.stringify({ forensic_review_state: "pending_review", forensic_findings: 3, tisk: 141 })],
  );

  // An MP carrying three effort verdicts, all stamped `machine` by the loop.
  await pg.query(
    `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
     values ($1, 'person', 'Testovací Poslankyně', $2::jsonb, 1, '{}'::jsonb)`,
    [
      PERSON,
      JSON.stringify({
        effort_workhorse: true,
        effort_low_score_reason: "late_mandate",
        effort_rapporteur_load: 4,
        effort_provenance: {
          computedAt: "2026-07-24T17:41:34.737Z",
          pass: 14,
          verdicts: {
            effort_workhorse: { review_state: "machine" },
            effort_low_score_reason: { review_state: "machine" },
          },
        },
      }),
    ],
  );

  await pg.query(
    `insert into kg_edge (src, rel, dst, weight, props, provenance)
     values ($1, 'linked_to', $2, null, $3::jsonb, '{}'::jsonb)`,
    [TIE_SRC, TIE_DST, JSON.stringify({ review_state: "pending_review" })],
  );
});

afterAll(async () => {
  await pg.close();
  delete (globalThis as GlobalWithPglite)[PGLITE_KEY];
  rmSync(dataDir, { recursive: true, force: true });
});

describe("a legacy v1 row, then v2 rows through the door — ONE chain", () => {
  it("verifies across both tags, and the legacy row's stored bytes are never touched", async () => {
    const ledger = makeLedgerRepo(pg);

    // The exact insert the pre-G2 writer produced: twelve columns, no subject
    // discriminator, no hash_domain, hashed under politicas-audit-v1.
    const legacy = {
      id: "legacy-row-1",
      src: TIE_SRC,
      rel: "linked_to",
      dst: TIE_DST,
      decision: "needs-more",
      reviewer: "tester",
      note: null,
      decidedAt: "2026-08-01T09:00:00.000Z",
      priorState: "pending_review",
    };
    await pg.query(
      `insert into review_audit (id, src, rel, dst, decision, reviewer, note, decided_at, prior_state, chain_pos, prev_hash, row_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$11)`,
      [
        legacy.id, legacy.src, legacy.rel, legacy.dst, legacy.decision, legacy.reviewer,
        legacy.note, legacy.decidedAt, legacy.priorState, GENESIS_HASH,
        computeAuditRowHash(GENESIS_HASH, legacy),
      ],
    );
    expect((await ledger.verifyReviewChain()).ok).toBe(true);

    // A decision through the door lands a v2 row on top of it.
    expect((await repo.setTieReviewState(TIE_SRC, TIE_DST, "confirm", "tester", null)).ok).toBe(true);
    expect((await ledger.verifyReviewChain()).ok).toBe(true);

    const { rows } = await pg.query<Record<string, unknown>>(
      `select id, hash_domain, subject_kind, subject_id from review_audit order by chain_pos asc`,
    );
    expect(rows[0].id).toBe("legacy-row-1");
    expect(rows[0].hash_domain).toBeNull();
    expect(rows[0].subject_kind).toBeNull();
    expect(rows[1].hash_domain).toBe("politicas-audit-v2");
    expect(rows[1].subject_kind).toBe("tie");
    expect(rows[1].subject_id).toBe(`${TIE_SRC}|linked_to|${TIE_DST}`);
  });

  it("reads the legacy row back as a tie with its triple as the address", async () => {
    const audit = await repo.listReviewAudit({ src: TIE_SRC });
    const legacy = audit.find((r) => r.id === "legacy-row-1");
    expect(legacy?.subjectKind).toBe("tie");
    expect(legacy?.subjectId).toBe(`${TIE_SRC}|linked_to|${TIE_DST}`);
    expect(legacy?.hashDomain).toBe("politicas-audit-v1");
  });

  it("filtering by kind 'tie' RETURNS the legacy rows — they are ties", async () => {
    const ties = await repo.listReviewAudit({ subjectKind: "tie" });
    expect(ties.some((r) => r.id === "legacy-row-1")).toBe(true);
  });
});

describe("bill_verdict — /zakony's 141 pending verdicts get a writer", () => {
  it("errors honestly when the bill doesn't exist", async () => {
    const r = await repo.setReviewState({ kind: "bill_verdict", billId: "bill:tisk:0" }, "confirm", "tester", null);
    expect(r).toEqual({ ok: false, error: "bill not found" });
  });

  it("confirm writes forensic_review_state=verified, audits it, and keeps every other prop", async () => {
    const r = await repo.setReviewState({ kind: "bill_verdict", billId: BILL }, "confirm", "redakce", "ověřeno v e-Sbírce");
    expect(r).toEqual({ ok: true, reviewState: "verified" });

    const props = await nodeProps(BILL);
    expect(props.forensic_review_state).toBe("verified");
    expect(props.forensic_review_by).toBe("redakce");
    expect(props.forensic_review_note).toBe("ověřeno v e-Sbírce");
    // The merge is prop-preserving — a whole-object write here would have
    // dropped everything the forensics pass computed (memory/
    // kg-upsert-replaces-props). These two are the canaries.
    expect(props.forensic_findings).toBe(3);
    expect(props.tisk).toBe(141);

    const audit = await repo.listReviewAudit({ subjectKind: "bill_verdict", subjectId: BILL });
    expect(audit).toHaveLength(1);
    expect(audit[0].priorState).toBe("pending_review");
    expect(audit[0].hashDomain).toBe("politicas-audit-v2");
  });

  it("supersedes the prior node version into kg_node_history rather than overwriting it", async () => {
    const { rows } = await pg.query<{ n: number }>(
      `select count(*)::int as n from kg_node_history where id = $1`,
      [BILL],
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });

  it("refuses a reasonless reversal of a decided verdict — and writes NOTHING at all", async () => {
    const before = await repo.listReviewAudit({ subjectKind: "bill_verdict", subjectId: BILL });
    const r = await repo.setReviewState({ kind: "bill_verdict", billId: BILL }, "reject", "redakce", "  ");
    expect(r).toEqual({ ok: false, error: "reversal requires a note" });
    expect(await repo.listReviewAudit({ subjectKind: "bill_verdict", subjectId: BILL })).toHaveLength(before.length);
    expect((await nodeProps(BILL)).forensic_review_state).toBe("verified");
  });

  it("reject is TERMINAL — needs-more may return it to pending, never confirm-by-accident", async () => {
    expect(
      (await repo.setReviewState({ kind: "bill_verdict", billId: BILL }, "reject", "redakce", "nález neobstál")).ok,
    ).toBe(true);
    expect((await nodeProps(BILL)).forensic_review_state).toBe("rejected");

    // needs-more returns it to the queue — pending_review, never `verified`.
    const back = await repo.setReviewState({ kind: "bill_verdict", billId: BILL }, "needs-more", "redakce", "znovu otevřeno");
    expect(back).toEqual({ ok: true, reviewState: "pending_review" });
    expect((await nodeProps(BILL)).forensic_review_state).toBe("pending_review");
  });
});

describe("effort_verdict — a claim about a NAMED PERSON takes the same door", () => {
  it("errors when the MP does not carry that verdict prop at all", async () => {
    const r = await repo.setReviewState(
      { kind: "effort_verdict", personId: PERSON, field: "effort_tenure_class" },
      "confirm",
      "tester",
      null,
    );
    expect(r).toEqual({ ok: false, error: "effort verdict not found" });
  });

  it("confirm records the rung PER FIELD, leaving the other verdicts on the node alone", async () => {
    const r = await repo.setReviewState(
      { kind: "effort_verdict", personId: PERSON, field: "effort_workhorse" },
      "confirm",
      "redakce",
      null,
    );
    expect(r).toEqual({ ok: true, reviewState: "verified" });

    const props = await nodeProps(PERSON);
    expect(effortVerdictState(props, "effort_workhorse")).toBe("verified");
    expect(effortVerdictDecider(props, "effort_workhorse")?.by).toBe("redakce");
    // Rejecting/confirming "workhorse" says NOTHING about the low-score reason.
    expect(effortVerdictState(props, "effort_low_score_reason")).toBe("machine");
    // …and the rest of effort_provenance survives the nested merge.
    const prov = props.effort_provenance as Record<string, unknown>;
    expect(prov.computedAt).toBe("2026-07-24T17:41:34.737Z");
    expect(prov.pass).toBe(14);
    // …as do the verdict props themselves.
    expect(props.effort_workhorse).toBe(true);
    expect(props.effort_rapporteur_load).toBe(4);
  });

  it("the audit row addresses person#field, so one MP's two verdicts are two claims", async () => {
    const forWorkhorse = await repo.listReviewAudit({
      subjectKind: "effort_verdict",
      subjectId: `${PERSON}#effort_workhorse`,
    });
    expect(forWorkhorse).toHaveLength(1);
    expect(forWorkhorse[0].priorState).toBe("machine");
    expect(
      await repo.listReviewAudit({ subjectKind: "effort_verdict", subjectId: `${PERSON}#effort_low_score_reason` }),
    ).toHaveLength(0);
  });

  it("a rejected verdict is rejected — the door never produces `machine`", async () => {
    const r = await repo.setReviewState(
      { kind: "effort_verdict", personId: PERSON, field: "effort_low_score_reason" },
      "reject",
      "redakce",
      null,
    );
    expect(r).toEqual({ ok: true, reviewState: "rejected" });
    const props = await nodeProps(PERSON);
    expect(effortVerdictState(props, "effort_low_score_reason")).toBe("rejected");
    // The FIRST human look at a machine verdict is not a reversal, so it needed
    // no note; overturning THIS decision now does.
    const reversal = await repo.setReviewState(
      { kind: "effort_verdict", personId: PERSON, field: "effort_low_score_reason" },
      "confirm",
      "redakce",
      null,
    );
    expect(reversal).toEqual({ ok: false, error: "reversal requires a note" });
  });

  it("a verdict prop the loop never stamped reads as unrung, not as machine-by-default", async () => {
    // `effort_rapporteur_load` exists on the node with no `verdicts` entry. The
    // reader must say "nothing recorded", never invent a rung for it.
    expect(effortVerdictState(await nodeProps(PERSON), "effort_rapporteur_load")).toBeNull();
    expect(effortVerdictDecider(await nodeProps(PERSON), "effort_rapporteur_load")).toBeNull();
  });
});

describe("kinds declared but carried over", () => {
  it("refuses a tripwire decision rather than recording one nothing will read back", async () => {
    const r = await repo.setReviewState({ kind: "tripwire", candidateId: "tw-1" }, "reject", "operátor", null);
    expect(r).toEqual({ ok: false, error: 'no writer for claim kind "tripwire"' });
  });

  it("refuses a lead decision the same way", async () => {
    const r = await repo.setReviewState({ kind: "lead", leadId: "lead-1" }, "confirm", "operátor", null);
    expect(r).toEqual({ ok: false, error: 'no writer for claim kind "lead"' });
  });
});

describe("the whole chain, over three claim kinds", () => {
  it("verifies end to end and counts a denominator for every declared kind", async () => {
    const ledger = makeLedgerRepo(pg);
    expect((await ledger.verifyReviewChain()).ok).toBe(true);

    const counts = await ledger.countReviewAudit();
    expect(counts.byKind.tie).toBeGreaterThan(0);
    expect(counts.byKind.bill_verdict).toBeGreaterThan(0);
    expect(counts.byKind.effort_verdict).toBeGreaterThan(0);
    // Declared, no writer yet — present with a zero, never absent.
    expect(counts.byKind.tripwire).toBe(0);
    expect(counts.byKind.lead).toBe(0);
    expect(Object.values(counts.byKind).reduce((a, b) => a + b, 0)).toBe(counts.total);
  });
});
