/* Case ③ Layer 3 — law-change forensics orchestration.
 *
 *   --prepare [--limit=N]         build per-bill forensic CONTEXT for the flagged law
 *                                 changes (bill + amended laws + sponsor money ties +
 *                                 the PSP důvodová-zpráva URL + the known-law/id sets a
 *                                 verdict may cite). Written to .kg-analysis/forensic-
 *                                 targets.json for the analyst subagents to consume.
 *   --write --verdicts=<file>     ingest subagent LawForensicVerdicts: GATE each with
 *                                 validateLawVerdict (rejecting fabricated statutes /
 *                                 uncited claims), then read-merge the passing ones onto
 *                                 the bill node as pending_review forensic_* props.
 *
 * The LLM never authors a fact that isn't cited and gated; a finding is a LEAD for a
 * human, never a published verdict. The deterministic pieces are here; the judgment is
 * the subagent's, fenced by lib/analysis/law-verdict.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { validateLawVerdict, type LawForensicVerdict } from "@/lib/analysis/law-verdict";
import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const fmt = (n: number) => new Intl.NumberFormat("cs-CZ").format(Math.round(n));
const TARGETS = ".kg-analysis/forensic-targets.json";

/** Money summary per person from the stored Case-① edges. */
function moneyIndex(edges: KgEdgeRow[], companyLabel: Map<string, string>) {
  const companiesByPerson = new Map<number, Set<string>>();
  const czkByCompany = new Map<string, number>();
  for (const e of edges) {
    if (e.rel === "linked_to") {
      const m = /^psp:person:(\d+)$/.exec(e.src);
      if (m) (companiesByPerson.get(Number(m[1])) ?? companiesByPerson.set(Number(m[1]), new Set()).get(Number(m[1]))!).add(e.dst);
    } else if (e.rel === "supplies") {
      czkByCompany.set(e.src, (czkByCompany.get(e.src) ?? 0) + (typeof e.weight === "number" ? e.weight : 0));
    }
  }
  return (osobaId: number) => {
    const urns = [...(companiesByPerson.get(osobaId) ?? [])];
    return urns.map((u) => ({ ico: u.replace("company:ico:", ""), name: companyLabel.get(u) ?? u, contractCzk: Math.round(czkByCompany.get(u) ?? 0) }));
  };
}

async function prepare(nodes: KgNodeRow[], edges: KgEdgeRow[], persons: Map<number, string>, limit: number) {
  const companyLabel = new Map(nodes.filter((n) => n.kind === "company").map((n) => [n.id, n.label]));
  const contributionByPerson = new Map<number, number>();
  for (const n of nodes) {
    const m = n.kind === "person" && /^psp:person:(\d+)$/.exec(n.id);
    if (m && typeof n.props.contribution_score === "number") contributionByPerson.set(Number(m[1]), n.props.contribution_score);
  }
  const moneyOf = moneyIndex(edges, companyLabel);

  const flaggedBills = nodes
    .filter((n) => n.kind === "bill" && n.props.flagged_conflict === true)
    .sort((a, b) => Number(b.props.sponsor_contract_czk ?? 0) - Number(a.props.sponsor_contract_czk ?? 0))
    .slice(0, limit);

  const targets = flaggedBills.map((b) => {
    const cislo = Number(b.props.cislo);
    const sponsors = (b.props.sponsors as number[] | undefined) ?? [];
    const sponsorCtx = sponsors
      .map((osobaId) => ({ osobaId, name: persons.get(osobaId) ?? String(osobaId), contribution: contributionByPerson.get(osobaId) ?? null, companies: moneyOf(osobaId) }))
      .filter((s) => s.companies.length > 0); // the money-linked sponsors are the forensic subjects
    return {
      billTisk: cislo,
      billNodeId: b.id,
      title: b.label,
      origin: b.props.origin,
      amendedLaws: (b.props.amended_laws as string[] | undefined) ?? [],
      duvodovaZpravaUrl: `https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=${cislo}&ct1=0`,
      historyUrl: `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}`,
      moneyLinkedSponsors: sponsorCtx,
    };
  });

  // The reference sets a verdict may cite (anti-fabrication scope), shipped with the targets.
  const knownLawRefs = [...new Set(nodes.filter((n) => n.kind === "law").map((n) => String(n.props.ref)))];
  // Widened batch-001: ALL graph node ids are citable graph_facts (a truthful claim may cite a
  // bill/organ node — verdict-248 proved the narrower scope rejected a real id). Still a membership gate.
  const knownIds = nodes.map((n) => n.id);

  mkdirSync(".kg-analysis", { recursive: true });
  writeFileSync(TARGETS, JSON.stringify({ generated: "prepare", targets, knownLawRefs, knownIds }, null, 1));
  console.log(`prepared ${targets.length} forensic targets → ${TARGETS}\n`);
  for (const t of targets) {
    const s = t.moneyLinkedSponsors[0];
    console.log(`  tisk ${t.billTisk} · ${s?.name} (${s?.companies.length} co / ${fmt(s?.companies.reduce((a, c) => a + c.contractCzk, 0) ?? 0)} CZK) · amends ${t.amendedLaws.join(", ") || "—"}`);
    console.log(`      ${String(t.title).slice(0, 110)}`);
    console.log(`      důvodová zpráva: ${t.duvodovaZpravaUrl}`);
  }
}

async function write(store: NonNullable<Awaited<ReturnType<typeof getStore>>>, nodes: KgNodeRow[], verdictsFile: string) {
  const verdicts = JSON.parse(readFileSync(verdictsFile, "utf8")) as LawForensicVerdict[];
  const list = Array.isArray(verdicts) ? verdicts : [verdicts];
  // Anti-fabrication scope = graph law nodes ∪ the e-Sbírka registry of all real Czech
  // statutes (so a verdict may cite ANY real law, but a hallucinated number is rejected).
  const knownLawRefs = new Set(nodes.filter((n) => n.kind === "law").map((n) => String(n.props.ref)));
  try {
    const reg = JSON.parse(readFileSync(".data/esbirka/known-laws.json", "utf8")) as { refs: string[] };
    for (const r of reg.refs) knownLawRefs.add(r);
    console.log(`  (anti-fabrication scope: ${reg.refs.length.toLocaleString()} real statutes from e-Sbírka + graph laws)`);
  } catch {
    console.log("  (⚠ no e-Sbírka registry — gate scope limited to graph laws; run esbirka-laws.ts to widen it)");
  }
  // Widened batch-001: all graph node ids are citable graph_facts (see prepare()).
  const knownIds = new Set(nodes.map((n) => n.id));
  const billByCislo = new Map(nodes.filter((n) => n.kind === "bill").map((n) => [Number(n.props.cislo), n]));
  // Pass is assigned by the write-lock holder (kernel §Provenance); --pass overrides the computed default.
  const passFlag = Number(process.argv.find((a) => a.startsWith("--pass="))?.split("=")[1]);
  const pass = Number.isFinite(passFlag) && passFlag > 0 ? passFlag : Math.max(0, ...nodes.map((n) => n.firstSeenPass)) + 1;
  const computedAt = new Date().toISOString();

  const toWrite: KgNodeRow[] = [];
  for (const v of list) {
    const r = validateLawVerdict(v, { knownLawRefs, knownIds });
    if (!r.ok) {
      console.log(`  ✗ tisk ${v.billTisk}: verdict REJECTED (${r.errors.length} errors) — not written:`);
      r.errors.slice(0, 4).forEach((e) => console.log(`      • ${e}`));
      continue;
    }
    const bill = billByCislo.get(v.billTisk);
    if (!bill) {
      console.log(`  ! tisk ${v.billTisk}: no bill node — skipped`);
      continue;
    }
    console.log(`  ✓ tisk ${v.billTisk}: ${v.severity} · ${v.unstatedEffects.length} unstated effect(s) · ${v.citations.length} citations`);
    toWrite.push({
      ...bill,
      props: {
        ...bill.props,
        forensic_stated_reasoning: v.statedReasoning,
        forensic_researched_context: v.researchedContext,
        forensic_unstated_effects: v.unstatedEffects,
        forensic_conflict_assessment: v.conflictAssessment,
        forensic_severity: v.severity,
        forensic_confidence: v.confidence,
        forensic_citations: v.citations,
        forensic_review_state: "pending_review",
        forensic_provenance: { track: "law", pass, method: "verdict", ref: "law-forensics", computedAt },
      },
    });
  }
  if (flag("commit")) {
    const n = await store.upsertKgNodes(toWrite);
    console.log(`\nCOMMITTED: ${n} bill nodes enriched with pending_review forensic findings (pass ${pass}).`);
  } else {
    console.log(`\nDRY-RUN — ${toWrite.length} verdicts passed the gate and would be written. Add --commit to write.`);
  }
}

async function main() {
  const store = await getStore();
  if (!store) {
    console.error("no store");
    process.exit(1);
  }
  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();
  const persons = new Map((await store.listPersons()).map((p) => [p.pspId, p.nameFull]));

  if (flag("write")) {
    const f = arg("verdicts");
    if (!f) {
      console.error("--write requires --verdicts=<file>");
      process.exit(2);
    }
    await write(store, nodes, f);
  } else {
    await prepare(nodes, edges, persons, Number(arg("limit", "5")) || 5);
  }
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
