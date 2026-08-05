/* Case ③ Law loop — batch-start provenance probe (doctrine from the 2026-08-05 store-restore
 * incident, [[live-store-can-be-restored-under-you]]): before any live write, verify the live
 * store still carries every pass the ledger believes exists. A missing pass means a concurrent
 * session restored a backup under you — replay from committed payloads before proceeding.
 *
 *   npx tsx scripts/case-loops/law/provenance-probe.ts
 */
import { getStore } from "@/lib/db/store";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const bills = await store.listKgNodes({ kind: "bill" });
  const passes = new Map<number, number>();
  let withF = 0;
  for (const b of bills) {
    const p = b.props as Record<string, unknown>;
    if (!p.forensic_severity) continue;
    withF++;
    const prov = (p.forensic_provenance ?? {}) as Record<string, unknown>;
    const n = typeof prov.pass === "number" ? prov.pass : -1;
    passes.set(n, (passes.get(n) ?? 0) + 1);
  }
  const laws = await store.listKgNodes({ kind: "law" });
  const amends = await store.listKgEdges({ rel: "amends" });
  console.log(`bills with forensic: ${withF} · by pass: ${JSON.stringify([...passes.entries()].sort((a, b) => a[0] - b[0]))}`);
  console.log(`laws: ${laws.length} · amends: ${amends.length}`);
  // Expectations as of pass 50 (update on each batch's finalize):
  const EXPECT = { withF: 99, laws: 293, amends: 582, passes: [45, 47, 48, 49, 50, 51] };
  const missing = EXPECT.passes.filter((p) => !passes.has(p));
  const ok = withF === EXPECT.withF && laws.length === EXPECT.laws && amends.length === EXPECT.amends && missing.length === 0;
  console.log(ok ? "PROBE OK — live matches the ledgered state." : `PROBE MISMATCH — ${missing.length ? `missing passes ${missing.join(",")}; ` : ""}expected ${JSON.stringify(EXPECT)}. A backup may have been restored — replay before writing.`);
  await store.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
