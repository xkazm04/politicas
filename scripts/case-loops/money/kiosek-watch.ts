/* Money loop — batch 008, item 4: kiosek as the money WATCH channel.
 *
 * Batch 006's recalibration established kiosek's IČOs are a DISJOINT population from our
 * tied companies (0/23 matched at the time) — it is a MONITORING source, not an enrichment
 * source. This script is the repeatable check that watch implies: does ANY court-notice
 * (`notice` node, IČO reached via a `concerns` edge OR embedded in the notice's own props)
 * match a company IČO this case's `linked_to` graph already ties to an MP?
 *
 * Read-only. No graph writes, no review_state touched. Designed to be re-run every batch
 * (or whenever kiosek ingests a new slice) — a repeatable check, not a one-off script.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b8 npx tsx scripts/case-loops/money/kiosek-watch.ts
 */
import { getStore } from "@/lib/db/store";

function icoOf(id: string): string | null {
  const m = id.match(/ico:(\d+)/);
  return m ? m[1] : null;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const notices = await store.listKgNodes({ kind: "notice", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const concerns = await store.listKgEdges({ rel: "concerns", limit: 100_000 });
  const cites = await store.listKgEdges({ rel: "cites", limit: 100_000 });

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const tiedCompanyIds = new Set(linked.map((e) => e.dst));
  const tiedIcoSet = new Set(
    [...tiedCompanyIds]
      .map((id) => {
        const c = companyById.get(id);
        return c ? String(c.props?.ico ?? icoOf(id) ?? "") : icoOf(id) ?? "";
      })
      .filter(Boolean)
  );

  console.log(`companies: ${companies.length} · notice nodes: ${notices.length} · tied (linked_to) companies: ${tiedCompanyIds.size} · distinct tied ICOs: ${tiedIcoSet.size}`);
  console.log(`cites edges: ${cites.length} · concerns edges: ${concerns.length}`);

  // notice -> IČO set, from (a) concerns edges targeting company:ico:* nodes,
  // and (b) any ico mentions embedded directly in notice props (kiosek-build-payload.ts's
  // extraction also carries an `icos` list pre-graph — but once graphed, `concerns` IS the
  // canonical link; fall back to prop scanning only if a notice has no concerns edge yet).
  const concernsByNotice = new Map<string, string[]>();
  for (const e of concerns) {
    const arr = concernsByNotice.get(e.src) ?? [];
    const ico = icoOf(e.dst) ?? (companyById.get(e.dst)?.props?.ico as string | undefined) ?? null;
    if (ico) arr.push(ico);
    concernsByNotice.set(e.src, arr);
  }

  interface Hit {
    noticeId: string;
    noticeLabel: string;
    ico: string;
    tiedCompanyId: string;
    tiedCompanyLabel: string;
    mpTies: { mp: string; mpId: string; corroboration: string }[];
  }
  const hits: Hit[] = [];
  let noticesWithIcoLink = 0;

  const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
  const personById = new Map(persons.map((p) => [p.id, p]));

  for (const n of notices) {
    const icos = concernsByNotice.get(n.id) ?? [];
    // Fallback: also scan raw props (institutionIco is NOT a subject — exclude it; only
    // check any `icos`/`ico` array/string prop the notice payload may carry directly).
    const propIcos: string[] = [];
    const rawIcos = (n.props as Record<string, unknown>)?.icos;
    if (Array.isArray(rawIcos)) {
      for (const x of rawIcos) {
        if (typeof x === "string") propIcos.push(x);
        else if (x && typeof x.ico === "string") propIcos.push(x.ico);
      }
    }
    const allIcos = [...new Set([...icos, ...propIcos])];
    if (allIcos.length > 0) noticesWithIcoLink++;

    for (const ico of allIcos) {
      if (tiedIcoSet.has(ico)) {
        const tiedComp = companies.find((c) => String(c.props?.ico ?? "") === ico);
        if (!tiedComp) continue;
        const mpTies = linked
          .filter((e) => e.dst === tiedComp.id)
          .map((e) => ({
            mp: personById.get(e.src)?.label ?? e.src,
            mpId: e.src,
            corroboration: String((e.props as Record<string, unknown>)?.corroboration ?? ""),
          }));
        hits.push({ noticeId: n.id, noticeLabel: n.label, ico, tiedCompanyId: tiedComp.id, tiedCompanyLabel: tiedComp.label, mpTies });
      }
    }
  }

  console.log(`\nnotices carrying at least one resolvable IČO: ${noticesWithIcoLink} / ${notices.length}`);
  console.log(`WATCH HITS (notice IČO === tied-company IČO, from graphed 'concerns' edges): ${hits.length}`);
  for (const h of hits) console.log(`  ${h.noticeLabel} (${h.ico}) matches tied company ${h.tiedCompanyLabel} — MP(s): ${h.mpTies.map((t) => `${t.mp} [${t.corroboration}]`).join(", ")}`);

  // Secondary check: kiosek's `concerns` (notice->company) edges are PROPOSED but not yet
  // applied to the live graph (0 `concerns` edges observed above even though `cites` has
  // 36) — cross-check the un-applied proposal file directly so this watch isn't blind to
  // that gap.
  const unappliedHits: { ico: string; noticeId: string }[] = [];
  try {
    const raw = await fs.readFile("docs/data-analysis/case-sources/kiosek-payload.json", "utf8");
    const kioskPayload = JSON.parse(raw) as { edges: { src: string; rel: string; dst: string }[] };
    const proposedConcerns = kioskPayload.edges.filter((e) => e.rel === "concerns");
    for (const e of proposedConcerns) {
      const ico = e.dst.replace("company:ico:", "");
      if (tiedIcoSet.has(ico)) unappliedHits.push({ ico, noticeId: e.src });
    }
    console.log(`\n(secondary) UN-APPLIED kiosek 'concerns' proposals checked: ${proposedConcerns.length} (${new Set(proposedConcerns.map((e) => e.dst)).size} distinct ICOs) — hits against tied companies: ${unappliedHits.length}`);
    if (proposedConcerns.length > 0 && concerns.length === 0) {
      console.log(`  GAP: 'concerns' is in KG_EDGE_RELS but 0 edges are live in the graph — kiosek's money-relevant half (company links) was never persisted, only 'cites' (law links, 36 edges) was. Flagged for the orchestrator / case-sources driver, not this batch's boundary to fix.`);
    }
  } catch {
    console.log("\n(secondary) no docs/data-analysis/case-sources/kiosek-payload.json found — skipping un-applied cross-check.");
  }

  const dir = "docs/data-analysis/case-money";
  const out = {
    batch: 8,
    track: "money",
    kind: "kiosek-money-watch-check",
    generatedAt: new Date().toISOString().slice(0, 10),
    note:
      "Repeatable check (re-run every batch or on new kiosek slices). Read-only, no graph writes. " +
      "Flags when a court-notice IČO matches ANY MP-tied company IČO. A hit is a LEAD requiring the " +
      "same corroboration discipline as any other money claim — never auto-surfaced as an accusation.",
    companiesTotal: companies.length,
    noticesTotal: notices.length,
    tiedCompaniesTotal: tiedCompanyIds.size,
    tiedIcosDistinct: tiedIcoSet.size,
    citesEdges: cites.length,
    concernsEdges: concerns.length,
    noticesWithResolvableIco: noticesWithIcoLink,
    hits,
    unappliedConcernsProposalHits: unappliedHits,
  };
  await fs.writeFile(`${dir}/kiosek-money-watch-b8.json`, JSON.stringify(out, null, 2));

  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
