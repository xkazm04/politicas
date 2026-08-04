/*
 * LIVE-GRAPH SENTINEL — runner (batch-7 item 7E). `npm run sentinel`
 *
 * Opens the REAL store READ-ONLY and asserts the live invariants (see
 * lib/testing/sentinel/invariants.ts): counts within released-manifest bounds,
 * audit chain verifies, no orphan edges, readiness floors hold, freshness
 * within atlas cadences, sampled derivations deterministic across two passes.
 *
 * READ-ONLY GUARANTEE: PGlite is single-connection (lib/db/config.ts) — a
 * second handle on a live dir corrupts or blocks, and even a healthy handle
 * could write. The runner therefore NEVER opens the source dir: it copies it
 * to a tmpdir first and points PGLITE_PATH at the copy; the copy is deleted
 * after the run. Fact collection itself is SELECT-only on top of that.
 *
 *   npm run sentinel                          # copies ./.pglite → tmp, audits
 *   SENTINEL_STORE=./.pglite-copy npm run sentinel   # audit another dir
 *   SENTINEL_NO_COPY=1 SENTINEL_STORE=<copy> npm run sentinel
 *       # skip the copy — ONLY for a dir that is already a cold copy
 *   SENTINEL_JSON=out.json npm run sentinel   # also write the machine report
 *
 * Output: human summary on stdout, machine JSON (canonical, politicas.sentinel/1)
 * after the marker line, exit 0 = all invariants hold, 1 = violation, 2 = store
 * unreadable.
 *
 * THIS COMMAND IS THE REAL EXECUTION PATH. `.github/workflows/sentinel.yml` exists,
 * but on a hosted runner there is no `./.pglite` (a local, gitignored 1.6 GB data dir),
 * so its guard step turns the nightly into a deliberate no-op. A green nightly is
 * therefore NOT evidence that the invariants hold — including the four scoring
 * invariants added 2026-08-04, which are the only thing standing between a formula
 * correction and a silently stale published ranking. Run this locally after any
 * contribution pass.
 */

import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const JSON_MARKER = "--- sentinel machine report (politicas.sentinel/1) ---";

async function main(): Promise<number> {
  const source = resolve(process.env.SENTINEL_STORE || "./.pglite");
  if (!existsSync(source)) {
    console.error(`[sentinel] store not found: ${source} — nothing to audit (exit 2)`);
    return 2;
  }

  const skipCopy = process.env.SENTINEL_NO_COPY === "1" && Boolean(process.env.SENTINEL_STORE);
  let storePath = source;
  let copiedFrom: string | null = null;
  let copyDir: string | null = null;
  if (!skipCopy) {
    copyDir = mkdtempSync(join(tmpdir(), "politicas-sentinel-"));
    console.error(`[sentinel] copying ${source} → ${copyDir} (never opening the live handle)…`);
    cpSync(source, copyDir, { recursive: true });
    // A copied postmaster.pid is ALWAYS stale (this copy was never started) and
    // makes PGlite refuse/abort the open. Removing it is safe for the copy and
    // never touches the source. NOTE: if the source was being written while we
    // copied (a dev server holds the live handle), the copy can still be torn —
    // in that case run against a cold copy: SENTINEL_STORE=<copy> npm run sentinel.
    rmSync(join(copyDir, "postmaster.pid"), { force: true });
    storePath = copyDir;
    copiedFrom = source;
  } else {
    console.error(`[sentinel] SENTINEL_NO_COPY=1 — opening ${source} directly (caller vouches it is a cold copy)`);
  }

  // PGLITE_PATH must be set BEFORE anything imports lib/db/pglite/internals —
  // open() memoises the connection on globalThis (same discipline as
  // lib/testing/leaderboard-loader.test.ts).
  process.env.PGLITE_PATH = storePath;
  const { open } = await import("@/lib/db/pglite/internals");
  const { collectSentinelFacts } = await import("@/lib/testing/sentinel/facts");
  const { evaluateSentinel } = await import("@/lib/testing/sentinel/invariants");
  const { renderSentinelSummary, serializeSentinelReport } = await import("@/lib/testing/sentinel/report");

  let exitCode: number;
  try {
    const pg = await open();
    try {
      console.error("[sentinel] pass 1/2: collecting facts…");
      const passA = await collectSentinelFacts(pg);
      console.error("[sentinel] pass 2/2: collecting facts…");
      const passB = await collectSentinelFacts(pg);
      const report = evaluateSentinel(passA, passB, {
        now: new Date().toISOString(),
        storePath,
        copiedFrom,
      });
      console.log(renderSentinelSummary(report));
      const json = serializeSentinelReport(report);
      console.log(`\n${JSON_MARKER}\n${json}`);
      if (process.env.SENTINEL_JSON) {
        writeFileSync(resolve(process.env.SENTINEL_JSON), json + "\n", "utf8");
        console.error(`[sentinel] machine report written to ${resolve(process.env.SENTINEL_JSON)}`);
      }
      exitCode = report.verdict === "ok" ? 0 : 1;
    } finally {
      await pg.close();
    }
  } catch (err) {
    console.error(`[sentinel] store unreadable or audit crashed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    exitCode = 2;
  } finally {
    if (copyDir) {
      try {
        rmSync(copyDir, { recursive: true, force: true });
        console.error(`[sentinel] copy removed: ${copyDir}`);
      } catch (err) {
        // Windows can hold file locks a beat after close; the copy lives in the
        // OS tmpdir, so a leftover is disk noise, not a correctness problem —
        // but say so instead of vanishing the failure.
        console.error(`[sentinel] could not remove copy ${copyDir}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return exitCode;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`[sentinel] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    process.exit(2);
  },
);
