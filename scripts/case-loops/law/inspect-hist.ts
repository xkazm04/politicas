/* Case ③ — inspect the legislative HISTORY (hist.unl in tisky.zip) for the batch bills, to
 * decide the build phase: is a 3rd-reading roll-call (voted_in) linkage feasible, or is the
 * term too young? Prints, per batch tisk (internal id), the dated procedural steps found.
 * READ-ONLY, offline (reads the cached ./.data/psp/tisky.zip). */
import { readFileSync } from "node:fs";

import { col, colInt, decodeUnl, parseUnl } from "@/lib/ingest/unl";
import { readZipMap } from "@/lib/ingest/zip";

const CACHE = process.env.PSP_CACHE_DIR || "./.data/psp";
// internal id_tisk → public cislo for the batch
const BATCH: Record<number, number> = { 43233: 121, 43370: 248, 43230: 119, 43237: 120, 43366: 244, 43111: 4, 43147: 40, 43225: 115 };

function main() {
  const zip = readZipMap(new Uint8Array(readFileSync(`${CACHE}/tisky.zip`)));
  const names = [...zip.keys()].sort();
  console.log(`tisky.zip members: ${names.join(", ")}\n`);

  const histBytes = zip.get("hist.unl");
  if (!histBytes) {
    console.log("no hist.unl");
    return;
  }
  const hist = parseUnl(decodeUnl(histBytes));
  // Show column count + a sample row to confirm schema
  console.log(`hist.unl rows: ${hist.length}; sample cols(row0): ${hist[0]?.length} → ${JSON.stringify(hist[0]?.slice(0, 8))}\n`);

  const batchInternal = new Set(Object.keys(BATCH).map(Number));
  const byTisk = new Map<number, { idHist: number | null; datum: string | null; c3: string | null; c4: string | null; c5: string | null }[]>();
  for (const r of hist) {
    const idTisk = colInt(r, 1);
    if (idTisk == null || !batchInternal.has(idTisk)) continue;
    const arr = byTisk.get(idTisk) ?? [];
    arr.push({ idHist: colInt(r, 0), datum: col(r, 2), c3: col(r, 3), c4: col(r, 4), c5: col(r, 5) });
    byTisk.set(idTisk, arr);
  }

  for (const [internal, cislo] of Object.entries(BATCH)) {
    const steps = (byTisk.get(Number(internal)) ?? []).sort((a, b) => (a.datum ?? "").localeCompare(b.datum ?? ""));
    console.log(`tisk ${cislo} (internal ${internal}): ${steps.length} hist steps`);
    for (const s of steps) console.log(`   ${s.datum ?? "—"}  idHist=${s.idHist}  c3=${s.c3} c4=${s.c4} c5=${s.c5}`);
  }

  // Is there a table linking a hist step / tisk to a hlasovani (roll-call vote id)?
  console.log(`\ntables that might carry a vote link: ${names.filter((n) => /hlas|stav|bod|hist/.test(n)).join(", ") || "none obvious"}`);
}

main();
