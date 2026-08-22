/* Case ③ Law loop — batch-011 input prep (batch cycle step 3 prep; solo run 2026-08-04).
 *
 * Two outputs, so the army never opens the single-connection DB copy:
 *   payloads/batch-011-targets.json          12 verdict targets — the audited triage head
 *     (top-9 pending by triageScoreV2 after batch-010's sector-adjacency audit) plus the
 *     three remaining attributed sector-adjacency survivors outside it (221, 103, 201).
 *     Carries per bill: props, sponsors + Case-① money ties, committee routing, the
 *     ATTRIBUTED sector leads from batch-010 (each names the statute that puts the sponsor
 *     in the bill's path), the Czech one-line summary, cached-text paths, and the
 *     anti-fabrication scope (knownLawRefs ∪ e-Sbírka registry, knownIds).
 *   payloads/batch-011-collision-queue.json  the top odstavecOverlap pairs of the 76-pair
 *     unread backlog (batch-009 sweep escalations minus the 7 pairs closed by the 68⊂90
 *     containment finding and anything already close-read), ranked by genuine-§ count.
 *
 *   PGLITE_PATH=./.pglite-copy-law-011 npx tsx scripts/case-loops/law/prepare-batch-011.ts
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getStore } from "@/lib/db/store";

const TARGET_CISLA = [64, 67, 7, 102, 213, 14, 189, 77, 154, 221, 103, 201];
const COLLISION_QUEUE_SIZE = 16;
const OUT_TARGETS = "docs/data-analysis/case-law/payloads/batch-011-targets.json";
const OUT_QUEUE = "docs/data-analysis/case-law/payloads/batch-011-collision-queue.json";

function cachedTexts(cislo: number): string[] {
  const dir = `.data/law-collision-cache/tisk-${cislo}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => join(dir, f));
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");

  const ledger = JSON.parse(readFileSync("docs/data-analysis/case-law/ledger.json", "utf8")) as {
    rows: {
      billNodeId: string;
      cislo: number | null;
      forensicState?: string;
      maxTargetChurn: number;
      triageScoreV2?: number;
      sectorAdjacency?: boolean;
    }[];
  };
  const rowByCislo = new Map(ledger.rows.filter((r) => r.cislo !== null).map((r) => [r.cislo as number, r]));

  const adjacency = JSON.parse(readFileSync("docs/data-analysis/case-law/payloads/batch-010-sector-adjacency.json", "utf8")) as {
    bills: { cislo: number; attributed: { company: string; sector: string; sponsor: string; viaLaw: { ref: string; title: string } }[] }[];
  };
  const attributedByCislo = new Map(adjacency.bills.map((b) => [b.cislo, b.attributed ?? []]));

  const summaries = JSON.parse(readFileSync("docs/data-analysis/case-law/payloads/bill-summaries-cz.json", "utf8")) as {
    rows: { cislo: number; summary: string; method: string }[];
  };
  const summaryByCislo = new Map(summaries.rows.map((r) => [r.cislo, { summary: r.summary, method: r.method }]));

  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();
  const persons = new Map((await store.listPersons()).map((p) => [p.pspId, p.nameFull]));
  const billById = new Map(nodes.filter((n) => n.kind === "bill").map((n) => [n.id, n]));
  const lawByRef = new Map(nodes.filter((n) => n.kind === "law").map((n) => [String((n.props as Record<string, unknown>).ref), n]));
  const companyLabel = new Map(nodes.filter((n) => n.kind === "company").map((n) => [n.id, n.label]));
  const organLabel = new Map(nodes.filter((n) => n.kind === "organ").map((n) => [n.id, n.label]));

  const companiesByPerson = new Map<number, Set<string>>();
  const czkByCompany = new Map<string, number>();
  for (const e of edges) {
    if (e.rel === "linked_to") {
      const m = /^psp:person:(\d+)$/.exec(e.src);
      if (m) {
        const id = Number(m[1]);
        if (!companiesByPerson.has(id)) companiesByPerson.set(id, new Set());
        companiesByPerson.get(id)!.add(e.dst);
      }
    } else if (e.rel === "supplies") {
      czkByCompany.set(e.src, (czkByCompany.get(e.src) ?? 0) + (typeof e.weight === "number" ? e.weight : 0));
    }
  }
  const moneyOf = (osobaId: number) =>
    [...(companiesByPerson.get(osobaId) ?? [])].map((u) => ({
      ico: u.replace("company:ico:", ""),
      name: companyLabel.get(u) ?? u,
      urn: u,
      contractCzk: Math.round(czkByCompany.get(u) ?? 0),
    }));

  // amended laws come from the REGENERATED `amends` edge topology (577 edges since pass 30),
  // never the bill's original `amended_laws` prop — that prop predates the census regen and
  // undercounts omnibus bills by two orders of magnitude (tisk 64: 1 prop ref vs 147 edges).
  const amendsByBill = new Map<string, string[]>();
  for (const e of edges) {
    if (e.rel !== "amends") continue;
    amendsByBill.set(e.src, [...(amendsByBill.get(e.src) ?? []), e.dst]);
  }
  const lawById = new Map(nodes.filter((n) => n.kind === "law").map((n) => [n.id, n]));

  const routingByBill = new Map<string, { organ: string; role: string; status: string; assignedOn: string | null }[]>();
  for (const e of edges) {
    if (e.rel !== "assigned_to") continue;
    const p = e.props as { role?: string; status?: string; assignedOn?: string | null };
    routingByBill.set(e.src, [
      ...(routingByBill.get(e.src) ?? []),
      { organ: organLabel.get(e.dst) ?? e.dst, role: p.role ?? "?", status: p.status ?? "?", assignedOn: p.assignedOn ?? null },
    ]);
  }

  const targets = TARGET_CISLA.map((cislo) => {
    const r = rowByCislo.get(cislo);
    if (!r) throw new Error(`tisk ${cislo}: no ledger row`);
    if (r.forensicState) throw new Error(`tisk ${cislo}: already carries a verdict (${r.forensicState}) — head selection is stale`);
    const b = billById.get(r.billNodeId);
    if (!b) throw new Error(`tisk ${cislo}: bill node ${r.billNodeId} not in graph`);
    const p = (b.props ?? {}) as Record<string, unknown>;
    const sponsorIds = Array.isArray(p.sponsors) ? (p.sponsors as number[]) : [];
    const amendedRefs = (amendsByBill.get(b.id) ?? []).map((lawId) => {
      const law = lawById.get(lawId);
      const lp = (law?.props ?? {}) as Record<string, unknown>;
      return { ref: String(lp.ref ?? lawId), urn: lawId, label: law?.label ?? null };
    });
    return {
      billTisk: cislo,
      billNodeId: b.id,
      title: b.label,
      origin: p.origin,
      submitter: p.submitter ?? null,
      summary: summaryByCislo.get(cislo) ?? null,
      amendedLaws: amendedRefs,
      amendsCount: amendedRefs.length,
      maxTargetChurn: r.maxTargetChurn,
      triageScoreV2: r.triageScoreV2 ?? null,
      sectorAdjacency: r.sectorAdjacency === true,
      attributedSectorLeads: attributedByCislo.get(cislo) ?? [],
      sponsors: sponsorIds.map((id) => ({ pspId: id, name: persons.get(id) ?? `#${id}`, moneyTies: moneyOf(id) })),
      committeeRouting: routingByBill.get(r.billNodeId) ?? [],
      cachedTexts: cachedTexts(cislo),
      duvodovaZpravaUrl: `https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=${cislo}&ct1=0`,
      historyUrl: `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}`,
    };
  });

  const knownLawRefs = new Set(nodes.filter((n) => n.kind === "law").map((n) => String((n.props as Record<string, unknown>).ref)));
  if (existsSync(".data/esbirka/known-laws.json")) {
    const reg = JSON.parse(readFileSync(".data/esbirka/known-laws.json", "utf8")) as { refs: string[] };
    for (const r of reg.refs) knownLawRefs.add(r);
  }
  const knownIds = nodes.filter((n) => ["company", "person", "law", "bill", "organ"].includes(n.kind)).map((n) => n.id);

  writeFileSync(
    OUT_TARGETS,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), batch: 11, targets, gateScope: { knownLawRefsCount: knownLawRefs.size, knownIdsCount: knownIds.length }, knownLawRefs: [...knownLawRefs], knownIds },
      null,
      1,
    ),
  );
  console.log(`prepared ${targets.length} batch-011 verdict targets → ${OUT_TARGETS}`);
  for (const t of targets)
    console.log(
      `  tisk ${String(t.billTisk).padStart(3)} · score ${t.triageScoreV2} · amends ${t.amendsCount} · sectorLeads ${t.attributedSectorLeads.length} · texts ${t.cachedTexts.length} · ${String(t.title).slice(0, 70)}`,
    );

  // ---- collision queue ----
  const sweep = JSON.parse(readFileSync("docs/data-analysis/case-law/payloads/batch-009-collision-sweep.json", "utf8")) as {
    escalate: { lawRef: string; billA: number; billB: number; genuineParagraphs: string[]; odstavecOverlap: string[] | boolean; reason: string }[];
  };
  // pairs closed by the 68⊂90 containment finding (batch-009 §5b) — one fact, not eight findings
  const closedDuplicate = (a: number, b: number) => (a === 68 && b === 90) || (a === 90 && b === 68);
  // pairs already close-read anywhere in the published corpus
  const readPairs = new Set<string>();
  const payloadDir = "docs/data-analysis/case-law/payloads";
  for (const f of readdirSync(payloadDir).filter((f) => f.startsWith("collision-close-reads") && f.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(join(payloadDir, f), "utf8")) as Record<string, unknown>;
    const pairs = (Array.isArray(raw.pairs) ? raw.pairs : Array.isArray(raw.closeReads) ? raw.closeReads : []) as { billA?: number; billB?: number; lawRef?: string }[];
    for (const p of pairs) if (typeof p.billA === "number" && typeof p.billB === "number") readPairs.add(`${p.lawRef ?? "?"}::${Math.min(p.billA, p.billB)}-${Math.max(p.billA, p.billB)}`);
  }
  const queue = sweep.escalate
    .filter((p) => !closedDuplicate(p.billA, p.billB))
    .filter((p) => !readPairs.has(`${p.lawRef}::${Math.min(p.billA, p.billB)}-${Math.max(p.billA, p.billB)}`))
    .sort((a, b) => b.genuineParagraphs.length - a.genuineParagraphs.length)
    .slice(0, COLLISION_QUEUE_SIZE)
    .map((p) => ({
      ...p,
      lawTitle: lawByRef.get(p.lawRef)?.label ?? null,
      cachedTextsA: cachedTexts(p.billA),
      cachedTextsB: cachedTexts(p.billB),
    }));
  const remaining = sweep.escalate.filter((p) => !closedDuplicate(p.billA, p.billB)).filter((p) => !readPairs.has(`${p.lawRef}::${Math.min(p.billA, p.billB)}-${Math.max(p.billA, p.billB)}`)).length;
  writeFileSync(OUT_QUEUE, JSON.stringify({ generatedAt: new Date().toISOString(), batch: 11, backlogRemaining: remaining, queued: queue.length, pairs: queue }, null, 1));
  console.log(`\ncollision queue: ${queue.length} of ${remaining} unread pairs → ${OUT_QUEUE}`);
  for (const q of queue) console.log(`  ${q.lawRef} · ${q.billA}×${q.billB} · genuine §§ ${q.genuineParagraphs.join(",")}`);

  await store.close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
