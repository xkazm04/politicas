/* DB-architecture experiment #1 — OLAP over the 406k-ballot table.
 * The canonical "do I need a columnar/analytical DB, or is the embedded row-store
 * enough?" question, measured on Politicas's biggest real table across:
 *   • PGlite      (embedded Postgres, the incumbent — row store)
 *   • DuckDB      (in-process columnar, vectorized)
 *   • node:sqlite (built-in row store)
 * Same data, same aggregates, warm-median latency. Feeds docs/db-architecture-guide.md.
 *
 *   cp -r .pglite .pglite-bench
 *   NODE_OPTIONS=--experimental-sqlite npx tsx scripts/db-bench/olap.ts --pglite=.pglite-bench
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { PGlite } from "@electric-sql/pglite";
import { DuckDBInstance } from "@duckdb/node-api";

function arg(name: string, fb: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fb;
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.floor(s.length / 2)]! * 10) / 10; };

// Aggregates parameterised by table name. checksum = a scalar to cross-check
// correctness across engines. A1/A2 are group-by scans; A3 is the heavy
// self-join (the co-vote agreement workload) where vectorized columnar should win.
const AGGS = (T: string) => [
  { id: "A1 group-by mandate×choice", sql: `select mandate_psp_id, choice, count(*) c from ${T} group by mandate_psp_id, choice`, reps: 5, scalar: false },
  { id: "A2 per-vote yes-rate", sql: `select vote_psp_id, sum(case when choice='yes' then 1 else 0 end) y, count(*) n from ${T} group by vote_psp_id`, reps: 5, scalar: false },
  { id: "A3 self-join agreement pairs", sql: `select count(*) c from ${T} a join ${T} b on a.vote_psp_id=b.vote_psp_id and a.mandate_psp_id < b.mandate_psp_id and a.choice=b.choice where a.choice in ('yes','no')`, reps: 2, scalar: true },
];

interface Row3 { vote_psp_id: number; mandate_psp_id: number; choice: string; }

async function main() {
  const pgPath = arg("pglite", ".pglite-bench");
  const outDir = arg("out", "./.db-bench");
  mkdirSync(outDir, { recursive: true });

  // ── extract the 3 columns the aggregates need, from the incumbent ──
  const pg = new PGlite(pgPath);
  await pg.waitReady;
  const t0 = performance.now();
  const res = await pg.query<Row3>(`select vote_psp_id, mandate_psp_id, choice from vote_ballot`);
  const ballots = res.rows;
  console.log(`extracted ${ballots.length} ballots from PGlite in ${Math.round(performance.now() - t0)}ms\n`);

  // ── DuckDB: load via CSV (read_csv_auto) ──
  const csv = join(outDir, "ballots.csv");
  writeFileSync(csv, "vote_psp_id,mandate_psp_id,choice\n" + ballots.map((b) => `${b.vote_psp_id},${b.mandate_psp_id},${b.choice}`).join("\n"));
  const duck = await DuckDBInstance.create(":memory:");
  const dconn = await duck.connect();
  const dLoad0 = performance.now();
  await dconn.run(`create table ballot as select * from read_csv_auto('${csv.replace(/\\/g, "/")}', header=true)`);
  const duckLoadMs = Math.round(performance.now() - dLoad0);

  // ── node:sqlite: load from the array + index (fair join support) ──
  const sq = new DatabaseSync(":memory:");
  sq.exec(`create table ballot(vote_psp_id integer, mandate_psp_id integer, choice text)`);
  const sLoad0 = performance.now();
  const ins = sq.prepare(`insert into ballot values (?,?,?)`);
  sq.exec("begin");
  for (const b of ballots) ins.run(b.vote_psp_id, b.mandate_psp_id, b.choice);
  sq.exec("commit");
  sq.exec(`create index ballot_vote_idx on ballot(vote_psp_id)`);
  const sqliteLoadMs = Math.round(performance.now() - sLoad0);

  console.log(`load: DuckDB ${duckLoadMs}ms · SQLite ${sqliteLoadMs}ms · PGlite (already resident)\n`);

  // ── runners ──
  const runPg = async (sql: string) => { const r = await pg.query<Record<string, unknown>>(sql); return r.rows; };
  const runDuck = async (sql: string) => (await dconn.runAndReadAll(sql)).getRows();
  const runSqlite = (sql: string) => sq.prepare(sql).all();

  const engines: { name: string; run: (sql: string) => Promise<unknown[]> | unknown[]; table: string }[] = [
    { name: "PGlite", run: runPg, table: "vote_ballot" },
    { name: "DuckDB", run: runDuck, table: "ballot" },
    { name: "SQLite", run: runSqlite, table: "ballot" },
  ];

  interface Cell { engine: string; agg: string; medMs: number; check: string; }
  const cells: Cell[] = [];
  for (const eng of engines) {
    for (const a of AGGS(eng.table)) {
      const times: number[] = [];
      let check = "";
      for (let i = 0; i < a.reps; i++) {
        const s = performance.now();
        const rows = await eng.run(a.sql);
        times.push(performance.now() - s);
        if (i === 0) {
          // Cross-engine checksum: scalar → the value; group-by → #groups + Σcount.
          if (a.scalar) {
            const v = rows[0] as Record<string, unknown> | unknown[];
            check = String(Array.isArray(v) ? v[0] : Object.values(v)[0]);
          } else {
            const total = rows.reduce((acc: number, r) => {
              const vals = Array.isArray(r) ? r : Object.values(r as Record<string, unknown>);
              const cnt = Number(vals[vals.length - 1]); // last col is the count
              return acc + (Number.isFinite(cnt) ? cnt : 0);
            }, 0);
            check = `${rows.length}grp/${total}`;
          }
        }
      }
      cells.push({ engine: eng.name, agg: a.id, medMs: med(times), check });
      console.log(`${eng.name.padEnd(7)} ${a.id.padEnd(30)} ${med(times)}ms  (${check})`);
    }
  }

  await pg.close();

  // ── scorecard ──
  const aggIds = AGGS("x").map((a) => a.id);
  const lines = [
    `# DB experiment #1 — OLAP over ${ballots.length} ballots`,
    "",
    `Load: DuckDB ${duckLoadMs}ms · SQLite ${sqliteLoadMs}ms · PGlite resident. Warm-median query latency (ms):`,
    "",
    `| Engine | ${aggIds.join(" | ")} |`,
    `| --- | ${aggIds.map(() => "---:").join(" | ")} |`,
    ...engines.map((e) => `| ${e.name} | ${aggIds.map((id) => { const c = cells.find((x) => x.engine === e.name && x.agg === id); return c ? c.medMs : "—"; }).join(" | ")} |`),
    "",
    "Correctness cross-check (should match across engines):",
    ...aggIds.map((id) => `- ${id}: ${engines.map((e) => `${e.name}=${cells.find((x) => x.engine === e.name && x.agg === id)?.check}`).join("  ")}`),
  ];
  const card = lines.join("\n");
  writeFileSync(join(outDir, "olap.md"), card);
  console.log(`\n${card}\nwrote ${outDir}/olap.md`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
