// `?souboj=` — kodek adresy souboje. Připnuté je přesně to, co se v adrese
// nesmí rozejít: kanonické pořadí, mlčení nad výchozím stavem, odmítnutí
// nesmyslu bez opravy a nedotčené cizí parametry (především čočka `?vahy=`).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DUEL_PARAM,
  decodeDuel,
  duelAddress,
  encodeDuel,
  normalizeDuelPair,
  toggleDuelSelection,
} from "./duelParam";

const BASE = "https://politicas.cz/zebricek";
const DEFAULT_PAIR = [6751, 6165] as const;

describe("decodeDuel — z adresy do dvojice", () => {
  it("přečte platnou dvojici a znormalizuje pořadí", () => {
    expect(decodeDuel("6150-6881")).toEqual([6150, 6881]);
    expect(decodeDuel("6881-6150")).toEqual([6150, 6881]);
  });

  it("prázdná / chybějící hodnota není souboj", () => {
    expect(decodeDuel(null)).toBeNull();
    expect(decodeDuel(undefined)).toBeNull();
    expect(decodeDuel("")).toBeNull();
  });

  it("nesmysl se ODMÍTÁ, nikdy neopravuje", () => {
    expect(decodeDuel("6150")).toBeNull(); // jeden poslanec není souboj
    expect(decodeDuel("6150-6881-346")).toBeNull(); // tři
    expect(decodeDuel("6150-babis")).toBeNull(); // jméno
    expect(decodeDuel("-6150")).toBeNull();
    expect(decodeDuel("6150-")).toBeNull();
    expect(decodeDuel("61.5-6881")).toBeNull();
    expect(decodeDuel("-6150-6881")).toBeNull();
    expect(decodeDuel("0-6881")).toBeNull(); // nula není mandátní číslo
    expect(decodeDuel("6150-6150")).toBeNull(); // sám se sebou
    expect(decodeDuel("12345678-6881")).toBeNull(); // mimo tvar mandátního čísla
  });
});

describe("encodeDuel — z výběru do adresy", () => {
  it("úplný výběr mimo výchozí dvojici se zapíše vzestupně", () => {
    expect(encodeDuel([6881, 6150], DEFAULT_PAIR)).toBe("6150-6881");
    expect(encodeDuel([6150, 6881], DEFAULT_PAIR)).toBe("6150-6881");
  });

  it("výchozí dvojice žebříčku se do adresy NEPÍŠE — čistá adresa je kanonická", () => {
    expect(encodeDuel([6751, 6165], DEFAULT_PAIR)).toBeNull();
    expect(encodeDuel([6165, 6751], DEFAULT_PAIR)).toBeNull();
  });

  it("rozdělaný výběr (0 nebo 1) není adresa", () => {
    expect(encodeDuel([], DEFAULT_PAIR)).toBeNull();
    expect(encodeDuel([6150], DEFAULT_PAIR)).toBeNull();
  });

  it("nesmyslná dvojice se nezapisuje", () => {
    expect(encodeDuel([6150, 6150], DEFAULT_PAIR)).toBeNull();
    expect(encodeDuel([0, 6150], DEFAULT_PAIR)).toBeNull();
  });

  it("bez známé výchozí dvojice se zapíše každý úplný výběr", () => {
    expect(encodeDuel([6751, 6165], [])).toBe("6165-6751");
  });
});

describe("kodek je obousměrný", () => {
  it("encode → decode vrátí tutéž znormalizovanou dvojici", () => {
    for (const pair of [
      [6881, 6150],
      [346, 7034],
      [1, 2],
    ] as const) {
      const raw = encodeDuel(pair, DEFAULT_PAIR);
      expect(raw).not.toBeNull();
      expect(decodeDuel(raw)).toEqual(normalizeDuelPair(pair[0], pair[1]));
    }
  });
});

describe("duelAddress — jedno místo, kde se adresa skládá", () => {
  it("zapíše parametr a nechá cestu i fragment na pokoji", () => {
    const { path, href } = duelAddress(`${BASE}#vsichni`, [6881, 6150], DEFAULT_PAIR);
    expect(path).toBe("/zebricek?souboj=6150-6881#vsichni");
    expect(href).toBe("https://politicas.cz/zebricek?souboj=6150-6881#vsichni");
  });

  it("ČOČKA PŘEŽIJE — `?vahy=` se nesmí ztratit ani přeskládat", () => {
    const { path } = duelAddress(`${BASE}?vahy=30-10-20-15-10-15`, [6881, 6150], DEFAULT_PAIR);
    expect(path).toContain("vahy=30-10-20-15-10-15");
    expect(path).toContain("souboj=6150-6881");
  });

  it("cizí parametry přežijí také", () => {
    const { path } = duelAddress(`${BASE}?utm_source=x&vahy=30-10-20-15-10-15`, [6881, 6150], DEFAULT_PAIR);
    expect(path).toContain("utm_source=x");
  });

  it("návrat na výchozí dvojici parametr VYHODÍ, ne přepíše", () => {
    const { path } = duelAddress(`${BASE}?souboj=6150-6881`, [6751, 6165], DEFAULT_PAIR);
    expect(path).toBe("/zebricek");
    expect(path).not.toContain(DUEL_PARAM);
  });

  it("rozdělaný výběr adresu uklidí, ale čočku ponechá", () => {
    const { path } = duelAddress(`${BASE}?vahy=30-10-20-15-10-15&souboj=6150-6881`, [6150], DEFAULT_PAIR);
    expect(path).not.toContain("souboj");
    expect(path).toContain("vahy=30-10-20-15-10-15");
  });

  it("neplatná hodnota v adrese se při zápisu VYMETE (nikdy neopraví)", () => {
    // Tohle je scéna „čtenář přišel s ?souboj=nesmysl": volající dekóduje null,
    // vybere výchozí dvojici a nechá adresu složit znovu.
    const decoded = decodeDuel("nesmysl");
    expect(decoded).toBeNull();
    const { path } = duelAddress(`${BASE}?souboj=nesmysl`, DEFAULT_PAIR, DEFAULT_PAIR);
    expect(path).toBe("/zebricek");
  });
});

// Disciplína ZÁPISU se nedá pokrýt čistým testem (repozitář nemá jsdom ani
// testing-library — viz features/civicscore/a11y.test.ts), a přitom je to
// právě ta část, kde se v tomhle repu už jednou platilo: `useSearchParams()`
// zdynamičtí routu a rozjede hydrataci, `pushState` udělá z výběru deník
// kliknutí. Grep přes zdroj je levná pojistka na obojí.
describe("adresa souboje — disciplína zápisu (grep přes zdroj)", () => {
  const HOOK = readFileSync("features/civicscore/useDuelSelection.ts", "utf8");
  const PAGE = readFileSync("features/civicscore/CivicScorePage.tsx", "utf8");
  const TABLE = readFileSync("features/civicscore/components/LeaderboardTable.tsx", "utf8");

  it("nečte adresu přes useSearchParams (hydratace + dynamická routa)", () => {
    // Na IMPORT, ne na výskyt řetězce: hlavička hooku ten háček jmenuje
    // právě proto, aby vysvětlila, proč se nepoužívá.
    expect(HOOK).not.toMatch(/import\s*\{[^}]*useSearchParams/);
    expect(HOOK).not.toMatch(/from "next\/navigation"/);
  });

  it("čte se až po připojení a při navigaci v historii", () => {
    expect(HOOK).toContain('window.addEventListener("popstate"');
    expect(HOOK).toContain('window.removeEventListener("popstate"');
  });

  it("zapisuje replaceState, nikdy pushState — výběr není navigace", () => {
    expect(HOOK).toContain("window.history.replaceState");
    expect(HOOK).not.toContain("pushState");
  });

  it("adresu skládá JEN duelAddress — žádné ruční lepení parametru", () => {
    // Nehlídá se výskyt řetězce „?souboj=" (ten stojí i v komentářích, kde
    // adresu jen POPISUJE), ale to, kdo sahá na `URLSearchParams`: mimo
    // ./duelParam.ts nikdo.
    expect(HOOK).toContain("duelAddress(");
    expect(HOOK).not.toMatch(/searchParams\.(set|delete)\(/);
    expect(PAGE).not.toMatch(/searchParams\.(set|delete)\(/);
  });

  it("hodnota z adresy jde přes kodek a ověřuje se proti dnešní sněmovně", () => {
    expect(HOOK).toContain("decodeDuel(");
    expect(HOOK).toContain("knownRef");
  });

  it("stránka už nedrží souboj v holém useState", () => {
    expect(PAGE).toContain("useDuelSelection(");
    expect(PAGE).not.toMatch(/useState<number\[\]>/);
  });

  it("vybraný řádek nabízí cestu k panelu odkazem, ne vynuceným rolováním", () => {
    expect(TABLE).toMatch(/\{inDuel && \([\s\S]{0,200}href="#souboj"/);
    expect(TABLE).not.toContain("scrollIntoView");
  });
});

describe("toggleDuelSelection — pravidlo výběru", () => {
  it("třetí výběr vyřadí staršího", () => {
    expect(toggleDuelSelection([6751, 6165], 6881)).toEqual([6165, 6881]);
  });

  it("opětovný klik odebere", () => {
    expect(toggleDuelSelection([6751, 6165], 6165)).toEqual([6751]);
  });

  it("z prázdna vybere jednoho", () => {
    expect(toggleDuelSelection([], 6881)).toEqual([6881]);
  });

  it("vstup se nemutuje", () => {
    const before = [6751, 6165];
    toggleDuelSelection(before, 6881);
    expect(before).toEqual([6751, 6165]);
  });
});
