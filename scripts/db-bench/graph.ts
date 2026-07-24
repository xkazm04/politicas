/* DB-architecture experiment #4 — GRAPH TRAVERSAL: recursive-CTE row/columnar
 * stores vs a native property-graph engine. The canonical "do I need a graph DB,
 * or do recursive CTEs in the store I already have suffice?" question, measured on
 * the real derived KG (kg_edge, co_votes_with) across:
 *   • PGlite      (embedded Postgres — the incumbent row store; recursive CTE)
 *   • node:sqlite (built-in row store; recursive CTE)
 *   • DuckDB      (in-process columnar; recursive CTE)
 *   • Kuzu        (embedded property graph; Cypher variable-length + pattern match)
 *
 * Same graph, same three workloads, warm-median latency, cross-engine checksum:
 *   G1  k-hop reach       distinct MPs within H hops of a seed  (recursive traversal)
 *   G2  triangle count    mutually-strong-agreement triples     (the graph self-join,
 *                         the graph analog of OLAP case #1's A3)
 *   G3  committee→co-voter  MPs sharing an organ (influential_in) who also co-vote
 *                         with the seed  (heterogeneous typed multi-hop join)
 *
 * Data: benchmark-data/kg_edge.csv (portable CSV export; co_votes_with weights are
 * agreement rates 0..1). The co-voting graph is near-complete and BIMODAL (two blocs
 * at ~0.99 intra / ~0.4 cross), so a --th agreement threshold sparsifies it to the
 * strong-agreement subgraph the product actually queries. Feeds docs/db-architecture-guide.md.
 *
 *   NODE_OPTIONS=--experimental-sqlite npx tsx scripts/db-bench/graph.ts --th=0.9 --seeds=8 --hops=2,3
 */
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { PGlite } from "@electric-sql/pglite";
import { DuckDBInstance } from "@duckdb/node-api";
import * as kuzu from "kuzu";

function arg(name: string, fb: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fb;
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.floor(s.length / 2)]! * 10) / 10; };
const num = (v: unknown): number => typeof v === "bigint" ? Number(v) : Number(v as number);
const sqlLit = (s: string) => `'${s.replace(/'/g, "''")}'`;

// ── parse benchmark-data/kg_edge.csv (props is the last field; may contain commas) ──
interface Parsed { covotes: Array<[string, string, number]>; inf: Array<[string, string]>; }
function parseKgEdges(path: string, th: number): Parsed {
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const canon = new Map<string, [string, string, number]>(); // undirected, deduped
  const infAll: Array<[string, string]> = [];
  const nodes = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]!;
    const c1 = l.indexOf(","), c2 = l.indexOf(",", c1 + 1), c3 = l.indexOf(",", c2 + 1);
    const src = l.slice(0, c1), rel = l.slice(c1 + 1, c2), dst = l.slice(c2 + 1, c3);
    if (rel === "co_votes_with") {
      const w = parseFloat(l.slice(c3 + 1).split(",")[0]!) || 0;
      if (w < th) continue;
      const [a, b] = src < dst ? [src, dst] : [dst, src]; // canonical order (string)
      canon.set(`${a}|${b}`, [a, b, w]);
      nodes.add(a); nodes.add(b);
    } else if (rel === "influential_in") {
      infAll.push([src, dst]);
    }
  }
  // keep only committee links whose person is in the (thresholded) co-voting graph,
  // so G3 is identical across engines and Kuzu's Inf edges never dangle.
  const inf = infAll.filter(([p]) => nodes.has(p));
  return { covotes: [...canon.values()], inf };
}

// ── engine adapters: each builds the θ-filtered graph then answers G1/G2/G3 ──
interface Engine {
  name: string;
  buildMs: number;
  g1(seed: string, hops: number): Promise<number>;
  g2(): Promise<number>;
  g3(seed: string): Promise<number>;
  close(): Promise<void>;
}

async function buildPglite(p: Parsed): Promise<Engine> {
  const pg = new PGlite();
  await pg.waitReady;
  const t0 = performance.now();
  await pg.exec(`create table cv(a text, b text, w real); create table edge(s text, d text, w real); create table inf(p text, o text)`);
  for (let i = 0; i < p.covotes.length; i += 700) {
    const chunk = p.covotes.slice(i, i + 700); const params: unknown[] = [];
    const tuples = chunk.map((e) => { params.push(e[0], e[1], e[2]); return `($${params.length - 2},$${params.length - 1},$${params.length})`; });
    await pg.query(`insert into cv values ${tuples.join(",")}`, params);
  }
  for (let i = 0; i < p.inf.length; i += 700) {
    const chunk = p.inf.slice(i, i + 700); const params: unknown[] = [];
    const tuples = chunk.map((e) => { params.push(e[0], e[1]); return `($${params.length - 1},$${params.length})`; });
    await pg.query(`insert into inf values ${tuples.join(",")}`, params);
  }
  await pg.exec(`insert into edge select a,b,w from cv union all select b,a,w from cv`);
  await pg.exec(`create index edge_s on edge(s); create index inf_o on inf(o); create index inf_p on inf(p)`);
  const buildMs = Math.round(performance.now() - t0);
  return {
    name: "PGlite", buildMs,
    async g1(seed, hops) {
      const r = await pg.query<{ c: string }>(
        `with recursive walk(n,depth) as (
           select d,1 from edge where s=$1
           union select e.d, w.depth+1 from edge e join walk w on e.s=w.n where w.depth<$2)
         select count(distinct n) c from walk where n<>$1`, [seed, hops]);
      return num(r.rows[0]!.c);
    },
    async g2() {
      const r = await pg.query<{ c: string }>(
        `select count(*) c from cv e1 join cv e2 on e1.a=e2.a and e1.b<e2.b join cv e3 on e3.a=e1.b and e3.b=e2.b`);
      return num(r.rows[0]!.c);
    },
    async g3(seed) {
      const r = await pg.query<{ c: string }>(
        `select count(distinct i2.p) c from inf i1
           join inf i2 on i1.o=i2.o and i2.p<>i1.p
           join edge e on e.s=i1.p and e.d=i2.p
         where i1.p=$1`, [seed]);
      return num(r.rows[0]!.c);
    },
    close: () => pg.close(),
  };
}

function buildSqlite(p: Parsed): Engine {
  const db = new DatabaseSync(":memory:");
  const t0 = performance.now();
  db.exec(`create table cv(a text,b text,w real); create table edge(s text,d text,w real); create table inf(p text,o text)`);
  const ic = db.prepare(`insert into cv values (?,?,?)`), ii = db.prepare(`insert into inf values (?,?)`);
  db.exec("begin");
  for (const e of p.covotes) ic.run(e[0], e[1], e[2]);
  for (const e of p.inf) ii.run(e[0], e[1]);
  db.exec("commit");
  db.exec(`insert into edge select a,b,w from cv union all select b,a,w from cv`);
  db.exec(`create index edge_s on edge(s); create index inf_o on inf(o); create index inf_p on inf(p)`);
  const buildMs = Math.round(performance.now() - t0);
  return {
    name: "SQLite", buildMs,
    async g1(seed, hops) {
      const r = db.prepare(
        `with recursive walk(n,depth) as (
           select d,1 from edge where s=?
           union select e.d, w.depth+1 from edge e join walk w on e.s=w.n where w.depth<?)
         select count(distinct n) c from walk where n<>?`).get(seed, hops, seed) as { c: number };
      return num(r.c);
    },
    async g2() {
      const r = db.prepare(`select count(*) c from cv e1 join cv e2 on e1.a=e2.a and e1.b<e2.b join cv e3 on e3.a=e1.b and e3.b=e2.b`).get() as { c: number };
      return num(r.c);
    },
    async g3(seed) {
      const r = db.prepare(
        `select count(distinct i2.p) c from inf i1
           join inf i2 on i1.o=i2.o and i2.p<>i1.p
           join edge e on e.s=i1.p and e.d=i2.p
         where i1.p=?`).get(seed) as { c: number };
      return num(r.c);
    },
    close: async () => db.close(),
  };
}

async function buildDuckdb(p: Parsed, outDir: string): Promise<Engine> {
  const cvCsv = join(outDir, "g_cv.csv"), infCsv = join(outDir, "g_inf.csv");
  writeFileSync(cvCsv, "a,b,w\n" + p.covotes.map((e) => e.join(",")).join("\n"));
  writeFileSync(infCsv, "p,o\n" + p.inf.map((e) => e.join(",")).join("\n"));
  const duck = await DuckDBInstance.create(":memory:");
  const c = await duck.connect();
  const t0 = performance.now();
  await c.run(`create table cv as select * from read_csv_auto('${cvCsv.replace(/\\/g, "/")}', header=true)`);
  await c.run(`create table inf as select * from read_csv_auto('${infCsv.replace(/\\/g, "/")}', header=true)`);
  await c.run(`create table edge as select a s,b d,w from cv union all select b s,a d,w from cv`);
  const buildMs = Math.round(performance.now() - t0);
  const scalar = async (sql: string) => num((await c.runAndReadAll(sql)).getRows()[0]![0]);
  return {
    name: "DuckDB", buildMs,
    g1: (seed, hops) => scalar(
      `with recursive walk(n,depth) as (
         select d,1 from edge where s=${sqlLit(seed)}
         union select e.d, w.depth+1 from edge e join walk w on e.s=w.n where w.depth<${hops})
       select count(distinct n) c from walk where n<>${sqlLit(seed)}`),
    g2: () => scalar(`select count(*) c from cv e1 join cv e2 on e1.a=e2.a and e1.b<e2.b join cv e3 on e3.a=e1.b and e3.b=e2.b`),
    g3: (seed) => scalar(
      `select count(distinct i2.p) c from inf i1
         join inf i2 on i1.o=i2.o and i2.p<>i1.p
         join edge e on e.s=i1.p and e.d=i2.p
       where i1.p=${sqlLit(seed)}`),
    close: async () => { rmSync(cvCsv, { force: true }); rmSync(infCsv, { force: true }); },
  };
}

async function buildKuzu(p: Parsed, outDir: string): Promise<Engine> {
  const dir = join(outDir, ".kuzu-graph");
  rmSync(dir, { recursive: true, force: true });
  const nodes = new Set<string>(); for (const e of p.covotes) { nodes.add(e[0]); nodes.add(e[1]); }
  for (const e of p.inf) nodes.add(e[0]);
  const organs = new Set<string>(p.inf.map((e) => e[1]));
  const nCsv = join(outDir, "k_person.csv"), oCsv = join(outDir, "k_organ.csv"),
        cvCsv = join(outDir, "k_covotes.csv"), infCsv = join(outDir, "k_inf.csv");
  writeFileSync(nCsv, "id\n" + [...nodes].join("\n"));
  writeFileSync(oCsv, "id\n" + [...organs].join("\n"));
  writeFileSync(cvCsv, "src,dst,w\n" + p.covotes.map((e) => e.join(",")).join("\n"));
  writeFileSync(infCsv, "src,dst\n" + p.inf.map((e) => e.join(",")).join("\n"));
  const conn = new kuzu.Connection(new kuzu.Database(dir));
  // query() is typed QueryResult | QueryResult[] (multi-statement support); our
  // statements are single, so narrow to the one result.
  const one = (r: kuzu.QueryResult | kuzu.QueryResult[]): kuzu.QueryResult => (Array.isArray(r) ? r[0]! : r);
  const run = (s: string) => conn.query(s).then((r) => one(r).close());
  const t0 = performance.now();
  await run(`CREATE NODE TABLE Person(id STRING, PRIMARY KEY(id))`);
  await run(`CREATE NODE TABLE Organ(id STRING, PRIMARY KEY(id))`);
  await run(`CREATE REL TABLE CoVotes(FROM Person TO Person, w DOUBLE)`);
  await run(`CREATE REL TABLE Inf(FROM Person TO Organ)`);
  await run(`COPY Person FROM '${nCsv.replace(/\\/g, "/")}' (HEADER=true)`);
  await run(`COPY Organ FROM '${oCsv.replace(/\\/g, "/")}' (HEADER=true)`);
  await run(`COPY CoVotes FROM '${cvCsv.replace(/\\/g, "/")}' (HEADER=true)`);
  await run(`COPY Inf FROM '${infCsv.replace(/\\/g, "/")}' (HEADER=true)`);
  const buildMs = Math.round(performance.now() - t0);
  const scalar = async (cy: string) => { const r = one(await conn.query(cy)); const rows = await r.getAll(); r.close(); return num(rows[0]!.n); };
  return {
    name: "Kuzu", buildMs,
    g1: (seed, hops) => scalar(
      `MATCH (s:Person {id:${sqlLit(seed)}})-[:CoVotes*1..${hops}]-(t:Person) WHERE t.id<>${sqlLit(seed)} RETURN count(DISTINCT t) AS n`),
    g2: () => scalar(
      `MATCH (x:Person)-[:CoVotes]-(y:Person)-[:CoVotes]-(z:Person)-[:CoVotes]-(x:Person)
       WHERE x.id<y.id AND y.id<z.id RETURN count(*) AS n`),
    g3: (seed) => scalar(
      `MATCH (s:Person {id:${sqlLit(seed)}})-[:Inf]->(o:Organ)<-[:Inf]-(m:Person), (s)-[:CoVotes]-(m)
       WHERE m.id<>${sqlLit(seed)} RETURN count(DISTINCT m) AS n`),
    close: async () => {
      for (const f of [nCsv, oCsv, cvCsv, infCsv]) rmSync(f, { force: true });
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function main() {
  const csv = arg("data", "benchmark-data/kg_edge.csv");
  const th = Number(arg("th", "0.9"));
  const nSeeds = Number(arg("seeds", "8")) || 8;
  const hopsList = arg("hops", "2,3").split(",").map(Number).filter((h) => h > 0);
  const outDir = arg("out", "./.db-bench");
  mkdirSync(outDir, { recursive: true });

  const parsed = parseKgEdges(csv, th);
  const pnodes = new Set<string>(); for (const e of parsed.covotes) { pnodes.add(e[0]); pnodes.add(e[1]); }
  const infPersons = [...new Set(parsed.inf.map((e) => e[0]))].sort();
  const g1seeds = [...pnodes].sort().slice(0, nSeeds);
  const g3seeds = infPersons.slice(0, nSeeds);
  console.log(`θ≥${th}: ${parsed.covotes.length} co_votes edges · ${pnodes.size} MPs · ${parsed.inf.length} committee links (${infPersons.length} MPs on committees)`);
  console.log(`workloads: G1 reach hops=${hopsList.join("/")} (${g1seeds.length} seeds) · G2 triangles · G3 committee→co-voter (${g3seeds.length} seeds)\n`);

  const engines: Engine[] = [
    await buildPglite(parsed),
    buildSqlite(parsed),
    await buildDuckdb(parsed, outDir),
    await buildKuzu(parsed, outDir),
  ];

  interface Row { engine: string; buildMs: number; reach: Record<number, number>; reachMs: Record<number, number>; tri: number; triMs: number; g3: number; g3Ms: number; }
  const results: Row[] = [];
  for (const eng of engines) {
    const row: Row = { engine: eng.name, buildMs: eng.buildMs, reach: {}, reachMs: {}, tri: NaN, triMs: NaN, g3: NaN, g3Ms: NaN };
    try {
      for (const h of hopsList) {
        await eng.g1(g1seeds[0]!, h); // warmup
        const times: number[] = []; let checksum = 0;
        for (const s of g1seeds) { const t = performance.now(); checksum += await eng.g1(s, h); times.push(performance.now() - t); }
        row.reach[h] = checksum; row.reachMs[h] = med(times);
      }
    } catch (e) { console.log(`${eng.name} G1 failed: ${e instanceof Error ? e.message : e}`); }
    try {
      await eng.g2(); // warmup
      const times: number[] = []; let v = NaN;
      for (let i = 0; i < 3; i++) { const t = performance.now(); v = await eng.g2(); times.push(performance.now() - t); }
      row.tri = v; row.triMs = med(times);
    } catch (e) { console.log(`${eng.name} G2 failed: ${e instanceof Error ? e.message : e}`); }
    try {
      await eng.g3(g3seeds[0]!); // warmup
      const times: number[] = []; let sum = 0;
      for (const s of g3seeds) { const t = performance.now(); sum += await eng.g3(s); times.push(performance.now() - t); }
      row.g3 = sum; row.g3Ms = med(times);
    } catch (e) { console.log(`${eng.name} G3 failed: ${e instanceof Error ? e.message : e}`); }
    results.push(row);
    const rr = hopsList.map((h) => `H${h}=${row.reachMs[h] ?? "—"}ms`).join(" ");
    console.log(`${eng.name.padEnd(7)} build=${row.buildMs}ms  G1 ${rr}  G2 ${row.triMs}ms(${row.tri})  G3 ${row.g3Ms}ms`);
    await eng.close();
  }

  // ── correctness cross-check (counts must be identical across engines) ──
  const base = results[0]!;
  const checks: string[] = [];
  for (const h of hopsList) checks.push(`- G1 reach Σ (H${h}, ${g1seeds.length} seeds): ${results.map((r) => `${r.engine}=${r.reach[h] ?? "—"}`).join("  ")} → ${results.every((r) => r.reach[h] === base.reach[h]) ? "MATCH ✓" : "DIFFER ✗"}`);
  checks.push(`- G2 triangles: ${results.map((r) => `${r.engine}=${Number.isNaN(r.tri) ? "—" : r.tri}`).join("  ")} → ${results.every((r) => r.tri === base.tri) ? "MATCH ✓" : "DIFFER ✗"}`);
  checks.push(`- G3 Σ (${g3seeds.length} seeds): ${results.map((r) => `${r.engine}=${Number.isNaN(r.g3) ? "—" : r.g3}`).join("  ")} → ${results.every((r) => r.g3 === base.g3) ? "MATCH ✓" : "DIFFER ✗"}`);

  const hopCols = hopsList.map((h) => `G1 reach H${h} (ms)`);
  const lines = [
    `# DB experiment #4 — graph traversal, recursive-CTE stores vs native graph (Kuzu)`,
    "",
    `Real KG \`co_votes_with\` at agreement θ≥${th}: **${parsed.covotes.length} edges over ${pnodes.size} MPs** (near-complete, bimodal blocs).`,
    `Warm-median latency (ms). G1 = distinct MPs within H hops (median over ${g1seeds.length} seeds); G2 = triangle count (mutually-≥θ triples); G3 = committee colleagues who also co-vote (median over ${g3seeds.length} seeds).`,
    "",
    `| Engine | load/build (ms) | ${hopCols.join(" | ")} | G2 triangles (ms) | G3 hetero-join (ms) |`,
    `| --- | ---: | ${hopCols.map(() => "---:").join(" | ")} | ---: | ---: |`,
    ...results.map((r) => `| ${r.engine} | ${r.buildMs} | ${hopsList.map((h) => r.reachMs[h] ?? "—").join(" | ")} | ${Number.isNaN(r.triMs) ? "—" : r.triMs} | ${Number.isNaN(r.g3Ms) ? "—" : r.g3Ms} |`),
    "",
    `Counts (G2 triangles=${base.tri}; the cross-engine checksum — identical ⇒ same semantics):`,
    ...checks,
  ];
  const card = lines.join("\n");
  writeFileSync(join(outDir, "graph.md"), card);
  console.log(`\n${card}\nwrote ${outDir}/graph.md`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
