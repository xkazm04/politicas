// Katalog TITULNÍ STRANY — první messages test téhle plochy (2026-08-12).
//
// Proč vznikl: fasáda je jediná stránka, kterou většina čtenářů uvidí, a přesto
// byla jediná bez připnutého katalogu. Dvě věty ji tím přežily o měsíce déle,
// než měly:
//
//   · `methodBody` slibovala „verzované váhy" a „citaci u každého PILÍŘE" —
//     čtyřpilířový model je smazaný (dole na téže stránce se vykresluje šest
//     složek indexu přispění) a číslo verze metodiky bylo přiznanou fikcí už
//     v SiteFooter.tsx („v1.4" byla fikce ukázky);
//   · `meta.rootDescription` — popis, který se lepí do každého sdílení a do
//     výsledků vyhledávání — sliboval „index efektivity pro každého českého
//     politika", ačkoli produkt počítá INDEX PŘISPĚNÍ nad 207 poslanci
//     10. období. Přesně tuhle třídu tvrzení opravil f9f4cf8 u
//     `meta.civicscoreDescription`; tenhle test drží, aby se nevrátila.
//
// Testuje se KATALOG, ne komponenta: obě věty jsou data a jejich chyba je
// chybou obsahu, ne renderu.

import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import { LENS_PRESET_COPY_KEYS } from "@/features/civicscore/lens";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

/** Katalog fasády nese i vnořený `nav` objekt — sjednotíme na ploché klíče. */
function flatten(ns: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    if (typeof v === "string") out[`${prefix}${k}`] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, `${prefix}${k}.`));
  }
  return out;
}

const csNs = flatten(csCatalog.landing);
const enNs = flatten(enCatalog.landing);
const csKeys = Object.keys(csNs).sort();
const enKeys = Object.keys(enNs).sort();

/** `{name}` / `{count}` placeholdery, které řetězec deklaruje, jako setříděná množina. */
function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

/**
 * Věta bez ICU značkování — to, co čtenář uvidí, zbavené `{n, plural, one {…}}`.
 *
 * Jazyková brána nad ICU pluralem selhává ze své podstaty: `plural`, `one`,
 * `few`, `other` jsou anglická klíčová slova ICU, ne copy, a klasifikátor
 * `looksEnglish` je počítá jako anglická slova (týž důvod, proč /zebricek
 * vyjímá ICU značkování a citační klíče). Odstraňují se proto obě vrstvy:
 * nejdřív placeholdery, pak obaly, které po nich zbudou.
 */
function prose(s: string): string {
  let out = s;
  for (let i = 0; i < 5; i++) {
    const next = out.replace(/\{[^{}]*\}/g, " ");
    if (next === out) break;
    out = next;
  }
  return out.replace(/\b(plural|select|selectordinal|zero|one|two|few|many|other)\b/g, " ");
}

describe("landing message catalog", () => {
  it("cs a en deklarují přesně tytéž klíče", () => {
    expect(csKeys).toEqual(enKeys);
  });

  it("každý klíč deklaruje v obou jazycích tytéž ICU placeholdery", () => {
    for (const k of csKeys) {
      expect(placeholders(enNs[k]), k).toEqual(placeholders(csNs[k]));
    }
  });

  it("žádná hodnota není prázdná", () => {
    for (const k of csKeys) {
      expect(csNs[k].trim(), `cs.${k}`).not.toBe("");
      expect(enNs[k].trim(), `en.${k}`).not.toBe("");
    }
  });
});

describe("landing — metoda mluví o šesti složkách, ne o pilířích a verzích", () => {
  it("methodBody nezmiňuje pilíř — ten model je smazaný", () => {
    expect(csNs.methodBody).not.toMatch(/pilíř|pilíre|pilířů/i);
    expect(enNs.methodBody).not.toMatch(/pillar/i);
  });

  it("methodBody neslibuje verzování vah — vzorec nese otisk, ne číslo verze", () => {
    expect(csNs.methodBody).not.toMatch(/verzovan/i);
    expect(enNs.methodBody).not.toMatch(/versioned/i);
  });

  it("methodBody pojmenuje šest zveřejněných složek, které se pod ním vykreslují", () => {
    expect(csNs.methodBody).toMatch(/šest/i);
    expect(enNs.methodBody).toMatch(/six/i);
  });

  it("žádný klíč fasády necituje neexistující verzi metodiky", () => {
    for (const ns of [csNs, enNs]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} cituje verzi metodiky, která neexistuje`).not.toMatch(/v1\.\d/);
      }
    }
  });
});

// Táž třída tvrzení jako `meta.rootDescription` níž, jen o patro výš: `lead` je
// PRVNÍ věta produktu (HeroStory) a slibovala „každou korunu veřejných peněz"
// a „skóre pro každého politika". Loadery měří 207 poslanců 10. období a smlouvy
// firem, které vlastní nebo řídí — ne rozpočet státu a ne všechny politiky.
describe("landing.lead — slibuje jen to, co loadery měří", () => {
  it("netvrdí, že pokrývá každou korunu veřejných peněz", () => {
    expect(csNs.lead).not.toMatch(/každ(á|ou) korun/i);
    expect(enNs.lead).not.toMatch(/every crown|every koruna/i);
  });

  it("netvrdí, že skóruje každého politika — index stojí nad poslanci sněmovny", () => {
    expect(csNs.lead).not.toMatch(/každého politika|všechny politiky/i);
    expect(enNs.lead).not.toMatch(/(each|every) politician/i);
  });

  it("pojmenuje index přispění a období, které loader skutečně čte", () => {
    expect(csNs.lead).toMatch(/index[uů]? přispění/i);
    expect(csNs.lead).toMatch(/10\. období/);
    expect(csNs.lead).not.toMatch(/9\. období/);
    expect(enNs.lead).toMatch(/contribution index/i);
    expect(enNs.lead).toMatch(/10th term/);
    expect(enNs.lead).not.toMatch(/9th term/);
  });
});

describe("meta.rootDescription — index přispění nad 207 poslanci, ne „index efektivity“", () => {
  const cs: string = csCatalog.meta.rootDescription;
  const en: string = enCatalog.meta.rootDescription;

  it("nemluví o indexu efektivity — produkt počítá index přispění", () => {
    expect(cs).not.toMatch(/efektivit/i);
    expect(en).not.toMatch(/effectiveness/i);
  });

  it("pojmenuje index přispění a jeho skutečné pokrytí (207 poslanců)", () => {
    expect(cs).toMatch(/index[uů]? přispění/i);
    expect(cs).toContain("207");
    expect(en).toMatch(/contribution index/i);
    expect(en).toContain("207");
  });

  it("uvádí období, které loader skutečně čte (PSP10 = desáté)", () => {
    expect(cs).toMatch(/10\. volebního období/);
    expect(en).toMatch(/10th parliamentary term/);
    expect(cs).not.toMatch(/9\. období|9\. volebního období/);
    expect(en).not.toMatch(/9th term|9th parliamentary term/);
  });
});

// Stav zdrojů je čtenáři obrácená věta o KVALITĚ DAT — přesně ta třída kopie,
// která už třikrát dojela na plochu anglicky
// (memory/reader-facing-loaders-need-the-language-gate.md).
describe("landing — rubrika Surový materiál je česky a přiznává nehodnocené", () => {
  const KEYS = [
    "sourcesSource",
    "sourcesUnavailable",
    "sourcesUnavailableBody",
    "sourcesUnavailableSource",
    "sourceCoverageUnrated",
    "sourceCompositeUnrated",
    "stalenessUnrated",
    "specimenNoClaim",
  ];

  it("každý klíč existuje v obou katalozích", () => {
    for (const k of KEYS) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
    }
  });

  it("česká věta neprojde jako anglická (jazyková brána)", () => {
    for (const k of KEYS) expect(looksEnglish(csNs[k]), `cs.${k}`).toBe(false);
  });

  // Tyhle klíče se skládají za běhu ze STROJOVÝCH tokenů atlasu
  // (`čerstvé`/`stárnoucí`/`zastaralé`, `hodnoceno`/`částečné`/`nehodnoceno`),
  // takže je žádný grep přes `t("…")` nenajde — chybějící klíč by se projevil
  // až na vykreslené fasádě. Proto se existence pojistí tady.
  it("mapované strojové tokeny atlasu mají v obou katalozích svůj překlad", () => {
    const MAPPED = [
      "stalenessFresh",
      "stalenessAging",
      "stalenessStale",
      "sourceStatusRated",
      "sourceStatusPartial",
      "sourceStatusUnrated",
    ];
    for (const k of MAPPED) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
    }
  });

  it("citace rubriky pojmenuje všechny čtyři dimenze i pravidlo o nehodnoceném", () => {
    for (const dim of ["pokrytí", "čerstvost", "integrita", "úplnost"]) {
      expect(csNs.sourcesSource.toLowerCase()).toContain(dim);
    }
    expect(csNs.sourcesSource).toMatch(/nikdy 0|nikdy nula/);
    expect(csNs.sourcesSource).toContain("/atlas");
    expect(enNs.sourcesSource).toContain("/atlas");
  });

  it("titulek rubriky už netvrdí, že jsou zdroje ověřené — tvrdí, že jsou změřené", () => {
    expect(csNs.sourcesCaption).not.toMatch(/ověřen/i);
    expect(enNs.sourcesCaption).not.toMatch(/verified/i);
  });
});

/* ── fasáda mluví oběma jazyky HNED ────────────────────────────────────────
 * Dvě rubriky titulní strany vznikly s poznámkou „copy česky přímo zde
 * (messages/*.json mimo plochu)". Ta dočasná výjimka přežila obě dávky, kvůli
 * kterým vznikla, takže anglický čtenář dostal na PRVNÍ stránce produktu
 * pětatřicet českých vět — včetně `aria-label`ů, které mu nikdo nepřečte
 * jinak. Jména klíčů jsou kontrakt mezi komponentou a katalogem: překlep se
 * projeví syrovým klíčem uprostřed rubriky. */
describe("landing.denik — rubrika deníku mluví z katalogu", () => {
  const KEYS = [
    "regionLabel",
    "eyebrowToday",
    "eyebrowLatest",
    "title",
    "readLink",
    "loading",
    "unavailable",
    "empty",
    "dayLine",
    "feedCapNote",
    "moreInDenik",
    "source",
  ].map((k) => `denik.${k}`);

  it("každý klíč existuje v obou katalozích a je přeložený", () => {
    for (const k of KEYS) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
      expect(csNs[k], `${k} neni prelozeny`).not.toEqual(enNs[k]);
    }
  });

  it("česká věta rubriky projde jazykovou branou", () => {
    for (const k of KEYS) expect(looksEnglish(csNs[k]), `cs.${k}`).toBe(false);
  });

  it("nedostupné, prázdné a načítá se jsou TŘI různé věty", () => {
    for (const ns of [csNs, enNs]) {
      const said = new Set([ns["denik.unavailable"], ns["denik.empty"], ns["denik.loading"]]);
      expect(said.size).toBe(3);
    }
  });

  it("čísla dne i strop feedu jsou argumenty, ne vysázené hodnoty", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns["denik.dayLine"])).toEqual(["countFmt", "date"]);
      expect(placeholders(ns["denik.feedCapNote"])).toEqual(["capFmt"]);
    }
  });

  it("citace pojmenuje všechny čtyři vrstvy deníku, ne tři", () => {
    for (const token of ["registr smluv", "ares", "psp.cz", "change_event", "review_audit"]) {
      expect(csNs["denik.source"].toLowerCase(), token).toContain(token);
    }
    // A ukazuje na to, co se ČTE: rubrika už nesahá na /denik/feed.json.
    expect(csNs["denik.source"]).not.toContain("/denik/feed.json");
    expect(enNs["denik.source"]).not.toContain("/denik/feed.json");
  });
});

describe("landing.referendum — rubrika čoček mluví z katalogu", () => {
  const KEYS = [
    "regionLabel",
    "eyebrow",
    "title",
    "weightsSource",
    "leadWeights",
    "leadReweighCount",
    "leadReweighNoCount",
    "leadPresets",
    "openLens",
    "presetsSource",
    "cta",
  ].map((k) => `referendum.${k}`);

  const SHORT = [
    "participation",
    "committee",
    "legislative",
    "speech",
    "attendance",
    "leadership",
  ].map((k) => `referendum.short.${k}`);

  it("každý klíč existuje v obou katalozích a je přeložený", () => {
    for (const k of [...KEYS, ...SHORT]) {
      expect(csNs[k], `cs.${k}`).toBeTruthy();
      expect(enNs[k], `en.${k}`).toBeTruthy();
      expect(csNs[k], `${k} neni prelozeny`).not.toEqual(enNs[k]);
    }
  });

  it("česká věta rubriky projde jazykovou branou", () => {
    for (const k of KEYS) expect(looksEnglish(prose(csNs[k])), `cs.${k}`).toBe(false);
  });

  it("pokrytí se tvrdí jen tam, kde je známé — a jinak vůbec", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns["referendum.leadReweighCount"])).toEqual(["count"]);
      expect(placeholders(ns["referendum.leadReweighNoCount"])).toEqual([]);
    }
  });

  it("počet redakčních ukázek je ICU plural nad délkou pole, ne přepsané slovo", () => {
    // „Tři redakční ukázky" byl literál nad `LENS_PRESETS`, které si svou délku
    // nese samo — čtvrtá čočka by z věty udělala lež.
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns["referendum.leadPresets"])).toEqual(["n", "nFmt"]);
      expect(ns["referendum.leadPresets"]).toMatch(/\{n, plural,/);
    }
    expect(csNs["referendum.leadPresets"]).not.toMatch(/\bTři\b/);
    expect(enNs["referendum.leadPresets"]).not.toMatch(/\bThree\b/);
  });

  it("zveřejněný vektor vah zůstává argumentem, ne přepsaným číslem", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns["referendum.weightsSource"])).toEqual(["weights"]);
      expect(ns["referendum.weightsSource"]).not.toMatch(/\d+-\d+-\d+/);
    }
  });
});

/* Čočky bydlí v `civicscore.lensPreset.*`, protože je to metodika žebříčku, ne
 * rubrika fasády — ale vykresluje je fasáda i panel vah, takže se pin drží tady
 * u toho, kdo je čte první. Seznam klíčů se BERE Z MODULU (LENS_PRESET_COPY_KEYS),
 * takže nová čočka bez copy neprojde, aniž by na test kdokoli sáhl. */
describe("civicscore.lensPreset — čočky vydávají klíče, ne české věty", () => {
  const cs = flatten(csCatalog.civicscore);
  const en = flatten(enCatalog.civicscore);

  it("každý klíč, který lens.ts umí vydat, katalog nese v obou jazycích", () => {
    expect(LENS_PRESET_COPY_KEYS.length).toBe(6);
    for (const k of LENS_PRESET_COPY_KEYS) {
      expect(cs[k], `cs.${k}`).toBeTruthy();
      expect(en[k], `en.${k}`).toBeTruthy();
      expect(cs[k], `${k} neni prelozeny`).not.toEqual(en[k]);
    }
  });

  it("česká copy čoček projde jazykovou branou", () => {
    for (const k of LENS_PRESET_COPY_KEYS) expect(looksEnglish(cs[k]), `cs.${k}`).toBe(false);
  });
});

/* ── dvě falzifikovatelná tvrzení fasády ──────────────────────────────────── */
describe("landing — fasáda netvrdí víc, než čím graf a repozitář disponují", () => {
  // Repozitář je starý dvacet dní. „Postaveno a otestováno celý volební cyklus
  // předtím, než na tom bude záležet" je vymyšlená minulost — a to na stránce,
  // jejíž nadpis zní „Žádná černá skříňka".
  const TRACK_RECORD =
    /otestován\w*\s+celý\s+volebn|celý volební cyklus|léty prověřen|osvědčil\s+se|tested\s+(over|through|for)?\s*(a|an|the)?\s*(full|entire|whole)\s*(election\s+)?cycle|battle[- ]tested|proven\s+over\s+(years|cycles)/i;

  it("žádný klíč fasády neslibuje odzkoušení přes celý volební cyklus", () => {
    expect(csNs.methodBody, "cs.methodBody tvrdi proverenou minulost").not.toMatch(TRACK_RECORD);
    expect(enNs.methodBody, "en.methodBody claims a tested track record").not.toMatch(TRACK_RECORD);
    for (const ns of [csNs, enNs]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} tvrdi proverenou minulost`).not.toMatch(TRACK_RECORD);
      }
    }
  });

  it("pravidlo je falzifikovatelné — na retirované větě opravdu chytne", () => {
    expect(
      "Postaveno a otestováno celý volební cyklus předtím, než na tom bude záležet.",
    ).toMatch(TRACK_RECORD);
    expect("Built and tested a full election cycle before it matters.").toMatch(TRACK_RECORD);
  });

  it("methodBody dál pojmenuje šest složek a zůstane bez pilířů a verzí", () => {
    expect(csNs.methodBody).toMatch(/šest/i);
    expect(enNs.methodBody).toMatch(/six/i);
    expect(csNs.methodBody).not.toMatch(/pilíř|verzovan/i);
    expect(enNs.methodBody).not.toMatch(/pillar|versioned/i);
  });

  it("joinKeyDesc tvrdí jen ty spoje, které graf na IČO skutečně drží", () => {
    // Graf spojuje přes IČO firmu s jejími SMLOUVAMI (hrany `supplies`); dotace
    // a dary jsou SOUČTY na uzlu firmy (`subsidies_total_czk`,
    // `donated_to_party_czk` — kg-money.ts, Hlídač ⋈ ARES), ne jednotlivé
    // záznamy, na které by šlo prokliknout. Věta slibovala čtyři rovnocenné
    // spoje („firmu ↔ smlouvu ↔ dotaci ↔ dar").
    expect(csNs.joinKeyDesc).not.toMatch(/↔\s*dotaci\s*↔/);
    expect(enNs.joinKeyDesc).not.toMatch(/↔\s*subsidy\s*↔/);
    expect(csNs.joinKeyDesc).toMatch(/součet|souhrn/i);
    expect(enNs.joinKeyDesc).toMatch(/total/i);
  });

  it("popis modulu peněz mluví o dotacích stejně jako klíčová věta vedle", () => {
    const cs: string = flatten(csCatalog.content)["modules.follow-the-money.description"];
    const en: string = flatten(enCatalog.content)["modules.follow-the-money.description"];
    expect(cs).toMatch(/součet|souhrn/i);
    expect(en).toMatch(/total/i);
    expect(cs).not.toMatch(/zakázky a dotace dohledané/);
    expect(en).not.toMatch(/contracts and subsidies traced/);
  });

  it("mrtvý klíč `feeds` je pryč z obou katalogů", () => {
    // Deset řetězců bez jediného volajícího; `dataReleases.feeds.*` je jiná,
    // živá věc a zůstává.
    const cs = flatten(csCatalog.content);
    const en = flatten(enCatalog.content);
    for (const m of ["civic-score", "vote-track", "follow-the-money", "budget-mirror", "law-watch"]) {
      expect(cs[`modules.${m}.feeds`], `cs.modules.${m}.feeds`).toBeUndefined();
      expect(en[`modules.${m}.feeds`], `en.modules.${m}.feeds`).toBeUndefined();
      // …a to, co se vykresluje, zůstalo.
      expect(cs[`modules.${m}.tag`], `cs.modules.${m}.tag`).toBeTruthy();
      expect(cs[`modules.${m}.description`], `cs.modules.${m}.description`).toBeTruthy();
    }
    expect(flatten(csCatalog.dataReleases)["feeds.title"], "dataReleases.feeds is live").toBeTruthy();
  });
});
