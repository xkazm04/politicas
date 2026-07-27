/* Money loop — batch 012: snapshot the contract corpus's shape, for a real before/after.
 *
 * The re-ingest's whole claim is that it lifts every CZK figure from a capped floor to the
 * actual record. That claim is only checkable against a snapshot taken BEFORE the write —
 * reconstructing "what it used to be" afterwards from memory or from the batch note would
 * be exactly the kind of unverifiable assertion this loop keeps catching.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b12 npx tsx scripts/case-loops/money/contract-corpus-snapshot.ts --out=before
 *   npx tsx scripts/case-loops/money/contract-corpus-snapshot.ts --out=after
 *   npx tsx scripts/case-loops/money/contract-corpus-snapshot.ts --compare
 */
import { getStore } from "@/lib/db/store";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const flag = (n: string) => process.argv.includes(`--${n}`);
const path = (which: string) => `docs/data-analysis/case-money/contract-corpus-${which}-b12.json`;

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

interface Snapshot {
  takenAt: string;
  contractNodes: number;
  supplyEdges: number;
  companiesWithSupplies: number;
  maxContractsPerCompany: number;
  companiesAtMax: number;
  totalCzk: number;
  earliestSignedOn: string | null;
  latestSignedOn: string | null;
  /** Top companies by reachable CZK — the figures the surfaces actually render. */
  topCompanies: { id: string; label: string; contracts: number; czk: number }[];
}

async function snapshot(): Promise<Snapshot> {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const contracts = await store.listKgNodes({ kind: "contract", limit: 500_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 500_000 });
  await store.close();

  const byId = new Map(contracts.map((c) => [c.id, c]));
  const labelById = new Map(companies.map((c) => [c.id, c.label]));
  const per = new Map<string, { contracts: number; czk: number }>();
  const dates: string[] = [];
  let totalCzk = 0;
  for (const e of supplies) {
    const props = (byId.get(e.dst)?.props ?? {}) as Record<string, unknown>;
    const amount = num(props.amount);
    const cur = per.get(e.src) ?? { contracts: 0, czk: 0 };
    cur.contracts++;
    cur.czk += amount;
    per.set(e.src, cur);
    totalCzk += amount;
    const d = str(props.signedOn);
    if (d) dates.push(d);
  }
  dates.sort();
  const counts = [...per.values()].map((p) => p.contracts);
  const max = counts.length ? Math.max(...counts) : 0;
  return {
    takenAt: new Date().toISOString(),
    contractNodes: contracts.length,
    supplyEdges: supplies.length,
    companiesWithSupplies: per.size,
    maxContractsPerCompany: max,
    companiesAtMax: counts.filter((c) => c === max).length,
    totalCzk,
    earliestSignedOn: dates[0] ?? null,
    latestSignedOn: dates[dates.length - 1] ?? null,
    topCompanies: [...per.entries()]
      .map(([id, v]) => ({ id, label: labelById.get(id) ?? id, ...v }))
      .sort((a, b) => b.czk - a.czk)
      .slice(0, 15),
  };
}

async function main() {
  const fs = await import("node:fs/promises");
  if (flag("compare")) {
    const before = JSON.parse(await fs.readFile(path("before"), "utf8")) as Snapshot;
    const after = JSON.parse(await fs.readFile(path("after"), "utf8")) as Snapshot;
    const row = (k: keyof Snapshot, fmt: (v: unknown) => string = String) =>
      console.log(`  ${String(k).padEnd(24)} ${fmt(before[k]).padStart(18)}  →  ${fmt(after[k]).padStart(18)}`);
    const czk = (v: unknown) => Number(v).toLocaleString("cs-CZ");
    console.log("contract corpus, before → after re-ingest\n");
    row("contractNodes");
    row("supplyEdges");
    row("companiesWithSupplies");
    row("maxContractsPerCompany");
    row("companiesAtMax");
    row("totalCzk", czk);
    row("earliestSignedOn");
    row("latestSignedOn");
    const factor = before.totalCzk > 0 ? after.totalCzk / before.totalCzk : 0;
    console.log(`\n  reachable CZK multiplier: ×${factor.toFixed(2)}`);
    console.log(`\n  top companies by reachable CZK (after):`);
    for (const c of after.topCompanies.slice(0, 10)) {
      const was = before.topCompanies.find((b) => b.id === c.id);
      console.log(
        `    ${c.label.slice(0, 44).padEnd(44)} ${c.contracts.toString().padStart(5)} contracts  ${c.czk.toLocaleString("cs-CZ").padStart(18)} CZK` +
          (was ? `  (was ${was.contracts}, ${was.czk.toLocaleString("cs-CZ")})` : `  (NEW)`),
      );
    }
    return;
  }
  const which = arg("out") ?? "before";
  const snap = await snapshot();
  await fs.writeFile(path(which), JSON.stringify(snap, null, 2));
  console.log(`${which}: ${snap.contractNodes} contract nodes · ${snap.supplyEdges} supplies edges · ` +
    `${snap.totalCzk.toLocaleString("cs-CZ")} CZK · max ${snap.maxContractsPerCompany}/company (${snap.companiesAtMax} at max) · ` +
    `${snap.earliestSignedOn}..${snap.latestSignedOn}`);
  console.log(`written: ${path(which)}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
