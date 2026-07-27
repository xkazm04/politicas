/* Batch 008 — deterministic backfill of `effort_rapporteur_load` on all 207
 * person nodes: the count of DISTINCT bills the MP holds a rapporteur edge for
 * (pass 34's zpravodaj assignments). Merge-preserving; no LLM.
 *
 *   PGLITE_PATH=./.pglite-copy-effort npx tsx scripts/case-loops/effort/rapporteur-load.ts            # dry-run
 *   npx tsx scripts/case-loops/effort/rapporteur-load.ts --commit --pass=36                            # live
 */
import { getStore } from "@/lib/db/store";
import type { KgNodeRow } from "@/lib/db/types";

const flag = (name: string) => process.argv.includes(`--${name}`);
function argOf(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main() {
  const commit = flag("commit");
  const store = await getStore();
  if (!store) throw new Error("no store");
  const persons = await store.listKgNodes({ kind: "person", limit: 1000 });
  const rapporteur = await store.listKgEdges({ rel: "rapporteur", limit: 100_000 });
  const pass = Number(argOf("pass")) || Math.max(0, ...persons.map((n) => n.firstSeenPass)) + 1;
  const provenance = { pass, method: "deterministic", ref: "rapporteur-edges", computedAt: new Date().toISOString() };

  const loadByPerson = new Map<string, Set<string>>();
  for (const e of rapporteur) {
    const s = loadByPerson.get(e.src) ?? new Set<string>();
    s.add(e.dst);
    loadByPerson.set(e.src, s);
  }

  const updates: KgNodeRow[] = persons.map((n) => ({
    ...n,
    props: {
      ...n.props,
      effort_rapporteur_load: loadByPerson.get(n.id)?.size ?? 0,
      rapporteur_load_provenance: provenance,
    },
  }));
  const nonzero = updates.filter((u) => (u.props.effort_rapporteur_load as number) > 0).length;
  const ge3 = updates.filter((u) => (u.props.effort_rapporteur_load as number) >= 3).length;
  console.log(`effort_rapporteur_load · ${updates.length} persons · nonzero ${nonzero} · ≥3 ${ge3} · ${commit ? "COMMIT" : "DRY-RUN"} · pass ${pass}`);
  if (commit) {
    const n = await store.upsertKgNodes(updates);
    console.log(`COMMITTED: ${n} nodes updated.`);
  }
  await store.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
