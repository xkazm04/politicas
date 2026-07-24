/* Export the PSP tables as portable CSVs for cross-device benchmarking.
 * The .pglite dir is a 365 MB binary (with transient WAL) — bad to commit even
 * temporarily (permanent git-history bloat). These CSVs are the same PUBLIC Czech
 * Parliament open data in a git-friendly, engine-agnostic form: the second device
 * loads them into a fresh PGlite / DuckDB / SQLite / Kuzu to run the benchmarks
 * (e.g. the deferred graph case #2), then we delete + re-gitignore them here.
 *
 *   cp -r .pglite .pglite-exp
 *   npx tsx scripts/db-bench/export-data.ts --pglite=.pglite-exp --out=benchmark-data
 *   rm -rf .pglite-exp
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

function arg(name: string, fb: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fb;
}

// Core, benchmark-relevant columns per table (raw jsonb provenance omitted — not
// needed for any workload and hostile to CSV; kg props kept, JSON-stringified).
const EXPORTS: { table: string; sql: string }[] = [
  { table: "vote_ballot", sql: `select id, vote_psp_id, mandate_psp_id, code, choice from vote_ballot order by vote_psp_id, mandate_psp_id` },
  { table: "vote_event", sql: `select id, psp_id, session_no, vote_no, voted_on, yes, no, abstain, not_voting, present, kind, outcome, title_long, title_short, voided from vote_event order by psp_id` },
  { table: "person", sql: `select id, psp_id, name_full, name_norm, first_name, last_name, gender from person order by psp_id` },
  { table: "organ", sql: `select id, psp_id, parent_psp_id, organ_type_cz, abbrev, name_cz from organ order by psp_id` },
  { table: "mandate", sql: `select id, psp_id, person_psp_id, term_code, region_psp_id, party_list_psp_id from mandate order by psp_id` },
  { table: "membership", sql: `select id, person_psp_id, kind, organ_psp_id, function_name_cz, from_at, to_at from membership order by id` },
  { table: "absence", sql: `select id, mandate_psp_id, day, from_time, to_time, whole_day from absence order by id` },
  { table: "kg_node", sql: `select id, kind, label, first_seen_pass, props from kg_node order by id` },
  { table: "kg_edge", sql: `select src, rel, dst, weight, props from kg_edge order by src, rel, dst` },
  { table: "vote_tag", sql: `select id, vote_psp_id, theme, confidence, model, method from vote_tag order by vote_psp_id` },
];

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const pgPath = arg("pglite", ".pglite-exp");
  const outDir = arg("out", "benchmark-data");
  mkdirSync(outDir, { recursive: true });

  const pg = new PGlite(pgPath);
  await pg.waitReady;
  const manifest: { table: string; rows: number; bytes: number }[] = [];
  for (const e of EXPORTS) {
    const { rows } = await pg.query<Record<string, unknown>>(e.sql);
    const cols = rows.length ? Object.keys(rows[0]!) : [];
    const lines = [cols.join(",")];
    for (const r of rows) lines.push(cols.map((c) => cell(r[c])).join(","));
    const csv = lines.join("\n") + "\n";
    const path = join(outDir, `${e.table}.csv`);
    writeFileSync(path, csv);
    manifest.push({ table: e.table, rows: rows.length, bytes: Buffer.byteLength(csv) });
    console.log(`${e.table.padEnd(14)} ${String(rows.length).padStart(7)} rows  ${(Buffer.byteLength(csv) / 1048576).toFixed(2)} MB`);
  }
  await pg.close();

  const total = manifest.reduce((a, m) => a + m.bytes, 0);
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ generatedFrom: "PSP10 PGlite store (public psp.cz open data)", tables: manifest }, null, 2));
  console.log(`\ntotal ${(total / 1048576).toFixed(2)} MB across ${manifest.length} tables → ${outDir}/`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
