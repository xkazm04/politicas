/* DB-architecture experiment #3 — FULL-TEXT search: when does an index beat a scan?
 * Real Czech text (vote titles + MP names), replicated to N docs, four ways:
 *   • PGlite LIKE (ilike '%term%' — O(n) scan)   • PGlite tsvector + GIN index
 *   • SQLite LIKE (like '%term%' — O(n) scan)     • SQLite FTS5 (if the build has it)
 * Metrics: index build time + query warm-median latency across real search terms.
 * Feeds docs/db-architecture-guide.md.
 *
 *   cp -r .pglite .pglite-fts
 *   NODE_OPTIONS=--experimental-sqlite npx tsx scripts/db-bench/fts.ts --pglite=.pglite-fts --n=200000
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { PGlite } from "@electric-sql/pglite";

function arg(name: string, fb: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fb;
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.floor(s.length / 2)]! * 10) / 10; };

const TERMS = ["rozpočet", "zákon", "vláda", "volba", "schůze", "novela"];

async function main() {
  const pgPath = arg("pglite", ".pglite-fts");
  const n = Number(arg("n", "200000")) || 200000;
  const outDir = arg("out", "./.db-bench");
  mkdirSync(outDir, { recursive: true });

  // ── real Czech text base (titles + MP names), replicated to N ──
  const pgSrc = new PGlite(pgPath);
  await pgSrc.waitReady;
  const t = await pgSrc.query<{ x: string }>(`select title_long as x from vote_event where title_long is not null`);
  const p = await pgSrc.query<{ x: string }>(`select name_full as x from person where name_full is not null`);
  await pgSrc.close();
  const base = [...t.rows, ...p.rows].map((r) => r.x).filter(Boolean);
  const docs = Array.from({ length: n }, (_, i) => base[i % base.length]!);
  console.log(`base texts=${base.length}  docs=${n}  terms=${TERMS.join(", ")}\n`);

  interface Cell { engine: string; approach: string; buildMs: number; qMedMs: number; hits0: number; }
  const cells: Cell[] = [];

  // ── PGlite ──
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(`create table docs(id int primary key, title text)`);
  for (let i = 0; i < n; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const params: unknown[] = [];
    const tuples = chunk.map((title, j) => { params.push(i + j, title); return `($${params.length - 1},$${params.length})`; });
    await pg.query(`insert into docs (id, title) values ${tuples.join(",")}`, params);
  }
  // LIKE scan
  {
    const times: number[] = []; let hits0 = 0;
    for (let k = 0; k < TERMS.length; k++) {
      const s = performance.now();
      const r = await pg.query<{ c: number }>(`select count(*)::int c from docs where title ilike $1`, [`%${TERMS[k]}%`]);
      times.push(performance.now() - s);
      if (k === 0) hits0 = r.rows[0]!.c;
    }
    cells.push({ engine: "PGlite", approach: "LIKE scan", buildMs: 0, qMedMs: med(times), hits0 });
  }
  // tsvector + GIN
  {
    const b0 = performance.now();
    await pg.query(`create index docs_fts_idx on docs using gin (to_tsvector('simple', title))`);
    const buildMs = Math.round(performance.now() - b0);
    const times: number[] = []; let hits0 = 0;
    for (let k = 0; k < TERMS.length; k++) {
      const s = performance.now();
      const r = await pg.query<{ c: number }>(`select count(*)::int c from docs where to_tsvector('simple', title) @@ plainto_tsquery('simple', $1)`, [TERMS[k]]);
      times.push(performance.now() - s);
      if (k === 0) hits0 = r.rows[0]!.c;
    }
    cells.push({ engine: "PGlite", approach: "tsvector+GIN", buildMs, qMedMs: med(times), hits0 });
  }
  await pg.close();

  // ── SQLite ──
  const sq = new DatabaseSync(":memory:");
  sq.exec(`create table docs(id integer primary key, title text)`);
  const ins = sq.prepare(`insert into docs values (?,?)`);
  sq.exec("begin"); for (let i = 0; i < n; i++) ins.run(i, docs[i]); sq.exec("commit");
  // LIKE scan
  {
    const times: number[] = []; let hits0 = 0;
    for (let k = 0; k < TERMS.length; k++) {
      const s = performance.now();
      const r = sq.prepare(`select count(*) c from docs where title like ?`).get(`%${TERMS[k]}%`) as { c: number };
      times.push(performance.now() - s);
      if (k === 0) hits0 = r.c;
    }
    cells.push({ engine: "SQLite", approach: "LIKE scan", buildMs: 0, qMedMs: med(times), hits0 });
  }
  // FTS5 (if the bundled SQLite has it)
  try {
    const b0 = performance.now();
    sq.exec(`create virtual table docs_fts using fts5(title)`);
    sq.exec(`insert into docs_fts(rowid, title) select id, title from docs`);
    const buildMs = Math.round(performance.now() - b0);
    const times: number[] = []; let hits0 = 0;
    for (let k = 0; k < TERMS.length; k++) {
      const s = performance.now();
      const r = sq.prepare(`select count(*) c from docs_fts where docs_fts match ?`).get(TERMS[k]) as { c: number };
      times.push(performance.now() - s);
      if (k === 0) hits0 = r.c;
    }
    cells.push({ engine: "SQLite", approach: "FTS5", buildMs, qMedMs: med(times), hits0 });
  } catch (e) {
    cells.push({ engine: "SQLite", approach: "FTS5 (unavailable)", buildMs: 0, qMedMs: 0, hits0: 0 });
    console.log(`SQLite FTS5 unavailable: ${e instanceof Error ? e.message : e}`);
  }

  const lines = [
    `# DB experiment #3 — full-text over ${n} docs (real Czech titles + names)`,
    "",
    `Query warm-median across ${TERMS.length} real terms. NB: LIKE '%term%' is SUBSTRING match; FTS is TOKEN match — hit counts differ by design.`,
    "",
    "| Engine | approach | index build (ms) | query median (ms) | hits (rozpočet) |",
    "| --- | --- | ---: | ---: | ---: |",
    ...cells.map((c) => `| ${c.engine} | ${c.approach} | ${c.buildMs || "—"} | ${c.qMedMs || "—"} | ${c.hits0} |`),
  ];
  const card = lines.join("\n");
  for (const c of cells) console.log(`${c.engine.padEnd(7)} ${c.approach.padEnd(20)} build=${c.buildMs}ms  q=${c.qMedMs}ms  hits=${c.hits0}`);
  writeFileSync(join(outDir, "fts.md"), card);
  console.log(`\n${card}\nwrote ${outDir}/fts.md`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
