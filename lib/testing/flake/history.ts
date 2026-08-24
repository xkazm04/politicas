/**
 * RETAINED, STABLY-KEYED RUN HISTORY — the substrate both flake detection and
 * duration-based ordering need, and which this repo had none of.
 *
 * One JSON file per run under `node_modules/.cache/politicas-test-history/`. That
 * location is deliberate: it is gitignored by construction (no .gitignore edit),
 * it survives across runs on a developer's box, and `npm ci` wipes it — which is
 * honest, because a history that outlives its dependency tree is measuring a
 * different harness.
 *
 * IDENTITY. Keyed by `<repo-relative module path> > <full test name>`. NOT by
 * vitest's `TestCase.id`, which the API documents as derived from "project name,
 * module url and test ORDER" — that resets every history whenever somebody inserts
 * a test above another one, which is exactly the silent degradation
 * test-harness/history-driven-partitioning states as an identity requirement
 * rather than a storage detail. This key survives reordering. It does NOT survive
 * a rename of the file or the test, and that limitation is stated, not hidden: a
 * renamed test goes cold and takes the pessimistic default until it is measured
 * again.
 *
 * SAME-CODE. Each run records the HEAD sha and whether the tree was dirty.
 * `detect.ts` only compares runs that share a HEAD and were clean, because
 * outcomes compared across different trees measure the product's churn, not the
 * test's stability — and it publishes how many runs it could actually use, so a
 * figure computed over three runs cannot be mistaken for one computed over a
 * hundred.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Outcome = "passed" | "failed" | "skipped";

export interface RunRecord {
  /** ISO instant the run finished. */
  at: string;
  /** HEAD sha at the time of the run, or "unknown". */
  head: string;
  /** Whether tracked files were modified — a dirty tree is not "the same code". */
  dirty: boolean;
  /** Which lane produced this record. */
  lane: string;
  /** `<module> > <full name>` → outcome + duration in ms. */
  tests: Record<string, { s: Outcome; d: number }>;
}

export const HISTORY_DIR = join(process.cwd(), "node_modules", ".cache", "politicas-test-history");
/** Keep the window bounded; the reaper for a run record is the next run's prune. */
export const HISTORY_KEEP = 40;

export function testKey(moduleRelPath: string, fullName: string): string {
  return `${moduleRelPath.replace(/\\/g, "/")} > ${fullName}`;
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

export function currentCode(): { head: string; dirty: boolean } {
  try {
    const head = git(["rev-parse", "HEAD"]);
    // -uno: untracked files do not change what the tests execute.
    const dirty = git(["status", "--porcelain", "--untracked-files=no"]).length > 0;
    return { head, dirty };
  } catch (err) {
    // No git (a tarball checkout, a sandbox). "unknown" + dirty makes detect.ts
    // refuse a verdict rather than compare across unknown code.
    console.warn("[test-history] could not read git HEAD; this run cannot be compared for flakiness", err);
    return { head: "unknown", dirty: true };
  }
}

export function writeRun(record: RunRecord): string {
  mkdirSync(HISTORY_DIR, { recursive: true });
  const name = `${Date.now()}-${record.lane}-${record.head.slice(0, 8)}.json`;
  const path = join(HISTORY_DIR, name);
  writeFileSync(path, JSON.stringify(record));
  prune();
  return path;
}

function prune(): void {
  const files = readdirSync(HISTORY_DIR).filter((f) => f.endsWith(".json")).sort();
  for (const f of files.slice(0, Math.max(0, files.length - HISTORY_KEEP))) {
    try {
      rmSync(join(HISTORY_DIR, f), { force: true });
    } catch (err) {
      console.warn(`[test-history] could not prune ${f} (a concurrent run may hold it)`, err);
    }
  }
}

export function readRuns(lane?: string): RunRecord[] {
  if (!existsSync(HISTORY_DIR)) return [];
  const out: RunRecord[] = [];
  for (const f of readdirSync(HISTORY_DIR).filter((n) => n.endsWith(".json")).sort()) {
    try {
      const r = JSON.parse(readFileSync(join(HISTORY_DIR, f), "utf8")) as RunRecord;
      if (!lane || r.lane === lane) out.push(r);
    } catch (err) {
      console.warn(`[test-history] skipping unreadable run record ${f} — a killed run truncates one`, err);
    }
  }
  return out;
}

/**
 * Median measured duration per MODULE, in ms, over the retained window.
 * Module-level (not test-level) because the thing being ordered is a file.
 */
export function moduleDurations(lane?: string): Map<string, number> {
  const samples = new Map<string, number[]>();
  for (const run of readRuns(lane)) {
    const perModule = new Map<string, number>();
    for (const [key, v] of Object.entries(run.tests)) {
      const mod = key.split(" > ")[0];
      perModule.set(mod, (perModule.get(mod) ?? 0) + v.d);
    }
    for (const [mod, total] of perModule) {
      const list = samples.get(mod) ?? [];
      list.push(total);
      samples.set(mod, list);
    }
  }
  const out = new Map<string, number>();
  for (const [mod, list] of samples) {
    list.sort((a, b) => a - b);
    out.set(mod, list[Math.floor(list.length / 2)]);
  }
  return out;
}
