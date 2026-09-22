/**
 * THE DEGRADATION LOG — which surfaces fell back to mock, and when.
 *
 * WHY. `reportLoaderFailure` has 121 call sites and, until now, exactly two
 * sinks: `console.error` (gone the moment the terminal scrolls) and
 * `Sentry.captureException`, which is a NO-OP in this repo because there is no
 * DSN (docs/routes/app-shell.md says so plainly). So the question an operator
 * actually asks — "which surfaces degraded in the last 24 hours?" — was
 * unanswerable, and the loader convention's own failure mode is invisibility: a
 * dead store is indistinguishable from an empty graph.
 *
 * WHAT THIS IS. A bounded JSONL sidecar beside the store, one line per
 * degradation, plus a summary the admin surface renders and the sentinel reads
 * as a check. Same shape and the same "write fails LOUD" contract as
 * `features/admin/loops/driveLog.ts` — with ONE deliberate difference stated
 * here: this file's writer is a CATCH BLOCK. A throw from the log would replace
 * the loader's honest fallback with a crash, turning an observability feature
 * into an outage. So `append` catches its own failure and reports it to stderr
 * once per process. That is the one place in this repo where a silent-ish write
 * is right, and it is silent about the LOG, never about the degradation: the
 * console line the reporter already prints is unconditional.
 *
 * BOUNDED, because an unbounded log of a failing loader on a page a crawler
 * hits is a disk filler. The file is trimmed to the newest MAX_ENTRIES on
 * append; a trimmed line is gone, and the summary says how many it counted, not
 * how many ever happened.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Runtime data file (never a build asset); env-overridable for tests. */
export function loaderFailurePath(): string {
  return process.env.LOADER_FAILURE_PATH || "./.data/loader-failures.jsonl";
}

/** The path as it is admitted in UI / JSON — no leading "./", "/" even on Windows. */
export const loaderFailureDisplayPath = (): string =>
  loaderFailurePath().replaceAll("\\", "/").replace(/^\.\//, "");

/** Newest N kept. Beyond this the oldest lines are dropped, and the count says so. */
export const MAX_ENTRIES = 2000;

export interface LoaderFailureEntry {
  /** ISO instant of the degradation. */
  at: string;
  /** The loader's own name, as passed to reportLoaderFailure. */
  loader: string;
  /** The error's message — never the stack: a log is not a crash reporter. */
  message: string;
}

let warnedAboutWriteFailure = false;

/**
 * Append one degradation. NEVER THROWS — see the header: this writer runs inside
 * a catch block, and a throw here would convert an honest fallback into a crash.
 */
export function appendLoaderFailure(loader: string, err: unknown, now = new Date()): void {
  const entry: LoaderFailureEntry = {
    at: now.toISOString(),
    loader,
    message: err instanceof Error ? err.message : String(err),
  };
  const path = loaderFailurePath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
    trimIfLong(path);
  } catch (writeErr) {
    if (!warnedAboutWriteFailure) {
      warnedAboutWriteFailure = true;
      console.error(
        `[loader-log] cannot write ${path} — degradations are still logged to the console, ` +
          `but /admin's 24 h roll-up and the sentinel's loader-degradations check will read nothing: ${String(writeErr)}`,
      );
    }
  }
}

function trimIfLong(path: string): void {
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.trim() !== "");
  if (lines.length <= MAX_ENTRIES) return;
  writeFileSync(path, `${lines.slice(-MAX_ENTRIES).join("\n")}\n`, "utf8");
}

/** Read the log. A malformed line is SKIPPED and counted, never guessed at. */
export function readLoaderFailures(path = loaderFailurePath()): {
  entries: LoaderFailureEntry[];
  malformed: number;
} {
  if (!existsSync(path)) return { entries: [], malformed: 0 };
  const entries: LoaderFailureEntry[] = [];
  let malformed = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    try {
      const raw = JSON.parse(line) as Partial<LoaderFailureEntry>;
      if (typeof raw.at === "string" && typeof raw.loader === "string" && typeof raw.message === "string") {
        entries.push(raw as LoaderFailureEntry);
      } else {
        malformed += 1;
      }
    } catch {
      // A half-written line (the process died mid-append) is not a degradation
      // and must not be counted as one. Counted separately, never repaired.
      malformed += 1;
    }
  }
  return { entries, malformed };
}

export interface LoaderDegradationSummary {
  /** Degradations within the window. */
  total: number;
  /** Distinct loaders that degraded, newest-first by their last occurrence. */
  byLoader: Array<{ loader: string; count: number; lastAt: string }>;
  /** The newest degradation's instant, or null when the window is clean. */
  lastAt: string | null;
  windowHours: number;
  /** The file it was read from — printed, so the number is checkable. */
  path: string;
  malformed: number;
}

export const DEFAULT_WINDOW_HOURS = 24;

/**
 * Roll the log up over a window.
 *
 * Returns `null` when the FILE DOES NOT EXIST, and that is the whole point:
 * "no file" and "no degradations" are opposite findings. An absent log means
 * nobody was watching; a present, empty log means somebody was and nothing
 * happened. The sentinel maps the first to `unevaluable` and the second to `ok`.
 */
export function summarizeLoaderDegradations(opts: {
  path?: string;
  now?: Date;
  windowHours?: number;
} = {}): LoaderDegradationSummary | null {
  const path = opts.path ?? loaderFailurePath();
  if (!existsSync(path)) return null;
  const windowHours = opts.windowHours ?? DEFAULT_WINDOW_HOURS;
  const now = opts.now ?? new Date();
  const cutoff = now.getTime() - windowHours * 3_600_000;

  const { entries, malformed } = readLoaderFailures(path);
  const inWindow = entries.filter((e) => {
    const t = Date.parse(e.at);
    return Number.isFinite(t) && t >= cutoff;
  });

  const byLoader = new Map<string, { count: number; lastAt: string }>();
  for (const e of inWindow) {
    const seen = byLoader.get(e.loader);
    byLoader.set(e.loader, {
      count: (seen?.count ?? 0) + 1,
      lastAt: seen && seen.lastAt > e.at ? seen.lastAt : e.at,
    });
  }

  return {
    total: inWindow.length,
    byLoader: [...byLoader]
      .map(([loader, v]) => ({ loader, ...v }))
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : b.count - a.count)),
    lastAt: inWindow.reduce<string | null>((best, e) => (best === null || e.at > best ? e.at : best), null),
    windowHours,
    path: loaderFailureDisplayPath(),
    malformed,
  };
}
