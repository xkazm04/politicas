/*
 * EXPONÁT — každý výřez velína a každý datovaný fakt jako citovatelný exponát.
 *
 * Čistý modul, žádný server ani DOM: obsah exponátu se adresuje OTISKEM
 * (content-hash), ne řádkem v databázi. Adresa /dashboard/exponat/<id> nese
 * všechno, co je potřeba k deterministickému znovuodvození: druh exponátu,
 * u faktu jeho stabilní id, a otisk obsahu v okamžiku vydání. Stránka pak
 * obsah znovu odvodí z týchž loaderů (jen čtení, žádný zápis) a otisky
 * porovná — zastaralý exponát to o sobě ŘEKNE, místo aby mlčky ukazoval
 * něco jiného, než co citující článek viděl.
 *
 * ── Pravidla (stejná disciplína jako stateSlice.ts / datedFacts.ts) ─────────
 * 1. DETERMINISMUS: týž výřez ⇒ týž otisk ⇒ táž adresa. Serializace je
 *    kanonická (klíče objektů abecedně, pole v pořadí), takže otisk nezávisí
 *    na pořadí vzniku klíčů v JS objektu.
 * 2. OTISK JE PŘIZNANÝ: patička exponátu vypisuje algoritmus (FNV-1a 32 bit)
 *    i hodnotu. Není to kryptografický podpis a nevydává se za něj — je to
 *    kontrolní otisk obsahu, dost na to, aby změna obsahu byla vidět.
 * 3. ADRESA JE TVRZENÍ: nerozluštitelné id není exponát a stránka na něj
 *    odpoví 404, ne prázdným rámem.
 */

import type { StateGraph } from "@/lib/civic/stateGraph";
import type { StateSlice, StateSliceRule } from "./stateSlice";
import type { DatedFact } from "./datedFacts";

// ── Kanonická serializace ───────────────────────────────────────────────────

/** JSON s rekurzivně seřazenými klíči objektů — `{a,b}` i `{b,a}` dají týž
 *  řetězec. `undefined` hodnoty se vynechávají (stejně jako v JSON.stringify),
 *  takže volitelné pole, které chybí, a pole s `undefined` jsou týž obsah. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

// ── Otisk obsahu (FNV-1a, 32 bit, hex) ──────────────────────────────────────

/** Jméno algoritmu — vypisuje se v patičce exponátu, aby otisk nebyl magické
 *  číslo bez původu. */
export const HASH_ALGORITHM = "fnv-1a/32";

/** FNV-1a nad UTF-8 bajty, 8 hex znaků. Deterministický na serveru i klientu
 *  (TextEncoder je v obou), bez závislostí. */
export function contentHash(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Otisk výřezu: uzly + hrany + pravidlo výběru. Pravidlo je součást obsahu
 *  záměrně — výřez se stejným obrázkem, ale jiným popisem populace, je jiné
 *  tvrzení. */
export const hashSlice = (slice: Pick<StateSlice, "graph" | "rule">): string =>
  contentHash(canonicalJson({ graph: slice.graph, rule: slice.rule }));

/** Otisk datovaného faktu — celý typovaný řádek včetně zdroje a stavu kontroly. */
export const hashFact = (fact: DatedFact): string => contentHash(canonicalJson(fact));

// ── Base64url (bez Buffer/btoa — týž kód na serveru, klientu i ve vitestu) ──

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toBase64Url(text: string): string {
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

/** null = řetězec není platný base64url (adresa je tvrzení; neopravujeme ji). */
export function fromBase64Url(encoded: string): string | null {
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

// ── Kodek adresy exponátu ───────────────────────────────────────────────────
//
// Tvar:  rez.<otisk8>              — výřez grafu (druh + otisk stačí: výřez je
//                                    z definice jen jeden, plyne z pravidla)
//        fakt.<b64url(id)>.<otisk8> — datovaný fakt; id faktu je stabilní
//                                    (viz datedFacts.ts) a jde do adresy celé
// Oddělovač je tečka: base64url ani hex ji neobsahují, v URL segmentu je legální.

export type ExhibitParams =
  | { kind: "rez"; hash: string }
  | { kind: "fakt"; factId: string; hash: string };

const HASH_RE = /^[0-9a-f]{8}$/;

export function encodeExhibitId(params: ExhibitParams): string {
  return params.kind === "rez"
    ? `rez.${params.hash}`
    : `fakt.${toBase64Url(params.factId)}.${params.hash}`;
}

export function decodeExhibitId(id: string): ExhibitParams | null {
  const parts = id.split(".");
  if (parts.length === 2 && parts[0] === "rez" && HASH_RE.test(parts[1])) {
    return { kind: "rez", hash: parts[1] };
  }
  if (parts.length === 3 && parts[0] === "fakt" && HASH_RE.test(parts[2])) {
    const factId = fromBase64Url(parts[1]);
    if (factId === null || factId.length === 0) return null;
    return { kind: "fakt", factId, hash: parts[2] };
  }
  return null;
}

/** Adresa exponátu pro celý výřez — počítá ji plocha velína u afordance. */
export const sliceExhibitId = (slice: Pick<StateSlice, "graph" | "rule">): string =>
  encodeExhibitId({ kind: "rez", hash: hashSlice(slice) });

/** Adresa exponátu pro jeden datovaný fakt. */
export const factExhibitId = (fact: DatedFact): string =>
  encodeExhibitId({ kind: "fakt", factId: fact.id, hash: hashFact(fact) });

// ── Prameny do citační patičky ──────────────────────────────────────────────
//
// Doslovná jména registrů (stejné řetězce nese `DatedFact.source`) + odkazy.
// U výřezu se citují všechny čtyři registry, ze kterých graf vzniká.

export interface ExhibitSourceLink {
  label: string;
  href: string;
}

export const SLICE_SOURCE_LINKS: ExhibitSourceLink[] = [
  { label: "psp.cz — poslanci, tisky, hlasování", href: "https://www.psp.cz" },
  { label: "ares — veřejný rejstřík", href: "https://ares.gov.cz" },
  { label: "registr smluv — smlouvy.gov.cz", href: "https://smlouvy.gov.cz" },
  { label: "e-sbírka — sbírka zákonů", href: "https://www.e-sbirka.cz" },
];

/** `DatedFact.source` → odkaz na registr; klíče jsou doslovné řetězce z
 *  datedFacts.ts, takže se nemohou rozejít tiše — neznámý zdroj prostě
 *  nedostane odkaz a patička vypíše jen jeho jméno. */
export const FACT_SOURCE_LINKS: Record<string, string> = {
  "registr smluv — smlouvy.gov.cz": "https://smlouvy.gov.cz",
  "ares — veřejný rejstřík": "https://ares.gov.cz",
  "psp.cz — historie tisku": "https://www.psp.cz",
};

// ── Pohledový model exponátu (server ho sestaví, klient jen sází) ───────────

export interface ExhibitCommon {
  /** Kanonická adresa exponátu (path segment) — pro odkaz i pro kopírování. */
  id: string;
  /** Otisk z adresy — co viděl ten, kdo exponát vydal. */
  urlHash: string;
  /** Otisk dnešního znovuodvození. Rozdíl ⇒ exponát je zastaralý a řekne to. */
  currentHash: string;
  fresh: boolean;
  /** `YYYY-MM-DD` dnešního sestavení (datum získání dat). */
  builtOn: string;
  /** Průchod grafu, který spočítal kontribuční index; null = uzly ho nenesou. */
  pass: number | null;
}

export type ExhibitViewModel =
  | ({ status: "ok"; kind: "rez"; graph: StateGraph; rule: StateSliceRule } & ExhibitCommon)
  | ({ status: "ok"; kind: "fakt"; fact: DatedFact } & ExhibitCommon)
  /** Fakt, který v dnešním sestavení už není (vypadl z okna knihy nebo se
   *  změnila data). Stránka to přizná — nic „podobného" se nedosazuje. */
  | { status: "gone"; kind: "fakt"; id: string; urlHash: string; builtOn: string };
