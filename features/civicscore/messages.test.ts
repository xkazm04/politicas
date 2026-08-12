// The /zebricek copy catalog must stay complete in BOTH locales. Czech-first means the
// Czech string is the source of truth — but a key that exists only in cs.json renders
// its own key name to an English reader, and a key that exists only in en.json is dead
// weight nobody notices. Five such dead keys (distributionSource, allSource, mockNote,
// componentLegendNote, legendWidthNote) survived in both catalogs with ZERO call sites
// until 2026-08-04, one of them still claiming the chamber was in its 9th term.
import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import { LOW_SCORE_COPY_KEYS } from "@/lib/analysis/low-score-reason";
import { RAPPORTEUR_COPY_KEYS } from "@/lib/analysis/rapporteur-load";
import { TENURE_COPY_KEYS } from "@/lib/analysis/tenure-copy";
import { WORKHORSE_COPY_KEYS } from "@/lib/analysis/workhorse-flavour";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

const csNs: Record<string, string> = csCatalog.civicscore;
const enNs: Record<string, string> = enCatalog.civicscore;
const csKeys = Object.keys(csNs).sort();
const enKeys = Object.keys(enNs).sort();

/** `{name}` / `{count}` placeholders a string declares, as a sorted set. */
function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

describe("civicscore message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(csKeys).toEqual(enKeys);
  });

  it("each key declares the same ICU placeholders in both locales", () => {
    for (const k of csKeys) {
      expect(placeholders(enNs[k]), k).toEqual(placeholders(csNs[k]));
    }
  });

  it("states the term the loader actually reads (PSP10 = the tenth), not the ninth", () => {
    expect(csNs.lead).toContain("10. období");
    expect(enNs.lead).toContain("10th term");
    for (const ns of [csNs, enNs]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} still claims the 9th term`).not.toMatch(/9\. období|9th term/);
      }
    }
  });

  it("cites no methodology version — the real six-component index carries none", () => {
    for (const ns of [csNs, enNs]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} cites a methodology version that does not exist`).not.toMatch(/v1\.\d/);
      }
    }
  });
});

// ── Padělatelné literály (2026-08-12) ───────────────────────────────────────
// Žebříček tvrdil dvě čísla, která v katalogu STÁLA NAPSANÁ, a obě jsou
// vyvratitelná bez jediné změny kódu:
//
//  · „207" v šesti klíčích (lead, allTitle, shownOf, histogramFootnote,
//    realNote a dvou meta popiscích) — velikost sněmovny je MĚŘENÝ údaj
//    (`summary.count`, `entries.length`), který stránka celou dobu držela
//    v ruce; jeden doplňovací mandát z něj udělá lež na pěti místech naráz.
//  · „211 vazeb" ve `factsNoMoney` — počet peněžních vazeb v grafu, navíc
//    s tvrzením, že VŠECHNY čekají na lidskou kontrolu. Konzole
//    /penize/kontrola umí od e8bf6c8 zapsat rozhodnutí, takže tuhle větu
//    vyvrátí první kliknutí recenzenta.
//
// Připínají se OBĚ třídy zvlášť: číslo (níž) i TVAR absolutního tvrzení
// o bráně (precedens features/profile/messages.test.ts — tam regex nejdřív
// vyžadoval číslici a přesně tudy propadlo tvrzení bez čísla).
describe("civicscore — katalog netvrdí čísla, která nese měření", () => {
  it("žádná hodnota v civicscore.* nenese literál 207 (velikost sněmovny)", () => {
    for (const [locale, ns] of [["cs", csNs], ["en", enNs]] as const) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${locale}.civicscore.${k} hardcodes the chamber size`).not.toMatch(/\b207\b/);
      }
    }
  });

  it("žádná hodnota v civicscore.* nenese literál 211 (počet peněžních vazeb)", () => {
    for (const [locale, ns] of [["cs", csNs], ["en", enNs]] as const) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${locale}.civicscore.${k} hardcodes the money-tie count`).not.toMatch(/\b211\b/);
      }
    }
  });

  // Zákaz číslice sám o sobě nestačí: klíč, který o počtu MLUVÍ, musí mít kam
  // měřenou hodnotu dosadit. Bez tohohle by šlo číslo „opravit" jeho smazáním
  // a věta by tiše přestala počet uvádět.
  it("klíče o počtu poslanců nesou ICU parametr, ne smazané číslo", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns.lead)).toContain("count");
      expect(placeholders(ns.realNote)).toContain("count");
      expect(placeholders(ns.histogramFootnote)).toContain("count");
      expect(placeholders(ns.weightPanelLead)).toContain("count");
      expect(placeholders(ns.shownOf).sort()).toEqual(["count", "total"]);
    }
  });

  // Titulek sekce jde do LIŠTY (`features/shell/navModel.ts` →
  // PAGE_SECTIONS["/zebricek"], labelKey „civicscore.allTitle"), a ta ho
  // překládá BEZ parametrů. Počet se do něj proto dosadit nedá a nesmí v něm
  // ani stát napsaný — patří do citace vedle, ne do nadpisu.
  it("titulek žebříčku je bez parametru — lišta ho překládá bez nich", () => {
    for (const ns of [csNs, enNs]) expect(placeholders(ns.allTitle)).toEqual([]);
  });

  // Histogramová pásma se počítají z živého minima a maxima (getLeaderboardData
  // → `histogram`), takže citace nesmí ukazovat jedno konkrétní pásmo jako
  // příklad — „65–70" v ní stálo i pro sněmovnu, která takové pásmo nemá.
  it("citace histogramu neuvádí konkrétní pásmo jako příklad", () => {
    for (const [locale, ns] of [["cs", csNs], ["en", enNs]] as const) {
      expect(ns.histogramSource, `${locale}.civicscore.histogramSource cites a hardcoded band`).not.toMatch(
        /\d{2}\s*[–-]\s*\d{2}/,
      );
    }
  });
});

describe("civicscore — souboj nevydává stav lidské brány za hotovou věc", () => {
  // Týž tvarový test jako features/profile/messages.test.ts:41. Absolutní
  // kvantifikátor + vazby + slovo o kontrole = tvrzení, které jedno rozhodnutí
  // v konzoli vyvrátí — s číslem i bez něj.
  const absoluteReviewClaim = (v: string): boolean => {
    const s = v.toLowerCase();
    const absolute = /\b(všechn\w*|všech|vešker\w*|all|every|none of)\b/.test(s);
    const ties = /(vazb\w*|vazeb|hran\w*|\bties\b|\bedges\b)/.test(s);
    const review = /(kontrol\w*|čeká\w*|čekaj\w*|bran\w*|pending|review\w*|await\w*|gate)/.test(s);
    return absolute && ties && review;
  };

  // ŽÁDNÝ VYJÍMKOVÝ SEZNAM: na rozdíl od /poslanec a /penize tahle plocha
  // peněžní vrstvu vůbec nečte (`getLeaderboardData` nemá jediné čtení
  // `linked_to`), takže tu není odvození, které by absolutní větu SMĚLO
  // vybrat. Kdyby jednou bylo, patří do seznamu i s odkazem na to odvození.
  it("žádná věta žebříčku netvrdí absolutní stav lidské brány", () => {
    for (const [locale, ns] of [["cs", csNs], ["en", enNs]] as const) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${locale}.civicscore.${k} counts the whole tie corpus`).not.toMatch(
          /(všechny|všech) \d+ vazeb|all \d+ ties/i,
        );
        expect(
          absoluteReviewClaim(v),
          `${locale}.civicscore.${k} states an absolute about the human gate`,
        ).toBe(false);
      }
    }
  });

  it("věta o penězích v souboji pořád existuje a je česky", () => {
    expect(csNs.factsNoMoney, "cs.factsNoMoney").toBeTruthy();
    expect(enNs.factsNoMoney, "en.factsNoMoney").toBeTruthy();
    expect(looksEnglish(csNs.factsNoMoney), "cs.factsNoMoney").toBe(false);
  });
});

// Provenience skóre je čtenáři obrácená věta o tom, ČÍM byla čísla spočítána — a
// přesně tahle třída kopie už třikrát dojela na plochu anglicky
// (memory/reader-facing-loaders-need-the-language-gate.md). Proto je připnutá k bráně,
// ne svěřená úsudku.
describe("civicscore — provenience skóre je česky a nese obě linie", () => {
  const KEYS = ["provenanceNote", "provenanceMismatch", "provenanceMixed", "provenanceAbsent"];

  it("každý klíč existuje v obou katalozích", () => {
    for (const k of KEYS) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
    }
  });

  it("česká věta neprojde jako anglická (jazyková brána)", () => {
    for (const k of KEYS) expect(looksEnglish(csNs[k]), `cs.${k}`).toBe(false);
  });

  it("věta o rozporu pojmenuje uloženou I deklarovanou linii — nikdy jen jednu", () => {
    expect(placeholders(csNs.provenanceMismatch)).toEqual(["codeRef", "dataRef"]);
  });

  it("věta o smíšeném grafu přiznává počet verzí i pokrytí, ne jedno číslo pasu", () => {
    expect(placeholders(csNs.provenanceMixed)).toEqual(["count", "total", "withProv"]);
  });
});

// Volební karta kraje (/kraj/[kraj]) se TISKNE, a od 2026-08-11 nese tytéž
// poctivé věty jako žebříček: korektiv nízkého skóre, datované verdikty a
// citovatelné skóre. Věta, která vysvětluje ZADRŽENOU citaci pod čtenářovou
// čočkou, je jediná nová kopie — a stojí na papíře, kde ji nikdo neopraví.
describe("civicscore — kandidátka kraje vysvětluje zadrženou citaci", () => {
  it("věta existuje v obou katalozích", () => {
    expect(csNs.krajLensNoClaim, "cs.krajLensNoClaim").toBeTruthy();
    expect(enNs.krajLensNoClaim, "en.krajLensNoClaim").toBeTruthy();
  });

  it("česká věta neprojde jako anglická (jazyková brána)", () => {
    expect(looksEnglish(csNs.krajLensNoClaim), "cs.krajLensNoClaim").toBe(false);
  });

  it("nenese žádný ICU parametr — je to pravidlo, ne měřený údaj", () => {
    expect(placeholders(csNs.krajLensNoClaim)).toEqual([]);
  });
});

// /metodika je stránka, jejíž jediný obsah je TVRZENÍ O VZORCI. Kdyby se rozešla
// s katalogem druhého jazyka nebo dojela na plochu anglicky, byla by to přesně ta
// třída chyby, kterou má zavírat (metodická průhlednost, která sama sobě nesedí).
describe("metodika — katalog stránky metodiky", () => {
  const csM: Record<string, string> = csCatalog.metodika;
  const enM: Record<string, string> = enCatalog.metodika;

  it("existuje v obou katalozích se stejnými klíči", () => {
    expect(Object.keys(csM).sort()).toEqual(Object.keys(enM).sort());
    expect(Object.keys(csM).length).toBeGreaterThan(0);
  });

  it("každý klíč deklaruje tytéž ICU placeholdery v obou jazycích", () => {
    for (const k of Object.keys(csM)) {
      expect(placeholders(enM[k]), k).toEqual(placeholders(csM[k]));
    }
  });

  it("česká věta neprojde jako anglická (jazyková brána)", () => {
    for (const [k, v] of Object.entries(csM)) {
      expect(v.length, k).toBeGreaterThan(0);
      expect(looksEnglish(v), `cs.metodika.${k}`).toBe(false);
    }
  });

  it("věta o rozporu pojmenuje uloženou I deklarovanou linii", () => {
    expect(placeholders(csM.storeMismatch)).toEqual(["codeRef", "dataRef"]);
  });

  it("věta o smíšeném grafu přiznává počet verzí i pokrytí", () => {
    expect(placeholders(csM.storeMixed)).toEqual(["count", "covered", "total"]);
  });

  it("součet vah je PLACEHOLDER, ne napsané číslo — stránka ho čte ze vzorce", () => {
    for (const ns of [csM, enM]) {
      expect(placeholders(ns.weightsSource)).toEqual(["total"]);
      expect(ns.weightsSource).not.toMatch(/\b100\b/);
    }
  });
});

// Vektor zveřejněných vah je odvozený (lens.PUBLISHED_WEIGHTS_LABEL), ne psaný. Do
// 2026-08-04 stál jako literál na čtyřech vykreslovaných místech a v OBOU katalozích,
// takže by ho změna vzorce nechala tvrdit staré číslo.
describe("katalogy netisknou zveřejněné váhy jako literál", () => {
  it("žádný řetězec v cs ani en nenese '25-20-20-15-10-10'", () => {
    for (const [locale, cat] of [["cs", csCatalog], ["en", enCatalog]] as const) {
      const flat = JSON.stringify(cat);
      expect(flat, `${locale}.json hardcodes the published weight vector`).not.toContain(
        "25-20-20-15-10-10",
      );
    }
  });
});

// ── Verdiktní slovník (`verdicts`) ──────────────────────────────────────────
// Čtyři čisté moduly v lib/analysis držely svoje věty jako ČESKÉ LITERÁLY, i když
// produkt má skutečnou anglickou lokalizaci (přepínač v cookie, lib/i18n/config.ts).
// Anglický čtenář tak dostával verdikt česky — a u `WorkhorseBadge` dokonce jednu
// větu ve dvou jazycích naráz, protože se česká věta lepila na PŘELOŽENÝ dovětek
// („Vysoký podíl vlastní … na řečništi. Floor speeches: 12.").
//
// Moduly teď vracejí KLÍČ (precedens /overeni: `verdictHeadlineKey`,
// `gateStatusInfo().labelKey`) a každý publikuje uzavřený seznam klíčů, které umí
// vydat. Tenhle blok drží OBA katalogy k těm seznamům — a jazyková brána, kterou
// si moduly nesly nad vlastními literály, se přesunula sem, nad znění, které se
// doopravdy vykreslí.
describe("verdicts — verdiktní slovník mluví oběma jazyky", () => {
  const csV: Record<string, string> = csCatalog.verdicts;
  const enV: Record<string, string> = enCatalog.verdicts;
  /** Každý klíč, který některý z těch čtyř modulů může vydat. */
  const EMITTED = [
    ...LOW_SCORE_COPY_KEYS,
    ...WORKHORSE_COPY_KEYS,
    ...RAPPORTEUR_COPY_KEYS,
    ...TENURE_COPY_KEYS,
  ];

  it("cs a en deklarují tytéž klíče", () => {
    expect(Object.keys(csV).sort()).toEqual(Object.keys(enV).sort());
  });

  it("každý klíč, který modul umí vydat, v OBOU katalozích existuje a není prázdný", () => {
    for (const k of EMITTED) {
      expect(csV[k], `cs.verdicts.${k}`).toBeTruthy();
      expect(enV[k], `en.verdicts.${k}`).toBeTruthy();
    }
  });

  it("jmenný prostor nenese klíč, který nikdo nevydává (mrtvá kopie)", () => {
    // Pět mrtvých vět v trendCopy.ts přežilo přesun copy do katalogů o týden a
    // vypadalo jako pravda o ploše, kterou už nepopisovalo. Tady se to stát nemůže:
    // seznamy klíčů jsou odvozené ze slovníků samotných.
    expect(Object.keys(csV).sort()).toEqual([...EMITTED].sort());
  });

  it("každý klíč deklaruje tytéž ICU parametry v obou jazycích", () => {
    for (const k of Object.keys(csV)) {
      expect(placeholders(enV[k]), k).toEqual(placeholders(csV[k]));
    }
  });

  it("věta zpravodaje nese počet, o který se opírá — v obou jazycích", () => {
    for (const ns of [csV, enV]) expect(placeholders(ns.rapporteurDetail)).toEqual(["load"]);
    // Ostatní verdikty žádný parametr nemají: čtou uzavřený slovník, ne měření.
    for (const k of [...LOW_SCORE_COPY_KEYS, ...WORKHORSE_COPY_KEYS]) {
      expect(placeholders(csV[k]), k).toEqual([]);
    }
  });

  it("mandátová poznámka má tři větve a každá jmenuje data, která opravdu má", () => {
    for (const ns of [csV, enV]) {
      expect(placeholders(ns.mandateNoteReplacement)).toEqual(["start"]);
      expect(placeholders(ns.mandateNoteDeparted).sort()).toEqual(["end", "start"]);
      // Větev bez data zániku o něm nesmí mít ani prázdné místo — jinak by
      // vykreslila „zanikl " a čtenář by hledal datum, které zdroj nemá.
      expect(placeholders(ns.mandateNoteDepartedNoEnd)).toEqual(["start"]);
    }
  });

  it("žádná česká věta neprojde jako anglická (jazyková brána)", () => {
    for (const [k, v] of Object.entries(csV)) {
      expect(looksEnglish(v), `cs.verdicts.${k}: ${v.slice(0, 60)}`).toBe(false);
    }
  });

  it("žádný klíč nezůstal nepřeložený (en ≠ cs)", () => {
    for (const k of Object.keys(csV)) {
      expect(enV[k], `en.verdicts.${k} is still the Czech string`).not.toBe(csV[k]);
    }
  });

  // Migrace SMÍ přesunout větu, nesmí ji přepsat. Tohle je vzorek českých znění
  // zkopírovaných z lib/analysis PŘED přesunem — kdyby se cestou „vylepšila",
  // padne to tady, ne až u čtenáře.
  it("české znění je totožné s tím, co moduly vykreslovaly před přesunem", () => {
    expect(csV.lowScoreDeclinedMandateBadge).toBe("Mandátu se vzdal(a)");
    expect(csV.lowScoreDeclinedMandateDetail).toBe(
      "Nulová nebo nízká aktivita není absence — mandát byl odmítnut nebo se ho MP vzdal(a) před složením slibu či brzy po něm.",
    );
    expect(csV.lowScoreGenuineAbsenteeDetail).toBe(
      "Enrichment nenašel strukturální vysvětlení nízké aktivity — na rozdíl od ostatních důvodů toto NENÍ korektiv skóre.",
    );
    expect(csV.workhorseLegislativeBadge).toBe("Tichý tvůrce zákonů");
    expect(csV.workhorseOversightDetail).toBe(
      "Práce spočívá v dozoru a výborové agendě (vedení výborů, delegace, komise) bez vlastní legislativní iniciativy a bez vystoupení v sále.",
    );
    expect(csV.rapporteurBadge).toBe("Zpravodajský tahoun");
    expect(csV.tenureNeverSeatedDetail).toBe(
      "Mandátu se vzdal(a) nebo ho nepřevzal(a) — ve Sněmovně nepracoval(a), takže čísla níže nejsou výkon, ale prázdný záznam.",
    );
    expect(csV.mandateNoteReplacement).toBe("Mandát vznikl {start} (nastoupil/a jako náhradník/nice).");
  });

  // Dvě věty nesou VÝROK, který se překladem snadno ztratí: `genuine_absentee` je
  // jediný důvod, který NENÍ korektivem skóre, a počet zpravodajských tisků říká
  // rozsah role, ne kvalitu. Obojí musí stát v obou jazycích.
  it("obě jazykové verze si nechávají výhrady, kvůli kterým ty věty existují", () => {
    expect(csV.lowScoreGenuineAbsenteeDetail).toMatch(/NENÍ korektiv/);
    expect(enV.lowScoreGenuineAbsenteeDetail).toMatch(/NOT a correction/);
    expect(csV.rapporteurDetail).toMatch(/ne kvalitu/);
    expect(enV.rapporteurDetail).toMatch(/not its quality/i);
  });
});

// Panel vývoje (`civicscore.trend*`) byl do 2026-08-05 psán inline v JSX, pak žil
// jako pět českých builderů v trendCopy.ts BEZ jediného volajícího — a jazyková
// brána běžela nad těmi mrtvými větami, ne nad katalogem, který se vykresluje.
// Buildery jsou smazané (2026-08-12); brána je tady, nad živým zněním.
describe("civicscore — copy panelu vývoje je česky", () => {
  const trendKeys = Object.keys(csNs).filter((k) => k.startsWith("trend"));

  it("panel vůbec nějaké klíče má (jinak by tenhle test mlčel navždy)", () => {
    expect(trendKeys.length).toBeGreaterThan(3);
  });

  it("žádná věta panelu neprojde jako anglická", () => {
    for (const k of trendKeys) {
      expect(csNs[k], `cs.civicscore.${k}`).toBeTruthy();
      expect(looksEnglish(csNs[k]), `cs.civicscore.${k}`).toBe(false);
    }
  });
});
