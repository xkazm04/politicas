/* Money loop — batch 009: would applying the case-sources kiosek payload actually give
 * the money watch (scripts/case-loops/money/kiosek-watch.ts) any power?
 *
 * Batch 008 ran the watch against 0 live `concerns` edges and correctly labelled the
 * 0 hits a zero-power baseline, then flagged "apply the 24 kiosek `concerns` proposals"
 * as the remedy. Before that remedy is carried into another batch's steering, check
 * whether it IS one: a `concerns` edge only gives the money watch power if its target
 * IČO is a company the money graph actually holds.
 *
 *   npx tsx scripts/case-loops/money/kiosek-power-check-b9.ts
 */
import { getStore } from "@/lib/db/store";

const PAYLOAD = "docs/data-analysis/case-sources/kiosek-payload.json";

async function main() {
  const fs = await import("node:fs/promises");
  const payload = JSON.parse(await fs.readFile(PAYLOAD, "utf8")) as {
    edges?: { src: string; rel: string; dst: string }[];
  };
  const concerns = (payload.edges ?? []).filter((e) => e.rel === "concerns");

  const store = await getStore();
  if (!store) throw new Error("no store");
  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  await store.close();

  const companyIds = new Set(companies.map((c) => c.id));
  const tied = new Set(linked.map((e) => e.dst));

  const targets = [...new Set(concerns.map((e) => e.dst))];
  const inGraph = targets.filter((t) => companyIds.has(t));
  const mpTied = targets.filter((t) => tied.has(t));

  console.log(`kiosek payload: ${(payload.edges ?? []).length} edge proposals, ${concerns.length} of rel=concerns`);
  console.log(`distinct concerns targets: ${targets.length}`);
  console.log(`  targets that are company nodes in the live graph: ${inGraph.length}`);
  console.log(`  targets that are MP-TIED companies (the only ones the money watch reports): ${mpTied.length}`);
  if (mpTied.length) for (const t of mpTied) console.log(`    ${t}`);
  console.log(
    `\nVERDICT: applying the kiosek payload would give the money watch ` +
      (mpTied.length === 0
        ? "NO power — not one `concerns` target is an MP-tied company, so the watch would still report 0 by construction."
        : `real power over ${mpTied.length} MP-tied compan${mpTied.length === 1 ? "y" : "ies"}.`),
  );
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
