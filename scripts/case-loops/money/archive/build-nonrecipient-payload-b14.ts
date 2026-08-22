/* Money loop — batch 014: backfill `direction: "non-recipient"` onto co-signatory edges.
 *
 * THE DEFECT (measured by `direction-refine-b14.ts`). 128 `supplies` edges in the
 * attributable frame — 11 771 399 678 CZK, 27.44 % of the figure `/penize` renders —
 * point at contracts where the register EXPLICITLY flags a different party as `prijemce`
 * and does not flag ours at all. 11.75 bn of that is one company (Teplárny Brno, a.s.)
 * and, through it, one named MP.
 *
 * `directionFor` called these `unknown` because its "only the other side is flagged"
 * shortcut is guarded on `sides.length === 2`. But `unknown` conflates two different
 * states: "the register said nothing" and "the register named a recipient, and it is not
 * us". The second is a NEGATIVE FACT the register asserts, and it is the difference
 * between a supplier and a co-signatory to a tripartite cooperation agreement.
 *
 * This emits a props-merge payload setting `direction: "non-recipient"` on exactly those
 * edges, over the WHOLE corpus (not just the tied slice), so `/graf` and the budget
 * supplier trail read the same fact as `/penize`. Nothing is deleted: the edge stays,
 * because Teplárny Brno really is a party to the Brno hall contract — what changes is
 * that its value is no longer read as money reaching that company.
 *
 * Derived from `contract.props.parties` alone — the flags exactly as ingested. Never from
 * the publisher's flags, which were not retained on the node, and never from a name
 * heuristic.
 *
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/build-nonrecipient-payload-b14.ts
 *   npx tsx scripts/case-loops/persist-batch.ts --payload=docs/data-analysis/case-money/payloads/batch-014-nonrecipient.json --pass=<n> --commit
 */
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { partiesOf, publisherIcoOf, refineState } from "./partyStates";

const OUT = "docs/data-analysis/case-money/payloads/batch-014-nonrecipient.json";
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

async function main() {
  const store = await getStore();
  if (!store) throw new Error("no store (set PGLITE_PATH to the copy)");
  const fs = await import("node:fs/promises");

  const companies = await store.listKgNodes({ kind: "company", limit: KG_READ_CAP });
  const contracts = await store.listKgNodes({ kind: "contract", limit: KG_READ_CAP });
  const supplies = await store.listKgEdges({ rel: "supplies", limit: KG_READ_CAP });
  await store.close();

  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const edges: { src: string; rel: string; dst: string; propsMerge: Record<string, unknown> }[] = [];
  let czk = 0;
  let alreadyMarked = 0;
  let shared = 0;
  let sharedCzk = 0;

  for (const e of supplies) {
    const c = contractById.get(e.dst);
    const comp = companyById.get(e.src);
    if (!c || !comp) continue;
    const ico = str(comp.props?.ico) ?? comp.id.split(":").pop() ?? "";
    const props = (c.props ?? {}) as Record<string, unknown>;
    // Two states, one payload: both are "this money did not reach this company", and both
    // are read off the register's own flags rather than inferred from who the parties are.
    const state = refineState(partiesOf(props), ico, publisherIcoOf(props));

    // A THIRD state, and it is NOT an exclusion. `co-recipient` means the register flags
    // this company as příjemce alongside other companies — so the money genuinely does
    // reach it, but the full contract value is credited to EVERY one of them and the
    // register never says how it splits. Dropping it would understate as badly as
    // counting it whole overstates, so it stays in the total and is MARKED, and the
    // surface names it. Silence was the original defect; a second silence is not a fix.
    if (state === "co-recipient") {
      if (e.props?.recipients_shared === true) {
        alreadyMarked++;
        continue;
      }
      shared++;
      sharedCzk += num(props.amount);
      edges.push({
        src: e.src,
        rel: "supplies",
        dst: e.dst,
        propsMerge: {
          recipients_shared: true,
          recipients_shared_with: partiesOf(props)
            .filter((p) => p.prijemce && p.ico !== ico)
            .map((p) => p.nazev),
        },
      });
      continue;
    }

    if (state !== "non-recipient" && state !== "inferred-payer") continue;
    const direction = state === "non-recipient" ? "non-recipient" : "payer";
    if (e.props?.direction === direction) {
      alreadyMarked++;
      continue; // idempotent: a re-run proposes nothing
    }
    czk += num(props.amount);
    edges.push({
      src: e.src,
      rel: "supplies",
      dst: e.dst,
      propsMerge: {
        direction,
        // The evidence, on the edge, so the surface can say WHO the register named
        // rather than only that it was not us.
        direction_basis:
          direction === "non-recipient"
            ? "registr smluv: jiná smluvní strana označena jako příjemce"
            : "registr smluv: protistrana označena jako příjemce, tato firma je plátce",
        direction_recipients: partiesOf(props)
          .filter((p) => p.prijemce && p.ico !== ico)
          .map((p) => p.nazev),
      },
    });
  }

  const payload = {
    provenanceStamp: {
      track: "money",
      method: "deterministic",
      ref: "registr smluv party flags (<prijemce>) on the contract node, batch 014 co-signatory refinement",
      computedAt: new Date().toISOString(),
    },
    edges,
  };
  await fs.mkdir("docs/data-analysis/case-money/payloads", { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const byDir = edges.reduce<Record<string, number>>((a, e) => {
    const d = e.propsMerge.direction === undefined ? "co-recipient (kept)" : String(e.propsMerge.direction);
    a[d] = (a[d] ?? 0) + 1;
    return a;
  }, {});
  console.log(`edges proposed: ${edges.length} — ${JSON.stringify(byDir)}`);
  console.log(`already marked (idempotent skip): ${alreadyMarked}`);
  console.log(`CZK removed from attribution:    ${Math.round(czk).toLocaleString("cs-CZ")}`);
  console.log(
    `co-recipient marked (kept, shared): ${shared} edges, ${Math.round(sharedCzk).toLocaleString("cs-CZ")} CZK`,
  );
  console.log(`-> ${OUT}`);
}

main();
