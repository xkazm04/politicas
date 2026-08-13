/* FollowTheMoney ingest — Case ①: real MP → company → public money, written into the
 * knowledge graph (kg_node/kg_edge). Two modes:
 *   --persons=slug,slug     specific Hlídač person slugs
 *   --chamber=PSP10         every current-term MP (roster → Hlídač search → bridge)
 *
 * Per MP the enriched money picture is assembled from the fixture-tested PURE layer
 * (lib/analysis/money-feed.ts + kg-money.ts); this script is only IO + the store write:
 *   udalosti[Soukromá pracovní] → ARES (recall-stripped search, EXACT pick) → linked_to (pending_review)
 *   Hlídač /smlouvy   → supplies (company → contract, CZK)
 *   Hlídač /dotace    → subsidies_* props on the company node
 *   Hlídač /sponzoring(party) → donated_to_party_* props (the accountability triangle)
 *
 * TRUST IS THE PRODUCT: every link pending_review; an unresolved IČO is DROPPED, never
 * guessed; nothing is written unless --commit. Caches dedupe API calls; throttled.
 *
 *   HLIDAC_API_TOKEN=… npx tsx scripts/data-analysis/kg-money-ingest.ts --persons=andrej-babis            # dry-run
 *   HLIDAC_API_TOKEN=… npx tsx scripts/data-analysis/kg-money-ingest.ts --chamber=PSP10 --commit          # full sweep
 * Flags: --commit  --pass=N  --throttle=ms(200)  --contract-pages=N(1)  --limit=N(cap MPs)
 */
import {
  AresClient,
  HlidacClient,
  aresSearchQuery,
  bridgePerson,
  bridgeSearchByBirthdate,
  buildPersonCompanyLinks,
  companyDonationsToParty,
  dedupeCompanies,
  dedupeContracts,
  enrichMoneyCompanies,
  foldLower,
  parseAresCompany,
  parseAresSearch,
  parseContracts,
  parsePersonSearch,
  parseSponsorship,
  parseSubsidies,
  pickExactIco,
  privateRoleEvents,
  subsidiesByCompany,
  type Donation,
  type HlidacPersonDetail,
  type RosterPerson,
} from "@/lib/analysis/money-feed";
import { nextPass } from "@/lib/analysis/kg";
import {
  buildMoneyGraph,
  mergePreservedTieProps,
  moneyTrails,
  type Company,
  type Contract,
  type MoneyGraph,
} from "@/lib/analysis/kg-money";
import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";

function arg(name: string, fallback = ""): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (n: number) => new Intl.NumberFormat("cs-CZ").format(Math.round(n));

/** kg_edge (src, rel, dst) triple → the key `existingLinkedToProps` is keyed on. */
export const tieKey = (src: string, rel: string, dst: string): string => `${src} ${rel} ${dst}`;

/**
 * MoneyGraph → kg rows. Pure: field rename + a shared provenance stamp — EXCEPT for
 * `linked_to` edges, where D1 (batch 004) requires merge-preserving human-gated props
 * across re-ingests (see `mergePreservedTieProps` in lib/analysis/kg-money.ts):
 * `upsertKgEdges` does a wholesale `props = excluded.props` replace on conflict, so
 * writing the freshly source-derived props straight through would silently erase every
 * human review decision on each re-run. `existingLinkedToProps` is the CURRENT props for
 * `linked_to` edges already in the store, read once before this run's writes; absent
 * (or missing a given triple) → fresh props win entirely, same as before this fix.
 */
export function moneyGraphToKgRows(
  g: MoneyGraph,
  opts: { pass: number; computedAt: string; ref: string; existingLinkedToProps?: Map<string, Record<string, unknown>> },
): { nodes: KgNodeRow[]; edges: KgEdgeRow[] } {
  const provenance = { pass: opts.pass, method: "deterministic", ref: opts.ref, computedAt: opts.computedAt };
  return {
    nodes: g.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, props: n.props, firstSeenPass: opts.pass, provenance })),
    edges: g.edges.map((e) => {
      const props =
        e.rel === "linked_to"
          ? mergePreservedTieProps(opts.existingLinkedToProps?.get(tieKey(e.src, e.rel, e.dst)), e.props)
          : e.props;
      return { src: e.src, rel: e.rel, dst: e.dst, weight: e.weight, props, provenance };
    }),
  };
}

async function main() {
  const token = process.env.HLIDAC_API_TOKEN;
  if (!token) {
    console.error("HLIDAC_API_TOKEN env var is required (never commit it).");
    process.exit(2);
  }
  const slugs = arg("persons").split(",").map((s) => s.trim()).filter(Boolean);
  const chamber = arg("chamber");
  if (!slugs.length && !chamber) {
    console.error('usage: --persons=<slug>[,…] | --chamber=PSP10  [--commit] [--pass=N] [--throttle=ms] [--limit=N]');
    process.exit(2);
  }
  const commit = flag("commit");
  const throttle = Number(arg("throttle", "200")) || 200;
  const contractPages = Math.max(1, Number(arg("contract-pages", "1")) || 1);
  const limit = Number(arg("limit")) || Infinity;

  const store = await getStore();
  if (!store) {
    console.error("no store configured");
    process.exit(1);
  }
  const hlidac = new HlidacClient({ token });
  const ares = new AresClient();

  const persons = await store.listPersons();
  const roster: RosterPerson[] = persons.map((p) => ({ personPspId: p.pspId, firstName: p.firstName, lastName: p.lastName, birthDate: p.birthDate }));
  const nameOf = new Map(persons.map((p) => [p.pspId, p.nameFull]));
  const existingNodes = await store.listKgNodes();
  const pass = Number(arg("pass")) || nextPass(existingNodes);
  // D1: read the CURRENT linked_to props once, up front, so re-derived props can be
  // merge-preserved against them instead of wholesale-replacing human review decisions.
  const existingLinkedToProps = new Map<string, Record<string, unknown>>(
    (await store.listKgEdges({ rel: "linked_to" })).map((e) => [tieKey(e.src, e.rel, e.dst), e.props]),
  );

  console.log(`FollowTheMoney ingest · ${chamber ? `chamber ${chamber}` : `${slugs.length} slug(s)`} · pass ${pass} · ${commit ? "COMMIT" : "DRY-RUN"}\n`);

  // ── caches (dedupe API calls across MPs) ─────────────────────────────────────
  const icoCache = new Map<string, string | null>(); // normalized company name → IČO
  const companyCache = new Map<string, Company | null>();
  const contractCache = new Map<string, Contract[]>();
  const subsidyCache = new Map<string, ReturnType<typeof subsidiesByCompany>>();
  const partyIcoCache = new Map<string, string | null>();
  const sponsorshipCache = new Map<string, Donation[]>();

  async function resolveIco(name: string): Promise<string | null> {
    const key = name.trim().toLowerCase();
    if (icoCache.has(key)) return icoCache.get(key)!;
    let ico: string | null = null;
    try {
      ico = pickExactIco(name, parseAresSearch(await ares.subjectSearch(aresSearchQuery(name))));
    } catch (e) {
      console.warn(`  [resolveIco ${name}] ${e instanceof Error ? e.message : e}`); // unresolved → dropped, never guessed
    }
    await sleep(throttle);
    icoCache.set(key, ico);
    return ico;
  }
  async function companyOf(ico: string): Promise<Company | null> {
    if (companyCache.has(ico)) return companyCache.get(ico)!;
    let c: Company | null = null;
    try {
      c = parseAresCompany(await ares.subject(ico));
    } catch (e) {
      console.warn(`  [companyOf ${ico}] ${e instanceof Error ? e.message : e}`);
    }
    await sleep(throttle);
    companyCache.set(ico, c);
    return c;
  }
  async function contractsOf(ico: string): Promise<Contract[]> {
    if (contractCache.has(ico)) return contractCache.get(ico)!;
    const out: Contract[] = [];
    for (let page = 1; page <= contractPages; page++) {
      try {
        const found = parseContracts(await hlidac.contractsByIco(ico, page), { supplierIco: ico });
        out.push(...found);
        await sleep(throttle);
        if (!found.length) break;
      } catch (e) {
        console.warn(`  [contractsOf ${ico} p${page}] ${e instanceof Error ? e.message : e}`);
        break;
      }
    }
    contractCache.set(ico, out);
    return out;
  }
  async function subsidiesOf(ico: string) {
    if (subsidyCache.has(ico)) return subsidyCache.get(ico)!;
    let agg = subsidiesByCompany([]);
    try {
      agg = subsidiesByCompany(parseSubsidies(await hlidac.subsidiesByIco(ico), { recipientIco: ico }));
    } catch (e) {
      console.warn(`  [subsidiesOf ${ico}] ${e instanceof Error ? e.message : e}`);
    }
    await sleep(throttle);
    subsidyCache.set(ico, agg);
    return agg;
  }
  async function partyIcoOf(partyName: string): Promise<string | null> {
    const key = partyName.trim().toLowerCase();
    if (partyIcoCache.has(key)) return partyIcoCache.get(key)!;
    let ico: string | null = null;
    try {
      ico = pickExactIco(partyName, parseAresSearch(await ares.subjectSearch(aresSearchQuery(partyName))));
    } catch (e) {
      console.warn(`  [partyIcoOf ${partyName}] ${e instanceof Error ? e.message : e}`);
    }
    await sleep(throttle);
    partyIcoCache.set(key, ico);
    return ico;
  }
  async function sponsorshipOf(partyIco: string): Promise<Donation[]> {
    if (sponsorshipCache.has(partyIco)) return sponsorshipCache.get(partyIco)!;
    let donations: Donation[] = [];
    try {
      donations = parseSponsorship(await hlidac.sponsorship(partyIco));
    } catch (e) {
      console.warn(`  [sponsorshipOf ${partyIco}] ${e instanceof Error ? e.message : e}`);
    }
    await sleep(throttle);
    sponsorshipCache.set(partyIco, donations);
    return donations;
  }

  // ── resolve the target list (slug, pspId, detail) ────────────────────────────
  const targets: { slug: string; pspId: number; detail: HlidacPersonDetail }[] = [];
  if (slugs.length) {
    for (const slug of slugs.slice(0, limit)) {
      try {
        const detail = (await hlidac.personDetail(slug)) as HlidacPersonDetail;
        await sleep(throttle);
        const b = bridgePerson(detail, roster);
        if (b) targets.push({ slug, pspId: b.personPspId, detail });
        else console.log(`  ✗ ${slug}: no confident psp match — skipped`);
      } catch (e) { console.log(`  ✗ ${slug}: ${e instanceof Error ? e.message : e}`); }
    }
  } else {
    // HYBRID resolve: (A) ftx search → bridge on the reliable birth date (ftx names are
    // mojibaked, narozeni is clean) → candidate slug; (B) fall back to the deterministic
    // "firstname-lastname" slug. Then fetch ONE detail and CONFIRM on the clean detail's
    // name+birthdate. Robust to slug variants/collisions and to search fuzziness.
    const candidateSlug = (first: string, last: string) =>
      foldLower(`${first} ${last}`).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const mandates = (await store.listMandates()).filter((m) => m.termCode === chamber);
    const mpIds = [...new Set(mandates.map((m) => m.personPspId))].slice(0, limit);
    console.log(`chamber ${chamber}: ${mpIds.length} MPs to resolve (ftx birthdate bridge + slug fallback)\n`);
    let missed = 0;
    for (const pspId of mpIds) {
      const p = persons.find((x) => x.pspId === pspId);
      if (!p || !p.firstName || !p.lastName || !p.birthDate) {
        missed++;
        continue;
      }
      try {
        const hits = parsePersonSearch(await hlidac.personSearch(`${p.firstName} ${p.lastName}`));
        await sleep(throttle);
        const slug = bridgeSearchByBirthdate(hits, p.birthDate) ?? candidateSlug(p.firstName, p.lastName);
        const detail = (await hlidac.personDetail(slug)) as HlidacPersonDetail;
        await sleep(throttle);
        if (bridgePerson(detail, roster)?.personPspId === pspId) targets.push({ slug, pspId, detail });
        else missed++;
      } catch {
        missed++; // no hit / 404 / API hiccup → unresolved (reported, never fabricated)
      }
    }
    if (missed) console.log(`  (${missed} MPs unresolved — no birthdate match by search or slug; reported, not guessed)`);
  }
  console.log(`resolved ${targets.length} target(s) to a Hlídač profile\n`);

  // ── process each target → enriched money graph → upsert ─────────────────────
  let totalNodes = 0;
  let totalEdges = 0;
  const grand = { people: 0, companies: 0, contracts: 0, czk: 0 };
  for (const t of targets) {
    const events = privateRoleEvents(t.detail);
    // 1) resolve company names → IČO, then gated links
    const nameToIco = new Map<string, string>();
    for (const e of events) {
      const ico = await resolveIco(e.organizace!.trim());
      if (ico) nameToIco.set(e.organizace!.trim(), ico);
    }
    const links = buildPersonCompanyLinks(t.detail, t.pspId, { resolveIco: (n) => nameToIco.get(n.trim()) ?? null });
    if (!links.length) {
      console.log(`  · ${t.slug} (psp:person:${t.pspId}) — ${events.length} roles, 0 links resolved`);
      continue;
    }
    // 2) companies + contracts + subsidies for each linked IČO
    const usedIcos = [...new Set(links.map((l) => l.ico))];
    const companies: Company[] = [];
    const contracts: Contract[] = [];
    const subs = new Map<string, { total: number; count: number }>();
    for (const ico of usedIcos) {
      const c = await companyOf(ico);
      if (c) companies.push(c);
      contracts.push(...(await contractsOf(ico)));
      for (const [k, v] of await subsidiesOf(ico)) subs.set(k, v);
    }
    // 3) party-donation triangle
    let donations = new Map<string, { total: number; count: number }>();
    let partyLabel: string | undefined;
    const partyName = (t.detail as { politickaStrana?: string }).politickaStrana;
    if (partyName) {
      const partyIco = await partyIcoOf(partyName);
      if (partyIco) {
        donations = companyDonationsToParty(await sponsorshipOf(partyIco), new Set(usedIcos));
        if (donations.size) partyLabel = partyName;
      }
    }
    // 4) build + enrich + write
    const g = enrichMoneyCompanies(
      buildMoneyGraph(links, dedupeCompanies(companies), dedupeContracts(contracts)),
      { subsidies: subs, donations, donationPartyLabel: partyLabel },
    );
    const trail = moneyTrails(g, links).find((x) => x.personPspId === t.pspId);
    const subTotal = [...subs.values()].reduce((a, b) => a + b.total, 0);
    const donTotal = [...donations.values()].reduce((a, b) => a + b.total, 0);
    console.log(
      `  • ${nameOf.get(t.pspId) ?? t.slug} → ${g.stats.companies} co · ${g.stats.contracts} contracts ${fmt(trail?.totalAmount ?? 0)} CZK` +
        `${subTotal ? ` · +${fmt(subTotal)} subsidies` : ""}${donTotal ? ` · ${fmt(donTotal)}→party` : ""} · PENDING`,
    );

    const { nodes, edges } = moneyGraphToKgRows(g, {
      pass,
      computedAt: new Date().toISOString(),
      ref: "money-feed:hlidac+ares+registr-smluv",
      existingLinkedToProps,
    });
    if (commit) {
      totalNodes += await store.upsertKgNodes(nodes);
      totalEdges += await store.upsertKgEdges(edges);
    } else {
      totalNodes += nodes.length;
      totalEdges += edges.length;
    }
    grand.people++;
    grand.companies += g.stats.companies;
    grand.contracts += g.stats.contracts;
    grand.czk += trail?.totalAmount ?? 0;
  }

  console.log(
    `\n${commit ? "COMMITTED" : "DRY-RUN"}: ${grand.people} MPs · ${grand.companies} companies · ${grand.contracts} contracts · ` +
      `${fmt(grand.czk)} CZK in contracts · ${totalNodes} kg_node ${commit ? "written" : "(would write)"} · ${totalEdges} kg_edge (pass ${pass}, all pending_review)`,
  );
  await store.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
