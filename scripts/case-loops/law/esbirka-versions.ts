/* e-Sbírka consolidated-VERSION history for the batch's amended laws — the real, citable
 * scaffold a §-level text diff plugs into. Streams dataset 001PravniAktZneni (176 MB gz),
 * brace-extracts only the acts whose `akt-citace` is one of the batch's amended laws, and
 * records each enacted znění's effective-date range + fragment count. NO fabrication: only
 * versions actually present in the open bulk dump are recorded.
 *
 * Full act TEXT (per-§) lives in dataset 003PravniAktZneniFragment (1.24 GB) — NOT fetched
 * here; a §-text diff is a dedicated ingest (see handoff). This gives the version timeline.
 *
 *   npx tsx scripts/case-loops/law/esbirka-versions.ts
 * → docs/data-analysis/case-law/payloads/diffs/esbirka-version-history.json
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";

const URL_001 = "https://opendata.eselpoint.gov.cz/datove-sady-esbirka/001PravniAktZneni.json.gz";
const OUT = "docs/data-analysis/case-law/payloads/diffs/esbirka-version-history.json";
const CACHE = ".data/esbirka/001.json.gz";

// batch amended laws (from ledger) as "N/RRRR Sb." citace
const TARGETS = new Set(
  ["586/1992", "117/1995", "187/2006", "427/2011", "256/2004", "262/2006", "324/2025", "40/2009", "45/2013"].map((r) => `${r} Sb.`),
);

interface Version {
  citace: string;
  znenIid: number | null;
  ucinnostOd: string | null;
  ucinnostDo: string | null;
  typZneni: string | null;
  jeZrusen: boolean | null;
  fragmentCount: number;
  eli: string | null;
}

/** Brace-depth streaming extractor: emit each top-level object inside the array, ignoring braces in strings. */
function makeExtractor(onObject: (obj: string) => void) {
  let buf = "";
  let depth = 0;
  let inStr = false;
  let esc = false;
  let started = false;
  let objStart = -1;
  return (chunk: string) => {
    buf += chunk;
    for (let i = buf.length - chunk.length; i < buf.length; i++) {
      const c = buf[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === "{") {
        if (depth === 0) { objStart = i; started = true; }
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0 && started) {
          onObject(buf.slice(objStart, i + 1));
          // compact the buffer
          buf = buf.slice(i + 1);
          i = -1;
          objStart = -1;
        }
      }
    }
    // guard against unbounded growth when between objects
    if (depth === 0 && buf.length > 2_000_000) buf = buf.slice(-1000);
  };
}

async function getStream(): Promise<NodeJS.ReadableStream> {
  if (existsSync(CACHE)) {
    console.log(`using cached ${CACHE}`);
    return Readable.from(readFileSync(CACHE)).pipe(createGunzip());
  }
  console.log(`streaming ${URL_001} …`);
  const res = await fetch(URL_001, { signal: AbortSignal.timeout(600_000) });
  if (!res.ok || !res.body) throw new Error(`GET 001 → HTTP ${res.status}`);
  mkdirSync(".data/esbirka", { recursive: true });
  const raw = Readable.fromWeb(res.body as never);
  raw.pipe(createWriteStream(CACHE)); // cache for reuse
  return raw.pipe(createGunzip());
}

async function main() {
  const versions: Version[] = [];
  let seen = 0;
  const extract = makeExtractor((objText) => {
    seen++;
    // cheap pre-filter before JSON.parse
    let cit: string | null = null;
    const m = objText.match(/"akt-citace"\s*:\s*"([^"]+)"/);
    if (m) cit = m[1];
    if (!cit || !TARGETS.has(cit)) return;
    try {
      const o = JSON.parse(objText) as Record<string, unknown>;
      const frags = Array.isArray(o["právní-akt-znění-fragment"]) ? (o["právní-akt-znění-fragment"] as unknown[]).length : 0;
      versions.push({
        citace: cit,
        znenIid: typeof o["znění-id"] === "number" ? (o["znění-id"] as number) : null,
        ucinnostOd: (o["znění-datum-účinnosti-od"] as string) ?? null,
        ucinnostDo: (o["znění-datum-účinnosti-do"] as string) ?? null,
        typZneni: (o["cis-esb-typ-znění-položka"] as string) ?? null,
        jeZrusen: typeof o["znění-je-zrušen"] === "boolean" ? (o["znění-je-zrušen"] as boolean) : null,
        fragmentCount: frags,
        eli: (o["znění-eli"] as string) ?? null,
      });
      // eslint-disable-next-line custom/no-silent-catch -- one malformed object must not abort the 176 MB stream scan
    } catch {
      /* skip a single malformed record */
    }
  });

  const gz = await getStream();
  await new Promise<void>((resolve, reject) => {
    gz.on("data", (d: Buffer) => extract(d.toString("utf8")));
    gz.on("end", () => resolve());
    gz.on("error", reject);
  });

  // group by law
  const byLaw = new Map<string, Version[]>();
  for (const v of versions) {
    const ref = v.citace.replace(/\s*Sb\.$/, "");
    byLaw.set(ref, [...(byLaw.get(ref) ?? []), v]);
  }
  const history = [...byLaw.entries()]
    .map(([ref, vs]) => {
      vs.sort((a, b) => (a.ucinnostOd ?? "").localeCompare(b.ucinnostOd ?? ""));
      return {
        ref,
        versionCount: vs.length,
        firstEffective: vs[0]?.ucinnostOd ?? null,
        lastEffective: vs.filter((v) => v.ucinnostOd).at(-1)?.ucinnostOd ?? null,
        versions: vs,
      };
    })
    .sort((a, b) => b.versionCount - a.versionCount);

  mkdirSync("docs/data-analysis/case-law/payloads/diffs", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ source: URL_001, scannedActs: seen, generatedAt: new Date().toISOString(), history }, null, 1));
  console.log(`\nscanned ${seen.toLocaleString()} act-versions; matched ${versions.length} for ${history.length} target laws → ${OUT}`);
  for (const h of history) console.log(`  ${h.ref.padEnd(12)} ${String(h.versionCount).padStart(3)} enacted versions · ${h.firstEffective} … ${h.lastEffective}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
