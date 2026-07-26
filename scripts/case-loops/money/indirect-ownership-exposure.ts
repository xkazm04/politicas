/* Money loop — batch 008, item 3: the indirect-ownership layer's first real question.
 *
 * 33 `owns_stake` (company -> company) edges are live (batch 006's O-money-3 first slice).
 * Compute what they actually enable: which MP-tied companies (via `linked_to`) sit under a
 * parent that ALSO owns OTHER companies (siblings) holding public contracts (via `supplies`)
 * — i.e. indirect exposure the direct linked_to join structurally cannot see, because the
 * MP is tied to company A, but public money flows to sibling company B under the SAME parent.
 *
 * Every result is a LEAD (cited, gated), never an assertion about a person. No review_state
 * touched, no edge written — this is a read-only analytical pass over a copy.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b8 npx tsx scripts/case-loops/money/indirect-ownership-exposure.ts
 */
import { getStore } from "@/lib/db/store";


/** Narrow an unknown prop to a string (or null) — kg props are jsonb, so every
 *  read is `unknown`; these keep the payload's declared types honest. */
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
  const contracts = await store.listKgNodes({ kind: "contract", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const ownsStake = await store.listKgEdges({ rel: "owns_stake", limit: 100_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 100_000 });

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const personById = new Map(persons.map((p) => [p.id, p]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  console.log(`graph: ${companies.length} companies, ${linked.length} linked_to, ${ownsStake.length} owns_stake, ${supplies.length} supplies`);

  // owns_stake direction: src = parent/shareholder, dst = owned company (per batch-006's
  // AGROFERT HOLDING -> AGROFERT chain, and the validator's dst=already-graphed-child rule).
  const childrenByParent = new Map<string, typeof ownsStake>();
  for (const e of ownsStake) {
    const arr = childrenByParent.get(e.src) ?? [];
    arr.push(e);
    childrenByParent.set(e.src, arr);
  }
  const parentsByChild = new Map<string, typeof ownsStake>();
  for (const e of ownsStake) {
    const arr = parentsByChild.get(e.dst) ?? [];
    arr.push(e);
    parentsByChild.set(e.dst, arr);
  }

  // company -> its contracts (via supplies) with amount/date
  const contractsByCompany = new Map<string, { id: string; amount: number; signedOn: string | null }[]>();
  for (const e of supplies) {
    const ct = contractById.get(e.dst);
    if (!ct) continue;
    const arr = contractsByCompany.get(e.src) ?? [];
    arr.push({ id: e.dst, amount: num(e.weight) || num(ct.props?.amount), signedOn: (ct.props?.signedOn as string | null) ?? null });
    contractsByCompany.set(e.src, arr);
  }

  // tied companies: company nodes that have >=1 linked_to edge FROM a person
  const tiedCompanyIds = new Set(linked.map((e) => e.dst));

  interface Lead {
    mp: string;
    mpId: string;
    tiedCompany: string;
    tiedCompanyId: string;
    tieRole: string;
    tieCorroboration: string;
    parent: string;
    parentId: string;
    ownsStakeEdge: { role: string | null; from: string | null; to: string | null; share: number | null; source: string };
    siblingCompany: string;
    siblingCompanyId: string;
    siblingContracts: number;
    siblingContractsCzk: number;
    siblingIsAlsoDirectlyTied: boolean;
  }
  const leads: Lead[] = [];
  const chainsExamined: { tiedCompany: string; parent: string; siblingCount: number }[] = [];

  for (const tieEdge of linked) {
    const tiedComp = companyById.get(tieEdge.dst);
    const mpPerson = personById.get(tieEdge.src);
    if (!tiedComp) continue;
    const parentsOfTied = parentsByChild.get(tieEdge.dst) ?? [];
    for (const pEdge of parentsOfTied) {
      const parent = companyById.get(pEdge.src);
      if (!parent) continue;
      const siblings = (childrenByParent.get(pEdge.src) ?? []).filter((e) => e.dst !== tieEdge.dst);
      chainsExamined.push({ tiedCompany: tiedComp.label, parent: parent.label, siblingCount: siblings.length });
      for (const sibEdge of siblings) {
        const sib = companyById.get(sibEdge.dst);
        if (!sib) continue;
        const sibContracts = contractsByCompany.get(sib.id) ?? [];
        if (sibContracts.length === 0) continue; // only report siblings that actually hold public money
        leads.push({
          mp: mpPerson?.label ?? tieEdge.src,
          mpId: tieEdge.src,
          tiedCompany: tiedComp.label,
          tiedCompanyId: tieEdge.dst,
          tieRole: String((tieEdge.props as Record<string, unknown>)?.role ?? ""),
          tieCorroboration: String((tieEdge.props as Record<string, unknown>)?.corroboration ?? ""),
          parent: parent.label,
          parentId: pEdge.src,
          ownsStakeEdge: {
            role: strOrNull((pEdge.props as Record<string, unknown>)?.role),
            from: strOrNull((pEdge.props as Record<string, unknown>)?.from),
            to: strOrNull((pEdge.props as Record<string, unknown>)?.to),
            share: numOrNull((pEdge.props as Record<string, unknown>)?.share),
            source: String((pEdge.props as Record<string, unknown>)?.source ?? ""),
          },
          siblingCompany: sib.label,
          siblingCompanyId: sib.id,
          siblingContracts: sibContracts.length,
          siblingContractsCzk: sibContracts.reduce((s, c) => s + c.amount, 0),
          siblingIsAlsoDirectlyTied: tiedCompanyIds.has(sib.id),
        });
      }
    }
  }

  console.log(`\nownership chains examined (tied company -> parent): ${chainsExamined.length}`);
  for (const c of chainsExamined) console.log(`  ${c.tiedCompany} -> parent ${c.parent} (${c.siblingCount} sibling(s) under same parent)`);

  console.log(`\nINDIRECT-EXPOSURE LEADS (sibling under same parent holds public contracts): ${leads.length}`);
  for (const l of leads) {
    console.log(`  ${l.mp} tied to ${l.tiedCompany} [${l.tieCorroboration}] — parent ${l.parent} also owns ${l.siblingCompany} (${l.siblingContracts} contracts, ${l.siblingContractsCzk.toLocaleString("cs-CZ")} CZK)${l.siblingIsAlsoDirectlyTied ? " [sibling ALSO directly tied to an MP]" : ""}`);
  }

  const dir = "docs/data-analysis/case-money";
  await fs.writeFile(
    `${dir}/qmoney-indirect-exposure-b8.json`,
    JSON.stringify(
      {
        batch: 8,
        track: "money",
        kind: "indirect-ownership-exposure-analysis",
        generatedAt: new Date().toISOString().slice(0, 10),
        note:
          "READ-ONLY analytical pass, no graph writes. Every entry is a LEAD (cited by owns_stake/supplies " +
          "edge provenance already in the graph), never an assertion about a person's conduct.",
        ownsStakeEdgeCount: ownsStake.length,
        chainsExamined,
        leads,
      },
      null,
      2
    )
  );

  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
