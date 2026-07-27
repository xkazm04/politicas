/* Money loop — batch 009: is the parent-level exposure null a FINDING or a ZERO-POWER test?
 *
 * batch-009's breadth-2 pass reached the full `owns_stake` closure in both directions and
 * found 0 genuinely-new contract-holding companies. Before that is reported as "no indirect
 * exposure exists", it has to survive the batch-008 lesson (a zero-power test must be
 * labeled, not reported as a clean negative). The power question is concrete:
 *
 *   Could a non-MP-tied parent company have shown contract exposure AT ALL, given how the
 *   graph was built? `supplies` edges exist only for companies the money feed queried —
 *   i.e. companies reached from `linked_to` ties. The 19 parent nodes added by batch-006's
 *   ownership slice were never themselves queried against the contract registry.
 *
 * This script answers it deterministically, three ways:
 *   1. Do the parent nodes even carry an `ico` prop? (no IČO ⇒ un-queryable ⇒ zero power)
 *   2. Does ANY parent's IČO appear as a `supplierIco` on a contract node already in the
 *      graph? A hit with no `supplies` edge is a MISSING EDGE — a real wire proposal.
 *   3. What is the actual `supplies` coverage of the company population — i.e. what share of
 *      company nodes were ever contract-queried at all?
 *
 * Read-only. Emits the power verdict + any missing-edge candidates as a payload.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b9 npx tsx scripts/case-loops/money/parent-exposure-power-check.ts
 */
import { getStore } from "@/lib/db/store";

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const contracts = await store.listKgNodes({ kind: "contract", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const ownsStake = await store.listKgEdges({ rel: "owns_stake", limit: 100_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 100_000 });

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const tiedCompanyIds = new Set(linked.map((e) => e.dst));
  const suppliers = new Set(supplies.map((e) => e.src));

  // Every company that appears as a parent (owns_stake.src) and is NOT itself MP-tied.
  const parentIds = new Set(ownsStake.map((e) => e.src));
  const untiedParents = [...parentIds].filter((id) => !tiedCompanyIds.has(id));

  // 1) IČO presence
  const parentRows = untiedParents.map((id) => {
    const c = companyById.get(id);
    const props = (c?.props ?? {}) as Record<string, unknown>;
    return {
      id,
      label: c?.label ?? id,
      ico: str(props.ico),
      hasSuppliesEdge: suppliers.has(id),
      inGraph: Boolean(c),
    };
  });
  const withIco = parentRows.filter((p) => p.ico);
  const queried = parentRows.filter((p) => p.hasSuppliesEdge);

  console.log(`owns_stake parents: ${parentIds.size} · not themselves MP-tied: ${untiedParents.length}`);
  console.log(`  carry an ico prop: ${withIco.length}/${parentRows.length}`);
  console.log(`  have >=1 supplies edge (were ever contract-queried): ${queried.length}/${parentRows.length}`);
  for (const p of parentRows) {
    console.log(`    ${p.hasSuppliesEdge ? "Q" : "·"} ${p.ico ?? "(no ico)".padEnd(10)} ${p.label}`);
  }

  // 2) Missing-edge candidates: parent IČO present as a contract's supplierIco with no supplies edge.
  const contractsBySupplierIco = new Map<string, { id: string; amount: unknown; signedOn: unknown }[]>();
  for (const ct of contracts) {
    const props = (ct.props ?? {}) as Record<string, unknown>;
    const ico = str(props.supplierIco);
    if (!ico) continue;
    const arr = contractsBySupplierIco.get(ico) ?? [];
    arr.push({ id: ct.id, amount: props.amount, signedOn: props.signedOn });
    contractsBySupplierIco.set(ico, arr);
  }
  const suppliesKey = new Set(supplies.map((e) => `${e.src}|${e.dst}`));
  const missingEdges: { parentId: string; parent: string; ico: string; contractId: string }[] = [];
  for (const p of withIco) {
    for (const ct of contractsBySupplierIco.get(p.ico!) ?? []) {
      if (!suppliesKey.has(`${p.id}|${ct.id}`)) {
        missingEdges.push({ parentId: p.id, parent: p.label, ico: p.ico!, contractId: ct.id });
      }
    }
  }
  console.log(`\nmissing supplies-edge candidates (parent ico == contract.supplierIco, no edge): ${missingEdges.length}`);
  for (const m of missingEdges.slice(0, 20)) console.log(`    ${m.parent} (${m.ico}) → ${m.contractId}`);

  // 3) Population-wide contract-query coverage.
  const companiesWithSupplies = companies.filter((c) => suppliers.has(c.id)).length;
  const tiedWithSupplies = [...tiedCompanyIds].filter((id) => suppliers.has(id)).length;
  console.log(`\nsupplies coverage:`);
  console.log(`  company nodes with >=1 supplies edge: ${companiesWithSupplies}/${companies.length}`);
  console.log(`  MP-tied companies with >=1 supplies edge: ${tiedWithSupplies}/${tiedCompanyIds.size}`);
  console.log(`  distinct supplierIco values across ${contracts.length} contract nodes: ${contractsBySupplierIco.size}`);

  const power =
    queried.length === 0
      ? "ZERO-POWER: no non-MP-tied parent was ever contract-queried, so a parent-level null was arithmetically guaranteed."
      : `PARTIAL POWER: ${queried.length}/${parentRows.length} untied parents were contract-queried; the null holds only for those.`;
  console.log(`\nVERDICT: ${power}`);

  await fs.writeFile(
    "docs/data-analysis/case-money/qmoney-parent-power-b9.json",
    JSON.stringify(
      {
        batch: 9,
        track: "money",
        kind: "parent-exposure-power-check",
        generatedAt: new Date().toISOString().slice(0, 10),
        verdict: power,
        counts: {
          parents: parentIds.size,
          untiedParents: untiedParents.length,
          untiedParentsWithIco: withIco.length,
          untiedParentsContractQueried: queried.length,
          missingSuppliesEdgeCandidates: missingEdges.length,
          companiesWithSupplies,
          companyNodes: companies.length,
          tiedCompaniesWithSupplies: tiedWithSupplies,
          tiedCompanies: tiedCompanyIds.size,
          distinctSupplierIcos: contractsBySupplierIco.size,
        },
        untiedParents: parentRows,
        missingSuppliesEdgeCandidates: missingEdges,
      },
      null,
      2,
    ),
  );
  console.log("written: docs/data-analysis/case-money/qmoney-parent-power-b9.json");

  await store.close();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
