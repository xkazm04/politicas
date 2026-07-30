// Server-only: živá vrstva vazeb na poslance pro peněžní stopu obce (4D).
//
// Zatímco agregáty smluv jsou generovaná dávka (municipalSuppliers.generated —
// mění se jen re-ingestem grafu), STAV LIDSKÉ KONTROLY vazeb poslanec↔firma se
// mění rozhodnutími na /penize/kontrola a NESMÍ se zmrazit do dávky: odmítnutá
// vazba musí z plochy zmizet s příštím renderem, ne s příští regenerací.
// Proto se tahle vrstva čte živě přes loadMoneyLayer (paritní pravidlo
// moneyLoaderu: chybějící review_state = pending, nikdy verified).
//
// Degradace: sklad neběží → { available: false } — plocha PŘIZNÁ, že vazby
// teď nelze ověřit, místo aby mlčky ukázala „žádné vazby".

import "server-only";
import { cache } from "react";
import { loadMoneyLayer, pspIdFromNodeId } from "@/features/money/moneyLoader";
import { getSupplierTable, icoFromCompanyId } from "./supplierTrail";

export interface SupplierTie {
  pspId: number;
  personName: string;
  role: string;
  /** Odmítnuté vazby se vynechávají; vše ostatní bez `verified` je pending. */
  reviewState: "verified" | "pending_review";
}

export interface SupplierTiesResult {
  /** false = sklad nedostupný — „nelze ověřit", NE „žádné vazby". */
  available: boolean;
  /** IČO protistrany → vazby na poslance (jen IČO z generované dávky). */
  ties: Record<string, SupplierTie[]>;
  /** Pass peněžního grafu, ze kterého vrstva čte (provenience plochy). */
  pass: number;
}

/** Živé vazby poslanec↔firma pro všechna IČO v generované dávce protistran. */
export const getSupplierTies = cache(async function getSupplierTies(): Promise<SupplierTiesResult> {
  const layer = await loadMoneyLayer();
  if (!layer) return { available: false, ties: {}, pass: 0 };

  const supplierIcos = new Set<string>();
  for (const rows of getSupplierTable().values()) {
    for (const r of rows) supplierIcos.add(r.supplierIco);
  }

  const ties: Record<string, SupplierTie[]> = {};
  for (const e of layer.linked) {
    const company = layer.companyById.get(e.dst);
    if (!company) continue;
    const ico = icoFromCompanyId(company.id) ?? (typeof company.props?.ico === "string" ? company.props.ico : null);
    if (ico === null || !supplierIcos.has(ico)) continue;

    // Týž převod stavu jako mapLinkedToTie: absence = pending, nikdy verified.
    const rawState = (e.props?.review_state ?? e.props?.state) as string | undefined;
    if (rawState === "rejected") continue;
    const reviewState: SupplierTie["reviewState"] = rawState === "verified" ? "verified" : "pending_review";

    const pspId = pspIdFromNodeId(e.src);
    if (pspId === null) continue;
    const person = layer.personById.get(e.src);

    (ties[ico] ??= []).push({
      pspId,
      personName: person?.label ?? `psp ${pspId}`,
      role: String(e.props?.role ?? ""),
      reviewState,
    });
  }

  // Deterministické pořadí: ověřené první, pak podle jména a pspId.
  for (const list of Object.values(ties)) {
    list.sort(
      (a, b) =>
        Number(b.reviewState === "verified") - Number(a.reviewState === "verified") ||
        a.personName.localeCompare(b.personName, "cs") ||
        a.pspId - b.pspId,
    );
  }

  return { available: true, ties, pass: layer.pass };
});
