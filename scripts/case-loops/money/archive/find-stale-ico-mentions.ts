/* Money loop — batch 005, Q-money-13: locate stale prop-CONTENT mentions of the
 * purged bogus company IČO 04627695 ("OSVČ" false-edge purge, batch 004 —
 * see purge-osvc.ts header). A structural edge/node check can't see prose/JSON
 * text inside `props` — this script greps every kg_node's props for the literal
 * IČO string and reports node id / kind / prop key / surrounding text.
 *
 * READ-ONLY. Never writes to the store. Run against a COPY, never live ./.pglite:
 *
 *   PGLITE_PATH=./.pglite-copy-money-q13 npx tsx scripts/case-loops/money/find-stale-ico-mentions.ts
 */
import { getStore } from "@/lib/db/store";

const TARGET_ICO = "04627695";

async function main() {
  const store = await getStore();
  if (!store) {
    console.error("no store configured (set PGLITE_PATH to a copy/fixture — never the live ./.pglite)");
    process.exit(1);
  }

  const nodes = await store.listKgNodes({ limit: 2_000_000 });
  console.log(`scanned ${nodes.length} kg_node rows for "${TARGET_ICO}"\n`);

  const hits: { nodeId: string; nodeKind: string; propKey: string; entryIndex: number | null; value: unknown }[] = [];

  for (const n of nodes) {
    const props = (n.props ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(props)) {
      if (Array.isArray(value)) {
        // drill into array entries — only report the sub-entry(ies) that actually match
        value.forEach((entry, i) => {
          const s = typeof entry === "string" ? entry : JSON.stringify(entry);
          if (s && s.includes(TARGET_ICO)) {
            hits.push({ nodeId: n.id, nodeKind: n.kind, propKey: key, entryIndex: i, value: entry });
          }
        });
      } else {
        const s = typeof value === "string" ? value : JSON.stringify(value);
        if (s && s.includes(TARGET_ICO)) {
          hits.push({ nodeId: n.id, nodeKind: n.kind, propKey: key, entryIndex: null, value });
        }
      }
    }
  }

  console.log(`=== ${hits.length} hit(s) ===\n`);
  for (const h of hits) {
    console.log(
      `node: ${h.nodeId}  kind: ${h.nodeKind}  propKey: ${h.propKey}` +
        (h.entryIndex !== null ? `[${h.entryIndex}]` : ""),
    );
    console.log(`  value: ${typeof h.value === "string" ? h.value : JSON.stringify(h.value)}`);
    console.log("");
  }

  const byKind: Record<string, number> = {};
  for (const h of hits) byKind[h.nodeKind] = (byKind[h.nodeKind] ?? 0) + 1;
  console.log("by kind:", byKind);
  console.log("distinct nodes:", new Set(hits.map((h) => h.nodeId)).size);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
