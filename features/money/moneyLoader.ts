// Server-only: shared raw-data fetch for the /penize surfaces. Both getMoneyData.ts
// (the ledger) and getMpDetail.ts (the per-MP case file) walk the SAME materialized
// money layer of the knowledge graph — person --linked_to--> company --supplies-->
// contract — so this module is the single place that fetches it, keeping the two
// loaders from drifting (e.g. one aggregating contract amounts differently than the
// other). Degrades to null exactly like the loaders that use it: no store, no
// materialized money layer, or a fetch error → null, never a partial/guessed shape.
//
// getStore() carries its own client guard; this must never be imported into a client
// component.

import { getStore } from "@/lib/db/store";
import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import type { ContractLine } from "./moneyTypes";

const TERM = "PSP10";
const CONTRACT_LINES_PER_COMPANY = 400; // generous cap; UI slices its own top-N

export function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function pspIdFromNodeId(id: string): number | null {
  const tail = id.split(":").pop();
  const n = tail ? Number(tail) : NaN;
  return Number.isInteger(n) ? n : null;
}

export interface CompanyContracts {
  count: number;
  czk: number;
  amounts: number[]; // for near-threshold detection
  lines: ContractLine[]; // sorted by amount desc, capped at CONTRACT_LINES_PER_COMPANY
}

export interface MoneyLayer {
  companies: KgNodeRow[];
  persons: KgNodeRow[];
  linked: KgEdgeRow[];
  companyById: Map<string, KgNodeRow>;
  personById: Map<string, KgNodeRow>;
  clubByPerson: Map<number, string>;
  /** company kg_node id → its supplies-reachable contracts, aggregated + line items. */
  contractsByCompany: Map<string, CompanyContracts>;
  /** the pass that materialized the money layer (self-awareness surface). */
  pass: number;
}

export async function loadMoneyLayer(): Promise<MoneyLayer | null> {
  try {
    const store = await getStore();
    if (!store) return null;

    const companies = await store.listKgNodes({ kind: "company", limit: 100_000 });
    const persons = await store.listKgNodes({ kind: "person", limit: 100_000 });
    const contracts = await store.listKgNodes({ kind: "contract", limit: 100_000 });
    const linked = await store.listKgEdges({ rel: "linked_to", limit: 100_000 });
    const supplies = await store.listKgEdges({ rel: "supplies", limit: 100_000 });
    if (linked.length === 0 || companies.length === 0) return null;

    const companyById = new Map(companies.map((c) => [c.id, c]));
    const personById = new Map(persons.map((p) => [p.id, p]));
    const contractById = new Map(contracts.map((c) => [c.id, c]));

    const contractsByCompany = new Map<string, CompanyContracts>();
    for (const e of supplies) {
      const cur = contractsByCompany.get(e.src) ?? { count: 0, czk: 0, amounts: [], lines: [] };
      const ct = contractById.get(e.dst);
      const amount = num(e.weight) || num(ct?.props?.amount);
      cur.count += 1;
      cur.czk += amount;
      if (amount > 0) cur.amounts.push(amount);
      if (cur.lines.length < CONTRACT_LINES_PER_COMPANY) {
        cur.lines.push({
          id: e.dst,
          label: ct?.label ?? e.dst,
          amountCzk: amount > 0 ? amount : null,
          signedOn: (ct?.props?.signedOn as string | null | undefined) ?? null,
        });
      }
      contractsByCompany.set(e.src, cur);
    }
    for (const agg of contractsByCompany.values()) {
      agg.lines.sort((a, b) => (b.amountCzk ?? 0) - (a.amountCzk ?? 0));
    }

    const clubByPerson = new Map<number, string>();
    try {
      const mandates = await store.listMandates({ termCode: TERM });
      const clubByMandate = await store.clubByMandate(TERM);
      for (const m of mandates) {
        const club = clubByMandate.get(m.pspId);
        if (club) clubByPerson.set(m.personPspId, club);
      }
    } catch (err) {
      // clubs are decorative here — absence must not drop the money picture.
      console.warn("[moneyLoader] club resolution failed; continuing without clubs", err);
    }

    const pass = num((linked[0]?.provenance as Record<string, unknown> | undefined)?.pass) || 0;

    return { companies, persons, linked, companyById, personById, clubByPerson, contractsByCompany, pass };
  } catch {
    return null;
  }
}
