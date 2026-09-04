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
// ČAS ZÁZNAMU (2026-09-04, moonshot G1): volitelné `?k=YYYY-MM-DD` je ČOČKA —
// „ukaž ten záznam tak, jak jsme ho toho dne zveřejnili". Jde přes BODOVÁ
// čtení `asOfEdge`/`asOfNode` (klíčové indexy historie), nikdy přes druhé
// `kgNeighbours` a nikdy přes celorelační `asOf().listKgEdges` — účtenka je
// hot path, historický instrument ne. Pravidla čočky (co je platný den, proč
// se čte KONEC dne, proč „nevíme" není „nezměnilo se") žijí v asOfLens.ts.
//
// ZANIKLÁ ADRESA navíc dostane POSLEDNÍ zaznamenanou verzi: „naposledy
// zaznamenáno … / nahrazeno …". Je to HISTORIE, ne tvrzení — stav zůstává
// "gone", stránka ji sází pod vlastním nadpisem a strojová značka
// (ClaimReview) z ní nejde ven vůbec (app/zdroj/[ref]/page.tsx ji emituje jen
// pro status "ok").
//
// Lidská brána: u gated relací (`linked_to`) se čte i auditní stopa
// rozhodnutí — účtenka ukazuje STAV brány a její historii; obsah hrany je už
// dnes veřejný na /penize (kniha vazeb), takže tu nic neodhalujeme navíc.
// U účtenky K DANÉMU DNI se stopa OŘEŽE na rozhodnutí do toho okamžiku —
// dnešní rozhodnutí pod verzí starou tři měsíce by byl doklad, který lže.
//
// Import `server-only` udělá z importu v klientské komponentě build-time chybu.

import "server-only";
import { cache } from "react";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore, type Store } from "@/lib/db/store";
import { KG_READ_CAP } from "@/lib/db/readCap";
import type { KgEdgeRow, KgNodeRow, ReviewAuditRow } from "@/lib/db/types";
import {
  asOfInstant,
  parseAsOfDay,
  LIVE_AS_OF,
  type ReceiptAsOf,
  type ReceiptLastVersion,
} from "./asOfLens";
import { decodeClaimRef, type ClaimRef } from "./claimRef";
import {
  deriveEdgeReceipt,
  deriveNodeReceipt,
  GATED_RELS,
  toDecodedClaim,
  type DecodedClaim,
  type ProvenanceReceipt,
} from "./receipt";

export type ReceiptResult =
  | { status: "invalid" }
  | { status: "unavailable" }
  /** `decoded` = co adresa TVRDILA. Loader ref stejně luští (jinak by nevěděl,
   *  co hledat), takže ho odsud vydává i tehdy, když dnešní graf záznam nenese —
   *  jinak čtenář, který přišel po citaci, zůstane stát nad base64 blobem. */
  | {
      status: "gone";
      ref: string;
      decoded: DecodedClaim;
      /** null = store o téhle adrese nemá ani historický řádek. */
      last: ReceiptLastVersion | null;
      asOf: ReceiptAsOf;
    }
  | { status: "ok"; receipt: ProvenanceReceipt; asOf: ReceiptAsOf };

/** Rozhodnutí brány do daného okamžiku — pozdější se pod historickou verzi nesází. */
const auditUpTo = (audit: ReviewAuditRow[], instant: string | null): ReviewAuditRow[] =>
  instant === null ? audit : audit.filter((a) => a.decidedAt <= instant);

export const getReceiptData = cache(async function getReceiptData(
  encodedRef: string,
  /** Volitelný ISO den z `?k=`; cokoli jiného je ODMÍTNUTO, ne opraveno. */
  asOfParam?: string | null,
): Promise<ReceiptResult> {
  const ref = decodeClaimRef(encodedRef);
  if (!ref) return { status: "invalid" };

  const asked = typeof asOfParam === "string" && asOfParam.trim() !== "" ? asOfParam.trim() : null;
  const day = parseAsOfDay(asked);
  // `k` byl vyplněn, ale není to den → odmítnutí se NESE dál a plocha ho vysází
  // nad dnešním záznamem. Mlčky sázet dnešek jako „tehdejšek" je horší než 404.
  const refusal: ReceiptAsOf | null = asked !== null && day === null ? { state: "refused", raw: asked } : null;

  try {
    const store = await getStore();
    if (!store) return { status: "unavailable" };
    // Bez kardinalitní brány (storeReady): tohle je bodové čtení jednoho
    // záznamu, ne agregát — polozaingestovaný graf tu nemůže vyrobit falešné
    // číslo, jen poctivé „gone", a účtenka smí existovat i pro druhy uzlů,
    // na které žádný floor není (hlasování, tisky…).

    // ── čočka „k tomu dni" ────────────────────────────────────────────────
    // Bodové čtení nad klíčovými indexy historie. Tři možné odpovědi, tři
    // různé věty: verze (→ účtenka JE historická), „tehdy tohle tvrzení
    // nebylo", a „tak daleko zpátky žádný záznam nevedeme" (epocha).
    let asOf: ReceiptAsOf = refusal ?? LIVE_AS_OF;
    if (day !== null) {
      const at = asOfInstant(day);
      const point =
        ref.kind === "node"
          ? await store.asOfNode(ref.id, at)
          : await store.asOfEdge({ src: ref.src, rel: ref.rel, dst: ref.dst }, at);
      if (!point.known) {
        asOf = { state: "beforeEpoch", day, epoch: point.epoch };
      } else if (point.value === null) {
        asOf = { state: "absentThen", day };
      } else {
        return {
          status: "ok",
          receipt: await receiptFromRow(store, ref, point.value, at),
          asOf: { state: "at", day },
        };
      }
    }

    if (ref.kind === "node") {
      const [node] = await store.getKgNodes([ref.id]);
      // Uzel v grafu není, takže o něm není co dodat — `decoded` nese doslovné
      // id a `kind: null`, aby plocha nenabídla spis, který by vedl do prázdna.
      if (!node) {
        const last = await store.lastKgNodeVersion(ref.id);
        return {
          status: "gone",
          ref: encodedRef,
          decoded: toDecodedClaim(ref, new Map()),
          last: last && {
            receipt: deriveNodeReceipt(last.row),
            recordedAt: last.recordedAt,
            supersededAt: last.supersededAt,
          },
          asOf,
        };
      }
      return { status: "ok", receipt: deriveNodeReceipt(node), asOf };
    }

    // Hrana: indexovaná sonda přes kgNeighbours (kg_edge_src_idx) místo
    // celorelačního listKgEdges — pak přesná shoda trojice.
    const read = await store.kgNeighbours({ id: ref.src, rels: [ref.rel], limit: KG_READ_CAP });
    const edge = read.edges.find(
      (e) => e.src === ref.src && e.rel === ref.rel && e.dst === ref.dst,
    );
    if (!edge) {
      // Zmizela HRANA — koncové uzly (lidé, firmy) v grafu obvykle dál jsou.
      // Jedno bodové indexované čtení navíc (getKgNodes po id) proto koupí
      // čtenáři jména obou stran a odkazy do spisů místo base64 blobu; druhé
      // (lastKgEdgeVersion) mu koupí, co ta hrana naposledy tvrdila a kdy
      // přestala platit.
      const [goneNodes, last] = await Promise.all([
        store.getKgNodes([ref.src, ref.dst]),
        store.lastKgEdgeVersion({ src: ref.src, rel: ref.rel, dst: ref.dst }),
      ]);
      const nodeById = new Map(goneNodes.map((n) => [n.id, n]));
      return {
        status: "gone",
        ref: encodedRef,
        decoded: toDecodedClaim(ref, nodeById),
        last: last && {
          // Auditní stopa se k zaniklé verzi NEPŘIPOJUJE: stopa je dnešní a
          // verze historická; doklad o rozhodnutích patří k živé účtence.
          receipt: deriveEdgeReceipt({
            edge: last.row,
            srcNode: nodeById.get(ref.src),
            dstNode: nodeById.get(ref.dst),
          }),
          recordedAt: last.recordedAt,
          supersededAt: last.supersededAt,
        },
        asOf,
      };
    }

    return { status: "ok", receipt: await receiptFromRow(store, ref, edge, null), asOf };
  } catch (err) {
    reportLoaderFailure("getReceiptData", err);
    return { status: "unavailable" };
  }
});

/**
 * Účtenka z JEDNOHO řádku (dnešního nebo historického). Koncové uzly se čtou
 * `at` — jméno firmy, kterou jsme tehdy vedli pod jiným štítkem, patří k té
 * verzi; dnešní štítek by z dokladu udělal koláž dvou dob.
 */
async function receiptFromRow(
  store: Store,
  ref: ClaimRef,
  row: KgNodeRow | KgEdgeRow,
  at: string | null,
): Promise<ProvenanceReceipt> {
  if (ref.kind === "node") return deriveNodeReceipt(row as KgNodeRow);
  const edge = row as KgEdgeRow;
  // Historická varianta jde přes BODOVÁ čtení (asOfNode), ne přes
  // `asOf(at).getKgNodes` — ten běží nad neindexovanou unií celé tabulky a
  // účtenka je čtená plocha, ne forenzní instrument.
  const nodes =
    at === null
      ? await store.getKgNodes([ref.src, ref.dst])
      : (await Promise.all([store.asOfNode(ref.src, at), store.asOfNode(ref.dst, at)]))
          .map((p) => (p.known ? p.value : null))
          .filter((n): n is KgNodeRow => n !== null);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let audit: ReviewAuditRow[] = [];
  if (GATED_RELS.has(edge.rel)) {
    audit = auditUpTo(await store.listReviewAudit({ src: edge.src, dst: edge.dst }), at);
  }
  return deriveEdgeReceipt({
    edge,
    srcNode: nodeById.get(ref.src),
    dstNode: nodeById.get(ref.dst),
    audit,
  });
}
