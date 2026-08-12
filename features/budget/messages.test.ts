/*
 * Katalog copy /rozpocty, připíchnutý — táž kázeň, jakou zavedl
 * `features/money/messages.test.ts`. BudgetMirror ji dosud neměl, a stálo to
 * přesně to, co takový test hlídá: devět klíčů z doby MOCKU („smyšlená čísla,
 * MONITOR zatím nenapojen") přežilo napojení plochy na skutečná data MONITORu
 * a čekalo v katalogu na první `t()`, které by je vrátilo na obrazovku, plus
 * datum stažení dat („staženo 30. 7. 2026") napsané rukou v obou katalozích,
 * které by další dávka dat nechala stát na místě.
 *
 * Součástí je i kontrakt levé lišty: kotvy, které navModel pro /rozpocty
 * deklaruje, se čtou ze SKUTEČNÉHO zdroje obou komponent plochy — sekce, která
 * se přejmenuje nebo přibude, tenhle test shodí (vzor: /hlasovani ve
 * features/votetrack/messages.test.ts, kde lišta pojmenovávala sekce jinak než
 * stránka).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { isCzechSafe } from "@/lib/analysis/language-gate";
import { PAGE_SECTIONS, sectionsFor } from "@/features/shell/navModel";
import { SNAPSHOTS_RETRIEVED_ON } from "./data/budgetSnapshots.generated";
import { REGISTRY_PERIOD_LABEL, REGISTRY_RETRIEVED_ON } from "./data/registryData.generated";

type Ns = Record<string, unknown>;

function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.budget as Ns);
const en = flatten(enCatalog.budget as Ns);
const csAll = flatten(csCatalog as unknown as Ns);
const enAll = flatten(enCatalog as unknown as Ns);

/** Pojmenované proměnné ICU (`{name}` / `{name, plural, …}`) — ne slova uvnitř
 *  větví plurálu, ta se mezi jazyky legitimně liší. */
function variables(s: string): string[] {
  return [...new Set([...s.matchAll(/\{\s*(\w+)[,}]/g)].map((m) => m[1]))].sort();
}

/** Značky `t.rich` (`<strong>…</strong>` → "strong"). */
function richTags(s: string): string[] {
  return [...new Set([...s.matchAll(/<\/?([a-zA-Z][\w-]*)\s*\/?>/g)].map((m) => m[1]))].sort();
}

describe("katalog budget", () => {
  it("cs a en deklarují tytéž klíče", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it("deklaruje tytéž proměnné ICU v obou jazycích", () => {
    for (const k of Object.keys(cs)) expect(variables(en[k] ?? ""), k).toEqual(variables(cs[k]));
  });

  it("deklaruje tytéž značky t.rich v obou jazycích", () => {
    for (const k of Object.keys(cs)) expect(richTags(en[k] ?? ""), k).toEqual(richTags(cs[k]));
  });

  it("nenese prázdnou hodnotu v žádném jazyce", () => {
    for (const k of Object.keys(cs)) {
      expect(cs[k]?.trim(), k).toBeTruthy();
      expect(en[k]?.trim(), k).toBeTruthy();
    }
  });

  it("každá česká VĚTA projde jazykovou branou", () => {
    for (const [k, v] of Object.entries(cs)) {
      // Brána je klasifikátor funkčních slov: na útržku o dvou slovech
      // („dluh / obyv.", „IČO {ico}") netvrdí nic. Pouští se na věty.
      if (v.length < 40) continue;
      if (/,\s*(plural|select|selectordinal)\s*,/.test(v)) continue;
      expect(isCzechSafe(v), k).toBe(true);
    }
  });
});

describe("copy z doby mocku je pryč (plocha čte skutečný MONITOR)", () => {
  const REMOVED = [
    "backToDashboard",
    "eyebrow",
    "intro",
    "section1Title",
    "section1Aside",
    "residents",
    "townLabel",
    "section2Source",
    "section3Aside",
    "stewardshipNote",
  ];

  it("žádný z mockových klíčů v katalogu nezůstal", () => {
    // `section1Title` odešel s nimi: jeho JEDINÝ konzument byla lišta (kotva
    // §01), a ta teď ukazuje na titulek, který plocha SKUTEČNĚ vykresluje
    // (`sectionMirrorTitle`). Klíč bez konzumenta je jen čekající regrese.
    for (const k of REMOVED) {
      expect(cs[k], `cs.budget.${k}`).toBeUndefined();
      expect(en[k], `en.budget.${k}`).toBeUndefined();
    }
  });

  it("žádná česká věta netvrdí, že zdroj není napojen, ani že jsou čísla smyšlená", () => {
    for (const [k, v] of Object.entries(cs)) {
      expect(v, k).not.toMatch(/nenapojen/i);
      expect(v, k).not.toMatch(/smyšlen/i);
      expect(v, k).not.toMatch(/ilustrativní ukázka/i);
    }
  });

  it("ani anglická", () => {
    for (const [k, v] of Object.entries(en)) {
      expect(v, k).not.toMatch(/invented/i);
      expect(v, k).not.toMatch(/illustrative sample/i);
      expect(v, k).not.toMatch(/not wired yet/i);
    }
  });
});

describe("citace zdroje nese datum dávky, ne literál", () => {
  it("sourceLine interpoluje obě data a období rejstříku", () => {
    expect(variables(cs.sourceLine)).toEqual(["period", "registry", "snapshots"]);
    expect(variables(en.sourceLine)).toEqual(["period", "registry", "snapshots"]);
  });

  it("sourceLine nenese žádné ručně psané datum", () => {
    // „staženo 30. 7. 2026" tu stálo do 2026-08-12 — a nehnulo by se ani po
    // dalším stažení dat, protože o něm katalog nic neví.
    for (const v of [cs.sourceLine, en.sourceLine]) {
      expect(v).not.toMatch(/\b20\d\d\b/);
      expect(v).not.toMatch(/\b\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\b/);
    }
  });

  it("konstanty, které do věty vstupují, dávka skutečně nese", () => {
    expect(SNAPSHOTS_RETRIEVED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(REGISTRY_RETRIEVED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(REGISTRY_PERIOD_LABEL.trim()).toBeTruthy();
  });
});

describe("peněžní stopa říká, co je to za částku", () => {
  it("kvalifikátor hodnoty smlouvy existuje v obou jazycích a jmenuje registr", () => {
    expect(cs.contractValueRule).toMatch(/hodnota smlouvy/i);
    expect(cs.contractValueRule).toMatch(/registr/i);
    expect(en.contractValueRule).toMatch(/contract value/i);
  });

  it("kvalifikátor popírá obojí čtení, kterým Σ za tři dekády svádí", () => {
    // Číslo je součet hodnot smluv za roky 1995–2026: není to ani uhrazená
    // platba, ani roční tok. Obě popření musí být VYSLOVENÁ.
    expect(cs.contractValueRule).toMatch(/ne uhrazená|neuhrazen/i);
    expect(cs.contractValueRule).toMatch(/roční tok/i);
    expect(en.contractValueRule).toMatch(/not a payment made/i);
    expect(en.contractValueRule).toMatch(/annual flow/i);
  });

  it("rozsah let má tvar pro rozsah, pro jediný rok i pro chybějící datum", () => {
    expect(variables(cs.cardContractsYears)).toEqual(["firstYear", "lastYear"]);
    expect(variables(cs.cardContractsYear)).toEqual(["year"]);
    // Chybějící datum se PŘIZNÁ, nikdy nenahradí prázdnem ani nulou.
    expect(variables(cs.cardContractsYearsUnknown)).toEqual([]);
    expect(cs.cardContractsYearsUnknown).toMatch(/neuvádí/i);
    expect(en.cardContractsYearsUnknown).toMatch(/does not state/i);
  });

  it("karta ani sloupec doložených plateb už netvrdí uskutečněnou platbu", () => {
    // Hodnota je součet hodnot SMLUV, u nichž registr dokládá směr platby —
    // ne suma uhrazených peněz. Popisek „doložené platby obce" to tvrdil.
    expect(cs.cardPaid).toMatch(/smlouvy|směr/i);
    expect(cs.cardPaidMeta).toMatch(/hodnota smlouvy/i);
    expect(en.cardPaidMeta).toMatch(/contract value/i);
    expect(cs.thVolume).toMatch(/hodnota smluv/i);
    expect(en.thVolume).toMatch(/contract value/i);
  });
});

/* ── lišta „na této stránce" ───────────────────────────────────────────────── */

/** Kotvy, které plocha SKUTEČNĚ vykresluje — čte se zdroj obou komponent,
 *  neopisuje se seznam. Zrcadlo (`BudgetMirrorPage`) drží sekce 01–03,
 *  peněžní stopa (`MoneyTrailSection`) sekci 04. */
function renderedSectionIds(): string[] {
  const files = ["./BudgetMirrorPage.tsx", "./MoneyTrailSection.tsx"];
  const ids: string[] = [];
  for (const rel of files) {
    const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
    for (const m of src.matchAll(/<section\s+id="([^"]+)"/g)) ids.push(m[1]);
  }
  return ids;
}

describe("lišta /rozpocty odpovídá tomu, co plocha vykresluje", () => {
  const sections = PAGE_SECTIONS["/rozpocty"];

  it("kotvy lišty jsou přesně kotvy plochy, ve stejném pořadí", () => {
    expect(sections.map((s) => s.id)).toEqual(renderedSectionIds());
    expect(sections.map((s) => s.id)).toEqual(["zrcadlo", "dluh", "skupina", "penize"]);
  });

  it("každý popisek se přeloží v OBOU katalozích", () => {
    for (const s of sections) {
      expect(csAll[s.labelKey], s.labelKey).toBeTruthy();
      expect(enAll[s.labelKey], s.labelKey).toBeTruthy();
    }
  });

  it("popisek §01 je titulek, který plocha vykresluje", () => {
    // Do 2026-08-12 tu stál `budget.section1Title` („Město vs. vrstevníci") —
    // titulek mocku; plocha vykresluje `sectionMirrorTitle`.
    expect(sections[0].labelKey).toBe("budget.sectionMirrorTitle");
    expect(sections[3].labelKey).toBe("budget.trailTitle");
  });

  it("trvalá adresa obce nese tytéž kotvy — je to táž komponenta", () => {
    expect(sectionsFor("/rozpocty/00064581")).toEqual(sections);
    expect(sectionsFor("/rozpocty")).toEqual(sections);
    // Cizí podstránky si kotvy nedědí (kontrakt sectionsFor).
    expect(sectionsFor("/schranka")).toEqual([]);
  });
});
