/*
 * QUARANTINE, PROVED FROM THE OTHER SIDE: nothing live may reach into
 * `scripts/**\/archive/`.
 *
 * This repo's posture on a script that has done its job is to move it under
 * `archive/` rather than delete it — the right posture for one-shot analysis
 * passes whose output is committed evidence: the record of HOW a number was
 * produced outlives the run. `contextMapRefs.test.ts` already closes the map
 * side of this class (the map may not name files that are gone). The direction
 * left open until now is the one that makes "archived" mean anything at all: a
 * file in a folder called `archive/` that live code still imports is not
 * archived, it is live code in a misleading folder, and the next person to prune
 * the folder breaks the tree.
 *
 * WHAT COUNTS AS A REFERENCE, and what deliberately does not:
 *   • code and wiring — every `.ts/.tsx/.mjs/.cjs` outside `archive/`, plus
 *     `package.json` (a script entry pointing into `archive/` is a live command
 *     depending on quarantined code) and the CI workflow.
 *   • NOT prose. `docs/**` and the memos discuss archived passes constantly and
 *     must keep doing so — a citation of what was run in batch 008 is the
 *     evidence trail, not a dependency.
 *   • NOT `context-map.json`. The map is an inventory of what exists, and the
 *     archived files DO exist; naming them is its job, not a call site.
 *
 * Gate liveness: the walk asserts both denominators before asserting the
 * finding, so a refactor that stops it seeing archived files, or stops it seeing
 * live ones, fails as "I could not look" instead of passing as "I found
 * nothing".
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(__dirname, "..", "..");
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "data",
  "docs",
  "memory",
  "benchmark-data",
  // Agent worktrees live INSIDE the repo dir (.claude/worktrees/<agent>/…), each a
  // full clone with its own node_modules: measured 2026-09-05 with five builders
  // running, 10 730 of the walk's 16 431 files were worktree copies and the
  // 5 s budget became 94 s. A worktree is another checkout, not this tree.
  "worktrees",
]);
const LIVE_EXTS = [".ts", ".tsx", ".mjs", ".cjs"];
/** Non-source files whose content is still wiring: a command, a CI step. */
const EXTRA_LIVE_FILES = ["package.json", ".github/workflows/ci.yml", "lefthook.yml"];

/** The floors below which the walk has stopped seeing the tree, not the tree
 *  having stopped containing things. Both were measured 2026-08-24: 96 archived
 *  files, 300 live source files. */
const MIN_ARCHIVED = 50;
const MIN_LIVE = 200;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".pglite") || entry.name.startsWith(".data")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const isArchived = (path: string) => relative(REPO, path).split(sep).includes("archive");
const posix = (path: string) => relative(REPO, path).split(sep).join("/");

/**
 * Does `text` reach into the archived file at repo-relative `rel`?
 *
 * Every realistic form of reaching one carries the folder segment:
 * `scripts/x/archive/y.ts` in a command, `./archive/y` or `../archive/y` in an
 * import. Matching on the segment rather than on the bare stem is what keeps a
 * generically named pass (`merge-batch-010`) from colliding with prose that
 * merely mentions it — the distinction the whole check depends on.
 */
export function reachesInto(text: string, rel: string): boolean {
  const base = rel.slice(rel.lastIndexOf("/") + 1);
  const stem = base.replace(/\.(ts|tsx|mjs|cjs)$/, "");
  return (
    text.includes(`archive/${base}`) ||
    text.includes(`archive/${stem}"`) ||
    text.includes(`archive/${stem}'`) ||
    text.includes(`archive/${stem}\``)
  );
}

const all = walk(REPO);
const archived = all.filter((p) => isArchived(p) && LIVE_EXTS.some((e) => p.endsWith(e)));
const liveSources = all.filter((p) => !isArchived(p) && LIVE_EXTS.some((e) => p.endsWith(e)));
const wiring = EXTRA_LIVE_FILES.map((f) => join(REPO, f)).filter((f) => {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
});

describe("archived scripts are quarantined, not merely relocated", () => {
  it("looked at a real tree", () => {
    expect(archived.length).toBeGreaterThanOrEqual(MIN_ARCHIVED);
    expect(liveSources.length).toBeGreaterThanOrEqual(MIN_LIVE);
    expect(wiring.length).toBeGreaterThanOrEqual(2);
  });

  it("is referenced by nothing live", () => {
    // One read per live file, not one per (live × archived) pair.
    const haystacks = [...liveSources, ...wiring]
      .filter((p) => !p.endsWith("archivedScripts.test.ts"))
      .map((p) => ({ path: posix(p), text: readFileSync(p, "utf8") }));

    const offences: string[] = [];
    for (const file of archived) {
      const rel = posix(file);
      for (const h of haystacks) {
        if (reachesInto(h.text, rel)) offences.push(`${h.path} reaches into ${rel}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it("would notice a live file that reached in", () => {
    // The guard's own red state, over the SAME predicate the scan uses: a check
    // whose failure has never been observed is a check nobody should trust.
    const rel = posix(archived[0]!);
    const stem = rel.slice(rel.lastIndexOf("/") + 1).replace(/\.ts$/, "");
    expect(reachesInto(`import { run } from "./archive/${stem}";`, rel)).toBe(true);
    expect(reachesInto(`npx tsx ${rel} --commit`, rel)).toBe(true);
    expect(reachesInto(`// batch 008 was produced by ${stem}, see docs/`, rel)).toBe(false);
  });
});
