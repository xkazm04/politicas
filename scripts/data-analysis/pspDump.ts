/* The cached psp.cz bulk-dump reader every kg writer uses.
 *
 * Until 2026-09-06 kg-contribution-ingest, kg-legislation-ingest, kg-bill-roles-ingest,
 * kg-bill-engagement-ingest and kg-committee-routing each carried a byte-identical copy
 * (same cache dir, base URL, user-agent, 180 s timeout) — and one copy already logged a
 * non-ok status while the other four returned null in silence. One definition, one log
 * line. `scripts/data-analysis/ingest.ts` keeps its own richer variant on purpose: it
 * records `last-modified` + `fetchedAt` beside the bytes for the ingest_run row.
 *
 * Downloads are cached under PSP_CACHE_DIR (./.data/psp) and reused unless `refetch`,
 * so a re-run never re-hits the publisher. A miss is `null` with a warning — the caller
 * decides whether the dump was load-bearing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PSP_CACHE_DIR = process.env.PSP_CACHE_DIR || "./.data/psp";
export const PSP_BASE = "https://www.psp.cz/eknih/cdrom/opendata";
// Identify politicas honestly to the publisher (licence: free, cite the source).
export const PSP_UA = "politicas-ingest/0.1 (+https://www.psp.cz/sqw/hp.sqw?k=1300; open-data mirror)";

export async function getDump(fileName: string, refetch: boolean): Promise<Uint8Array | null> {
  mkdirSync(PSP_CACHE_DIR, { recursive: true });
  const path = join(PSP_CACHE_DIR, fileName);
  if (!refetch && existsSync(path)) return new Uint8Array(readFileSync(path));
  try {
    const res = await fetch(`${PSP_BASE}/${fileName}`, { headers: { "user-agent": PSP_UA }, signal: AbortSignal.timeout(180_000) });
    if (!res.ok) {
      console.warn(`  [getDump ${fileName}] HTTP ${res.status}`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    writeFileSync(path, bytes);
    return bytes;
  } catch (e) {
    console.warn(`  [getDump ${fileName}] ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
