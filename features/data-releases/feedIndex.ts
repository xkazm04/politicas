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
 * Popisy říkají, co feed NESE a čím je omezený. Kde je omezení číslo, které
 * kód už zná (strop záznamů deníku), importuje se — literál by se rozešel.
 */

import { FEED_ENTRIES } from "@/features/denik/deriveDenik";

export interface FeedFamily {
  /** Základ adresy; formáty se přidávají jako `.xml` / `.json`. */
  base: string;
  title: string;
  /** Stránka, kterou feed doprovází — lidská podoba téhož obsahu. */
  page: string;
  /** Co feed nese. Jedna věta, bez příslibů. */
  carries: string;
  /** Čím je omezený, nebo co se musí do adresy dopsat. `null` = nic navíc. */
  note: string | null;
}

export const FEED_FAMILIES: FeedFamily[] = [
  {
    base: "/denik/feed",
    title: "Deník republiky",
    page: "/denik",
    carries:
      "datované záznamy státu — podepsané smlouvy firem, které poslanci vlastní nebo řídí, přikázání tisků výborům, vyhlášení ve Sbírce, zápisy a výmazy rejstříkových rolí, rozhodnutí lidské brány a záznamy o změnách v grafu.",
    note: `posledních ${FEED_ENTRIES} záznamů; parametr ?entita=<klíč> (poslanec:<id> · firma:<ičo> · tisk:<číslo>) zúží feed na jednu entitu — adresa JE odběr.`,
  },
  {
    base: "/dukazy/feed",
    title: "Deník důkazů",
    page: "/dukazy",
    carries:
      "rozhodnutí lidské brány nad vazbami poslanec↔firma — co bylo potvrzeno, zamítnuto a vráceno k doplnění, každé článkem hash-řetězu.",
    note: "poznámky revizorů se nepublikují; feed nese rozhodnutí, ne jeho odůvodnění.",
  },
  {
    base: "/zakony/kolize/feed",
    title: "Kolizní radar",
    page: "/zakony/kolize",
    carries: "kandidáty na střet zájmů mezi sponzorovaným tiskem a peněžní vazbou jeho navrhovatele.",
    note: "nález radaru je signál k prověření, ne prokázaný střet — každý řádek to nese s sebou.",
  },
  {
    base: "/schranka/feed",
    title: "Novinky sledovaných entit",
    page: "/schranka",
    carries: "tytéž záznamy, ale jen o entitách, které sledujete — plus přepočet příspěvkového indexu vašeho poslance.",
    note: "feed je parametrizovaný a bez parametrů nic nesleduje: seznam entit se předává jako ?e=<klíč> (opakovaně) a práh dne jako ?od=RRRR-MM-DD. Nic se neukládá na serveru a žádná identita se neposílá — adresu si sestavuje sama stránka /schranka a klíče se škrtají z telemetrie. Server ovšem pořád vidí IP requestu.",
  },
];

/** Formáty, ve kterých každá rodina vychází. Jeden drát, dvě serializace. */
export const FEED_FORMATS = [
  { ext: ".xml", label: "RSS 2.0" },
  { ext: ".json", label: "JSON Feed 1.1" },
] as const;

/**
 * Strojové podoby, které NEJSOU feedy. Vedou se odděleně schválně: kdyby
 * spadly do jednoho seznamu, tvrdil by rozcestník o formátu něco, co neplatí.
 */
export const MACHINE_ENDPOINTS: { href: string; title: string; carries: string }[] = [
  {
    href: "/schranka/novinky.json",
    title: "Novinky — odpověď pro odznak",
    carries: "tytéž delty jako feed schránky, ale ve tvaru, který si čte lišta aplikace; není to JSON Feed.",
  },
  {
    href: "/data/manifest.json",
    title: "Manifest vydání",
    carries: "verze, řez, kardinality proti prahům a otisky integrity — strojová podoba téhle stránky.",
  },
  {
    href: "/data/snapshot.json",
    title: "Snapshot grafu",
    carries: "výřez odvozeného grafu (kg_node / kg_edge) se stropy přiznanými v poli limits.",
  },
];

/** Všechny vypsané adresy jedním seznamem — zdroj počtu na ploše. */
export const FEED_ADDRESSES: string[] = [
  ...FEED_FAMILIES.flatMap((f) => FEED_FORMATS.map((fmt) => `${f.base}${fmt.ext}`)),
  ...MACHINE_ENDPOINTS.map((e) => e.href),
];

/** Kolik adres rozcestník vypisuje — počítá se, nikdy nepíše číslicí. */
export const feedAddressCount = (): number => FEED_ADDRESSES.length;
