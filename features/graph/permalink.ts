/*
 * TRVALÁ CITACE POHLEDU NA GRAF — /graf/p/<ref>.
 *
 * Čistý modul, žádný server ani DOM (doktrína trailPath.ts): kodek adresy,
 * kanonická serializace, otisk obsahu a strojově čitelný balíček důkazů se
 * testují na fixture datech a determinismus je vlastnost, ne slib.
 *
 * Adresa nese CELÝ stav pohledu (varianta plátna + čočka / uzel / spočítaná
 * cesta) a OTISK obsahu v okamžiku vydání:
 *
 *   g.<b64url(kanonický JSON stavu)>.<otisk8>
 *
 * Stránka pak pohled deterministicky znovuodvodí z týchž loaderů (jen čtení,
 * žádný zápis) a otisky porovná — zastaralá citace to o sobě ŘEKNE, místo aby
 * mlčky ukazovala něco jiného, než co citující článek viděl. Stejná disciplína
 * jako Exponát (features/dashboard/exhibit.ts) a Účtenka původu
 * (features/shared/provenance/claimRef.ts).
 *
 * ADRESA JE TVRZENÍ: nerozluštitelný ref není citace — dekodér vrací null a
 * stránka odpoví 404, nikdy prázdným rámem (pravidlo Exponátu č. 3).
 *
 * Base64url + FNV-1a jsou tu ZÁMĚRNĚ vlastní, ne import z features/dashboard/
 * exhibit.ts — plocha grafu nesmí za běhu záviset na cizí feature (týž důvod,
 * proč claimRef.ts nese vlastní kopii); orchestrátor může kopie později
 * sloučit do lib/.
 */

import type { ViewDiff } from "./diffViews";
import type {
  GateStatus,
  GraphNode,
  Neighbourhood,
  NodeDetail,
  PathTrailDto,
  Trail,
} from "./graphTypes";
// [G4] Adresa tvrzení pro každou hranu citace — čistý modul, žádný server.
import { edgeClaimRef } from "@/features/shared/provenance/claimRef";

// ── Kanonická serializace (vzor exhibit.ts) ─────────────────────────────────

/** JSON s rekurzivně seřazenými klíči objektů — `{a,b}` i `{b,a}` dají týž
 *  řetězec; `undefined` hodnoty se vynechávají. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

// ── Otisk obsahu (FNV-1a, 32 bit, hex) ──────────────────────────────────────

/** Jméno algoritmu — vypisuje se v citační liště, aby otisk nebyl magické
 *  číslo bez původu. Není to kryptografický podpis a nevydává se za něj. */
export const HASH_ALGORITHM = "fnv-1a/32";

/** FNV-1a nad UTF-8 bajty, 8 hex znaků — týž kód na serveru i klientu. */
export function contentHash(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Otisk libovolného obsahu pohledu: kanonický JSON → FNV-1a. Jediné místo,
 *  kudy se počítá — vydání citace i její znovuodvození musí jít touž cestou. */
export const hashViewContent = (content: unknown): string => contentHash(canonicalJson(content));

// ── Base64url (bez Buffer/btoa — týž kód na serveru, klientu i ve vitestu) ──

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0b11) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 !== undefined) out += B64[((b1 & 0b1111) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 !== undefined) out += B64[b2 & 0b111111];
  }
  return out;
}

/** null = řetězec není platný base64url (adresu neopravujeme, odmítáme). */
function fromBase64Url(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded) || encoded.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 4) {
    const chunk = [...encoded.slice(i, i + 4)].map((c) => B64.indexOf(c));
    bytes.push((chunk[0] << 2) | (chunk[1] >> 4));
    if (chunk.length > 2) bytes.push(((chunk[1] & 0b1111) << 4) | (chunk[2] >> 2));
    if (chunk.length > 3) bytes.push(((chunk[2] & 0b11) << 6) | chunk[3]);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// ── Stav pohledu ────────────────────────────────────────────────────────────

export type GraphVariant = "mapa" | "trasy";

/** Citovatelný stav plátna: vybraný uzel, kurátorská trasa (čočka), nebo
 *  spočítaná cesta „Spoj dva body" (from → to, index cesty mezi stejně
 *  krátkými alternativami). Varianta plátna se nese s sebou — citace říká,
 *  kterým nástrojem čtenář pohled složil. */
export type GraphViewState =
  | { kind: "uzel"; variant: GraphVariant; node: string }
  | { kind: "trasa"; variant: GraphVariant; trail: string }
  | { kind: "cesta"; variant: GraphVariant; from: string; to: string; path: number }
  // [G4] ČTVRTÝ CITOVATELNÝ DRUH POHLEDU: okolí uzlu dotažené na vyžádání.
  // Adresa je slib, který se jen PŘIDÁVÁ — starší tvary čte dekodér beze změny.
  | { kind: "okoli"; variant: GraphVariant; node: string };

/** Horní mez délky id/klíče ve stavu — id grafu jsou krátké urny; cokoli
 *  delšího je zneužitá adresa, ne citace (vzor claimRef.MAX_REF_LENGTH). */
const MAX_ID_LENGTH = 200;
/** Nejvyšší přípustný index alternativní cesty (trailPath vrací nejvýše
 *  ALTERNATES = 3 cesty; rezerva pro případné zvednutí konstanty). */
const MAX_PATH_INDEX = 15;

const isVariant = (v: unknown): v is GraphVariant => v === "mapa" || v === "trasy";
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= MAX_ID_LENGTH;

/** Přísná validace neznámého vstupu na stav pohledu — akce i dekodér jsou
 *  veřejné endpointy, ne funkce. Neznámé klíče se nepropouštějí: výstup se
 *  skládá znovu jen ze známých polí. */
export function parseViewState(v: unknown): GraphViewState | null {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!isVariant(o.variant)) return null;
  if (o.kind === "uzel" && isId(o.node)) {
    return { kind: "uzel", variant: o.variant, node: o.node };
  }
  if (o.kind === "trasa" && isId(o.trail)) {
    return { kind: "trasa", variant: o.variant, trail: o.trail };
  }
  // [G4] Táž přísnost jako u „uzel": neznámé klíče se nepropouštějí, výstup se
  // skládá znovu jen ze známých polí (akce i dekodér jsou veřejné endpointy).
  if (o.kind === "okoli" && isId(o.node)) {
    return { kind: "okoli", variant: o.variant, node: o.node };
  }
  if (
    o.kind === "cesta" &&
    isId(o.from) &&
    isId(o.to) &&
    o.from !== o.to &&
    typeof o.path === "number" &&
    Number.isInteger(o.path) &&
    o.path >= 0 &&
    o.path <= MAX_PATH_INDEX
  ) {
    return { kind: "cesta", variant: o.variant, from: o.from, to: o.to, path: o.path };
  }
  return null;
}

// ── Kodek adresy ────────────────────────────────────────────────────────────
//
// DVA TVARY, JEDEN PROSTOR ADRES (append-only, 2026-09-04 / moonshot G1):
//
//   g.<b64url(kanonický JSON stavu)>.<otisk8>                — původní
//   g2.<b64url(kanonický JSON stavu)>.<otisk8>.<RRRRMMDD>    — s datem vydání
//
// Oddělovač je tečka: base64url ani hex ji neobsahují, v URL segmentu je legální.
//
// PROČ DRUHÝ TVAR: `g.` nenese okamžik, kdy citace vznikla, takže server u
// zastaralé citace věděl JEN „otisk v adrese ≠ otisk dnes" — nikdy „a takhle
// to vypadalo, když jste to citoval". Bez data se historie grafu (kg_*_history)
// nemá k čemu vztáhnout. `g2.` datum nese; `g.` se dál luští a zůstává platnou
// citací, jen „pohnutou bez data přehrání". Vydaná adresa se NIKDY neruší.
//
// Datum je den (`RRRRMMDD` bez oddělovačů — v adrese už jednu tečku jako
// oddělovač používáme). Neexistující kalendářní den je ODMÍTNUT, ne posunut:
// `20260231` není 3. březen, je to neplatná adresa.

export interface GraphRef {
  state: GraphViewState;
  /** Otisk OBSAHU pohledu v okamžiku vydání citace (hashViewContent). */
  hash: string;
  /** `YYYY-MM-DD` vydání citace; null u tvaru `g.`, který datum nenese. */
  issuedAt: string | null;
}

const HASH_RE = /^[0-9a-f]{8}$/;
const ISSUED_RE = /^\d{8}$/;
/** Horní mez délky celé adresy (vzor claimRef.ts). */
const MAX_REF_LENGTH = 700;

/** `RRRRMMDD` → `RRRR-MM-DD`, nebo null. Kalendář rozhoduje, ne regulární
 *  výraz: zpětný převod odhalí přetečený den, který by `new Date` tiše posunul. */
function parseIssuedAt(compact: string): string | null {
  if (!ISSUED_RE.test(compact)) return null;
  const day = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === day ? day : null;
}

/** Dnešní den ve tvaru adresy. Jediné místo v modulu, které čte hodiny —
 *  „kdy byla citace vydána" se z ničeho jiného odvodit nedá, a vydání je
 *  přesně ten okamžik. Testy datum vždy předávají výslovně. */
export const issuedTodayCompact = (): string => new Date().toISOString().slice(0, 10).replaceAll("-", "");

/**
 * Adresa citace. Bez `issuedAtCompact` se orazítkuje DNEŠKEM a vyjde `g2.` —
 * každá nově vydaná citace tak nese datum, aniž by o něm vydávající akce
 * musela vědět. Prázdný řetězec vynutí historický tvar `g.` (ilustrační
 * příklady v návodu, které se nesmějí měnit každý den).
 */
export function encodeGraphRef(
  state: GraphViewState,
  hash: string,
  issuedAtCompact: string = issuedTodayCompact(),
): string {
  const body = `${toBase64Url(canonicalJson(state))}.${hash}`;
  return issuedAtCompact === "" ? `g.${body}` : `g2.${body}.${issuedAtCompact}`;
}

export function decodeGraphRef(encoded: string): GraphRef | null {
  if (typeof encoded !== "string" || encoded.length === 0 || encoded.length > MAX_REF_LENGTH) {
    return null;
  }
  const parts = encoded.split(".");
  const legacy = parts.length === 3 && parts[0] === "g";
  const dated = parts.length === 4 && parts[0] === "g2";
  if (!legacy && !dated) return null;
  if (!HASH_RE.test(parts[2])) return null;
  // Datum se neopravuje: `g2.` s nečitelným dnem není „citace bez data",
  // je to neplatná adresa (táž disciplína jako rozbitý base64 níže).
  const issuedAt = dated ? parseIssuedAt(parts[3]) : null;
  if (dated && issuedAt === null) return null;
  const json = fromBase64Url(parts[1]);
  if (json === null || json.length === 0) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    // Nerozluštitelná adresa je opravdové „neexistuje" — rozbité JSON není
    // chyba serveru, ale neplatné tvrzení; volající odpoví 404.
    return null;
  }
  const state = parseViewState(raw);
  return state ? { state, hash: parts[2], issuedAt } : null;
}

/** Cesta trvalé citace — jediné místo, kde se skládá /graf/p/<ref>. */
export const permalinkPath = (ref: string): string => `/graf/p/${ref}`;

// ── Pohledový model (server ho sestaví, klient i OG obraz jen sázejí) ───────

export interface PermalinkCommon {
  /** Kanonická adresa citace (path segment). */
  ref: string;
  state: GraphViewState;
  /** Otisk z adresy — co viděl ten, kdo citaci vydal. */
  urlHash: string;
  /** Otisk dnešního znovuodvození. Rozdíl ⇒ citace je zastaralá a řekne to. */
  currentHash: string;
  fresh: boolean;
  /**
   * `YYYY-MM-DD` vydání citace z adresy (tvar `g2.`); null u historického
   * tvaru `g.`, který datum nenese. Bez něj se zastaralá citace dá jen
   * PROHLÁSIT za zastaralou — s ním se dá DATOVAT („změněno od …").
   */
  issuedAt: string | null;
  /**
   * Rozdíl tehdejší a dnešní verze pohledu (diffViews.ts). null = tehdejší
   * verzi jsme nepřehráli, a sazba to MUSÍ napsat — prázdný rozdíl a
   * nepřehraná verze se nesmějí číst stejně (viz `ViewDiff.incomparable`).
   */
  diff: ViewDiff | null;
  /** `YYYY-MM-DD` dnešního znovuodvození (datum získání dat). */
  retrievedOn: string;
  /** Český titulek pohledu — sází ho stránka i OG obraz. */
  title: string;
  /**
   * Původ requestu („https://host"), nebo null, když ho nelze poctivě zjistit.
   * Skládá ho getPermalinkData z hlaviček — týž precedens jako app/sitemap.ts,
   * /zdroj/[ref] a všechny čtyři feedy: v dev čestně localhost, v nasazení
   * skutečný host, NIKDY vymyšlená doména. Bez něj balíček důkazů pole `url`
   * prostě vynechá (viz toEvidenceJsonLd).
   *
   * Nevstupuje do otisku: hashuje se `content`, ne pohledový model — adresa
   * serveru nesmí měnit otisk citovaného obsahu.
   */
  origin: string | null;
  /** Lokalizovaný popis balíčku důkazů (graph.permalink.bundleDescription).
   *  Sází ho JEN toEvidenceJsonLd; kdysi to byla natvrdo česká věta uvnitř
   *  čistého modulu, zatímco `name` téhož dokumentu jazyk requestu sledovalo. */
  bundleDescription: string;
  /** Lokalizované pravidlo řazení spočítané cesty — táž věta, kterou sází
   *  stránka (graph.permalink.rule). null pro uzel/trasu, které se nehledají.
   *  Bez něj nesl balíček obvinění (cestu) bez pravidla, kterým vzniklo. */
  orderingRule: string | null;
}

/** Jádro pohledu bez společných polí — server ho složí (getPermalinkData)
 *  a doplní PermalinkCommon. */
export type PermalinkCore =
  | {
      kind: "cesta";
      from: GraphNode;
      to: GraphNode;
      /** Vítězná (či zvolená alternativní) cesta; null = dnešní graf už
       *  žádnou stejně krátkou cestu pod tímto indexem nedokládá. */
      trail: PathTrailDto | null;
      totalFound: number;
      capped: boolean;
      maxCost: number;
      hubDegree: number;
      // [G4] Vyloučené zamítnuté kroky + identita pravidla hledání.
      excludedRejected: number;
      ruleRef: string;
    }
  | { kind: "trasa"; trail: Trail }
  | { kind: "uzel"; detail: NodeDetail }
  // [G4] Okolí se cituje přesně jako trasa: otisk, tři stavy, strop s populací.
  | { kind: "okoli"; neighbourhood: Neighbourhood };

export type PermalinkView = PermalinkCommon & PermalinkCore;

// ── Prameny do citační lišty ────────────────────────────────────────────────
//
// Doslovná jména registrů, ze kterých graf vzniká (vzor SLICE_SOURCE_LINKS,
// features/dashboard/exhibit.ts). Uzel navíc nese vlastní hluboké odkazy
// (sourceLinksFor) — ty mají v liště přednost.

export interface PermalinkSourceLink {
  label: string;
  href: string;
  /** Klíč do katalogu překladů (graph.permalink.sources.<id>) — statické
   *  prameny se na klientu překládají; odkazy z dat (registry uzlu) id nemají
   *  a sázejí svůj label tak, jak přišel. */
  id?: "psp" | "ares" | "contracts" | "esbirka";
}

export const GRAPH_SOURCE_LINKS: PermalinkSourceLink[] = [
  { id: "psp", label: "psp.cz — poslanci, tisky, hlasování", href: "https://www.psp.cz" },
  { id: "ares", label: "ares — veřejný rejstřík", href: "https://ares.gov.cz" },
  { id: "contracts", label: "registr smluv — smlouvy.gov.cz", href: "https://smlouvy.gov.cz" },
  { id: "esbirka", label: "e-sbírka — sbírka zákonů", href: "https://www.e-sbirka.cz" },
];

export interface PermalinkSources {
  /**
   * true = prameny přišly z DAT pohledu (hluboké odkazy uzlu, sourceLinksFor);
   * false = pohled vlastní odkazy nenese, takže se jmenuje pramenná ZÁKLADNA
   * platformy. Rozdíl musí ven: „ARES" je tvrzení o tomhle uzlu, „psp.cz ·
   * ares · registr smluv · e-sbírka" je tvrzení o tom, z čeho graf vzniká.
   */
  fromView: boolean;
  links: PermalinkSourceLink[];
}

/**
 * JEDINÉ pravidlo, které rozhoduje, jaké prameny citace jmenuje.
 *
 * Do 2026-08-13 existovalo TŘIKRÁT a jen jednou správně: citační lišta
 * (PermalinkPage.tsx) upřednostňovala registry uzlu, kdežto `isBasedOn`
 * v balíčku důkazů i řádek pramenů v OG obrazu vypisovaly všechny čtyři
 * registry NEPODMÍNĚNĚ — takže karta i strojový balíček u uzlu s vlastními
 * hlubokými odkazy jmenovaly registry, které s ním nemají co dělat.
 *
 * DOSUD NEUZAVŘENÉ (vědomě, ne přehlédnutím): pro `cesta`/`trasa` pohled
 * vlastní odkazy nenese, takže se pořád jmenují všechny čtyři — cesta mezi
 * dvěma poslanci bez jediné smlouvy tedy jmenuje i registr smluv. Zúžit to jde
 * podle DRUHŮ uzlů na cestě (person/organ/bill → psp.cz, company → ares,
 * contract → registr smluv, law → e-sbírka), ale výsledek musí odebírat i
 * `CitationRail` v PermalinkPage.tsx, jinak by stránka a karta tvrdily o jedné
 * citaci dvě různé věci. Až se obojí bude měnit jedním dechem — tady, ne v
 * pátém opise pravidla.
 */
export function permalinkSources(view: PermalinkView): PermalinkSources {
  if (view.kind === "uzel" && view.detail.links.length > 0) {
    return {
      fromView: true,
      links: view.detail.links.map((l) => ({ label: l.registry, href: l.url })),
    };
  }
  return { fromView: false, links: GRAPH_SOURCE_LINKS };
}

// ── Lokální česká zrcadla katalogu překladů ─────────────────────────────────
//
// OG obraz i serverové titulky dnes jdou přes getTranslations (graph.kinds.*,
// graph.trasy.trails.*); tyhle konstanty zůstávají jako POSLEDNÍ ZÁCHRANA pro
// druh/trasu, kterou katalog ještě nezná (t.has → fallback), a pro čisté testy
// bez i18n kontextu. Sync s graph.trasy.trails, graph.kinds a graph.rels
// hlídá catalogParity.test.ts PROTI enumům KG_NODE_KINDS / KG_EDGE_RELS —
// do 2026-09-06 tu stálo jen „drž v sync" a `tender` i celá zakázková vrstva
// (procures, bids_on, wins) chyběly ve všech třech.

export const TRAIL_TITLES: Record<string, string> = {
  "penize-poslancu": "Peníze kolem poslanců",
  nejnovelizovanejsi: "Nejpřepisovanější zákony",
  "darci-stran": "Dárci politických stran",
  "vybory-a-penize": "Výbory a peníze",
};

export const KIND_LABELS: Record<string, string> = {
  person: "poslanec",
  party: "strana",
  organ: "orgán",
  bloc: "blok",
  theme: "téma",
  company: "firma",
  contract: "smlouva",
  bill: "tisk",
  law: "zákon",
  notice: "vývěska",
  tender: "zadávací řízení",
};

export const REL_LABELS: Record<string, string> = {
  co_votes_with: "společné hlasování",
  supplies: "dodává",
  influential_in: "působí v",
  amends: "novelizuje",
  sponsors: "předkládá",
  linked_to: "vazba na firmu",
  rebels_against: "odchylky od klubu",
  about: "o tématu",
  assigned_to: "přikázáno výboru",
  cites: "cituje",
  owns_stake: "podíl ve firmě",
  owns: "gesce tématu",
  belongs_to: "patří do bloku",
  procures: "zadává",
  bids_on: "uchází se o",
  wins: "vítězí v",
  concerns: "týká se",
  rapporteur: "zpravodaj tisku",
  spoke_on: "vystoupil k",
  proposes_amendment: "navrhuje pozměňovací návrh k",
  decides: "rozhoduje o",
};

export const relLabel = (rel: string): string => REL_LABELS[rel] ?? rel;

// ── Co smí říct karta odkazu (OG obraz) ─────────────────────────────────────
//
// Karta je NEJHŮŘ OPRAVITELNÝ artefakt, který produkt vydává: sociální sítě si
// ji nacachují, redakce si ji vezmou do článku screenshotem, a nikdo z toho už
// nikdy neuvidí opravu na stránce za ní. Proto se rozhodnutí, CO na ní stojí,
// dělá tady — čistě a testovatelně — a obraz jen sází.
//
// Dvě věci, které karta do 2026-08-13 dělala špatně:
//  1. NEZNALA `fresh`. Novinář citoval pohled v červnu, graf se přepočítal,
//     stránka nad obsahem vyvěsila rozpor — a karta pod tím vytiskla dnešní
//     otisk s dnešním datem a nad ním „vše ověřeno" v POTVRZUJÍCÍ modré.
//     Nejtrvalejší artefakt tvrdil ověřený současný stav o citaci, o které
//     věděl, že se rozešla.
//  2. Slila `invalid` (404), `gone` (410) a `unavailable` (503) do JEDNOHO
//     náhradního rámu, který navíc tvrdil „trvalá adresa nese celý pohled
//     i otisk důkazů" nad adresou, která nenese nic. Výpadek našeho skladu
//     se tak nedal odlišit od zániku doloženého pohledu — což je přesně to
//     rozlišení, kvůli kterému getPermalinkData drží tři stavy.

/** Vstup shodný s PermalinkResult (getPermalinkData) — opsaný strukturálně,
 *  aby čistý modul nesahal na serverový loader. */
export type PermalinkCardInput =
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "gone"; urlHash: string; retrievedOn: string }
  | { status: "ok"; view: PermalinkView };

/** Řádek lidské kontroly na kartě. null = pohled žádné hrany nesází (uzel,
 *  nebo cesta, kterou dnešní graf nedokládá). */
export interface PermalinkCardReview {
  pendingEdges: number;
  // [G4] Zamítnuté kroky mají VLASTNÍ číslo. „Čeká na kontrolu" a „kontrola to
  // odmítla" jsou dvě různé věty; do 2026-09-04 karta znala jen tu první a
  // zamítnutý krok tiše počítala mezi ověřené (`allVerified` pak tvrdilo
  // „vše ověřeno" nad cestou vedoucí přes odmítnuté tvrzení).
  rejectedEdges: number;
  /** Tvrzení o DNEŠNÍM znovuodvození: žádná hrana nečeká na kontrolu ANI
   *  nebyla odmítnuta. */
  allVerified: boolean;
  /**
   * Smí se ten řádek vysázet POTVRZUJÍCÍ barvou? Jediné místo, kde se to
   * rozhoduje — a zastaralý pohled ji nedostane NIKDY: „vše ověřeno" je pravda
   * o dnešku, ale čtenář karty drží v ruce citaci z června.
   */
  confirming: boolean;
}

export interface PermalinkCardModel {
  state: PermalinkCardInput["status"];
  /** Otisk v adrese ≠ dnešní otisk. Jen u `ok`; jinde vždy false. */
  stale: boolean;
  /** Nese karta otisk obsahu? `unavailable` a `invalid` nenesou žádný —
   *  a nesmějí předstírat, že adresa nějaký nese. */
  imprint: { hash: string; citedHash: string | null; retrievedOn: string } | null;
  review: PermalinkCardReview | null;
}

export function permalinkCardModel(input: PermalinkCardInput): PermalinkCardModel {
  if (input.status === "invalid" || input.status === "unavailable") {
    return { state: input.status, stale: false, imprint: null, review: null };
  }
  if (input.status === "gone") {
    // Adresa je čitelná a otisk v ní JE — zaniklo doložení, ne citace. Karta
    // proto otisk z adresy nese; „dnešní otisk" ale žádný není, a nedosazuje se.
    return {
      state: "gone",
      stale: false,
      imprint: { hash: input.urlHash, citedHash: null, retrievedOn: input.retrievedOn },
      review: null,
    };
  }
  const view = input.view;
  const stale = !view.fresh;
  let review: PermalinkCardReview | null = null;
  if (view.kind === "cesta" && view.trail !== null) {
    // [G4] Cesta se hledá jen po nezamítnutých hranách (buildAdjacency), takže
    // zamítnutý krok v ní být NEMŮŽE — číslo je 0 a je to tvrzení, ne mezera.
    review = reviewOf(view.trail.pendingCount, 0, stale);
  } else if (view.kind === "okoli") {
    // [G4] Okolí je taky vyžádaná odpověď: nefiltruje se, tedy zamítnutá vazba
    // uzlu se v něm vysází — označená, a spočítaná zvlášť.
    const g = gateCounts(view.neighbourhood.edges);
    review = reviewOf(g.pending, g.rejected, stale);
  } else if (view.kind === "trasa") {
    // [G4] Kurátorská trasa se NEfiltruje (vyžádaná odpověď), takže zamítnutý
    // krok v ní být může — a musí být vidět jako zamítnutý.
    const g = gateCounts(view.trail.edges);
    review = reviewOf(g.pending, g.rejected, stale);
  }
  return {
    state: "ok",
    stale,
    imprint: {
      hash: view.currentHash,
      citedHash: stale ? view.urlHash : null,
      retrievedOn: view.retrievedOn,
    },
    review,
  };
}

/**
 * Kolik hran pohledu čeká na kontrolu a kolik jich kontrola ODMÍTLA — jedno
 * počítání pro kartu, stránku i OG obraz. Do 2026-09-06 si ho karta psala dvakrát
 * inline a stránka počítala jen `pending` (a u okolí nic), takže OG obraz řekl
 * „1 hranu odmítla kontrola" nad stránkou, která o odmítnutí mlčela.
 * `null` (negated relace) ani `verified` se nepočítají — nejsou ani jedno z toho.
 */
export function gateCounts(edges: ReadonlyArray<{ gate: GateStatus | null }>): { pending: number; rejected: number } {
  let pending = 0;
  let rejected = 0;
  for (const e of edges) {
    if (e.gate === "pending_review") pending++;
    else if (e.gate === "rejected") rejected++;
  }
  return { pending, rejected };
}

// [G4] `rejectedEdges` váží stejně jako `pendingEdges`: karta se nesmí vysázet
// potvrzující barvou nad pohledem, jehož krok člověk odmítl.
const reviewOf = (pendingEdges: number, rejectedEdges: number, stale: boolean): PermalinkCardReview => ({
  pendingEdges,
  rejectedEdges,
  allVerified: pendingEdges === 0 && rejectedEdges === 0,
  confirming: pendingEdges === 0 && rejectedEdges === 0 && !stale,
});

// ── Citační řádek („citovat") ───────────────────────────────────────────────

/** Věta k vložení do článku — všechna pole přicházejí už zformátovaná
 *  (datum přes f.date, URL složená z window.location.origin), builder jen
 *  skládá a je proto čistě testovatelný. UI dnes sází lokalizovanou větu
 *  z katalogu (graph.permalink.citationLine); tahle česká podoba zůstává
 *  referenčním tvarem pro testy. */
export function citationLine(args: {
  title: string;
  retrievedOn: string;
  url: string;
  hash: string;
}): string {
  return (
    `„${args.title}" — politicas, znalostní graf české politiky. ` +
    `Získáno ${args.retrievedOn}. ${args.url} · otisk ${HASH_ALGORITHM} ${args.hash}.`
  );
}

// ── Strojově čitelný balíček důkazů (JSON-LD) ───────────────────────────────
//
// Vzor: toClaimReviewJsonLd (features/shared/provenance/receipt.ts). Pohled
// jde ven jako schema.org Dataset s tvrzeními (Claim) na každou hranu —
// relace zůstávají STROJOVÉ kódy grafu (supplies, linked_to…), aby balíček
// šel párovat na data bez české morfologie. Stav lidské kontroly každé hrany
// se nese ven VŽDY (pending_review / verified) — čárkovaná čára nesmí
// zmizet v žádném exportním formátu.

interface JsonLdProperty {
  "@type": "PropertyValue";
  name: string;
  value: string | number;
}

interface JsonLdClaim {
  "@type": "Claim";
  name: string;
  additionalProperty: JsonLdProperty[];
}

export interface EvidenceJsonLd {
  "@context": "https://schema.org";
  "@type": "Dataset";
  name: string;
  identifier: string;
  /** Absolutní adresa citace. VOLITELNÁ: bez zjistitelného hostitele se pole
   *  vynechá — relativní `url` je v JSON-LD nerozluštitelná, jakmile balíček
   *  jednou opustí náš server (týž závěr jako toClaimReviewJsonLd u /zdroj). */
  url?: string;
  dateModified: string;
  description: string;
  isBasedOn: string[];
  additionalProperty: JsonLdProperty[];
  hasPart: JsonLdClaim[];
}

const prop = (name: string, value: string | number): JsonLdProperty => ({
  "@type": "PropertyValue",
  name,
  value,
});

/*
 * [G4] STAV KONTROLY JDE VEN DOSLOVA, NE JAKO PŘEKLOPENÝ BOOLEAN.
 *
 * Do 2026-09-04 tu stálo `prop("review_state", pending ? "pending_review" :
 * "verified")` — dvouhodnotová věta o TŘÍHODNOTOVÉM poli. Hrana, kterou člověk
 * ZAMÍTL, měla `pending: false`, takže nejhůř opravitelný artefakt produktu
 * (strojový balíček důkazů, který si redakce i crawlery archivují) o ní
 * tvrdil `review_state: verified`. Teď se vypisuje uložený token, `null`
 * (negated relace) se vypíše jako `ungated` — nikdy jako „ověřeno" — a každé
 * tvrzení nese svou vlastní trvalou adresu, takže je krok cesty sám o sobě
 * dohledatelná účtenka.
 */
interface EdgeClaimArgs {
  fromLabel: string;
  rel: string;
  toLabel: string;
  gate: GateStatus | null;
  provenance: { pass: number | null; method: string | null; ref: string | null } | null;
  claimRef: string;
  moneyCzk: number | null;
  origin: string | null;
}

const edgeClaim = (a: EdgeClaimArgs): JsonLdClaim => ({
  "@type": "Claim",
  name: `${a.fromLabel} — ${a.rel} — ${a.toLabel}`,
  additionalProperty: [
    prop("relation", a.rel),
    prop("review_state", a.gate ?? "ungated"),
    prop("claim_ref", a.claimRef),
    // Absolutní adresa, nebo žádná (týž závěr jako `url` balíčku): relativní
    // „/zdroj/…" je v archivovaném JSON-LD nerozluštitelná.
    ...(a.origin ? [prop("claim_url", `${a.origin}/zdroj/${a.claimRef}`)] : []),
    ...(a.provenance?.ref ? [prop("provenance_ref", a.provenance.ref)] : []),
    ...(a.provenance?.pass !== null && a.provenance?.pass !== undefined
      ? [prop("provenance_pass", a.provenance.pass)]
      : []),
    ...(a.provenance?.method ? [prop("provenance_method", a.provenance.method)] : []),
    ...(a.moneyCzk !== null ? [prop("amount_czk", a.moneyCzk)] : []),
  ],
});

export function toEvidenceJsonLd(view: PermalinkView): EvidenceJsonLd {
  const parts: JsonLdClaim[] = [];
  if (view.kind === "cesta" && view.trail) {
    for (const row of view.trail.ledger) {
      parts.push(
        edgeClaim({
          fromLabel: row.from.label,
          rel: row.rel,
          toLabel: row.to.label,
          gate: row.gate,
          provenance: row.provenance,
          claimRef: row.claimRef,
          moneyCzk: row.moneyCzk,
          origin: view.origin,
        }),
      );
    }
  }
  if (view.kind === "trasa") {
    const byId = new Map(view.trail.nodes.map((n) => [n.id, n.label]));
    for (const e of view.trail.edges) {
      parts.push(
        edgeClaim({
          fromLabel: byId.get(e.src) ?? e.src,
          rel: e.rel,
          toLabel: byId.get(e.dst) ?? e.dst,
          gate: e.gate,
          provenance: e.provenance,
          claimRef: edgeClaimRef(e.src, e.rel, e.dst),
          moneyCzk: null,
          origin: view.origin,
        }),
      );
    }
  }
  // [G4] `hasPart` okolí = jeho hrany se stavem brány, týž tvar jako u trasy.
  if (view.kind === "okoli") {
    const n = view.neighbourhood;
    const byId = new Map<string, string>([
      ...(n.anchor ? ([[n.anchor.id, n.anchor.label]] as [string, string][]) : []),
      ...n.nodes.map((x) => [x.id, x.label] as [string, string]),
    ]);
    for (const e of n.edges) {
      parts.push(
        edgeClaim({
          fromLabel: byId.get(e.src) ?? e.src,
          rel: e.rel,
          toLabel: byId.get(e.dst) ?? e.dst,
          gate: e.gate,
          provenance: e.provenance,
          claimRef: edgeClaimRef(e.src, e.rel, e.dst),
          moneyCzk: null,
          origin: view.origin,
        }),
      );
    }
  }
  if (view.kind === "uzel") {
    const d = view.detail;
    parts.push({
      "@type": "Claim",
      name: d.node.label,
      additionalProperty: [
        prop("kind", d.node.kind),
        ...(d.citableId ? [prop("identifier", d.citableId)] : []),
        ...(d.provenance.method ? [prop("provenance_method", d.provenance.method)] : []),
        ...(d.provenance.pass !== null ? [prop("provenance_pass", d.provenance.pass)] : []),
        ...(d.provenance.computedAt ? [prop("computed_at", d.provenance.computedAt)] : []),
      ],
    });
  }
  // TÝŽ výběr pramenů, jaký sází karta i citační lišta — jedno pravidlo,
  // ne třetí opis (viz permalinkSources).
  const sources = permalinkSources(view).links.map((l) => l.href);
  // Absolutní adresa, nebo žádná. Nikdy hádaná doména a nikdy relativní cesta:
  // archivovaný balíček se z „/graf/p/…" nikam nedostane.
  const absolute = view.origin ? `${view.origin}${permalinkPath(view.ref)}` : null;
  /*
   * MEZ HLEDÁNÍ A PRAVIDLO ŘAZENÍ — do 2026-08-13 je nesla JEN sazba stránky
   * („Otištěné pravidlo — bez něj by generovaná cesta byla obvinění"), takže
   * strojový odběratel dostal obvinění bez pravidla a nikdy se nedozvěděl, že
   * hledání narazilo na strop. Čísla jdou ven strukturovaně (stroj je čte bez
   * češtiny) a věta lokalizovaně (je to TÁŽ věta z katalogu, kterou vidí
   * čtenář stránky — ne druhá formulace téhož).
   */
  const searchBound: JsonLdProperty[] =
    view.kind === "cesta"
      ? [
          prop("path_max_cost_steps", view.maxCost),
          prop("path_hub_degree_threshold", view.hubDegree),
          prop("paths_found", view.totalFound),
          prop("path_search_capped", view.capped ? "yes" : "no"),
          // [G4] Kolik hran hledání nepoužilo, protože je odmítl člověk.
          // Prázdná odpověď se nesmí tvářit jako „nic tu nebylo".
          prop("path_excluded_rejected", view.excludedRejected),
          // [G4] Identita PRAVIDLA, ne jen jeho čísla — „stejná cesta, jiné
          // pravidlo" jde poznat až podle tohohle.
          prop("path_rule_ref", view.ruleRef),
          ...(view.orderingRule ? [prop("path_ordering_rule", view.orderingRule)] : []),
        ]
      : [];
  /*
   * [G4] KAŽDÝ STROP NESE SVOU POPULACI. Okolí je řez („nejvýš N hran"), a řez
   * bez počtu je tvrzení o celku, které o celku nic neví. Strojový odběratel
   * proto dostává „N z M", ne jen N — a když se do svého stropu nevešlo ani
   * čtení, řekne se i to.
   */
  const neighbourBound: JsonLdProperty[] =
    view.kind === "okoli"
      ? [
          prop("neighbourhood_edges_shown", view.neighbourhood.edges.length),
          prop(
            "neighbourhood_edges_total",
            view.neighbourhood.perRel.reduce((sum, r) => sum + r.total, 0),
          ),
          prop("neighbourhood_limit", view.neighbourhood.limit),
          prop("neighbourhood_read_truncated", view.neighbourhood.readTruncated ? "yes" : "no"),
          ...view.neighbourhood.perRel.map((r) =>
            prop(`neighbourhood_rel_${r.rel}`, `${r.shown}/${r.total}`),
          ),
        ]
      : [];
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `politicas — ${view.title}`,
    // Identifikátor je adresa, kde balíček žije; bez hostitele zůstává aspoň
    // ref — ten je stabilní a NENÍ vymyšlený, jen sám o sobě neadresuje.
    identifier: absolute ?? view.ref,
    ...(absolute ? { url: absolute } : {}),
    dateModified: view.retrievedOn,
    description: view.bundleDescription,
    isBasedOn: sources,
    additionalProperty: [
      prop("content_hash_algorithm", HASH_ALGORITHM),
      prop("content_hash", view.currentHash),
      prop("cited_content_hash", view.urlHash),
      prop("fresh", view.fresh ? "yes" : "no"),
      ...searchBound,
      ...neighbourBound,
    ],
    hasPart: parts,
  };
}

/*
 * [G4] NEJHORŠÍ STAV BRÁNY V CITOVANÉM POHLEDU — pro modifikátor /overeni.
 *
 * `verdictGate` vrací pro rodinu `graf` paušální `ungated` s odůvodněním
 * „otiskové rodiny jsou deterministický přepočet pohledu". To platí o OTISKU
 * a neplatí o OBSAHU: přepočet je sice deterministický, ale pohled, který se
 * přepočítal, může stát na hraně čekající na kontrolu — nebo na hraně, kterou
 * kontrola ODMÍTLA. „Ověřeno" nad takovou citací je totéž tvrzení, jaké
 * z balíčku důkazů odešlo do 2026-09-04.
 *
 * Pořadí je pořadím ZÁVAŽNOSTI, ne abecedy: odmítnutí bije čekání, čekání bije
 * ověřeno, a `null` znamená „pohled žádnou branou hodnocenou hranu nenese"
 * (uzel, nebo pohled ze samých negated relací) — tedy skutečně `ungated`,
 * nikoli „ověřeno".
 *
 * Žije TADY, v čistém modulu, aby ho /overeni jen zavolalo: pravidlo o tom, co
 * pohled na graf tvrdí o kontrole, nesmí existovat ve dvou opisech.
 */
export function worstGateOfView(view: PermalinkView): GateStatus | null {
  const edges =
    view.kind === "cesta"
      ? (view.trail?.edges ?? [])
      : view.kind === "trasa"
        ? view.trail.edges
        : view.kind === "okoli"
          ? view.neighbourhood.edges
          : [];
  let worst: GateStatus | null = null;
  for (const e of edges) {
    if (e.gate === "rejected") return "rejected";
    if (e.gate === "pending_review") worst = "pending_review";
    else if (e.gate === "verified" && worst === null) worst = "verified";
  }
  return worst;
}
