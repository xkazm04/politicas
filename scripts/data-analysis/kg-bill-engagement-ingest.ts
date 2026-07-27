/* Bill engagement backfill — floor speeches per bill + amendment authorship.
 *
 * Companion to kg-bill-roles-ingest.ts (pass 34), same MERGE-PRESERVING
 * discipline: existing node props are read and spread, never rebuilt.
 *
 * What it writes (column layouts verified against the live dumps 2026-07-27):
 *   spoke_on edges           person → bill, weight = substantive floor-speech
 *                            count on the bill's agenda items (steno.zip rec ⋈
 *                            schuze.zip bod_schuze.id_tisk; chair turns excluded).
 *   proposes_amendment edges person → bill, weight = amendment count, props
 *                            {sd_cislos} (sd.zip sd_dokument typ 13, attributed
 *                            via id_x — measured 571/571 resolve to sitting MPs;
 *                            join by PUBLIC print number `ct` → bill props.cislo).
 *   person nodes             + amendments_authored (count over graph bills).
 *
 *   npx tsx scripts/data-analysis/kg-bill-engagement-ingest.ts            # dry-run
 *   npx tsx scripts/data-analysis/kg-bill-engagement-ingest.ts --commit   # write
 * Flags: --commit  --term=PSP10  --pass=N  --refetch
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeBillEngagement } from "@/lib/ingest/sources/psp-activity";
import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

function argOf(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const CACHE_DIR = process.env.PSP_CACHE_DIR || "./.data/psp";
const PSP_BASE = "https://www.psp.cz/eknih/cdrom/opendata";
const UA = "politicas-ingest/0.1 (+https://www.psp.cz/sqw/hp.sqw?k=1300; open-data mirror)";
async function getDump(fileName: string, refetch: boolean): Promise<Uint8Array | null> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, fileName);
  if (!refetch && existsSync(path)) return new Uint8Array(readFileSync(path));
  try {
    const res = await fetch(`${PSP_BASE}/${fileName}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(180_000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    writeFileSync(path, bytes);
    return bytes;
  } catch (e) {
    console.warn(`  [getDump ${fileName}] ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function main() {
  const commit = flag("commit");
  const term = argOf("term", "PSP10");
  const store = await getStore();
  if (!store) {
    console.error("no store configured");
    process.exit(1);
  }
  const organs = await store.listOrgans();
  const termPspId = organs.find((o) => o.abbrev === term)?.pspId ?? null;
  if (termPspId == null) {
    console.error(`term organ for ${term} not found`);
    process.exit(1);
  }

  const [schuzeZip, stenoZip, sdZip] = await Promise.all([
    getDump("schuze.zip", flag("refetch")),
    getDump("steno.zip", flag("refetch")),
    getDump("sd.zip", flag("refetch")),
  ]);
  if (!schuzeZip || !stenoZip || !sdZip) {
    console.error("could not fetch schuze.zip / steno.zip / sd.zip");
    process.exit(1);
  }
  const { speeches, amendments } = normalizeBillEngagement({ schuzeZip, stenoZip, sdZip }, termPspId);

  const nodes = await store.listKgNodes();
  const billByTiskId = new Map<number, KgNodeRow>();
  const billByCislo = new Map<number, KgNodeRow>();
  const personById = new Map<string, KgNodeRow>();
  for (const n of nodes) {
    if (n.kind === "bill") {
      billByTiskId.set(Number(n.id.replace("bill:tisk:", "")), n);
      if (typeof n.props.cislo === "number") billByCislo.set(n.props.cislo, n);
    } else if (n.kind === "person") {
      personById.set(n.id, n);
    }
  }
  const pass = Number(argOf("pass")) || Math.max(0, ...nodes.map((n) => n.firstSeenPass)) + 1;
  const provenance = { pass, method: "deterministic", ref: "psp-bill-engagement", computedAt: new Date().toISOString() };

  // ── spoke_on edges (only pairs where both endpoints are graph nodes) ─────────
  const spokeEdges: KgEdgeRow[] = [];
  let speechItemsOutsideGraph = 0;
  let speechTurnsCaptured = 0;
  for (const [tiskId, perPerson] of speeches) {
    const bill = billByTiskId.get(tiskId);
    if (!bill) {
      speechItemsOutsideGraph++;
      continue; // non-law prints (budget, reports) — outside the 141-bill graph
    }
    for (const [osoba, count] of perPerson) {
      const personId = `psp:person:${osoba}`;
      if (!personById.has(personId)) continue; // non-MP speakers (ministers seated elsewhere, guests)
      spokeEdges.push({ src: personId, rel: "spoke_on", dst: bill.id, weight: count, props: {}, provenance });
      speechTurnsCaptured += count;
    }
  }

  // ── proposes_amendment edges ─────────────────────────────────────────────────
  const amendByPair = new Map<string, { src: string; dst: string; count: number; sdCislos: number[] }>();
  let amendmentsOutsideGraph = 0;
  let amendmentAuthorsUnknown = 0;
  for (const a of amendments) {
    const bill = billByCislo.get(a.tiskCislo);
    if (!bill) {
      amendmentsOutsideGraph++;
      continue;
    }
    const personId = `psp:person:${a.idOsoba}`;
    if (!personById.has(personId)) {
      amendmentAuthorsUnknown++;
      continue;
    }
    const key = `${personId}→${bill.id}`;
    const slot = amendByPair.get(key) ?? { src: personId, dst: bill.id, count: 0, sdCislos: [] };
    slot.count++;
    if (a.sdCislo != null) slot.sdCislos.push(a.sdCislo);
    amendByPair.set(key, slot);
  }
  const amendEdges: KgEdgeRow[] = [...amendByPair.values()].map((p) => ({
    src: p.src,
    rel: "proposes_amendment",
    dst: p.dst,
    weight: p.count,
    props: { sd_cislos: p.sdCislos.sort((a, b) => a - b) },
    provenance,
  }));

  // ── person props: amendments_authored (merge-preserving; graph bills only) ───
  const amendCountByPerson = new Map<string, number>();
  for (const p of amendByPair.values()) amendCountByPerson.set(p.src, (amendCountByPerson.get(p.src) ?? 0) + p.count);
  const personUpdates: KgNodeRow[] = [];
  for (const [id, node] of personById) {
    personUpdates.push({
      ...node,
      props: { ...node.props, amendments_authored: amendCountByPerson.get(id) ?? 0, engagement_provenance: provenance },
    });
  }

  console.log(`Bill engagement backfill · term ${term} (organ ${termPspId}) · ${commit ? "COMMIT" : "DRY-RUN"} · pass ${pass}`);
  console.log(`  spoke_on: ${spokeEdges.length} person→bill pairs · ${speechTurnsCaptured} substantive turns captured`);
  console.log(`    (skipped: ${speechItemsOutsideGraph} debated prints outside the ${billByTiskId.size}-bill law graph — budgets/reports, honestly out of scope)`);
  console.log(`  proposes_amendment: ${amendEdges.length} pairs from ${amendments.length} amendments (skipped: ${amendmentsOutsideGraph} on non-graph prints, ${amendmentAuthorsUnknown} unknown authors)`);
  console.log(`  person nodes: ${personUpdates.length} get amendments_authored (${amendCountByPerson.size} nonzero)`);

  if (commit) {
    const n = await store.upsertKgNodes(personUpdates);
    const e = await store.upsertKgEdges([...spokeEdges, ...amendEdges]);
    console.log(`\nCOMMITTED: ${n} nodes updated + ${e} edges written (pass ${pass}).`);
  } else {
    console.log(`\nDRY-RUN — would update ${personUpdates.length} nodes + write ${spokeEdges.length + amendEdges.length} edges. Re-run with --commit.`);
  }
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
