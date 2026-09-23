/* DB-architecture experiment #3b — FULL-TEXT: does case #3's index speedup survive the QUERY SHAPE?
 * Case #3 measured count(*) of single whole-token terms that matched 69 of 200k docs (0.03%).
 * The planned full-text work (steno substance, full-corpus law ingest) will issue ranked,
 * multi-term, phrase and common-word queries. This isolates what the index buys per shape:
 *   • SCAN — seq scan over a stored tsvector column (index-assisted plans disabled)
 *   • GIN  — the same column with a GIN index
 * Contracts: count(*) and ranked top-10 (ts_rank_cd). Shapes: single term, AND, OR, phrase,
 * with multi-term queries sampled as consecutive tokens of real sentences, read three ways.
 * Floor: both arms must return identical counts and identical top-10 score lists.
 * Corpus: the committed bill summaries (real Czech), replicated to N — no live .pglite needed.
 *
 *   npx tsx scripts/db-bench/fts-contracts.ts --n=200000
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { PGlite } from "@electric-sql/pglite";

function arg(name: string, fb: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fb;
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; };
const r1 = (x: number) => Math.round(x * 10) / 10;

const REPS = 5;
const SUMMARIES = "docs/data-analysis/case-law/payloads/bill-summaries-cz.json";

async function main() {
  const n = Number(arg("n", "200000")) || 200000;
  const outDir = arg("out", "./.db-bench");
  mkdirSync(outDir, { recursive: true });

  const src = JSON.parse(readFileSync(SUMMARIES, "utf8")) as { rows: { summary?: string }[] };
  const summaries = src.rows.map((r) => r.summary).filter((s): s is string => !!s);
  const tok = (s: string) => s.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  const sentences = summaries.map(tok).filter((t) => t.length >= 4);
  const docs = Array.from({ length: n }, (_, i) => summaries[i % summaries.length]!);

  // deterministic PRNG: every rerun sees the same queries
  let seed = 20260923;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)]!;

  // single terms spread across the document-frequency range
  const df = new Map<string, number>();
  for (const s of sentences) for (const w of new Set(s)) df.set(w, (df.get(w) ?? 0) + 1);
  const byDf = [...df.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const Q: { shape: string; q: string }[] = [0, 3, 10, 30, 100, 300].map((i) => ({ shape: "single", q: byDf[i]! }));
  for (let k = 0; k < 6; k++) {
    const s = pick(sentences); const len = 2 + Math.floor(rnd() * 2); const i = Math.floor(rnd() * (s.length - len));
    const m = s.slice(i, i + len);
    Q.push({ shape: "AND", q: m.join(" & ") }, { shape: "OR", q: m.join(" | ") }, { shape: "phrase", q: m.join(" <-> ") });
  }

  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(`create table docs(id int primary key, body text, tsv tsvector)`);
  for (let i = 0; i < n; i += 1000) {
    const chunk = docs.slice(i, i + 1000); const params: unknown[] = [];
    const tuples = chunk.map((b, j) => { params.push(i + j, b); return `($${params.length - 1},$${params.length},to_tsvector('simple',$${params.length}))`; });
    await pg.query(`insert into docs (id, body, tsv) values ${tuples.join(",")}`, params);
  }
  await pg.exec(`analyze docs`);
  console.log(`base summaries=${summaries.length}  docs=${n}  queries=${Q.length}`);

  const COUNT = `select count(*)::int c from docs where tsv @@ to_tsquery('simple',$1)`;
  const TOP10 = `select id, ts_rank_cd(tsv, to_tsquery('simple',$1))::float8 r from docs where tsv @@ to_tsquery('simple',$1) order by r desc, id limit 10`;
  async function time<R>(sql: string, q: string) {
    await pg.query(sql, [q]); // warm
    const ts: number[] = []; let rows: R[] = [];
    for (let k = 0; k < REPS; k++) { const s = performance.now(); rows = (await pg.query<R>(sql, [q])).rows; ts.push(performance.now() - s); }
    return { ms: med(ts), rows };
  }
  interface Arm { matches: number; countMs: number; topMs: number; top: string; }
  async function arm(): Promise<Arm[]> {
    const out: Arm[] = [];
    for (const { q } of Q) {
      const c = await time<{ c: number }>(COUNT, q);
      const t = await time<{ id: number; r: number }>(TOP10, q);
      out.push({ matches: c.rows[0]!.c, countMs: c.ms, topMs: t.ms, top: t.rows.map((r) => r.r.toFixed(6)).join(",") });
    }
    return out;
  }

  await pg.exec(`set enable_bitmapscan = off; set enable_indexscan = off;`);
  const scan = await arm();
  await pg.exec(`reset enable_bitmapscan; reset enable_indexscan;`);
  const b0 = performance.now();
  await pg.exec(`create index docs_gin on docs using gin (tsv)`);
  const buildMs = Math.round(performance.now() - b0);
  await pg.exec(`analyze docs`);
  const gin = await arm();
  await pg.close();

  let floorHeld = true;
  const rows = Q.map((x, i) => {
    const s = scan[i]!, g = gin[i]!;
    const same = s.matches === g.matches && s.top === g.top;
    if (!same) floorHeld = false;
    return { ...x, matches: s.matches, pct: Math.round((1000 * s.matches) / n) / 10,
      countScan: r1(s.countMs), countGin: r1(g.countMs), countX: r1(s.countMs / g.countMs),
      topScan: r1(s.topMs), topGin: r1(g.topMs), topX: r1(s.topMs / g.topMs), floor: same ? "same" : "DIFF" };
  });

  const lines = [
    `# DB experiment #3b — full-text speedup by query shape, ${n} docs (real Czech bill summaries, replicated)`,
    "",
    `GIN build ${buildMs} ms. Warm median of ${REPS}. \`x\` = SCAN ms / GIN ms. Floor (identical counts and top-10 scores across arms): **${floorHeld ? "held" : "BROKEN"}**.`,
    "",
    "| shape | query | matches | % of docs | count scan | count GIN | count x | top-10 scan | top-10 GIN | top-10 x | floor |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows.sort((a, b) => a.pct - b.pct).map((r) => `| ${r.shape} | \`${r.q}\` | ${r.matches} | ${r.pct} | ${r.countScan} | ${r.countGin} | ${r.countX} | ${r.topScan} | ${r.topGin} | ${r.topX} | ${r.floor} |`),
  ];
  const card = lines.join("\n");
  writeFileSync(join(outDir, "fts-contracts.md"), card);
  console.log(`\n${card}\nwrote ${outDir}/fts-contracts.md`);
  if (!floorHeld) process.exit(2);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
