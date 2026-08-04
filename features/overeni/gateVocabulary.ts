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
 *  4. Čistý modul, žádný server ani DOM — a od 2026-08-04 vrací KLÍČE do
 *     messages/*.json, ne českou větu. Copy vlastní katalog, slovník vlastní
 *     klasifikaci; jinak by dvojjazyčná plocha měla dva zdroje pravdy.
 */

/** Normalizovaný stav brány. `unmapped` = token, který slovník nezná. */
export type GateStatus = "verified" | "pending_review" | "rejected" | "unmapped";

export interface GateStatusInfo {
  /** Doslovný token ze záznamu — vždy k dispozici, i u přeloženého stavu. */
  token: string;
  /** false ⇒ slovník token nezná; copy říká právě tohle, nic si nedomýšlí. */
  known: boolean;
  status: GateStatus;
  /** Klíč krátkého štítku (řádek „stav lidské brány"); `unmapped` bere {token}. */
  labelKey: string;
  /** Klíč věty v hlavičce verdiktu; `unmapped` bere {token}. */
  headlineKey: string;
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

const LABEL_KEYS: Record<GateStatus, string> = {
  verified: "gate.verified",
  pending_review: "gate.pendingReview",
  rejected: "gate.rejected",
  unmapped: "gate.unmapped",
};

const HEADLINE_KEYS: Record<GateStatus, string> = {
  verified: "gate.headlineVerified",
  pending_review: "gate.headlinePending",
  rejected: "gate.headlineRejected",
  unmapped: "gate.headlineUnmapped",
};

/** Relace, která lidskou branou neprochází — deterministické odvození. */
export const GATE_UNGATED_KEY = "gate.ungated";

/** Prázdná hodnota má vlastní jméno — neznámý stav nikdy nesází prázdno. */
export const GATE_EMPTY_TOKEN_KEY = "gate.emptyToken";

/** Stav brány jako KLASIFIKACE + klíče copy. Neznámý token si nese sám sebe. */
export function gateStatusInfo(raw: string): GateStatusInfo {
  const token = raw.trim();
  const known = KNOWN[token];
  const status: GateStatus = known ?? "unmapped";
  return {
    token,
    known: known !== undefined,
    status,
    labelKey: LABEL_KEYS[status],
    headlineKey: HEADLINE_KEYS[status],
  };
}

/** Všechny klíče, které tenhle modul umí vrátit — pro test úplnosti katalogu. */
export const GATE_COPY_KEYS: readonly string[] = [
  ...Object.values(LABEL_KEYS),
  ...Object.values(HEADLINE_KEYS),
  GATE_UNGATED_KEY,
  GATE_EMPTY_TOKEN_KEY,
];
