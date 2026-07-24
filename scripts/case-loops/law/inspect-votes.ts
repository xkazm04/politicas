/* Decode hist action codes (typ_akce.unl) + confirm the col-5 ids on reading steps are real
 * hlasovani (vote_event) nodes in the graph — the ground for a `voted_in` bill→vote edge.
 * Reads cached tisky.zip offline + the PGlite copy (PGLITE_PATH). READ-ONLY. */
import { readFileSync } from "node:fs";

import { col, colInt, decodeUnl, parseUnl } from "@/lib/ingest/unl";
import { readZipMap } from "@/lib/ingest/zip";
import { getStore } from "@/lib/db/store";

const CACHE = process.env.PSP_CACHE_DIR || "./.data/psp";
const BATCH: Record<number, number> = { 43233: 121, 43370: 248, 43230: 119, 43237: 120, 43366: 244, 43111: 4, 43147: 40, 43225: 115 };

async function main() {
  const zip = readZipMap(new Uint8Array(readFileSync(`${CACHE}/tisky.zip`)));
  const typAkce = parseUnl(decodeUnl(zip.get("typ_akce.unl")!));
  const akceLabel = new Map<number, string>();
  for (const r of typAkce) {
    const id = colInt(r, 0);
    if (id != null) akceLabel.set(id, [col(r, 1), col(r, 2), col(r, 3), col(r, 4)].filter(Boolean).join(" | "));
  }
  console.log(`typ_akce.unl: ${typAkce.length} codes; sample: ${JSON.stringify(typAkce[0])}`);
  // codes seen on batch reading-steps
  for (const code of [169, 116, 127, 101, 102, 109, 151, 132, 133, 143, 2056, 2058, 2019, 2020, 2118, 2119, 2129, 2130, 2131, 2045, 2046, 2050, 2077, 2078]) {
    if (akceLabel.has(code)) console.log(`   c4=${code} → ${akceLabel.get(code)}`);
  }

  // collect (tisk, voteId) from hist col5 where present
  const hist = parseUnl(decodeUnl(zip.get("hist.unl")!));
  const links: { cislo: number; datum: string | null; akce: number | null; voteId: number }[] = [];
  for (const r of hist) {
    const idTisk = colInt(r, 1);
    if (idTisk == null || !(idTisk in BATCH)) continue;
    const voteId = colInt(r, 5);
    if (voteId == null) continue;
    links.push({ cislo: BATCH[idTisk], datum: col(r, 2), akce: colInt(r, 4), voteId });
  }
  console.log(`\n${links.length} hist steps in batch carry a col-5 id:`);

  const store = await getStore();
  const voteIds = [...new Set(links.map((l) => l.voteId))];
  const events = store ? await store.listVoteEvents() : [];
  const eventById = new Map(events.map((e) => [Number(String(e.id).replace(/\D/g, "")) || e.pspId, e]));
  // vote_event id scheme unknown here — match by pspId too
  const byPspId = new Map<number, (typeof events)[number]>();
  for (const e of events) if (typeof (e as { pspId?: number }).pspId === "number") byPspId.set((e as { pspId: number }).pspId, e);
  console.log(`graph vote_events: ${events.length}; sample id/pspId: ${events[0] ? JSON.stringify({ id: events[0].id, pspId: (events[0] as { pspId?: number }).pspId }) : "none"}`);

  for (const l of links) {
    const hit = byPspId.get(l.voteId) ?? eventById.get(l.voteId);
    console.log(`   tisk ${l.cislo}  ${l.datum}  akce=${l.akce} (${akceLabel.get(l.akce ?? -1) ?? "?"})  voteId=${l.voteId}  ${hit ? "✓ vote_event " + hit.id : "✗ not a graph vote_event"}`);
  }
  console.log(`\ndistinct vote ids referenced: ${voteIds.length} → ${voteIds.join(", ")}`);
  if (store) await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
