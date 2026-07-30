/*
 * ROZPOZNÁNÍ ODKAZU — vstupní brána Civic Claim Gate (/overeni).
 *
 * Čistý modul, žádný server ani DOM. Přijímá vložený text a rozhodne, KTEROU
 * rodinu politicas-adres čtenář vložil:
 *
 *   figura   — claim-ref (`claim:<dataset>:<metric>[:<subject>]`, lib/claims)
 *              nebo celý zkopírovaný <data> element s data-claim-* atributy
 *   zdroj    — účtenka původu `/zdroj/<ref>` (u.… / h.…, provenance/claimRef)
 *   graf     — trvalá citace pohledu `/graf/p/<ref>` (g.…, graph/permalink)
 *   exponat  — exponát velína `/dashboard/exponat/<id>` (rez.… / fakt.…)
 *   neznamy  — nic z toho; brána VOLNÝ TEXT ZÁSADNĚ NEOVĚŘUJE, takže
 *              odpověď je poctivé „neznámý odkaz", nikdy pokus o fact-check.
 *
 * Dekodéry se NEFORKUJÍ — importují se přímo z vlastnických modulů rodin
 * (adresa je tvrzení a jeho gramatiku vlastní ten, kdo ji vydává). Detekce
 * nic neopravuje: nerozluštitelný vstup je nerozluštitelný.
 */

import { parseClaimRef, type ClaimRefParts } from "@/lib/claims/claim";
import { decodeClaimRef, type ClaimRef } from "@/features/shared/provenance/claimRef";
import { decodeGraphRef, type GraphRef } from "@/features/graph/permalink";
import { decodeExhibitId, type ExhibitParams } from "@/features/dashboard/exhibit";

// ── Tvar výsledku ───────────────────────────────────────────────────────────

/** Figura opsaná i s hodnotou — z data-claim-* atributů vloženého elementu. */
export interface PastedFigure {
  /** Strojová hodnota z `data-claim-value`; null = payload ji nenese. */
  value: number | null;
  /** ISO datum z `data-claim-retrieved`; null = payload ho nenese. */
  retrievedAt: string | null;
  dataset: string | null;
  metric: string | null;
  unit: string | null;
  /** Stav lidské brány, jak ho payload tvrdí (verified/pending); doslova. */
  status: string | null;
}

export type NeznamyReason =
  /** Prázdný vstup — formulář bez obsahu. */
  | "prazdny"
  /** Vstup nad horní mezí délky — zneužitá adresa, ne citace. */
  | "prilis-dlouhy"
  /** Tvar rodiny poznáváme, ale adresa se nedá rozluštit. */
  | "nerozlustitelny"
  /** Volný text / cizí URL — brána volný text neověřuje (hranice produktu). */
  | "nepodporovany";

export type DetectedRef =
  | { family: "figura"; ref: string; parts: ClaimRefParts; pasted: PastedFigure | null }
  | { family: "zdroj"; encoded: string; ref: ClaimRef }
  | { family: "graf"; encoded: string; ref: GraphRef }
  | { family: "exponat"; encoded: string; params: ExhibitParams }
  | { family: "neznamy"; reason: NeznamyReason };

/** Horní mez délky vstupu — payload s atributy je stovky znaků, adresy kratší;
 *  cokoli delšího je zneužitý vstup, ne citace (vzor claimRef.MAX_REF_LENGTH). */
export const MAX_INPUT_LENGTH = 8000;

// ── Pomocníci ───────────────────────────────────────────────────────────────

const neznamy = (reason: NeznamyReason): DetectedRef => ({ family: "neznamy", reason });

/** Minimální HTML entity, které React/serializace do atributů vkládá —
 *  dekódují se, aby zkopírovaný payload četl tutéž hodnotu, jakou nese DOM. */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const nonEmpty = (v: string | undefined): string | null =>
  v !== undefined && v.trim() !== "" ? v : null;

/** Celý zkopírovaný element s data-claim-* atributy → figura s hodnotou. */
function detectClaimPayload(input: string): DetectedRef {
  const attrs = new Map<string, string>();
  const re = /data-claim-([a-z][a-z-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const m of input.matchAll(re)) {
    attrs.set(m[1], decodeHtmlEntities(m[2] ?? m[3] ?? ""));
  }
  const ref = attrs.get("ref");
  if (!ref) return neznamy("nerozlustitelny");
  const parts = parseClaimRef(ref);
  if (!parts) return neznamy("nerozlustitelny");

  const valueRaw = nonEmpty(attrs.get("value"));
  const value = valueRaw !== null && Number.isFinite(Number(valueRaw)) ? Number(valueRaw) : null;
  return {
    family: "figura",
    ref,
    parts,
    pasted: {
      value,
      retrievedAt: nonEmpty(attrs.get("retrieved")),
      dataset: nonEmpty(attrs.get("dataset")),
      metric: nonEmpty(attrs.get("metric")),
      unit: nonEmpty(attrs.get("unit")),
      status: nonEmpty(attrs.get("status")),
    },
  };
}

// ── Rodiny adres podle cesty (celé URL i holé cesty) ────────────────────────

type PathFamily = "zdroj" | "graf" | "exponat";

const PATH_PATTERNS: ReadonlyArray<{ family: PathFamily; re: RegExp }> = [
  { family: "zdroj", re: /\/zdroj\/([A-Za-z0-9._~%-]+)/ },
  { family: "graf", re: /\/graf\/p\/([A-Za-z0-9._~%-]+)/ },
  { family: "exponat", re: /\/dashboard\/exponat\/([A-Za-z0-9._~%-]+)/ },
];

/** URI-dekódování segmentu; malformované escapy nechají segment doslova —
 *  o platnosti rozhodne až dekodér rodiny, ne dekodér URL. */
function decodeSegment(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function decodeFamily(family: PathFamily, encoded: string): DetectedRef {
  if (family === "zdroj") {
    const ref = decodeClaimRef(encoded);
    return ref ? { family: "zdroj", encoded, ref } : neznamy("nerozlustitelny");
  }
  if (family === "graf") {
    const ref = decodeGraphRef(encoded);
    return ref ? { family: "graf", encoded, ref } : neznamy("nerozlustitelny");
  }
  const params = decodeExhibitId(encoded);
  return params ? { family: "exponat", encoded, params } : neznamy("nerozlustitelny");
}

// ── Hlavní detekce ──────────────────────────────────────────────────────────

export function detectRef(raw: string): DetectedRef {
  const input = raw.trim();
  if (input === "") return neznamy("prazdny");
  if (input.length > MAX_INPUT_LENGTH) return neznamy("prilis-dlouhy");

  // 1) Zkopírovaný element s data-claim-* atributy (nejsilnější signál —
  //    nese ref i hodnotu, které se pak porovnávají).
  if (/data-claim-ref\s*=/.test(input)) return detectClaimPayload(input);

  // 2) Adresa s cestou známé rodiny (celé URL i holá cesta).
  for (const { family, re } of PATH_PATTERNS) {
    const m = input.match(re);
    if (m) return decodeFamily(family, decodeSegment(m[1]));
  }

  // 3) Holý token jedné rodiny. Víceslovný vstup bez rozpoznané cesty je
  //    volný text — hranice produktu, žádný fact-check.
  if (/\s/.test(input)) return neznamy("nepodporovany");

  if (input.startsWith("claim:")) {
    const parts = parseClaimRef(input);
    return parts ? { family: "figura", ref: input, parts, pasted: null } : neznamy("nerozlustitelny");
  }
  if (input.startsWith("u.") || input.startsWith("h.")) {
    return decodeFamily("zdroj", input);
  }
  if (input.startsWith("g.")) {
    return decodeFamily("graf", input);
  }
  if (input.startsWith("rez.") || input.startsWith("fakt.")) {
    return decodeFamily("exponat", input);
  }
  return neznamy("nepodporovany");
}
