/* e-Sbírka bulk — the authoritative registry of real Czech statutes. Downloads the
 * e-Sbírka act-master open-data dump (002PravniAkt.json.gz, OFN JSON-LD, whole Sbírka
 * zákonů since 1918) and extracts every real "N/RRRR Sb." law reference + its official
 * title. Two uses:
 *   1. writes .data/esbirka/known-laws.json — the anti-fabrication scope the Case ③
 *      forensics gate (lib/analysis/law-verdict.ts) checks cited statutes against, so a
 *      verdict may cite ANY real law, and a HALLUCINATED law number is still rejected.
 *   2. --enrich-graph --commit — stamp each graph `law` node with its e-Sbírka title
 *      and an `esbirka_exists` flag (catching any title-regex extraction error).
 *
 * Bulk is STRUCTURE + METADATA, not full text (text is per-act PDFs / a gated API) —
 * which is exactly what a real-statute registry needs.
 *
 *   npx tsx scripts/data-analysis/esbirka-laws.ts                       # build known-laws.json
 *   npx tsx scripts/data-analysis/esbirka-laws.ts --enrich-graph --commit
 * Flags: --refetch  --enrich-graph  --commit
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { getStore } from "@/lib/db/store";

const flag = (name: string) => process.argv.includes(`--${name}`);
const DIR = ".data/esbirka";
const URL_002 = "https://opendata.eselpoint.gov.cz/datove-sady-esbirka/002PravniAkt.json.gz";
const CITATION = /^(\d{1,4})\/(\d{4})\s+Sb\.$/; // Sbírka zákonů only (excludes "Sb. m. s.")

interface Akt {
  "akt-citace"?: string;
  "akt-název-vyhlášený"?: string;
}

async function get002(): Promise<Uint8Array> {
  mkdirSync(DIR, { recursive: true });
  const p = join(DIR, "002.json.gz");
  if (existsSync(p) && !flag("refetch")) return new Uint8Array(readFileSync(p));
  const res = await fetch(URL_002, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`GET 002PravniAkt → HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  writeFileSync(p, bytes);
  return bytes;
}

async function main() {
  const gz = await get002();
  const parsed = JSON.parse(gunzipSync(gz).toString("utf8")) as { "položky"?: Akt[] };
  const acts = parsed["položky"] ?? [];

  const refs = new Set<string>();
  const titleByRef = new Map<string, string>();
  for (const a of acts) {
    const m = (a["akt-citace"] ?? "").match(CITATION);
    if (!m) continue;
    const ref = `${Number(m[1])}/${m[2]}`;
    refs.add(ref);
    const t = a["akt-název-vyhlášený"];
    if (t && !titleByRef.has(ref)) titleByRef.set(ref, String(t));
  }

  writeFileSync(join(DIR, "known-laws.json"), JSON.stringify({ source: URL_002, count: refs.size, refs: [...refs] }));
  console.log(`e-Sbírka: ${acts.length.toLocaleString()} acts → ${refs.size.toLocaleString()} Sbírka-zákonů law refs → ${DIR}/known-laws.json`);

  if (flag("enrich-graph")) {
    const store = await getStore();
    if (!store) {
      console.error("no store");
      process.exit(1);
    }
    const lawNodes = await store.listKgNodes({ kind: "law" });
    let matched = 0;
    let orphan = 0;
    const toWrite = lawNodes.map((n) => {
      const ref = String(n.props.ref);
      const title = titleByRef.get(ref);
      const exists = refs.has(ref);
      if (exists) matched++;
      else orphan++;
      return {
        ...n,
        label: title ? `zákon č. ${ref} Sb. — ${title.slice(0, 120)}` : n.label,
        props: { ...n.props, esbirka_exists: exists, ...(title ? { esbirka_title: title } : {}) },
      };
    });
    console.log(`graph law nodes: ${lawNodes.length} · ${matched} confirmed real in e-Sbírka · ${orphan} not found (possible title-regex artifact)`);
    if (flag("commit")) {
      const w = await store.upsertKgNodes(toWrite);
      console.log(`COMMITTED: ${w} law nodes enriched with e-Sbírka titles + existence flag.`);
    } else {
      console.log(`DRY-RUN — add --commit to stamp titles/existence onto law nodes.`);
    }
    await store.close();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
