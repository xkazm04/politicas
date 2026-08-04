/*
 * Občanská schránka — ŠKRTNUTÍ SEZNAMU SLEDOVANÝCH Z TELEMETRIE.
 *
 * ── PROBLÉM, KTERÝ TENHLE MODUL ŘEŠÍ ───────────────────────────────────────
 * Schránka nemá účet: seznam sledovaných entit jede v ADRESE dotazu
 * (`/schranka/novinky.json?e=poslanec:1&e=firma:…`), aby si čtenář mohl svůj
 * pohled uložit i poslat dál. Jenže `sentry.server.config.ts` vzorkuje stopy
 * na 1,0 — a měřeno na skutečné události SDK (telemetryScrub.test.ts pouští
 * `Sentry.startSpan` přes `beforeSendTransaction`) se ta adresa v události
 * ROZKOPÍRUJE: nastaví se jediný atribut `url.full` a v `contexts.trace.data`
 * pak leží i `http.query` — parametr, který jsme nikdy nenastavili, protože si
 * ho SDK odvodí samo (a `url` bez query k tomu). S nakonfigurovaným DSN
 * by tedy seznam dvaceti sledovaných poslanců (spolu s IP adresou requestu)
 * ležel u třetí strany — a takový seznam je otisk prstu, ne anonymní dotaz.
 *
 * ── PRAVIDLO ────────────────────────────────────────────────────────────────
 * Škrtá se podle PARAMETRU, ne podle cesty: každý parametr `e`, jehož hodnota
 * je platný klíč entity (followCodec.isEntityKey), z telemetrie zmizí a
 * nahradí ho `e_count=<kolik jich bylo>`. Počet zůstává, protože ladit se dá
 * i bez identity („dotaz nesl 47 klíčů" je provozní fakt, ne otisk).
 * Podle parametru proto, že cesta se v události vyskytuje v několika tvarech
 * (absolutní URL, relativní adresa i holý query string) a pravidlo, které se
 * o ni opírá, by na jednom z nich tiše selhalo.
 *
 * NENÍ to anonymizace requestu: IP adresu a hlavičky řeší konfigurace Sentry
 * (`sendDefaultPii`), ne tenhle modul. Řeší JEDNU věc — aby seznam sledovaných
 * neopustil server.
 *
 * Čistý modul (žádné I/O, žádná závislost na SDK): testuje se jako data
 * a `sentry.server.config.ts` ho jen zaváže na `beforeSend`/`beforeSendTransaction`.
 */

import { isEntityKey } from "./followCodec";

/** Parametr, kterým odběrové adresy schránky nesou klíče sledovaných entit. */
export const FOLLOW_QUERY_PARAM = "e";
/** Náhrada v telemetrii — počet přežije, klíče ne. */
export const FOLLOW_COUNT_PARAM = "e_count";

/** Vyškrtne klíče z parametrů; true = něco se škrtlo. */
function scrubParams(params: URLSearchParams): boolean {
  const values = params.getAll(FOLLOW_QUERY_PARAM);
  // Škrtá se jen tam, kde `e` opravdu nese klíč entity — cizí `e` (jiná
  // stránka, jiný význam) se nesmí měnit, telemetrie by pak lhala o cizím
  // dotazu.
  if (!values.some((v) => isEntityKey(v))) return false;
  params.delete(FOLLOW_QUERY_PARAM);
  params.set(FOLLOW_COUNT_PARAM, String(values.length));
  return true;
}

/**
 * Adresa (absolutní, relativní i holý query string) bez seznamu sledovaných.
 * Nezasažená hodnota se vrací BEZE ZMĚNY — telemetrie se přepisuje jen tam,
 * kde by jinak nesla klíče.
 */
export function scrubFollowUrl(value: string): string {
  if (!value.includes(`${FOLLOW_QUERY_PARAM}=`)) return value;

  const q = value.indexOf("?");
  if (q >= 0) {
    const params = new URLSearchParams(value.slice(q + 1));
    if (!scrubParams(params)) return value;
    return `${value.slice(0, q)}?${params.toString()}`;
  }

  // Holý query string (`http.query` v trace datech SDK) — nemá cestu ani
  // otazník. Adresa BEZ query se sem nesmí dostat jako query.
  if (value.includes("://") || value.startsWith("/")) return value;
  const params = new URLSearchParams(value);
  if (!scrubParams(params)) return value;
  return params.toString();
}

/** Minimální tvar události, na kterém tenhle modul pracuje — držet se struktury
 *  místo typů SDK znamená, že modul zůstane čistý a testovatelný jako data. */
interface ScrubbableEvent {
  transaction?: unknown;
  request?: { url?: unknown; query_string?: unknown } | unknown;
  contexts?: { trace?: { data?: unknown } | unknown } | unknown;
  spans?: unknown;
  breadcrumbs?: unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Projde hodnoty jednoho slovníku atributů a škrtne v řetězcích. */
function scrubValues(bag: unknown): void {
  if (!isRecord(bag)) return;
  for (const [k, v] of Object.entries(bag)) {
    if (typeof v === "string") bag[k] = scrubFollowUrl(v);
  }
}

/**
 * Událost Sentry bez seznamu sledovaných — MUTUJE a vrací tutéž událost
 * (kontrakt `beforeSend` / `beforeSendTransaction`).
 *
 * Místa jsou vybraná podle SKUTEČNÉ události SDK, ne podle domněnky (viz
 * hlavička a test): `contexts.trace.data` nese adresu v několika atributech,
 * `request.url` / `request.query_string` plní http integrace v Next runtime,
 * `spans[].data` totéž pro dětské spany a `breadcrumbs[].data` pro odchozí
 * fetch. Neznámý tvar se nechá být — nikdy se nevyhazuje výjimka z hooku,
 * který by tím zahodil celou událost.
 */
export function scrubFollowTelemetry<T extends ScrubbableEvent>(event: T): T {
  if (!isRecord(event)) return event;

  if (typeof event.transaction === "string") {
    (event as Record<string, unknown>).transaction = scrubFollowUrl(event.transaction);
  }

  if (isRecord(event.request)) {
    const req = event.request;
    if (typeof req.url === "string") req.url = scrubFollowUrl(req.url);
    if (typeof req.query_string === "string") req.query_string = scrubFollowUrl(req.query_string);
    // `query_string` smí být i slovník nebo pole dvojic (tvar Sentry).
    if (isRecord(req.query_string)) scrubValues(req.query_string);
  }

  if (isRecord(event.contexts) && isRecord(event.contexts.trace)) {
    scrubValues(event.contexts.trace.data);
  }

  if (Array.isArray(event.spans)) {
    for (const span of event.spans) if (isRecord(span)) scrubValues(span.data);
  }

  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) if (isRecord(crumb)) scrubValues(crumb.data);
  }

  return event;
}
