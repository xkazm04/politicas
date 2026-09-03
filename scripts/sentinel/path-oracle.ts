/*
 * PATH ORACLE — offline regression check for /graf's evidence paths.
 * `npm run path-oracle`   ·   freeze: `npm run path-oracle -- --update`
 *
 * A path returned by /graf is a rendered claim of exactly the kind CLAUDE.md:190-193
 * calls the brand rule, and PermalinkPage mints a PERMANENT address for it — a reader is
 * invited to repeat it in public. `trailPath.test.ts` pins the ranking RULES on a synthetic
 * fixture; nothing pins the ANSWERS over the real graph, and those move on every
 * `da:kg-compute --commit` (a node crossing HUB_DEGREE re-prices every path through it; a
 * tie leaving pending_review changes tie-break key 2). This is the missing half.
 *
 * BESIDE THE SENTINEL, NOT INSIDE IT. `scripts/sentinel/run.ts` owns eleven invariants over
 * the whole store; this owns one question over one surface, and it borrows the sentinel's
 * store contract verbatim rather than forking it: SENTINEL_STORE / SENTINEL_NO_COPY, and
 * the copy-to-tmp discipline, so the LIVE dir is never opened (PGlite is single-connection).
 * It is not in `npm run check`, which runs without a store.
 *
 * NO MODEL, NO NETWORK, NO EMBEDDING. `findEvidencePaths` is exact and deterministic, so
 * the honest comparison is EQUALITY — no recall@k, no MRR, no tolerance the algorithm does
 * not have. Cf. lightrag/evaluation/offline_retrieval_check.py, which needs a lexical
 * scorer only because its ranker is approximate.
 *
 * THREE STATES, and the third is why this is trustworthy: `unevaluable` (store unreadable,
 * an endpoint has left the graph, or the row was never frozen) is NEVER a pass. Liveness is
 * asserted BEFORE any path is evaluated, per lib/testing/contextMapRefs.test.ts:20-23 —
 * "I found nothing wrong" and "I could not look" must not print identically.
 *
 * --update IS EXPLICIT AND NEVER AUTOMATIC. It writes only rows that would otherwise fail,
 * never on a green run, never as the default action on red, and never in CI. The review
 * surface is the JSON diff in version control; that read is the whole quality gate. Deciding
 * whether a CHANGED path is an improvement is editorial and stays human.
 *
 * Exit 0 = every evaluable row matches · 1 = drift · 2 = nothing could be evaluated.
 */

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { KG_NODE_KINDS } from "@/lib/analysis/kg-verdict";

const ORACLE = resolve("lib/testing/sentinel/path-oracle.json");

interface Hop { from: string; rel: string; to: string; pending: boolean; cite: string }
interface Expect { cost: number | null; pendingCount: number; totalFound: number; capped: boolean; moneyCzk: number; hops: Hop[] }
interface Row { id: string; src: string; dst: string; clause: string; cites: string; volatile?: string[]; expect: Expect | null }
interface Oracle { schema: string; doc: string; frozenAt: string | null; frozenAgainst: string | null; rows: Row[] }

const sig = (hops: Hop[]) => hops.map((h) => `${h.from}>${h.rel}>${h.to}`).join("|");
const cites = (hops: Hop[]) => hops.map((h) => h.cite).join("|");

/** Name WHICH clause moved. A path that changed because a hub crossed 120 is a different
 *  finding from one that changed because a tie was reviewed, and the report must say so. */
function drift(want: Expect, got: Expect, skip: readonly string[]): string[] {
  const out: string[] = [];
  if (want.cost !== got.cost) out.push(`cost ${want.cost} → ${got.cost} (hub pricing or an edge appeared/vanished)`);
  if (sig(want.hops) !== sig(got.hops)) out.push(`winner ${sig(want.hops) || "(none)"} → ${sig(got.hops) || "(none)"}`);
  else if (cites(want.hops) !== cites(got.hops)) {
    for (const [i, h] of want.hops.entries())
      if (h.cite !== got.hops[i]?.cite) out.push(`hop ${i + 1} (${h.from} –${h.rel}→ ${h.to}) citation ${h.cite} → ${got.hops[i]?.cite}`);
  }
  if (want.pendingCount !== got.pendingCount) out.push(`pendingCount ${want.pendingCount} → ${got.pendingCount} (a tie was reviewed)`);
  if (want.totalFound !== got.totalFound) out.push(`totalFound ${want.totalFound} → ${got.totalFound}`);
  if (want.capped !== got.capped) out.push(`capped ${want.capped} → ${got.capped} (ENUM_CAP)`);
  if (!skip.includes("moneyCzk") && want.moneyCzk !== got.moneyCzk) out.push(`moneyCzk ${want.moneyCzk} → ${got.moneyCzk}`);
  return out;
}

async function main(): Promise<number> {
  const update = process.argv.includes("--update");
  const oracle = JSON.parse(readFileSync(ORACLE, "utf8")) as Oracle;
  const source = resolve(process.env.SENTINEL_STORE || "./.pglite");
  if (!existsSync(source)) {
    console.error(`[path-oracle] store not found: ${source} — ${oracle.rows.length} rows UNEVALUABLE, none passed (exit 2)`);
    return 2;
  }

  let storePath = source;
  let copyDir: string | null = null;
  if (!(process.env.SENTINEL_NO_COPY === "1" && process.env.SENTINEL_STORE)) {
    copyDir = mkdtempSync(join(tmpdir(), "politicas-path-oracle-"));
    console.error(`[path-oracle] copying ${source} → ${copyDir} (never opening the live handle)…`);
    cpSync(source, copyDir, { recursive: true });
    rmSync(join(copyDir, "postmaster.pid"), { force: true }); // always stale on a copy
    storePath = copyDir;
  }

  process.env.PGLITE_PATH = storePath; // BEFORE the first import of the internals (open() memoises)
  let exitCode = 2;
  try {
    const { open } = await import("@/lib/db/pglite/internals");
    const { makeKgRepo } = await import("@/lib/db/pglite/repositories/kg");
    const { KG_READ_CAP } = await import("@/lib/db/readCap");
    const { buildAdjacency, findEvidencePaths } = await import("@/features/graph/trailPath");
    const pg = await open();
    try {
      const kg = makeKgRepo(pg);
      // Same edge set the loader builds paths over (graphLoader.ts:684-707): endpoints must
      // be nodes of a KNOWN kind, `pending` is read from review_state.
      const known = new Set(
        (await kg.listKgNodes({ limit: KG_READ_CAP }))
          .filter((n) => (KG_NODE_KINDS as readonly string[]).includes(n.kind))
          .map((n) => n.id),
      );
      const rows = await kg.listKgEdges({ limit: KG_READ_CAP });
      const cite = new Map<string, string>();
      const adj = buildAdjacency(
        rows
          .filter((e) => known.has(e.src) && known.has(e.dst))
          .map((e) => {
            const ref = typeof e.provenance?.ref === "string" ? e.provenance.ref : "(no ref)";
            cite.set(`${e.src}|${e.rel}|${e.dst}`, ref);
            return { src: e.src, dst: e.dst, rel: e.rel, weight: e.weight, pending: e.props.review_state === "pending_review" };
          }),
      );

      let ok = 0, moved = 0, blind = 0, frozen = 0;
      for (const row of oracle.rows) {
        // LIVENESS FIRST: a row whose endpoints have left the graph is unevaluable, never a
        // silent pass (guardKgReset's orphanedNodeIds exists because they do leave).
        const gone = [row.src, row.dst].filter((id) => !known.has(id));
        if (gone.length) { blind++; console.log(`  ? ${row.id.padEnd(26)} UNEVALUABLE — not a kg_node: ${gone.join(", ")}`); continue; }

        const r = findEvidencePaths(adj, row.src, row.dst);
        const best = r.paths[0];
        const got: Expect = {
          cost: r.cost, pendingCount: best?.pendingCount ?? 0, totalFound: r.totalFound, capped: r.capped,
          moneyCzk: best?.moneyCzk ?? 0,
          hops: (best?.hops ?? []).map((h) => ({
            from: h.from, rel: h.rel, to: h.to, pending: h.pending,
            cite: cite.get(h.forward ? `${h.from}|${h.rel}|${h.to}` : `${h.to}|${h.rel}|${h.from}`) ?? "(no ref)",
          })),
        };

        if (!row.expect) {
          blind++;
          console.log(`  ? ${row.id.padEnd(26)} UNEVALUABLE — never frozen; today it answers cost=${got.cost} hops=${sig(got.hops) || "(none)"}`);
          if (update) { row.expect = got; frozen++; }
          continue;
        }
        const found = drift(row.expect, got, row.volatile ?? []);
        if (!found.length) { ok++; console.log(`  ✓ ${row.id.padEnd(26)} cost=${got.cost} ${sig(got.hops) || "(honest emptiness)"}`); continue; }
        moved++;
        console.log(`  ✗ ${row.id.padEnd(26)} MOVED — ${row.clause.split(" - ")[0]}`);
        for (const d of found) console.log(`      ${d}`);
        if (update) { row.expect = got; frozen++; }
      }

      console.log(`\n${ok} matched · ${moved} moved · ${blind} unevaluable · of ${oracle.rows.length} rows (store ${storePath})`);
      // NOTHING IS WRITTEN unless a row would otherwise fail, and only under --update.
      if (update && frozen > 0) {
        oracle.frozenAt = new Date().toISOString();
        oracle.frozenAgainst = `${known.size} kg_node · ${rows.length} kg_edge`;
        writeFileSync(ORACLE, JSON.stringify(oracle, null, 2) + "\n", "utf8");
        console.log(`[path-oracle] --update wrote ${frozen} row(s) to ${ORACLE}. READ THE DIFF: a changed path is an editorial decision, not a rebless.`);
      } else if (moved > 0) {
        console.log(`[path-oracle] to accept these answers, review them and re-run with --update. Nothing was written.`);
      }
      exitCode = update && frozen > 0 ? 0 : moved > 0 ? 1 : ok > 0 ? 0 : 2;
    } finally {
      await pg.close();
    }
  } catch (err) {
    console.error(`[path-oracle] store unreadable or check crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    exitCode = 2;
  } finally {
    // Windows can hold a lock a beat after close; a leftover in the OS tmpdir is disk noise,
    // not a correctness problem — but say so rather than vanishing the failure.
    if (copyDir) try { rmSync(copyDir, { recursive: true, force: true }); }
    catch (err) { console.error(`[path-oracle] could not remove copy ${copyDir}: ${err instanceof Error ? err.message : String(err)}`); }
  }
  return exitCode;
}

main().then(
  (code) => process.exit(code),
  (err) => { console.error(`[path-oracle] fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`); process.exit(2); },
);
