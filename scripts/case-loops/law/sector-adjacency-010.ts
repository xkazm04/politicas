/* Case ③ Law loop — batch-010: the sector-adjacency conflict signal is degenerate on the bills
 * that matter most, and this is the attributed replacement.
 *
 * THE DEFECT. `triage-core.ts` builds a bill's domain set from the UNION of its own title plus
 * EVERY amended law's ref and label, then flags a conflict when any sponsor's private company's
 * sector appears anywhere in that union. Before the batch-009 regeneration most bills carried 1–2
 * `amends` edges, so the union was small and the test meant something. After it, measured here:
 *
 *   amends   mean domains matched (of 10)
 *   0        0.73          title-only stays flat at ~0.6–0.75 across every bucket
 *   1–2      0.76
 *   3–5      1.66
 *   6–15     3.05
 *   16+      8.25   ← tisk 67 matches 8 of 10 sectors, tisk 77 matches 9 of 10
 *
 * A bill matching nine of ten sectors adjacency-matches essentially ANY sponsor company. That is
 * the kernel's own definition of a degenerate signal, and it explains the whole of the 5 → 12
 * growth the batch-009 re-triage reported: the topology grew, so the union grew, so the flag
 * fired more. It is NOT twelve conflicts of interest. This is the same failure batch-001 found in
 * `sponsor_contract_czk` (saturating on municipal/SOE roles) reappearing one layer up.
 *
 * THE FIX — attribution instead of union membership. A conflict claim is only meaningful if it
 * can name WHICH amended law puts the sponsor's company in the bill's path. So for each sponsor's
 * private company with sector S, this finds the specific amended law whose OWN label carries
 * domain S. No attributable law ⇒ no adjacency: the union match was an artifact of the bill's
 * breadth, not evidence about the sponsor.
 *
 * This is the law-level increment of the §-level rework deferred since batch-004. It does not
 * reach individual §s — that still needs the amended-§ census — but it removes the inflation,
 * and it makes every surviving flag legible: "company C is in sector S; this bill amends law L,
 * which is in sector S" rather than "S appears somewhere among 42 amended statutes".
 *
 *   PGLITE_PATH=./.pglite-copy-law-010 npx tsx scripts/case-loops/law/sector-adjacency-010.ts [--write]
 */
import { writeFileSync } from "node:fs";

import { getStore } from "@/lib/db/store";

import { isMunicipalOrSoe, sectorOf, type Sector } from "./company-sectors";
import { lawDomains } from "./triage-core";

const OUT = "docs/data-analysis/case-law/payloads/batch-010-sector-adjacency.json";
const WRITE = process.argv.includes("--write");

interface AttributedTie {
  company: string;
  sector: Sector;
  sponsor: string;
  /** The amended law whose OWN domain carries the company's sector. This is what makes the
   * claim checkable — without it "sector-adjacent" is unfalsifiable. */
  viaLaw: { ref: string; title: string } | null;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store — set PGLITE_PATH to the copy");

  const bills = await store.listKgNodes({ kind: "bill" });
  const laws = await store.listKgNodes({ kind: "law" });
  const amends = await store.listKgEdges({ rel: "amends" });
  const linked = await store.listKgEdges({ rel: "linked_to" });
  const companies = await store.listKgNodes({ kind: "company" });
  const persons = await store.listPersons();

  const lawById = new Map(laws.map((l) => [l.id, l]));
  const companyLabel = new Map(companies.map((c) => [c.id, c.label]));
  const personName = new Map(persons.map((p) => [p.pspId, p.nameFull]));

  const lawsByBill = new Map<string, string[]>();
  for (const e of amends) lawsByBill.set(e.src, [...(lawsByBill.get(e.src) ?? []), e.dst]);

  const companiesByPerson = new Map<number, { label: string }[]>();
  for (const e of linked) {
    const m = /^psp:person:(\d+)$/.exec(e.src);
    if (!m) continue;
    const id = Number(m[1]);
    companiesByPerson.set(id, [...(companiesByPerson.get(id) ?? []), { label: companyLabel.get(e.dst) ?? e.dst }]);
  }

  /** A law's own domain set, from its own label alone — never the union. */
  const domainsOfLaw = new Map<string, Set<Sector>>();
  for (const l of laws) domainsOfLaw.set(l.id, new Set(lawDomains(l.label)));

  const results = bills.map((b) => {
    const p = (b.props ?? {}) as Record<string, unknown>;
    const urns = lawsByBill.get(b.id) ?? [];
    const refs = urns.map((u) => String((lawById.get(u)?.props as Record<string, unknown>)?.ref ?? u));

    // OLD: union of title + every amended law's ref and label.
    const unionDomains = new Set(lawDomains([b.label, ...refs, ...urns.map((u) => lawById.get(u)?.label ?? "")].join(" ")));
    const titleDomains = new Set(lawDomains(b.label));

    const sponsorIds = Array.isArray(p.sponsors) ? (p.sponsors as number[]) : [];
    const oldHits: AttributedTie[] = [];
    const newHits: AttributedTie[] = [];

    for (const sid of sponsorIds) {
      for (const c of companiesByPerson.get(sid) ?? []) {
        if (isMunicipalOrSoe(c.label)) continue; // batch-001: municipal/SOE board roles saturate
        const sec = sectorOf(c.label);
        if (!sec) continue;
        const sponsor = personName.get(sid) ?? `#${sid}`;
        if (unionDomains.has(sec)) oldHits.push({ company: c.label, sector: sec, sponsor, viaLaw: null });

        // ATTRIBUTED: name the specific amended law, or the bill's own subject, that carries
        // this sector. Anything else is the bill's breadth, not a fact about the sponsor.
        const viaUrn = urns.find((u) => domainsOfLaw.get(u)?.has(sec));
        if (viaUrn) {
          const l = lawById.get(viaUrn);
          newHits.push({ company: c.label, sector: sec, sponsor, viaLaw: { ref: String((l?.props as Record<string, unknown>)?.ref ?? viaUrn), title: l?.label ?? "" } });
        } else if (titleDomains.has(sec)) {
          newHits.push({ company: c.label, sector: sec, sponsor, viaLaw: null }); // the bill's OWN subject
        }
      }
    }

    return {
      cislo: typeof p.cislo === "number" ? p.cislo : null,
      title: b.label,
      amendsCount: urns.length,
      unionDomainCount: unionDomains.size,
      titleDomainCount: titleDomains.size,
      oldAdjacency: oldHits.length > 0,
      newAdjacency: newHits.length > 0,
      attributed: newHits,
      droppedTies: oldHits.filter((o) => !newHits.some((n) => n.company === o.company)).map((o) => ({ company: o.company, sector: o.sector, sponsor: o.sponsor })),
    };
  });

  const oldFlagged = results.filter((r) => r.oldAdjacency);
  const newFlagged = results.filter((r) => r.newAdjacency);
  const survived = results.filter((r) => r.oldAdjacency && r.newAdjacency);
  const dropped = results.filter((r) => r.oldAdjacency && !r.newAdjacency);
  const gained = results.filter((r) => !r.oldAdjacency && r.newAdjacency);

  console.log(`Case ③ batch-010 · sector-adjacency, union vs attributed\n`);
  console.log(`  union-based (current triage) : ${oldFlagged.length} bills`);
  console.log(`  attributed (this pass)       : ${newFlagged.length} bills`);
  console.log(`  ├─ survived : ${survived.length}`);
  console.log(`  ├─ dropped  : ${dropped.length}  (the union matched, no amended law actually carries the sector)`);
  console.log(`  └─ gained   : ${gained.length}\n`);

  console.log(`Domain inflation by amends count (the reason the old signal broke):`);
  const buckets = new Map<string, { n: number; u: number; t: number }>();
  for (const r of results) {
    const k = r.amendsCount === 0 ? "0" : r.amendsCount <= 2 ? "1-2" : r.amendsCount <= 5 ? "3-5" : r.amendsCount <= 15 ? "6-15" : "16+";
    const b = buckets.get(k) ?? { n: 0, u: 0, t: 0 };
    b.n++;
    b.u += r.unionDomainCount;
    b.t += r.titleDomainCount;
    buckets.set(k, b);
  }
  for (const k of ["0", "1-2", "3-5", "6-15", "16+"]) {
    const b = buckets.get(k);
    if (!b) continue;
    console.log(`  amends ${k.padEnd(6)} bills ${String(b.n).padStart(3)}   union domains ${(b.u / b.n).toFixed(2)}   title-only ${(b.t / b.n).toFixed(2)}`);
  }

  console.log(`\nPer-bill verdict on the 12 union-flagged bills:`);
  for (const r of oldFlagged.sort((a, b) => b.amendsCount - a.amendsCount)) {
    console.log(`  tisk ${String(r.cislo).padStart(3)}  amends ${String(r.amendsCount).padStart(2)}  union domains ${String(r.unionDomainCount).padStart(2)}  →  ${r.newAdjacency ? "SURVIVES" : "DROPPED (inflation artifact)"}`);
    for (const a of r.attributed) console.log(`        ${a.company} (${a.sector}, ${a.sponsor}) via ${a.viaLaw ? `${a.viaLaw.ref} — ${a.viaLaw.title.slice(0, 60)}` : "the bill's own subject"}`);
    for (const d of r.droppedTies) console.log(`        dropped: ${d.company} (${d.sector}, ${d.sponsor}) — no amended law carries this sector`);
  }

  if (WRITE) {
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          finding:
            "The union-based sector-adjacency test is degenerate on high-amends bills. Mean domains matched rises 0.73 → 8.25 (of 10) from the 0-amends bucket to the 16+ bucket, while a title-only measure stays flat at ~0.6–0.75 across every bucket — so the growth is the union's breadth, not the bills' subject matter. tisk 77 matches 9 of 10 sectors and tisk 67 matches 8; at that width any sponsor company matches. The whole 5 → 12 rise the batch-009 re-triage reported is this artifact, not new conflict.",
          fix: "Attribution: a sponsor company's sector must be carried by a NAMED amended law's own label (or by the bill's own title), not merely appear somewhere in the union. Every surviving flag can state which law puts the sponsor in the bill's path.",
          scope:
            "This is the law-level increment of the §-level rework deferred since batch-004. It does not reach individual §s — that still needs an amended-§ census — but it removes the inflation and makes each flag checkable.",
          counts: { unionFlagged: oldFlagged.length, attributedFlagged: newFlagged.length, survived: survived.length, dropped: dropped.length, gained: gained.length },
          inflationByAmendsBucket: [...buckets.entries()].map(([bucket, b]) => ({ bucket, bills: b.n, meanUnionDomains: Number((b.u / b.n).toFixed(2)), meanTitleDomains: Number((b.t / b.n).toFixed(2)) })),
          bills: results.filter((r) => r.oldAdjacency || r.newAdjacency),
        },
        null,
        1,
      ),
    );
    console.log(`\n→ wrote ${OUT}`);
  }
  await store.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
