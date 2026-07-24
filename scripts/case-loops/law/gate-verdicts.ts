/* Case ③ Law loop — the GATE (batch cycle step 4). Loads every army verdict JSON under
 * docs/data-analysis/case-law/payloads/verdicts/, and re-runs the law-verdict contract
 * (lib/analysis/law-verdict.ts → validateLawVerdict) against the graph copy:
 *   • schema shape,
 *   • every `č. N/RRRR Sb.` cited anywhere in prose = a REAL statute (graph laws ∪ e-Sbírka registry),
 *   • every graph_fact citation = a REAL company/person/law/bill/organ id in the graph,
 *   • every graph_fact citation's CLAIM stays within what the cited node's own props actually
 *     hold (batch-003 fix — the gap the batch-002 Opus audit found on verdict-11 but didn't fix:
 *     a graph_fact citing a company urn asserted the company's ownership/private-status, but
 *     company nodes never carry that as a prop — only {ico, subsidies_count,
 *     subsidies_total_czk}. That kind of claim must be `kind:"web"` with a URL, not `graph_fact`),
 *   • every unstated effect cited, every web/bill_text source a URL,
 *   • PLUS billTisk (public cislo) resolves to a real bill node (id-membership).
 * A verdict that fails is REPORTED and NOT counted — never persisted. This is also the
 * re-verify command the fleet orchestrator runs before writing to live .pglite.
 *
 * batch-003 also collapses the old --wide/canonical distinction into ONE gate scope. batch-002
 * left `gate-verdicts.ts` narrower (company/person/law only, canonical) than the live write-time
 * gate in `kg-forensics.ts` (already fully wide: company/person/law/bill/organ, since batch-001
 * commit 24bfdbf) — the --wide flag was a stop-gap widening. Since a verdict that only passes
 * --wide was ALWAYS going to be accepted at write time, "canonical" (narrow) no longer measures
 * anything meaningful. One scope now, matching kg-forensics.ts exactly.
 *
 *   PGLITE_PATH=./.pglite-copy-law npx tsx scripts/case-loops/law/gate-verdicts.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { validateLawVerdict } from "@/lib/analysis/law-verdict";
import { getStore } from "@/lib/db/store";
import type { KgNodeRow } from "@/lib/db/types";

const DIR = "docs/data-analysis/case-law/payloads/verdicts";

/** Keywords whose presence in a claim attached to a `graph_fact` company citation asserts
 * something company nodes NEVER carry as a prop (verified against the live schema: company
 * props are only {ico, subsidies_count, subsidies_total_czk} — no ownership, no sector, no
 * public/private classification). A claim using these words about a company is describing
 * WEB-researched substance, not a graph fact, and must be re-tagged `kind:"web"` with a URL. */
const OUT_OF_SCOPE_COMPANY_CLAIM_KEYWORDS: RegExp[] = [
  // ownership / control substance
  /vlastn\w*/i, // vlastní, vlastněn, vlastnictví
  /podíl\w*/i,
  /\bownership\b/i,
  /\bowned\b/i,
  /\bowns\b/i,
  // public/private/municipal status substance
  /soukrom\w*/i, // soukromý/á/é
  /veřejn\w*/i, // veřejný/á/é
  /\bstátní\b/i,
  /\bměst\w*/i, // město/městský — municipal
  /\bkraj\w*/i,
  /\bprivate\b/i,
  /\bpublic(ly)?\b/i,
  /\bmunicipal\b/i,
  /\bstate-owned\b/i,
];

/** Deterministic proxy for "does this graph_fact claim assert something beyond the cited node's
 * own props?" (batch-003). Only fires on `company:*` targets — the class where the gap was found
 * (verdict-11's CHOMUTOVSKÁ BYTOVÁ ownership claim, Hartenberg/IMOBA "genuinely private" claim).
 * person/law/bill/organ nodes carry enough varied structured prop data that a blanket keyword
 * net would false-positive too easily, so those stay unchecked here — a documented scope limit,
 * not a completeness claim. */
function citationScopeIssue(claim: string, sourceId: string, nodesById: Map<string, KgNodeRow>): string | null {
  if (!sourceId.startsWith("company:")) return null;
  if (!nodesById.has(sourceId)) return null; // id-membership check reports unknown ids separately
  for (const re of OUT_OF_SCOPE_COMPANY_CLAIM_KEYWORDS) {
    if (re.test(claim)) {
      return `graph_fact claim asserts ownership/public-private-status substance about ${sourceId} ("${claim.slice(0, 90)}${claim.length > 90 ? "…" : ""}") — company nodes only hold {ico, subsidies_count, subsidies_total_czk}, never ownership/status; re-tag as kind:"web" with a URL`;
    }
  }
  return null;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");
  const nodes = await store.listKgNodes();
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const knownLawRefs = new Set(nodes.filter((n) => n.kind === "law").map((n) => String((n.props as Record<string, unknown>).ref)));
  const graphLawCount = knownLawRefs.size;
  if (existsSync(".data/esbirka/known-laws.json")) {
    const reg = JSON.parse(readFileSync(".data/esbirka/known-laws.json", "utf8")) as { refs: string[] };
    for (const r of reg.refs) knownLawRefs.add(r);
  }
  // ONE gate scope (batch-003 — collapses the stale --wide/canonical split), matching the live
  // write-time gate in kg-forensics.ts exactly: graph_fact may cite company/person/law/bill/organ.
  const idKinds = ["company", "person", "law", "bill", "organ"];
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
  let scopeWarnings = 0;
  const summary: { file: string; tisk: number; ok: boolean; severity?: string; confidence?: number; effects?: number; citations?: number; errors: string[]; scopeIssues: string[] }[] = [];
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(DIR, f), "utf8"));
    const v = Array.isArray(raw) ? raw[0] : raw;
    const errors: string[] = [];
    const r = validateLawVerdict(v, { knownLawRefs, knownIds });
    if (!r.ok) errors.push(...r.errors);
    // id-membership: billTisk (cislo) must be a real bill node
    if (v && typeof v.billTisk === "number" && !billByCislo.has(v.billTisk)) errors.push(`billTisk ${v.billTisk} does not resolve to a bill node (cislo)`);

    // citation-scope check (batch-003) — WARNING, not a hard gate failure: this is a new,
    // deterministic-but-heuristic check and a false positive shouldn't silently block a
    // legitimate verdict from persisting. Reported prominently so a human/driver reviews it.
    const scopeIssues: string[] = [];
    if (Array.isArray(v?.citations)) {
      for (const c of v.citations) {
        if (c && c.kind === "graph_fact" && typeof c.claim === "string" && typeof c.source === "string") {
          const issue = citationScopeIssue(c.claim, c.source, nodesById);
          if (issue) scopeIssues.push(issue);
        }
      }
    }
    if (scopeIssues.length > 0) scopeWarnings++;

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
      scopeIssues,
    });
  }

  for (const s of summary) {
    console.log(
      `${s.ok ? "✓" : "✗"} ${s.file.padEnd(18)} tisk ${String(s.tisk).padStart(4)} · ${(s.severity ?? "?").padEnd(6)} · conf ${s.confidence ?? "?"} · ${s.effects ?? "?"} effects · ${s.citations ?? "?"} cites`,
    );
    for (const e of s.errors.slice(0, 6)) console.log(`     • ${e}`);
    for (const w of s.scopeIssues.slice(0, 6)) console.log(`     ⚠ SCOPE: ${w}`);
  }
  console.log(`\nGATE: ${pass}/${files.length} verdicts pass. ${pass === files.length ? "All clear — ready for kg-forensics --write." : "FIX or discard the failures before persist."}`);
  if (scopeWarnings > 0) console.log(`⚠ ${scopeWarnings}/${files.length} verdicts carry a citation-scope WARNING (graph_fact claim likely exceeds what the cited node's props hold) — review before persist, not a hard gate failure.`);
  await store.close();
  process.exit(pass === files.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
