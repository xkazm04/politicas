/* Case ③ Law loop — batch-001 dossier context (batch cycle step 3 prep).
 *
 * READ-ONLY against the copy. For every ledger row with batch==1 it assembles the full
 * per-bill research context the army subagents consume: title, origin, amended laws (ref +
 * e-Sbírka title), sponsors (pspId → name), each sponsor's Case-① money ties (linked_to
 * companies ⋈ supplies contract CZK), formal committee routing (garanční + další), and the
 * psp.cz důvodová-zpráva / historie URLs. Also ships the anti-fabrication gate scope
 * (knownLawRefs = graph laws ∪ .data/esbirka/known-laws.json; knownIds = company/person/law urns).
 *
 *   PGLITE_PATH=./.pglite-copy-law npx tsx scripts/case-loops/law/prepare-batch.ts
 * → docs/data-analysis/case-law/payloads/batch-001-targets.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

const OUT = "docs/data-analysis/case-law/payloads/batch-001-targets.json";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");

  const ledger = JSON.parse(readFileSync("docs/data-analysis/case-law/ledger.json", "utf8")) as {
    rows: { tiskId: number; billNodeId: string; cislo: number | null; batch: number | null }[];
  };
  const batch = ledger.rows.filter((r) => r.batch === 1);

  const nodes = await store.listKgNodes();
  const edges = await store.listKgEdges();
  const persons = new Map((await store.listPersons()).map((p) => [p.pspId, p.nameFull]));
  const billById = new Map(nodes.filter((n) => n.kind === "bill").map((n) => [n.id, n]));
  const lawByRef = new Map(nodes.filter((n) => n.kind === "law").map((n) => [String((n.props as Record<string, unknown>).ref), n]));
  const companyLabel = new Map(nodes.filter((n) => n.kind === "company").map((n) => [n.id, n.label]));
  const organLabel = new Map(nodes.filter((n) => n.kind === "organ").map((n) => [n.id, n.label]));

  // money index: person → companies (linked_to) ; company → Σ contract CZK (supplies)
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

  // committee routing per bill
  const routingByBill = new Map<string, { organ: string; role: string; status: string; assignedOn: string | null }[]>();
  for (const e of edges) {
    if (e.rel !== "assigned_to") continue;
    const p = e.props as { role?: string; status?: string; assignedOn?: string | null };
    routingByBill.set(e.src, [
      ...(routingByBill.get(e.src) ?? []),
      { organ: organLabel.get(e.dst) ?? e.dst, role: p.role ?? "?", status: p.status ?? "?", assignedOn: p.assignedOn ?? null },
    ]);
  }

  const targets = batch.map((r) => {
    const b = billById.get(r.billNodeId)!;
    const p = (b.props ?? {}) as Record<string, unknown>;
    const cislo = typeof p.cislo === "number" ? p.cislo : r.cislo;
    const sponsorIds = Array.isArray(p.sponsors) ? (p.sponsors as number[]) : [];
    const amendedRefs = (Array.isArray(p.amended_laws) ? (p.amended_laws as string[]) : []).map((ref) => ({
      ref,
      urn: lawByRef.get(ref)?.id ?? `law:sb:${ref.replace("/", "-")}`,
      esbirkaTitle: (lawByRef.get(ref)?.props as Record<string, unknown> | undefined)?.esbirka_title ?? null,
      label: lawByRef.get(ref)?.label ?? null,
    }));
    const sponsors = sponsorIds.map((id) => ({
      pspId: id,
      name: persons.get(id) ?? `#${id}`,
      moneyTies: moneyOf(id).filter((c) => c.contractCzk > 0 || c.ico), // include all linked; CZK may be 0
    }));
    return {
      billTisk: cislo, // NOTE: verdict.billTisk MUST equal cislo (public print no.) — kg-forensics keys by cislo
      internalTiskId: r.tiskId,
      billNodeId: r.billNodeId,
      title: b.label,
      origin: p.origin,
      submitter: p.submitter ?? null,
      amendedLaws: amendedRefs,
      flaggedConflict: p.flagged_conflict === true,
      sponsorContractCzk: typeof p.sponsor_contract_czk === "number" ? p.sponsor_contract_czk : 0,
      sponsors,
      committeeRouting: routingByBill.get(r.billNodeId) ?? [],
      duvodovaZpravaUrl: `https://www.psp.cz/sqw/text/tiskt.sqw?o=10&ct=${cislo}&ct1=0`,
      historyUrl: `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}`,
    };
  });

  // anti-fabrication gate scope
  const knownLawRefs = new Set(nodes.filter((n) => n.kind === "law").map((n) => String((n.props as Record<string, unknown>).ref)));
  if (existsSync(".data/esbirka/known-laws.json")) {
    const reg = JSON.parse(readFileSync(".data/esbirka/known-laws.json", "utf8")) as { refs: string[] };
    for (const r of reg.refs) knownLawRefs.add(r);
  }
  const knownIds = nodes.filter((n) => n.kind === "company" || n.kind === "person" || n.kind === "law").map((n) => n.id);

  mkdirSync("docs/data-analysis/case-law/payloads", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), batch: 1, targets, gateScope: { knownLawRefsCount: knownLawRefs.size, knownIdsCount: knownIds.length }, knownLawRefs: [...knownLawRefs], knownIds }, null, 1));
  console.log(`prepared ${targets.length} batch-001 targets → ${OUT}`);
  for (const t of targets) {
    const moneySponsors = t.sponsors.filter((s) => s.moneyTies.some((m) => m.contractCzk > 0));
    console.log(`  tisk ${t.billTisk} · ${t.origin} · amends ${t.amendedLaws.map((a) => a.ref).join(",")} · ${t.sponsors.length} sponsors (${moneySponsors.length} w/ contract money) · gar ${t.committeeRouting.find((c) => c.role === "garancni")?.organ ?? "—"}`);
  }
  console.log(`\ngate scope: ${knownLawRefs.size} known law refs · ${knownIds.length} known ids`);
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
