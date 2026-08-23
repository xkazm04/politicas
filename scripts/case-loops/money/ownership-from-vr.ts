/* Money loop — `owns_stake` from ARES VR, per IČO (batch 018).
 *
 * WHY. The dataor bulk sweep (`ownership-sweep.ts`) cannot reach the Prague s.r.o.
 * register today — the server caps ~70 MB per connection and both the 216 MB `full` and
 * the 121 MB `actual` files terminate every attempt. But for the question this case asks
 * of an s.r.o. — WHO OWNS IT — bulk was never the best source: **ARES VR lists every
 * společník of an s.r.o., with the share in percent and dated periods**, per IČO,
 * token-free. (For an a.s. it lists only a sole akcionář; that is the register's rule,
 * not ours.) The reader `ownershipRecord()` just never saw them — it iterated
 * `clenoveOrganu` and společníci live under `spolecnik[]` — fixed in this batch.
 *
 * WHAT. For every tied company (and every parent the layer already knows, depth 2), read
 * VR, take the LEGAL-PERSON owners, and emit `owns_stake` proposals in `apply-batch`'s
 * reviewed shape — dated from the register, `share` from `velikostPodilu` where stated or
 * 100 for a sole akcionář, null otherwise (the adapter then files it as excluded, never
 * as a guessed stake). Parents not yet in the graph become node proposals, 8-padded.
 *
 * Complement, not replacement: dataor carries history the VR endpoint flattens, and covers
 * seats; VR is the per-IČO source that bulk cannot be blocked from. Both write the same
 * edge shape and `apply-batch` merges periods across them.
 *
 *   npx tsx scripts/case-loops/money/ownership-from-vr.ts
 *   npx tsx scripts/case-loops/apply-batch.ts --which=ownership-vr [--commit --pass=N --confirm-live]
 */
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { ownershipRecord } from "@/lib/analysis/public-body";

const BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";
const OUT = "docs/data-analysis/case-money/qmoney-ownership-vr-b18.json";
const PAYLOAD = "docs/data-analysis/case-money/payloads/batch-018-ownership-vr.json";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const pad8 = (ico: string) => ico.replace(/\D/g, "").padStart(8, "0");
const nodeId = (ico: string) => `company:ico:${pad8(ico)}`;

async function vr(ico: string): Promise<{ json: unknown | null; url: string }> {
  const url = `${BASE}/ekonomicke-subjekty-vr/${encodeURIComponent(ico)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      const text = await res.text();
      if (text.includes("NENALEZENO")) return { json: null, url };
      return { json: JSON.parse(text) as unknown, url };
    } catch {
      if (attempt === 0) await sleep(1500);
    }
  }
  return { json: null, url };
}

async function main() {
  const fs = await import("node:fs/promises");
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

  const targets = new Map<string, { ico: string; label: string; why: "tied" | "parent" }>();
  for (const e of linked) {
    const c = byId.get(e.dst);
    if (c) targets.set(icoOf(c.id), { ico: icoOf(c.id), label: c.label, why: "tied" });
  }
  for (const e of owns) {
    const p = byId.get(e.src);
    if (p && !targets.has(icoOf(p.id))) targets.set(icoOf(p.id), { ico: icoOf(p.id), label: p.label, why: "parent" });
  }
  console.log(`targets: ${targets.size}`);

  interface Hit {
    parent: { ico: string; name: string; legalForm: string | null };
    childIco: string;
    childName: string;
    from: string | null;
    to: string | null;
    share: number | null;
    url: string;
  }
  const hits: Hit[] = [];
  const noVr: { ico: string; company: string }[] = [];
  const noCorporateOwner: { ico: string; company: string; naturalPersonOwners: number }[] = [];
  let n = 0;

  for (const t of targets.values()) {
    n++;
    const r = await vr(t.ico);
    await sleep(120);
    if (!r.json) {
      noVr.push({ ico: t.ico, company: t.label });
      continue;
    }
    const rec = ownershipRecord(r.json, today);
    if (rec.legalPersons.length === 0) {
      noCorporateOwner.push({ ico: t.ico, company: t.label, naturalPersonOwners: rec.entriesTotal });
      continue;
    }
    for (const o of rec.legalPersons) {
      if (!o.ico) continue; // a foreign owner without IČO cannot be a node here — recorded below
      hits.push({
        parent: { ico: pad8(o.ico), name: o.name, legalForm: o.legalForm },
        childIco: t.ico,
        childName: t.label,
        from: o.validFrom ?? null,
        to: o.validTo ?? null,
        // VR share when stated; a sole current akcionář/společník is 100; else unknown.
        share: o.sharePct ?? (rec.legalPersons.filter((x) => x.current).length === 1 && rec.entriesCurrent === 1 && o.current ? 100 : null),
        url: r.url,
      });
    }
    if (n % 25 === 0) process.stdout.write(`  ${n}/${targets.size} · hits ${hits.length}\n`);
  }

  // Rows without a `from` cannot be ordered by apply-batch (it refuses, by design). Rare;
  // recorded, not guessed.
  const undated = hits.filter((h) => !h.from);
  const dated = hits.filter((h) => h.from);

  const provenance = { track: "money", pass: null, method: "deterministic", ref: "case-money/batch-018 · ARES VR společníci/akcionáři (legal persons) → owns_stake", computedAt: today };
  const newParents = new Set(dated.map((h) => h.parent.ico).filter((i) => !knownIcos.has(i)));
  const nodeCreateProposals = [...newParents].map((ico) => {
    const first = dated.find((h) => h.parent.ico === ico)!;
    return {
      id: nodeId(ico),
      kind: "company",
      label: first.parent.name,
      props: { ico, source: "ARES veřejný rejstřík (VR) — společník/akcionář záznam dceřiné firmy", sourceUrl: first.url, ...(first.parent.legalForm ? { legalForm: first.parent.legalForm } : {}) },
      provenance,
    };
  });
  const ownsStakeEdgeProposals = dated.map((h) => ({
    src: nodeId(h.parent.ico),
    rel: "owns_stake",
    dst: nodeId(h.childIco),
    props: {
      role: h.share != null ? (h.share === 100 ? "jediný společník/akcionář" : "společník") : "akcionář (podíl neuveden)",
      from: h.from,
      to: h.to,
      share: h.share,
      source: h.url,
      note: `${h.parent.name} → ${h.childName}: ${h.share != null ? `${h.share} %` : "podíl neuveden"} ${h.from ?? "?"}→${h.to ?? "trvá"} (ARES VR)`,
    },
    provenance,
  }));

  const payload = {
    batch: 18,
    track: "money",
    kind: "ownership-vr",
    generatedAt: today,
    note: "owns_stake from ARES VR per IČO — legal-person společníci (s.r.o., with share %) and sole akcionáři (a.s.). Complements the dataor bulk sweep; same apply-batch shape.",
    scope: `${targets.size} targets · ${hits.length} corporate-owner rows (${dated.length} dated, ${undated.length} undated-skipped) · ${noCorporateOwner.length} natural-person-only · ${noVr.length} no VR record`,
    nodeCreateProposals,
    ownsStakeEdgeProposals,
    undated,
    noCorporateOwner,
    noVr,
  };
  await fs.writeFile(PAYLOAD, JSON.stringify(payload, null, 2) + "\n", "utf8");
  await fs.writeFile(OUT, JSON.stringify({ generatedFor: "money batch 018", generatedAt: today, targets: targets.size, hits: hits.length, dated: dated.length, undated: undated.length, newParents: newParents.size, naturalPersonOnly: noCorporateOwner.length, noVr: noVr.length }, null, 2) + "\n", "utf8");

  console.log(`\ncorporate-owner rows ${hits.length} (${dated.length} dated · ${dated.filter((h) => h.share != null).length} with a share) · new parents ${newParents.size}`);
  console.log(`natural-person-only ${noCorporateOwner.length} · no VR ${noVr.length} · undated skipped ${undated.length}`);
  console.log(`-> ${PAYLOAD}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
