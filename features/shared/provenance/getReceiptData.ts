// Server-only: načtení jedné účtenky původu pro /zdroj/[ref].
//
// Adresa nese celý identifikátor tvrzení (viz claimRef.ts), takže tohle je
// čisté ČTENÍ: dvě-tři indexované sondy do grafu + případná auditní stopa,
// žádný zápis, žádný celorelační scan. Degradace drží konvenci loaderů:
//   nerozluštitelný ref  → "invalid"      (stránka odpoví 404 — adresa je tvrzení)
//   store nedostupný     → "unavailable"  (DataUnavailable, nikdy 404 — záznam
//                                          nejspíš existuje, jen k němu nemáme přístup)
//   záznam v grafu není  → "gone"         (poctivé „dnešní graf tohle tvrzení
//                                          nenese", HTTP 200 — vzor Exponátu)
//
// Lidská brána: u gated relací (`linked_to`) se čte i auditní stopa
// rozhodnutí — účtenka ukazuje STAV brány a její historii; obsah hrany je už
// dnes veřejný na /penize (kniha vazeb), takže tu nic neodhalujeme navíc.
//
// Import `server-only` udělá z importu v klientské komponentě build-time chybu.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import type { ReviewAuditRow } from "@/lib/db/types";
import { decodeClaimRef } from "./claimRef";
import {
  deriveEdgeReceipt,
  deriveNodeReceipt,
  GATED_RELS,
  type ProvenanceReceipt,
} from "./receipt";

export type ReceiptResult =
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "gone"; ref: string }
  | { status: "ok"; receipt: ProvenanceReceipt };

export const getReceiptData = cache(async function getReceiptData(
  encodedRef: string,
): Promise<ReceiptResult> {
  const ref = decodeClaimRef(encodedRef);
  if (!ref) return { status: "invalid" };

  try {
    const store = await getStore();
    if (!store) return { status: "unavailable" };
    // Bez kardinalitní brány (storeReady): tohle je bodové čtení jednoho
    // záznamu, ne agregát — polozaingestovaný graf tu nemůže vyrobit falešné
    // číslo, jen poctivé „gone", a účtenka smí existovat i pro druhy uzlů,
    // na které žádný floor není (hlasování, tisky…).

    if (ref.kind === "node") {
      const [node] = await store.getKgNodes([ref.id]);
      if (!node) return { status: "gone", ref: encodedRef };
      return { status: "ok", receipt: deriveNodeReceipt(node) };
    }

    // Hrana: indexovaná sonda přes kgNeighbours (kg_edge_src_idx) místo
    // celorelačního listKgEdges — pak přesná shoda trojice.
    const read = await store.kgNeighbours({ id: ref.src, rels: [ref.rel], limit: KG_READ_CAP });
    const edge = read.edges.find(
      (e) => e.src === ref.src && e.rel === ref.rel && e.dst === ref.dst,
    );
    if (!edge) return { status: "gone", ref: encodedRef };

    const nodes = await store.getKgNodes([ref.src, ref.dst]);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    let audit: ReviewAuditRow[] = [];
    if (GATED_RELS.has(edge.rel)) {
      audit = await store.listReviewAudit({ src: edge.src, dst: edge.dst });
    }

    return {
      status: "ok",
      receipt: deriveEdgeReceipt({
        edge,
        srcNode: nodeById.get(ref.src),
        dstNode: nodeById.get(ref.dst),
        audit,
      }),
    };
  } catch (err) {
    reportLoaderFailure("getReceiptData", err);
    return { status: "unavailable" };
  }
});
