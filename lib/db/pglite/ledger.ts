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
//   audit row v1  sha256("politicas-audit-v1\n"  + prevHash + "\n" + canonicalJson(payload))
//   audit row v2  sha256("politicas-audit-v2\n"  + prevHash + "\n" + canonicalJson(payload
//                        + subjectKind + subjectId))
//   Merkle leaf   sha256("politicas-merkle-leaf-v1\n" + table + "\n" + canonicalJson(row))
//   Merkle node   sha256("politicas-merkle-node-v1\n" + left  + "\n" + right)
//  All hashes are lowercase hex. The chain genesis `prevHash` is 64 zeros.
//
// ── Why v2 is a SECOND tag and not an edit of v1 ────────────────────────────────
//  When `review_audit` grew a claim-kind discriminator (G2, 2026-09-04) the audit
//  preimage had to widen. Editing the v1 preimage would have invalidated every row
//  ever written; recomputing the old rows under the wider preimage would have been
//  worse — the whole point of the chain is that a stored hash is evidence about the
//  bytes that existed WHEN IT WAS TAKEN. So v1 rows keep their v1 hashes forever,
//  new rows are taken under v2, and `verifyAuditChain` walks a chain that changes
//  tag partway through. The one thing it will NOT accept is a REGRESSION: once a
//  chain has produced a v2 row, a later v1 row is a divergence, because the only
//  way to author one is to have written it by hand.

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
    `${AUDIT_DOMAIN_V1}\n${prevHash}\n${canonicalJson({
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

/* ── v2: the same row, plus the claim kind it decides ────────────────────────── */

export const AUDIT_DOMAIN_V1 = "politicas-audit-v1";
export const AUDIT_DOMAIN_V2 = "politicas-audit-v2";

/**
 * The tag a stored row's hash was taken under. `hash_domain is null` in the store
 * means v1 — every row that predates the column. It is never inferred from the
 * row's other columns: `subject_kind` is derived at read time for legacy rows, so
 * a present `subject_kind` proves nothing about which preimage was hashed.
 */
export type AuditHashDomain = typeof AUDIT_DOMAIN_V1 | typeof AUDIT_DOMAIN_V2;

export interface AuditHashPayloadV2 extends AuditHashPayload {
  /** The claim kind this row decides — see REVIEW_SUBJECT_KINDS in lib/db/types.ts. */
  subjectKind: string;
  /** The claim's stable address, whatever its shape (edge triple, bill id, person#field). */
  subjectId: string;
}

export function computeAuditRowHashV2(prevHash: string, payload: AuditHashPayloadV2): string {
  return sha256Hex(
    `${AUDIT_DOMAIN_V2}\n${prevHash}\n${canonicalJson({
      id: payload.id,
      src: payload.src,
      rel: payload.rel,
      dst: payload.dst,
      subjectKind: payload.subjectKind,
      subjectId: payload.subjectId,
      decision: payload.decision,
      reviewer: payload.reviewer,
      note: payload.note,
      decidedAt: payload.decidedAt,
      priorState: payload.priorState,
    })}`,
  );
}

/**
 * Recompute a row's hash under the tag it declares. A v1 row is hashed over the
 * narrow preimage even when it carries subject columns (they were derived, not
 * stored, when the hash was taken).
 */
export function computeAuditRowHashFor(
  domain: AuditHashDomain,
  prevHash: string,
  payload: AuditHashPayloadV2,
): string {
  return domain === AUDIT_DOMAIN_V2
    ? computeAuditRowHashV2(prevHash, payload)
    : computeAuditRowHash(prevHash, payload);
}

/** One chained audit row as needed by verification (a projection of ReviewAuditRow). */
export interface ChainedAuditRow extends AuditHashPayload {
  chainPos: number;
  prevHash: string;
  rowHash: string;
  /**
   * Absent/null ⇒ v1 (the row predates the tag column). Present ⇒ hashed under
   * exactly that tag. Optional so every existing caller keeps compiling and keeps
   * verifying v1 rows exactly as before.
   */
  hashDomain?: AuditHashDomain | null;
  subjectKind?: string | null;
  subjectId?: string | null;
}

export interface ChainDivergence {
  /** 0-based index into the verified sequence. */
  index: number;
  chainPos: number;
  id: string;
  reason: "gap-in-chain-pos" | "prev-hash-mismatch" | "row-hash-mismatch" | "hash-domain-regression";
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
  let prevDomain: AuditHashDomain = AUDIT_DOMAIN_V1;
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
    // Both tags are accepted IN SEQUENCE: v1 rows, then v2 rows from the row where
    // the door was generalised. Going BACK to v1 after a v2 row is refused — the
    // writer only ever moves forward, so a regression is authored, not written.
    const domain: AuditHashDomain = row.hashDomain ?? AUDIT_DOMAIN_V1;
    if (prevDomain === AUDIT_DOMAIN_V2 && domain === AUDIT_DOMAIN_V1) {
      return diverge("hash-domain-regression", AUDIT_DOMAIN_V2, domain);
    }
    const recomputed = computeAuditRowHashFor(domain, row.prevHash, {
      ...row,
      subjectKind: row.subjectKind ?? "",
      subjectId: row.subjectId ?? "",
    });
    if (recomputed !== row.rowHash) {
      return diverge("row-hash-mismatch", recomputed, row.rowHash);
    }
    prevHash = row.rowHash;
    prevPos = row.chainPos;
    prevDomain = domain;
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
