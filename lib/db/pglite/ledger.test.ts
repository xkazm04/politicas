// Pure-function tests for the tamper-evident ledger primitives. No PGlite here —
// the DB integration (chain append through the review write path, restart
// survival, sealing) lives in repositories/ledger.test.ts.

import { describe, expect, it } from "vitest";
import {
  EMPTY_MERKLE_ROOT,
  GENESIS_HASH,
  canonicalJson,
  computeAuditRowHash,
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
