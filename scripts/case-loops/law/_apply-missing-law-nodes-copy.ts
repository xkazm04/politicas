/* batch-005 working script — applies batch-005-missing-law-nodes.json's resolved node payloads
 * to the WORKING COPY only (.pglite-copy-law-005). Never point PGLITE_PATH at the live ./.pglite
 * with this script — fleet mode: analysis on a copy, orchestrator serializes the live write.
 *
 *   PGLITE_PATH=./.pglite-copy-law-005 npx tsx scripts/case-loops/law/_apply-missing-law-nodes-copy.ts
 */
import { readFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

const IN = "docs/data-analysis/case-law/payloads/batch-005-missing-law-nodes.json";

async function main() {
  // batch-005 D10 fix (Opus audit): resolve to an absolute path before comparing, so a
  // differently-spelled-but-identical live path (no "./" prefix, no trailing slash, an absolute
  // form) can't slip past a plain string check.
  const path = await import("node:path");
  const live = path.resolve("./.pglite");
  const target = process.env.PGLITE_PATH ? path.resolve(process.env.PGLITE_PATH) : "";
  if (!target || target === live) {
    throw new Error(`refusing to run without PGLITE_PATH pointed at a copy (fleet rule: never write live) — resolved target was "${target || "(unset)"}", live is "${live}"`);
  }
  const store = await getStore();
  if (!store) throw new Error("no store");
  const payload = JSON.parse(readFileSync(IN, "utf8")) as {
    resolved: { id: string; kind: "law"; label: string; props: Record<string, unknown>; provenance: Record<string, unknown> }[];
  };

  const existing = await store.listKgNodes({ kind: "law" });
  const existingIds = new Set(existing.map((n) => n.id));
  const dup = payload.resolved.filter((n) => existingIds.has(n.id));
  if (dup.length > 0) {
    console.log(`WARNING: ${dup.length} node ids already exist in this copy — upsert will overwrite, not duplicate:`, dup.map((d) => d.id));
  }

  // batch-005 D5 fix (Opus audit): the invented "firstSeenPass: 21" is gone — pass assignment is
  // the write-lock holder's job at finalize time (kernel: "Pass numbers are assigned at finalize
  // time by whoever holds the write lock, in write order"). This copy-apply script computes the
  // NEXT integer after the current max as a clearly-provisional placeholder for testing the apply
  // path end-to-end; the orchestrator's real apply must assign the actual next pass number itself
  // (the number the money/effort loops' concurrent passes will have already claimed by then).
  const allNodes = await store.listKgNodes();
  const maxPass = allNodes.reduce((m, n) => Math.max(m, n.firstSeenPass ?? 0), 0);
  const provisionalPass = maxPass + 1;
  console.log(`provisional firstSeenPass for this copy-only test apply: ${provisionalPass} (max seen: ${maxPass}) — orchestrator assigns the REAL pass number at live finalize time`);

  const rows = payload.resolved.map((n) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    props: n.props,
    firstSeenPass: provisionalPass,
    provenance: { ...n.provenance, pass: provisionalPass },
  }));
  const w = await store.upsertKgNodes(rows as never);
  console.log(`applied ${w} law nodes to ${process.env.PGLITE_PATH}`);

  const after = await store.listKgNodes({ kind: "law" });
  console.log(`law nodes now: ${after.length} (was ${existing.length})`);
  await store.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
