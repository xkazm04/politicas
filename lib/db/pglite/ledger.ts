// Tamper-evident ledger primitives — PURE functions only (no connection, no I/O),
// so verification can run anywhere (server, script, an external auditor's laptop)
// against exported rows and produce the same answer bit-for-bit.
//
// ── Canonical serialization (VERSIONED — changing ANY rule breaks every stored
//    hash, so a change requires a new domain-separation tag, never an edit) ──────
//
//  canonicalJson(value) is JSON with these pinned rules:
//   • Object keys sorted by UTF-16 code-unit order (`Array.prototype.sort()` with
//     no comparator) — NOT locale order. No whitespace anywhere.
//   • Strings/keys escaped exactly as `JSON.stringify` escapes them.
//   • Numbers serialized by `JSON.stringify` (shortest round-trip form; -0 → "0").
//     Non-finite numbers (NaN/±Infinity) → `null`, matching JSON.stringify.
//   • `Date` → its `toISOString()` (millisecond precision, trailing "Z") as a JSON
//     string; an invalid Date falls back to `String(date)` so it stays representable.
//   • `bigint` → its decimal string, as a JSON string.
//   • `undefined`/function/symbol: omitted as object values, `null` inside arrays
//     (JSON.stringify semantics), `"null"` at the top level.
//
// ── Hash domains ────────────────────────────────────────────────────────────────
//  Every hash is sha256 over a domain-separated preimage, so an audit-row hash can
//  never be confused with a Merkle leaf, nor a leaf with an interior node:
//   audit row     sha256("politicas-audit-v1\n"  + prevHash + "\n" + canonicalJson(payload))
//   Merkle leaf   sha256("politicas-merkle-leaf-v1\n" + table + "\n" + canonicalJson(row))
//   Merkle node   sha256("politicas-merkle-node-v1\n" + left  + "\n" + right)
//  All hashes are lowercase hex. The chain genesis `prevHash` is 64 zeros.

import { createHash } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

/** Root of a Merkle tree over ZERO leaves — a pinned constant, not an error. */
export const EMPTY_MERKLE_ROOT = sha256Hex("politicas-merkle-empty-v1");

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** See the serialization contract at the top of this file. */
export function canonicalJson(value: unknown): string {
  return stringifyCanonical(value) ?? "null";
}

function stringifyCanonical(v: unknown): string | undefined {
  if (v === null) return "null";
  switch (typeof v) {
    case "string":
      return JSON.stringify(v);
    case "number":
      return Number.isFinite(v) ? JSON.stringify(v) : "null";
    case "boolean":
      return v ? "true" : "false";
    case "bigint":
      return JSON.stringify(v.toString());
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
  }
  if (v instanceof Date) {
    return JSON.stringify(Number.isFinite(v.getTime()) ? v.toISOString() : String(v));
  }
  if (Array.isArray(v)) {
    return `[${v.map((x) => stringifyCanonical(x) ?? "null").join(",")}]`;
  }
  const obj = v as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(obj).sort()) {
    const s = stringifyCanonical(obj[key]);
    if (s !== undefined) parts.push(`${JSON.stringify(key)}:${s}`);
  }
  return `{${parts.join(",")}}`;
}

/* ── review_audit hash chain ─────────────────────────────────────────────────── */

/**
 * The EXACT fields that enter an audit row's hash, as stored in `review_audit`.
 * `decidedAt` is the ISO instant the writer generated (ms precision + "Z") — the
 * DB round-trips it losslessly (timestamptz keeps microseconds; ms ⊂ µs), so a
 * verifier re-reading the row recomputes the identical hash.
 */
export interface AuditHashPayload {
  id: string;
  src: string;
  rel: string;
  dst: string;
  decision: string;
  reviewer: string;
  note: string | null;
  decidedAt: string;
  priorState: string | null;
}

export function computeAuditRowHash(prevHash: string, payload: AuditHashPayload): string {
  // Field names are pinned here (snake-free, sorted by canonicalJson) — renaming a
  // TS property would silently change every future hash, hence this explicit object.
  return sha256Hex(
    `politicas-audit-v1\n${prevHash}\n${canonicalJson({
      id: payload.id,
      src: payload.src,
      rel: payload.rel,
      dst: payload.dst,
      decision: payload.decision,
      reviewer: payload.reviewer,
      note: payload.note,
      decidedAt: payload.decidedAt,
      priorState: payload.priorState,
    })}`,
  );
}

/** One chained audit row as needed by verification (a projection of ReviewAuditRow). */
export interface ChainedAuditRow extends AuditHashPayload {
  chainPos: number;
  prevHash: string;
  rowHash: string;
}

export interface ChainDivergence {
  /** 0-based index into the verified sequence. */
  index: number;
  chainPos: number;
  id: string;
  reason: "gap-in-chain-pos" | "prev-hash-mismatch" | "row-hash-mismatch";
  expected: string;
  actual: string;
}

export type ChainVerification =
  | { ok: true; length: number; headHash: string | null }
  | { ok: false; length: number; firstDivergence: ChainDivergence };

/**
 * Walk the chain in ONE O(n) pass and report the FIRST divergence.
 * `rows` must be the chained rows ordered by chainPos ascending (legacy rows
 * written before the chain existed carry no hash and are not part of it).
 * An empty chain is valid: { ok: true, length: 0, headHash: null }.
 */
export function verifyAuditChain(rows: readonly ChainedAuditRow[]): ChainVerification {
  let prevHash = GENESIS_HASH;
  let prevPos = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const diverge = (reason: ChainDivergence["reason"], expected: string, actual: string): ChainVerification => ({
      ok: false,
      length: rows.length,
      firstDivergence: { index: i, chainPos: row.chainPos, id: row.id, reason, expected, actual },
    });
    if (row.chainPos !== prevPos + 1) {
      // Positions are writer-assigned 1,2,3…; a hole means a row was deleted.
      return diverge("gap-in-chain-pos", String(prevPos + 1), String(row.chainPos));
    }
    if (row.prevHash !== prevHash) {
      return diverge("prev-hash-mismatch", prevHash, row.prevHash);
    }
    const recomputed = computeAuditRowHash(row.prevHash, row);
    if (recomputed !== row.rowHash) {
      return diverge("row-hash-mismatch", recomputed, row.rowHash);
    }
    prevHash = row.rowHash;
    prevPos = row.chainPos;
  }
  return { ok: true, length: rows.length, headHash: rows.length ? prevHash : null };
}

/* ── Merkle root over ingest-run row hashes ──────────────────────────────────── */

/** Leaf hash for one stored row of `table` (rows are hashed as read back, i.e. as served). */
export function merkleLeafHash(table: string, row: Record<string, unknown>): string {
  return sha256Hex(`politicas-merkle-leaf-v1\n${table}\n${canonicalJson(row)}`);
}

/**
 * Deterministic binary Merkle root over an ORDERED list of leaf hashes.
 *  • [] → EMPTY_MERKLE_ROOT (pinned constant).
 *  • [x] → x (a single leaf is its own root; leaves are already domain-separated
 *    hashes, so a leaf can never be forged as an interior node or vice versa).
 *  • Odd node at a level is promoted unchanged to the next level (no duplication).
 * Same leaves in the same order ⇒ same root, on any runtime.
 */
export function merkleRoot(leaves: readonly string[]): string {
  if (leaves.length === 0) return EMPTY_MERKLE_ROOT;
  let level: string[] = [...leaves];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i + 1 < level.length; i += 2) {
      next.push(sha256Hex(`politicas-merkle-node-v1\n${level[i]}\n${level[i + 1]}`));
    }
    if (level.length % 2 === 1) next.push(level[level.length - 1]);
    level = next;
  }
  return level[0];
}
