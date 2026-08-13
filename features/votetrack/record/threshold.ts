// Kolik hlasů bylo u hlasování potřeba — a jak daleko od toho prahu výsledek stál.
//
// ── Proč tenhle modul vznikl (2026-08-13) ──────────────────────────────────────
// `vote_event` nese od první migrace dva sloupce, které se do produktu nikdy
// nedostaly: `quorum` (kolik hlasů bylo podle zdroje potřeba) a `present` (kolik
// poslanců zdroj u toho hlasování uvádí jako přítomné). Ingesce je čte
// (lib/ingest/sources/psp.ts), DDL je drží, mapper je mapuje a kontrola kvality je
// skóruje — a JEDINÁ projekce `vote_event` do aplikace, `toEventIn()`
// v ledgerRead.ts, je oba zahazovala. Deník tedy uměl říct, jak se hlasovalo, ale
// ne, na co ten výsledek stačil nebo nestačil.
//
// ── Co se předává a co se odvozuje ─────────────────────────────────────────────
// PŘEDÁVÁ SE DOSLOVA, včetně `null`: `quorum`, `present` a zveřejněné `yes`. Jsou
// to sloupce zdroje a chovají se tu přesně jako zveřejněné součty v
// record/reconcile.ts — chybějící sloupec je neporovnaný slot, nikdy domyšlená
// nula.
// ODVOZUJE SE: `margin` (zveřejněné „pro" minus práh) a `simpleMajority` (prostá
// většina přítomných, floor(present/2)+1). Plocha obojí označuje za odvozené.
//
// ── Proč se `margin` počítá ze ZVEŘEJNĚNÉHO „pro", ne z našeho přepočtu ────────
// Práh i „pro" jsou dva sloupce JEDNOHO řádku `vote_event`. Rozdíl mezi nimi je
// tedy tvrzení zdroje o sobě samém. Kdyby se od zveřejněného prahu odečítal náš
// přepočet ze 406 000 jmenovitých hlasů, mísily by se dvě vrstvy, které se — jak
// record/reconcile.ts ukazuje — mohou rozcházet, a rozdíl proti prahu by pak nesl
// odchylku, o které by věta mlčela. Kontrola přepočtu proti zveřejněným součtům
// stojí vedle a rozpor pojmenuje sama.
//
// ── Dvě pravidla, která tenhle modul drží ──────────────────────────────────────
//  1. CHYBĚJÍCÍ SLOUPEC JE `null`, NIKDY DOPOČET. Práh se z počtu přítomných
//     NEDOVOZUJE. Kdyby se dovozoval, `differs` by z definice bylo vždycky
//     nepravda a celý nález — hlasování, u kterých práh prostou většinou
//     přítomných NENÍ — by zmizel dřív, než by se dal vykreslit.
//  2. PRÁH, KTERÝ NENÍ PROSTOU VĚTŠINOU PŘÍTOMNÝCH, JE ÚDAJ — NE PRÁVNÍ KATEGORIE.
//     Modul spočítá, ŽE se práh liší, a řekne, jaká by prostá většina přítomných
//     byla. Že jde o většinu absolutní, ústavní nebo o přehlasování senátního
//     veta, tvrdit nemůže: zdroj u hlasování žádný takový sloupec nenese, takže by
//     to byl výklad, ne měření. Stránka proto žádný předpis nejmenuje.
//
// Čistý modul (žádný store, žádné `server-only`), testovaný v threshold.test.ts.

/** Sloupce prahu tak, jak je nese jeden řádek `vote_event`. Oba smějí být `null` —
 *  ingesce veze to, co vezl dump, a nic se nedoplňuje. */
export interface ThresholdIn {
  /** `vote_event.quorum` — kolik hlasů bylo podle zdroje potřeba. */
  quorum: number | null;
  /** `vote_event.present` — kolik poslanců zdroj u hlasování uvádí jako přítomné. */
  present: number | null;
}

/**
 * Práh jednoho hlasování, jak ho vidí čtenář.
 *
 * `present` NENÍ docházka. Je to počet, který sněmovna u toho jednoho jmenovitého
 * hlasování zveřejnila; s mírou omluvené absence (`absence_rate`, registr omluv),
 * ze které se počítá docházková složka indexu, nemá společný ani zdroj, ani
 * jednotku, ani populaci. Žádná plocha ta dvě čísla nespojuje.
 */
export interface VoteThreshold {
  /** Sloupec zdroje, doslova. */
  quorum: number | null;
  /** Sloupec zdroje, doslova. */
  present: number | null;
  /** `vote_event.yes` — zveřejněné „pro". Veze se, protože `margin` je jeho rozdíl. */
  publishedYes: number | null;
  /** ODVOZENÉ: `publishedYes − quorum`. Kladné = nad prahem, záporné = pod ním.
   *  `null`, chybí-li kterýkoli ze dvou vstupů — nikdy dopočtená nula. */
  margin: number | null;
  /** ODVOZENÉ: prostá většina přítomných, tedy `floor(present/2)+1`.
   *  `null`, když zdroj počet přítomných neuvádí. */
  simpleMajority: number | null;
  /** ODVOZENÉ: liší se zveřejněný práh od prosté většiny přítomných?
   *  `null` = posoudit to nejde, protože chybí práh nebo počet přítomných —
   *  a to je jiné tvrzení než „neliší se". */
  differs: boolean | null;
}

/** Celé nezáporné číslo, nebo nic. `NaN`, zlomek i záporná hodnota jsou pro tenhle
 *  modul „zdroj to neuvádí": počet poslanců ani počet hlasů nic z toho být nemůže,
 *  a dopočítávat se tu zásadně nic nesmí. */
const countOrNull = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;

/** Prostá většina přítomných — `floor(present/2)+1`. `null`, když počet přítomných
 *  není údaj. Vlastní export proto, že je to POROVNÁVACÍ hodnota: plocha ji tiskne
 *  vedle zveřejněného prahu, aby si čtenář rozdíl mohl přepočítat sám. */
export function simpleMajorityOf(present: number | null | undefined): number | null {
  const p = countOrNull(present);
  return p === null ? null : Math.floor(p / 2) + 1;
}

/**
 * Práh jednoho hlasování ze sloupců zdroje. Vrací se VŽDY objekt — chybějící údaj
 * je `null` uvnitř, ne chybějící blok: „zdroj to neuvádí" je zjištění a plocha ho
 * má co říct, kdežto vynechaný blok se od nedopatření nedá odlišit.
 */
export function deriveThreshold(
  input: ThresholdIn | null | undefined,
  publishedYes: number | null | undefined,
): VoteThreshold {
  const quorum = countOrNull(input?.quorum);
  const present = countOrNull(input?.present);
  const yes = countOrNull(publishedYes);
  const simpleMajority = simpleMajorityOf(present);
  return {
    quorum,
    present,
    publishedYes: yes,
    margin: quorum === null || yes === null ? null : yes - quorum,
    simpleMajority,
    differs: quorum === null || simpleMajority === null ? null : quorum !== simpleMajority,
  };
}

/** Populace nálezu o prazích přes celý záznam. Mez bez populace je tvrzení (vzor
 *  `chronicleTotal`): „u dvaatřiceti hlasování je práh jiný" se bez jmenovatele
 *  čte úplně jinak než „dvaatřicet z devíti tisíc". */
export interface ThresholdCoverage {
  /** Platná hlasování, u kterých zdroj neuvádí počet potřebných hlasů. */
  withoutQuorum: number;
  /** Platná hlasování, u kterých šlo práh s prostou většinou přítomných porovnat
   *  (zdroj uvádí obojí) — JMENOVATEL `thresholdDiffers`. */
  thresholdComparable: number;
  /** Z porovnatelných ta, u kterých se práh od prosté většiny přítomných liší. */
  thresholdDiffers: number;
}

/** Sečte pokrytí přes prahy platných hlasování. Pořadí vstupu na výsledku nezáleží. */
export function summarizeThresholds(rows: Iterable<VoteThreshold>): ThresholdCoverage {
  let withoutQuorum = 0;
  let thresholdComparable = 0;
  let thresholdDiffers = 0;
  for (const t of rows) {
    if (t.quorum === null) withoutQuorum++;
    if (t.differs === null) continue;
    thresholdComparable++;
    if (t.differs) thresholdDiffers++;
  }
  return { withoutQuorum, thresholdComparable, thresholdDiffers };
}
