/*
 * Občanská schránka — FEED SLEDOVANÝCH (moonshot 7A, vlna 2).
 *
 * Schránka nemá účty, takže „přihlásit se k odběru" nemůže znamenat řádek
 * v databázi. Znamená to ADRESU: seznam sledovaných entit je zakódovaný
 * v query (`?e=poslanec:6881&e=firma:…`) přesně jako u novinky.json, a kdo tu
 * adresu má, dostane tytéž delty ve své čtečce. Deník tenhle vzor už drží
 * (`/denik/feed.xml?entita=…`); tady je jen jiný výběr.
 *
 * JEDEN SERIALIZÉR: RSS i JSON Feed staví features/denik/feedCodecs — schránka
 * dodává jen KANÁLOVÁ metadata (DenikFeedChannel). Druhý kodek téhož formátu by
 * znamenal dvě místa, kde se opravuje escapování.
 *
 * JEDEN ZDROJ DELT: řádky jsou tytéž `DeltaEntry`, které vidí plocha
 * (getSchrankaDeltas). Feed, který hlásí něco jiného než stránka, je horší než
 * žádný.
 *
 * Čistý modul: adresy si bere zvenku (origin drží route handler).
 */

import type { DenikFeedChannel, DenikFeedItem } from "@/features/denik/feedCodecs";
import { DELTA_ENTRIES_CAP, type DeltaEntry, type EntityDelta } from "./deriveDeltas";

export const SCHRANKA_FEED_TITLE = "Občanská schránka — sledované entity | Politicas";

/** Guid prefix vlastní kanálu: řádek o přepočtu indexu v deníku NENÍ, takže
 *  `politicas:denik:` by tvrdil původ, který nemá. */
export const SCHRANKA_GUID_PREFIX = "politicas:schranka";

/** Kolik položek feed nejvýš nese (týž strop jako deník). */
export const SCHRANKA_FEED_ITEMS = 100;

/**
 * Popis kanálu ŘÍKÁ, co adresa nese a co se s ní děje — odběr bez účtu se
 * jinak čte jako kouzlo. Věta o telemetrii tu není omluva: je to popis
 * transportu, který si čtenář může ověřit (features/schranka/telemetryScrub.ts).
 */
/** Česká shoda s číslovkou: 1 · 2–4 · 5+ (týž princip jako kindVocabulary). */
const entitySuffix = (n: number): string =>
  n === 1 ? "sledovanou entitu" : n >= 2 && n <= 4 ? "sledované entity" : "sledovaných entit";

export function schrankaFeedDescription(keyCount: number, since: string): string {
  const list =
    keyCount === 0
      ? "Tahle adresa zatím nenese žádnou sledovanou entitu, takže feed je prázdný."
      : `Tahle adresa nese ${keyCount} ${entitySuffix(keyCount)} — jejich veřejné klíče jsou přímo v ní (parametry „e“).`;
  return (
    `Novinky sledovaných entit Občanské schránky: datované zápisy Deníku republiky, ` +
    `podepsané forenzní posudky a přepočty indexu přispění, každý se svým zdrojem. ` +
    `${list} Odběr je tedy jen adresa: žádný účet, žádné cookies, nic uloženého na serveru — ` +
    `kdo adresu zná, vidí týž výběr, tak s ní zacházejte. Prahem je den „od“ (teď ${since}). ` +
    // Oba stropy stojí v popisu KANÁLU, protože čtečka jinak nemá jak poznat, že
    // vidí výřez: položky se prostě přestanou objevovat. Čísla jsou dosazená
    // z konstant, které řez opravdu dělají — přepsané do věty by se rozešla
    // s kódem první změnou stropu.
    `Feed nese nejvýš ${SCHRANKA_FEED_ITEMS} položek a z každé sledované entity nejvýš ` +
    `${DELTA_ENTRIES_CAP} nejnovějších zápisů; starší nese deník té entity. ` +
    `Klíče se ze serverové telemetrie škrtají; zůstává jen jejich počet.`
  );
}

/** Adresa feedu i domovské stránky pro daný seznam klíčů (klíče v pořadí, ve
 *  kterém přišly — server delty stejně řadí sám). */
export function schrankaFeedQuery(keys: readonly string[], since: string | null): string {
  const params = new URLSearchParams();
  for (const k of keys) params.append("e", k);
  if (since !== null) params.set("od", since);
  const q = params.toString();
  return q === "" ? "" : `?${q}`;
}

export interface SchrankaFeedContext {
  /** Origin bez lomítka na konci. */
  baseUrl: string;
  keys: readonly string[];
  since: string;
  /** "xml" | "json" — adresa feedu se liší jen příponou. */
  format: "xml" | "json";
}

export function schrankaFeedChannel(ctx: SchrankaFeedContext): DenikFeedChannel {
  const query = schrankaFeedQuery(ctx.keys, ctx.since);
  return {
    title: SCHRANKA_FEED_TITLE,
    description: schrankaFeedDescription(ctx.keys.length, ctx.since),
    homeUrl: `${ctx.baseUrl}/schranka`,
    feedUrl: `${ctx.baseUrl}/schranka/feed.${ctx.format}${query}`,
    guidPrefix: SCHRANKA_GUID_PREFIX,
    // Trvalá adresa řádku je jeho vlastní evidenční stránka (spis, tisk,
    // metodika); bez ní kotva dne v deníku. Kotva dne u řádku, který v deníku
    // není (přepočet indexu), by vedla do vydání, kde ho čtenář nenajde.
    entryUrl: (e, baseUrl) =>
      e.internalHref ? `${baseUrl}${e.internalHref}` : `${baseUrl}/denik#d-${e.date}`,
  };
}

/**
 * Delty → položky feedu. Řádek, který patří víc sledovaným entitám (smlouva je
 * v deltě firmy i poslance), se vydá JEDNOU — v čtečce by jinak přistál dvakrát
 * s týmž guidem. Řazení je den sestupně, pak id vzestupně (determinismus:
 * dvě sestavení téhož vstupu jsou byte-identická).
 *
 * Vydává se `DenikFeedItem` — přesně to, co serializér čte. Řádek delty nemá
 * `kind` deníku ani seznam entit; dopisovat je jen kvůli tvaru typu by znamenalo
 * dvě nepravdy v datech feedu.
 */
export function schrankaFeedEntries(
  deltas: readonly EntityDelta[],
  limit = SCHRANKA_FEED_ITEMS,
): DenikFeedItem[] {
  const byId = new Map<string, DeltaEntry>();
  for (const d of deltas) for (const e of d.entries) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.values()]
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id.localeCompare(b.id)))
    .slice(0, Math.max(0, limit))
    .map(
      (e): DenikFeedItem => ({
        id: e.id,
        date: e.date,
        titleCs: e.titleCs,
        pending: e.pending,
        source: e.source,
        internalHref: e.internalHref,
      }),
    );
}
