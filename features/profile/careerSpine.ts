/*
 * Kariérní spis — odvození služebního záznamu poslance přes volební období.
 *
 * ČISTÁ funkce nad tím, co registr psp.cz DOOPRAVDY nese (ověřeno 2026-07-30
 * přímo nad poslanci.zip, stejné řádky drží store):
 *
 *   - `mandate` (poslanec.unl): 2 157 řádků napříč VŠEMI obdobími PSP1–PSP10
 *     (204–237 na období; 207 v PSP10). Mandát nese kraj a kandidátku
 *     (organ-odkazy do minulých období — registr organů je také úplný),
 *     ale ŽÁDNÁ data od/do.
 *   - sněmovní organy PSP1–PSP10 s okny platnosti (PSP1 od 1992-06-06,
 *     PSP10 od 2025-10-04, do = null — běžící období).
 *   - `membership` (zarazeni.unl) na sněmovním organu: osobní okno mandátu
 *     (od/do; do = null u běžícího mandátu). 2 345 takových řádků.
 *
 * Co registr NENESE: hlasování/aktivitu mimo PSP10 (jen hl-2025ps je
 * ingestováno) a částečné PSP9 přes `contribution_psp9` na uzlu osoby.
 * Odvození proto ke každému období přiznává POKRYTÍ záznamu — období bez
 * ingestovaných dat je přiznaná mezera („období zatím mimo záznam"), nikdy
 * dopočtený trend. To je stejná disciplína jako TenureTrendGate.
 *
 * Hranice věrohodnosti dat: sdílený `lib/analysis/plausible-date.ts` má dolní
 * mez 1993-01-01 (vznik ČR — kalibrováno na registr smluv). První sněmovna
 * ale byla zvolena 1992-06-06 (ČNR, transformovaná k 1. 1. 1993), takže spis
 * používá VLASTNÍ dolní mez `PSP_ERA_FROM` = den ustavení PSP1. Horní mez je
 * `asOf` stránky — datum v budoucnosti (korpus nese i rok 2925) se potlačí a
 * řádek to řekne, nikdy se „neopraví".
 */

/** Dolní hranice sněmovní éry: ustavení PSP1 (volby do ČNR 1992). */
export const PSP_ERA_FROM = "1992-06-01";

/** Jeden mandát z registru (řádek `mandate`), s už přeloženými popisky. */
export interface ServedTermInput {
  termCode: string;
  /** Volební kraj (organ z registru), null když mandát kraj nenese. */
  region: string | null;
  /** Kandidátka (organ z registru), null když mandát kandidátku nenese. */
  partyList: string | null;
}

/** Sněmovní organ jednoho období (okno platnosti celé sněmovny). */
export interface ChamberTermInput {
  termCode: string;
  validFrom: string | null;
  validTo: string | null;
}

/** Osobní okno mandátu: membership řádek na sněmovním organu (kind "member"). */
export interface ChamberWindowInput {
  termCode: string;
  fromAt: string | null;
  toAt: string | null;
}

/** Pokrytí ingestovaného záznamu aktivity pro jedno období. */
export type TermCoverage = "full" | "partial" | "none";

export interface CareerTerm {
  termCode: string;
  /** 10 z "PSP10"; null u kódu mimo konvenci (ORGANx fallback ingestu). */
  termNumber: number | null;
  /** Tohle je BĚŽÍCÍ OBDOBÍ. Fakt o SNĚMOVNĚ, ne o člověku. */
  current: boolean;
  /**
   * Poslanec ve sněmovně STÁLE SEDÍ. Do 2026-08-13 tenhle fakt neexistoval a
   * plocha četla `current` jako „slouží": poslanec, který se mandátu v běžícím
   * období vzdal (uzavřené okno, `openEnded: false`), dostával signální rámeček
   * a větu o běžícím záznamu, jako by seděl dál.
   *
   * `null` = z registru se to přečíst NEDÁ (žádné osobní okno, nebo konec
   * s nečitelným datem). Tvrdit „už neslouží" by byl výrok o člověku vyrobený
   * z mezery v datech — a mezeru už přiznává `windowUnknown` / `dateUnreadable`.
   */
  serving: boolean | null;
  /** Okno celé sněmovny (datum, YYYY-MM-DD), z registru organů. */
  chamberFrom: string | null;
  chamberTo: string | null;
  /** Osobní okno mandátu (sloučené přes případné víc řádků). */
  mandateFrom: string | null;
  mandateTo: string | null;
  /** Běžící mandát: aktuální období a žádný konec v registru. */
  openEnded: boolean;
  /** Počet mandátových ÚSEKŮ v období (odchod a návrat = 2) — tedy počet
   *  RŮZNÝCH oken (od, do), ne počet řádků: registr psp.cz nese duplicitní
   *  řádky členství (viz dedupe v getProfileData) a dva identické řádky nejsou
   *  dva úseky služby. */
  stintCount: number;
  /** Served podle `mandate`, ale žádný membership řádek na sněmovně —
   *  osobní okno není z čeho číst a spis to přizná. */
  windowUnknown: boolean;
  /** Okno existuje, ale nese datum mimo <PSP_ERA_FROM, asOf> — potlačeno
   *  a přiznáno, nikdy opraveno. */
  dateUnreadable: boolean;
  region: string | null;
  partyList: string | null;
  coverage: TermCoverage;
}

/** Souvislý blok období MEZI dvěma službami, kdy poslanec ve sněmovně NEBYL.
 *  To není mezera v datech — sněmovna zasedala a mandát v registru není. */
export interface CareerBreak {
  /** Období, po kterém přestávka následuje (termCode). */
  afterTermCode: string;
  /** Vynechaná období, vzestupně (jen PSP<n> mezi dvěma známými čísly). */
  missedTermCodes: string[];
}

/*
 * `firstRecordFrom` tu do 2026-08-13 bylo — počítalo se, testovalo se a
 * NEVYKRESLOVALO se nikde. Je smazané, ne dorenderované, protože mělo přesně tu
 * vadu, kterou tenhle průchod odstraňuje ze sloupce s roky: fallback
 * `mandateFrom ?? chamberFrom` míchá dvě různá měření do jednoho čísla, takže
 * „v evidenci od 2010" mohlo být datum ustavení SNĚMOVNY, ne den, kdy poslanec
 * složil slib. Věta, kterou nelze vyslovit poctivě, se nemá dopočítávat.
 */
export interface CareerSpine {
  /** Chronologicky, nejstarší první; běžící období poslední. */
  terms: CareerTerm[];
  breaks: CareerBreak[];
  servedTermCount: number;
}

export interface CareerSpineOptions {
  served: ServedTermInput[];
  chambers: ChamberTermInput[];
  windows: ChamberWindowInput[];
  currentTermCode: string;
  /** Jeden okamžik hodnocení celé stránky (YYYY-MM-DD) — viz seatsAsOf. */
  asOf: string;
  /**
   * Pokrytí ingestovaného záznamu aktivity PODLE KÓDU OBDOBÍ — z toho, co uzel
   * osoby doopravdy nese. Období, které v mapě není, nemá záznam („none").
   *
   * Do 2026-08-13 tu stál `psp9Coverage` a odvození obsahovalo LITERÁL
   * `termCode === "PSP9"`. Až se sněmovna posune, 10. období — jehož záznam je
   * ingestovaný celý — by na všech 207 spisech tisklo „období zatím mimo
   * záznam", a nic v testech by se nehnulo. Kód období tady proto nefiguruje
   * vůbec: který kód která vlastnost uzlu popisuje, ví loader, který tu
   * vlastnost čte.
   */
  termCoverage: Record<string, TermCoverage>;
}

/**
 * `PSP10` → 10. JEDINÝ převod kódu období na číslo, které se tiskne.
 *
 * Exportované od 2026-08-11: hlavička spisu psala „10. volební období" jako
 * LITERÁL v obou katalozích, zatímco loader četl `PSP10` — přesně ten rozchod,
 * který /zebricek (b9731c5) a /penize (dd71582) už jednou opravovaly, každý
 * zvlášť. Období se mění volbami, ne překladem.
 */
export const termNumberOf = (termCode: string): number | null => {
  const m = /^PSP(\d+)$/i.exec(termCode.trim());
  return m ? Number(m[1]) : null;
};

/** Datum smí být vykresleno jen v <PSP_ERA_FROM, asOf>; jinak null (a caller
 *  přizná `dateUnreadable`). Lexikografické porovnání jako plausible-date.ts. */
const plausibleDay = (iso: string | null, asOf: string): string | null => {
  if (typeof iso !== "string" || iso.length < 10) return null;
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return day >= PSP_ERA_FROM && day <= asOf ? day : null;
};

/**
 * Odvození služebního záznamu. Deterministické: stejný vstup → stejné pořadí
 * i obsah (řazení má úplný pořádek: číslo období, pak kód).
 */
export function deriveCareerSpine(opts: CareerSpineOptions): CareerSpine {
  const { served, chambers, windows, currentTermCode, asOf, termCoverage } = opts;

  const chamberByTerm = new Map(chambers.map((c) => [c.termCode.toUpperCase(), c]));
  const coverageByTerm = new Map(
    Object.entries(termCoverage).map(([code, cov]) => [code.toUpperCase(), cov] as const),
  );

  // Dedupe mandátů podle období (registr nese jeden řádek na osobu × období;
  // duplicitní vstup nesmí vyrobit dvojí řádek záznamu). První výskyt vyhrává —
  // popisky kraj/kandidátka jsou u duplicit stejného období identické.
  const seen = new Set<string>();
  const dedupedServed: ServedTermInput[] = [];
  for (const s of served) {
    const key = s.termCode.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedServed.push({ ...s, termCode: key });
  }

  const windowsByTerm = new Map<string, ChamberWindowInput[]>();
  for (const w of windows) {
    const key = w.termCode.toUpperCase();
    const arr = windowsByTerm.get(key) ?? [];
    arr.push(w);
    windowsByTerm.set(key, arr);
  }

  const terms: CareerTerm[] = dedupedServed.map((s) => {
    const chamber = chamberByTerm.get(s.termCode) ?? null;
    const current = s.termCode === currentTermCode.toUpperCase();
    const rows = windowsByTerm.get(s.termCode) ?? [];

    // Sloučení oken: nejstarší začátek, nejmladší konec; otevřený konec
    // (toAt null) vítězí — mandát běží. Víc řádků = odchod a návrat.
    let mandateFrom: string | null = null;
    let mandateTo: string | null = null;
    let anyOpen = false;
    let dateUnreadable = false;
    // Úseky se počítají podle RŮZNÝCH oken, ne podle řádků: dva identické řádky
    // registru (a ty korpus nese) jsou jeden úsek služby, ne dva.
    const stints = new Set<string>();
    for (const r of rows) {
      stints.add(`${r.fromAt ?? ""}|${r.toAt ?? ""}`);
      const from = plausibleDay(r.fromAt, asOf);
      if (r.fromAt != null && from === null) dateUnreadable = true;
      if (from !== null && (mandateFrom === null || from < mandateFrom)) mandateFrom = from;
      if (r.toAt == null) {
        anyOpen = true;
      } else {
        const to = plausibleDay(r.toAt, asOf);
        if (to === null) dateUnreadable = true;
        else if (mandateTo === null || to > mandateTo) mandateTo = to;
      }
    }
    if (anyOpen) mandateTo = null;

    // Běžící období má úplný záznam z definice (je to období, které tenhle spis
    // celé čte); u ostatních rozhoduje jen to, co uzel osoby nese.
    const coverage: TermCoverage = current ? "full" : (coverageByTerm.get(s.termCode) ?? "none");

    // „Sedí dál" ≠ „je to běžící období". Nečitelný nebo chybějící konec není
    // důkaz odchodu, proto null, ne false.
    const serving: boolean | null = !current
      ? false
      : rows.length === 0
        ? null
        : anyOpen
          ? true
          : mandateTo !== null
            ? false
            : null;

    return {
      termCode: s.termCode,
      termNumber: termNumberOf(s.termCode),
      current,
      serving,
      chamberFrom: chamber ? plausibleDay(chamber.validFrom, asOf) : null,
      // Konec běžícího období je legitimně null; budoucí datum by tu bylo
      // vadou dat a potlačí se stejně jako jinde.
      chamberTo: chamber ? plausibleDay(chamber.validTo, asOf) : null,
      mandateFrom,
      mandateTo,
      openEnded: current && anyOpen,
      stintCount: stints.size,
      windowUnknown: rows.length === 0,
      dateUnreadable,
      region: s.region,
      partyList: s.partyList,
      coverage,
    };
  });

  // Chronologicky: číslo období, pak kód (úplný pořádek i pro ORGANx kódy,
  // které jdou bez čísla na konec před běžící období nikdy nepatří — řadí se
  // za očíslovaná, ale deterministicky podle kódu).
  terms.sort((a, b) => {
    if (a.termNumber !== null && b.termNumber !== null) return a.termNumber - b.termNumber;
    if (a.termNumber !== null) return -1;
    if (b.termNumber !== null) return 1;
    return a.termCode < b.termCode ? -1 : a.termCode > b.termCode ? 1 : 0;
  });

  // Přestávky: mezi dvěma po sobě ODSLOUŽENÝMI obdobími chybí čísla → poslanec
  // ve sněmovně nebyl (reálná nepřítomnost, ne mezera v datech). Jen mezi
  // očíslovanými kódy — bez čísla není z čeho mezery odvodit.
  const breaks: CareerBreak[] = [];
  for (let i = 0; i + 1 < terms.length; i += 1) {
    const a = terms[i];
    const b = terms[i + 1];
    if (a.termNumber === null || b.termNumber === null) continue;
    if (b.termNumber - a.termNumber <= 1) continue;
    const missed: string[] = [];
    for (let n = a.termNumber + 1; n < b.termNumber; n += 1) missed.push(`PSP${n}`);
    breaks.push({ afterTermCode: a.termCode, missedTermCodes: missed });
  }

  return { terms, breaks, servedTermCount: terms.length };
}
