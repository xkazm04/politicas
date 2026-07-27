/* Money loop — batch 011: is the graph's contract corpus a CENSUS or a capped SAMPLE?
 *
 * Checking AGROFERT's contracts turned up a suspicious shape: nearly every AGROFERT-group
 * company carries 20–25 `supplies` edges, and AGROFERT's own dated contracts stop at
 * 2019-02-05 — even though Registr smluv has been running continuously since 2016 and the
 * live sweep finds contracts published in 2026.
 *
 * If the original money feed capped its per-company contract pull, then EVERY CZK figure
 * this case has ever quoted — including the skill's own headline "~18.7 bn CZK reachable
 * across 73 MPs" — is a floor computed from a truncated sample, not a total. That would
 * be a brand-rule problem: a rendered number that does not mean what it appears to mean.
 *
 * This tests it deterministically against the graph alone (no network):
 *   1. the distribution of contracts-per-company — a hard ceiling shows up as a spike
 *   2. the date range per company — a feed that stopped pulling shows up as a common
 *      latest-date wall
 *   3. how many companies sit exactly AT the modal ceiling (the signature of a page cap)
 *
 *   PGLITE_PATH=./.pglite-copy-money-ag npx tsx scripts/case-loops/money/supplies-coverage-audit.ts
 */
import { getStore } from "@/lib/db/store";

const OUT = "docs/data-analysis/case-money/qmoney-supplies-coverage-b11.json";
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to a copy)");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const contracts = await store.listKgNodes({ kind: "contract", limit: 200_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 200_000 });
  await store.close();

  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  interface Row { id: string; label: string; contracts: number; czk: number; earliest: string | null; latest: string | null }
  const byCompany = new Map<string, Row>();
  for (const e of supplies) {
    const row = byCompany.get(e.src) ?? {
      id: e.src, label: companyById.get(e.src)?.label ?? e.src,
      contracts: 0, czk: 0, earliest: null, latest: null,
    };
    const props = (contractById.get(e.dst)?.props ?? {}) as Record<string, unknown>;
    row.contracts++;
    row.czk += num(props.amount);
    const d = str(props.signedOn);
    if (d) {
      if (!row.earliest || d < row.earliest) row.earliest = d;
      if (!row.latest || d > row.latest) row.latest = d;
    }
    byCompany.set(e.src, row);
  }

  const rows = [...byCompany.values()].sort((a, b) => b.contracts - a.contracts);
  const counts = rows.map((r) => r.contracts);

  // 1) distribution + ceiling detection
  const hist = new Map<number, number>();
  for (const c of counts) hist.set(c, (hist.get(c) ?? 0) + 1);
  const max = Math.max(...counts);
  const atMax = counts.filter((c) => c === max).length;
  const at20plus = counts.filter((c) => c >= 20).length;

  console.log(`companies with >=1 supplies edge: ${rows.length}`);
  console.log(`contracts-per-company: max ${max}, median ${counts[Math.floor(counts.length / 2)]}, total ${supplies.length}`);
  console.log(`\ndistribution (contracts → how many companies), top of range:`);
  for (const n of [...hist.keys()].sort((a, b) => b - a).slice(0, 12)) {
    console.log(`   ${String(n).padStart(3)} contracts → ${hist.get(n)} compan${hist.get(n) === 1 ? "y" : "ies"}`);
  }
  console.log(`\ncompanies sitting exactly AT the maximum (${max}): ${atMax}`);
  console.log(`companies with >=20 contracts: ${at20plus} of ${rows.length} (${((at20plus / rows.length) * 100).toFixed(0)}%)`);

  // 2) the date wall
  const latests = rows.map((r) => r.latest).filter((d): d is string => Boolean(d)).sort();
  const globalLatest = latests[latests.length - 1] ?? null;
  const byYear = new Map<string, number>();
  for (const d of latests) {
    const y = d.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  console.log(`\nlatest contract date per company, by year:`);
  for (const y of [...byYear.keys()].sort()) console.log(`   ${y}: ${byYear.get(y)} compan(y/ies)`);
  console.log(`globally latest signedOn anywhere in the corpus: ${globalLatest}`);

  const capped = rows.filter((r) => r.contracts === max);
  console.log(`\ncompanies at the ceiling (a capped pull would look exactly like this):`);
  for (const r of capped.slice(0, 15)) console.log(`   ${r.contracts} ${r.label} (${r.earliest} .. ${r.latest})`);

  const verdict =
    atMax > 1 && max <= 30
      ? `CAPPED SAMPLE: ${atMax} companies sit exactly at ${max} contracts — a per-company pull limit, not a coincidence. Every per-company CZK total in this graph is a FLOOR.`
      : `No obvious per-company ceiling detected (max ${max}, ${atMax} at max).`;
  console.log(`\nVERDICT: ${verdict}`);

  await fs.writeFile(
    OUT,
    JSON.stringify(
      {
        batch: 11, track: "money", kind: "supplies-coverage-audit",
        generatedAt: new Date().toISOString().slice(0, 10),
        note:
          "Tests whether the graph's `supplies` corpus is a census or a capped per-company sample, using the graph " +
          "alone. If capped, every CZK total this case has quoted is a floor over a truncated sample — including " +
          "the module's headline reachable-CZK figure — and must be labelled as such wherever it renders.",
        verdict,
        counts: {
          companiesWithSupplies: rows.length,
          supplyEdges: supplies.length,
          maxContractsPerCompany: max,
          companiesAtMax: atMax,
          companiesWith20Plus: at20plus,
          globalLatestSignedOn: globalLatest,
          latestPerCompanyByYear: Object.fromEntries([...byYear.entries()].sort()),
        },
        distribution: Object.fromEntries([...hist.entries()].sort((a, b) => b[0] - a[0])),
        perCompany: rows,
      },
      null, 2,
    ),
  );
  console.log(`\nwritten: ${OUT}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
