/* Money loop — batch 015 verification, through the loaders the pages use.
 *
 *   npx tsx scripts/case-loops/money/verify-b15.ts
 */
import { getMoneyData } from "@/features/money/getMoneyData";

const cz = (n: number) => Math.round(n).toLocaleString("cs-CZ");

async function main() {
  const data = await getMoneyData();
  if (!data) throw new Error("getMoneyData returned null — the surface is on the fallback");
  const s = data.stats;

  console.log(`attributable (headline)   ${cz(s.money.attributable.contractCzk)} CZK  · ${s.money.attributable.companies} firem`);
  console.log(`steward                   ${cz(s.money.steward.contractCzk)} CZK  · ${s.money.steward.companies} firem`);
  console.log(`total                     ${cz(s.money.totalCzk)} CZK`);
  console.log(`excluded (non-reaching)   ${cz(s.contractsExcludedNonReaching.czk)} CZK / ${s.contractsExcludedNonReaching.count}`);
  console.log(`shared-recipient (kept)   ${cz(s.contractsSharedRecipients.czk)} CZK / ${s.contractsSharedRecipients.count}`);

  const before014 = 42_893_747_930;
  const before015 = 31_122_348_145;
  console.log(
    `\nheadline: ${cz(before014)} (pre-014) -> ${cz(before015)} (pre-015) -> ${cz(s.money.attributable.contractCzk)}`,
  );

  // The mandate census, as the ties actually carry it.
  const ties = data.mps.flatMap((m) => m.ties);
  const byCompany = new Map<string, (typeof ties)[number]>();
  for (const t of ties) if (!byCompany.has(t.companyId)) byCompany.set(t.companyId, t);
  const census = new Map<string, { n: number; czk: number }>();
  for (const t of byCompany.values()) {
    const k = t.publicMandate ?? "(nezjištěno)";
    const cur = census.get(k) ?? { n: 0, czk: 0 };
    cur.n += 1;
    cur.czk += t.contractCzk;
    census.set(k, cur);
  }
  console.log(`\npublic_mandate across ${byCompany.size} tied companies:`);
  for (const [k, v] of [...census.entries()].sort((a, b) => b[1].czk - a[1].czk)) {
    console.log(`   ${k.padEnd(26)} ${String(v.n).padStart(3)} firem ${cz(v.czk).padStart(18)} CZK`);
  }

  for (const ico of ["46347534", "60193913", "25848526", "28633032"]) {
    const t = [...byCompany.values()].find((x) => x.ico === ico);
    if (!t) continue;
    console.log(
      `\n${t.company} — ${t.tieClass} / ${t.publicMandate} · attributable=${t.publicMandateAttributable}`,
    );
    console.log(`   ${cz(t.contractCzk)} CZK · vlastníci: ${t.publicMandateOwners.map((o) => o.name).join(", ") || "—"}`);
  }
}

main().then(() => process.exit(0));
