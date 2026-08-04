/*
 * SLOVNÍK STAVU LIDSKÉ BRÁNY — jedno místo, kde se strojový token mění ve větu.
 *
 * Brána čte DVA slovníky téže věci a do 2026-08-04 je míchala:
 *   – účtenka původu (features/shared/provenance/receipt.ts) nese
 *     `verified | pending_review | rejected` (ReviewStatus, píše ho
 *     ReviewRepository),
 *   – vydaná figura (lib/claims/claim.ts) nese `verified | pending`
 *     (ClaimReviewStatus, výchozí „pending").
 * Plocha /overeni měla tabulku klíčovanou tvarem účtenky, takže „pending"
 * (2 ze 3 figur v rejstříku) propadlo doslova jako anglický strojový token
 * a chybějící stav se vysázel jako prázdno.
 *
 * Pravidla (vzor features/money/tieFlags.ts):
 *  1. JEDEN slovník pro obě rodiny. `pending` a `pending_review` jsou TÝŽ stav
 *     — čeká na člověka — a mají tutéž větu.
 *  2. Neznámý token se NESKRÝVÁ a nepřekládá se odhadem: vypíše se DOSLOVA
 *     a označí se jako nepřeložený strojový stav. Čtenář má vědět, že záznam
 *     nese značku, kterou produkt zatím neumí přečíst.
 *  3. Chybějící stav není „ověřeno" ani prázdno. Gated relace bez zapsaného
 *     stavu čeká na kontrolu (táž interpretace jako moneyLoader.mapLinkedToTie
 *     a receipt.gateFromEdge) — ale to rozhoduje volající, ne tenhle slovník;
 *     sem přijde už normalizovaný token.
 *  4. Čistý modul, žádný server ani DOM.
 */

/** Normalizovaný stav brány. `unmapped` = token, který slovník nezná. */
export type GateStatus = "verified" | "pending_review" | "rejected" | "unmapped";

export interface GateStatusInfo {
  /** Doslovný token ze záznamu — vždy k dispozici, i u přeloženého stavu. */
  token: string;
  /** false ⇒ slovník token nezná; copy říká právě tohle, nic si nedomýšlí. */
  known: boolean;
  status: GateStatus;
  labelCs: string;
}

/** Tokeny obou rodin → jeden normalizovaný stav. */
const KNOWN: Record<string, Exclude<GateStatus, "unmapped">> = {
  verified: "verified",
  pending_review: "pending_review",
  // ClaimReviewStatus („pending") je TÁŽ fronta jako ReviewStatus
  // („pending_review") — dvě jména jednoho stavu, jedna věta.
  pending: "pending_review",
  rejected: "rejected",
};

const LABELS_CS: Record<Exclude<GateStatus, "unmapped">, string> = {
  verified: "ověřeno člověkem",
  pending_review: "čeká na lidskou kontrolu",
  rejected: "zamítnuto při kontrole",
};

/** Krátký štítek stavu — doslovný token u neznámé hodnoty, nikdy prázdno. */
export function gateStatusInfo(raw: string): GateStatusInfo {
  const token = raw.trim();
  const status = KNOWN[token];
  if (status === undefined) {
    return {
      token,
      known: false,
      status: "unmapped",
      labelCs: `nepřeložený strojový stav: ${token === "" ? "prázdná hodnota" : token}`,
    };
  }
  return { token, known: true, status, labelCs: LABELS_CS[status] };
}

const HEADLINE_CS: Record<Exclude<GateStatus, "unmapped">, string> = {
  verified: "Lidská kontrola: potvrzeno.",
  pending_review: "Lidská kontrola: zatím neproběhla.",
  rejected: "Lidská kontrola: zamítnuto.",
};

/** Věta „lidská kontrola: …" v hlavičce verdiktu — modifikátor verdiktu,
 *  ne verdikt sám (existence záznamu a jeho schválení jsou dvě věci). */
export const gateHeadlineCs = (info: GateStatusInfo): string =>
  info.status === "unmapped"
    ? `Lidská kontrola: ${info.labelCs}.`
    : HEADLINE_CS[info.status];

/** Relace, která lidskou branou neprochází — deterministické odvození. */
export const UNGATED_LABEL_CS = "deterministické odvození — lidskou branou neprochází";
