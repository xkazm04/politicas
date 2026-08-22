/* Money loop — batch 014 triage: what does `direction: unknown` actually cost us?
 *
 * Batch 012 put direction into the graph and found it STATED in only ~18 % of `supplies`
 * edges. Batch 013's steering asked for "a targeted pass on the highest-value unknowns".
 * Before spending that pass, this measures the thing that would justify it:
 *
 *   How much of the figure `/penize` actually RENDERS — `contractCzkAttributable`
 *   (owner-operator + manager companies, per-company de-duplicated) — rests on contracts
 *   whose direction nobody has established?
 *
 * A `payer` contract is money the company sent TO the state; the ingest refused those an
 * edge (23 of them). An `unknown` one may be either. If the unknown share of the
 * attributable headline is small, the steering item is a nice-to-have; if it is most of
 * it, the headline is an assumption wearing a number.
 *
 * Deterministic, read-only, on a COPY. No LLM, no network, no writes.
 *
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/direction-triage-b14.ts
 */
import { getStore } from "@/lib/db/store";
import { resolveTieClass } from "@/features/money/reviewTypes";
import { isAttributable } from "@/features/money/reachableMoney";
import { KG_READ_CAP } from "@/lib/db/readCap";

const OUT = "docs/data-analysis/case-money/qmoney-direction-b14.json";
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

type Direction = "recipient" | "payer" | "unknown";
const dirOf = (v: unknown): Direction => (v === "recipient" || v === "payer" ? v : "unknown");

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const contracts = await store.listKgNodes({ kind: "contract", limit: KG_READ_CAP });
  const persons = await store.listKgNodes({ kind: "person", limit: KG_READ_CAP });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: KG_READ_CAP });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: KG_READ_CAP });
  await store.close();

  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const personById = new Map(persons.map((p) => [p.id, p]));

  // --- the attribution frame: which companies feed the rendered headline ---------------
  // Rule 3 of reachableMoney: a company is attributable if ANY of its ties is
  // owner-operator or manager. Class resolution goes through the SHARED resolver, never a
  // local copy (the lesson triage.ts paid for).
  const tiedCompanyIds = new Set<string>();
  const attributableCompanyIds = new Set<string>();
  const tiesByCompany = new Map<string, { person: string; role: string; tieClass: string }[]>();
  for (const e of linked) {
    const comp = companyById.get(e.dst);
    if (!comp) continue;
    tiedCompanyIds.add(comp.id);
    const role = String(e.props?.role ?? "");
    const cls = resolveTieClass(e.props?.tie_class, role, comp.label);
    if (isAttributable(cls.tieClass)) attributableCompanyIds.add(comp.id);
    const list = tiesByCompany.get(comp.id) ?? [];
    list.push({ person: personById.get(e.src)?.label ?? e.src, role, tieClass: cls.tieClass });
    tiesByCompany.set(comp.id, list);
  }

  // --- direction census, three nested frames -------------------------------------------
  interface Frame {
    edges: number;
    czk: number;
    byDirection: Record<Direction, { edges: number; czk: number }>;
  }
  const frame = (): Frame => ({
    edges: 0,
    czk: 0,
    byDirection: {
      recipient: { edges: 0, czk: 0 },
      payer: { edges: 0, czk: 0 },
      unknown: { edges: 0, czk: 0 },
    },
  });
  const whole = frame();
  const tied = frame();
  const attributable = frame();

  interface UnknownRow {
    contractId: string;
    idSmlouvy: string;
    companyId: string;
    company: string;
    ico: string | null;
    amount: number;
    signedOn: string | null;
    subject: string | null;
    tieClasses: string[];
    persons: string[];
  }
  const unknowns: UnknownRow[] = [];
  // Per-company unknown exposure INSIDE the attributable frame — the thing a targeted
  // pass would actually work through.
  const perCompany = new Map<
    string,
    { company: string; ico: string | null; unknownEdges: number; unknownCzk: number; knownCzk: number }
  >();

  for (const e of supplies) {
    const c = contractById.get(e.dst);
    if (!c) continue; // dangling edge — counted below, never silently folded into a total
    const props = (c.props ?? {}) as Record<string, unknown>;
    const amount = num(props.amount);
    const d = dirOf(e.props?.direction);

    const bump = (f: Frame) => {
      f.edges++;
      f.czk += amount;
      f.byDirection[d].edges++;
      f.byDirection[d].czk += amount;
    };
    bump(whole);
    if (!tiedCompanyIds.has(e.src)) continue;
    bump(tied);
    if (!attributableCompanyIds.has(e.src)) continue;
    bump(attributable);

    const comp = companyById.get(e.src);
    const ico = str(comp?.props?.ico);
    const row = perCompany.get(e.src) ?? {
      company: comp?.label ?? e.src,
      ico,
      unknownEdges: 0,
      unknownCzk: 0,
      knownCzk: 0,
    };
    if (d === "unknown") {
      row.unknownEdges++;
      row.unknownCzk += amount;
      const ties = tiesByCompany.get(e.src) ?? [];
      unknowns.push({
        contractId: c.id,
        idSmlouvy: c.id.split(":").pop() ?? c.id,
        companyId: e.src,
        company: comp?.label ?? e.src,
        ico,
        amount,
        signedOn: str(props.signedOn),
        subject: str(props.subject),
        tieClasses: [...new Set(ties.map((t) => t.tieClass))],
        persons: [...new Set(ties.map((t) => t.person))],
      });
    } else {
      row.knownCzk += amount;
    }
    perCompany.set(e.src, row);
  }

  const danglingEdges = supplies.filter((e) => !contractById.has(e.dst)).length;

  unknowns.sort((a, b) => b.amount - a.amount || a.contractId.localeCompare(b.contractId));
  const companyRows = [...perCompany.entries()]
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => b.unknownCzk - a.unknownCzk || a.id.localeCompare(b.id));

  const pct = (part: number, total: number) =>
    total > 0 ? Number(((part / total) * 100).toFixed(2)) : 0;

  const report = {
    generatedFor: "money batch 014",
    method: "deterministic census of supplies-edge `direction` in three nested frames",
    corpus: {
      companies: companies.length,
      contracts: contracts.length,
      suppliesEdges: supplies.length,
      linkedToEdges: linked.length,
      danglingSuppliesEdges: danglingEdges,
      tiedCompanies: tiedCompanyIds.size,
      attributableCompanies: attributableCompanyIds.size,
    },
    frames: {
      whole: { ...whole, unknownCzkShare: pct(whole.byDirection.unknown.czk, whole.czk) },
      tied: { ...tied, unknownCzkShare: pct(tied.byDirection.unknown.czk, tied.czk) },
      attributable: {
        ...attributable,
        unknownCzkShare: pct(attributable.byDirection.unknown.czk, attributable.czk),
      },
    },
    // NOTE: `attributable.czk` here is the RAW per-edge sum over attributable companies.
    // The rendered headline de-duplicates per company; a company tied to two MPs is one
    // company in both, so the two agree only when no attributable company is double-tied.
    topUnknownCompanies: companyRows.slice(0, 40),
    topUnknownContracts: unknowns.slice(0, 200),
    unknownContractCount: unknowns.length,
  };

  await fs.writeFile(OUT, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(`corpus: ${supplies.length} supplies edges, ${danglingEdges} dangling`);
  for (const [name, fr] of Object.entries(report.frames)) {
    console.log(`\n[${name}] ${fr.edges} edges - ${Math.round(fr.czk).toLocaleString("cs-CZ")} CZK`);
    for (const d of ["recipient", "payer", "unknown"] as const) {
      const b = fr.byDirection[d];
      console.log(
        `   ${d.padEnd(10)} ${String(b.edges).padStart(7)} edges  ${Math.round(b.czk)
          .toLocaleString("cs-CZ")
          .padStart(20)} CZK  (${pct(b.czk, fr.czk)} % of frame CZK)`,
      );
    }
  }
  console.log(`\ntop unknown-direction companies (attributable frame):`);
  for (const r of companyRows.slice(0, 12)) {
    console.log(
      `   ${Math.round(r.unknownCzk).toLocaleString("cs-CZ").padStart(18)} CZK  ${String(
        r.unknownEdges,
      ).padStart(5)} sml.  ${r.company}`,
    );
  }
  console.log(`\n-> ${OUT}`);
}

main();
