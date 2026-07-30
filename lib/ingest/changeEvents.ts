// Civic seismograph — the snapshot-diff layer of the ingest stack (moonshot 5C).
//
// The psp.cz dumps are versionless FULL snapshots: an adapter run replaces rows
// in place, and "what changed since the last run" was unrecoverable. This module
// closes that loop with three PURE pieces (no IO — the repository in
// lib/db/pglite/repositories/changes.ts owns persistence):
//
//   1. `diffSnapshots` — an exact set-difference over natural keys (the `id`
//      convention `<publisher>:<table>:<source id>` makes this precise), with a
//      canonical-JSON content compare for the "changed" bucket.
//   2. Typed event builders — a diff (or a bitemporal version trail) becomes
//      `ChangeEvent`s: mandate change, registry-role change, new contract, new
//      tie candidate, human-gate decision. Event ids are DETERMINISTIC, so
//      re-deriving the same input re-produces the same events (idempotent
//      upsert, never a duplicate stream).
//   3. A codec — `encodeChangeEvent` / `parseChangeEvent` — the pinned wire
//      shape a feed or a subscriber reads, validated on the way back in.
//
// EPOCH DISCIPLINE (data-ingestion.md M2 "first-run flood"): the bitemporal
// columns were backfilled with the migration instant, so every pre-existing kg
// row shares one `recorded_at`. That instant is the EPOCH — versions recorded
// AT it are the silent event zero; only versions recorded strictly after it
// become events. review_audit needs no epoch: it is append-only and its
// decided_at was always genuine record time.

export const CHANGE_EVENT_TYPES = [
  // Backfillable today (bitemporal kg history + review_audit):
  "tie-new", // a linked_to tie candidate entered the graph
  "tie-changed", // a linked_to tie's substance changed (review-only flips excluded)
  "contract-new", // a supplies edge (contract) entered the graph
  "review-decision", // a human-gate decision was recorded
  // Forward snapshot-diff events (emitted by adapter runs from here on):
  "mandate-new",
  "mandate-changed",
  "mandate-removed",
  "role-new",
  "role-changed",
  "role-removed",
] as const;

export type ChangeEventType = (typeof CHANGE_EVENT_TYPES)[number];

const EVENT_TYPE_SET: ReadonlySet<string> = new Set(CHANGE_EVENT_TYPES);

/**
 * One typed, dated, evidence-pointed change event. `recordedAt` is RECORD time
 * — when the store learned the fact — never world time (the deník's existing
 * "účinné" stream owns world time; this is the "zaznamenáno" stream).
 */
export interface ChangeEvent {
  /** Deterministic natural key `chev:<type>:<…>` — re-derivation is idempotent. */
  id: string;
  eventType: ChangeEventType;
  /** ISO instant the store learned this — record time. */
  recordedAt: string;
  /** Public watch keys (`poslanec:<pspId>` | `firma:<ico>` | `tisk:<n>`) — the `?entita=` filter. */
  entityKeys: string[];
  /** Graph endpoints the event points at (evidence pointer), if any. */
  src: string | null;
  dst: string | null;
  /** Where the event was derived FROM (table / rel / audit id …). */
  evidence: Record<string, unknown>;
  /** Verbatim name of the deriving record — cited on every rendered row. */
  source: string;
  /** Typed extras a consumer may render (review_state, role, label …). */
  payload: Record<string, unknown>;
}

/* ── canonical JSON + codec ─────────────────────────────────────────────────── */

/** Key-sorted, stable serialization — content equality independent of key order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

/** The pinned wire shape of an event (what a feed emits / a subscriber stores). */
export function encodeChangeEvent(e: ChangeEvent): string {
  return canonicalJson({
    id: e.id,
    eventType: e.eventType,
    recordedAt: e.recordedAt,
    entityKeys: e.entityKeys,
    src: e.src,
    dst: e.dst,
    evidence: e.evidence,
    source: e.source,
    payload: e.payload,
  });
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Validate an unknown payload back into a `ChangeEvent`. Returns null (never
 * throws, never "repairs") on any malformed field — a subscriber must be able
 * to tell a bad payload from an empty one.
 */
export function parseChangeEvent(input: unknown): ChangeEvent | null {
  const raw: unknown = typeof input === "string" ? safeJsonParse(input) : input;
  if (!isRecord(raw)) return null;
  const { id, eventType, recordedAt, entityKeys, src, dst, evidence, source, payload } = raw;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof eventType !== "string" || !EVENT_TYPE_SET.has(eventType)) return null;
  if (typeof recordedAt !== "string" || !Number.isFinite(Date.parse(recordedAt))) return null;
  if (!Array.isArray(entityKeys) || entityKeys.some((k) => typeof k !== "string")) return null;
  if (src !== null && typeof src !== "string") return null;
  if (dst !== null && typeof dst !== "string") return null;
  if (!isRecord(evidence) || !isRecord(payload)) return null;
  if (typeof source !== "string" || source.length === 0) return null;
  return {
    id,
    eventType: eventType as ChangeEventType,
    recordedAt,
    entityKeys: entityKeys as string[],
    src: src,
    dst: dst,
    evidence,
    source,
    payload,
  };
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // Malformed JSON is a malformed event — parseChangeEvent maps it to null.
    return null;
  }
}

/* ── public entity keys (mirror of features/denik/deriveDenik — the watch URL) ─ */

/** `psp:person:6790` → 6790; anything else → null. */
export function pspIdFromNodeId(nodeId: string | null): number | null {
  const m = (nodeId ?? "").match(/^psp:person:(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** Company node id → trailing IČO segment (`kg:company:ico:04544152` → "04544152"). */
export function icoFromNodeId(nodeId: string | null): string | null {
  const seg = (nodeId ?? "").split(":").pop() ?? "";
  return /^\d{6,8}$/.test(seg) ? seg : null;
}

/** Watch keys for a person↔company edge — only the parseable endpoints. */
export function edgeEntityKeys(src: string | null, dst: string | null): string[] {
  const keys: string[] = [];
  const pspId = pspIdFromNodeId(src);
  if (pspId !== null) keys.push(`poslanec:${pspId}`);
  const ico = icoFromNodeId(dst) ?? icoFromNodeId(src);
  if (ico !== null) keys.push(`firma:${ico}`);
  return keys;
}

/* ── 1. snapshot diff ───────────────────────────────────────────────────────── */

export interface SnapshotDiff<T> {
  added: T[];
  removed: T[];
  changed: { before: T; after: T }[];
}

/**
 * Exact diff of two ingests of the same source, keyed on the natural `id`.
 * Content equality is canonical-JSON (key order never counts as a change);
 * pass `contentOf` to compare a projection (e.g. to ignore fetch metadata —
 * a re-fetch of identical data must NOT read as a change).
 * Output order is deterministic: ascending id in every bucket.
 */
export function diffSnapshots<T extends { id: string }>(
  prev: readonly T[],
  next: readonly T[],
  contentOf: (row: T) => unknown = (row) => row,
): SnapshotDiff<T> {
  const prevById = new Map<string, T>();
  for (const r of prev) prevById.set(r.id, r);
  const nextById = new Map<string, T>();
  for (const r of next) nextById.set(r.id, r);

  const added: T[] = [];
  const changed: { before: T; after: T }[] = [];
  for (const [id, after] of nextById) {
    const before = prevById.get(id);
    if (before === undefined) added.push(after);
    else if (canonicalJson(contentOf(before)) !== canonicalJson(contentOf(after)))
      changed.push({ before, after });
  }
  const removed: T[] = [];
  for (const [id, before] of prevById) {
    if (!nextById.has(id)) removed.push(before);
  }

  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  added.sort(byId);
  removed.sort(byId);
  changed.sort((a, b) => a.after.id.localeCompare(b.after.id));
  return { added, removed, changed };
}

/* ── 2a. forward events from a snapshot diff (adapter runs) ─────────────────── */

/** The slice of a mandate row the diff layer needs (structural, not the full MandateRow). */
export interface MandateLike {
  id: string;
  personPspId: number;
  termCode: string;
}

/** The slice of a membership row the diff layer needs. */
export interface MembershipLike {
  id: string;
  personPspId: number;
  functionNameCz: string | null;
}

const SOURCE_SNAPSHOT = "diff snímků ingestů — psp.cz";

function snapshotEvent(
  eventType: ChangeEventType,
  rowId: string,
  recordedAt: string,
  entityKeys: string[],
  table: string,
  payload: Record<string, unknown>,
): ChangeEvent {
  // "changed" ids carry the run instant: each observed change is its own event;
  // re-deriving the SAME run (same recordedAt) stays idempotent.
  const stamped = eventType.endsWith("-changed") ? `${rowId}:${recordedAt}` : rowId;
  return {
    id: `chev:${eventType}:${stamped}`,
    eventType,
    recordedAt,
    entityKeys,
    src: null,
    dst: null,
    evidence: { table, rowId },
    source: SOURCE_SNAPSHOT,
    payload,
  };
}

/** Mandate diff → mandate-new / mandate-changed / mandate-removed events. */
export function mandateChangeEvents(diff: SnapshotDiff<MandateLike>, recordedAt: string): ChangeEvent[] {
  const keysOf = (m: MandateLike) => [`poslanec:${m.personPspId}`];
  return [
    ...diff.added.map((m) =>
      snapshotEvent("mandate-new", m.id, recordedAt, keysOf(m), "mandate", { termCode: m.termCode }),
    ),
    ...diff.changed.map(({ after }) =>
      snapshotEvent("mandate-changed", after.id, recordedAt, keysOf(after), "mandate", { termCode: after.termCode }),
    ),
    ...diff.removed.map((m) =>
      snapshotEvent("mandate-removed", m.id, recordedAt, keysOf(m), "mandate", { termCode: m.termCode }),
    ),
  ];
}

/** Membership diff → role-new / role-changed / role-removed events. */
export function membershipChangeEvents(diff: SnapshotDiff<MembershipLike>, recordedAt: string): ChangeEvent[] {
  const keysOf = (m: MembershipLike) => [`poslanec:${m.personPspId}`];
  const payloadOf = (m: MembershipLike) => (m.functionNameCz ? { functionNameCz: m.functionNameCz } : {});
  return [
    ...diff.added.map((m) => snapshotEvent("role-new", m.id, recordedAt, keysOf(m), "membership", payloadOf(m))),
    ...diff.changed.map(({ after }) =>
      snapshotEvent("role-changed", after.id, recordedAt, keysOf(after), "membership", payloadOf(after)),
    ),
    ...diff.removed.map((m) => snapshotEvent("role-removed", m.id, recordedAt, keysOf(m), "membership", payloadOf(m))),
  ];
}

/* ── 2b. backfill events from the bitemporal version trail (3C history) ─────── */

/** One record-time version of a kg claim (serving row or history row). */
export interface ClaimVersion {
  recordedAt: string;
  weight: number | null;
  props: Record<string, unknown>;
}

/** props keys the review gate writes — a flip of ONLY these is the review's own
 *  event (review_audit already records it); it must not double as tie-changed. */
const REVIEW_PROP_KEYS: ReadonlySet<string> = new Set([
  "review_state",
  "last_decision",
  "last_reviewer",
  "last_reviewed_at",
  "review_note",
]);

const stripReviewProps = (props: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) if (!REVIEW_PROP_KEYS.has(k)) out[k] = v;
  return out;
};

/** True when two consecutive versions differ ONLY in review-gate props. */
export function isReviewOnlyChange(before: ClaimVersion, after: ClaimVersion): boolean {
  if (before.weight !== after.weight) return false;
  return canonicalJson(stripReviewProps(before.props)) === canonicalJson(stripReviewProps(after.props));
}

const SOURCE_BITEMPORAL = "kg_edge_history — bitemporální graf";

/**
 * The record-time trail of ONE linked_to tie → tie events. `epoch` is the
 * silent event zero (see the header): only versions recorded strictly after it
 * emit. The FIRST version of the key is `tie-new`; later versions are
 * `tie-changed` unless the change is a review-only flip.
 */
export function tieChangeEvents(
  src: string,
  dst: string,
  versions: readonly ClaimVersion[],
  epoch: string | null,
): ChangeEvent[] {
  if (versions.length === 0) return [];
  const sorted = [...versions].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const afterEpoch = (iso: string) => epoch === null || Date.parse(iso) > Date.parse(epoch);
  const events: ChangeEvent[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const v = sorted[i];
    if (!afterEpoch(v.recordedAt)) continue;
    const base = {
      recordedAt: v.recordedAt,
      entityKeys: edgeEntityKeys(src, dst),
      src,
      dst,
      evidence: { rel: "linked_to" },
      source: SOURCE_BITEMPORAL,
      payload: {
        review_state: typeof v.props.review_state === "string" ? v.props.review_state : "pending_review",
        ...(typeof v.props.role === "string" ? { role: v.props.role } : {}),
      },
    };
    if (i === 0) {
      events.push({ id: `chev:tie-new:${src}|${dst}`, eventType: "tie-new", ...base });
    } else if (!isReviewOnlyChange(sorted[i - 1], v)) {
      events.push({ id: `chev:tie-changed:${src}|${dst}|${v.recordedAt}`, eventType: "tie-changed", ...base });
    }
  }
  return events;
}

/**
 * A supplies edge (company → contract) whose FIRST recorded version postdates
 * the epoch → one `contract-new` event. Returns null inside the epoch (silent).
 */
export function contractNewEvent(src: string, dst: string, firstRecordedAt: string, epoch: string | null): ChangeEvent | null {
  if (epoch !== null && Date.parse(firstRecordedAt) <= Date.parse(epoch)) return null;
  return {
    id: `chev:contract-new:${src}|${dst}`,
    eventType: "contract-new",
    recordedAt: firstRecordedAt,
    entityKeys: edgeEntityKeys(src, src), // the company IČO sits on the SRC node
    src,
    dst,
    evidence: { rel: "supplies" },
    source: SOURCE_BITEMPORAL,
    payload: {},
  };
}

/** One review_audit row → one `review-decision` event (decided_at IS record time). */
export function reviewDecisionEvent(audit: {
  id: string;
  src: string;
  dst: string;
  decision: string;
  decidedAt: string;
}): ChangeEvent {
  return {
    id: `chev:review:${audit.id}`,
    eventType: "review-decision",
    recordedAt: audit.decidedAt,
    entityKeys: edgeEntityKeys(audit.src, audit.dst),
    src: audit.src,
    dst: audit.dst,
    evidence: { table: "review_audit", auditId: audit.id },
    source: "review_audit — lidská brána",
    payload: { decision: audit.decision },
  };
}
