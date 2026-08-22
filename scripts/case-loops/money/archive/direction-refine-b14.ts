/* Money loop — batch 014: the co-signatory defect.
 *
 * WHAT THE TRIAGE TURNED UP. `direction-triage-b14.ts` found 66 % of the rendered
 * attributable headline (28.39 bn of 42.89 bn CZK) sitting on `supplies` edges whose
 * direction is `unknown`, and 68 % of THAT on one company. Reading the top rows against
 * the raw register showed the unknowns are not a coin flip:
 *
 *   contract:21554117 — 4 444 444 444 CZK, "Multifunkční hala v Brně". Publisher
 *   Statutární město Brno is flagged `platce`; HOCHTIEF CZ a.s. is flagged `prijemce`;
 *   Brněnské komunikace, ARENA BRNO and **Teplárny Brno** are parties with NO flag.
 *   The register is naming who gets the money, and it is not Teplárny Brno — yet the
 *   graph gives Teplárny Brno a `supplies` edge and `reachableMoney` reads the FULL
 *   4.44 bn as money reaching a company Petr Hladík chaired.
 *
 * `directionFor` returns `unknown` there because its "only the other side is flagged"
 * shortcut is guarded on `sides.length === 2`. On a 4-party record it declines to answer
 * — correctly, in the sense that it refuses to guess, but the register is NOT silent: it
 * has named a recipient, and that recipient is someone else. `unknown` here is a
 * DIFFERENT epistemic state from "the register said nothing", and collapsing the two is
 * what let a co-signatory keep a headline figure.
 *
 * WHAT THIS SCRIPT DOES. Partitions every unknown-direction edge into its actual states,
 * deterministically, from `contract.props.parties` (the flags, as ingested):
 *
 *   non-recipient   — some OTHER party is flagged `prijemce`, ours is not. The register
 *                     named a recipient and it is not us.
 *   co-recipient    — ours IS flagged `prijemce` alongside others (this is `recipient`
 *                     already, but the FULL amount is attributed to each of them).
 *   silent          — no party on the record carries any flag. Genuinely unknown.
 *   sole-party      — ours is the only contracting party; the publisher is the
 *                     counterpart. Unknown, but a two-body problem.
 *
 * and prices each state inside the attributable frame — the money `/penize` renders.
 *
 * Read-only, no network, no LLM, on a COPY. Emits a payload; writes nothing.
 *
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/direction-refine-b14.ts
 */
import { getStore } from "@/lib/db/store";
import { resolveTieClass } from "@/features/money/reviewTypes";
import { isAttributable } from "@/features/money/reachableMoney";
import { KG_READ_CAP } from "@/lib/db/readCap";
import { partiesOf, publisherIcoOf, refineState, type PartyState } from "./partyStates";

const OUT = "docs/data-analysis/case-money/qmoney-cosignatory-b14.json";
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

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

  const attributableCompanyIds = new Set<string>();
  const tiedCompanyIds = new Set<string>();
  const personsByCompany = new Map<string, Set<string>>();
  for (const e of linked) {
    const comp = companyById.get(e.dst);
    if (!comp) continue;
    tiedCompanyIds.add(comp.id);
    const cls = resolveTieClass(e.props?.tie_class, String(e.props?.role ?? ""), comp.label);
    if (isAttributable(cls.tieClass)) attributableCompanyIds.add(comp.id);
    const set = personsByCompany.get(comp.id) ?? new Set<string>();
    set.add(personById.get(e.src)?.label ?? e.src);
    personsByCompany.set(comp.id, set);
  }

  const STATES: PartyState[] = [
    "flagged-recipient",
    "flagged-payer",
    "co-recipient",
    "non-recipient",
    "silent",
    "sole-party",
    "inferred-payer",
  ];
  const bucket = () => Object.fromEntries(STATES.map((s) => [s, { edges: 0, czk: 0 }])) as Record<
    PartyState,
    { edges: number; czk: number }
  >;
  const attributable = bucket();
  const tied = bucket();

  interface Row {
    contractId: string;
    company: string;
    ico: string;
    amount: number;
    signedOn: string | null;
    state: PartyState;
    flaggedRecipients: string[];
    partyCount: number;
    persons: string[];
    sourceUrl: string | null;
  }
  const nonRecipient: Row[] = [];
  const coRecipient: Row[] = [];
  const perCompany = new Map<string, { company: string; ico: string; nonRecipientEdges: number; nonRecipientCzk: number; coRecipientCzk: number; totalCzk: number }>();
  let noParties = 0;

  for (const e of supplies) {
    if (!tiedCompanyIds.has(e.src)) continue;
    const c = contractById.get(e.dst);
    const comp = companyById.get(e.src);
    if (!c || !comp) continue;
    const props = (c.props ?? {}) as Record<string, unknown>;
    const ico = str(comp.props?.ico) ?? comp.id.split(":").pop() ?? "";
    const amount = num(props.amount);
    const parties = partiesOf(props);
    if (parties.length === 0) noParties++;
    const state = refineState(parties, ico, publisherIcoOf(props));

    tied[state].edges++;
    tied[state].czk += amount;
    if (!attributableCompanyIds.has(e.src)) continue;
    attributable[state].edges++;
    attributable[state].czk += amount;

    const agg = perCompany.get(e.src) ?? {
      company: comp.label,
      ico,
      nonRecipientEdges: 0,
      nonRecipientCzk: 0,
      coRecipientCzk: 0,
      totalCzk: 0,
    };
    agg.totalCzk += amount;
    if (state === "non-recipient" || state === "co-recipient") {
      const row: Row = {
        contractId: c.id,
        company: comp.label,
        ico,
        amount,
        signedOn: str(props.signedOn),
        state,
        flaggedRecipients: parties.filter((p) => p.prijemce && p.ico !== ico).map((p) => p.nazev),
        partyCount: parties.length,
        persons: [...(personsByCompany.get(e.src) ?? [])],
        sourceUrl: str(props.sourceUrl),
      };
      if (state === "non-recipient") {
        nonRecipient.push(row);
        agg.nonRecipientEdges++;
        agg.nonRecipientCzk += amount;
      } else {
        coRecipient.push(row);
        agg.coRecipientCzk += amount;
      }
    }
    perCompany.set(e.src, agg);
  }

  const bySize = (a: Row, b: Row) => b.amount - a.amount || a.contractId.localeCompare(b.contractId);
  nonRecipient.sort(bySize);
  coRecipient.sort(bySize);

  const sum = (b: Record<PartyState, { edges: number; czk: number }>) =>
    STATES.reduce((t, s) => t + b[s].czk, 0);
  const attrTotal = sum(attributable);
  const pct = (p: number, t: number) => (t > 0 ? Number(((p / t) * 100).toFixed(2)) : 0);

  const report = {
    generatedFor: "money batch 014",
    method:
      "deterministic partition of supplies edges by the ingested party flags on the contract node (`props.parties`)",
    caveat:
      "the publisher's own platce/prijemce flags were not retained at ingest; every state here is decided from `parties` alone",
    contractsWithoutPartyList: noParties,
    frames: {
      attributable: {
        totalCzk: attrTotal,
        byState: Object.fromEntries(
          STATES.map((s) => [s, { ...attributable[s], czkShare: pct(attributable[s].czk, attrTotal) }]),
        ),
      },
      tied: { totalCzk: sum(tied), byState: tied },
    },
    nonRecipientCount: nonRecipient.length,
    coRecipientCount: coRecipient.length,
    topNonRecipient: nonRecipient.slice(0, 60),
    topCoRecipient: coRecipient.slice(0, 40),
    perCompany: [...perCompany.values()]
      .filter((r) => r.nonRecipientCzk > 0 || r.coRecipientCzk > 0)
      .sort((a, b) => b.nonRecipientCzk - a.nonRecipientCzk)
      .slice(0, 40),
  };
  await fs.writeFile(OUT, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(`attributable frame — ${Math.round(attrTotal).toLocaleString("cs-CZ")} CZK over ${STATES.reduce((t, s) => t + attributable[s].edges, 0)} edges`);
  for (const s of STATES) {
    const b = attributable[s];
    console.log(
      `   ${s.padEnd(18)} ${String(b.edges).padStart(6)} edges ${Math.round(b.czk)
        .toLocaleString("cs-CZ")
        .padStart(20)} CZK  (${pct(b.czk, attrTotal)} %)`,
    );
  }
  console.log(`\ncontracts with no party list at all: ${noParties}`);
  console.log(`\nlargest NON-RECIPIENT attributions (the register named someone else):`);
  for (const r of nonRecipient.slice(0, 10)) {
    console.log(
      `   ${Math.round(r.amount).toLocaleString("cs-CZ").padStart(16)} CZK  ${r.signedOn ?? "?"}  ${r.company} -> recipient: ${r.flaggedRecipients.join(", ")}`,
    );
  }
  console.log(`\n-> ${OUT}`);
}

main();
