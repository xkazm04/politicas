/**
 * Read-only inspection of the two 2026-07-31 sentinel findings, run against a
 * COLD store copy (never the live handle). Usage:
 *   npx tsx scripts/sentinel/inspect-findings.ts [storeDir]
 */
import { PGlite } from "@electric-sql/pglite";
import { cpSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const src = process.argv[2] ?? ".pglite-backup-pass11";

async function main() {
  if (!existsSync(src)) {
    console.error(`store not found: ${src}`);
    process.exit(2);
  }
  const work = mkdtempSync(join(tmpdir(), "politicas-inspect-"));
  cpSync(src, work, { recursive: true });
  rmSync(join(work, "postmaster.pid"), { force: true });

  const pg = new PGlite(work);
  const q = async (sql: string) => (await pg.query(sql)).rows as Record<string, unknown>[];

  try {
    console.log("=== 1. Orphan edges (sentinel definition: any dangling endpoint) ===");
    console.log(await q(`
      select count(*)::int as total,
             count(*) filter (where not exists (select 1 from kg_node s where s.id = e.src))::int as dangling_src,
             count(*) filter (where not exists (select 1 from kg_node d where d.id = e.dst))::int as dangling_dst
      from kg_edge e
      where not exists (select 1 from kg_node s where s.id = e.src)
         or not exists (select 1 from kg_node d where d.id = e.dst)`));
    console.log("grouped by rel + dangling-endpoint prefix:");
    console.log(await q(`
      select e.rel,
             case when not exists (select 1 from kg_node d where d.id = e.dst)
                  then substring(e.dst from '^[a-z_]+:') else null end as bad_dst_prefix,
             case when not exists (select 1 from kg_node s where s.id = e.src)
                  then substring(e.src from '^[a-z_]+:') else null end as bad_src_prefix,
             count(*)::int as n
      from kg_edge e
      where not exists (select 1 from kg_node s where s.id = e.src)
         or not exists (select 1 from kg_node d where d.id = e.dst)
      group by 1,2,3 order by n desc limit 15`));
    console.log("sample rows:");
    console.log(await q(`
      select e.src, e.rel, e.dst from kg_edge e
      where not exists (select 1 from kg_node s where s.id = e.src)
         or not exists (select 1 from kg_node d where d.id = e.dst)
      order by src, rel, dst limit 10`));
    console.log("distinct dangling dst ids (top 15 by edge count):");
    console.log(await q(`
      select e.dst, count(*)::int as n from kg_edge e
      where not exists (select 1 from kg_node d where d.id = e.dst)
      group by e.dst order by n desc limit 15`));
    console.log("kg_node kinds present:");
    console.log(await q(`select kind, count(*)::int as n from kg_node group by kind order by n desc limit 12`));
    console.log("healthy edges of the SAME rels (where do they point?):");
    console.log(await q(`
      select e.rel, substring(e.dst from '^[a-z_]+:') as dst_prefix, count(*)::int as n
      from kg_edge e
      where e.rel in (select distinct rel from kg_edge x
                      where not exists (select 1 from kg_node d where d.id = x.dst))
        and exists (select 1 from kg_node d where d.id = e.dst)
      group by 1,2 order by n desc limit 10`));

    console.log("\n=== 2. pumper-psp-opendata staleness ===");
    console.log(await q(`
      select source, status, started_at, finished_at, merkle_root is not null as sealed
      from ingest_run
      where source like '%pumper%'
      order by started_at desc limit 8`));
    console.log("all sources last ok run:");
    console.log(await q(`
      select source, max(finished_at) as last_ok
      from ingest_run where status = 'ok'
      group by source order by last_ok desc limit 12`));
  } finally {
    await pg.close();
    rmSync(work, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
