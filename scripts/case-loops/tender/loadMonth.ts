/* Tender loop — the ONE month reader (durable).
 *
 * Prefers the streamed CPV pre-filter output (`filter-month.py` → NDJSON: line 1 header
 * meta, then one record per line). NDJSON exists because the plain-JSON path failed
 * TWICE on size: VZ-04-2026 decompresses to 4,95 GB (past execFileSync's buffer and
 * V8's ~512 MB string cap), and even its FILTERED single-document JSON was ~650 MB.
 * A line stream never holds a document-sized string.
 *
 * Falls back to unzipping the whole month via python ONLY for small months with no
 * filtered file — and that path throws loudly past the string cap rather than lying.
 */
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { execFileSync } from "node:child_process";

const RAW = "data/raw/isvz";

export async function loadMonthJson(month: string, cpv: string): Promise<unknown> {
  const nd = `${RAW}/${month}-cpv${cpv}.ndjson`;
  if (existsSync(nd)) {
    const rl = createInterface({ input: createReadStream(nd, { encoding: "utf8" }), crlfDelay: Infinity });
    let header: Record<string, unknown> | null = null;
    const data: unknown[] = [];
    for await (const line of rl) {
      if (!line.trim()) continue;
      if (!header) header = JSON.parse(line) as Record<string, unknown>;
      else data.push(JSON.parse(line));
    }
    return { obdobi_od: header?.obdobi_od ?? null, obdobi_do: header?.obdobi_do ?? null, verze: header?.verze ?? null, data };
  }
  return JSON.parse(
    execFileSync(
      "python",
      ["-c", "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);sys.stdout.buffer.write(z.read(z.namelist()[0]))", `${RAW}/${month}.zip`],
      { maxBuffer: 1 << 30 },
    ).toString("utf8"),
  );
}
