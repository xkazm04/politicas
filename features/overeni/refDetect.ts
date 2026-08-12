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
 *
 * Šestou „rodinou" je adresa SAMOTNÉ BRÁNY: `/overeni?ref=<citace>` je to, co
 * produkt vydává pod odkazem „ověřit tuto citaci", takže vložit ji zpátky musí
 * skončit stejně jako vložit tu citaci samotnou. Parametr se rozbalí a projde
 * detekcí znovu — jednou (viz `detectAt`).
 */

import { parseClaimRef, type ClaimRefParts } from "@/lib/claims/claim";
import { decodeClaimRef, type ClaimRef } from "@/features/shared/provenance/claimRef";
import { decodeGraphRef, type GraphRef } from "@/features/graph/permalink";
import { decodeExhibitId, type ExhibitParams } from "@/features/dashboard/exhibit";
import { NAV, UNLISTED_ROUTES } from "@/features/shell/navModel";

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
  /** Základ odvození z `data-claim-derivation` — KTERÝ výpočet hodnotu napsal
   *  (`kg-pass:42`, `contribution-committee-dedupe@42`). null = payload ho
   *  nenese; porovnává se jen tehdy, když ho nesou obě strany. */
  derivation: string | null;
}

export type NeznamyReason =
  /** Prázdný vstup — formulář bez obsahu. */
  | "prazdny"
  /** Vstup nad horní mezí délky — zneužitá adresa, ne citace. */
  | "prilis-dlouhy"
  /** Tvar rodiny poznáváme, ale adresa se nedá rozluštit. */
  | "nerozlustitelny"
  /** NAŠE stránka, ale ne citovatelná adresa (/penize/firma/…, /poslanec/…,
   *  /zebricek…). Není to „mimo politicas" — čtenář jen vložil plochu místo
   *  adresy tvrzení, kterou ta plocha vydává. Sem patří i holé `/overeni`
   *  a `/overeni?ref=` s prázdnou hodnotou: brána bez citace citací není. */
  | "politicas-neni-citace"
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
      derivation: nonEmpty(attrs.get("derivation")),
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

// ── Naše cesty, které citací NEJSOU ─────────────────────────────────────────
//
// Rozpoznané rodiny výše jsou tři; všechno ostatní padalo na „tohle není
// politicas odkaz", což je u /penize/firma/<ico> nebo /poslanec/<id> prostě
// nepravda. Seznam prvních segmentů se NEOPISUJE — bere se z navModelu, který
// deklaruje, co aplikace vydává (NAV + jeho children + UNLISTED_ROUTES), takže
// nová routa je tu automaticky a nemůže zestárnout.

const firstSegment = (path: string): string | null => {
  const seg = path.replace(/^\/+/, "").split(/[/?#]/)[0];
  return seg === undefined || seg === "" ? null : seg.toLowerCase();
};

const APP_SEGMENTS: ReadonlySet<string> = new Set(
  [
    ...NAV.flatMap((entry) => [entry.href, ...entry.children.map((c) => c.href)]),
    ...UNLISTED_ROUTES.map((r) => r.route),
  ]
    .map(firstSegment)
    .filter((s): s is string => s !== null),
);

/** Cesta vstupu, je-li vstup holá cesta nebo URL; jinak null. Cizí origin
 *  nikdy nevrací cestu — /clanek na example.com naší stránkou není. */
export function politicasPath(input: string): string | null {
  if (input.startsWith("/")) return input;
  const m = input.match(/^https?:\/\/([^/\s]+)(\/[^\s]*)?$/i);
  if (!m) return null;
  const host = m[1].toLowerCase().replace(/:\d+$/, "");
  const ours = host === "politicas.cz" || host.endsWith(".politicas.cz") || host === "localhost";
  return ours ? (m[2] ?? "/") : null;
}

/** Vstup je naše plocha, ale ne adresa tvrzení. */
export function isAppRouteWithoutClaim(input: string): boolean {
  const path = politicasPath(input);
  if (path === null) return false;
  const seg = firstSegment(path);
  return seg !== null && APP_SEGMENTS.has(seg);
}

// ── Adresa samotné brány ────────────────────────────────────────────────────
//
// „Ověřit tuto citaci" vede na `/overeni?ref=…` (ReceiptPage, MoneySection,
// ProfilePage, ExhibitPage, návod na samotné /overeni) a stránka o sobě tvrdí,
// že URL JE to ověření a dá se sdílet. Přesně tuhle adresu tedy čtenář zkopíruje
// a vloží zpátky do formuláře — a do 2026-08-12 na ni brána odpovídala „naše
// stránka, ale ne citovatelná adresa": o adrese, kterou sama vydala jako ZPŮSOB,
// jak citaci ověřit. Parametr se proto rozbalí a detekce se pustí znovu.

/** JEDINÝ parametr, pod kterým brána citaci přijímá — `searchParams.ref`
 *  v app/overeni/page.tsx. Žádný druhý název se nepřidává: rozpoznat parametr,
 *  který routa nečte, by znamenalo odpovědět o adrese, která nic nevykreslí. */
const GATE_PARAM = "ref";

/** Obsah `?ref=` NAŠÍ adresy /overeni; jinak (cizí origin, jiná cesta, chybějící
 *  nebo prázdný parametr) null — a vstup pak dopadne, jak dopadal. */
function gateParamValue(input: string): string | null {
  const path = politicasPath(input);
  if (path === null || firstSegment(path) !== "overeni") return null;
  const q = path.indexOf("?");
  if (q === -1) return null;
  // Fragment (`#verdikt`, který k odkazu přidává návod) do dotazu nepatří.
  const query = path.slice(q + 1).split("#")[0];
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1 || pair.slice(0, eq) !== GATE_PARAM) continue;
    // `+` je v dotazu mezera; vadný escape nechá decodeSegment doslova a
    // o platnosti rozhodne až dekodér rodiny, ne dekodér URL.
    const value = decodeSegment(pair.slice(eq + 1).replace(/\+/g, " ")).trim();
    if (value !== "") return value;
  }
  return null;
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
  return detectAt(raw, 0);
}

/** `depth` = kolikrát se už rozbaloval parametr brány (viz krok 3). Mez je JEDNA
 *  a je to rozhodnutí, ne opomenutí: /overeni zabalené v /overeni je zacyklení,
 *  ne citace, a rozbalovat donekonečna by z detekce udělalo interpret adres. */
function detectAt(raw: string, depth: number): DetectedRef {
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

  // 3) NAŠE adresa brány s citací v parametru — `/overeni?ref=…` je adresa,
  //    kterou produkt sám vydává jako „ověřit tuto citaci". Rozbalí se a projde
  //    detekcí znovu, takže vložit ji zpátky dá TUTÉŽ odpověď jako vložit
  //    samotnou citaci. Jen z původního vstupu (depth 0): vnořené /overeni už
  //    citace není a dopadne na krok 4 jako každá jiná naše plocha.
  if (depth === 0 && !/\s/.test(input)) {
    const inner = gateParamValue(input);
    if (inner !== null) return detectAt(inner, depth + 1);
  }

  // 4) Naše plocha, která ale citací není (/penize/firma/…, /poslanec/…).
  //    Vlastní důvod — „tohle není politicas odkaz" by tu byla nepravda.
  if (!/\s/.test(input) && isAppRouteWithoutClaim(input)) {
    return neznamy("politicas-neni-citace");
  }

  // 5) Holý token jedné rodiny. Víceslovný vstup bez rozpoznané cesty je
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
