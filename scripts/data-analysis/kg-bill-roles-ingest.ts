/* Bill roles backfill — sponsor rank (Q-effort-2), zpravodaj edges, bill fates.
 *
 * Targeted, MERGE-PRESERVING pass over the EXISTING graph (P44 discipline): bill
 * nodes now carry later-added props (summary_cz, forensic_*, amends_*) that a full
 * kg-legislation-ingest re-run would wholesale-erase, so this script never rebuilds
 * a node from scratch — it reads each touched node and spreads new props on top.
 *
 * What it writes (from psp.cz tisky.zip, column layout verified against the live
 * dump + doc k=1303 on 2026-07-27):
 *   sponsors edges   props {rank, role: "predkladatel"|"spolupodepsal", joined_later}
 *                    from predkladatel.poradi/typ — the edge set itself is untouched.
 *   rapporteur edges person → bill, props {scopes[], organ_ids[]} — zpravodaj from
 *                    hist (plenary), hist_vybory + tisky_za (committee side); poslanec
 *                    ids mapped to osoba via the mandate table.
 *   bill nodes       + sponsors_ranked [{osoba, rank, joined_later}], stav (Czech
 *                    state name), fate_sb ("583/2025" when published), fate_published_on.
 *   person nodes     + bills_first_signed / bills_co_signed — the Q-effort-2 split of
 *                    the exact bills_authored universe; the composite number and
 *                    computeContribution stay untouched.
 *
 *   npx tsx scripts/data-analysis/kg-bill-roles-ingest.ts            # dry-run
 *   npx tsx scripts/data-analysis/kg-bill-roles-ingest.ts --commit   # write
 * Flags: --commit  --term=PSP10  --refetch
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeBillRoles, type RapporteurScope } from "@/lib/ingest/sources/psp-legislation";
import { splitBillAuthorship } from "@/lib/ingest/sources/psp-activity";
import { decodeUnl, parseUnl, type UnlRow } from "@/lib/ingest/unl";
import { readZipMap } from "@/lib/ingest/zip";
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

  const tiskyZip = await getDump("tisky.zip", flag("refetch"));
  if (!tiskyZip) {
    console.error("could not fetch tisky.zip");
    process.exit(1);
  }

  const { sponsorRoles, rapporteurs, fates } = normalizeBillRoles(tiskyZip);
  const zipMembers = readZipMap(tiskyZip);
  const unlOf = (name: string): UnlRow[] => {
    const bytes = zipMembers.get(name);
    return bytes ? parseUnl(decodeUnl(bytes)) : [];
  };
  const { firstByPerson, coByPerson } = splitBillAuthorship(unlOf("tisky.unl"), unlOf("predkladatel.unl"), termPspId);

  // poslanec.id_poslanec → osoby.id_osoba, term-scoped (rapporteur ids are mandate ids).
  const mandates = await store.listMandates();
  const osobaByPoslanec = new Map<number, number>();
  for (const m of mandates) if (m.termPspId === termPspId) osobaByPoslanec.set(m.pspId, m.personPspId);

  const nodes = await store.listKgNodes();
  const billNodeById = new Map<string, KgNodeRow>();
  const personNodeById = new Map<string, KgNodeRow>();
  const tiskIdOfBill = (id: string) => Number(/^bill:tisk:(\d+)$/.exec(id)?.[1] ?? NaN);
  for (const n of nodes) {
    if (n.kind === "bill") billNodeById.set(n.id, n);
    else if (n.kind === "person") personNodeById.set(n.id, n);
  }

  // firstSeenPass understates the graph-log sequence (later passes touch props only),
  // so prefer an explicit --pass; graph-log.md is the pass ledger.
  const pass = Number(argOf("pass")) || Math.max(0, ...nodes.map((n) => n.firstSeenPass)) + 1;
  const provenance = { pass, method: "deterministic", ref: "psp-tisky-roles", computedAt: new Date().toISOString() };

  // ── sponsors edge props (rank/role) — only edges that already exist ──────────
  const sponsorEdges = (await store.listKgEdges({ rel: "sponsors" })).filter((e) => billNodeById.has(e.dst));
  const edgeUpdates: KgEdgeRow[] = [];
  let edgesWithoutRole = 0;
  for (const e of sponsorEdges) {
    const osoba = Number(/^psp:person:(\d+)$/.exec(e.src)?.[1] ?? NaN);
    const roles = sponsorRoles.get(tiskIdOfBill(e.dst)) ?? [];
    const role = roles.find((r) => r.idOsoba === osoba);
    if (!role) {
      edgesWithoutRole++;
      continue; // leave the edge as-is rather than invent a rank
    }
    edgeUpdates.push({
      ...e,
      props: {
        ...e.props,
        rank: role.rank,
        role: role.rank === 1 ? "predkladatel" : "spolupodepsal",
        joined_later: role.joinedLater,
      },
      provenance,
    });
  }

  // ── rapporteur edges (person → bill), scopes merged per pair ─────────────────
  const rapByPair = new Map<string, { src: string; dst: string; scopes: Set<RapporteurScope>; organIds: Set<number> }>();
  let rapUnmappedPoslanec = 0;
  let rapOutsideGraph = 0;
  for (const r of rapporteurs) {
    const billId = `bill:tisk:${r.tiskId}`;
    if (!billNodeById.has(billId)) continue; // other terms / non-law prints
    const osoba = osobaByPoslanec.get(r.poslanecId);
    if (osoba == null) {
      rapUnmappedPoslanec++;
      continue;
    }
    const personId = `psp:person:${osoba}`;
    if (!personNodeById.has(personId)) {
      rapOutsideGraph++;
      continue;
    }
    const key = `${personId}→${billId}`;
    const slot = rapByPair.get(key) ?? { src: personId, dst: billId, scopes: new Set(), organIds: new Set() };
    slot.scopes.add(r.scope);
    if (r.organId != null) slot.organIds.add(r.organId);
    rapByPair.set(key, slot);
  }
  const rapporteurEdges: KgEdgeRow[] = [...rapByPair.values()].map((p) => ({
    src: p.src,
    rel: "rapporteur",
    dst: p.dst,
    weight: null,
    props: { scopes: [...p.scopes].sort(), organ_ids: [...p.organIds].sort((a, b) => a - b) },
    provenance,
  }));

  // ── bill node props: sponsors_ranked + fate (merge-preserving) ───────────────
  const billUpdates: KgNodeRow[] = [];
  for (const [id, node] of billNodeById) {
    const tiskId = tiskIdOfBill(id);
    const roles = sponsorRoles.get(tiskId) ?? [];
    const fate = fates.get(tiskId);
    billUpdates.push({
      ...node,
      props: {
        ...node.props,
        ...(roles.length > 0
          ? { sponsors_ranked: roles.map((r) => ({ osoba: r.idOsoba, rank: r.rank, joined_later: r.joinedLater })) }
          : {}),
        stav: fate?.stav ?? null,
        fate_sb: fate?.sb ?? null,
        fate_published_on: fate?.publishedOn ?? null,
        roles_provenance: provenance,
      },
    });
  }

  // ── person node props: the Q-effort-2 split (merge-preserving) ───────────────
  const personUpdates: KgNodeRow[] = [];
  let splitMismatches = 0;
  for (const [id, node] of personNodeById) {
    const osoba = Number(/^psp:person:(\d+)$/.exec(id)?.[1] ?? NaN);
    if (!Number.isFinite(osoba)) continue;
    const first = firstByPerson.get(osoba) ?? 0;
    const co = coByPerson.get(osoba) ?? 0;
    const authored = node.props.bills_authored;
    if (typeof authored === "number" && authored !== first + co) splitMismatches++;
    personUpdates.push({
      ...node,
      props: { ...node.props, bills_first_signed: first, bills_co_signed: co, bill_split_provenance: provenance },
    });
  }

  const publishedBills = billUpdates.filter((b) => b.props.fate_sb != null).length;
  console.log(`Bill roles backfill · term ${term} (organ ${termPspId}) · ${commit ? "COMMIT" : "DRY-RUN"} · pass ${pass}`);
  console.log(`  sponsors edges: ${sponsorEdges.length} existing → ${edgeUpdates.length} get {rank, role} (${edgesWithoutRole} without a predkladatel row — left untouched)`);
  console.log(`    of which rank 1 (predkladatel): ${edgeUpdates.filter((e) => e.props.rank === 1).length}`);
  console.log(`  rapporteur edges: ${rapporteurEdges.length} pairs (skipped: ${rapUnmappedPoslanec} unmapped poslanec ids, ${rapOutsideGraph} persons outside graph)`);
  console.log(`  bill nodes: ${billUpdates.length} get stav/fate (${publishedBills} published in Sbírka) — props MERGED, summaries/forensics preserved`);
  console.log(`  person nodes: ${personUpdates.length} get bills_first_signed/bills_co_signed`);
  if (splitMismatches > 0) {
    console.warn(`  ⚠ ${splitMismatches} persons where first+co ≠ stored bills_authored — bills_authored NOT touched; investigate before trusting the split for those`);
  }

  if (commit) {
    const n = await store.upsertKgNodes([...billUpdates, ...personUpdates]);
    const e = await store.upsertKgEdges([...edgeUpdates, ...rapporteurEdges]);
    console.log(`\nCOMMITTED: ${n} nodes updated + ${e} edges written (pass ${pass}).`);
  } else {
    console.log(`\nDRY-RUN — would update ${billUpdates.length + personUpdates.length} nodes + write ${edgeUpdates.length + rapporteurEdges.length} edges. Re-run with --commit.`);
  }
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
