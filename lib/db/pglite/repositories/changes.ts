// ChangeEventRepository — persistence for the civic seismograph (moonshot 5C).
//
// The ONLY writer of `change_event`. Like the ledger repository, this is
// deliberately additive and self-contained: it is NOT folded into the `Store`
// facade (lib/db/store.ts is shared substrate owned by other items), so every
// existing consumer is untouched. Server-side callers use `getChangesRepo()`
// (same pattern as repositories/ledger.ts `getLedgerRepo`).
//
// `backfillChangeEvents()` derives what is derivable TODAY:
//   • linked_to tie versions from kg_edge + kg_edge_history (3C's bitemporal
//     trail) → tie-new / tie-changed (review-only flips excluded — the audit
//     row is that change's own event),
//   • supplies first-versions → contract-new,
//   • review_audit rows → review-decision (append-only, genuine record time).
// EPOCH: the bitemporal migration stamped every pre-existing kg row with one
// shared recorded_at; that minimum is the silent event zero. Versions recorded
// AT the epoch emit nothing (the "first-run flood" guard from
// docs/harness/moonshot-2026-07-30/data-ingestion.md M2). Mandate/role events
// have NO backfill source (those tables keep no history) — they only accrue
// forward, via the adapter snapshot-diff layer (lib/ingest/changeEvents.ts).
// All derivation logic is pure and lives in lib/ingest/changeEvents.ts; this
// file only feeds it rows and upserts the result.

import {
  contractNewEvent,
  parseChangeEvent,
  reviewDecisionEvent,
  tieChangeEvents,
  type ChangeEvent,
  type ClaimVersion,
} from "../../../ingest/changeEvents";
import { dbDriver } from "../../config";
import {
  isoTs,
  json,
  num,
  numOrNull,
  open,
  str,
  strOrNull,
  upsertMany,
  warnIfTruncated,
  type Pglite,
} from "../internals";

export interface ChangeEventListOptions {
  /** Public watch key (`poslanec:<pspId>` | `firma:<ico>` | `tisk:<n>`). */
  entityKey?: string;
  eventType?: string;
  limit?: number;
}

export interface ChangeEventRepository {
  upsertChangeEvents(events: ChangeEvent[]): Promise<number>;
  /** Newest record time first; id ascending inside one instant (deterministic). */
  listChangeEvents(opts?: ChangeEventListOptions): Promise<ChangeEvent[]>;
  countChangeEvents(): Promise<number>;
  /**
   * Derive + upsert everything derivable today (see header). Idempotent:
   * deterministic event ids make a re-run replace rows in place. Returns the
   * number of events derived this pass and the epoch used (null = empty graph).
   */
  backfillChangeEvents(): Promise<{ derived: number; epoch: string | null }>;
}

const COLS = ["id", "event_type", "recorded_at", "entity_keys", "src", "dst", "evidence", "source", "payload"];

function mapRow(r: Record<string, unknown>): ChangeEvent {
  const entityKeysRaw: unknown = typeof r.entity_keys === "string" ? JSON.parse(str(r.entity_keys)) : r.entity_keys;
  const parsed = parseChangeEvent({
    id: str(r.id),
    eventType: str(r.event_type),
    recordedAt: isoTs(r.recorded_at) ?? "",
    entityKeys: Array.isArray(entityKeysRaw) ? entityKeysRaw : [],
    src: strOrNull(r.src),
    dst: strOrNull(r.dst),
    evidence: json(r.evidence),
    source: str(r.source),
    payload: json(r.payload),
  });
  if (!parsed) {
    // A stored row that fails its own codec is a data defect worth surfacing,
    // not silently dropping — but it must not take the whole list down.
    throw new Error(`change_event row ${str(r.id)} does not satisfy the event codec`);
  }
  return parsed;
}

export function makeChangesRepo(pg: Pglite): ChangeEventRepository {
  const repo: ChangeEventRepository = {
    async upsertChangeEvents(events) {
      return upsertMany(pg, "change_event", COLS, events, (e) => [
        e.id,
        e.eventType,
        e.recordedAt,
        JSON.stringify(e.entityKeys),
        e.src,
        e.dst,
        JSON.stringify(e.evidence),
        e.source,
        JSON.stringify(e.payload),
      ]);
    },

    async listChangeEvents(opts) {
      const lim = Math.max(1, Math.min(100_000, opts?.limit ?? 5_000));
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (opts?.entityKey) {
        params.push(JSON.stringify([opts.entityKey]));
        clauses.push(`entity_keys @> $${params.length}::jsonb`);
      }
      if (opts?.eventType) {
        params.push(opts.eventType);
        clauses.push(`event_type = $${params.length}`);
      }
      const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from change_event ${where} order by recorded_at desc, id asc limit ${lim}`,
        params,
      );
      // Newest-first, so a truncation drops the OLDEST events — the seismograph
      // would then draw a window and call it a history.
      warnIfTruncated(
        "listChangeEvents",
        rows.length,
        lim,
        clauses.length ? `${opts?.entityKey ?? "*"}/${opts?.eventType ?? "*"}` : undefined,
      );
      return rows.map(mapRow);
    },

    async countChangeEvents() {
      const { rows } = await pg.query<{ n: string | number }>(`select count(*)::int as n from change_event`);
      return num(rows[0]?.n);
    },

    async backfillChangeEvents() {
      // The epoch: the earliest record time the graph knows. On a data dir
      // migrated by 3C every pre-existing row shares this instant.
      const { rows: epochRows } = await pg.query<Record<string, unknown>>(
        `select min(recorded_at) as epoch from (
           select recorded_at from kg_edge
           union all
           select recorded_at from kg_edge_history
         ) v`,
      );
      const epoch = isoTs(epochRows[0]?.epoch);

      const events: ChangeEvent[] = [];

      if (epoch !== null) {
        // linked_to trail: every version (serving + history) of every tie.
        // The tie corpus is small (hundreds of edges); the pure derivation
        // (tie-new / tie-changed / review-only exclusion) happens in JS.
        const { rows: tieRows } = await pg.query<Record<string, unknown>>(
          `select src, dst, weight, props, recorded_at from kg_edge where rel = 'linked_to'
           union all
           select src, dst, weight, props, recorded_at from kg_edge_history where rel = 'linked_to'`,
        );
        const trails = new Map<string, { src: string; dst: string; versions: ClaimVersion[] }>();
        for (const r of tieRows) {
          const src = str(r.src);
          const dst = str(r.dst);
          const key = `${src}|${dst}`;
          const trail = trails.get(key) ?? { src, dst, versions: [] };
          trail.versions.push({
            recordedAt: isoTs(r.recorded_at) ?? "",
            weight: numOrNull(r.weight),
            props: json(r.props),
          });
          trails.set(key, trail);
        }
        for (const t of [...trails.values()].sort((a, b) => `${a.src}|${a.dst}`.localeCompare(`${b.src}|${b.dst}`))) {
          events.push(...tieChangeEvents(t.src, t.dst, t.versions, epoch));
        }

        // supplies: 150k+ rows — aggregate SQL-side to first-recorded keys
        // strictly after the epoch; never fetch the full contract corpus here.
        const { rows: supplyRows } = await pg.query<Record<string, unknown>>(
          `select src, dst, min(recorded_at) as first_at from (
             select src, dst, recorded_at from kg_edge where rel = 'supplies'
             union all
             select src, dst, recorded_at from kg_edge_history where rel = 'supplies'
           ) v
           group by src, dst
           having min(recorded_at) > $1::timestamptz
           order by src, dst`,
          [epoch],
        );
        for (const r of supplyRows) {
          const e = contractNewEvent(str(r.src), str(r.dst), isoTs(r.first_at) ?? "", epoch);
          if (e) events.push(e);
        }
      }

      // review_audit: append-only, decided_at was ALWAYS genuine record time —
      // fully backfillable with no epoch guard.
      const { rows: auditRows } = await pg.query<Record<string, unknown>>(
        `select id, src, dst, decision, decided_at from review_audit order by decided_at asc, id asc`,
      );
      for (const r of auditRows) {
        events.push(
          reviewDecisionEvent({
            id: str(r.id),
            src: str(r.src),
            dst: str(r.dst),
            decision: str(r.decision),
            decidedAt: isoTs(r.decided_at) ?? "",
          }),
        );
      }

      const derived = await repo.upsertChangeEvents(events);
      return { derived, epoch };
    },
  };
  return repo;
}

/** Server-side entry point over the app's live PGlite connection; null when the
 *  active driver is not PGlite (the sample-data fallback keeps working). */
export async function getChangesRepo(): Promise<ChangeEventRepository | null> {
  if (dbDriver() !== "pglite") return null;
  return makeChangesRepo(await open());
}
