/*
 * Generátor features/budget/data/municipalSuppliers.generated.ts (moonshot 4D).
 *
 * Jednorázový offline sken peněžního grafu: uzly smluv (kind=contract, pole
 * `parties` z batch-012 re-ingestu smlouvy.gov.cz) × hrany `supplies` ×
 * rejstřík obcí (registryData.generated) → agregáty dodavatelů po obcích
 * podle zveřejněného pravidla v supplierTrail.ts (deriveMunicipalSupplierRows —
 * generátor NEobsahuje vlastní logiku spojení, jen IO).
 *
 * Proč generovaná dávka, a ne loader: sken 152 788 uzlů smluv trvá sekundy
 * (změřeno na živém skladu ~7,8 s) a data se mění jen re-ingestem — týž
 * důvod, proč 4A generuje registr a rozpočtové řady. Vrstva vazeb na
 * poslance se naproti tomu čte ŽIVĚ (getSupplierTies.ts): stav lidské
 * kontroly se nesmí zmrazit do dávky.
 *
 * Spuštění (sklad nesmí držet jiný proces; případně PGLITE_PATH na kopii):
 *   npx tsx features/budget/tools/generate-municipal-suppliers.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { getRegistry } from "../mirrorData";
import { deriveMunicipalSupplierRows, icoFromCompanyId, packSupplierRows } from "../supplierTrail";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("sklad není k dispozici (getStore → null)");

  console.log("čtu peněžní graf…");
  const contracts = await store.listKgNodes({ kind: "contract", limit: KG_READ_CAP });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: KG_READ_CAP });
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  console.log(`  ${contracts.length} smluv · ${supplies.length} hran supplies · ${companies.length} firem`);

  const companyLabelByIco = new Map<string, string>();
  for (const c of companies) {
    const ico = icoFromCompanyId(c.id);
    if (ico) companyLabelByIco.set(ico, c.label.replace(/[|\n]/g, " ").trim());
  }

  const municipalIcs = new Set(getRegistry().map((m) => m.ic));

  const { rows, stats } = deriveMunicipalSupplierRows({
    contracts,
    supplies,
    companyLabelByIco,
    municipalIcs,
  });

  // Provenience dávky: pass + computedAt z hran supplies (batch-012 track money).
  const prov = supplies[0]?.provenance as Record<string, unknown> | undefined;
  const pass = Number(prov?.pass) || 0;
  const computedAt = typeof prov?.computedAt === "string" ? prov.computedAt.slice(0, 10) : "";
  const townCount = new Set(rows.map((r) => r.townIc)).size;

  console.log(
    `spojení: ${stats.municipalContracts} smluv obcí z ${stats.contractsScanned} · ` +
      `z toho ${stats.paidContracts} s doloženým směrem platby · ` +
      `${rows.length} párů obec×protistrana · ${townCount} obcí · ` +
      `${stats.multiTownContracts} smluv připsaných více obcím`,
  );

  const out = `// AUTO-GENERATED — nepsat ručně. Peněžní stopa obcí: uzly smluv peněžního
// grafu (batch-012 re-ingest smlouvy.gov.cz: \`publisher\`, \`parties\`,
// \`partyDirections\`) × hrany \`supplies\` × rejstřík obcí, podle zveřejněného
// pravidla spojení v supplierTrail.ts. Regenerace:
// tools/generate-municipal-suppliers.ts.
// Řádek: obec|IČO|název|počet₊|Kč₊|počet₀|Kč₀|prvníRok|posledníRok
// (₊ = doložené platby obce, ₀ = směr platby záznam neuvádí).

/** Den, ke kterému graf smluv vznikl (computedAt hran supplies). */
export const SUPPLIERS_RETRIEVED_ON = ${JSON.stringify(computedAt)};

/** Pass peněžního grafu, ze kterého dávka čte (provenience hran supplies). */
export const SUPPLIERS_PASS = ${pass};

/** Kolik uzlů smluv sken prošel (jmenovatel pokrytí). */
export const SUPPLIERS_CONTRACTS_SCANNED = ${stats.contractsScanned};

/** Smlouvy s párem obec×protistrana nalezené skenem. */
export const SUPPLIERS_MUNICIPAL_CONTRACTS = ${stats.municipalContracts};

/** Z nich smlouvy s doloženým směrem platby obec → firma (pravidlo 3). */
export const SUPPLIERS_PAID_CONTRACTS = ${stats.paidContracts};

/** ${rows.length} párů obec×protistrana napříč ${townCount} obcemi. */
export const SUPPLIERS_PACKED = \`${packSupplierRows(rows).replace(/[\\`$]/g, (ch) => `\\${ch}`)}\`;
`;

  const outPath = join(import.meta.dirname, "..", "data", "municipalSuppliers.generated.ts");
  writeFileSync(outPath, out, "utf8");
  // raw-format-ok: konzolový výpis offline generátoru, ne plocha aplikace
  console.log(`zapsáno: ${outPath} (${(out.length / 1024).toFixed(1)} kB)`);
}

main().then(() => process.exit(0));
