/* Money loop — batch 016: resolve `ownership-not-published` one level up.
 *
 * WHY. Batch 015 left 47 companies (18,04 mld. CZK, 98 % of the attributable headline)
 * with the verdict `ownership-not-published`: the veřejný rejstřík names no current owner,
 * which for an akciová společnost says nothing at all. The register is not the only thing
 * this platform knows about ownership — the graph carries an `owns_stake` layer built from
 * the dataor bulk OR export (batch 006). It was never consulted by the mandate sweep.
 *
 * This joins the two: for every company whose OWN record named no owner, ask whether the
 * GRAPH knows a parent, and classify that parent. A public parent settles the question the
 * register would not answer.
 *
 * DEPTH 2, AND NO FURTHER — deliberately. Each hop away from the company weakens the claim
 * that its turnover is the parent's public activity, and a chain walked far enough will
 * reach the state from almost anywhere. One hop, with the parent named on the surface as
 * the evidence, is a claim a reader can check.
 *
 * ONLY EVER REMOVES ATTRIBUTION (the batch-015 rule): a parent that is private, or absent,
 * changes nothing. A tie is never made MORE attributable by this pass.
 *
 * Read-only on the graph, ARES for the parent's form. Emits a payload; writes nothing.
 *
 *   npx tsx scripts/case-loops/money/ownership-depth2-b16.ts
 */
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { isPublicLegalForm } from "@/lib/analysis/public-body";

const BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";
// DATED outputs, never a fixed batch filename: the first version of this tool wrote to
// `batch-016-depth2.json` on every run and, re-run in batch 017, silently overwrote the
// COMMITTED pass-59 payload with an empty one — which would have made a restore-and-replay
// of pass 59 replay nothing. A committed payload is history; a tool writes a new file.
// To the MINUTE, not the day: a same-day rerun of this tool overwrote the committed pass-61
// payload within hours of the "dated files" fix (batch 018). Two runs must never share a name.
const STAMP = new Date().toISOString().slice(0, 16).replace(/:/g, "");
const OUT = `docs/data-analysis/case-money/qmoney-ownership-depth2-${STAMP}.json`;
const PAYLOAD = `docs/data-analysis/case-money/payloads/ownership-depth2-${STAMP}.json`;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

async function aresJson(path: string, ico: string): Promise<{ json: unknown | null; url: string }> {
  const url = `${BASE}/${path}/${encodeURIComponent(ico)}`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    if (text.includes("NENALEZENO")) return { json: null, url };
    return { json: JSON.parse(text) as unknown, url };
  } catch {
    return { json: null, url };
  }
}

async function main() {
  const fs = await import("node:fs/promises");
  const today = new Date().toISOString().slice(0, 10);

  const store = await getStore();
  if (!store) throw new Error("no store");
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const owns = await store.listKgEdges({ rel: "owns_stake", limit: KG_READ_CAP });
  await store.close();

  const byId = new Map(companies.map((c) => [c.id, c]));

  // Companies whose own record answered nothing — AND (batch 017) companies that were never
  // swept at all but now have a parent in the graph. Batch 015 swept only the 57
  // ATTRIBUTABLE companies; the 138 steward-by-role companies never got a verdict because no
  // money depended on it. The widened `owns_stake` layer then showed 24 of them owned by a
  // kraj, město, ministry, VZP or ČD — which is the COMPANY-axis corroboration of exactly the
  // steward classification their role implied, from an independent source. Writing it costs
  // nothing in money and puts „vlastník: Zlínský kraj" on the company file. A company with a
  // SETTLED verdict is still not revisited: this pass adds evidence, it does not re-litigate.
  const targets = companies.filter(
    (c) =>
      c.props?.public_mandate === "ownership-not-published" ||
      c.props?.public_mandate === "unknown" ||
      c.props?.public_mandate == null,
  );
  console.log(`companies with no owner in their own record: ${targets.length}`);
  console.log(`owns_stake edges in the graph: ${owns.length}\n`);

  interface Row {
    companyId: string;
    ico: string | null;
    name: string;
    parentId: string | null;
    parentIco: string | null;
    parentName: string | null;
    parentLegalForm: string | null;
    parentIsPublic: boolean | null;
    resolved: boolean;
    citations: { claim: string; url: string; accessedAt: string }[];
  }
  const rows: Row[] = [];

  for (const c of targets) {
    const parents = owns.filter((e) => e.dst === c.id);
    if (parents.length === 0) continue; // the graph knows no parent either — still unresolved
    for (const edge of parents) {
      const parent = byId.get(edge.src);
      const parentIco = str(parent?.props?.ico) ?? parent?.id.split(":").pop() ?? null;
      const parentName = parent?.label ?? edge.src;
      let legalForm: string | null = str(parent?.props?.public_mandate_legal_form);
      const citations: Row["citations"] = [];

      if (!legalForm && parentIco) {
        const basic = await aresJson("ekonomicke-subjekty", parentIco);
        await sleep(400);
        const b = basic.json as { pravniForma?: string; obchodniJmeno?: string } | null;
        legalForm = b?.pravniForma ?? null;
        citations.push({
          claim: `mateřská firma ${parentName}: právní forma ${legalForm ?? "(nezjištěna)"}`,
          url: basic.url,
          accessedAt: today,
        });
      }
      const parentIsPublic = isPublicLegalForm(legalForm);
      rows.push({
        companyId: c.id,
        ico: str(c.props?.ico),
        name: c.label,
        parentId: edge.src,
        parentIco,
        parentName,
        parentLegalForm: legalForm,
        parentIsPublic,
        resolved: parentIsPublic === true,
        citations,
      });
      console.log(
        `  ${c.label.slice(0, 38).padEnd(38)} <- ${parentName.slice(0, 30).padEnd(30)} forma ${legalForm ?? "?"} ${
          parentIsPublic === true ? "PUBLIC -> not attributable" : parentIsPublic === false ? "private" : "unknown"
        }`,
      );
    }
  }

  const resolved = rows.filter((r) => r.resolved);
  const proposals = resolved.map((r) => ({
    id: r.companyId,
    props: {
      public_mandate: "publicly-owned",
      public_mandate_attributable: false,
      public_mandate_reason: `Ve veřejném vlastnictví přes mateřskou společnost — vlastníkem je ${r.parentName} (právní forma ${r.parentLegalForm}). Vlastní rejstříkový záznam této firmy žádného společníka neuvádí; vlastnictví je doloženo o úroveň výš z rejstříku vlastnictví (owns_stake).`,
      public_mandate_owners: [{ ico: r.parentIco, name: r.parentName, legalForm: r.parentLegalForm }],
      public_mandate_depth: 2,
    },
    citations: r.citations,
  }));

  await fs.writeFile(
    OUT,
    JSON.stringify(
      {
        generatedFor: "money batch 016",
        generatedAt: today,
        method: "graph owns_stake parent (dataor bulk OR export) + ARES legal form of that parent; depth 2 only",
        caveat: "only ever REMOVES attribution; a private or absent parent changes nothing",
        candidates: targets.length,
        withParentInGraph: rows.length,
        resolvedPublic: resolved.length,
        rows,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  await fs.mkdir("docs/data-analysis/case-money/payloads", { recursive: true });
  await fs.writeFile(PAYLOAD, JSON.stringify({ proposals }, null, 2) + "\n", "utf8");

  console.log(`\ncandidates ${targets.length} · with a parent in the graph ${rows.length} · resolved PUBLIC ${resolved.length}`);
  console.log(`-> ${OUT}\n-> ${PAYLOAD}`);
}

main().then(() => process.exit(0));
