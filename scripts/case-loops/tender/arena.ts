/* Tender loop — ELECTORAL ARENA mapping per authority (durable; b012, synthesis track).
 *
 * The bridge from "authority behavior" to the voter's question — "whom should I distrust
 * on MY ballot?" (user doctrine, 2026-08-24). RVZ classifies every zadavatel with a legal
 * category (`kategorie_zadavatele`), and that category maps DETERMINISTICALLY onto the
 * election that holds the authority accountable:
 *
 *   Obec / Příspěvková organizace obce            → komunalni  (municipal elections)
 *   Kraj / Příspěvková organizace kraje           → krajske    (regional elections)
 *   Česká republika / Státní přísp. org. / ČNB    → statni     (parliamentary)
 *   Jiná právnická osoba / Jiný zadavatel (§4)    → nejasne    (city/state-OWNED companies
 *                                                   and sector buyers — the category alone
 *                                                   does not say who controls them; an
 *                                                   ownership hop resolves them LATER,
 *                                                   never a guess now)
 *
 * The category is parsed by isvz.ts but was never persisted (only authority_ico) — this
 * script recovers it from the local NDJSON (no downloads), takes the LAST occurrence per
 * IČO (snapshot semantics, same rule as persist-month), and emits a props payload for the
 * authority company nodes. No judgment anywhere: the arena states which ballot elects the
 * body's principals, nothing else.
 *
 *   npx tsx scripts/case-loops/tender/arena.ts --cpv=45
 *   npx tsx scripts/case-loops/persist-batch.ts --payload=<out> --pass=<n> --track=tender --ns=arena --commit
 */
import { createReadStream, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const RAW = "data/raw/isvz";

const ARENA: Record<string, string> = {
  "Obec": "komunalni",
  "Příspěvková organizace obce": "komunalni",
  "Kraj": "krajske",
  "Příspěvková organizace kraje": "krajske",
  "Česká republika": "statni",
  "Státní příspěvková organizace": "statni",
  "Česká národní banka": "statni",
};
// everything else (Jiná právnická osoba, Jiný zadavatel …) → nejasne, disclosed

async function extractCategories(cpv: string): Promise<Map<string, string>> {
  // chronological file order; LAST occurrence per IČO wins (snapshot semantics)
  const files = readdirSync(RAW)
    .filter((f) => f.endsWith(`-cpv${cpv}.ndjson`))
    .sort((a, b) => {
      const [ma, ya] = a.match(/^VZ-(\d{2})-(\d{4})/)!.slice(1);
      const [mb, yb] = b.match(/^VZ-(\d{2})-(\d{4})/)!.slice(1);
      return Number(ya) - Number(yb) || Number(ma) - Number(mb);
    });
  const byIco = new Map<string, string>();
  for (const f of files) {
    const rl = createInterface({ input: createReadStream(`${RAW}/${f}`), crlfDelay: Infinity });
    let first = true;
    for await (const line of rl) {
      if (first) { first = false; continue; } // header meta line
      const rec = JSON.parse(line) as { verejna_zakazka?: { zadavaci_postupy?: unknown[] } };
      for (const zp of rec.verejna_zakazka?.zadavaci_postupy ?? []) {
        const zads = (zp as { zadavatel_zadavaciho_postupu?: { zadavatele?: unknown[] } }).zadavatel_zadavaciho_postupu?.zadavatele ?? [];
        for (const z of zads) {
          const zz = z as { kategorie_zadavatele?: unknown; subjekt?: { ico?: unknown } };
          const cat = str(zz.kategorie_zadavatele);
          const icoRaw = zz.subjekt?.ico;
          if (!cat || icoRaw == null) continue;
          byIco.set(String(icoRaw).padStart(8, "0"), cat);
        }
      }
    }
  }
  return byIco;
}

async function main() {
  const cpv = arg("cpv") ?? "45";
  const d = new Date();
  const stamp = `${d.toISOString().slice(0, 10)}-${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;

  const catByIco = await extractCategories(cpv);
  console.log(`categories recovered from NDJSON: ${catByIco.size} IČOs`);

  const store = await getStore();
  if (!store) throw new Error("no store");
  const tenders = await store.listKgNodes({ kind: "tender", limit: KG_READ_CAP });
  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  await store.close();
  const label = new Map(companies.map((c) => [c.id, c.label]));

  const scoped = tenders.filter((t) => str(t.props?.cpv_division) === cpv);
  interface Row { ico: string; category: string | null; arena: string; lots: number; flagged: number; czk: number }
  const rows = new Map<string, Row>();
  for (const t of scoped) {
    const ico = str(t.props?.authority_ico);
    if (!ico) continue;
    const cat = catByIco.get(ico) ?? null;
    const arena = cat ? (ARENA[cat] ?? "nejasne") : "nejasne";
    const r = rows.get(ico) ?? { ico, category: cat, arena, lots: 0, flagged: 0, czk: 0 };
    r.lots++;
    if (Array.isArray(t.props?.flags) && (t.props!.flags as string[]).length) r.flagged++;
    const czk = typeof t.props?.lowest_bid_czk === "number" ? t.props.lowest_bid_czk : typeof t.props?.estimated_czk_no_vat === "number" ? t.props.estimated_czk_no_vat : 0;
    r.czk += czk;
    rows.set(ico, r);
  }

  // census per arena
  const census = new Map<string, { authorities: number; lots: number; flagged: number; czk: number }>();
  for (const r of rows.values()) {
    const c = census.get(r.arena) ?? { authorities: 0, lots: 0, flagged: 0, czk: 0 };
    c.authorities++;
    c.lots += r.lots;
    c.flagged += r.flagged;
    c.czk += r.czk;
    census.set(r.arena, c);
  }

  const withCat = [...rows.values()].filter((r) => r.category != null);
  const payload = {
    proposals: withCat.map((r) => ({
      id: `company:ico:${r.ico}`,
      props: {
        tender_authority_category: r.category,
        electoral_arena: r.arena,
      },
    })),
  };
  const out = `docs/data-analysis/case-tender/payloads/arena-cpv${cpv}-${stamp}.json`;
  writeFileSync(out, JSON.stringify(payload) + "\n", "utf8");
  const evid = {
    generatedFor: "tender loop — electoral arena mapping",
    generatedAt: stamp,
    scope: { cpv, authoritiesInCorpus: rows.size, withCategory: withCat.length, withoutCategory: rows.size - withCat.length },
    arenaCensus: Object.fromEntries([...census.entries()].map(([k, v]) => [k, { ...v, flaggedShare: v.lots ? +(v.flagged / v.lots).toFixed(3) : 0 }])),
    mapping: ARENA,
    biggestUnresolved: [...rows.values()].filter((r) => r.arena === "nejasne").sort((a, b) => b.lots - a.lots).slice(0, 15)
      .map((r) => ({ ico: r.ico, name: label.get(`company:ico:${r.ico}`) ?? r.ico, category: r.category, lots: r.lots })),
  };
  writeFileSync(`docs/data-analysis/case-tender/arena-census-cpv${cpv}-${stamp}.json`, JSON.stringify(evid, null, 2) + "\n", "utf8");

  const czkB = (n: number) => `${(n / 1e9).toFixed(1)} mld.`;
  console.log(`\nauthorities in corpus: ${rows.size} · with category: ${withCat.length} · without: ${rows.size - withCat.length}\n`);
  console.log(`ARENA CENSUS (which ballot holds the buyer accountable):`);
  for (const [a, c] of [...census.entries()].sort((x, y) => y[1].lots - x[1].lots))
    console.log(`  ${a.padEnd(10)} ${String(c.authorities).padStart(5)} authorities  ${String(c.lots).padStart(6)} lots  ${String(c.flagged).padStart(5)} flagged (${((100 * c.flagged) / c.lots).toFixed(1)} %)  ${czkB(c.czk).padStart(10)} CZK floor`);
  console.log(`\nlargest UNRESOLVED (nejasne — need an ownership hop, never a guess):`);
  for (const r of evid.biggestUnresolved.slice(0, 8)) console.log(`  ${String(r.lots).padStart(5)} lots  ${r.name.slice(0, 52)}  [${r.category ?? "bez kategorie"}]`);
  console.log(`\n-> ${out}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
