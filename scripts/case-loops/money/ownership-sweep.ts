/* Money loop — the `owns_stake` layer, swept at full population (batch 017 onward).
 *
 * WHY. The graph's company→company ownership layer was written ONCE, by batch 006's
 * `dataor-ownership-chains.ts`, as a deliberately BOUNDED first slice: new dataset fetches
 * capped at 12, priority classes only, **153 of 195 tied companies never attempted**. It
 * produced 55 proposals → 33 live edges, and nothing widened it for ten batches. Batch 016
 * then ran the depth-2 mandate resolver over it and resolved 1 of 48 — a measurement of the
 * layer, not the method. This is the widening.
 *
 * WHAT. For every company the case cares about — all tied companies, plus (depth 2) every
 * parent the layer already knows — resolve its court × legal form, find its record in the
 * dataor bulk ISVR export, and extract the `AngazmaPravnicke` (legal-person) shareholder
 * entries: a DATED, IČO-keyed company→company chain. Emits a payload in the exact shape
 * `scripts/case-loops/apply-batch.ts` already consumes (`adaptOwnershipChains`: board seats
 * routed to excludedEdges, multi-period stakes merged with open-period precedence), so the
 * write path is the reviewed one, not a new one.
 *
 * THE TWO MODES, because the cost is network:
 *   --plan                 resolve + group by dataset; report what is cached and what a
 *                          full sweep would fetch. No dataset fetch, no payload.
 *   --fetch-budget=N       run the sweep; at most N uncached datasets are fetched (each a
 *                          court×form×year CSV, 20–320 MB, cached to .dataor-cache/ for
 *                          every later run). Default 0 = cached datasets only.
 *   --skip-datasets=a,b    never fetch these (recorded as not attempted with the reason) —
 *                          for a file the server is serving too slowly to finish this run.
 *   --fallback-actual      when a `full` dataset cannot be fetched, try the `actual`
 *                          variant (current state only, no history — sro-actual-praha is
 *                          121 MB gz where full is 216 MB, and the server caps ~70 MB/~90 s
 *                          per connection on a bad day). Hits are marked with the variant
 *                          they came from; a current-state owner is still a current owner.
 *
 * THREE RULES CARRIED FROM THE BATCHES THAT PAID FOR THEM:
 *   • IČOs are ZERO-PADDED to 8 everywhere (memory/ico-node-id-canonical-form: batch 006
 *     minted `company:ico:6947` for Ministerstvo financí and `company:ico:2867681` split one
 *     real chain across two node identities).
 *   • Absence is recorded, never dropped: every company lands in exactly one of
 *     hits / noChainFound (honest negative) / notAttempted (with the reason).
 *   • Public-role facts only: company→company edges, no MP-exposure inference here.
 *
 *   npx tsx scripts/case-loops/money/ownership-sweep.ts --plan
 *   npx tsx scripts/case-loops/money/ownership-sweep.ts --fetch-budget=20
 *   (then) npx tsx scripts/case-loops/apply-batch.ts --which=ownership-sweep [--commit --pass=N --confirm-live]
 */
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { AresClient } from "@/lib/analysis/money-feed";
import {
  datasetId,
  extractOfficersAndShareholders,
  fetchAndFindRecords,
  parseUdaje,
  resolveCourtAndForm,
  type AresSubjectForCourtForm,
  type DataorOfficer,
} from "@/lib/ingest/sources/dataor";

const DATAOR_YEAR = 2026;
const OUT_PLAN = "docs/data-analysis/case-money/qmoney-ownership-plan-b17.json";
const OUT_PAYLOAD = "docs/data-analysis/case-money/payloads/batch-017-ownership-sweep.json";
const CACHE_DIR = ".dataor-cache";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const flag = (k: string) => process.argv.includes(`--${k}`);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** The one place an IČO becomes a node id. */
const pad8 = (ico: string) => ico.replace(/\D/g, "").padStart(8, "0");
const nodeId = (ico: string) => `company:ico:${pad8(ico)}`;

interface Target {
  ico: string; // 8-padded
  label: string;
  why: "tied" | "parent";
}

async function main() {
  const fs = await import("node:fs/promises");
  const fsSync = await import("node:fs");
  const plan = flag("plan");
  const budget = Number(arg("fetch-budget") ?? 0);
  const depth = Number(arg("depth") ?? 2);
  const skip = new Set((arg("skip-datasets") ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  const fallbackActual = flag("fallback-actual");
  const today = new Date().toISOString().slice(0, 10);

  const store = await getStore();
  if (!store) throw new Error("no store");
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: KG_READ_CAP });
  const owns = await store.listKgEdges({ rel: "owns_stake", limit: KG_READ_CAP });
  await store.close();

  const byId = new Map(companies.map((c) => [c.id, c]));
  const icoOf = (id: string) => pad8(str(byId.get(id)?.props?.ico) ?? id.split(":").pop() ?? "");
  const knownIcos = new Set(companies.map((c) => icoOf(c.id)));

  // ── targets: tied companies, plus (depth 2) the parents the layer already knows ──────
  const targets = new Map<string, Target>();
  for (const e of linked) {
    const c = byId.get(e.dst);
    if (!c) continue;
    const ico = icoOf(c.id);
    if (!targets.has(ico)) targets.set(ico, { ico, label: c.label, why: "tied" });
  }
  if (depth >= 2) {
    for (const e of owns) {
      const p = byId.get(e.src);
      if (!p) continue;
      const ico = icoOf(p.id);
      if (!targets.has(ico)) targets.set(ico, { ico, label: p.label, why: "parent" });
    }
  }
  console.log(`targets: ${targets.size} (${[...targets.values()].filter((t) => t.why === "tied").length} tied + ${[...targets.values()].filter((t) => t.why === "parent").length} known parents)`);

  // ── resolve court × legal form for every target (ARES basic, token-free) ─────────────
  // THE ADAPTER'S RULE, not a looser one: `fetchDatasetCsv` reads `<id>.csv` and nothing
  // else. The first run of this sweep accepted `<id>.csv.gz` as cached — two truncated
  // partial downloads from an old run — so it spent no budget on sro-full-praha while the
  // adapter, seeing no `.csv`, re-downloaded 68 MB from CKAN for EVERY company in that
  // dataset. 27 minutes of silent re-fetching from one filename disagreement.
  const cached = new Set(
    fsSync.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".csv")).map((f) => f.slice(0, -4)),
  );
  const ares = new AresClient();
  interface Resolved {
    target: Target;
    datasetId: string | null;
    reason: string | null; // why unresolved
  }
  const resolved: Resolved[] = [];
  let n = 0;
  for (const t of targets.values()) {
    n++;
    type Subject = AresSubjectForCourtForm & { obchodniJmeno?: string; pravniForma?: string };
    let subject: Subject | null = null;
    // One retry: "ARES subject not found" rose 3 → 8 between two runs of this sweep with
    // the same targets, so a transient ARES error was being filed as a permanent absence.
    for (let attempt = 0; attempt < 2 && !subject; attempt++) {
      try {
        subject = (await ares.subject(t.ico)) as Subject;
      } catch {
        if (attempt === 0) await sleep(1500);
      }
    }
    if (!subject) {
      resolved.push({ target: t, datasetId: null, reason: "ARES subject not found (after 1 retry)" });
      await sleep(80);
      continue;
    }
    await sleep(80);
    const hasVr = subject?.dalsiUdaje?.some((d) => d.datovyZdroj === "vr") ?? false;
    if (!subject || !hasVr) {
      resolved.push({ target: t, datasetId: null, reason: "not ISVR-registered (no VR sub-record) — dataor cannot help (obce, kraje, OSS, special-law bodies)" });
      continue;
    }
    const guess = resolveCourtAndForm(subject);
    if (!guess.courtSlug || !guess.legalFormSlug) {
      resolved.push({ target: t, datasetId: null, reason: `court/legalForm unresolved (source=${guess.source})` });
      continue;
    }
    resolved.push({ target: t, datasetId: datasetId(guess.legalFormSlug, "full", guess.courtSlug, DATAOR_YEAR), reason: null });
    if (n % 25 === 0) process.stdout.write(`  resolved ${n}/${targets.size}\n`);
  }

  // ── the plan: group by dataset ───────────────────────────────────────────────────────
  const byDataset = new Map<string, Resolved[]>();
  for (const r of resolved) if (r.datasetId) byDataset.set(r.datasetId, [...(byDataset.get(r.datasetId) ?? []), r]);
  const datasets = [...byDataset.entries()]
    .map(([id, rs]) => ({ id, companies: rs.length, cached: cached.has(id) }))
    .sort((a, b) => Number(a.cached) - Number(b.cached) || b.companies - a.companies);
  const unresolved = resolved.filter((r) => !r.datasetId);

  const planReport = {
    generatedFor: "money batch 017",
    generatedAt: today,
    targets: targets.size,
    resolvedToDataset: resolved.length - unresolved.length,
    unresolved: unresolved.length,
    unresolvedReasons: Object.entries(
      unresolved.reduce<Record<string, number>>((a, r) => ((a[r.reason!] = (a[r.reason!] ?? 0) + 1), a), {}),
    ),
    datasets,
    cachedDatasets: datasets.filter((d) => d.cached).length,
    uncachedDatasets: datasets.filter((d) => !d.cached).length,
    companiesReachableFromCache: datasets.filter((d) => d.cached).reduce((s, d) => s + d.companies, 0),
    companiesNeedingFetch: datasets.filter((d) => !d.cached).reduce((s, d) => s + d.companies, 0),
  };
  await fs.writeFile(OUT_PLAN, JSON.stringify(planReport, null, 2) + "\n", "utf8");
  console.log(`\ndatasets: ${datasets.length} (${planReport.cachedDatasets} cached → ${planReport.companiesReachableFromCache} companies; ${planReport.uncachedDatasets} uncached → ${planReport.companiesNeedingFetch} companies)`);
  console.log(`unresolved: ${unresolved.length}`);
  for (const [k, v] of planReport.unresolvedReasons) console.log(`   ${String(v).padStart(4)}  ${k}`);
  console.log(`\nuncached datasets, most companies first:`);
  for (const d of datasets.filter((d) => !d.cached)) console.log(`   ${String(d.companies).padStart(4)}  ${d.id}`);
  console.log(`-> ${OUT_PLAN}`);
  if (plan) return;

  // ── the sweep ────────────────────────────────────────────────────────────────────────
  interface Hit {
    parent: { ico: string; name: string };
    childIco: string;
    childName: string;
    role: string | null;
    from: string | null;
    to: string | null;
    share: number | null;
    datasetId: string;
  }
  const hits: Hit[] = [];
  const notAttempted: { ico: string; company: string; reason: string }[] = unresolved.map((r) => ({ ico: r.target.ico, company: r.target.label, reason: r.reason! }));
  const noChainFound: { ico: string; company: string; datasetId: string }[] = [];
  let fetchesUsed = 0;
  const fetchedNow = new Set<string>();

  // Cached datasets first — free; then uncached in order of how many companies they unlock,
  // until the budget is spent. A dataset fetched this run becomes cached for the rest of it.
  for (const d of datasets) {
    const rows = byDataset.get(d.id)!;
    const isCached = cached.has(d.id) || fetchedNow.has(d.id);
    if (!isCached && skip.has(d.id)) {
      for (const r of rows) notAttempted.push({ ico: r.target.ico, company: r.target.label, reason: `dataset ${d.id} skipped by --skip-datasets (server too slow this run)` });
      continue;
    }
    if (!isCached) {
      if (fetchesUsed >= budget) {
        for (const r of rows) notAttempted.push({ ico: r.target.ico, company: r.target.label, reason: `dataset ${d.id} not cached — fetch budget (${budget}) spent` });
        continue;
      }
      fetchesUsed++;
      process.stdout.write(`fetching ${d.id} (${rows.length} companies, fetch ${fetchesUsed}/${budget}) … `);
    }
    // ONE streaming pass per dataset for every company in it (money batch 017): the two
    // s.r.o. registers are 2,4 GB and 812 MB, and the per-company whole-file read this
    // replaced could not open either of them at all (V8 string cap).
    let batch;
    let usedId = d.id;
    try {
      batch = await fetchAndFindRecords(d.id, rows.map((r) => r.target.ico));
    } catch (err) {
      const actualId = d.id.replace("-full-", "-actual-");
      if (fallbackActual && actualId !== d.id) {
        process.stdout.write(`full failed (${(err as Error).message.slice(0, 50)}) → trying ${actualId} … `);
        try {
          batch = await fetchAndFindRecords(actualId, rows.map((r) => r.target.ico));
          usedId = actualId;
        } catch (err2) {
          for (const r of rows) notAttempted.push({ ico: r.target.ico, company: r.target.label, reason: `fetch failed (full and actual): ${(err2 as Error).message.slice(0, 60)}` });
          console.log("FAILED");
          continue;
        }
      } else {
        for (const r of rows) notAttempted.push({ ico: r.target.ico, company: r.target.label, reason: `fetch failed: ${(err as Error).message.slice(0, 80)}` });
        if (!isCached) console.log("FAILED");
        continue;
      }
    }
    if (!isCached) {
      fetchedNow.add(d.id);
      console.log("ok");
    }
    if (!batch.datasetExists) {
      for (const r of rows) notAttempted.push({ ico: r.target.ico, company: r.target.label, reason: `dataset ${d.id} does not exist on CKAN` });
      continue;
    }
    for (const r of rows) {
      const record = batch.records.get(r.target.ico);
      if (!record) {
        notAttempted.push({ ico: r.target.ico, company: r.target.label, reason: `IČO not present in ${usedId}` });
        continue;
      }
      const chain = extractOfficersAndShareholders(parseUdaje(record.udajeRaw)).filter((o: DataorOfficer) => o.companyIco != null);
      if (chain.length === 0) {
        noChainFound.push({ ico: r.target.ico, company: r.target.label, datasetId: usedId });
        continue;
      }
      for (const c of chain) {
        hits.push({
          parent: { ico: pad8(c.companyIco!), name: c.companyName ?? pad8(c.companyIco!) },
          childIco: r.target.ico,
          childName: r.target.label,
          role: c.role,
          from: c.validFrom,
          to: c.validTo,
          // "jediný akcionář/společník" = sole owner. Anything else is an unknown share,
          // which the adapter routes to excludedEdges unless `stakePct` was recorded.
          share: c.stakePct ?? (c.role && /jedin[ýá]/i.test(c.role) ? 100 : null),
          datasetId: usedId,
        });
      }
    }
  }

  // ── payload, in apply-batch's reviewed shape ─────────────────────────────────────────
  const provenance = { track: "money", pass: null, method: "deterministic", ref: "case-money/batch-017 · dataor owns_stake sweep at full population", computedAt: today };
  const src = (id: string) => `https://dataor.justice.cz/api/file/${id}.csv.gz`;
  const newParents = new Set(hits.map((h) => h.parent.ico).filter((i) => !knownIcos.has(i)));
  const nodeCreateProposals = [...newParents].map((ico) => {
    const first = hits.find((h) => h.parent.ico === ico)!;
    return {
      id: nodeId(ico),
      kind: "company",
      label: first.parent.name,
      props: { ico, source: "dataor.justice.cz bulk ISVR export (AngazmaPravnicke shareholder record)", sourceUrl: src(first.datasetId) },
      provenance,
    };
  });
  const ownsStakeEdgeProposals = hits.map((h) => ({
    src: nodeId(h.parent.ico),
    rel: "owns_stake",
    dst: nodeId(h.childIco),
    props: {
      role: h.role,
      from: h.from,
      to: h.to,
      share: h.share,
      source: src(h.datasetId),
      note: `${h.parent.name} → ${h.childName}: ${h.role ?? "podíl"} ${h.from ?? "?"}→${h.to ?? "trvá"} (dataor ${h.datasetId})`,
    },
    provenance,
  }));

  const payload = {
    batch: 17,
    track: "money",
    kind: "ownership-sweep",
    generatedAt: today,
    note: "owns_stake layer swept at full population (tied companies + known parents, depth 2). Same dataor AngazmaPravnicke extraction as batch 006, IČOs 8-padded, payload shape = apply-batch adaptOwnershipChains.",
    scope: `${targets.size} targets · ${datasets.length} datasets (${fetchesUsed} fetched this run, budget ${budget}) · ${hits.length} chain rows · ${noChainFound.length} honest negatives · ${notAttempted.length} not attempted (each with reason)`,
    nodeCreateProposals,
    ownsStakeEdgeProposals,
    notAttempted,
    noChainFound,
  };
  await fs.mkdir("docs/data-analysis/case-money/payloads", { recursive: true });
  await fs.writeFile(OUT_PAYLOAD, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const stakeRows = hits.filter((h) => typeof h.share === "number").length;
  console.log(`\nchain rows ${hits.length} (${stakeRows} with a share → stakes; ${hits.length - stakeRows} board seats → excluded by the adapter)`);
  console.log(`new parent nodes ${nodeCreateProposals.length} · honest negatives ${noChainFound.length} · not attempted ${notAttempted.length}`);
  console.log(`-> ${OUT_PAYLOAD}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
