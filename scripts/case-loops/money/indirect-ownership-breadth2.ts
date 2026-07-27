/* Money loop — batch 009: the indirect-ownership layer, breadth 2.
 *
 * Batch 008 asked ONE question of the 33 live `owns_stake` edges — "does a SIBLING
 * under the same parent hold public contracts?" — and got 0 genuinely-new leads.
 * The Opus verification pass corrected the framing: that null is near-tautological,
 * because the sibling universe was itself drawn from `linked_to`. Two whole
 * directions were never examined:
 *
 *   (a) PARENT-level  — does the ANCESTOR itself hold public contracts? (8 named
 *       private non-MP-tied parents were listed as untested in batch-008's handoff)
 *   (b) DESCENDANT-level / MULTI-HOP — does anything BELOW the tied company, or
 *       more than one hop above it, hold public contracts?
 *
 * This pass walks the full `owns_stake` closure in BOTH directions from every
 * MP-tied company, to whatever depth the graph carries, and reports every
 * contract-holding node it reaches, tagged with:
 *   - `direction`  : ancestor | descendant | collateral (reached via an ancestor,
 *                    then back down a different branch — the generalized sibling)
 *   - `depth`      : hops from the tied company
 *   - `alreadyTied`: is this reached company ITSELF directly linked_to an MP?
 *                    (the construction-bias flag — a lead is only NEW if false)
 *
 * Every result is a LEAD, cited by graph provenance, never an assertion about a
 * person's conduct. Read-only: no edge written, no `review_state` touched.
 *
 *   PGLITE_PATH=./.pglite-copy-money-b9 npx tsx scripts/case-loops/money/indirect-ownership-breadth2.ts
 */
import { getStore } from "@/lib/db/store";

const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

type Direction = "ancestor" | "descendant" | "collateral";

interface Reached {
  companyId: string;
  company: string;
  direction: Direction;
  depth: number;
  /** the owns_stake hops walked to get here, in order */
  path: { from: string; to: string; role: string | null; share: number | null; validFrom: string | null; validTo: string | null; source: string }[];
  contracts: number;
  contractsCzk: number;
  alreadyTied: boolean;
}

interface Lead extends Reached {
  mp: string;
  mpId: string;
  tiedCompany: string;
  tiedCompanyId: string;
  tieRole: string;
  tieClass: string;
  tieCorroboration: string;
}

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
  const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
  const contracts = await store.listKgNodes({ kind: "contract", limit: 100_000 });
  const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
  const ownsStake = await store.listKgEdges({ rel: "owns_stake", limit: 100_000 });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: 100_000 });

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const personById = new Map(persons.map((p) => [p.id, p]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  // owns_stake direction: src = parent/shareholder, dst = owned company.
  const down = new Map<string, typeof ownsStake>(); // parent -> edges to children
  const up = new Map<string, typeof ownsStake>(); // child -> edges from parents
  for (const e of ownsStake) {
    (down.get(e.src) ?? down.set(e.src, []).get(e.src)!).push(e);
    (up.get(e.dst) ?? up.set(e.dst, []).get(e.dst)!).push(e);
  }

  const contractsByCompany = new Map<string, { id: string; amount: number; signedOn: string | null }[]>();
  for (const e of supplies) {
    const ct = contractById.get(e.dst);
    if (!ct) continue;
    const arr = contractsByCompany.get(e.src) ?? [];
    arr.push({
      id: e.dst,
      amount: num(e.weight) || num((ct.props as Record<string, unknown>)?.amount),
      signedOn: strOrNull((ct.props as Record<string, unknown>)?.signedOn),
    });
    contractsByCompany.set(e.src, arr);
  }

  const tiedCompanyIds = new Set(linked.map((e) => e.dst));
  const hop = (e: (typeof ownsStake)[number]) => {
    const p = (e.props ?? {}) as Record<string, unknown>;
    return {
      from: e.src,
      to: e.dst,
      role: strOrNull(p.role),
      share: numOrNull(p.share),
      validFrom: strOrNull(p.from) ?? strOrNull(p.role_valid_from),
      validTo: strOrNull(p.to) ?? strOrNull(p.role_valid_to),
      source: String(p.source ?? ""),
    };
  };

  /** Walk the whole ownership component reachable from `startId`, both directions,
   *  recording how each node was reached. Cycle-safe (visited set keyed on company id). */
  function walk(startId: string): Reached[] {
    const out: Reached[] = [];
    const seen = new Set<string>([startId]);
    // queue entries carry whether we are still walking strictly upward — once we
    // turn around and go down from an ancestor, the branch is "collateral".
    const queue: { id: string; depth: number; path: Reached["path"]; direction: Direction; wentUp: boolean }[] = [
      { id: startId, depth: 0, path: [], direction: "ancestor", wentUp: false },
    ];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of up.get(cur.id) ?? []) {
        if (seen.has(e.src)) continue;
        seen.add(e.src);
        const next = { id: e.src, depth: cur.depth + 1, path: [...cur.path, hop(e)], direction: "ancestor" as Direction, wentUp: true };
        out.push(record(next));
        queue.push(next);
      }
      for (const e of down.get(cur.id) ?? []) {
        if (seen.has(e.dst)) continue;
        seen.add(e.dst);
        const direction: Direction = cur.wentUp ? "collateral" : "descendant";
        const next = { id: e.dst, depth: cur.depth + 1, path: [...cur.path, hop(e)], direction, wentUp: cur.wentUp };
        out.push(record(next));
        queue.push(next);
      }
    }
    function record(n: { id: string; depth: number; path: Reached["path"]; direction: Direction }): Reached {
      const cs = contractsByCompany.get(n.id) ?? [];
      return {
        companyId: n.id,
        company: companyById.get(n.id)?.label ?? n.id,
        direction: n.direction,
        depth: n.depth,
        path: n.path,
        contracts: cs.length,
        contractsCzk: cs.reduce((s, c) => s + c.amount, 0),
        alreadyTied: tiedCompanyIds.has(n.id),
      };
    }
    return out;
  }

  const leads: Lead[] = [];
  const chainsExamined: { mpId: string; tiedCompanyId: string; tiedCompany: string; reached: number; withContracts: number }[] = [];

  for (const tie of linked) {
    const tiedComp = companyById.get(tie.dst);
    if (!tiedComp) continue;
    if (!up.has(tie.dst) && !down.has(tie.dst)) continue; // not in the ownership layer at all
    const reached = walk(tie.dst);
    const withMoney = reached.filter((r) => r.contracts > 0);
    chainsExamined.push({
      mpId: tie.src,
      tiedCompanyId: tie.dst,
      tiedCompany: tiedComp.label,
      reached: reached.length,
      withContracts: withMoney.length,
    });
    const p = (tie.props ?? {}) as Record<string, unknown>;
    for (const r of withMoney) {
      leads.push({
        ...r,
        mp: personById.get(tie.src)?.label ?? tie.src,
        mpId: tie.src,
        tiedCompany: tiedComp.label,
        tiedCompanyId: tie.dst,
        tieRole: String(p.role ?? ""),
        tieClass: String(p.tie_class ?? ""),
        tieCorroboration: String(p.corroboration ?? ""),
      });
    }
  }

  // ── the honest denominators ────────────────────────────────────────────────
  const uniqueChains = new Set(chainsExamined.map((c) => `${c.mpId}|${c.tiedCompanyId}`)).size;
  const byDirection = (d: Direction) => leads.filter((l) => l.direction === d);
  const genuinelyNew = leads.filter((l) => !l.alreadyTied);

  console.log(`graph: ${companies.length} companies · ${linked.length} linked_to · ${ownsStake.length} owns_stake · ${supplies.length} supplies`);
  console.log(`\ntied companies inside the ownership layer: ${uniqueChains} (of ${new Set(linked.map((e) => e.dst)).size} distinct tied companies)`);
  console.log(`chain rows (tie x tied-company, NOT edges): ${chainsExamined.length}`);
  console.log(`\nreached contract-holding companies: ${leads.length} lead rows`);
  for (const d of ["ancestor", "descendant", "collateral"] as Direction[]) {
    const rows = byDirection(d);
    const fresh = rows.filter((r) => !r.alreadyTied);
    console.log(`  ${d.padEnd(11)} ${String(rows.length).padStart(3)} rows · ${fresh.length} NOT already directly tied · max depth ${Math.max(0, ...rows.map((r) => r.depth))}`);
  }

  console.log(`\nGENUINELY NEW exposure (reached company is NOT itself linked_to an MP): ${genuinelyNew.length}`);
  const seenPair = new Set<string>();
  for (const l of genuinelyNew.sort((a, b) => b.contractsCzk - a.contractsCzk)) {
    const k = `${l.mpId}|${l.companyId}`;
    if (seenPair.has(k)) continue;
    seenPair.add(k);
    console.log(
      `  ${l.mp} — tied to ${l.tiedCompany} [${l.tieClass}/${l.tieCorroboration}]\n` +
        `      ${l.direction} depth ${l.depth}: ${l.company} — ${l.contracts} contracts, ${l.contractsCzk.toLocaleString("cs-CZ")} CZK`,
    );
  }

  const dir = "docs/data-analysis/case-money";
  await fs.writeFile(
    `${dir}/qmoney-indirect-breadth2-b9.json`,
    JSON.stringify(
      {
        batch: 9,
        track: "money",
        kind: "indirect-ownership-breadth2",
        generatedAt: new Date().toISOString().slice(0, 10),
        note:
          "READ-ONLY analytical pass, no graph writes. Generalizes batch-008's sibling-only check to the FULL " +
          "owns_stake closure in both directions (ancestor / descendant / collateral) from every MP-tied company. " +
          "Every entry is a LEAD cited by existing graph provenance, never an assertion about a person's conduct. " +
          "`alreadyTied` is the construction-bias flag batch-008's null result hinged on: a lead is only genuinely " +
          "new exposure when it is false.",
        counts: {
          ownsStakeEdges: ownsStake.length,
          tiedCompaniesInOwnershipLayer: uniqueChains,
          chainRows: chainsExamined.length,
          leadRows: leads.length,
          genuinelyNew: genuinelyNew.length,
          byDirection: {
            ancestor: byDirection("ancestor").length,
            descendant: byDirection("descendant").length,
            collateral: byDirection("collateral").length,
          },
        },
        chainsExamined,
        leads,
      },
      null,
      2,
    ),
  );
  console.log(`\nwritten: ${dir}/qmoney-indirect-breadth2-b9.json`);

  await store.close();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
