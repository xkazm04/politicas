/* F15 — formal per-bill committee routing. Upgrades F12's name-based committee remit
 * (`owns`: organ → theme) to the FORMAL assignment of each print to its committees, read
 * from psp.cz tisky.zip → hist_vybory.unl (⋈ hist.unl for dates). Emits:
 *
 *   assigned_to  edges  bill:tisk:<id> → psp:organ:<organId>
 *     props {role: "garancni"|"dalsi", status: "prikazano"|"navrzeno"|"iniciativne", assignedOn}
 *     provenance {pass: 12, method: "deterministic", ref: "F15"}
 *
 * Only the 141 bills + 33 organs ALREADY in the graph get edges — an assignment pointing
 * outside the graph is dropped and counted, never invented. After the write it prints the
 * per-committee distribution, the bills with no assignment (honest gap — a young term), and
 * how the formal garanční committee compares to F12's heuristic `owns` remit.
 *
 *   npx tsx scripts/data-analysis/kg-committee-routing.ts            # dry-run
 *   npx tsx scripts/data-analysis/kg-committee-routing.ts --commit   # write
 * Flags: --commit  --pass=N  --refetch
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeCommitteeRouting, type CommitteeAssignment } from "@/lib/ingest/sources/psp-legislation";
import { getStore } from "@/lib/db/store";
import type { KgEdgeRow } from "@/lib/db/types";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const CACHE_DIR = process.env.PSP_CACHE_DIR || "./.data/psp";
const PSP_BASE = "https://www.psp.cz/eknih/cdrom/opendata";
const UA = "politicas-ingest/0.1 (+https://www.psp.cz/sqw/hp.sqw?k=1300; open-data mirror)";
async function getDump(fileName: string, refetch: boolean): Promise<Uint8Array | null> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, fileName);
  if (!refetch && existsSync(path)) return new Uint8Array(readFileSync(path));
  try {
    const res = await fetch(`${PSP_BASE}/${fileName}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(180_000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    writeFileSync(path, bytes);
    return bytes;
  } catch (e) {
    console.warn(`  [getDump ${fileName}] ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

const billUrn = (tiskId: number) => `bill:tisk:${tiskId}`;
const organUrn = (organId: number) => `psp:organ:${organId}`;

async function main() {
  const commit = flag("commit");
  const store = await getStore();
  if (!store) {
    console.error("no store configured");
    process.exit(1);
  }

  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();
  const billIds = new Set(nodes.filter((n) => n.kind === "bill").map((n) => n.id));
  const organNodes = nodes.filter((n) => n.kind === "organ");
  const organIds = new Set(organNodes.map((n) => n.id));
  const organLabel = new Map(organNodes.map((n) => [n.id, n.label]));

  // F12 heuristic remit — the committees that own ≥1 theme, and the themes each owns.
  const ownsThemes = new Map<string, string[]>();
  for (const e of edges) {
    if (e.rel !== "owns") continue;
    ownsThemes.set(e.src, [...(ownsThemes.get(e.src) ?? []), e.dst.replace(/^theme:/, "")]);
  }

  console.log(`F15 committee routing · ${commit ? "COMMIT" : "DRY-RUN"} · graph has ${billIds.size} bills, ${organIds.size} organs`);
  console.log("psp.cz tisky.zip…");
  const tiskyZip = await getDump("tisky.zip", flag("refetch"));
  if (!tiskyZip) {
    console.error("could not fetch tisky.zip");
    process.exit(1);
  }

  const all: CommitteeAssignment[] = normalizeCommitteeRouting(tiskyZip);
  const pass = Number(arg("pass")) || 12;
  const computedAt = new Date().toISOString();
  const provenance = { track: "law", pass, method: "deterministic", ref: "F15", computedAt };

  // GATE: only (bill, organ) pairs where BOTH endpoints are real graph nodes become edges.
  let droppedBill = 0;
  let droppedOrgan = 0;
  const edgeRows: KgEdgeRow[] = [];
  for (const a of all) {
    const src = billUrn(a.tiskId);
    const dst = organUrn(a.organId);
    if (!billIds.has(src)) {
      droppedBill++;
      continue;
    }
    if (!organIds.has(dst)) {
      droppedOrgan++;
      continue;
    }
    edgeRows.push({
      src,
      rel: "assigned_to",
      dst,
      weight: null,
      props: { role: a.role, status: a.status, assignedOn: a.assignedOn },
      provenance,
    });
  }

  const coveredBills = new Set(edgeRows.map((e) => e.src));
  const missing = [...billIds].filter((b) => !coveredBills.has(b)).sort();
  const roleCount = { garancni: 0, dalsi: 0 };
  const statusCount: Record<string, number> = {};
  for (const e of edgeRows) {
    const p = e.props as { role: "garancni" | "dalsi"; status: string };
    roleCount[p.role]++;
    statusCount[p.status] = (statusCount[p.status] ?? 0) + 1;
  }

  console.log(
    `\n→ ${edgeRows.length} assigned_to edges over ${coveredBills.size}/${billIds.size} bills ` +
      `(${missing.length} with no assignment). Dropped out-of-graph: ${droppedBill} bill-side, ${droppedOrgan} organ-side.`,
  );
  console.log(`  role: garancni ${roleCount.garancni} · dalsi ${roleCount.dalsi}`);
  console.log(`  status: ${Object.entries(statusCount).map(([k, n]) => `${k} ${n}`).join(" · ")}`);

  // Per-committee distribution.
  const perCom = new Map<string, { gar: number; dalsi: number }>();
  for (const e of edgeRows) {
    const c = perCom.get(e.dst) ?? { gar: 0, dalsi: 0 };
    if ((e.props as { role: string }).role === "garancni") c.gar++;
    else c.dalsi++;
    perCom.set(e.dst, c);
  }
  console.log(`\nPER-COMMITTEE (garanční / další · total):`);
  for (const [dst, c] of [...perCom].sort((a, b) => b[1].gar + b[1].dalsi - (a[1].gar + a[1].dalsi))) {
    console.log(`  ${(organLabel.get(dst) ?? dst).padEnd(10)} gar ${String(c.gar).padStart(3)} · dalsi ${String(c.dalsi).padStart(3)} · total ${c.gar + c.dalsi}`);
  }

  // Formal-routing vs heuristic `owns`: do the committees that actually receive garanční
  // bills also carry an F12 remit? A mismatch is an honest F12 taxonomy gap, not a bug.
  const garCommittees = new Set(edgeRows.filter((e) => (e.props as { role: string }).role === "garancni").map((e) => e.dst));
  console.log(`\nFORMAL garanční vs F12 owns remit (${garCommittees.size} committees receive ≥1 garanční bill):`);
  for (const dst of [...garCommittees].sort()) {
    const themes = ownsThemes.get(dst);
    const gar = perCom.get(dst)?.gar ?? 0;
    console.log(
      `  ${(organLabel.get(dst) ?? dst).padEnd(10)} ${String(gar).padStart(3)} garanční bills → ` +
        (themes ? `owns [${themes.join(", ")}]` : `NO owns edge — F12 taxonomy gap`),
    );
  }
  const noOwns = [...garCommittees].filter((c) => !ownsThemes.has(c));
  console.log(`  agreement: ${garCommittees.size - noOwns.length}/${garCommittees.size} garanční committees have an F12 owns remit` + (noOwns.length ? `; gap: ${noOwns.map((c) => organLabel.get(c) ?? c).join(", ")}` : ""));

  if (missing.length) console.log(`\nbills with NO committee assignment (${missing.length}): ${missing.join(", ")}`);

  if (commit) {
    const n = await store.upsertKgEdges(edgeRows);
    console.log(`\nCOMMITTED: ${n} assigned_to edges (pass ${pass}).`);
  } else {
    console.log(`\nDRY-RUN — would write ${edgeRows.length} assigned_to edges (pass ${pass}). Re-run with --commit.`);
  }
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
