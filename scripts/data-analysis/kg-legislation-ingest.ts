/* Case ③ Law-change forensics — Layer 1 (structured foundation) + Layer 2 (trio
 * convergence). Downloads psp.cz tisky.zip, parses the term's law-amendment bills
 * (lib/ingest/sources/psp-legislation.ts), and writes them into the knowledge graph:
 *   bill:tisk:<id>   nodes (title, origin, amended-law citations, sponsors)
 *   law:sb:<n>-<rok> nodes (the amended laws, ELI-keyable to e-Sbírka later)
 *   sponsors  edges  psp:person:<osoba> → bill   (MP sponsors from predkladatel)
 *   amends    edges  bill → law
 *
 * Layer 2 is the golden-trio convergence: because sponsors are person nodes, each bill
 * inherits its sponsors' Case-① money ties and Case-② contribution score — so we can
 * surface LAW CHANGES SPONSORED BY MPs WITH MONEY CONFLICTS or low legislative effort.
 * Everything here is deterministic; the LLM "stated-reasoning vs actual-effect" forensics
 * (Layer 3) is a separate, gated pass.
 *
 *   npx tsx scripts/data-analysis/kg-legislation-ingest.ts            # dry-run
 *   npx tsx scripts/data-analysis/kg-legislation-ingest.ts --commit   # write
 * Flags: --commit  --term=PSP10  --pass=N  --refetch  --min-czk=1000000
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { nextPass } from "@/lib/analysis/kg";
import { normalizeLegislation, type LawBill } from "@/lib/ingest/sources/psp-legislation";
import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const fmt = (n: number) => new Intl.NumberFormat("cs-CZ").format(Math.round(n));

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

const lawUrn = (ref: string) => `law:sb:${ref.replace("/", "-")}`; // "37/2021" → law:sb:37-2021
const billUrn = (tiskId: number) => `bill:tisk:${tiskId}`;

async function main() {
  const commit = flag("commit");
  const term = arg("term", "PSP10");
  const minCzk = Number(arg("min-czk", "1000000")) || 1_000_000;
  const store = await getStore();
  if (!store) {
    console.error("no store configured");
    process.exit(1);
  }

  const persons = await store.listPersons();
  const nameById = new Map(persons.map((p) => [p.pspId, p.nameFull]));
  const organs = await store.listOrgans();
  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();
  const termPspId = organs.find((o) => o.abbrev === term)?.pspId ?? null;
  if (termPspId == null) {
    console.error(`term organ for ${term} not found`);
    process.exit(1);
  }

  // Money (Case ①) + effort (Case ②) per person, read from the stored graph.
  const linkedCompaniesByPerson = new Map<number, Set<string>>();
  const contractCzkByCompany = new Map<string, number>();
  for (const e of edges) {
    if (e.rel === "linked_to") {
      const m = /^psp:person:(\d+)$/.exec(e.src);
      if (m) {
        const s = linkedCompaniesByPerson.get(Number(m[1])) ?? new Set<string>();
        s.add(e.dst);
        linkedCompaniesByPerson.set(Number(m[1]), s);
      }
    } else if (e.rel === "supplies") {
      contractCzkByCompany.set(e.src, (contractCzkByCompany.get(e.src) ?? 0) + (typeof e.weight === "number" ? e.weight : 0));
    }
  }
  const contributionByPerson = new Map<number, number>();
  const personNodeIds = new Set<string>();
  for (const n of nodes) {
    if (n.kind !== "person") continue;
    personNodeIds.add(n.id);
    const m = /^psp:person:(\d+)$/.exec(n.id);
    if (m && typeof n.props.contribution_score === "number") contributionByPerson.set(Number(m[1]), n.props.contribution_score);
  }
  const moneyOf = (osobaId: number) => {
    const companies = linkedCompaniesByPerson.get(osobaId) ?? new Set<string>();
    const czk = [...companies].reduce((a, c) => a + (contractCzkByCompany.get(c) ?? 0), 0);
    return { companies: companies.size, czk };
  };

  console.log(`Case ③ legislation · term ${term} (organ ${termPspId}) · ${commit ? "COMMIT" : "DRY-RUN"}`);
  console.log("psp.cz tisky.zip…");
  const tiskyZip = await getDump("tisky.zip", flag("refetch"));
  if (!tiskyZip) {
    console.error("could not fetch tisky.zip");
    process.exit(1);
  }
  const bills: LawBill[] = normalizeLegislation(tiskyZip, termPspId);
  const pass = Number(arg("pass")) || nextPass(nodes);
  const computedAt = new Date().toISOString();
  const provenance = { pass, method: "deterministic", ref: "psp-tisky", computedAt };

  const byOrigin = new Map<string, number>();
  for (const b of bills) byOrigin.set(b.origin, (byOrigin.get(b.origin) ?? 0) + 1);
  console.log(`  → ${bills.length} law bills [${[...byOrigin].map(([k, n]) => `${k} ${n}`).join(" · ")}]\n`);

  const billNodes: KgNodeRow[] = [];
  const lawNodes = new Map<string, KgNodeRow>();
  const edgeRows: KgEdgeRow[] = [];
  const flagged: { bill: LawBill; sponsor: number; companies: number; czk: number; contribution: number | null }[] = [];

  for (const b of bills) {
    const graphSponsors = b.sponsorOsobaIds.filter((id) => personNodeIds.has(`psp:person:${id}`));
    // Layer 2: worst-case sponsor money + effort
    let maxCompanies = 0;
    let maxCzk = 0;
    let minContribution: number | null = null;
    for (const id of graphSponsors) {
      const money = moneyOf(id);
      if (money.czk > maxCzk) maxCzk = money.czk;
      if (money.companies > maxCompanies) maxCompanies = money.companies;
      const c = contributionByPerson.get(id);
      if (c != null && (minContribution == null || c < minContribution)) minContribution = c;
      if (money.companies > 0 && money.czk >= minCzk) flagged.push({ bill: b, sponsor: id, companies: money.companies, czk: money.czk, contribution: c ?? null });
    }
    const flaggedConflict = maxCompanies > 0 && maxCzk >= minCzk;

    billNodes.push({
      id: billUrn(b.tiskId),
      kind: "bill",
      label: (b.title ?? `tisk ${b.cislo ?? b.tiskId}`).slice(0, 200),
      props: {
        cislo: b.cislo,
        druh: b.druh,
        origin: b.origin,
        term,
        submitter: b.submitterText,
        amended_laws: b.amendedLaws,
        sponsors: b.sponsorOsobaIds,
        sponsor_money_companies: maxCompanies,
        sponsor_contract_czk: maxCzk,
        sponsor_min_contribution: minContribution,
        flagged_conflict: flaggedConflict,
      },
      firstSeenPass: pass,
      provenance,
    });
    for (const id of graphSponsors) {
      edgeRows.push({ src: `psp:person:${id}`, rel: "sponsors", dst: billUrn(b.tiskId), weight: null, props: {}, provenance });
    }
    for (const ref of b.amendedLaws) {
      const urn = lawUrn(ref);
      if (!lawNodes.has(urn)) lawNodes.set(urn, { id: urn, kind: "law", label: `zákon č. ${ref} Sb.`, props: { ref }, firstSeenPass: pass, provenance });
      edgeRows.push({ src: billUrn(b.tiskId), rel: "amends", dst: urn, weight: null, props: {}, provenance });
    }
  }

  console.log(`nodes: ${billNodes.length} bill · ${lawNodes.size} law · edges: ${edgeRows.filter((e) => e.rel === "sponsors").length} sponsors · ${edgeRows.filter((e) => e.rel === "amends").length} amends`);

  // Layer 2 headline — law changes whose sponsor has real money ties.
  const flaggedBills = new Map<number, (typeof flagged)[number]>();
  for (const f of flagged) if (!flaggedBills.has(f.bill.tiskId) || f.czk > flaggedBills.get(f.bill.tiskId)!.czk) flaggedBills.set(f.bill.tiskId, f);
  console.log(`\n⚑ LAW CHANGES SPONSORED BY MONEY-LINKED MPs — ${flaggedBills.size}:`);
  for (const f of [...flaggedBills.values()].sort((a, b) => b.czk - a.czk).slice(0, 15)) {
    console.log(
      `  tisk ${f.bill.cislo} · ${nameById.get(f.sponsor) ?? f.sponsor} (${f.companies} co / ${fmt(f.czk)} CZK, contrib ${f.contribution ?? "?"})` +
        `${f.bill.amendedLaws.length ? ` · amends ${f.bill.amendedLaws.join(", ")}` : ""}\n      ${(f.bill.title ?? "").slice(0, 120)}`,
    );
  }

  if (commit) {
    const n = await store.upsertKgNodes([...billNodes, ...lawNodes.values()]);
    const e = await store.upsertKgEdges(edgeRows);
    console.log(`\nCOMMITTED: ${n} nodes + ${e} edges (pass ${pass}).`);
  } else {
    console.log(`\nDRY-RUN — would write ${billNodes.length + lawNodes.size} nodes + ${edgeRows.length} edges (pass ${pass}). Re-run with --commit.`);
  }
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
