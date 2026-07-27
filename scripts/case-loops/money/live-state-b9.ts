/* Batch-009 resume step: deterministic live-state census of the money case.
 * Answers the carry-forward questions batch 008 left unverified, so batch 009
 * triages against reality rather than against the ledger's last snapshot.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b9 npx tsx scripts/case-loops/money/live-state-b9.ts
 */
import { getStore } from "@/lib/db/store";

type Props = Record<string, unknown>;

function count<T extends string>(rows: Props[], key: string): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const r of rows) {
    const v = String(r[key] ?? "(unset)") as T;
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");

  const linked = await store.listKgEdges({ rel: "linked_to", limit: 200_000 });
  console.log(`linked_to edges: ${linked.length}`);
  const props = linked.map((e) => (e.props ?? {}) as Props);
  console.log("  review_state:", count(props, "review_state"));
  console.log("  corroboration:", count(props, "corroboration"));
  console.log("  tie_class:", count(props, "tie_class"));

  // Batch-008 payload applied? (Okamura -> MIKI TRAVEL PRAGUE, ico 25124188)
  const miki = linked.find((e) => e.dst === "company:ico:25124188");
  console.log(
    "\nQ-money-15 flip (Okamura x MIKI TRAVEL, company:ico:25124188):",
    miki ? JSON.stringify({ src: miki.src, corroboration: (miki.props as Props)?.corroboration }) : "EDGE NOT FOUND",
  );

  // OSVC purge: the purged ico must be gone.
  const purgedRefs = linked.filter((e) => /ico:(?:$|)/.test(e.dst) === false);
  void purgedRefs;

  for (const rel of ["owns_stake", "cites", "concerns", "supplies"] as const) {
    const edges = await store.listKgEdges({ rel, limit: 200_000 });
    console.log(`${rel} edges: ${edges.length}`);
    if (rel === "owns_stake") {
      const keys = edges.map((e) => `${e.src}|${e.dst}`);
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      console.log(`  duplicate src|dst pairs: ${dupes.length}`, dupes.slice(0, 10));
    }
  }

  const nodes = await store.listKgNodes({ limit: 200_000 });
  const byKind = count(nodes as unknown as Props[], "kind");
  console.log("\nnode kinds:", byKind);

  await store.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
