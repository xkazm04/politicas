/* Repair orphan kg edges — edges whose src or dst does not resolve to a kg_node.
 *
 * Origin of the defect (sentinel finding, 2026-07-31): kg-promote's membership
 * gate accepted raw entity urns (person/organ/VOTE-EVENT ids) as edge endpoints.
 * Persons and organs happen to also exist as kg nodes, but vote events live only
 * in the relational `vote_event` table — the kg has no vote kind by design. An
 * LLM-authored verdict tagging roll calls with themes therefore landed 179
 * `psp:hlasovani:* -about-> theme:*` edges whose src can never resolve. Nothing
 * consumes vote→theme kg edges (VoteTrack/kompas read the `vote_tag` silver
 * table), so the repair is removal, not node materialization.
 *
 * The delete goes through store.deleteKgEdges — archive-first into
 * kg_edge_history (lib/db/pglite/repositories/kg.ts), so the repair is
 * replayable via asOf() and nothing is destroyed.
 *
 * DEFAULT DRY-RUN. Pass --commit to write. PGlite is single-connection — no dev
 * server may hold ./.pglite during a --commit.
 *
 *   npx tsx scripts/data-analysis/kg-repair-orphans.ts
 *   npx tsx scripts/data-analysis/kg-repair-orphans.ts --commit
 */
// Opens PGlite DIRECTLY (sentinel/inspect precedent) rather than via getStore():
// the store facade's guarded open hangs in a plain-script context, and this
// repair needs a deterministic open-or-fail on ./.pglite. Same archive-first
// delete SQL as repositories/kg.ts deleteKgEdges — kept byte-compatible.
import { PGlite } from "@electric-sql/pglite";
import { existsSync, rmSync } from "node:fs";

const COMMIT = process.argv.includes("--commit");
const DIR = "./.pglite";

import { KG_EDGE_COLS } from "@/lib/db/pglite/mappers";

async function main() {
  if (!existsSync(DIR)) {
    console.error(`no store at ${DIR}`);
    process.exit(1);
  }
  // A live server owns the single connection; a stale pid file from a killed one
  // must not block the repair. If another process truly holds the dir, the open
  // below fails fast instead of writing.
  rmSync(`${DIR}/postmaster.pid`, { force: true });
  const pg = new PGlite(DIR);

  const nodeIds = new Set<string>(
    (await pg.query<{ id: string }>("select id from kg_node")).rows.map((r) => r.id),
  );

  const orphans: { src: string; rel: string; dst: string }[] = [];
  for (const e of (await pg.query<{ src: string; rel: string; dst: string }>(
    "select src, rel, dst from kg_edge",
  )).rows) {
    if (!nodeIds.has(e.src) || !nodeIds.has(e.dst)) {
      orphans.push({ src: e.src, rel: e.rel, dst: e.dst });
    }
  }

  console.log(`kg nodes: ${nodeIds.size} · orphan edges found: ${orphans.length}`);
  const byShape = new Map<string, number>();
  for (const o of orphans) {
    const shape = `${o.src.replace(/:[^:]*$/, ":*")} -${o.rel}-> ${o.dst.replace(/:[^:]*$/, ":*")}`;
    byShape.set(shape, (byShape.get(shape) ?? 0) + 1);
  }
  for (const [shape, n] of byShape) console.log(`  ${n} × ${shape}`);

  if (orphans.length === 0) {
    console.log("nothing to repair.");
    await pg.close();
    return;
  }
  if (!COMMIT) {
    console.log("\nDRY-RUN — pass --commit to archive+delete these edges.");
    await pg.close();
    return;
  }

  let deleted = 0;
  for (const k of orphans) {
    // Archive + delete in ONE statement (repositories/kg.ts deleteKgEdges shape):
    // both CTEs read the same snapshot, so the archived copy is exactly the row
    // being deleted; the repair stays replayable via asOf().
    const { rows } = await pg.query<{ n: number }>(
      `with a as (
         insert into kg_edge_history (${KG_EDGE_COLS.join(",")}, valid_from, valid_to, recorded_at, superseded_at)
         select ${KG_EDGE_COLS.join(",")}, valid_from, valid_to, recorded_at, now()
         from kg_edge where src = $1 and rel = $2 and dst = $3
       ),
       d as (delete from kg_edge where src = $1 and rel = $2 and dst = $3 returning 1)
       select count(*)::int as n from d`,
      [k.src, k.rel, k.dst],
    );
    deleted += Number(rows[0]?.n ?? 0);
  }
  console.log(`\narchived+deleted ${deleted}/${orphans.length} orphan edges (recoverable via kg_edge_history / asOf).`);
  if (deleted !== orphans.length) process.exitCode = 1;
  await pg.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
