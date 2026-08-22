/* Case ③ Law loop — batch-002 dossier context (batch cycle step 3 prep). Same pattern as
 * prepare-batch.ts (batch-001) but reads batch==2 rows from the re-weighted triage-002
 * ledger and adds the sector-adjacency + collision-candidate context batch-002 needs.
 *
 *   PGLITE_PATH=./.pglite-copy-law npx tsx scripts/case-loops/law/prepare-batch-002.ts
 * → docs/data-analysis/case-law/payloads/batch-002-targets.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

const OUT = "docs/data-analysis/case-law/payloads/batch-002-targets.json";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");

  const ledger = JSON.parse(readFileSync("docs/data-analysis/case-law/ledger.json", "utf8")) as {
    rows: {
      tiskId: number;
      billNodeId: string;
      cislo: number | null;
      batch: number | null;
      sectorAdjacentCompanies?: { company: string; sector: string; sponsor: string }[];
      municipalExcludedCompanies?: string[];
      maxTargetChurn: number;
    }[];
  };
  const batch = ledger.rows.filter((r) => r.batch === 2);

  const collisionGroups = JSON.parse(readFileSync("docs/data-analysis/case-law/payloads/collision-groups.json", "utf8")) as {
    groups: { lawRef: string; bills: number[] }[];
  };

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
      moneyTies: moneyOf(id),
    }));
    // sibling collision candidates: other PENDING/batch bills sharing an amended law
    const siblingGroups = collisionGroups.groups.filter((g) => amendedRefs.some((a) => a.ref === g.lawRef));
    return {
      billTisk: cislo,
      internalTiskId: r.tiskId,
      billNodeId: r.billNodeId,
      title: b.label,
      origin: p.origin,
      submitter: p.submitter ?? null,
      amendedLaws: amendedRefs,
      maxTargetChurn: r.maxTargetChurn,
      sectorAdjacentCompanies: r.sectorAdjacentCompanies ?? [],
      municipalExcludedCompanies: r.municipalExcludedCompanies ?? [],
      sponsors,
      committeeRouting: routingByBill.get(r.billNodeId) ?? [],
      siblingCollisionGroups: siblingGroups.map((g) => ({ lawRef: g.lawRef, otherBills: g.bills.filter((c) => c !== cislo) })),
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

  mkdirSync("docs/data-analysis/case-law/payloads", { recursive: true });
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), batch: 2, targets, gateScope: { knownLawRefsCount: knownLawRefs.size, knownIdsCount: knownIds.length }, knownLawRefs: [...knownLawRefs], knownIds }, null, 1));
  console.log(`prepared ${targets.length} batch-002 targets → ${OUT}`);
  for (const t of targets) {
    console.log(`  tisk ${t.billTisk} · ${t.origin} · amends ${t.amendedLaws.map((a) => a.ref).join(",")} · churn ${t.maxTargetChurn} · sectorAdj ${t.sectorAdjacentCompanies.length} · siblingGroups ${t.siblingCollisionGroups.length} · gar ${t.committeeRouting.find((c) => c.role === "garancni")?.organ ?? "—"}`);
  }
  await store.close();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
