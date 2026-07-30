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

import type { IssuedFigure } from "@/lib/claims/registry";
import type { ProvenanceReceipt } from "@/features/shared/provenance/receipt";
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
  /** Český titulek obsahu (u exponátu druh, u grafu titul pohledu). */
  title: string;
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
 *  ⇒ verified (stav lidské brány nese účtenka); nerozluštitelná adresa nebo
 *  záznam, který dnešní graf nenese ⇒ unknown. „Moved" tu z principu není:
 *  hrana buď v grafu je, nebo není. */
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
  | { status: "ok"; view: HashedViewLike; title: string; currentDate: string };

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

// ── Česká copy verdiktu (čistá, testovatelná — plocha jen sází) ─────────────

export function verdictHeadline(v: GateVerdict): string {
  if (v.kind === "verified") return "Ověřeno — sedí, jak bylo citováno.";
  if (v.kind === "moved") return "Hodnota se od citace pohnula.";
  return "Neznámý odkaz.";
}

const UNKNOWN_LEADS: Record<UnknownReason, string> = {
  prazdny: "Vložte politicas odkaz — adresu, claim-ref nebo zkopírovaný element s data-claim-* atributy.",
  "prilis-dlouhy": "Vstup přesahuje horní mez délky — politicas adresa ani opsaný element takhle dlouhé nejsou.",
  nerozlustitelny:
    "Tvar odkazu poznáváme, ale adresa se nedá rozluštit. Adresa je tvrzení — neopravujeme ji, odmítáme ji.",
  nepodporovany:
    "Tohle není politicas odkaz. Brána ověřuje výhradně odkazy, které politicas vydal — volný text nefactcheckuje.",
  "mimo-rejstrik":
    "Claim-ref má správný tvar, ale rejstřík vydaných figur ho nezná. Ověřit umíme jen figuru, kterou jsme sami vydali.",
  "zaznam-nenalezen":
    "Adresa je čitelná, ale dnešní znovuodvození záznam nenese — záznam z grafu zmizel, nebo se přestal odvozovat.",
};

export function verdictLead(v: GateVerdict): string {
  if (v.kind === "verified") {
    if (v.family === "figura") {
      return v.citedValue === null
        ? "Odkaz nesl jen adresu figury, žádnou hodnotu — níže je dnešní znění tvrzení i s účtenkou."
        : "Citovaná hodnota se shoduje s dnešním znovuodvozením — bajt po bajtu.";
    }
    if (v.family === "zdroj") {
      return "Dnešní znalostní graf tento záznam nese — účtenka níže včetně stavu lidské kontroly.";
    }
    return "Otisk citovaného obsahu se shoduje s otiskem dnešního znovuodvození.";
  }
  if (v.kind === "moved") {
    if (v.family === "figura") {
      return "Citovaná hodnota a dnešní znovuodvození se liší — obě strany níže, s daty. Citace nelže, jen zestárla.";
    }
    return "Obsah pod touto adresou se od vydání citace změnil — oba otisky níže. Datum vydání citace adresa nenese, proto ho neuvádíme.";
  }
  return UNKNOWN_LEADS[v.reason];
}
