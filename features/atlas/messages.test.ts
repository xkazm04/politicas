// Katalog /atlas — první messages test téhle plochy (2026-08-13).
//
// PROČ VZNIKL. /atlas je stránka, jejíž celý příslib zní „vedle každého skóre
// stojí pravidlo, které ho vyrobilo“. To pravidlo ale existuje DVAKRÁT:
//
//   · `ATLAS_RULES` v lib/analysis/atlas.ts — publikuje ho strojový
//     /atlas/atlas.json,
//   · `atlas.dimension.<d>.rule` v messages/{cs,en}.json — sází ho LIDSKÁ
//     stránka (features/atlas/AtlasCards.tsx).
//
// Do dneška je nedrželo pohromadě nic. Jediná existující kontrola
// (lib/analysis/atlas.test.ts, „každá dimenze má publikované pravidlo“)
// porovnávala `report.methodology.rules[d].rule` s `ATLAS_RULES[d].rule` —
// tedy objekt sám se sebou, tautologie. Riziko není teoretické: poslední čtyři
// commity nad touhle plochou jsou i18n kola nad katalogem, a jedno vyhlazení
// věty v `atlas.dimension.*.rule` by tiše způsobilo, že člověk čte jiné
// pravidlo, než jaké stroj publikuje. Scorecard, jehož vytištěné pravidlo se
// smí rozejít se skórem, je jediná porucha, kterou tahle stránka nepřežije.
//
// Tenhle test tu vazbu dělá: česká věta katalogu MUSÍ být po dosazení ICU
// parametrů bajtově táž jako `ATLAS_RULES[d].rule`. Směr vazby je záměrný —
// katalog zůstává tím, co se renderuje (anglický čtenář by jinak dostal české
// pravidlo), a strojová konstanta zůstává tím, co se publikuje.
//
// K tomu domovský idiom messages testů (vzor features/overeni/messages.test.ts):
// parita klíčů cs/en, parita ICU placeholderů a t.rich značek, žádná prázdná
// hodnota, jazyková brána nad českou prózou.

import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import {
  ATLAS_DIMENSIONS,
  ATLAS_RULE_PARAMS,
  ATLAS_RULES,
  COMPLETENESS_POINTS_PER_ISSUE,
  STALE_CADENCE_MULTIPLIER,
  UNSCORED_REASON_KEYS,
  UNSCORED_REASONS,
  ZERO_CADENCE_MULTIPLIER,
  type AtlasUnscorableLanding,
} from "@/lib/analysis/atlas";
import { formatInt } from "@/lib/format";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

/** Krajiny, ve kterých atlas nemá co měřit — odvozené z vlastní mapy důvodů,
 *  takže nová krajina rovnou vyžádá katalogovou větu místo tichého vynechání. */
const UNSCORABLE_LANDINGS = Object.keys(UNSCORED_REASONS) as AtlasUnscorableLanding[];

type Nested = Record<string, unknown>;

/** Ploché „a.b“ klíče celého namespace. */
function flatten(obj: Nested, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Nested, key));
  }
  return out;
}

const csNs = flatten((csCatalog as Nested).atlas as Nested);
const enNs = flatten((enCatalog as Nested).atlas as Nested);
const csKeys = Object.keys(csNs).sort();
const enKeys = Object.keys(enNs).sort();

/** `{name}` placeholdery, jako setříděná množina. */
function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

/** `<tag>…</tag>` značky pro t.rich — musí sedět, jinak next-intl spadne. */
function tags(s: string): string[] {
  return [...new Set([...s.matchAll(/<(\w+)>/g)].map((m) => m[1]))].sort();
}

/**
 * Věta bez ICU značkování — to, co čtenář uvidí, zbavené placeholderů i
 * `{n, plural, one {…}}` obalů. Jazyková brána nad ICU selhává ze své podstaty
 * (`plural`/`one`/`other` jsou anglická klíčová slova ICU, ne copy) — vzor
 * features/landing/messages.test.ts.
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

describe("katalog /atlas", () => {
  it("cs a en deklarují přesně tytéž klíče", () => {
    expect(csKeys).toEqual(enKeys);
  });

  it("každý klíč nese v obou jazycích tytéž ICU placeholdery a tytéž značky", () => {
    for (const k of csKeys) {
      expect(placeholders(enNs[k]), k).toEqual(placeholders(csNs[k]));
      expect(tags(enNs[k]), k).toEqual(tags(csNs[k]));
    }
  });

  it("žádná hodnota není prázdná", () => {
    for (const k of csKeys) {
      expect(csNs[k].trim().length, `cs.${k}`).toBeGreaterThan(0);
      expect(enNs[k].trim().length, `en.${k}`).toBeGreaterThan(0);
    }
  });
});

describe("česká copy /atlas prochází jazykovou branou", () => {
  it("žádná česká věta se nečte jako anglická", () => {
    for (const k of csKeys) {
      const text = prose(csNs[k]);
      // Krátké strojové řetězce (kickery, popisky sloupců, názvy pásem)
      // klasifikátor neumí a ani nemá — brána je na VĚTY, které píšeme my.
      if (text.trim().split(/\s+/).length < 5) continue;
      expect(looksEnglish(text), `cs.${k}`).toBe(false);
    }
  });
});

/* ── VAZBA: vytištěné pravidlo = publikované pravidlo ───────────────────────── */

/** Dosazení ICU parametrů tak, jak je sází AtlasCards — jen prosté `{jmeno}`. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}

describe("pravidlo dimenze se nesmí rozejít se skórem", () => {
  // Tahle trojice JE ta vazba. Do 2026-08-13 se `ATLAS_RULES` a katalog daly
  // změnit nezávisle a nic to nechytilo.
  it("česká katalogová věta je po dosazení parametrů bajtově táž jako ATLAS_RULES", () => {
    for (const d of ATLAS_DIMENSIONS) {
      expect(fill(csNs[`dimension.${d}.rule`], ATLAS_RULE_PARAMS), `dimension.${d}.rule`).toBe(
        ATLAS_RULES[d].rule,
      );
    }
  });

  it("český štítek dimenze je týž jako v ATLAS_RULES", () => {
    for (const d of ATLAS_DIMENSIONS) {
      expect(csNs[`dimension.${d}.label`], `dimension.${d}.label`).toBe(ATLAS_RULES[d].label);
    }
  });

  it("anglická věta je skutečná angličtina, ne propadlá čeština", () => {
    // Směr vazby (katalog renderuje, konstanta publikuje) existuje právě proto,
    // aby se anglický čtenář nedozvěděl pravidlo česky.
    for (const d of ATLAS_DIMENSIONS) {
      const en = enNs[`dimension.${d}.rule`];
      expect(en, `en.dimension.${d}.rule`).not.toBe(ATLAS_RULES[d].rule);
      expect(looksEnglish(prose(en)), `en.dimension.${d}.rule`).toBe(true);
    }
  });
});

describe("pravidlo cituje konstantu, ne přepsané číslo", () => {
  it("prahy v pravidlech jsou ICU parametry, ne literály", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns["dimension.freshness.rule"])).toEqual(["stale", "zero"]);
      expect(placeholders(ns["dimension.completeness.rule"])).toEqual(["points"]);
    }
  });

  it("ATLAS_RULE_PARAMS nese hodnoty živých konstant", () => {
    expect(ATLAS_RULE_PARAMS).toEqual({
      stale: String(STALE_CADENCE_MULTIPLIER),
      zero: String(ZERO_CADENCE_MULTIPLIER),
      points: String(COMPLETENESS_POINTS_PER_ISSUE),
    });
  });

  it("změna konstanty přeformuluje strojové pravidlo (ne jen skóre)", () => {
    expect(ATLAS_RULES.freshness.rule).toContain(`${ZERO_CADENCE_MULTIPLIER}× kadence`);
    expect(ATLAS_RULES.freshness.rule).toContain(`${STALE_CADENCE_MULTIPLIER}× kadence`);
    expect(ATLAS_RULES.completeness.rule).toContain(`100 minus ${COMPLETENESS_POINTS_PER_ISSUE} bodů`);
  });

  it("čtenář vidí totéž číslo, jaké nese strojová šablona", () => {
    // ATLAS_RULES sází `String(konstanta)` (čistý modul bez Intl — verze ICU se
    // v tomhle repu už jednou rozešla a shodila hydrataci), zatímco stránka
    // sází `formatInt(konstanta, locale)`. Pro DNEŠNÍ hodnoty se obě podoby
    // shodují; konstanta ≥ 1000 tenhle test shodí a někdo o tom musí rozhodnout.
    for (const n of [STALE_CADENCE_MULTIPLIER, ZERO_CADENCE_MULTIPLIER, COMPLETENESS_POINTS_PER_ISSUE]) {
      expect(formatInt(n, "cs"), `cs ${n}`).toBe(String(n));
      expect(formatInt(n, "en"), `en ${n}`).toBe(String(n));
    }
  });
});

/* ── Zdroje mimo dosah atlasu (2026-08-13) ──────────────────────────────────── */

describe("katalog pokrývá všechno, co registr zdrojů umí vrátit", () => {
  it("každá krajina má popisek i důvod, v obou jazycích", () => {
    for (const landing of UNSCORABLE_LANDINGS) {
      const reasonKey = UNSCORED_REASON_KEYS[landing];
      expect(csNs[reasonKey], `cs.${reasonKey}`).toBeTruthy();
      expect(enNs[reasonKey], `en.${reasonKey}`).toBeTruthy();
    }
    // Popisky skupin drží týž tvar klíče, jaký sází AtlasUnscored.
    for (const key of ["graph", "generatedModule", "none"]) {
      expect(csNs[`unscored.landing.${key}`], `cs.unscored.landing.${key}`).toBeTruthy();
      expect(enNs[`unscored.landing.${key}`], `en.unscored.landing.${key}`).toBeTruthy();
    }
  });

  it("česká věta důvodu je BAJTOVĚ táž jako UNSCORED_REASONS", () => {
    // Táž vazba jako u pravidel dimenzí: strojový report publikuje prózu,
    // stránka sází katalog, a rozejít se nesmějí.
    for (const landing of UNSCORABLE_LANDINGS) {
      expect(csNs[UNSCORED_REASON_KEYS[landing]], landing).toBe(UNSCORED_REASONS[landing]);
    }
  });

  it("důvod nikdy nezní jako „ten zdroj jsme nenasypali“ — ani jako výtka vydavateli", () => {
    // Kritérium 3 směru: nescorovatelnost je fakt o NAŠÍ rouře. „Zdroj nemá
    // řádky“ je JINÉ tvrzení a u smlouvy-gov-cz (přes 150 tisíc řádků v grafu)
    // by bylo prostě nepravdivé.
    for (const landing of UNSCORABLE_LANDINGS) {
      const cs = csNs[UNSCORED_REASON_KEYS[landing]];
      const en = enNs[UNSCORED_REASON_KEYS[landing]];
      expect(cs, landing).not.toMatch(/nemá (ve store )?žádné řádky|zdroj nemá řádk/i);
      expect(en, landing).not.toMatch(/has no rows|source has no rows/i);
    }
    // Grafová věta musí naopak výslovně přiznat, že ta data ve store JSOU.
    expect(csNs["unscored.reason.graph"]).toContain("data ve store jsou");
    expect(enNs["unscored.reason.graph"]).toContain("the data is in the store");
  });

  it("úvod sekce nese všechny tři počty jako ICU parametry, ne jako číslice", () => {
    for (const ns of [csNs, enNs]) {
      expect(placeholders(ns["unscored.lead"])).toEqual(["declared", "scored", "unscored"]);
      expect(placeholders(ns["unscored.landingNote"])).toEqual(["declared", "shown", "unscored"]);
      // Žádný počet zdrojů se nesmí vysázet natvrdo — registr je jediný zdroj čísla.
      expect(ns["unscored.lead"]).not.toMatch(/\b(3|9|12)\b/);
      expect(ns["unscored.landingNote"]).not.toMatch(/\b(3|9|12)\b/);
    }
  });

  it("sekce přiznává, proč se atlas nerozšiřuje, místo aby to vydávala za hotové", () => {
    // Ruling směru: mez se pojmenuje, netlačí se přes vytištěné pravidlo integrity.
    expect(csNs["unscored.scopeNote"]).toMatch(/integrit/i);
    expect(enNs["unscored.scopeNote"]).toMatch(/integrity/i);
  });
});
