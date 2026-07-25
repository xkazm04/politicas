/* Money loop — batch 006, Job C: indirect-ownership layer, first real slice (O-money-3).
 *
 * dataor's `AngazmaPravnicke` engagement type (a legal-entity party on a company's own
 * record — as opposed to `AngazmaFyzicke`, a natural person) is a DATED, IČO-keyed
 * company→company shareholder chain, verified live in the source assessment
 * (docs/data-analysis/justice-sources-registry.md, PF METAL CZ / Corporate service a.s.
 * example). This is the missing layer for tracing Agrofert-style holding structures: the
 * money graph today only has person→company (`linked_to`) and company→contract
 * (`supplies`) edges — no company→company ownership at all.
 *
 * SCOPE (bounded first slice, not a full sweep — logged honestly): this batch walks the
 * companies ALREADY tied to an MP in the money graph (195 companies). For each, resolve
 * court+legalForm (reusing dataor-corroborate.ts's resolver) and look for its own
 * AngazmaPravnicke shareholder entries. To keep this batch's network footprint bounded,
 * new (uncached) dataset fetches are LIMITED to a priority subset — owner-operator/manager
 * tie_class companies, since those are where indirect ownership is money-relevant (a
 * steward seat is a public body, which structurally has no private shareholder chain to
 * trace) — plus the batch's own priority target (AGROFERT, a.s., the task's explicit
 * example). Companies whose dataset would require a NEW fetch outside that priority set
 * are recorded as "not attempted this batch, scope-bounded", never silently dropped.
 *
 * Only proposes `owns_stake` edges for company IČOs already present as nodes OR alongside
 * a node-create proposal for the newly-discovered parent — every edge dated
 * (validFrom/validTo from the record) and sourced (dataor file URL). No MP-exposure
 * inference is drawn here — that stays a lead for the human-facing product to narrate,
 * per the money-loop doctrine (public-role facts only, human gate untouched).
 *
 * NO LLM. Fleet mode: payload only. Schema is ADDITIVE (`owns_stake` company→company edge
 * kind) — proposed in the handoff for the shared kg-verdict.ts enum, NOT edited here.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b6 npx tsx scripts/case-loops/money/dataor-ownership-chains.ts
 */
import { getStore } from "@/lib/db/store";
import { AresClient } from "@/lib/analysis/money-feed";
import { datasetId, fetchAndFindRecord, resolveCourtAndForm, type AresSubjectForCourtForm, type DataorOfficer } from "@/lib/ingest/sources/dataor";

const DATAOR_YEAR = 2026;
const PRIORITY_TIE_CLASSES = new Set(["owner-operator", "manager"]);
const ALWAYS_PRIORITY_ICOS = new Set(["26185610", "24188581"]); // AGROFERT, a.s. + Nadace AGROFERT — the batch's flagship example
const MAX_NEW_FETCHES = 12; // bounds this batch's new network footprint; cached files are always used freely

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");
  const fsSync = await import("node:fs");

  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const knownCompanyIcos = new Set(companies.map((c) => String(c.props?.ico ?? c.id.split(":").pop())));

  // one row per distinct tied company; tie_class from the (first) linked_to edge that reaches it
  const tieClassByIco = new Map<string, string>();
  for (const e of linked) {
    const comp = companyById.get(e.dst);
    if (!comp) continue;
    const ico = String(comp.props?.ico ?? comp.id.split(":").pop() ?? "");
    if (!tieClassByIco.has(ico)) tieClassByIco.set(ico, String(e.props?.tie_class ?? ""));
  }

  const cachedIds = new Set(fsSync.readdirSync(".dataor-cache").map((f) => f.replace(/\.csv$/, "")));
  const ares = new AresClient();

  interface ChainHit {
    parentCompany: { ico: string; name: string };
    childIco: string;
    childName: string;
    role: string | null;
    validFrom: string | null;
    validTo: string | null;
    datasetId: string;
    sourceUrl: string;
  }
  const hits: ChainHit[] = [];
  const notAttempted: { ico: string; company: string; reason: string }[] = [];
  const noChainFound: { ico: string; company: string; datasetId: string }[] = [];
  let newFetchesUsed = 0;

  for (const [ico, tieClass] of tieClassByIco) {
    const comp = companies.find((c) => String(c.props?.ico ?? c.id.split(":").pop()) === ico);
    const companyLabel = comp?.label ?? ico;
    const isPriority = PRIORITY_TIE_CLASSES.has(tieClass) || ALWAYS_PRIORITY_ICOS.has(ico);

    type Subject = AresSubjectForCourtForm & { obchodniJmeno?: string; pravniForma?: string };
    let subject: Subject | null = null;
    try {
      subject = (await ares.subject(ico)) as Subject;
    } catch (err) {
      console.warn(`[ownership-chains] ARES subject miss for ${ico} — cannot resolve court/form:`, (err as Error).message);
    }
    await sleep(80);
    const hasVr = subject?.dalsiUdaje?.some((d) => d.datovyZdroj === "vr") ?? false;
    if (!subject || !hasVr) {
      notAttempted.push({ ico, company: companyLabel, reason: "not ISVR-registered (no VR sub-record) — dataor cannot help" });
      continue;
    }
    const guess = resolveCourtAndForm(subject);
    if (!guess.courtSlug || !guess.legalFormSlug) {
      notAttempted.push({ ico, company: companyLabel, reason: `court/legalForm unresolved (source=${guess.source})` });
      continue;
    }
    const id = datasetId(guess.legalFormSlug, "full", guess.courtSlug, DATAOR_YEAR);
    const isCached = cachedIds.has(id);
    if (!isCached && !isPriority) {
      notAttempted.push({ ico, company: companyLabel, reason: `dataset ${id} not cached and company is not tie_class owner-operator/manager — scope-bounded, not fetched this batch` });
      continue;
    }
    if (!isCached && isPriority) {
      if (newFetchesUsed >= MAX_NEW_FETCHES) {
        notAttempted.push({ ico, company: companyLabel, reason: `dataset ${id} not cached — batch's ${MAX_NEW_FETCHES}-new-fetch bound already spent` });
        continue;
      }
      newFetchesUsed++;
    }

    let lookup;
    try {
      // same bound as dataor-corroborate.ts — a not-yet-cached large file must never
      // stall the whole 195-company sweep; a miss here is logged, not silently dropped.
      lookup = isCached
        ? await fetchAndFindRecord(id, ico)
        : await Promise.race([
            fetchAndFindRecord(id, ico),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("batch network-budget exceeded (25s, uncached large file)")), 25_000)),
          ]);
    } catch (err) {
      notAttempted.push({ ico, company: companyLabel, reason: `fetch failed: ${(err as Error).message}` });
      continue;
    }
    if (!lookup.record) {
      notAttempted.push({ ico, company: companyLabel, reason: `IČO not present in ${id}` });
      continue;
    }
    const chain = lookup.officers.filter((o: DataorOfficer) => o.companyIco != null);
    if (chain.length === 0) {
      noChainFound.push({ ico, company: companyLabel, datasetId: id });
      continue;
    }
    const src = `https://dataor.justice.cz/api/file/${id}.csv.gz`;
    for (const c of chain) {
      hits.push({
        parentCompany: { ico: c.companyIco!, name: c.companyName ?? c.companyIco! },
        childIco: ico, childName: companyLabel,
        role: c.role, validFrom: c.validFrom, validTo: c.validTo,
        datasetId: id, sourceUrl: src,
      });
    }
    console.log(`${companyLabel} (${ico}): ${chain.length} corporate-shareholder entr${chain.length === 1 ? "y" : "ies"} found in ${id}`);
  }

  // node-create proposals for parent (shareholder) companies not already graphed
  const newParentIcos = new Set(hits.map((h) => h.parentCompany.ico).filter((i) => !knownCompanyIcos.has(i)));
  const nodeCreateProposals = [...newParentIcos].map((ico) => {
    const first = hits.find((h) => h.parentCompany.ico === ico)!;
    return {
      id: `company:ico:${ico}`,
      kind: "company",
      label: first.parentCompany.name,
      props: { ico, source: "dataor.justice.cz bulk ISVR export (AngazmaPravnicke shareholder record)", sourceUrl: first.sourceUrl },
      provenance: { track: "money", pass: null, method: "verdict", ref: "case-money/batch-006 · dataor indirect-ownership slice (O-money-3)", computedAt: new Date().toISOString().slice(0, 10) },
    };
  });

  const ownsStakeEdgeProposals = hits.map((h) => ({
    src: `company:ico:${h.parentCompany.ico}`,
    rel: "owns_stake", // PROPOSED enum addition — see handoff.md, not applied here (shared kg-verdict.ts)
    dst: `company:ico:${h.childIco}`,
    props: {
      role: h.role,
      from: h.validFrom,
      to: h.validTo, // null = ongoing per this dataset's snapshot year
      share: h.role && /jedin[ýá]/i.test(h.role) ? 100 : null, // "jediný akcionář/společník" = sole owner; otherwise unknown from this field alone
      source: h.sourceUrl,
      note: `${h.parentCompany.name} → ${h.childName}: ${h.role ?? "podíl"} ${h.validFrom ?? "?"}→${h.validTo ?? "trvá"} (dataor ${h.datasetId})`,
    },
    provenance: { track: "money", pass: null, method: "verdict", ref: "case-money/batch-006 · dataor indirect-ownership slice (O-money-3)", computedAt: new Date().toISOString().slice(0, 10) },
  }));

  const dir = "docs/data-analysis/case-money";
  const payload = {
    batch: 6,
    track: "money",
    kind: "indirect-ownership-slice",
    generatedAt: new Date().toISOString().slice(0, 10),
    note:
      "O-money-3 first slice — company→company shareholder chains extracted from dataor's AngazmaPravnicke " +
      "records, for companies already tied to an MP in the money graph. PROPOSED SCHEMA (additive, kg-verdict.ts " +
      "enum, NOT edited by this fleet run — orchestrator adds): rel='owns_stake', company->company, " +
      "props={role, from, to, share, source}. Every edge dated + sourced. No MP-exposure inference drawn — that " +
      "stays a narrative lead for the product layer, per doctrine.",
    scope: `${tieClassByIco.size} tied companies considered; ${newFetchesUsed} new dataset fetch(es) used ` +
      `(bound: ${MAX_NEW_FETCHES}, priority = tie_class owner-operator/manager + AGROFERT family); ` +
      `${notAttempted.length} not attempted (logged with reason, not silently dropped); ` +
      `${noChainFound.length} resolved+fetched with zero AngazmaPravnicke entries (honest negative — company has no corporate shareholders on record, e.g. natural-person-owned).`,
    nodeCreateProposals,
    ownsStakeEdgeProposals,
    notAttempted,
    noChainFound,
  };
  await fs.writeFile(`${dir}/payloads/batch-006-ownership-chains.json`, JSON.stringify(payload, null, 2));

  console.log("\n=== SUMMARY ===");
  console.log(`tied companies considered: ${tieClassByIco.size}`);
  console.log(`chain entries (owns_stake proposals): ${ownsStakeEdgeProposals.length}`);
  console.log(`new parent-company node proposals: ${nodeCreateProposals.length}`);
  console.log(`not attempted (scope-bounded/unresolved): ${notAttempted.length}`);
  console.log(`resolved, zero chain found: ${noChainFound.length}`);
  console.log(`new fetches used: ${newFetchesUsed}/${MAX_NEW_FETCHES}`);

  await store.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
