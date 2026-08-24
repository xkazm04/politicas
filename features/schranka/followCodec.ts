/*
 * Občanská schránka (moonshot 7A) — kodek lokálního seznamu sledovaných entit.
 *
 * Sledování je LOKÁLNÍ a bez účtu: celý stav žije v localStorage čtenáře
 * (klíč SCHRANKA_STORAGE_KEY). Prohlížeč ho opouští jen jako PARAMETRY ADRESY
 * odběrových cest — /schranka/novinky.json a /schranka/feed.{xml,json} (seznam
 * klíčů + práh dne). Žádné cookies, žádné přihlášení, nic uloženého na serveru.
 *
 * Ale ať je to řečeno přesně, protože „žádná identita" to samo o sobě nezaručí:
 * seznam v adrese je v běžné serverové telemetrii ROVNOU otisk (dvacet klíčů +
 * IP je identifikace, i když je každý klíč veřejný). Proto se klíče ze stop
 * Sentry škrtají a zůstává jen jejich počet — features/schranka/telemetryScrub.ts,
 * zavěšený v sentry.server.config.ts na beforeSend i beforeSendTransaction.
 * Že seznam JEDE v adrese, je záměr (adresa = přenosný odběr), ne nedopatření;
 * plocha /schranka to říká čtenáři stejně otevřeně.
 *
 * Čistý modul bez importů z prohlížeče: parse/serialize se testují jako data.
 * Kodek je záměrně TOLERANTNÍ na vstupu (rozbitý JSON, cizí tvary, neznámé
 * klíče → zahodí se jen vadný kus, nikdy celý stav) a PŘÍSNÝ na výstupu
 * (serializuje jen validní položky, deterministicky seřazené).
 */

import { canonicalIco } from "@/features/money/companyId";

/**
 * Klíč localStorage — ADRESA schránky. Přípona `:v1` je součástí adresy, ne
 * verze tvaru, a UŽ SE NIKDY NEZVEDÁ.
 *
 * Původně to bylo obráceně: verze žila v klíči a „změna tvaru = nový klíč,
 * žádná migrace". To je pravda, ale kupuje se to špatnou měnou — při první
 * změně tvaru zůstane starý seznam ležet pod starým klíčem, kam se už nikdo
 * nepodívá. Čtenář neuvidí „migrace se nekonala", uvidí, že mu ZMIZELO
 * sledování, které si sám postavil (seznam sledovaných je autorský obsah,
 * ne cache), a v úložišti se hromadí smetí, které nikdo neuklidí.
 *
 * Adresa a tvar se proto vyvíjejí ODDĚLENĚ: klíč je adresa (stabilní), verze
 * je v PAYLOADU (SCHRANKA_SCHEMA_VERSION níž). Hedge se sází teď, dokud je
 * tvar pořád v1 a v terénu neexistuje nic jiného — později by to znamenalo
 * hádat, co je uložené.
 */
export const SCHRANKA_STORAGE_KEY = "politicas:schranka:v1";

/**
 * Verze TVARU uloženého payloadu. Zapisuje se dovnitř dat (`v`), čte se při
 * rehydrataci a směruje payload migračním řetězcem níž.
 *
 * Payload BEZ `v` je tvar 1 — přesně to, co zapisovaly verze aplikace před
 * touhle změnou. Nejde o vadu, kterou je třeba zahodit; je to nejstarší tvar
 * v terénu a chová se jako v1, protože jím je.
 */
export const SCHRANKA_SCHEMA_VERSION = 1;

/**
 * Migrace tvaru N → N+1, indexované OD verze. Dnes prázdné, protože existuje
 * jediný tvar — a přesto tu ta prázdná tabulka stojí, kvůli pravidlu, které
 * jinak nemá kam být napsané:
 *
 *   Změna tvaru PŘIDÁ krok a zvedne SCHRANKA_SCHEMA_VERSION.
 *   NEZVEDNE SCHRANKA_STORAGE_KEY.
 *
 * Jednou vydaný krok je ZMRAZENÝ: popisuje tvar, který je v tu chvíli
 * v prohlížečích čtenářů, a jeho úprava rozbije právě ty instalace, které
 * ten tvar drží. Nová změna připisuje nový krok, nikdy nepřepisuje starý.
 * Krok musí být TOTÁLNÍ nad svým vstupem — včetně payloadů, které zapsalo
 * chybné vydání té verze.
 */
const MIGRATIONS: Record<number, (o: Record<string, unknown>) => Record<string, unknown>> = {};

/** Strop sledovaných entit — pojistka proti nekonečnému růstu URL dotazu
 *  na novinky (klíče se posílají jako query parametry). */
export const MAX_FOLLOWS = 100;

/** Jedna sledovaná entita. Klíč je týž veřejný klíč, kterým deník adresuje
 *  filtr `?entita=` (features/denik/deriveDenik.ts) — adresa odběru = adresa
 *  sledování. `label` je jen nápověda z okamžiku sledování; plocha schránky
 *  dává přednost popisku odvozenému ze záznamů serveru. */
export interface Follow {
  key: string;
  label: string;
  /** ISO instant, kdy čtenář entitu začal sledovat. */
  followedAt: string;
}

/**
 * Vodoznak viděného — co plocha schránky při poslední návštěvě SKUTEČNĚ
 * ukázala. Den záznamů deníku je nejjemnější zrnitost, kterou data mají, takže
 * samotné razítko návštěvy odznak v liště zhasnout neumí (den návštěvy se
 * počítá celý znovu — to je pravidlo PLOCHY, viz deriveDeltas). Odznak proto
 * odečítá počet zápisů toho dne, které měl čtenář před očima.
 */
export interface SeenWatermark {
  /** `YYYY-MM-DD` — den, od kterého se při té návštěvě počítalo. */
  day: string;
  /** Kolik zápisů s dnem >= `day` plocha při návštěvě nesla. */
  count: number;
}

export interface SchrankaState {
  follows: Follow[];
  /** ISO instant poslední návštěvy /schranka; null = ještě nikdy. */
  lastVisit: string | null;
  /** Vodoznak viděného pro odznak lišty; null = nic se ještě neodečítá. */
  seen: SeenWatermark | null;
}

export const EMPTY_SCHRANKA: SchrankaState = { follows: [], lastVisit: null, seen: null };

/**
 * Validní veřejné klíče entit. Držené tvary:
 *   poslanec:<pspId>  — spis /poslanec/<pspId>
 *   firma:<ičo>       — spis firmy /penize/firma/<ičo> (od 2026-08-04; dřív
 *                       firma vlastní stránku neměla a klíč vedl jen na filtr)
 *   tisk:<číslo>      — sněmovní tisk /zakony/<číslo>
 *   obec:<ičo>        — zrcadlo rozpočtu /rozpocty/<ičo>. Klíč se PARSUJE
 *                       (starší uložená sledování nikdo nemaže), ale chrom ho
 *                       už nenabízí: deník obecní fakta nevede, takže by
 *                       odběr nemohl nic doručit (viz followableFromRoute).
 */
export function isEntityKey(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^(poslanec:\d{1,7}|tisk:\d{1,7}|firma:\d{6,8}|obec:\d{6,8})$/.test(v)
  );
}

/** Interní evidenční stránka klíče, je-li jaká. IČO se normalizuje na
 *  kanonický osmimístný tvar TOUŽ funkcí jako uzel grafu (companyId.ts) —
 *  klíč schránky nese 6–8 číslic, adresa spisu firmy vždy 8. */
export function entityHref(key: string): string | null {
  const m = key.match(/^(poslanec|tisk|firma|obec):(.+)$/);
  if (!m) return null;
  switch (m[1]) {
    case "poslanec":
      return `/poslanec/${m[2]}`;
    case "tisk":
      return `/zakony/${m[2]}`;
    case "firma": {
      const ico = canonicalIco(m[2]);
      return ico === null ? null : `/penize/firma/${ico}`;
    }
    case "obec":
      return `/rozpocty/${m[2]}`;
    default:
      return null;
  }
}

/** Deník entity — filtr je adresa (precedens /denik `?entita=`). */
export function entityDenikHref(key: string): string {
  return `/denik?entita=${encodeURIComponent(key)}`;
}

const isIsoInstant = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && Number.isFinite(Date.parse(v));

function parseFollow(v: unknown): Follow | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isEntityKey(o.key)) return null;
  return {
    key: o.key,
    label: typeof o.label === "string" && o.label.length > 0 ? o.label.slice(0, 120) : o.key,
    followedAt: isIsoInstant(o.followedAt) ? o.followedAt : "1970-01-01T00:00:00.000Z",
  };
}

/** Výsledek rehydratace. `fromFuture` je jediná informace, kterou stav sám
 *  nést nemůže: payload zapsala NOVĚJŠÍ verze aplikace, než která ho teď čte
 *  (rollback, druhá záložka po nasazení, synchronizovaný profil). Běžíme na
 *  výchozím stavu, ale volající ho SMÍ jen číst — přepsat ho by zahodilo data,
 *  která novější verze potřebuje. */
export interface SchrankaRead {
  state: SchrankaState;
  fromFuture: boolean;
}

/**
 * Rehydratace jako NEDŮVĚRYHODNÉ čtení. Payload psala jiná verze kódu, mohl ho
 * přerušit zápis, mohl ho někdo ručně upravit. Postup: rozparsovat, přečíst
 * verzi tvaru, projít migračním řetězcem, teprve pak validovat pole po poli.
 *
 * Selhání padá k výchozímu stavu, NIKDY k výjimce: rozbitý payload, který by
 * shodil plochu, mění datový problém v neopravitelný — payload přežije i ten
 * restart, kterým se to čtenář pokusí spravit.
 */
export function readSchranka(raw: string | null): SchrankaRead {
  const empty: SchrankaRead = { state: EMPTY_SCHRANKA, fromFuture: false };
  if (raw === null || raw === "") return empty;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // Vadný JSON = vadný lokální stav, ne chyba systému: kodek je právě to
    // místo, které smí rozbitý vstup potichu srovnat na prázdno (viz hlavička).
    return empty;
  }
  if (typeof data !== "object" || data === null) return empty;
  let o = data as Record<string, unknown>;

  // Verze skew jde OBĚMA směry. Payload z budoucnosti se nepřepisuje ani
  // „nemigruje dolů" — to by zahodilo data, o kterých tenhle kód neví.
  const version = typeof o.v === "number" && Number.isInteger(o.v) && o.v > 0 ? o.v : 1;
  if (version > SCHRANKA_SCHEMA_VERSION) {
    return { state: EMPTY_SCHRANKA, fromFuture: true };
  }
  for (let from = version; from < SCHRANKA_SCHEMA_VERSION; from++) {
    const step = MIGRATIONS[from];
    // Chybějící krok je vada tabulky, ne vlastnost dat — padáme k výchozímu
    // stavu, protože pouštět dál tvar, kterému nikdo nerozumí, je horší.
    if (!step) return empty;
    o = step(o);
  }

  const follows: Follow[] = [];
  const seen = new Set<string>();
  if (Array.isArray(o.follows)) {
    for (const item of o.follows) {
      const f = parseFollow(item);
      if (f === null || seen.has(f.key)) continue;
      seen.add(f.key);
      follows.push(f);
      if (follows.length >= MAX_FOLLOWS) break;
    }
  }
  return {
    state: {
      follows,
      lastVisit: isIsoInstant(o.lastVisit) ? o.lastVisit : null,
      seen: parseSeen(o.seen),
    },
    fromFuture: false,
  };
}

/**
 * Tolerantní parse: cokoli nevalidního (rozbitý JSON, cizí tvar, vadná
 * položka, duplicitní klíč) se ZAHODÍ, zbytek se zachová. Nikdy nevyhazuje —
 * rozbitá schránka degraduje na prázdnou, ne na chybu plochy.
 *
 * Tenká vrstva nad `readSchranka` pro volající, které skew verzí nezajímá.
 */
export function parseSchrankaState(raw: string | null): SchrankaState {
  return readSchranka(raw).state;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Vodoznak je platný jen celý (den + počet); cokoli jiného → null, tedy
 *  „neodečítej nic" — odznak pak raději ukáže víc než zamlčí. */
function parseSeen(v: unknown): SeenWatermark | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.day !== "string" || !DAY_RE.test(o.day)) return null;
  if (typeof o.count !== "number" || !Number.isInteger(o.count) || o.count < 0) return null;
  return { day: o.day, count: o.count };
}

/** Zápis vodoznaku — čistá operace (UI ji jen volá po dokreslení novinek). */
export function withSeen(state: SchrankaState, seen: SeenWatermark): SchrankaState {
  if (!DAY_RE.test(seen.day) || !Number.isInteger(seen.count) || seen.count < 0) return state;
  if (state.seen !== null && state.seen.day === seen.day && state.seen.count === seen.count) return state;
  return { ...state, seen };
}

/** Přísná serializace: jen validní položky, klíče vzestupně (deterministicky —
 *  dvě serializace téhož stavu jsou byte-identické). Verze tvaru jde první,
 *  aby ji uměl přečíst i ten, kdo payload jen očima prohlédne. */
export function serializeSchrankaState(state: SchrankaState): string {
  const follows = state.follows
    .filter((f) => isEntityKey(f.key))
    .slice(0, MAX_FOLLOWS)
    .sort((a, b) => a.key.localeCompare(b.key));
  return JSON.stringify({
    v: SCHRANKA_SCHEMA_VERSION,
    follows,
    lastVisit: state.lastVisit,
    seen: state.seen,
  });
}

/**
 * Sledovatelná entita AKTUÁLNÍ stránky — z cesty (a filtru deníku) chrom
 * odvodí, koho by tlačítko „sledovat" sledovalo. Čistá funkce kvůli testům;
 * plochy, které tu nejsou, sledovatelné z chromu nejsou (záměr: afordance
 * se zapíná tam, kde je klíč entity jednoznačný z adresy).
 *
 * Peněžní spis poslance (/penize/<pspId>) je TÁŽ entita jako jeho spis na
 * /poslanec/<pspId> — jeden klíč, dvě adresy; klíč z čísla je jednoznačný.
 * Spis firmy (/penize/firma/<ičo>) přibyl 2026-08-04.
 *
 * OBEC tu ZÁMĚRNĚ NENÍ. Klíč `obec:` zůstává platný (uložená sledování se
 * nemažou a schránka je ukazuje), ale nabízet ho jako novou afordanci by
 * slibovalo doručení, které nemá kdo splnit: deník staví záznamy ze smluv,
 * rejstříkových rolí, kroků tisků, rozhodnutí brány a change_event —
 * a žádný z těch proudů obec neklíčuje (features/denik/deriveDenik.ts).
 * Rozpočtová zrcadla jsou generovaná ROČNÍ dávka výkazů, ne datovaný proud.
 * Afordance se proto stahuje, dokud obecní datovaný fakt nebude existovat.
 */
export function followableFromRoute(pathname: string, entita: string | null): string | null {
  if (entita !== null && isEntityKey(entita) && (pathname === "/denik" || pathname === "/schranka")) {
    return entita;
  }
  let m = pathname.match(/^\/poslanec\/(\d{1,7})$/);
  if (m) return `poslanec:${m[1]}`;
  m = pathname.match(/^\/penize\/(\d{1,7})$/);
  if (m) return `poslanec:${m[1]}`;
  m = pathname.match(/^\/zakony\/(\d{1,7})$/);
  if (m) return `tisk:${m[1]}`;
  m = pathname.match(/^\/penize\/firma\/(\d{1,8})$/);
  if (m) {
    const ico = canonicalIco(m[1]);
    return ico === null ? null : `firma:${ico}`;
  }
  return null;
}

/**
 * Klíče z parametrů dotazu (novinky.json i feedy schránky) — jedna stráž pro
 * všechny odběrové adresy: zahodí nevalidní tvary, sjednotí duplicity a
 * seřízne na MAX_FOLLOWS. Pořadí VSTUPU se zachovává; server pak sám řadí
 * delty (deriveDeltas), takže na pořadí URL nic nestojí.
 */
export function parseFollowKeys(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!isEntityKey(v) || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= MAX_FOLLOWS) break;
  }
  return out;
}

/** Přidání/odebrání sledování — čisté operace nad stavem (UI je jen volá). */
export function withFollow(state: SchrankaState, key: string, label: string, nowIso: string): SchrankaState {
  if (!isEntityKey(key) || state.follows.some((f) => f.key === key)) return state;
  if (state.follows.length >= MAX_FOLLOWS) return state;
  return { ...state, follows: [...state.follows, { key, label: label || key, followedAt: nowIso }] };
}

export function withoutFollow(state: SchrankaState, key: string): SchrankaState {
  if (!state.follows.some((f) => f.key === key)) return state;
  return { ...state, follows: state.follows.filter((f) => f.key !== key) };
}
