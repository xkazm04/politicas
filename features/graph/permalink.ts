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

import type { GraphNode, NodeDetail, PathTrailDto, Trail } from "./graphTypes";

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
  | { kind: "cesta"; variant: GraphVariant; from: string; to: string; path: number };

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
// Tvar:  g.<b64url(kanonický JSON stavu)>.<otisk8>
// Oddělovač je tečka: base64url ani hex ji neobsahují, v URL segmentu je legální.

export interface GraphRef {
  state: GraphViewState;
  /** Otisk OBSAHU pohledu v okamžiku vydání citace (hashViewContent). */
  hash: string;
}

const HASH_RE = /^[0-9a-f]{8}$/;
/** Horní mez délky celé adresy (vzor claimRef.ts). */
const MAX_REF_LENGTH = 700;

export function encodeGraphRef(state: GraphViewState, hash: string): string {
  return `g.${toBase64Url(canonicalJson(state))}.${hash}`;
}

export function decodeGraphRef(encoded: string): GraphRef | null {
  if (typeof encoded !== "string" || encoded.length === 0 || encoded.length > MAX_REF_LENGTH) {
    return null;
  }
  const parts = encoded.split(".");
  if (parts.length !== 3 || parts[0] !== "g" || !HASH_RE.test(parts[2])) return null;
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
  return state ? { state, hash: parts[2] } : null;
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
  /** `YYYY-MM-DD` dnešního znovuodvození (datum získání dat). */
  retrievedOn: string;
  /** Český titulek pohledu — sází ho stránka i OG obraz. */
  title: string;
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
    }
  | { kind: "trasa"; trail: Trail }
  | { kind: "uzel"; detail: NodeDetail };

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

// ── Lokální česká zrcadla katalogu překladů ─────────────────────────────────
//
// OG obraz i serverové titulky dnes jdou přes getTranslations (graph.kinds.*,
// graph.trasy.trails.*); tyhle konstanty zůstávají jako POSLEDNÍ ZÁCHRANA pro
// druh/trasu, kterou katalog ještě nezná (t.has → fallback), a pro čisté testy
// bez i18n kontextu. Drž je v sync s graph.trasy.trails, graph.kinds a
// graph.rels.

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
};

export const relLabel = (rel: string): string => REL_LABELS[rel] ?? rel;

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
  url: string;
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

const edgeClaim = (
  fromLabel: string,
  rel: string,
  toLabel: string,
  pending: boolean,
  moneyCzk: number | null,
): JsonLdClaim => ({
  "@type": "Claim",
  name: `${fromLabel} — ${rel} — ${toLabel}`,
  additionalProperty: [
    prop("relation", rel),
    prop("review_state", pending ? "pending_review" : "verified"),
    ...(moneyCzk !== null ? [prop("amount_czk", moneyCzk)] : []),
  ],
});

export function toEvidenceJsonLd(view: PermalinkView): EvidenceJsonLd {
  const parts: JsonLdClaim[] = [];
  if (view.kind === "cesta" && view.trail) {
    for (const row of view.trail.ledger) {
      parts.push(edgeClaim(row.from.label, row.rel, row.to.label, row.pending, row.moneyCzk));
    }
  }
  if (view.kind === "trasa") {
    const byId = new Map(view.trail.nodes.map((n) => [n.id, n.label]));
    for (const e of view.trail.edges) {
      parts.push(
        edgeClaim(byId.get(e.src) ?? e.src, e.rel, byId.get(e.dst) ?? e.dst, e.pending, null),
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
  const sources =
    view.kind === "uzel" && view.detail.links.length > 0
      ? view.detail.links.map((l) => l.url)
      : GRAPH_SOURCE_LINKS.map((s) => s.href);
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `politicas — ${view.title}`,
    identifier: view.ref,
    url: permalinkPath(view.ref),
    dateModified: view.retrievedOn,
    description:
      "Trvalá citace pohledu na znalostní graf české politiky: tvrzení, jejich stav lidské kontroly a odkazy do veřejných registrů, s otiskem obsahu v okamžiku znovuodvození.",
    isBasedOn: sources,
    additionalProperty: [
      prop("content_hash_algorithm", HASH_ALGORITHM),
      prop("content_hash", view.currentHash),
      prop("cited_content_hash", view.urlHash),
      prop("fresh", view.fresh ? "yes" : "no"),
    ],
    hasPart: parts,
  };
}
