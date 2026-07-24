/* Case ③ Law loop — the GATE (batch cycle step 4). Loads every army verdict JSON under
 * docs/data-analysis/case-law/payloads/verdicts/, and re-runs the law-verdict contract
 * (lib/analysis/law-verdict.ts → validateLawVerdict) against the graph copy:
 *   • schema shape,
 *   • every `č. N/RRRR Sb.` cited anywhere = a REAL statute (graph laws ∪ e-Sbírka registry),
 *   • every graph_fact citation = a REAL company/person/law id in the graph,
 *   • every unstated effect cited, every web/bill_text source a URL,
 *   • PLUS billTisk (public cislo) resolves to a real bill node (id-membership).
 * A verdict that fails is REPORTED and NOT counted — never persisted. This is also the
 * re-verify command the fleet orchestrator runs before writing to live .pglite.
 *
 *   PGLITE_PATH=./.pglite-copy-law npx tsx scripts/case-loops/law/gate-verdicts.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { validateLawVerdict } from "@/lib/analysis/law-verdict";
import { getStore } from "@/lib/db/store";

const DIR = "docs/data-analysis/case-law/payloads/verdicts";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");
  const nodes = await store.listKgNodes();

  const knownLawRefs = new Set(nodes.filter((n) => n.kind === "law").map((n) => String((n.props as Record<string, unknown>).ref)));
  const graphLawCount = knownLawRefs.size;
  if (existsSync(".data/esbirka/known-laws.json")) {
    const reg = JSON.parse(readFileSync(".data/esbirka/known-laws.json", "utf8")) as { refs: string[] };
    for (const r of reg.refs) knownLawRefs.add(r);
  }
  // Canonical gate scope (matches kg-forensics.ts): graph_fact may cite company/person/law ids.
  // --wide additionally admits bill/organ ids — a proposed widening so a truthful "this bill node
  // records zero sponsor ties" (graph_fact → bill urn) validates instead of falsely failing.
  const wide = process.argv.includes("--wide");
  const idKinds = wide ? ["company", "person", "law", "bill", "organ"] : ["company", "person", "law"];
  const knownIds = new Set(nodes.filter((n) => idKinds.includes(n.kind)).map((n) => n.id));
  const billByCislo = new Map(nodes.filter((n) => n.kind === "bill").map((n) => [Number((n.props as Record<string, unknown>).cislo), n.id]));

  console.log(`GATE scope: ${graphLawCount} graph laws + e-Sbírka registry = ${knownLawRefs.size} known law refs · ${knownIds.size} known ids · ${billByCislo.size} bills\n`);

  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")).sort() : [];
  if (files.length === 0) {
    console.log(`no verdicts in ${DIR}`);
    await store.close();
    return;
  }

  let pass = 0;
  const summary: { file: string; tisk: number; ok: boolean; severity?: string; confidence?: number; effects?: number; citations?: number; errors: string[] }[] = [];
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(DIR, f), "utf8"));
    const v = Array.isArray(raw) ? raw[0] : raw;
    const errors: string[] = [];
    const r = validateLawVerdict(v, { knownLawRefs, knownIds });
    if (!r.ok) errors.push(...r.errors);
    // id-membership: billTisk (cislo) must be a real bill node
    if (v && typeof v.billTisk === "number" && !billByCislo.has(v.billTisk)) errors.push(`billTisk ${v.billTisk} does not resolve to a bill node (cislo)`);
    const ok = errors.length === 0;
    if (ok) pass++;
    summary.push({
      file: f,
      tisk: v?.billTisk ?? -1,
      ok,
      severity: v?.severity,
      confidence: v?.confidence,
      effects: Array.isArray(v?.unstatedEffects) ? v.unstatedEffects.length : undefined,
      citations: Array.isArray(v?.citations) ? v.citations.length : undefined,
      errors,
    });
  }

  for (const s of summary) {
    console.log(
      `${s.ok ? "✓" : "✗"} ${s.file.padEnd(18)} tisk ${String(s.tisk).padStart(4)} · ${(s.severity ?? "?").padEnd(6)} · conf ${s.confidence ?? "?"} · ${s.effects ?? "?"} effects · ${s.citations ?? "?"} cites`,
    );
    for (const e of s.errors.slice(0, 6)) console.log(`     • ${e}`);
  }
  console.log(`\nGATE: ${pass}/${files.length} verdicts pass. ${pass === files.length ? "All clear — ready for kg-forensics --write." : "FIX or discard the failures before persist."}`);
  await store.close();
  process.exit(pass === files.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
