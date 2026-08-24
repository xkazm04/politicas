/**
 * The durability contract of this store — chosen on purpose, written down, and
 * asserted on every boot instead of assumed.
 *
 * WHAT THIS STORE ACTUALLY PROMISES, measured 2026-08-24 from `pg_settings`:
 *
 *   wal_level          replica   (default)       write-ahead journaling is on
 *   full_page_writes   on        (default)       torn pages are recoverable
 *   synchronous_commit on        (default)       a commit returns after its WAL write
 *   fsync              OFF       (command line)  ...which is NOT forced to the platter
 *   data_checksums     off       (default)       silent corruption is not detected
 *
 * So the honest sentence is: **this store survives a process crash, not a power
 * cut.** Recovery replays the write-ahead log after an unclean exit — that half
 * is real and `durability.test.ts` kills a process mid-work to prove it. But
 * `fsync=off` means the OS is never told to flush, so a power loss or a kernel
 * panic can leave the file set torn with no journal to fix it.
 *
 * THAT IS A DECISION, and this is where it is defensible rather than an engine
 * default nobody read:
 *   • `fsync` is set by PGlite ITSELF on the postgres command line (source:
 *     "command line", not "default"), and it is a SIGHUP-level setting — there is
 *     no `set fsync = on` from SQL and no config file this repo owns. The choice
 *     the app could make here has already been made for it by the embedding.
 *   • The contents are re-derivable. Every entity table is a mirror of a
 *     published dump and every derived table is recomputable
 *     (`lib/db/pglite/accounting.ts` classifies all 18), so the worst case of a
 *     power cut is an ingest pass, not a loss of anybody's only copy.
 *   • What is NOT re-derivable — `review_audit`, `lens_submission` — is exactly
 *     what `npm run db:backup` exists to copy, and the copy is a whole file set
 *     (`storeCopy.ts`), never the main files without `pg_wal`.
 *
 * WHY IT IS ASSERTED AT BOOT AND NOT JUST DOCUMENTED. Engines silently fall back
 * when a mode cannot be honoured — a sandboxed or network path is the classic
 * trigger — and every property above changes with it without anything failing.
 * A contract that is only in a comment is a claim; queried at boot it is an
 * observation. The two halves also persist differently: `wal_level` is a property
 * of the store, `synchronous_commit` is per connection and reverts at every open,
 * so this runs on every connection this repo manufactures rather than once.
 *
 * A mismatch is a LOUD DIAGNOSTIC, not a refusal. Nothing in this repo's
 * concurrency design depends on these values (there is one connection, and the
 * app degrades to labelled sample data when the store is unavailable), so
 * refusing to boot would trade a real outage for a changed footnote. What the
 * diagnostic must do is say what the store now promises INSTEAD, which it does.
 */

import type { Pglite } from "./internals";

/** The settings this repo has looked at, and what it recorded them as. */
export const DURABILITY_CONTRACT: Readonly<Record<string, string>> = {
  wal_level: "replica",
  full_page_writes: "on",
  synchronous_commit: "on",
  fsync: "off",
};

/** What each setting buys or costs, in the terms a postmortem would need. */
export const DURABILITY_MEANING: Readonly<Record<string, string>> = {
  wal_level: "write-ahead journaling: readers see a consistent snapshot while a writer appends",
  full_page_writes: "a page torn by an interrupted write is rebuilt from the journal",
  synchronous_commit: "a commit returns only after its journal record is written",
  fsync: "OFF — that journal write is never forced to stable storage, so a power cut can still lose or tear it",
};

export interface DurabilityReading {
  setting: string;
  effective: string;
  expected: string;
  /** Where postgres got the value: `default`, `command line`, `configuration file`… */
  source: string;
  matches: boolean;
}

export interface DurabilityCheck {
  readings: DurabilityReading[];
  mismatches: DurabilityReading[];
  /** One sentence naming what the store survives, derived from what was READ. */
  survives: string;
}

export function survivalSentence(readings: DurabilityReading[]): string {
  const by = new Map(readings.map((r) => [r.setting, r.effective]));
  const journaled = by.get("wal_level") !== "minimal";
  const flushed = by.get("fsync") === "on";
  const syncCommit = by.get("synchronous_commit") === "on";
  if (!journaled) return "NOTHING is guaranteed: without write-ahead journaling there is no log to recover from";
  if (flushed && syncCommit) return "a power cut, up to the last committed transaction";
  if (flushed) return "a power cut, minus commits that had not yet been flushed (synchronous_commit is off)";
  return "a process or OS crash, but NOT a power cut — fsync is off, so committed journal records may never have reached the disk";
}

/**
 * Read the effective settings and compare them with the recorded contract.
 * Pure read; safe on any connection, including one that has just opened.
 */
export async function checkDurability(pg: Pglite): Promise<DurabilityCheck> {
  const names = Object.keys(DURABILITY_CONTRACT);
  const r = await pg.query<{ name: unknown; setting: unknown; source: unknown }>(
    `select name, setting, source from pg_settings where name in (${names.map((n) => `'${n}'`).join(", ")})`,
  );
  const readings: DurabilityReading[] = names.map((name) => {
    const row = r.rows.find((x) => String(x.name) === name);
    const effective = row ? String(row.setting) : "(not reported by this engine)";
    return {
      setting: name,
      effective,
      expected: DURABILITY_CONTRACT[name]!,
      source: row ? String(row.source) : "(absent)",
      matches: effective === DURABILITY_CONTRACT[name],
    };
  });
  return {
    readings,
    mismatches: readings.filter((x) => !x.matches),
    survives: survivalSentence(readings),
  };
}

let lastCheck: DurabilityCheck | null = null;
/** What the last boot READ, for a support bundle or a failure report. */
export const lastDurabilityCheck = (): DurabilityCheck | null => lastCheck;

/**
 * Boot-time assertion. Silent when the store keeps the contract — a boot that
 * confirms the expected is not news — and loud, once, naming the new promise,
 * when it does not.
 */
export async function assertDurabilityContract(
  pg: Pglite,
  warn: (line: string) => void = (line) => console.warn(line),
): Promise<DurabilityCheck> {
  let check: DurabilityCheck;
  try {
    check = await checkDurability(pg);
  } catch (err) {
    warn(`[db] could not read the durability settings, so the contract is UNVERIFIED this boot: ${String(err)}`);
    throw err;
  }
  lastCheck = check;
  if (check.mismatches.length > 0) {
    warn(
      `[db] the store's durability settings differ from the recorded contract: ` +
        check.mismatches.map((m) => `${m.setting} is "${m.effective}" (source: ${m.source}), recorded as "${m.expected}"`).join("; ") +
        `. What it survives NOW: ${check.survives}. Update DURABILITY_CONTRACT in lib/db/pglite/durability.ts with ` +
        `the reason, or restore the setting — a contract nobody re-signed is a claim, not an observation.`,
    );
  }
  return check;
}

/** The on-demand rendering, for a support bundle beside `dbMetricsReport()`. */
export function durabilityReport(check: DurabilityCheck): string {
  const lines = [`[db] durability contract — this store survives ${check.survives}.`];
  for (const r of check.readings) {
    lines.push(
      `  ${r.setting.padEnd(19)} ${r.effective.padEnd(10)} (source: ${r.source})` +
        `${r.matches ? "" : ` — RECORDED AS "${r.expected}"`}`,
    );
    lines.push(`      ${DURABILITY_MEANING[r.setting] ?? ""}`);
  }
  lines.push(
    `  The file set is main files PLUS pg_wal: between checkpoints, committed data lives only in the journal. ` +
      `Every copy path in this repo goes through lib/db/pglite/storeCopy.ts, which copies the whole directory.`,
  );
  return lines.join("\n");
}
