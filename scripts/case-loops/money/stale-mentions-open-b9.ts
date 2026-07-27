/* Money loop — batch 009, Q-money-13 status: which mentions of the purged OSVČ IČO
 * (04627695) still lack a closure note, itemized for the OWNING case to fix.
 *
 * Batch 005 prepared closure annotations for 26 mentions; this measures what actually
 * landed. A mention "carries closure" when its text says, in any form, that the tie was
 * removed / mismatched / unrelated / closed — the wording the batch-005 annotations use.
 * Bare citation URLs carry no prose and therefore never pass, which is the point: a
 * source link left attached to a retracted claim is exactly the residue to clean.
 *
 *   npx tsx scripts/case-loops/money/stale-mentions-open-b9.ts
 */
import { getStore } from "@/lib/db/store";

const PURGED_ICO = "04627695";
const CLOSURE_RE = /odstran|smazán|smazan|false.?edge|false positive|nesouvis|vyloučen|vylouc|uzavřen|uzavren|chybn/i;
const OUT = "docs/data-analysis/case-money/qmoney-stale-mentions-open-b9.json";

/** Walk a jsonb prop value, yielding [propPath, stringValue] for every string leaf. */
function* strings(value: unknown, path: string): Generator<[string, string]> {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* strings(value[i], `${path}[${i}]`);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) yield* strings(v, `${path}.${k}`);
}

/** Which case owns a prop namespace — so the open items land on the right driver. */
function owner(propKey: string): "effort" | "law" | "money" | "unknown" {
  if (propKey.startsWith("effort")) return "effort";
  if (propKey.startsWith("forensic")) return "law";
  if (propKey.startsWith("corroboration") || propKey.startsWith("money")) return "money";
  return "unknown";
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const fs = await import("node:fs/promises");
  const nodes = await store.listKgNodes({ limit: 200_000 });
  await store.close();

  const open: { nodeId: string; kind: string; propKey: string; owner: string; value: string }[] = [];
  let total = 0;
  for (const n of nodes) {
    for (const [propKey, value] of strings(n.props ?? {}, "")) {
      if (!value.includes(PURGED_ICO)) continue;
      total++;
      if (CLOSURE_RE.test(value)) continue;
      const key = propKey.replace(/^\./, "");
      open.push({ nodeId: n.id, kind: n.kind, propKey: key, owner: owner(key), value: value.slice(0, 400) });
    }
  }

  const byOwner = open.reduce<Record<string, number>>((a, o) => ((a[o.owner] = (a[o.owner] ?? 0) + 1), a), {});
  console.log(`mentions of ${PURGED_ICO}: ${total} · carrying closure wording: ${total - open.length} · OPEN: ${open.length}`);
  console.log(`open by owning case:`, byOwner);
  for (const o of open) console.log(`  [${o.owner}] ${o.nodeId} · ${o.propKey}`);

  await fs.writeFile(
    OUT,
    JSON.stringify(
      {
        batch: 9,
        track: "money",
        item: "Q-money-13",
        kind: "purged-ico-mention-residue",
        generatedAt: new Date().toISOString().slice(0, 10),
        purgedIco: PURGED_ICO,
        note:
          "Mentions of the purged OSVČ IČO that still carry NO closure wording. Recorded, not edited: these props " +
          "are sibling-owned analyst prose and citation arrays (effort/law), and money does not rewrite another " +
          "case's verdict text. Bare citation URLs are the largest class — a source link left attached to a " +
          "retracted claim.",
        counts: { totalMentions: total, withClosure: total - open.length, open: open.length, byOwner },
        open,
      },
      null,
      2,
    ),
  );
  console.log(`\nwritten: ${OUT}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
