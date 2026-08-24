/**
 * Quiet-window maintenance for the ONE PGlite store: CHECKPOINT taken when the
 * application is not using the connection, instead of when the engine decides to
 * take it in the middle of a user's write.
 *
 * WHY THIS FILE EXISTS — THE TIMER IS ALREADY THERE, IT JUST IS NOT OURS
 * Until now the only CHECKPOINT this repo ever issued was inside a manual
 * `npm run db:backup` (scripts/db/backup.ts). Between backups, checkpointing was
 * left to Postgres — and PGlite runs Postgres with NO BACKGROUND PROCESSES, so
 * there is no checkpointer to honour `checkpoint_timeout` (measured on this
 * store: 300 s, a setting nothing here can act on). What remains is the
 * `max_wal_size` trigger (measured: 1 024 MB), taken INLINE on whichever write
 * happens to cross it. That is precisely the failure the registry technique
 * names — maintenance scheduled by a counter that knows nothing about
 * interactions, so the stall is charged to whatever the user was touching.
 *
 * The evidence that it is not hypothetical is in the store: `pg_wal` was 625 MB
 * of a 1,5 GB copy in the 2026-08-22 backup review ("because nobody ever
 * checkpointed the store before copying it"), and 544 MB of the 2 045 MB copy
 * measured 2026-08-24 by `npm run db:accounting`.
 *
 * THE GATE IS TWO CONDITIONS, AND NEITHER ALONE IS THE TECHNIQUE
 *   • an ACTIVITY GAUGE that must read zero — the count of wrapped operations in
 *     flight on the one connection, incremented and decremented at this wrapper,
 *     which is the application's own front door to the store;
 *   • a MINIMUM INTERVAL since the last pass — 300 s, the value Postgres itself
 *     intends by `checkpoint_timeout` and cannot honour here.
 * The interval alone is the timer failure. The gauge alone runs maintenance in
 * every momentary gap between two queries, which is a busy loop wearing an
 * idle-detector's coat.
 *
 * WHAT THE GAUGE CAN AND CANNOT SEE — stated rather than left to be discovered.
 * It sees demand for the DATABASE. A server component doing 200 ms of CPU-bound
 * work between two reads reads as idle, and a pass may start in that gap. Two
 * things bound the damage: the pass is short (measured on the 2 GB store,
 * 42,1 ms cold and 6,4 ms for an immediate repeat) and PGlite serializes
 * statements anyway, so the worst case is one query queued behind a checkpoint —
 * a smaller number than the inline `max_wal_size` checkpoint this replaces.
 *
 * THE HARM IS UNCHECKPOINTED WAL BYTES, NOT THE SIZE OF pg_wal
 * `pg_wal` on disk is a POOL: a checkpoint makes segments recyclable, it does not
 * return them to the OS, so the directory does not shrink (backup.ts says the
 * same thing about its own copies). A ladder keyed to directory bytes would
 * therefore latch permanently open and force a checkpoint on every pass. The
 * signal that a checkpoint actually resets is the WAL written since the last
 * checkpoint's redo point — measured here: 151 240 B after a small write, 208 B
 * after CHECKPOINT. That is the number the escalation rungs are keyed to.
 *
 * THE ESCALATION LADDER, keyed to that harm:
 *   quiet     gauge == 0 and ≥ 300 s since the last pass          → run
 *   pressure  gauge == 0 and ≥ 64 MB unckeckpointed               → run, interval ignored
 *   forced    ≥ 512 MB unckeckpointed                             → run regardless of the
 *             gauge, and SAY SO on the warn channel
 * 64 MB is 1/16 of the engine's own inline trigger, so the polite pass wins that
 * race by an order of magnitude. 512 MB is half of it — the last point at which
 * this repo still gets to choose the moment; past it the engine takes the
 * checkpoint on some unlucky user write and the choice was never ours.
 *
 * DEFERRAL IS AN OUTCOME, NOT A NON-EVENT
 * "ran", "deferred because busy" and "attempted and failed" are three different
 * results, and a ledger that records only the first cannot tell a healthy store
 * from a scheduler that has been deferring for a month. Every pass and every
 * WANTED-but-deferred consideration lands in a bounded ring, readable through
 * `maintenanceReport()`. A consideration where nothing was wanted (interval not
 * elapsed, harm low) is counted, not recorded — that is the common case and
 * ringing it would evict the events worth reading.
 *
 * WHAT IS NOT DONE, AND WHY
 *   • No chunking. CHECKPOINT is one statement; SQL exposes no bounded-page
 *     variant to yield between. The gauge is therefore re-read IMMEDIATELY before
 *     the statement is issued (never across it — the lock must not be held over
 *     the check that exists to protect the user), and the pass is kept short by
 *     running often enough that little is dirty.
 *   • No space reclamation. VACUUM FULL rewrites the store, needs double the
 *     disk transiently, and nothing here prunes rows anyway: retention is
 *     deliberately unbounded (lib/db/pglite/accounting.ts, operator 2026-08-24),
 *     so there is no large prune for a reclaimer to follow.
 *   • No timer. This module owns no `setInterval`, for the same reason
 *     instrument.ts owns none: a timer is a cost the process pays when nobody is
 *     asking. Consideration is lazy — it happens as operations complete, at most
 *     once every 15 s. The consequence is stated rather than hidden: a process
 *     that stops using the store stops considering, which is correct (a store
 *     nobody writes to accrues no WAL) but does mean the ledger's last line can
 *     be older than the process.
 *   • The first consideration in a process has no previous pass to measure an
 *     interval from, so it takes one. A CHECKPOINT on a store that has just
 *     recovered is 6,4–42,1 ms measured on the 2 GB store, and it gives every
 *     later interval a real origin instead of "since the process started".
 */

import { num, type PgResult, type PgTransaction, type Pglite } from "./internals";

/* ── calibration (every number's basis is in the header) ───────────────────── */

const MB = 1_048_576;
/** ≥ this many ms since the last pass makes a pass WANTED at rung `quiet`. */
export const MIN_INTERVAL_MS = 300_000;
/** Unckeckpointed WAL that makes a pass wanted regardless of the interval. */
export const SOFT_BYTES = 64 * MB;
/** Unckeckpointed WAL that makes a pass happen regardless of the gauge. */
export const HARD_BYTES = 512 * MB;
/** Floor between two considerations, so the harm probe is at most 4/minute. */
export const CONSIDER_THROTTLE_MS = 15_000;
/** Passes and wanted-but-deferred considerations kept for the report. */
const LEDGER_CAP = 64;

export type MaintenanceTrigger = "quiet" | "pressure" | "forced";
export type MaintenanceOutcome = "ran" | "deferred-busy" | "failed";

export interface MaintenanceRecord {
  /** Wall-clock ISO instant — this ledger is read by humans, not diffed. */
  at: string;
  outcome: MaintenanceOutcome;
  /** Which rung wanted the pass. */
  trigger: MaintenanceTrigger;
  /** Operations in flight at the moment the decision was taken. */
  gauge: number;
  /** Unckeckpointed WAL bytes observed before the decision. */
  walBytesBefore: number;
  /** Same measurement after a pass that ran; -1 when no pass ran. */
  walBytesAfter: number;
  /** Duration of the CHECKPOINT statement in ms; -1 when no pass ran. */
  durMs: number;
  /** Present only on `failed`. */
  error?: string;
}

export interface MaintenanceSnapshot {
  enabled: boolean;
  /** Considerations since process start, including the ones nothing wanted. */
  considered: number;
  ran: number;
  deferredBusy: number;
  failed: number;
  /** Bounded ledger, oldest first. */
  records: MaintenanceRecord[];
  lastPassAt: string | null;
}

/* ── module state (one connection ⇒ one scheduler) ─────────────────────────── */

let inFlight = 0;
let passRunning = false;
let lastConsideredMono = Number.NEGATIVE_INFINITY;
let lastPassMono = Number.NEGATIVE_INFINITY;
let lastPassAt: string | null = null;
let considered = 0;
let ranCount = 0;
let deferredBusyCount = 0;
let failedCount = 0;
const ledger: MaintenanceRecord[] = [];

let monotonic: () => number = () => performance.now();
let emit: (line: string) => void = (line) => console.warn(line);
let enabled = false;
let settings = {
  minIntervalMs: MIN_INTERVAL_MS,
  softBytes: SOFT_BYTES,
  hardBytes: HARD_BYTES,
  considerThrottleMs: CONSIDER_THROTTLE_MS,
};

function push(record: MaintenanceRecord): void {
  ledger.push(record);
  if (ledger.length > LEDGER_CAP) ledger.shift();
}

/** WAL written since the last checkpoint's redo point — the one figure a
 *  CHECKPOINT actually resets. `pg_wal_lsn_diff` returns numeric, i.e. a string
 *  on this driver, so it goes through the shared coercion. */
export async function unckeckpointedBytes(pg: Pglite): Promise<number> {
  const r = await pg.query<{ b: unknown }>(
    "select pg_wal_lsn_diff(pg_current_wal_lsn(), (select redo_lsn from pg_control_checkpoint())) as b",
  );
  return num(r.rows[0]?.b);
}

/* ── the gate ──────────────────────────────────────────────────────────────── */

export interface Decision {
  /** null = nothing wanted a pass; the common case, counted and not recorded. */
  trigger: MaintenanceTrigger | null;
  /** True when the rung runs even though the gauge is non-zero. */
  overridesGauge: boolean;
}

/**
 * The ladder, as a pure function of the two measurements — so the whole gate is
 * testable without a store and the thresholds cannot drift between the code that
 * decides and the code that explains itself.
 *
 * It answers "was a pass WANTED", deliberately not "does one run": those are
 * different questions, and keeping them apart is what lets a busy moment be
 * recorded as a deferral instead of vanishing into "nothing happened".
 */
export function wantPass(sinceLastPassMs: number, walBytes: number, s = settings): Decision {
  if (walBytes >= s.hardBytes) return { trigger: "forced", overridesGauge: true };
  if (walBytes >= s.softBytes) return { trigger: "pressure", overridesGauge: false };
  if (sinceLastPassMs >= s.minIntervalMs) return { trigger: "quiet", overridesGauge: false };
  return { trigger: null, overridesGauge: false };
}

/** The second condition: a wanted pass runs only in a quiet window, unless the
 *  harm has crossed the bound where the engine would take the choice away. */
export const runsNow = (d: Decision, gauge: number): boolean =>
  d.trigger !== null && (gauge === 0 || d.overridesGauge);

async function consider(pg: Pglite): Promise<void> {
  const t = monotonic();
  if (passRunning || t - lastConsideredMono < settings.considerThrottleMs) return;
  lastConsideredMono = t;
  considered++;

  let walBytes: number;
  try {
    walBytes = await unckeckpointedBytes(pg);
  } catch (err) {
    // A store that cannot answer the harm probe (closing, mid-failure) is not a
    // store to run maintenance against — but the scheduler going quiet must not
    // be silent, or "maintenance never ran" reads the same as "nothing needed
    // it". One line per throttle window at most.
    emit(`[db] maintenance could not read the WAL position, skipping this consideration: ${String(err)}`);
    return;
  }

  const gauge = inFlight;
  const sinceLastPass = lastPassMono === Number.NEGATIVE_INFINITY ? Infinity : t - lastPassMono;
  const decision = wantPass(sinceLastPass, walBytes);
  const trigger = decision.trigger;
  if (trigger === null) return;

  if (!runsNow(decision, gauge)) {
    deferredBusyCount++;
    push({
      at: new Date().toISOString(),
      outcome: "deferred-busy",
      trigger,
      gauge,
      walBytesBefore: walBytes,
      walBytesAfter: -1,
      durMs: -1,
    });
    return;
  }

  await runPass(pg, trigger, walBytes);
}

async function runPass(pg: Pglite, trigger: MaintenanceTrigger, walBytesBefore: number): Promise<void> {
  passRunning = true;
  // Re-read the gauge HERE, immediately before the statement — never across it.
  const gauge = inFlight;
  if (trigger === "forced") {
    emit(
      `[db] maintenance FORCED a CHECKPOINT: ${(walBytesBefore / MB).toFixed(1)} MB of WAL since the last one is ` +
        `over the ${(settings.hardBytes / MB).toFixed(0)} MB hard bound, and ${gauge} operation(s) were in flight. ` +
        `Past this point the engine takes the checkpoint inline on some user's write instead (max_wal_size), ` +
        `so the choice of moment was going to be lost either way.`,
    );
  }
  const t0 = monotonic();
  try {
    await pg.exec("CHECKPOINT");
    const durMs = monotonic() - t0;
    let walBytesAfter = -1;
    try {
      walBytesAfter = await unckeckpointedBytes(pg);
    } catch (err) {
      // The pass itself succeeded; only the confirmation read failed. The ledger
      // keeps -1 (rendered "n/a"), never 0 — "we did not look" and "nothing left
      // unckeckpointed" are different claims and must not share a value.
      emit(`[db] maintenance ran but could not re-read the WAL position: ${String(err)}`);
    }
    lastPassMono = monotonic();
    lastPassAt = new Date().toISOString();
    ranCount++;
    push({
      at: lastPassAt,
      outcome: "ran",
      trigger,
      gauge,
      walBytesBefore,
      walBytesAfter,
      durMs,
    });
  } catch (err) {
    failedCount++;
    // A failed pass is louder than a deferred one: deferral is the design
    // working, failure is the store refusing maintenance and growing anyway.
    const message = err instanceof Error ? err.message : String(err);
    emit(`[db] maintenance CHECKPOINT failed (trigger=${trigger}, gauge=${gauge}): ${message}`);
    push({
      at: new Date().toISOString(),
      outcome: "failed",
      trigger,
      gauge,
      walBytesBefore,
      walBytesAfter: -1,
      durMs: monotonic() - t0,
      error: message,
    });
  } finally {
    passRunning = false;
  }
}

/* ── the wrapper ───────────────────────────────────────────────────────────── */

export interface MaintenanceOptions {
  /** Default: on unless `POLITICAS_DB_MAINTENANCE` is `0`/`off`/`false`. */
  enabled?: boolean;
  /** Injectable monotonic clock — the seam the tests drive intervals through. */
  now?: () => number;
  /** Injectable warn sink; defaults to `console.warn`, as everywhere in lib/db. */
  warn?: (line: string) => void;
  minIntervalMs?: number;
  softBytes?: number;
  hardBytes?: number;
  considerThrottleMs?: number;
}

export function dbMaintenanceEnabled(): boolean {
  const v = process.env.POLITICAS_DB_MAINTENANCE?.toLowerCase();
  return v !== "0" && v !== "off" && v !== "false";
}

/**
 * Wraps the connection so every operation feeds the activity gauge and, on
 * completion, offers the scheduler a chance to consider a pass.
 *
 * COMPOSITION. `internals.open()` wraps this INSIDE the instrument
 * (`instrumentPglite(withQuietWindowMaintenance(raw))`), which is deliberate in
 * both directions: the gauge counts exactly the operations the instrument
 * measures, and the CHECKPOINT this module issues goes to the raw connection, so
 * it never appears in the query rings as a phantom `other/other` key with its own
 * threshold. The pass is timed here, in its own ledger, where its duration
 * belongs.
 *
 * When disabled this returns the argument itself, identity-equal — no wrapper in
 * the object graph, the same posture instrument.ts takes.
 */
export function withQuietWindowMaintenance(pg: Pglite, opts: MaintenanceOptions = {}): Pglite {
  enabled = opts.enabled ?? dbMaintenanceEnabled();
  if (!enabled) return pg;
  if (opts.now) monotonic = opts.now;
  if (opts.warn) emit = opts.warn;
  settings = {
    minIntervalMs: opts.minIntervalMs ?? MIN_INTERVAL_MS,
    softBytes: opts.softBytes ?? SOFT_BYTES,
    hardBytes: opts.hardBytes ?? HARD_BYTES,
    considerThrottleMs: opts.considerThrottleMs ?? CONSIDER_THROTTLE_MS,
  };

  const after = () => {
    // Fire and forget: the caller's promise must not wait on maintenance, and a
    // scheduler defect must never surface as that caller's failure. It must not
    // vanish either — `consider` handles its own expected failures, so anything
    // arriving here is a defect in this module and says so.
    void consider(pg).catch((err: unknown) => emit(`[db] maintenance scheduler defect: ${String(err)}`));
  };
  const track = async <T>(run: () => Promise<T>): Promise<T> => {
    inFlight++;
    try {
      return await run();
    } finally {
      inFlight--;
      after();
    }
  };

  return {
    get waitReady() {
      return pg.waitReady;
    },
    exec: (sql: string) => track(() => pg.exec(sql)),
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
      track<PgResult<T>>(() => pg.query<T>(sql, params)),
    transaction: <T>(callback: (tx: PgTransaction) => Promise<T>) => track(() => pg.transaction(callback)),
    close: () => pg.close(),
  };
}

/* ── read-time surfaces ────────────────────────────────────────────────────── */

/** Operations in flight on the one connection. Zero is the quiet window. */
export const activityGauge = (): number => inFlight;

export function maintenanceSnapshot(): MaintenanceSnapshot {
  return {
    enabled,
    considered,
    ran: ranCount,
    deferredBusy: deferredBusyCount,
    failed: failedCount,
    records: [...ledger],
    lastPassAt,
  };
}

const mbOf = (b: number) => (b < 0 ? "n/a" : `${(b / MB).toFixed(1)} MB`);

/** The flight recorder, in the two questions it exists to answer: is maintenance
 *  actually running, and was that stall at 14:03 us. */
export function maintenanceReport(): string {
  const s = maintenanceSnapshot();
  const lines: string[] = [];
  lines.push(
    `[db] quiet-window maintenance — ${s.enabled ? "enabled" : "DISABLED (POLITICAS_DB_MAINTENANCE)"}: ` +
      `${s.considered} considerations, ${s.ran} passes run, ${s.deferredBusy} deferred because busy, ` +
      `${s.failed} failed. Last pass: ${s.lastPassAt ?? "never in this process"}.`,
  );
  lines.push(
    `  gate: gauge == 0 AND ≥ ${(settings.minIntervalMs / 1000).toFixed(0)} s since the last pass (quiet); ` +
      `≥ ${(settings.softBytes / MB).toFixed(0)} MB unckeckpointed overrides the interval (pressure); ` +
      `≥ ${(settings.hardBytes / MB).toFixed(0)} MB overrides the gauge (forced). ` +
      `Considerations are throttled to one per ${(settings.considerThrottleMs / 1000).toFixed(0)} s.`,
  );
  if (s.records.length === 0) {
    lines.push(`  ledger empty — no pass has run and nothing has been deferred while wanted.`);
  } else {
    lines.push(`  when                      outcome        trigger    gauge     WAL before      WAL after    ms`);
    for (const r of s.records) {
      lines.push(
        `  ${r.at.padEnd(25)} ${r.outcome.padEnd(14)} ${r.trigger.padEnd(10)} ${String(r.gauge).padStart(5)} ` +
          `${mbOf(r.walBytesBefore).padStart(14)} ${mbOf(r.walBytesAfter).padStart(13)} ` +
          `${(r.durMs < 0 ? "n/a" : r.durMs.toFixed(1)).padStart(7)}` +
          (r.error ? `  ${r.error}` : ""),
      );
    }
    lines.push(
      `  "deferred-busy" means a pass was WANTED and the gauge was non-zero — a long run of these is the ` +
        `scheduler starving, which is what the forced rung exists to bound. A consideration where nothing was ` +
        `wanted is counted above and deliberately not listed.`,
    );
  }
  lines.push(
    `  WAL figures are bytes written since the last checkpoint's redo point (pg_wal_lsn_diff), NOT the size of ` +
      `pg_wal — a checkpoint recycles segments in place and never returns them to the OS.`,
  );
  return lines.join("\n");
}

/** Test seam: drops the gauge, the ledger and every counter. */
export function resetMaintenance(): void {
  inFlight = 0;
  passRunning = false;
  lastConsideredMono = Number.NEGATIVE_INFINITY;
  lastPassMono = Number.NEGATIVE_INFINITY;
  lastPassAt = null;
  considered = 0;
  ranCount = 0;
  deferredBusyCount = 0;
  failedCount = 0;
  ledger.length = 0;
  monotonic = () => performance.now();
  emit = (line) => console.warn(line);
  enabled = false;
  settings = {
    minIntervalMs: MIN_INTERVAL_MS,
    softBytes: SOFT_BYTES,
    hardBytes: HARD_BYTES,
    considerThrottleMs: CONSIDER_THROTTLE_MS,
  };
}
