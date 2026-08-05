/*
 * Adresář odběrů — čistý seznam veřejných feedů platformy.
 *
 * PROČ VŮBEC: čtyři rodiny feedů sdílejí jeden drát (JSON Feed 1.1 + RSS 2.0,
 * jeden validátor `parseEvidenceFeedJson` pro všechny), a přesto neexistovala
 * jediná stránka, ze které by se o nich čtenář dozvěděl — adresy žily v
 * hlavičkách route handlerů. Rozcestník patří sem, na /data: to je plocha, kde
 * platforma vydává svoje strojové podoby.
 *
 * ČTYŘI, NE PĚT. Rodina = jeden obsah ve dvou formátech (`.xml` + `.json`),
 * tedy osm adres. `/schranka/novinky.json` je pátá adresa téhož obsahu jako
 * `/schranka/feed.*`, ale NENÍ feed (je to odpověď pro odznak lišty), a tak je
 * v seznamu vedená jako to, čím je. Počty na ploše se počítají z tohohle pole,
 * nikdy se nepíšou číslicí.
 *
 * COPY JE V KATALOGU (2026-08-05, vzor /overeni): modul zůstává čistý a vrací
 * KLÍČE do `dataReleases.feeds.*` v messages/{cs,en}.json, ne českou větu —
 * plocha (DataReleasesPage) je překládá přes next-intl. Kde je do věty potřeba
 * číslo, které kód už zná (strop záznamů deníku), nese ho `noteValues` —
 * literál v katalogu by se rozešel.
 */

import { FEED_ENTRIES } from "@/features/denik/deriveDenik";

export interface FeedFamily {
  /** Základ adresy; formáty se přidávají jako `.xml` / `.json`. */
  base: string;
  /** Klíč titulku v katalogu `dataReleases.*`. */
  titleKey: string;
  /** Stránka, kterou feed doprovází — lidská podoba téhož obsahu. */
  page: string;
  /** Klíč věty „co feed nese“. Jedna věta, bez příslibů. */
  carriesKey: string;
  /** Klíč omezení / co se musí do adresy dopsat. `null` = nic navíc. */
  noteKey: string | null;
  /** ICU hodnoty poznámky — čísla, která zná kód, ne katalog. */
  noteValues?: Record<string, string | number>;
}

export const FEED_FAMILIES: FeedFamily[] = [
  {
    base: "/denik/feed",
    titleKey: "feeds.family.denik.title",
    page: "/denik",
    carriesKey: "feeds.family.denik.carries",
    noteKey: "feeds.family.denik.note",
    noteValues: { count: FEED_ENTRIES },
  },
  {
    base: "/dukazy/feed",
    titleKey: "feeds.family.dukazy.title",
    page: "/dukazy",
    carriesKey: "feeds.family.dukazy.carries",
    noteKey: "feeds.family.dukazy.note",
  },
  {
    base: "/zakony/kolize/feed",
    titleKey: "feeds.family.kolize.title",
    page: "/zakony/kolize",
    carriesKey: "feeds.family.kolize.carries",
    noteKey: "feeds.family.kolize.note",
  },
  {
    base: "/schranka/feed",
    titleKey: "feeds.family.schranka.title",
    page: "/schranka",
    carriesKey: "feeds.family.schranka.carries",
    noteKey: "feeds.family.schranka.note",
  },
];

/** Formáty, ve kterých každá rodina vychází. Jeden drát, dvě serializace.
 *  Labely jsou jména formátů (RSS 2.0, JSON Feed 1.1) — nepřekládají se. */
export const FEED_FORMATS = [
  { ext: ".xml", label: "RSS 2.0" },
  { ext: ".json", label: "JSON Feed 1.1" },
] as const;

/**
 * Strojové podoby, které NEJSOU feedy. Vedou se odděleně schválně: kdyby
 * spadly do jednoho seznamu, tvrdil by rozcestník o formátu něco, co neplatí.
 */
export const MACHINE_ENDPOINTS: { href: string; titleKey: string; carriesKey: string }[] = [
  {
    href: "/schranka/novinky.json",
    titleKey: "feeds.endpoint.novinky.title",
    carriesKey: "feeds.endpoint.novinky.carries",
  },
  {
    href: "/data/manifest.json",
    titleKey: "feeds.endpoint.manifest.title",
    carriesKey: "feeds.endpoint.manifest.carries",
  },
  {
    href: "/data/snapshot.json",
    titleKey: "feeds.endpoint.snapshot.title",
    carriesKey: "feeds.endpoint.snapshot.carries",
  },
];

/** Všechny vypsané adresy jedním seznamem — zdroj počtu na ploše. */
export const FEED_ADDRESSES: string[] = [
  ...FEED_FAMILIES.flatMap((f) => FEED_FORMATS.map((fmt) => `${f.base}${fmt.ext}`)),
  ...MACHINE_ENDPOINTS.map((e) => e.href),
];

/** Kolik adres rozcestník vypisuje — počítá se, nikdy nepíše číslicí. */
export const feedAddressCount = (): number => FEED_ADDRESSES.length;
