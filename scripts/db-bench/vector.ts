/* DB-architecture experiment #2 — VECTOR search: in-DB vs dedicated store.
 * The modern "do I add a vector store, or keep vectors in Postgres?" question:
 *   • PGlite + pgvector  (in-DB — vectors live with the rows, one engine, no sync)
 *   • LanceDB            (dedicated embedded columnar vector store — must be synced)
 * Synthetic deterministic 128-d vectors (identical across engines) so this measures
 * STORE performance + architecture, not embedding quality (that's the LLM layer).
 * Metrics: build time + kNN(top-10) warm-median latency. Feeds docs/db-architecture-guide.md.
 *
 *   npx tsx scripts/db-bench/vector.ts --n=20000 --dim=128 --queries=20
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { PGlite } from "@electric-sql/pglite";
import { vector as pgvectorExt } from "@electric-sql/pglite/vector";
import * as lancedb from "@lancedb/lancedb";

function arg(name: string, fb: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fb;
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.floor(s.length / 2)]! * 10) / 10; };

// Deterministic per-vector PRNG so both engines index byte-identical vectors.
function rng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeVec(seed: number, dim: number): number[] {
  const r = rng(seed + 1);
  const v = Array.from({ length: dim }, () => r() * 2 - 1);
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

async function main() {
  const n = Number(arg("n", "20000")) || 20000;
  const dim = Number(arg("dim", "128")) || 128;
  const nq = Number(arg("queries", "20")) || 20;
  const outDir = arg("out", "./.db-bench");
  mkdirSync(outDir, { recursive: true });

  const vecs = Array.from({ length: n }, (_, i) => ({ id: i, vector: makeVec(i, dim) }));
  const queries = Array.from({ length: nq }, (_, q) => makeVec(1_000_000 + q, dim));
  console.log(`vectors=${n}  dim=${dim}  queries=${nq}\n`);

  // ── PGlite + pgvector (in-DB, exact/flat) ──
  const pg = new PGlite({ extensions: { vector: pgvectorExt } });
  await pg.waitReady;
  await pg.exec("create extension if not exists vector");
  await pg.exec(`create table v(id int primary key, embedding vector(${dim}))`);
  const pgBuild0 = performance.now();
  for (let i = 0; i < n; i += 500) {
    const chunk = vecs.slice(i, i + 500);
    const params: unknown[] = [];
    const tuples = chunk.map((r) => { params.push(r.id, `[${r.vector.join(",")}]`); return `($${params.length - 1},$${params.length})`; });
    await pg.query(`insert into v (id, embedding) values ${tuples.join(",")}`, params);
  }
  const pgBuildMs = Math.round(performance.now() - pgBuild0);
  const pgTimes: number[] = [];
  let pgTop1 = -1;
  for (let q = 0; q < nq; q++) {
    const s = performance.now();
    const r = await pg.query<{ id: number }>(`select id from v order by embedding <-> $1 limit 10`, [`[${queries[q]!.join(",")}]`]);
    pgTimes.push(performance.now() - s);
    if (q === 0) pgTop1 = r.rows[0]!.id;
  }
  await pg.close();

  // ── LanceDB (dedicated embedded, flat) ──
  const lanceDir = join(outDir, "lancedb");
  rmSync(lanceDir, { recursive: true, force: true });
  const db = await lancedb.connect(lanceDir);
  const lBuild0 = performance.now();
  const tbl = await db.createTable("v", vecs);
  const lBuildMs = Math.round(performance.now() - lBuild0);
  const lTimes: number[] = [];
  let lTop1 = -1;
  for (let q = 0; q < nq; q++) {
    const s = performance.now();
    const res = (await tbl.vectorSearch(queries[q]!).limit(10).toArray()) as Array<{ id: number }>;
    lTimes.push(performance.now() - s);
    if (q === 0) lTop1 = res[0]!.id;
  }
  rmSync(lanceDir, { recursive: true, force: true });

  const lines = [
    `# DB experiment #2 — vector kNN, in-DB vs dedicated (${n} × ${dim}-d)`,
    "",
    "Flat/exact search (no ANN index — the honest baseline; ANN indexing is the scale lever). Warm-median top-10 latency.",
    "",
    "| Engine | build (ms) | kNN median (ms) | top-1 (q0) |",
    "| --- | ---: | ---: | ---: |",
    `| PGlite + pgvector (in-DB) | ${pgBuildMs} | ${med(pgTimes)} | ${pgTop1} |`,
    `| LanceDB (dedicated) | ${lBuildMs} | ${med(lTimes)} | ${lTop1} |`,
    "",
    `Correctness: exact search on both → top-1 should match (${pgTop1} vs ${lTop1} → ${pgTop1 === lTop1 ? "MATCH" : "DIFFER"}).`,
    "",
    "Architecture note: pgvector keeps vectors IN the row store (one engine, transactional, zero sync);",
    "LanceDB is a separate store that must be kept in sync with the source rows (the hybrid tax) but is",
    "purpose-built for ANN at large scale.",
  ];
  const card = lines.join("\n");
  writeFileSync(join(outDir, "vector.md"), card);
  console.log(`${card}\nwrote ${outDir}/vector.md`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
