/* Money loop — batch 012: what SHOULD "veřejné peníze v dosahu" count?
 *
 * The re-ingest lifted the contract corpus from 2 287 capped rows to 152 702 real ones —
 * and in doing so multiplied the `/penize` headline by 383×, to 7.19 TRILLION CZK, with
 * Ministerstvo financí (4.84 tn), Hlavní město Praha and ČSOB at the top. Every one of
 * those is a public body or an ownership parent whose contracting is its own activity.
 *
 * So the re-ingest did not break the metric; it exposed that the metric was already
 * unsound and the 25-contract cap had been hiding it. A bigger, more complete number
 * behind the same label would be a WORSE lie than the floor it replaced.
 *
 * This measures the alternatives against the real corpus so the choice is made on
 * evidence: how much of the reachable total survives each attribution rule the case
 * already has (tie_class, and the ownership-based public-mandate test from batch 010).
 *
 *   PGLITE_PATH=./.pglite-copy-money-b12 npx tsx scripts/case-loops/money/reachable-metric-audit.ts
 */
import { getStore } from "@/lib/db/store";

const OUT = "docs/data-analysis/case-money/qmoney-reachable-metric-b12.json";
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** A contract date the register plainly cannot mean. Registr smluv began 2016-07-01, but
 *  the corpus legitimately carries earlier contracts published later; anything outside
 *  this window is a publisher typo (the real corpus contains 0002-02-25 and 3062-07-16). */
const PLAUSIBLE_FROM = "1990-01-01";
const PLAUSIBLE_TO = "2035-12-31";

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store");
  const fs = await import("node:fs/promises");

  const contracts = await store.listKgNodes({ kind: "contract", limit: 500_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 500_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  await store.close();

  const contractById = new Map(contracts.map((c) => [c.id, c]));

  /** Best (most attributable) tie class per company across all its ties. */
  const RANK: Record<string, number> = { "owner-operator": 0, manager: 1, steward: 2 };
  const classByCompany = new Map<string, string>();
  for (const e of linked) {
    const cls = String((e.props as Record<string, unknown>)?.tie_class ?? "");
    if (!cls) continue;
    const cur = classByCompany.get(e.dst);
    if (!cur || (RANK[cls] ?? 9) < (RANK[cur] ?? 9)) classByCompany.set(e.dst, cls);
  }

  interface Bucket { companies: Set<string>; contracts: number; czk: number }
  const mk = (): Bucket => ({ companies: new Set(), contracts: 0, czk: 0 });
  const all = mk();
  const byClass: Record<string, Bucket> = { "owner-operator": mk(), manager: mk(), steward: mk(), untied: mk() };
  const plausibleOnly = mk();
  const direction: Record<string, Bucket> = { recipient: mk(), unknown: mk(), payer: mk() };
  let implausibleDate = 0;
  let noDate = 0;

  for (const e of supplies) {
    const node = contractById.get(e.dst);
    if (!node) continue;
    const props = (node.props ?? {}) as Record<string, unknown>;
    const amount = num(props.amount);
    const cls = classByCompany.get(e.src) ?? "untied";
    const dir = String((e.props as Record<string, unknown>)?.direction ?? "unknown");

    const add = (b: Bucket) => {
      b.companies.add(e.src);
      b.contracts++;
      b.czk += amount;
    };
    add(all);
    add(byClass[cls] ?? byClass.untied);
    add(direction[dir] ?? direction.unknown);

    const d = str(props.signedOn);
    if (!d) noDate++;
    else if (d < PLAUSIBLE_FROM || d > PLAUSIBLE_TO) implausibleDate++;
    else add(plausibleOnly);
  }

  const fmt = (b: Bucket) => ({
    companies: b.companies.size,
    contracts: b.contracts,
    czk: b.czk,
    czkPretty: b.czk.toLocaleString("cs-CZ", { maximumFractionDigits: 0 }),
  });

  console.log(`ALL supplies edges: ${fmt(all).contracts} contracts · ${fmt(all).czkPretty} CZK · ${all.companies.size} companies\n`);
  console.log(`by tie_class of the company (the case's own attribution rule):`);
  for (const k of ["owner-operator", "manager", "steward", "untied"]) {
    const f = fmt(byClass[k]);
    console.log(`  ${k.padEnd(15)} ${String(f.companies).padStart(4)} companies · ${String(f.contracts).padStart(7)} contracts · ${f.czkPretty.padStart(24)} CZK`);
  }
  const attributable = byClass["owner-operator"].czk + byClass.manager.czk;
  console.log(`\n  ATTRIBUTABLE (owner-operator + manager): ${attributable.toLocaleString("cs-CZ", { maximumFractionDigits: 0 })} CZK`);
  console.log(`  NOT attributable (steward + untied):     ${(all.czk - attributable).toLocaleString("cs-CZ", { maximumFractionDigits: 0 })} CZK` +
    `  (${((1 - attributable / all.czk) * 100).toFixed(1)}% of the raw total)`);

  console.log(`\nby recorded direction:`);
  for (const k of ["recipient", "unknown", "payer"]) {
    const f = fmt(direction[k]);
    console.log(`  ${k.padEnd(10)} ${String(f.contracts).padStart(7)} contracts · ${f.czkPretty.padStart(24)} CZK`);
  }

  console.log(`\ndate sanity: ${implausibleDate} contract(s) with an impossible signedOn (outside ${PLAUSIBLE_FROM}..${PLAUSIBLE_TO}), ${noDate} with none`);
  console.log(`  total over plausibly-dated contracts only: ${fmt(plausibleOnly).czkPretty} CZK`);

  await fs.writeFile(
    OUT,
    JSON.stringify(
      {
        batch: 12, track: "money", kind: "reachable-metric-audit",
        generatedAt: new Date().toISOString().slice(0, 10),
        note:
          "Measured after the contract re-ingest. The raw reachable total is dominated by public bodies and " +
          "ownership parents whose contracting is their own activity — the case's tie_class rule already says " +
          "steward money is never the politician's. Rendering the raw total behind 'veřejné peníze v dosahu' " +
          "would be a larger error than the capped floor it replaces.",
        all: fmt(all),
        byTieClass: Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, fmt(v)])),
        attributableCzk: attributable,
        notAttributableCzk: all.czk - attributable,
        byDirection: Object.fromEntries(Object.entries(direction).map(([k, v]) => [k, fmt(v)])),
        dateSanity: { implausible: implausibleDate, missing: noDate, plausibleOnly: fmt(plausibleOnly) },
        topNonAttributable: [...byClass.steward.companies, ...byClass.untied.companies]
          .slice(0, 0),
      },
      null, 2,
    ),
  );
  console.log(`\nwritten: ${OUT}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
