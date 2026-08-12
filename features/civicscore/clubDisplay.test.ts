// Jak se sázejí skutečné kluby PSP10 — a odkud se to bere.
//
// Do 2026-08-12 vedla reálná cesta k názvu a barvě klubu oklikou:
// `CLUB_TO_PARTY_CODE` (v loaderu) mapovala zkratku z rejstříku na kód strany
// v `PARTIES`, tedy v tabulce, jejíž vlastní hlavička o sobě říká
// „ilustrativní mock" a jejíž křesla popisují 9. období. Všech 207 skutečných
// řádků žebříčku tak bralo jméno svého klubu ze vzorku, a Motoristé (v mocku
// devátého období pochopitelně chybějící) potřebovali výjimku přímo v loaderu.
//
// Rozhodnutí ředitele (2026-08-12): ZOBRAZOVANÉ TVARY SE NECHÁVAJÍ — „ANO 2011"
// a „TOP 09" je redakční typografie nad zkratkou z rejstříku, ne tvrzení
// o datech, a srazit /dashboard i titulní specimen na „ANO2011" by byla
// regrese sazby. Nepoctivá byla ZÁVISLOST, a ta končí přestěhováním do
// `CLUB_DISPLAY`.
//
// Tenhle test hlídá obojí: že se přestěhováním nic neztratilo (pokrytí, jména,
// barvy do posledního hexu) a že se okliku nedá potichu vrátit.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CLUB_DISPLAY, PARTIES } from "@/lib/civic/data";

/**
 * Kluby, které uměla stará `CLUB_TO_PARTY_CODE` — vypsané DOSLOVA, i s kódem
 * strany, na který mapovala. Je to historický záznam, ne odvození: kdyby se
 * seznam odvozoval z něčeho živého, přestal by hlídat, že se při stěhování
 * žádný klub neztratil.
 */
const LEGACY_ABBREV_TO_PARTY_CODE: Record<string, string> = {
  ANO2011: "ano",
  ODS: "ods",
  STAN: "stan",
  "KDU-ČSL": "kdu",
  SPD: "spd",
  TOP09: "top",
  Piráti: "pir",
};

/** Motoristé nebyli v `PARTIES` nikdy — loader je řešil výjimkou `abbrev === "MS"`. */
const LEGACY_SPECIAL_CASE = "MS";

const LEGACY_ABBREVS = [...Object.keys(LEGACY_ABBREV_TO_PARTY_CODE), LEGACY_SPECIAL_CASE];

describe("CLUB_DISPLAY pokrývá všechno, co uměla mocková oklika", () => {
  it.each(LEGACY_ABBREVS)("zná klub %s", (abbrev) => {
    expect(CLUB_DISPLAY[abbrev], `CLUB_DISPLAY postrádá klub ${abbrev}`).toBeDefined();
  });

  it("nepřidal se klub, který stará cesta neuměla (nový klub je rozhodnutí, ne překlep)", () => {
    expect(Object.keys(CLUB_DISPLAY).sort()).toEqual([...LEGACY_ABBREVS].sort());
  });

  it("výjimka pro Motoristé je teď řádný záznam, ne větev v loaderu", () => {
    expect(CLUB_DISPLAY[LEGACY_SPECIAL_CASE].name).toBe("Motoristé");
  });
});

describe("jména klubů jsou použitelná a nic se z nich neuseklo", () => {
  it("žádné jméno není prázdné ani obalené mezerami", () => {
    for (const [abbrev, d] of Object.entries(CLUB_DISPLAY)) {
      expect(d.name.length, `${abbrev} nemá jméno`).toBeGreaterThan(0);
      expect(d.name, `${abbrev} má jméno s přebytečnými mezerami`).toBe(d.name.trim());
    }
  });

  // Kluby, jejichž obecně užívaný tvar se od zkratky liší — právě ty, které
  // `name.split(" ")[0]` komolil na „ANO" a „TOP".
  it.each([
    ["ANO2011", "ANO 2011"],
    ["TOP09", "TOP 09"],
    ["MS", "Motoristé"],
  ])("%s se sází jako „%s“, ne jako holá zkratka", (abbrev, expected) => {
    expect(CLUB_DISPLAY[abbrev].name).toBe(expected);
    expect(CLUB_DISPLAY[abbrev].name).not.toBe(abbrev);
  });

  // Sazba, kterou dřív rozbíjelo useknutí na první mezeře. Kdyby se sem někdo
  // vrátil s „ANO", tenhle test spadne dřív než plocha.
  it("víceslovná jména zůstávají víceslovná", () => {
    expect(CLUB_DISPLAY.ANO2011.name.split(" ")).toHaveLength(2);
    expect(CLUB_DISPLAY.TOP09.name.split(" ")).toHaveLength(2);
  });

  // U zbytku JE zkratka tím obecně užívaným tvarem (ODS, SPD, STAN, KDU-ČSL,
  // Piráti) — a to je v pořádku; tvrdit se nesmí opak.
  it("klub bez odlišného tvaru se sází svou zkratkou", () => {
    for (const abbrev of ["ODS", "SPD", "STAN", "KDU-ČSL", "Piráti"]) {
      expect(CLUB_DISPLAY[abbrev].name).toBe(abbrev);
    }
  });
});

describe("barvy se stěhováním nepohnuly", () => {
  it.each(Object.entries(LEGACY_ABBREV_TO_PARTY_CODE))(
    "%s má tutéž barvu jako dřív přes PARTIES.%s",
    (abbrev, code) => {
      const party = PARTIES.find((p) => p.code === code);
      expect(party, `PARTIES postrádá kód ${code}`).toBeDefined();
      expect(CLUB_DISPLAY[abbrev].color).toBe(party!.color);
    },
  );

  it("žádné dva kluby nesdílejí barvu tečky", () => {
    const colors = Object.values(CLUB_DISPLAY).map((d) => d.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("každá barva je hex, ne prázdný řetězec ani token", () => {
    for (const [abbrev, d] of Object.entries(CLUB_DISPLAY)) {
      expect(d.color, `${abbrev} nemá barvu v hexu`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// Grep přes zdroj (styl features/civicscore/a11y.test.ts): repozitář nemá jak
// ověřit „loader nečte mock" jinak než tím, že se podívá, co importuje.
// Kontroluje se IMPORT a POUŽITÍ, ne výskyt řetězce — komentář nad `clubMeta`
// obě stará jména schválně jmenuje, aby vysvětlil, proč tam nejsou.
describe("loader žebříčku už nesahá do mockového katalogu pro jména klubů", () => {
  const LOADER = readFileSync("features/civicscore/getLeaderboardData.ts", "utf8");

  it("neimportuje PARTIES", () => {
    expect(LOADER).not.toMatch(/import\s*\{[^}]*\bPARTIES\b[^}]*\}\s*from\s*"@\/lib\/civic\/data"/);
  });

  it("importuje CLUB_DISPLAY", () => {
    expect(LOADER).toMatch(/import\s*\{[^}]*\bCLUB_DISPLAY\b[^}]*\}\s*from\s*"@\/lib\/civic\/data"/);
  });

  it("okliku přes kód strany už nemá kde vzít", () => {
    expect(LOADER).not.toMatch(/const CLUB_TO_PARTY_CODE/);
    expect(LOADER).not.toMatch(/CLUB_TO_PARTY_CODE\[/);
    expect(LOADER).not.toMatch(/PARTIES\.find\(/);
  });

  it("neznámý klub se nedomýšlí — sází se zkratka a neutrální barva", () => {
    expect(LOADER).toMatch(/return \{ name: abbrev \?\? "—", color: CLUB_FALLBACK_COLOR \}/);
  });
});
