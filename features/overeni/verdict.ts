/*
 * VERDIKT BRÁNY — čisté odvození odpovědi Civic Claim Gate (/overeni).
 *
 * Tři možné odpovědi, žádná čtvrtá (slovník produktu):
 *
 *   verified — tvrzení sedí, jak bylo citováno: dnešní znovuodvození dává
 *              týž obsah (touž hodnotu / týž otisk / týž záznam grafu);
 *   moved    — adresa je platná, ale hodnota či obsah se od citace pohnuly:
 *              verdikt nese OBĚ strany (citovanou i dnešní) s daty;
 *   unknown  — odkaz brána nezná: nerozluštitelná adresa, figura mimo
 *              rejstřík, nebo záznam, který dnešní odvození už nenese.
 *
 * Vstupy jsou výsledky existujících loaderů rodin (getReceiptData,
 * getPermalinkData, getExhibitData, lib/claims/registry) — brána NIC
 * neodvozuje po svém, jen překládá jejich odpovědi do jednoho slovníku.
 * Typy vstupů jsou strukturální (podmnožiny), aby modul zůstal čistý a
 * testovatelný bez server-only importů.
 */

import { claimStatus } from "@/lib/claims/claim";
import type { IssuedFigure } from "@/lib/claims/registry";
import type { ProvenanceReceipt } from "@/features/shared/provenance/receipt";
import { gateStatusInfo, type GateStatusInfo } from "./gateVocabulary";
import type { DetectedRef, NeznamyReason } from "./refDetect";

// ── Slovník verdiktů ────────────────────────────────────────────────────────

export type VerdictKind = "verified" | "moved" | "unknown";

export type UnknownReason =
  /** Vstup se nedá přečíst jako žádná politicas adresa (viz NeznamyReason). */
  | NeznamyReason
  /** Claim-ref má správný tvar, ale rejstřík vydaných figur ho nezná. */
  | "mimo-rejstrik"
  /** Adresa je čitelná, ale dnešní záznam tvrzení nenese (gone). */
  | "zaznam-nenalezen";

/** Otisková rodina (graf / exponát): obě strany porovnání. */
export interface HashComparison {
  /** Kanonická adresa (path segment) pro odkaz na plnou plochu rodiny. */
  encoded: string;
  /** Titulek obsahu VLASTNĚNÝ rodinou (titul pohledu na graf) — doslovný
   *  text; null ⇒ titulek vlastní brána a nese ho `titleKey`. */
  title: string | null;
  /** Klíč do katalogu `overeni.*` pro titulek, který skládá brána (exponát). */
  titleKey: string | null;
  /** Otisk z vložené adresy — co viděl ten, kdo citoval. */
  citedHash: string;
  /** Otisk dnešního znovuodvození. */
  currentHash: string;
  /** `YYYY-MM-DD` dnešního znovuodvození; datum vydání citace adresa
   *  nenese — plocha to přizná, nedomýšlí ho. */
  currentDate: string;
}

export type GateVerdict =
  // Figura (claim-ref / data-claim-* payload)
  | {
      family: "figura";
      kind: "verified";
      figure: IssuedFigure;
      /** Hodnota, jak ji citoval payload; null = vstup nesl jen ref. */
      citedValue: number | null;
      citedDate: string | null;
    }
  | {
      family: "figura";
      kind: "moved";
      figure: IssuedFigure;
      citedValue: number;
      citedDate: string | null;
    }
  | { family: "figura"; kind: "unknown"; reason: "mimo-rejstrik"; ref: string }
  // Účtenka původu (/zdroj)
  | { family: "zdroj"; kind: "verified"; encoded: string; receipt: ProvenanceReceipt }
  | { family: "zdroj"; kind: "unknown"; reason: "zaznam-nenalezen" | "nerozlustitelny"; encoded: string }
  // Citace pohledu na graf (/graf/p)
  | { family: "graf"; kind: "verified"; view: HashComparison }
  | { family: "graf"; kind: "moved"; view: HashComparison }
  | { family: "graf"; kind: "unknown"; reason: "zaznam-nenalezen" | "nerozlustitelny"; encoded: string }
  // Exponát velína (/dashboard/exponat)
  | { family: "exponat"; kind: "verified"; view: HashComparison }
  | { family: "exponat"; kind: "moved"; view: HashComparison }
  | { family: "exponat"; kind: "unknown"; reason: "zaznam-nenalezen" | "nerozlustitelny"; encoded: string }
  // Nic z politicas
  | { family: "neznamy"; kind: "unknown"; reason: NeznamyReason };

// ── Figura ──────────────────────────────────────────────────────────────────

/** Verdikt nad figurou: rejstřík nezná ⇒ unknown; payload s hodnotou se
 *  porovná přesně (strojové hodnoty jdou přes String(value) round-trip,
 *  takže rovnost čísel je rovnost bajtů); holý ref bez hodnoty dostane
 *  verified s dnešní hodnotou — vstup nic netvrdil, jen se ptal. */
export function figuraVerdict(
  det: Extract<DetectedRef, { family: "figura" }>,
  figure: IssuedFigure | null,
): GateVerdict {
  if (!figure) return { family: "figura", kind: "unknown", reason: "mimo-rejstrik", ref: det.ref };
  const citedValue = det.pasted?.value ?? null;
  const citedDate = det.pasted?.retrievedAt ?? null;
  if (citedValue !== null && !Object.is(citedValue, figure.value)) {
    return { family: "figura", kind: "moved", figure, citedValue, citedDate };
  }
  return { family: "figura", kind: "verified", figure, citedValue, citedDate };
}

// ── Účtenka původu (/zdroj) ─────────────────────────────────────────────────

/** Strukturální podmnožina ReceiptResult (getReceiptData je server-only). */
export type ZdrojLookup =
  | { status: "invalid" }
  | { status: "gone"; ref: string }
  | { status: "ok"; receipt: ProvenanceReceipt };

/** Účtenka nenese hodnotu ani otisk — tvrzením JE záznam grafu sám. Existuje
 *  ⇒ verified (adresa sedí, záznam je tam); nerozluštitelná adresa nebo
 *  záznam, který dnešní graf nenese ⇒ unknown. „Moved" tu z principu není:
 *  hrana buď v grafu je, nebo není.
 *
 *  POZOR: `verified` tu znamená EXISTENCI záznamu, ne jeho schválení. Stav
 *  lidské brány je samostatný modifikátor (verdictGate/verdictHeadline) —
 *  `review_state` je terminální a zamítnutá hrana v grafu ZŮSTÁVÁ, takže bez
 *  toho rozlišení by /zdroj odkaz zamítnuté vazby vysázel obří „OVĚŘENO". */
export function zdrojVerdict(encoded: string, lookup: ZdrojLookup): GateVerdict {
  if (lookup.status === "invalid") {
    return { family: "zdroj", kind: "unknown", reason: "nerozlustitelny", encoded };
  }
  if (lookup.status === "gone") {
    return { family: "zdroj", kind: "unknown", reason: "zaznam-nenalezen", encoded };
  }
  return { family: "zdroj", kind: "verified", encoded, receipt: lookup.receipt };
}

// ── Otiskové rodiny (graf, exponát) ─────────────────────────────────────────

/** Strukturální podmnožina PermalinkResult.view / ExhibitViewModel(ok). */
export interface HashedViewLike {
  urlHash: string;
  currentHash: string;
  fresh: boolean;
}

export type HashedLookup =
  | { status: "invalid" }
  | { status: "gone" }
  | {
      status: "ok";
      view: HashedViewLike;
      /** Doslovný titulek rodiny; null ⇒ použije se `titleKey`. */
      title: string | null;
      /** Klíč titulku, když ho skládá brána. */
      titleKey?: string;
      currentDate: string;
    };

function hashedVerdict(family: "graf" | "exponat", encoded: string, lookup: HashedLookup): GateVerdict {
  if (lookup.status === "invalid") {
    return { family, kind: "unknown", reason: "nerozlustitelny", encoded };
  }
  if (lookup.status === "gone") {
    return { family, kind: "unknown", reason: "zaznam-nenalezen", encoded };
  }
  const view: HashComparison = {
    encoded,
    title: lookup.title,
    titleKey: lookup.titleKey ?? null,
    citedHash: lookup.view.urlHash,
    currentHash: lookup.view.currentHash,
    currentDate: lookup.currentDate,
  };
  return lookup.view.fresh ? { family, kind: "verified", view } : { family, kind: "moved", view };
}

export const grafVerdict = (encoded: string, lookup: HashedLookup): GateVerdict =>
  hashedVerdict("graf", encoded, lookup);

export const exponatVerdict = (encoded: string, lookup: HashedLookup): GateVerdict =>
  hashedVerdict("exponat", encoded, lookup);

export const neznamyVerdict = (reason: NeznamyReason): GateVerdict => ({
  family: "neznamy",
  kind: "unknown",
  reason,
});

// ── Stav lidské brány jako modifikátor verdiktu ─────────────────────────────

/** Kde verdikt stojí vůči LIDSKÉ BRÁNĚ — samostatně od toho, zda záznam
 *  existuje a zda sedí. `ungated` = deterministické odvození (negated relace,
 *  uzel, otiskové rodiny), null = na co se ptát není (neznámý odkaz). */
export type GateStanding =
  | { kind: "gated"; info: GateStatusInfo }
  | { kind: "ungated" };

export function verdictGate(v: GateVerdict): GateStanding | null {
  if (v.kind === "unknown") return null;
  if (v.family === "figura") {
    // Figura nese ClaimReviewStatus; chybějící stav je „pending" (claim.ts).
    return { kind: "gated", info: gateStatusInfo(claimStatus(v.figure.claim)) };
  }
  if (v.family === "zdroj") {
    const gate = v.receipt.kind === "edge" ? v.receipt.gate : null;
    return gate === null ? { kind: "ungated" } : { kind: "gated", info: gateStatusInfo(gate.status) };
  }
  // Otiskové rodiny (graf, exponát) jsou deterministický přepočet pohledu.
  return { kind: "ungated" };
}

/** Odstín verdiktu. Není to `kind`: existující, ale ZAMÍTNUTÝ nebo dosud
 *  nezkontrolovaný záznam nesmí nosit potvrzující barvu. */
export type VerdictTone = "confirmed" | "gated-pending" | "gated-rejected" | "moved" | "unknown";

export function verdictTone(v: GateVerdict): VerdictTone {
  if (v.kind === "unknown") return "unknown";
  if (v.kind === "moved") return "moved";
  const gate = verdictGate(v);
  if (gate?.kind === "gated") {
    if (gate.info.status === "rejected") return "gated-rejected";
    if (gate.info.status !== "verified") return "gated-pending";
  }
  return "confirmed";
}

// ── Copy verdiktu jako KLÍČE (čisté, testovatelné — plocha překládá) ───────
//
// Modul zůstává čistý a bez i18n: vrací klíč do `overeni.*` v messages/*.json
// a plocha ho sází přes next-intl. Do 2026-08-04 vracel českou větu, takže
// brána byla jedinou jednojazyčnou plochou na trase, která začíná na
// dvojjazyčném /penize.

/** Titulek verdiktu. Slovník verdiktů zůstává TŘÍSLOVNÝ (verified/moved/
 *  unknown) — brána nezískala čtvrtou odpověď. Co rozlišuje, je KTERÉ tvrzení
 *  je ověřené: u účtenky EXISTENCE záznamu, a ta se nesmí číst jako schválení
 *  (zamítnutá i nezkontrolovaná hrana v grafu zůstává). */
export function verdictHeadlineKey(v: GateVerdict): string {
  if (v.kind === "verified") {
    if (v.family === "zdroj") {
      const gate = verdictGate(v);
      if (gate?.kind === "gated" && gate.info.status === "rejected") return "verdict.headlineZdrojRejected";
      if (gate?.kind === "gated" && gate.info.status !== "verified") return "verdict.headlineZdrojPending";
      return "verdict.headlineZdrojVerified";
    }
    return "verdict.headlineVerified";
  }
  if (v.kind === "moved") return "verdict.headlineMoved";
  // Verdikt zůstává `unknown` — jen NEŘÍKÁ „neznámý odkaz" o vlastní stránce.
  if (v.reason === "politicas-neni-citace") return "verdict.headlineAppRoute";
  return "verdict.headlineUnknown";
}

const UNKNOWN_LEAD_KEYS: Record<UnknownReason, string> = {
  prazdny: "verdict.leadEmpty",
  "prilis-dlouhy": "verdict.leadTooLong",
  nerozlustitelny: "verdict.leadUndecodable",
  "politicas-neni-citace": "verdict.leadAppRoute",
  nepodporovany: "verdict.leadUnsupported",
  "mimo-rejstrik": "verdict.leadNotIssued",
  "zaznam-nenalezen": "verdict.leadRecordGone",
};

export function verdictLeadKey(v: GateVerdict): string {
  if (v.kind === "verified") {
    if (v.family === "figura") {
      return v.citedValue === null ? "verdict.leadFiguraBare" : "verdict.leadFiguraMatch";
    }
    if (v.family === "zdroj") {
      const gate = verdictGate(v);
      if (gate?.kind === "ungated") return "verdict.leadZdrojUngated";
      if (gate?.kind === "gated" && gate.info.status === "rejected") return "verdict.leadZdrojRejected";
      if (gate?.kind === "gated" && gate.info.status !== "verified") return "verdict.leadZdrojPending";
      return "verdict.leadZdrojVerified";
    }
    return "verdict.leadHashMatch";
  }
  if (v.kind === "moved") {
    return v.family === "figura" ? "verdict.leadFiguraMoved" : "verdict.leadHashMoved";
  }
  return UNKNOWN_LEAD_KEYS[v.reason];
}

/** Všechny klíče, které tenhle modul umí vrátit — pro test úplnosti katalogu. */
export const VERDICT_COPY_KEYS: readonly string[] = [
  "verdict.headlineVerified",
  "verdict.headlineZdrojVerified",
  "verdict.headlineZdrojPending",
  "verdict.headlineZdrojRejected",
  "verdict.headlineMoved",
  "verdict.headlineUnknown",
  "verdict.headlineAppRoute",
  "verdict.leadFiguraBare",
  "verdict.leadFiguraMatch",
  "verdict.leadZdrojVerified",
  "verdict.leadZdrojUngated",
  "verdict.leadZdrojPending",
  "verdict.leadZdrojRejected",
  "verdict.leadHashMatch",
  "verdict.leadFiguraMoved",
  "verdict.leadHashMoved",
  ...Object.values(UNKNOWN_LEAD_KEYS),
];
