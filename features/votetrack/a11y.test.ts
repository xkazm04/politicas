// Přístupnost /hlasovani — připnutá GREPEM PŘES ZDROJ, ne renderem.
//
// POCTIVÁ MEZERA, hned na začátku: repozitář nemá jsdom ani testing-library
// (týž stav, jaký přiznává features/civicscore/a11y.test.ts a features/landing/
// motion.test.ts; klávesnice velína se z téhož důvodu ověřovala živým průchodem
// v headless Chrome, ne testem). Grep tedy dokazuje, že atribut ve ZDROJI je —
// ne že strom, který z něj vznikne, je platná ARIA struktura. To se ověřovalo
// čtením struktury, ne testem.
//
// Přesto je to ta správná pojistka: chytá právě tu třídu regrese, která tuhle
// plochu potkala. Do 2026-08-12 neměl celý `features/votetrack` jediné `role=`,
// deník i obě rebelské listiny byly proudy holých `<div>`ů, seismograf měl jeden
// tabstop na hlasovací den (nad reálným záznamem ~74) bez jediné klávesové
// obsluhy a bez viditelného prstenu, šest `<section id>` nemělo jméno (takže pět
// kotev lišty nemělo v odečítačce protějšek) a matice linií nesla význam v holých
// glyfách ▲/▼.
//
// ── JEDNO ROZHODNUTÍ, KTERÉ SE TU PŘIPÍNÁ ZÁMĚRNĚ ──────────────────────────
// Deník, kronika rebelií a žebříček míry rebelie jsou SEZNAMY (`<ul>`/`<li>`
// s přístupným jménem), ne tabulky — a je to ruling, ne opomenutí:
//
//   · řádek deníku není mřížka hodnot, ale skládaná karta (datum · titulek ·
//     pruh sálu · poměr) a od 2026-08-10 je celý obalem kolem tlačítka
//     a kopírovacího odkazu; `role="row"`/`role="cell"` by nad tím musely buď
//     obalit tlačítko buňkou (a zahodit jeho roli), nebo prohlásit celý řádek
//     za jednu buňku — tabulka jen naoko;
//   · řádek kroniky je VĚTA („X hlasoval PRO proti linii svého klubu"), ne řada
//     sloupců;
//   · řádek žebříčku je celý jedním `<Link>` na spis; role řádku/buňky by tu
//     roli odkazu přepsaly. (LeaderboardTable tabulkou je právě proto, že tam
//     odkaz sedí UVNITŘ buňky, kolem jména — tady by to znamenalo zmenšit
//     klikací cíl z celého řádku na jméno, což je změna sazby, ne přístupnosti.)
//
// Sloupcovou mřížkou je vedle nich matice linií — a ta `<table>` opravdu je,
// od 2026-08-12 i se `scope` a s textovou alternativou k oběma glyfám.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { PAGE_SECTIONS } from "@/features/shell/navModel";

const read = (p: string) => readFileSync(p, "utf8");

const LEDGER = read("features/votetrack/components/RealVoteLedger.tsx");
const REBELS = read("features/votetrack/components/RealRebellions.tsx");
const BOARD = read("features/votetrack/components/RealDisciplineBoard.tsx");
const SEISMO = read("features/votetrack/components/Seismograf.tsx");
const TRACK = read("features/votetrack/components/RealVoteTrack.tsx");
const PAGE = read("features/votetrack/VoteTrackPage.tsx");
const THEMES = read("features/votetrack/components/VoteThemeFilter.tsx");
const DETAIL = read("features/votetrack/components/RealChamberDetail.tsx");

const csRecord = csCatalog.votetrack.record as Record<string, string>;
const enRecord = enCatalog.votetrack.record as Record<string, string>;
const csVote = csCatalog.votetrack as unknown as Record<string, string>;
const enVote = enCatalog.votetrack as unknown as Record<string, string>;

/* ── 01 · proud divů se stal seznamem ──────────────────────────────────────── */

describe("deník i obě rebelské listiny jsou pojmenované seznamy, ne proudy divů", () => {
  it("deník je JEDEN seznam a nese přístupné jméno", () => {
    expect([...LEDGER.matchAll(/<ul /g)]).toHaveLength(1);
    expect(LEDGER).toMatch(/<ul className="list-none border-t-2 border-ink" aria-label=\{t\("record\.ledgerListAria"\)\}>/);
  });

  it("zápis deníku je položkou seznamu — a kotva `#h-…` sedí na ní", () => {
    // Kotva musí zůstat na TÉŽE úrovni jako dřív obal `<div>`: `useVoteAnchor`
    // roluje na `#h-<pspId>` a řádek se zvýrazňuje celý.
    expect(LEDGER).toMatch(/<li\s+key=\{v\.pspId\}\s+id=\{voteAnchorId\(v\.pspId\)\}/);
    expect(LEDGER).not.toMatch(/<div\s+key=\{v\.pspId\}\s+id=\{voteAnchorId/);
  });

  it("kronika i žebříček rebelů jsou dva pojmenované seznamy", () => {
    expect([...REBELS.matchAll(/<ul /g)]).toHaveLength(2);
    expect(REBELS).toMatch(/aria-label=\{t\("record\.chronicleListAria"\)\}/);
    expect(REBELS).toMatch(/aria-label=\{t\("record\.topRebelsListAria"\)\}/);
    expect([...REBELS.matchAll(/<li[\s>]/g)].length).toBeGreaterThanOrEqual(4);
  });

  it("výpis témat je pojmenovaný seznam", () => {
    expect([...THEMES.matchAll(/<ul /g)]).toHaveLength(1);
    expect(THEMES).toMatch(/aria-label=\{t\("themeListAria"\)\}/);
  });

  // Ruling z hlavičky: tyhle tři plochy tabulkou NEJSOU. Kdyby je někdo na
  // tabulku převedl, musí to být vědomé rozhodnutí — a tenhle test ho donutí
  // přečíst si, proč tu ruling stojí, místo aby role přibyly mimochodem.
  it("žádná z těch tří ploch se nevydává za tabulku", () => {
    for (const [name, src] of [
      ["RealVoteLedger", LEDGER],
      ["RealRebellions", REBELS],
      ["VoteThemeFilter", THEMES],
    ] as const) {
      expect(src, name).not.toMatch(/role="(table|row|cell|columnheader|rowheader)"/);
    }
  });
});

/* ── 02 · text se skrývá vizuálně, nikdy nemaže z DOM ──────────────────────── */

describe("holé číslo dostává podmět, glyfa dostává slovo — a nic se z DOM nemaže", () => {
  it("poměr „150:30“ v deníku má vedle sebe větu", () => {
    expect(LEDGER).toMatch(/<span className="tabular-nums" aria-hidden>/);
    // Uzavírající uvozovka je součástí vzoru schválně: holé `record.tallyAria`
    // by prošlo i nad překlepem `record.tallyAriaXX` (falzifikováno).
    expect(LEDGER).toMatch(/<span className="sr-only">\s*\{t\("record\.tallyAria",/);
  });

  it("míra rebelie má jmenovku, ne jen procento", () => {
    expect(REBELS).toMatch(/<span className="sr-only">\{t\("record\.rateAria"\)\}/);
  });

  it("šipka ▲/▼ v matici je dekorace a význam nese text vedle ní", () => {
    expect(BOARD).toMatch(/<span aria-hidden>\{s\.line === "yes" \? "▲" : "▼"\}<\/span>/);
    expect(BOARD).toMatch(/<span className="sr-only">\s*\{t\("record\.matrixCellAria"/);
  });

  it("pomlčka v matici je TVRZENÍ („klub linii neměl“), a říká se slovem", () => {
    expect(BOARD).toMatch(/<span className="sr-only">\{t\("record\.matrixNoLine"\)\}<\/span>/);
  });

  // `sr-only` je klip (position/clip-path) — text ZŮSTÁVÁ vykreslený, takže ho
  // najde i hledání v prohlížeči. Tailwindí `hidden` je `display:none`, tedy
  // přesně ta ztráta, kterou pravidlo z round 12 zakazuje.
  //
  // Hlídá se UTILITA `hidden` (i s variantou, `sm:hidden`), ne podřetězec:
  // `overflow-hidden` na pruhu sálu je ořez boxu, ne skrytí textu, a plošný
  // `\bhidden\b` by ho označil za nález. Proto se třídy tokenizují.
  const displayNoneTokens = (src: string): string[] =>
    [...src.matchAll(/className="([^"]*)"/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .filter((c) => c === "hidden" || /(^|:)hidden$/.test(c));

  it("žádná z ploch nesahá po display:none (Tailwind `hidden`)", () => {
    for (const [name, src] of [
      ["RealVoteLedger", LEDGER],
      ["RealRebellions", REBELS],
      ["RealDisciplineBoard", BOARD],
      ["Seismograf", SEISMO],
      ["VoteThemeFilter", THEMES],
    ] as const) {
      expect(displayNoneTokens(src), name).toEqual([]);
    }
  });
});

/* ── 03 · jedna živá oblast na jednu práci ─────────────────────────────────── */

describe("změna se ohlásí — a každou ohlašuje právě jedna živá oblast", () => {
  it("výběr zápisu má JEDINOU živou oblast a stojí mimo panel, který se vyměňuje", () => {
    expect([...TRACK.matchAll(/aria-live/g)]).toHaveLength(1);
    expect(TRACK).toMatch(/role="status" aria-live="polite"[\s\S]{0,120}record\.selectionAria/);
    // Panel sálu se při výběru přemontuje; vlastní živá oblast v něm by se
    // smazala dřív, než ji odečítačka přečte (precedens DuelStatus/HeadToHead).
    expect(DETAIL, "RealChamberDetail nesmí mít vlastní živou oblast").not.toMatch(/aria-live|role="status"/);
    // A řádek deníku nesmí hlásit sám za sebe — dvacet živých oblastí vedle
    // sebe je ticho, ne oznámení.
    expect(LEDGER, "řádek deníku nesmí mít vlastní živou oblast").not.toMatch(/aria-live/);
  });

  it("živá oblast nese větu, ne jen podtržítko: výběr se pojmenuje i s datem", () => {
    expect(TRACK).toMatch(/record\.selectionAria[\s\S]{0,200}title: selected\.title/);
    expect(TRACK).toMatch(/record\.selectionAria[\s\S]{0,260}date:/);
  });

  it("počet vyfiltrovaných hlasování je živá oblast", () => {
    expect([...THEMES.matchAll(/aria-live/g)]).toHaveLength(1);
    expect(THEMES).toMatch(/role="status" aria-live="polite"[\s\S]{0,200}themeListCount/);
  });

  it("prázdný výsledek se ohlásí a stojí VEN ze seznamu, který popírá", () => {
    expect(THEMES).toMatch(/role="status"[\s\S]{0,200}themeListEmpty/);
    const listEnd = THEMES.indexOf("</ul>");
    const emptyAt = THEMES.indexOf("themeListEmpty");
    expect(listEnd).toBeGreaterThan(-1);
    expect(emptyAt).toBeGreaterThan(listEnd);
  });
});

/* ── 04 · seismograf: jeden tabstop, šipky po ose ──────────────────────────── */

describe("seismograf se dá projít klávesnicí", () => {
  it("pravidlo šipek je IMPORTOVANÉ z velína, ne přepsané", () => {
    expect(SEISMO).toMatch(/from "@\/features\/dashboard\/graphTraversal"/);
    for (const fn of ["neighbourStep", "rovingNodeId", "firstNodeId", "lastNodeId", "isArrowKey"]) {
      expect(SEISMO, fn).toContain(fn);
    }
    // Druhá kopie pravidla je přesně to, čemu se importem vyhýbáme.
    expect(SEISMO).not.toMatch(/function neighbourStep|const neighbourStep\s*=/);
  });

  it("pruh má JEDEN tabstop (roving tabindex), ne jeden na den", () => {
    expect(SEISMO).toMatch(/tabIndex=\{rovingId === d\.date \? 0 : -1\}/);
    expect([...SEISMO.matchAll(/tabIndex=/g)]).toHaveLength(1);
  });

  it("šipky chodí po ose, směr bez souseda nic nedělá, Home/End skáčou na kraje", () => {
    expect(SEISMO).toMatch(/if \(isArrowKey\(ev\.key\)\)/);
    expect(SEISMO).toMatch(/if \(next !== null\)/);
    expect(SEISMO).toMatch(/ev\.key === "Home"/);
    expect(SEISMO).toMatch(/ev\.key === "End"/);
  });

  it("Enter ani mezerník nemají vlastní obsluhu — je to nativní <button>", () => {
    // Druhá obsluha by výběr spustila dvakrát (onClick nativně reaguje na obojí).
    expect(SEISMO).not.toMatch(/ev\.key === "Enter"|ev\.key === " "|ev\.key === "Spacebar"/);
    expect(SEISMO).toMatch(/onClick=\{\(\) => setSelectedDate\(d\.date\)\}/);
  });

  it("den má viditelný prsten fokusu", () => {
    expect(SEISMO).toMatch(/focus-visible:outline focus-visible:outline-2[^"]*focus-visible:outline-cobalt/);
  });

  it("klávesový vzorec se TISKNE na ploše (vzor graph.keyboardHint)", () => {
    expect(SEISMO).toMatch(/\{t\("record\.seismoKeyboard"\)\}/);
    // …a věta jmenuje obě klávesy, které se z obrázku nedají uhodnout.
    for (const token of ["Home", "End", "Enter"]) {
      expect(csRecord.seismoKeyboard, token).toContain(token);
      expect(enRecord.seismoKeyboard, token).toContain(token);
    }
  });

  it("pruh je skupina, ne obrázek — listová role by v něm skryla tlačítka dnů", () => {
    expect(SEISMO).toMatch(/role="group"/);
    expect(SEISMO).not.toMatch(/role="img"/);
  });
});

/* ── 05 · matice linií je opravdová tabulka ────────────────────────────────── */

describe("matice linií se čte jako tabulka", () => {
  it("má hlavičky sloupců i hlavičku řádku — jen JSX, komentáře nepočítáme", () => {
    // Precedens civicscore/a11y.test.ts: token `scope="row"` stojí i v komentáři
    // nad kódem a komentář žádnou hlavičku nedělá.
    expect([...BOARD.matchAll(/<th[^>]*scope="(?:col|row)"/g)]).toHaveLength(3);
    expect(BOARD).toMatch(/<th\s+scope="col"/);
    expect(BOARD).toMatch(/<th key=\{v\.pspId\} scope="col"/);
    expect(BOARD).toMatch(/<th scope="row"/);
  });

  it("klub je hlavičkou řádku, ne buňkou", () => {
    expect(BOARD).not.toMatch(/<td className="py-2\.5 pr-3 text-left">/);
  });

  it("tabulka má popisek, který říká, co je řádek a co sloupec", () => {
    expect(BOARD).toMatch(/<caption className="sr-only">\{t\("record\.matrixCaption"\)\}<\/caption>/);
  });

  it("linie se pojmenuje TÝMŽ slovem, jaké vedle sází deník i kronika", () => {
    // `common.voteChoice.*` — jedna věc, jedno jméno na celé stránce. Vazba se
    // připíná NA BUŇKU, ne jen na výskyt kdekoli v souboru: `tcom("voteChoice.*")`
    // v tomhle souboru sází i kontrola přepočtu níž, takže volný `toContain`
    // by prošel i nad buňkou, která si vokabulář opíše po svém.
    expect(BOARD).toMatch(/matrixCellAria[\s\S]{0,120}tcom\("voteChoice\.for"\)/);
    expect(BOARD).toMatch(/matrixCellAria[\s\S]{0,140}tcom\("voteChoice\.against"\)/);
    // Obě komponenty souboru (matice i kontrola přepočtu) si překladač musí
    // vzít samy — chybějící deklarace byla ta chyba, se kterou tahle sada přišla.
    expect([...BOARD.matchAll(/const tcom = useTranslations\("common"\);/g)]).toHaveLength(2);
  });
});

/* ── 06 · sekce, na které míří lišta, mají jméno ───────────────────────────── */

describe("každá sekce má přístupné jméno", () => {
  const sectionTags = (src: string) => [...src.matchAll(/<section id="([a-z]+)"([^>]*)>/g)];

  it("žádná `<section id>` na téhle ploše nestojí bez `aria-label`", () => {
    for (const [name, src] of [
      ["RealVoteTrack", TRACK],
      ["VoteTrackPage", PAGE],
    ] as const) {
      const tags = sectionTags(src);
      expect(tags.length, name).toBeGreaterThan(0);
      for (const m of tags) {
        expect(m[2], `${name} #${m[1]}`).toMatch(/aria-label=\{t\(/);
      }
    }
  });

  it("každá kotva lišty má někde pojmenovanou sekci", () => {
    const ids = new Set([...sectionTags(TRACK), ...sectionTags(PAGE)].map((m) => m[1]));
    for (const s of PAGE_SECTIONS["/hlasovani"]) {
      expect(ids, s.id).toContain(s.id);
    }
  });
});

/* ── 07 · přístupná kopie existuje v obou katalozích ───────────────────────── */

describe("kopie přístupnostní sady je v obou jazycích", () => {
  // Chybějící klíč tu není kosmetika: `aria-label={t(…)}` nad chybějícím klíčem
  // vyrobí jméno z klíče, tedy `record.ledgerListAria` místo věty — a to je
  // horší než žádné jméno, protože vypadá jako záměr.
  const RECORD_KEYS = [
    "seismoKeyboard",
    "ledgerListAria",
    "tallyAria",
    "selectionAria",
    "matrixCaption",
    "matrixCellAria",
    "matrixNoLine",
    "chronicleListAria",
    "topRebelsListAria",
    "rateAria",
  ];
  const VOTETRACK_KEYS = ["themeListAria", "themeListEmpty"];

  it("deklaruje každou větu v cs i en", () => {
    for (const k of RECORD_KEYS) {
      expect(csRecord[k], `cs record.${k}`).toBeTruthy();
      expect(enRecord[k], `en record.${k}`).toBeTruthy();
    }
    for (const k of VOTETRACK_KEYS) {
      expect(csVote[k], `cs ${k}`).toBeTruthy();
      expect(enVote[k], `en ${k}`).toBeTruthy();
    }
  });

  it("buňka matice říká i to, co je to za číslo, ne jen linii", () => {
    // „▲ 95" bez slova je pro odečítačku jen glyfa a číslo.
    expect(csRecord.matrixCellAria).toMatch(/\{line\}/);
    expect(csRecord.matrixCellAria).toMatch(/\{pct\}/);
    expect(enRecord.matrixCellAria).toMatch(/\{line\}/);
    expect(enRecord.matrixCellAria).toMatch(/\{pct\}/);
  });

  it("poměr se čte s podmětem na obou stranách", () => {
    expect(csRecord.tallyAria).toMatch(/\{yes\}[\s\S]*\{no\}/);
    expect(enRecord.tallyAria).toMatch(/\{yes\}[\s\S]*\{no\}/);
  });
});
