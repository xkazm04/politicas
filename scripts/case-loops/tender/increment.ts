/* Tender loop — MONTHLY INCREMENT orchestrator (durable; b011 — the steady state).
 *
 * RVZ month files are WRITTEN ONCE: Last-Modified headers show each `VZ-MM-YYYY.zip`
 * appears on the 1st–5th of the following month and never changes afterwards (verified
 * 2026-08-24: VZ-06-2026 = Jul 1, VZ-07-2026 = Aug 2; local bytes identical). Updates to
 * older procedures arrive INSIDE newer month files, which `persist-month.ts`'s
 * last-snapshot-wins dedupe already handles. The increment is therefore strictly:
 * fetch the newest month(s) when they appear — never re-download history.
 *
 * WHAT IT DOES (idempotent — safe to run any day):
 *   1. finds the newest month present in data/raw/isvz/, probes the server for every
 *      month after it up to the current calendar month;
 *   2. downloads what exists (streamed to disk, never through a V8 string);
 *   3. runs filter-month.py for each new month (streaming CPV pre-filter → NDJSON);
 *   4. PRINTS the exact next commands — persist (ALL months chronologically, so the
 *      snapshot dedupe stays correct) and the full reflag/recompose/recircle chain.
 *
 * WHAT IT REFUSES TO DO: persist or reflag by itself. Ingest is deterministic, but the
 * flag and circle persists sit behind the kernel's hand-read gate — a one-command chain
 * that auto-commits signals would delete the loop's strongest safety habit. The
 * orchestrator ends where the reading begins.
 *
 *   npx tsx scripts/case-loops/tender/increment.ts --cpv=45 [--check-only]
 */
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const BASE = "https://isvz.nipez.cz/sites/default/files/content/opendata-rvz";
const RAW = "data/raw/isvz";
const COVERAGE_START = { y: 2024, m: 12 }; // record-level RVZ coverage floor (b003)

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}`));
const monthName = (y: number, m: number) => `VZ-${String(m).padStart(2, "0")}-${y}`;

function* monthsBetween(a: { y: number; m: number }, b: { y: number; m: number }) {
  let { y, m } = a;
  while (y < b.y || (y === b.y && m <= b.m)) {
    yield { y, m };
    m++;
    if (m > 12) { m = 1; y++; }
  }
}

async function head(url: string): Promise<{ ok: boolean; length: number | null; lastModified: string | null }> {
  const res = await fetch(url, { method: "HEAD" });
  return {
    ok: res.ok,
    length: res.headers.get("content-length") ? Number(res.headers.get("content-length")) : null,
    lastModified: res.headers.get("last-modified"),
  };
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`GET ${url} -> ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(dest));
}

async function main() {
  const cpv = arg("cpv")?.split("=")[1] ?? "45";
  const checkOnly = Boolean(arg("check-only"));

  // newest month already on disk
  const have = readdirSync(RAW)
    .map((f) => /^VZ-(\d{2})-(\d{4})\.zip$/.exec(f))
    .filter((m): m is RegExpExecArray => m != null)
    .map((m) => ({ y: Number(m[2]), m: Number(m[1]) }))
    .sort((a, b) => a.y - b.y || a.m - b.m);
  if (!have.length) throw new Error(`no VZ-*.zip in ${RAW} — bootstrap with the campaign ingest first (b003/b006)`);
  const newest = have[have.length - 1];
  const now = new Date();
  const current = { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 };
  console.log(`on disk: ${have.length} months, ${monthName(COVERAGE_START.y, COVERAGE_START.m)} → ${monthName(newest.y, newest.m)}`);

  // disk vs STORE: the persist receipt (written by persist-month.ts --commit) says what
  // the store actually holds — a downloaded month is not an ingested month
  try {
    const receipt = JSON.parse(readFileSync("docs/data-analysis/case-tender/persisted.json", "utf8")) as { months: string[]; pass: number; lots: number };
    const onDisk = have.map((h) => monthName(h.y, h.m));
    const unpersisted = onDisk.filter((m) => !receipt.months.includes(m));
    if (unpersisted.length) console.log(`STORE IS BEHIND DISK: ${unpersisted.join(", ")} downloaded but not persisted (receipt: pass ${receipt.pass}, ${receipt.lots} lots) — run the persist chain below for ALL months`);
    else console.log(`store receipt: pass ${receipt.pass}, ${receipt.lots} lots — disk and store agree`);
  } catch {
    console.log(`no persist receipt (docs/data-analysis/case-tender/persisted.json) — cannot compare disk vs store; the receipt appears on the next persist-month --commit`);
  }

  // probe every month after the newest local one (the file for month M appears ~M+1 day 1–5)
  const candidates = [...monthsBetween(newest, current)].slice(1);
  if (!candidates.length) {
    console.log(`nothing to probe — the newest possible month is already local.`);
  }
  const fetched: string[] = [];
  for (const c of candidates) {
    const name = monthName(c.y, c.m);
    const url = `${BASE}/${name}.zip`;
    const h = await head(url);
    if (!h.ok) {
      const next = c.m === 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 };
      console.log(`${name}: not published yet (expected ~${next.y}-${String(next.m).padStart(2, "0")}-01…05)`);
      continue;
    }
    console.log(`${name}: available — ${h.length ? `${(h.length / 1e6).toFixed(0)} MB` : "size unknown"}, Last-Modified ${h.lastModified ?? "?"}`);
    if (checkOnly) continue;
    const dest = `${RAW}/${name}.zip`;
    if (existsSync(dest) && h.length != null && statSync(dest).size === h.length) {
      console.log(`  already local and byte-identical — skipping download`);
    } else {
      await download(url, dest);
      console.log(`  downloaded ${(statSync(dest).size / 1e6).toFixed(0)} MB`);
    }
    console.log(`  filtering (CPV ${cpv})…`);
    execFileSync("python", ["scripts/case-loops/tender/filter-month.py", name, cpv], { stdio: "inherit" });
    fetched.push(name);
  }

  if (!fetched.length) {
    console.log(`\nNo new month. The store's corpus is current; nothing to persist.`);
    return;
  }
  const all = [...have.map((h) => monthName(h.y, h.m)), ...fetched];
  console.log(`\nNEXT COMMANDS (in order — the flag/circle persists happen only AFTER the printed samples are hand-read):`);
  console.log(`  npx tsx scripts/db/backup.ts --label=pass<N>-pre`);
  console.log(`  npx tsx scripts/case-loops/tender/persist-month.ts --months=${all.join(",")} --cpv=${cpv} --pass=<N> --commit`);
  console.log(`  npx tsx scripts/case-loops/tender/compute-flags.ts --cpv=${cpv}    # read the samples`);
  console.log(`  npx tsx scripts/case-loops/persist-batch.ts --payload=<flags payload> --pass=<N+1> --track=tender --ns=flags --commit`);
  console.log(`  npx tsx scripts/case-loops/tender/winner-circle.ts --cpv=${cpv}    # read the top`);
  console.log(`  npx tsx scripts/case-loops/persist-batch.ts --payload=<circle payload> --pass=<N+2> --track=tender --ns=circle --commit`);
  console.log(`  npx tsx scripts/case-loops/tender/compose-pictures.ts --cpv=${cpv}`);
  console.log(`  npx tsx scripts/data-analysis/kg-props-check.ts`);
  console.log(`(re-ingest wipes loop-computed flags BY DESIGN — the reflag is not optional; gate e forbids mixed vintages)`);
}

// no process.exit(): fetch keep-alive sockets + exit trip a libuv assertion on Windows
// (`!(handle->flags & UV_HANDLE_CLOSING)`) — let the loop drain and exit naturally.
main().catch((e) => { console.error(e); process.exitCode = 1; });
