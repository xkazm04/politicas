// ReviewRepository — THE human-review write path. One code path is the only
// writer of review state, for EVERY claim kind that reaches a reader.
//
// ── What changed on 2026-09-04 (G2, deck #5 + #12) ──────────────────────────────
// This file used to be "the write path for `linked_to` ties" and nothing else,
// which meant three other machine-produced claim kinds — bill forensic verdicts,
// person-level effort verdicts, tripwire candidates — rendered `pending_review`
// to readers with NO writer anywhere in the tree. Their pending state was
// permanent by construction: not a queue, a label.
//
// `setReviewState(subject, decision, reviewer, note)` is now that one writer.
// `setTieReviewState` survives as a thin alias of its `tie` branch, with its
// write byte-for-byte unchanged, because ~211 stored ties and their audit chain
// depend on exactly that behaviour.
//
// THE SKELETON, identical for every kind and the reason there is one function:
//   1. read the CURRENT state of the subject (kind-specific read)
//   2. map decision → next state (SHARED — a kind may not invent its own mapping)
//   3. refuse a reasonless reversal of a decided claim (SHARED), writing NOTHING
//   4. append the chained audit row (SHARED) — the record precedes the flip
//   5. supersede-then-write the subject's state (kind-specific write)
// …all inside ONE transaction, so a decision can never exist without its audit
// row, nor an audit row without its decision.

import { randomUUID } from "node:crypto";
import type { ReviewRepository, ReviewSubject } from "../../store";
import { isReviewSubjectKind, type ReviewAuditRow, type ReviewSubjectKind } from "../../types";
import {
  isoTs,
  json,
  num,
  numOrNull,
  str,
  strOrNull,
  warnIfTruncated,
  type Pglite,
  type PgTransaction,
} from "../internals";
import { AUDIT_DOMAIN_V1, AUDIT_DOMAIN_V2, GENESIS_HASH, computeAuditRowHashV2 } from "../ledger";

const LINKED_TO = "linked_to";

/**
 * The legacy triple, read back as a claim address. Legacy rows (written before
 * `subject_id` existed) get this derived, never written — see the
 * `[G2 review door v2]` block in ddl.ts for why no backfill statement exists.
 */
function tieSubjectId(src: string, rel: string, dst: string): string {
  return `${src}|${rel}|${dst}`;
}

function mapAuditRow(r: Record<string, unknown>): ReviewAuditRow {
  const src = str(r.src);
  const rel = str(r.rel);
  const dst = str(r.dst);
  const kind = r.subject_kind;
  return {
    id: str(r.id),
    src,
    rel,
    dst,
    decision: str(r.decision) as ReviewAuditRow["decision"],
    reviewer: str(r.reviewer),
    note: strOrNull(r.note),
    decidedAt: isoTs(r.decided_at) ?? "",
    priorState: strOrNull(r.prior_state),
    // The chain columns were SELECTed (`select *`) and dropped here since the
    // chain was written — so the one public surface of these rows (/dukazy)
    // could not publish a single verifiable field. Passed through as-is:
    // `null` for rows written before the chain existed, never a fabricated
    // position. Nothing is recomputed and no verification runs on this path.
    chainPos: numOrNull(r.chain_pos),
    prevHash: strOrNull(r.prev_hash),
    rowHash: strOrNull(r.row_hash),
    // DERIVED for legacy rows, never written back. Before 2026-09-04 the table
    // could only hold a tie, so a row with no `subject_kind` IS a tie and its
    // address IS its triple — reading it that way is a restatement of what the
    // stored bytes already mean, not an invention. An unrecognised stored kind
    // also falls back to "tie" rather than widening the union at read time.
    subjectKind: isReviewSubjectKind(kind) ? kind : "tie",
    subjectId: strOrNull(r.subject_id) ?? tieSubjectId(src, rel, dst),
    // …but the HASH DOMAIN is read strictly. It is the one field a verifier may
    // trust about which preimage was hashed, so it is never inferred from the
    // subject columns above: null ⇒ v1, and only the literal v2 tag ⇒ v2.
    hashDomain: strOrNull(r.hash_domain) === AUDIT_DOMAIN_V2 ? AUDIT_DOMAIN_V2 : AUDIT_DOMAIN_V1,
  };
}

/**
 * decision → next review state. SHARED across every claim kind, deliberately:
 * the moment a kind gets to define its own mapping, "rejected" stops meaning one
 * thing across the platform.
 *  - confirm    → verified
 *  - reject     → rejected  (TERMINAL: a rejected claim is not re-served forever)
 *  - needs-more → pending_review (back into the queue; never to a published state)
 * Note what is NOT here: `machine`. Only the enrichment loops write that, and
 * nothing in this file can produce it — a script can never promote its own
 * verdict to a human one, and the door can never demote a claim back to
 * "nobody looked at this".
 */
function nextStateFor(decision: "confirm" | "reject" | "needs-more"): string {
  return decision === "confirm" ? "verified" : decision === "reject" ? "rejected" : "pending_review";
}

/**
 * REVERSAL RULE (shared). Overturning an already-decided claim into a DIFFERENT
 * state is the one write on this platform that undoes a human's earlier published
 * judgement. It must state why, and the reason belongs in the audit row: the chain
 * is the only place it survives, since the subject's own `review_note` is
 * overwritten by the next decision. Checked BEFORE the audit insert, so a
 * reasonless reversal writes NOTHING AT ALL. Re-affirming the SAME state is not a
 * reversal. `machine` is not a decided state — the first human look at a machine
 * verdict is never a reversal.
 */
function isReasonlessReversal(priorState: string | null, nextState: string, note: string | null): boolean {
  const decided = priorState === "verified" || priorState === "rejected";
  return decided && nextState !== priorState && !note?.trim();
}

/** Everything the shared skeleton needs from a kind, and nothing more. */
interface SubjectHandler {
  kind: ReviewSubjectKind;
  /** The audit row's stable address for this claim. */
  subjectId: string;
  /** The legacy triple columns. They stay `not null`, so every kind fills them
   *  with something TRUE about itself rather than a placeholder: for a bill it is
   *  (bill id, 'forensic_verdict', the prop written); for an effort verdict it is
   *  (person id, 'effort_verdict', the prop written). */
  src: string;
  rel: string;
  dst: string;
  /** Current state, or `{ missing: true }` when the subject does not exist. */
  read(tx: PgTransaction): Promise<{ missing: true } | { missing: false; priorState: string | null }>;
  /** Supersede-then-write. Runs only after the audit row has landed. */
  write(tx: PgTransaction, nextState: string, decision: string, reviewer: string, note: string | null): Promise<void>;
}

/**
 * Merge-preserving node prop write with a history row, in ONE statement so the
 * closed span and the new recorded_at are the same instant.
 *
 * `props || $patch` is jsonb concatenation: a SHALLOW merge that keeps every key
 * the patch does not name. This is the rule from memory/kg-upsert-replaces-props —
 * a whole-object write here would silently drop every effort_* prop the loop had
 * computed. Nested objects still have to be merged in TypeScript by the caller
 * (jsonb `||` does not recurse), which is why the effort handler reads
 * `effort_provenance` first and hands back a fully merged object.
 */
async function patchNodeProps(tx: PgTransaction, id: string, patch: Record<string, unknown>): Promise<void> {
  await tx.query(
    `with archived as (
       insert into kg_node_history (id, kind, label, props, first_seen_pass, provenance, valid_from, valid_to, recorded_at, superseded_at)
       select id, kind, label, props, first_seen_pass, provenance, valid_from, valid_to, recorded_at, now()
       from kg_node where id = $1
     )
     update kg_node set props = props || $2::jsonb, recorded_at = now() where id = $1`,
    [id, JSON.stringify(patch)],
  );
}

async function readNodeProps(
  tx: PgTransaction,
  id: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await tx.query<Record<string, unknown>>(`select props from kg_node where id = $1`, [id]);
  return rows[0] ? json(rows[0].props) : null;
}

function handlerFor(subject: ReviewSubject): SubjectHandler {
  switch (subject.kind) {
    case "tie": {
      const { src, dst } = subject;
      return {
        kind: "tie",
        subjectId: tieSubjectId(src, LINKED_TO, dst),
        src,
        rel: LINKED_TO,
        dst,
        async read(tx) {
          const { rows } = await tx.query<Record<string, unknown>>(
            `select props from kg_edge where src = $1 and rel = $2 and dst = $3`,
            [src, LINKED_TO, dst],
          );
          const edgeRow = rows[0];
          if (!edgeRow) return { missing: true };
          const props = json(edgeRow.props);
          return { missing: false, priorState: strOrNull((props.review_state ?? props.state) as unknown) };
        },
        async write(tx, nextState, decision, reviewer, note) {
          const { rows } = await tx.query<Record<string, unknown>>(
            `select props from kg_edge where src = $1 and rel = $2 and dst = $3`,
            [src, LINKED_TO, dst],
          );
          const props = json(rows[0]?.props);
          const nextProps: Record<string, unknown> = {
            ...props,
            review_state: nextState,
            last_decision: decision,
            last_reviewer: reviewer,
            last_reviewed_at: new Date().toISOString(),
          };
          if (note != null) nextProps.review_note = note;

          // The flip SUPERSEDES the prior edge version rather than overwriting it
          // (bitemporal write discipline — see repositories/kg.ts): archive the
          // pre-flip version and stamp the new one, in ONE statement so the
          // closed span and the new recorded_at are the same instant. This is
          // what makes "this tie sat in pending_review for 4 months" a queryable
          // fact (edge history joined with the audit chain), not a lost one.
          await tx.query(
            `with archived as (
               insert into kg_edge_history (src, rel, dst, weight, props, provenance, valid_from, valid_to, recorded_at, superseded_at)
               select src, rel, dst, weight, props, provenance, valid_from, valid_to, recorded_at, now()
               from kg_edge where src = $1 and rel = $2 and dst = $3
             )
             update kg_edge set props = $4, recorded_at = now() where src = $1 and rel = $2 and dst = $3`,
            [src, LINKED_TO, dst, JSON.stringify(nextProps)],
          );
        },
      };
    }

    case "bill_verdict": {
      const { billId } = subject;
      return {
        kind: "bill_verdict",
        subjectId: billId,
        src: billId,
        rel: "forensic_verdict",
        dst: "forensic_review_state",
        async read(tx) {
          const props = await readNodeProps(tx, billId);
          if (!props) return { missing: true };
          // NOT defaulted to "pending_review". An absent state is absent — the
          // same rule getLawData.ts now follows on the read side.
          return { missing: false, priorState: strOrNull(props.forensic_review_state) };
        },
        async write(tx, nextState, decision, reviewer, note) {
          const patch: Record<string, unknown> = {
            forensic_review_state: nextState,
            forensic_review_decision: decision,
            forensic_review_by: reviewer,
            forensic_review_at: new Date().toISOString(),
          };
          if (note != null) patch.forensic_review_note = note;
          await patchNodeProps(tx, billId, patch);
        },
      };
    }

    case "effort_verdict": {
      const { personId, field } = subject;
      return {
        kind: "effort_verdict",
        // The address is person + the ONE prop being decided: a reviewer who
        // rejects "this MP is a workhorse" has said nothing about the low-score
        // reason on the same node, and the ledger must not pretend otherwise.
        subjectId: `${personId}#${field}`,
        src: personId,
        rel: "effort_verdict",
        dst: field,
        async read(tx) {
          const props = await readNodeProps(tx, personId);
          if (!props) return { missing: true };
          if (props[field] === undefined) return { missing: true };
          return { missing: false, priorState: effortVerdictState(props, field) };
        },
        async write(tx, nextState, decision, reviewer, note) {
          const props = (await readNodeProps(tx, personId)) ?? {};
          const prov = (props.effort_provenance ?? {}) as Record<string, unknown>;
          const verdicts = (prov.verdicts ?? {}) as Record<string, unknown>;
          const entry: Record<string, unknown> = {
            review_state: nextState,
            decided_by: reviewer,
            decided_at: new Date().toISOString(),
            last_decision: decision,
          };
          if (note != null) entry.note = note;
          // Three levels of merge, all explicit, because jsonb `||` is shallow:
          // keep every OTHER effort_provenance key (computedAt, pass, track…),
          // keep every OTHER field's verdict entry, replace only this field's.
          await patchNodeProps(tx, personId, {
            effort_provenance: { ...prov, verdicts: { ...verdicts, [field]: entry } },
          });
        },
      };
    }

    // `tripwire` and `lead` are declared in the vocabulary and carried over: they
    // need a durable candidate id and a lead sidecar respectively, neither of
    // which exists yet (tripwires are re-derived per read and hold no state).
    // Refusing here is the honest answer — the alternative is a door that
    // silently records a decision about a subject nothing will ever read back.
    default:
      return {
        kind: subject.kind,
        subjectId: "",
        src: "",
        rel: "",
        dst: "",
        async read() {
          return { missing: true };
        },
        async write() {},
      };
  }
}

/**
 * The stored review state of ONE effort verdict prop, or null when the loop has
 * not stamped it. Exported so the loaders read the rung through exactly the
 * shape the writer writes, rather than re-deriving the path in three places.
 */
export function effortVerdictState(props: Record<string, unknown>, field: string): string | null {
  const prov = props.effort_provenance;
  if (!prov || typeof prov !== "object") return null;
  const verdicts = (prov as { verdicts?: unknown }).verdicts;
  if (!verdicts || typeof verdicts !== "object") return null;
  const entry = (verdicts as Record<string, unknown>)[field];
  if (!entry || typeof entry !== "object") return null;
  const state = (entry as { review_state?: unknown }).review_state;
  return typeof state === "string" ? state : null;
}

/** Who decided an effort verdict and when — null unless a human went through the door. */
export function effortVerdictDecider(
  props: Record<string, unknown>,
  field: string,
): { by: string; at: string | null } | null {
  const prov = props.effort_provenance;
  if (!prov || typeof prov !== "object") return null;
  const verdicts = (prov as { verdicts?: unknown }).verdicts;
  if (!verdicts || typeof verdicts !== "object") return null;
  const entry = (verdicts as Record<string, unknown>)[field];
  if (!entry || typeof entry !== "object") return null;
  const by = (entry as { decided_by?: unknown }).decided_by;
  if (typeof by !== "string" || by.length === 0) return null;
  const at = (entry as { decided_at?: unknown }).decided_at;
  return { by, at: typeof at === "string" ? at : null };
}

export function makeReviewRepo(pg: Pglite): ReviewRepository {
  const repo: ReviewRepository = {
    async setReviewState(subject, decision, reviewer, note) {
      const handler = handlerFor(subject);
      if (!isReviewSubjectKind(handler.kind) || handler.subjectId === "") {
        // Reached only by a kind with no writer yet (tripwire, lead).
        return { ok: false, error: `no writer for claim kind "${subject.kind}"` };
      }
      // The whole read → audit-insert → write sequence runs inside one transaction.
      // PGlite serializes transactions against every other query on the single shared
      // connection, so two concurrent decisions on the same subject can no longer both
      // read the same state before either writes — the second call's transaction only
      // starts once the first has fully committed, closing the lost-update race where
      // whichever write landed last used to silently discard the other decision.
      return pg.transaction(async (tx: PgTransaction) => {
        // 1) current state
        const current = await handler.read(tx);
        if (current.missing) return { ok: false as const, error: notFoundMessage(subject) };
        const priorState = current.priorState;

        // 2) + 3) shared mapping, then the reversal gate — BEFORE any insert, so a
        // reasonless reversal leaves no bare row in the chain.
        const nextState = nextStateFor(decision);
        if (isReasonlessReversal(priorState, nextState, note)) {
          return { ok: false as const, error: "reversal requires a note" };
        }

        // 4) audit row FIRST — the record of the decision must predate the state flip.
        // The row joins the tamper-evident hash chain (lib/db/pglite/ledger.ts): read
        // the current head INSIDE this transaction (PGlite serializes transactions, so
        // two decisions can never race for the same chain position), then store
        // prev_hash + row_hash over the pinned canonical serialization. decided_at is
        // generated HERE (not by now() in SQL) so the hashed instant and the stored
        // instant are the same value by construction.
        //
        // EVERY new row is hashed under `politicas-audit-v2`, including a tie's —
        // the tag says which preimage was used, not which kind was decided, and a
        // chain that changed preimage partway through is exactly what
        // verifyAuditChain is built to walk. No stored row is ever rehashed.
        const id = randomUUID();
        const { rows: headRows } = await tx.query<Record<string, unknown>>(
          `select chain_pos, row_hash from review_audit
            where chain_pos is not null order by chain_pos desc limit 1`,
        );
        const head = headRows[0];
        const chainPos = head ? num(head.chain_pos) + 1 : 1;
        const prevHash = head ? str(head.row_hash) : GENESIS_HASH;
        const decidedAt = new Date().toISOString();
        const rowHash = computeAuditRowHashV2(prevHash, {
          id,
          src: handler.src,
          rel: handler.rel,
          dst: handler.dst,
          subjectKind: handler.kind,
          subjectId: handler.subjectId,
          decision,
          reviewer,
          note,
          decidedAt,
          priorState,
        });
        await tx.query(
          `insert into review_audit
             (id, src, rel, dst, decision, reviewer, note, decided_at, prior_state,
              chain_pos, prev_hash, row_hash, subject_kind, subject_id, hash_domain)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            id,
            handler.src,
            handler.rel,
            handler.dst,
            decision,
            reviewer,
            note,
            decidedAt,
            priorState,
            chainPos,
            prevHash,
            rowHash,
            handler.kind,
            handler.subjectId,
            AUDIT_DOMAIN_V2,
          ],
        );

        // 5) only THEN write the subject's state.
        await handler.write(tx, nextState, decision, reviewer, note);
        return { ok: true as const, reviewState: nextState };
      });
    },

    async setTieReviewState(src, dst, decision, reviewer, note) {
      // Kept as the tie branch's name, unchanged in signature and in every byte it
      // writes. ~211 stored ties, the /penize review console and this file's own
      // test suite all speak it; the generalisation happens underneath it.
      return repo.setReviewState({ kind: "tie", src, dst }, decision, reviewer, note);
    },

    async listReviewAudit(opts) {
      const lim = Math.max(1, Math.min(10_000, opts?.limit ?? 1_000));
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (opts?.src) {
        params.push(opts.src);
        clauses.push(`src = $${params.length}`);
      }
      if (opts?.dst) {
        params.push(opts.dst);
        clauses.push(`dst = $${params.length}`);
      }
      if (opts?.subjectKind) {
        // Legacy rows carry NULL here and ARE ties (see mapAuditRow) — asking for
        // ties must therefore return them, or the one kind with four months of
        // history would read as the emptiest.
        params.push(opts.subjectKind);
        clauses.push(
          opts.subjectKind === "tie"
            ? `(subject_kind = $${params.length} or subject_kind is null)`
            : `subject_kind = $${params.length}`,
        );
      }
      if (opts?.subjectId) {
        params.push(opts.subjectId);
        clauses.push(`subject_id = $${params.length}`);
      }
      const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from review_audit ${where} order by decided_at desc, id desc limit ${lim}`,
        params,
      );
      // /dukazy renders `audit.length` AS A COUNT of gate decisions and /admin
      // sums it by reviewer — so a truncated read does not degrade a list, it
      // publishes a wrong number. Five call sites request exactly the 10 000
      // hard cap, which is the shape this guard exists to catch.
      warnIfTruncated(
        "listReviewAudit",
        rows.length,
        lim,
        clauses.length ? `${opts?.src ?? "*"}→${opts?.dst ?? "*"}` : undefined,
      );
      return rows.map(mapAuditRow);
    },

    async countReviewAuditByKind() {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select coalesce(subject_kind, 'tie') as kind, count(*) as n from review_audit group by 1`,
      );
      const out: Record<string, number> = {};
      for (const r of rows) out[str(r.kind)] = num(r.n);
      return out;
    },
  };
  return repo;
}

/** Kind-specific "not found", so a surface can say what was missing. */
function notFoundMessage(subject: ReviewSubject): string {
  switch (subject.kind) {
    case "tie":
      return "tie not found";
    case "bill_verdict":
      return "bill not found";
    case "effort_verdict":
      return "effort verdict not found";
    default:
      return `no writer for claim kind "${subject.kind}"`;
  }
}
