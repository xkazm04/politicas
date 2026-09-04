// Pure-function tests for the tamper-evident ledger primitives. No PGlite here —
// the DB integration (chain append through the review write path, restart
// survival, sealing) lives in repositories/ledger.test.ts.

import { describe, expect, it } from "vitest";
import {
  AUDIT_DOMAIN_V1,
  AUDIT_DOMAIN_V2,
  EMPTY_MERKLE_ROOT,
  GENESIS_HASH,
  canonicalJson,
  computeAuditRowHash,
  computeAuditRowHashFor,
  computeAuditRowHashV2,
  merkleLeafHash,
  merkleRoot,
  sha256Hex,
  verifyAuditChain,
  type AuditHashPayload,
  type ChainedAuditRow,
} from "./ledger";

describe("canonicalJson — pinned serialization", () => {
  it("sorts object keys by code-unit order, recursively, with no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { z: true, m: [1, "x"] } })).toBe('{"a":{"m":[1,"x"],"z":true},"b":1}');
  });

  it("is insensitive to key insertion order (the whole point)", () => {
    const one = canonicalJson({ src: "s", dst: "d", note: null });
    const two = canonicalJson({ note: null, dst: "d", src: "s" });
    expect(one).toBe(two);
  });

  it("serializes Dates as ISO strings and bigints as decimal strings", () => {
    const d = new Date("2026-07-30T12:00:00.123Z");
    expect(canonicalJson({ at: d, n: BigInt(42) })).toBe('{"at":"2026-07-30T12:00:00.123Z","n":"42"}');
  });

  it("follows JSON.stringify semantics for undefined and non-finite numbers", () => {
    expect(canonicalJson({ a: undefined, b: NaN, c: Infinity })).toBe('{"b":null,"c":null}');
    expect(canonicalJson([undefined, NaN])).toBe("[null,null]");
    expect(canonicalJson(undefined)).toBe("null");
  });

  it("escapes strings exactly like JSON.stringify (czech diacritics pass through)", () => {
    expect(canonicalJson({ note: 'chybí "doklad"\n' })).toBe('{"note":"chybí \\"doklad\\"\\n"}');
  });
});

const payload = (over: Partial<AuditHashPayload> = {}): AuditHashPayload => ({
  id: "uuid-1",
  src: "psp:person:1",
  rel: "linked_to",
  dst: "kg:company:ico:1",
  decision: "confirm",
  reviewer: "tester",
  note: null,
  decidedAt: "2026-07-30T10:00:00.000Z",
  priorState: "pending_review",
  ...over,
});

describe("computeAuditRowHash", () => {
  it("is deterministic and sensitive to every field and to prevHash", () => {
    const h = computeAuditRowHash(GENESIS_HASH, payload());
    expect(h).toBe(computeAuditRowHash(GENESIS_HASH, payload()));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(computeAuditRowHash(GENESIS_HASH, payload({ note: "x" }))).not.toBe(h);
    expect(computeAuditRowHash(sha256Hex("other"), payload())).not.toBe(h);
  });
});

function makeChain(count: number): ChainedAuditRow[] {
  const rows: ChainedAuditRow[] = [];
  let prevHash = GENESIS_HASH;
  for (let i = 1; i <= count; i++) {
    const p = payload({ id: `uuid-${i}`, decidedAt: `2026-07-30T10:00:0${i}.000Z` });
    const rowHash = computeAuditRowHash(prevHash, p);
    rows.push({ ...p, chainPos: i, prevHash, rowHash });
    prevHash = rowHash;
  }
  return rows;
}

describe("verifyAuditChain (pure)", () => {
  it("empty chain is valid with a null head", () => {
    expect(verifyAuditChain([])).toEqual({ ok: true, length: 0, headHash: null });
  });

  it("a well-formed chain verifies, head = last row's hash", () => {
    const rows = makeChain(4);
    expect(verifyAuditChain(rows)).toEqual({ ok: true, length: 4, headHash: rows[3].rowHash });
  });

  it("a bit-flipped payload is caught at ITS position, not later", () => {
    const rows = makeChain(4);
    rows[1] = { ...rows[1], note: "tampered" };
    const v = verifyAuditChain(rows);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.firstDivergence.chainPos).toBe(2);
      expect(v.firstDivergence.reason).toBe("row-hash-mismatch");
    }
  });

  it("a deleted row surfaces as a chain_pos gap", () => {
    const rows = makeChain(3);
    const v = verifyAuditChain([rows[0], rows[2]]);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.firstDivergence.reason).toBe("gap-in-chain-pos");
  });

  it("a rewritten prev_hash link is caught as prev-hash-mismatch", () => {
    const rows = makeChain(2);
    rows[1] = { ...rows[1], prevHash: sha256Hex("forged") };
    const v = verifyAuditChain(rows);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.firstDivergence.reason).toBe("prev-hash-mismatch");
  });
});

/* ── G2: the door widened to every claim kind, without rehashing a single row ── */

/** A chain that runs v1 rows first, then switches to v2 — the real shape after G2. */
function makeMixedChain(v1Count: number, v2Count: number): ChainedAuditRow[] {
  const rows: ChainedAuditRow[] = [];
  let prevHash = GENESIS_HASH;
  let pos = 0;
  for (let i = 1; i <= v1Count; i++) {
    const p = payload({ id: `v1-${i}`, decidedAt: `2026-07-30T10:00:0${i}.000Z` });
    const rowHash = computeAuditRowHash(prevHash, p);
    rows.push({ ...p, chainPos: ++pos, prevHash, rowHash, hashDomain: null });
    prevHash = rowHash;
  }
  for (let i = 1; i <= v2Count; i++) {
    const p = {
      ...payload({ id: `v2-${i}`, decidedAt: `2026-09-04T10:00:0${i}.000Z` }),
      subjectKind: "bill_verdict",
      subjectId: `bill:tisk:${i}`,
    };
    const rowHash = computeAuditRowHashV2(prevHash, p);
    rows.push({ ...p, chainPos: ++pos, prevHash, rowHash, hashDomain: AUDIT_DOMAIN_V2 });
    prevHash = rowHash;
  }
  return rows;
}

describe("audit hash v2 — a second domain tag, never an edit of the first", () => {
  it("the two tags are the exact literals the row vocabulary spells out", () => {
    // lib/db/types.ts writes these out rather than importing them (it keeps zero
    // imports); if either literal ever drifts, this is the test that says so.
    expect(AUDIT_DOMAIN_V1).toBe("politicas-audit-v1");
    expect(AUDIT_DOMAIN_V2).toBe("politicas-audit-v2");
  });

  it("v2 over the same narrow fields is a DIFFERENT hash from v1 — the tag separates them", () => {
    const p = { ...payload(), subjectKind: "tie", subjectId: "a|linked_to|b" };
    expect(computeAuditRowHashV2(GENESIS_HASH, p)).not.toBe(computeAuditRowHash(GENESIS_HASH, p));
  });

  it("v2 is sensitive to the claim kind and to the address", () => {
    const base = { ...payload(), subjectKind: "tie", subjectId: "a|linked_to|b" };
    const h = computeAuditRowHashV2(GENESIS_HASH, base);
    expect(computeAuditRowHashV2(GENESIS_HASH, { ...base, subjectKind: "bill_verdict" })).not.toBe(h);
    expect(computeAuditRowHashV2(GENESIS_HASH, { ...base, subjectId: "a|linked_to|c" })).not.toBe(h);
  });

  it("computeAuditRowHashFor(v1) IGNORES the subject fields — a v1 row's hash never moves", () => {
    // This is the load-bearing property of the whole design: legacy rows are
    // READ as tie + triple, so they arrive at the verifier carrying subject
    // fields they were not hashed with. If v1 hashing looked at them, every row
    // written before 2026-09-04 would fail verification.
    const p = { ...payload(), subjectKind: "tie", subjectId: "a|linked_to|b" };
    const bare = computeAuditRowHash(GENESIS_HASH, payload());
    expect(computeAuditRowHashFor(AUDIT_DOMAIN_V1, GENESIS_HASH, p)).toBe(bare);
    expect(
      computeAuditRowHashFor(AUDIT_DOMAIN_V1, GENESIS_HASH, { ...p, subjectKind: "effort_verdict" }),
    ).toBe(bare);
  });
});

describe("verifyAuditChain across both tags", () => {
  it("accepts a chain that switches from v1 to v2 partway through", () => {
    const rows = makeMixedChain(3, 3);
    expect(verifyAuditChain(rows)).toEqual({ ok: true, length: 6, headHash: rows[5].rowHash });
  });

  it("a pure-v1 chain still verifies unchanged (rows carry no hashDomain at all)", () => {
    const rows = makeMixedChain(4, 0);
    expect(verifyAuditChain(rows).ok).toBe(true);
  });

  it("tampering with a v2 row's subject_kind is caught — the kind is inside the hash", () => {
    const rows = makeMixedChain(2, 2);
    rows[2] = { ...rows[2], subjectKind: "effort_verdict" };
    const v = verifyAuditChain(rows);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.firstDivergence.chainPos).toBe(3);
      expect(v.firstDivergence.reason).toBe("row-hash-mismatch");
    }
  });

  it("a v1 row APPENDED after a v2 row is a divergence, not a tolerated legacy row", () => {
    // The writer only ever moves forward, so the only way to produce this
    // sequence is by hand — which is exactly what the chain exists to catch.
    // The row is otherwise perfectly formed: correct prevHash, correct v1 hash.
    const rows = makeMixedChain(1, 1);
    const prevHash = rows[1].rowHash;
    const p = payload({ id: "smuggled", decidedAt: "2026-09-05T00:00:00.000Z" });
    rows.push({ ...p, chainPos: 3, prevHash, rowHash: computeAuditRowHash(prevHash, p), hashDomain: null });
    const v = verifyAuditChain(rows);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.firstDivergence.chainPos).toBe(3);
      expect(v.firstDivergence.reason).toBe("hash-domain-regression");
    }
  });
});

describe("merkleRoot", () => {
  const leaves = ["a", "b", "c", "d", "e"].map((s) => sha256Hex(s));

  it("is deterministic: same leaves, same order → same root", () => {
    expect(merkleRoot(leaves)).toBe(merkleRoot([...leaves]));
    expect(merkleRoot(leaves)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is order- and content-sensitive", () => {
    expect(merkleRoot([leaves[1], leaves[0], ...leaves.slice(2)])).not.toBe(merkleRoot(leaves));
    expect(merkleRoot(leaves.slice(0, 4))).not.toBe(merkleRoot(leaves));
  });

  it("empty → pinned constant; single leaf → the leaf itself", () => {
    expect(merkleRoot([])).toBe(EMPTY_MERKLE_ROOT);
    expect(merkleRoot([leaves[0]])).toBe(leaves[0]);
  });

  it("leaf hashing is domain-separated by table", () => {
    const row = { id: "x", value: 1 };
    expect(merkleLeafHash("person", row)).not.toBe(merkleLeafHash("organ", row));
  });
});
