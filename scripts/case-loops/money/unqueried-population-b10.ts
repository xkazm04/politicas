/* Money loop — batch 010: the un-contract-queried population, ranked for the sweep.
 *
 * Batch 009's power check found the case's real ceiling: `supplies` edges exist ONLY for
 * companies the original money feed happened to query, and that set is not the company
 * population. Everything downstream — indirect exposure, triangle completion, money volume
 * per tie — is bounded by it.
 *
 * This enumerates exactly who was never asked, and ranks them for the Registr smluv sweep
 * by the case's own priority rule rather than by raw size:
 *
 *   tie_class FIRST. An `owner-operator` tie is one where money reaching the company can
 *   plausibly reach the MP; a `steward` tie is a public-body board seat where the money is
 *   the BODY'S own activity and must never be attributed to the MP. So an un-queried
 *   owner-operator company is a genuine hole in the case; an un-queried steward company is
 *   mostly context.
 *
 * Output feeds `parent-contract-sweep.ts`'s successor. Read-only.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b10 npx tsx scripts/case-loops/money/unqueried-population-b10.ts
 */
import { getStore } from "@/lib/db/store";

const OUT = "docs/data-analysis/case-money/qmoney-unqueried-population-b10.json";
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const CLASS_RANK: Record<string, number> = { "owner-operator": 0, manager: 1, steward: 2 };

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const ownsStake = await store.listKgEdges({ rel: "owns_stake", limit: 100_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 100_000 });
  await store.close();

  const personById = new Map(persons.map((p) => [p.id, p]));
  const queried = new Set(supplies.map((e) => e.src));
  const parents = new Set(ownsStake.map((e) => e.src));

  /** Every tie touching a company, so one company can carry several MPs/classes. */
  const tiesByCompany = new Map<string, typeof linked>();
  for (const e of linked) {
    const arr = tiesByCompany.get(e.dst) ?? [];
    arr.push(e);
    tiesByCompany.set(e.dst, arr);
  }

  interface Row {
    id: string; label: string; ico: string | null;
    everQueried: boolean;
    tieCount: number;
    bestTieClass: string | null;
    classRank: number;
    corroborations: string[];
    mps: string[];
    isOwnershipParent: boolean;
    icoUnresolvable: boolean;
    reason: string;
  }

  const rows: Row[] = companies.map((c) => {
    const props = (c.props ?? {}) as Record<string, unknown>;
    const ties = tiesByCompany.get(c.id) ?? [];
    const classes = ties.map((t) => String((t.props as Record<string, unknown>)?.tie_class ?? "")).filter(Boolean);
    const best = classes.sort((a, b) => (CLASS_RANK[a] ?? 9) - (CLASS_RANK[b] ?? 9))[0] ?? null;
    return {
      id: c.id,
      label: c.label,
      ico: str(props.ico),
      everQueried: queried.has(c.id),
      tieCount: ties.length,
      bestTieClass: best,
      classRank: best ? (CLASS_RANK[best] ?? 9) : 9,
      corroborations: [...new Set(ties.map((t) => String((t.props as Record<string, unknown>)?.corroboration ?? "?")))],
      mps: [...new Set(ties.map((t) => personById.get(t.src)?.label ?? t.src))],
      isOwnershipParent: parents.has(c.id),
      icoUnresolvable: props.ico_unresolvable_in_ares === true,
      reason: ties.length > 0 ? "MP-tied" : parents.has(c.id) ? "ownership parent" : "other",
    };
  });

  const unqueried = rows.filter((r) => !r.everQueried && r.ico && !r.icoUnresolvable);
  const skippedUnresolvable = rows.filter((r) => !r.everQueried && r.icoUnresolvable);
  const skippedNoIco = rows.filter((r) => !r.everQueried && !r.ico);

  // Rank: tie_class first (the case's rule), then tie count, then label for determinism.
  unqueried.sort((a, b) => a.classRank - b.classRank || b.tieCount - a.tieCount || a.label.localeCompare(b.label, "cs"));

  const tiedUnqueried = unqueried.filter((r) => r.tieCount > 0);
  console.log(`company nodes: ${rows.length}`);
  console.log(`  ever contract-queried (>=1 supplies edge): ${rows.filter((r) => r.everQueried).length}`);
  console.log(`  NEVER queried, queryable: ${unqueried.length}  (MP-tied ${tiedUnqueried.length}, parents/other ${unqueried.length - tiedUnqueried.length})`);
  console.log(`  skipped — IČO unresolvable in ARES: ${skippedUnresolvable.length}`);
  console.log(`  skipped — no IČO prop: ${skippedNoIco.length}`);

  const byClass = tiedUnqueried.reduce<Record<string, number>>((a, r) => ((a[r.bestTieClass ?? "?"] = (a[r.bestTieClass ?? "?"] ?? 0) + 1), a), {});
  console.log(`\nun-queried MP-tied companies by tie_class:`, byClass);

  console.log(`\n── SWEEP ORDER (owner-operator first — where money could reach an MP) ──`);
  for (const r of unqueried.slice(0, 60)) {
    console.log(
      `  [${(r.bestTieClass ?? r.reason).padEnd(14)}] ${r.ico} ${r.label.padEnd(44).slice(0, 44)} ` +
        `${r.tieCount ? `${r.tieCount} tie(s): ${r.mps.slice(0, 3).join(", ")}` : r.reason}`,
    );
  }

  await fs.writeFile(
    OUT,
    JSON.stringify(
      {
        batch: 10, track: "money", kind: "unqueried-company-population",
        generatedAt: new Date().toISOString().slice(0, 10),
        note:
          "The companies the money feed never asked Registr smluv about. Ranked by tie_class because that is the " +
          "case's attribution rule: money reaching an `owner-operator` company can plausibly reach the MP, while a " +
          "`steward` tie is a public-body board seat whose money is the body's own activity and is NEVER attributed " +
          "to the MP. Companies whose IČO does not resolve in ARES are EXCLUDED (they cannot be queried), not " +
          "counted as zero.",
        counts: {
          companies: rows.length,
          everQueried: rows.filter((r) => r.everQueried).length,
          unqueriedQueryable: unqueried.length,
          unqueriedMpTied: tiedUnqueried.length,
          byTieClass: byClass,
          skippedUnresolvableIco: skippedUnresolvable.length,
          skippedNoIco: skippedNoIco.length,
        },
        sweepOrder: unqueried,
        skipped: { unresolvableIco: skippedUnresolvable, noIco: skippedNoIco },
      },
      null, 2,
    ),
  );
  console.log(`\nwritten: ${OUT}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
