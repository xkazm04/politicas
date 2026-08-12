// The /penize copy catalog, pinned — the same discipline `features/civicscore/
// messages.test.ts` established. Two of the failures this file exists to catch were
// live: a banner asserting that EVERY tie was still pending (a literal the review
// console can falsify with one click), and „9. období" printed over a loader that reads
// PSP10, the tenth.
import { describe, expect, it } from "vitest";

import { looksEnglish } from "@/lib/analysis/language-gate";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

type Ns = Record<string, unknown>;

/** Flattens `money.real.stats.ownerLabel` → one dotted key per leaf string. */
function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.money as Ns);
const en = flatten(enCatalog.money as Ns);

function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

describe("money message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it("each key declares the same ICU placeholders in both locales", () => {
    for (const k of Object.keys(cs)) {
      expect(placeholders(en[k]), k).toEqual(placeholders(cs[k]));
    }
  });

  it("states the term the money loader actually reads (PSP10 = the tenth), not the ninth", () => {
    expect(cs["real.stats.mpsSub"]).toContain("10. období");
    expect(en["real.stats.mpsSub"]).toContain("10th term");
    for (const ns of [cs, en]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} still claims the 9th term`).not.toMatch(/9\. období|9th term/);
      }
    }
  });

  it("has a sentence for every review phase the data can be in", () => {
    for (const ns of [cs, en]) {
      for (const phase of ["allPending", "mixed", "allDecided"]) {
        expect(ns[`real.review.${phase}`], phase).toBeTruthy();
        expect(ns[`real.graph.${phase}`], `graph.${phase}`).toBeTruthy();
      }
      // …and it cites where the counts come from, like every other rendered figure.
      expect(ns["real.review.source"]).toBeTruthy();
    }
  });

  it("the mock graph footer no longer certifies its own sample edges", () => {
    // `graph.allEdgesVerified` used to render „● všechny hrany datované + doložené" in
    // the CONFIRMED colour, over invented edges, beside a real graph whose whole point
    // is that nothing is confirmed until a human says so.
    expect(cs["graph.allEdgesVerified"]).toBeUndefined();
    expect(cs["graph.sampleNotice"]).toContain("ukázková data");
    expect(en["graph.sampleNotice"]).toContain("sample data");
  });

  it("the ownership block declares every sentence it can render, in both catalogs", () => {
    // Jména klíčů jsou kontrakt mezi `OwnershipBlock.tsx` a katalogem: překlep tady
    // se na ploše projeví syrovým klíčem místo věty, a to zrovna v bloku, který má
    // říkat „tenhle uzel nelze ověřit v registru".
    const KEYS = [
      "title",
      "rule",
      "ownersHeading",
      "subsidiariesHeading",
      "stateOwnerCurrent",
      "stateOwnerFormer",
      "stateSubsidiaryCurrent",
      "stateSubsidiaryFormer",
      "sharePeriodPrefix",
      "shareUnknown",
      "periodOpen",
      "periodOpenNoStart",
      "periodClosed",
      "periodClosedNoStart",
      "periodUnknown",
      "roleLabel",
      "multiPeriod",
      "droppedUnresolved",
      "nameHistoryHeading",
      "verbatimNote",
      "source",
      "sourceWithPass",
      "rowSourceLabel",
      "rowSourceMissing",
      "recorded",
      "unresolvableBadge",
      "notRegistryVerified",
      "extinctionReasonLabel",
      "mergedIntoLabel",
      "mergedOnLabel",
      "successorLabel",
      "checkResultLabel",
      "checkedEndpointsLabel",
      "endpointOrdinal",
      "notAnomaly",
      "analystNoteHeading",
      "annotationSource",
      "annotationSourceDated",
    ];
    for (const k of KEYS) {
      expect(cs[`ownership.${k}`], `cs.ownership.${k}`).toBeTruthy();
      expect(en[`ownership.${k}`], `en.ownership.${k}`).toBeTruthy();
    }
  });

  it("the ownership block keeps its tenses apart and presents no inference", () => {
    for (const ns of [cs, en]) {
      // Otevřený a ukončený zápis nesmějí znít stejně: jinak stránka tvrdí dnešní
      // vlastnictví nad zápisem, který rejstřík uzavřel (u AGROFERTu jsou takové
      // všechny čtyři).
      expect(ns["ownership.stateOwnerCurrent"]).not.toEqual(ns["ownership.stateOwnerFormer"]);
      expect(ns["ownership.stateSubsidiaryCurrent"]).not.toEqual(
        ns["ownership.stateSubsidiaryFormer"],
      );
      // Blok ukazuje zapsané vlastnictví, nikdy „stopu" nebo „odhalení" —
      // dvoukrokové sousedství se v něm nepočítá a copy to nesmí naznačovat.
      for (const [k, v] of Object.entries(ns)) {
        if (!k.startsWith("ownership.")) continue;
        expect(v, `${k} reads as an exposure finding`).not.toMatch(
          /nová stopa|odhaluj|odhalen|reveals|exposure|uncovers/i,
        );
      }
    }
    // A česká věta zůstává česká (memory/reader-facing-loaders-need-the-language-gate.md).
    for (const [k, v] of Object.entries(cs)) {
      if (!k.startsWith("ownership.")) continue;
      // Bez zástupných symbolů: „{from} → {to}" je v obou katalozích totéž a
      // není na něm co překládat.
      const prose = v.replace(/\{[^}]*\}/g, " ");
      if (!/\p{L}{3}/u.test(prose)) continue;
      expect(looksEnglish(v), `cs.${k}`).toBe(false);
      expect(v, `${k} is not translated`).not.toEqual(en[k]);
    }
  });

  // Klíče, které sází OBA obrázky (reálný i označený vzorek) — jména jsou
  // kontrakt mezi MoneyGraph.tsx / MockMoneyGraph.tsx a katalogem. Překlep se
  // na ploše projeví syrovým klíčem, a to zrovna v popisku pro odečítačku,
  // který nikdo neuvidí.
  it("graf peněz deklaruje celou klávesovou a popisnou sadu v obou katalozích", () => {
    const KEYS = [
      "keyboardHint",
      "nodePosition",
      "nodeOpens",
      "openCaseFile",
      "tieFallback",
      "sampleNoCaseFiles",
      "kind.person",
      "kind.company",
      "kind.money",
      "kind.party",
    ];
    for (const k of KEYS) {
      expect(cs[`graph.${k}`], `cs.graph.${k}`).toBeTruthy();
      expect(en[`graph.${k}`], `en.graph.${k}`).toBeTruthy();
    }
    // Pozice uzlu je ICU věta o dvou měřených hodnotách, ne text s číslem.
    expect(placeholders(cs["graph.nodePosition"])).toEqual(["index", "total"]);
    expect(placeholders(en["graph.nodePosition"])).toEqual(["index", "total"]);
  });

  it("česká klávesová nápověda i názvy druhů uzlů projdou jazykovou branou", () => {
    for (const k of [
      "graph.keyboardHint",
      "graph.nodeOpens",
      "graph.openCaseFile",
      "graph.sampleNoCaseFiles",
      "graph.kind.person",
      "graph.kind.company",
      "graph.kind.money",
      "graph.kind.party",
    ]) {
      expect(looksEnglish(cs[k]), `cs.${k}`).toBe(false);
      expect(cs[k], `${k} is not translated`).not.toEqual(en[k]);
    }
  });

  it("popisek hrany bez role je katalogová věta, ne české slovo v kódu", () => {
    // Do 2026-08-12 stálo v MoneyGraph.tsx `c.role || "vazba"` — jediné české
    // slovo v obrázku, které anglický čtenář dostal nepřeložené.
    expect(cs["graph.tieFallback"]).toBe("vazba");
    expect(en["graph.tieFallback"]).toBe("tie");
  });

  it("the lower-bound explainer is reachable copy, not a dead key", () => {
    // It sat unused in both catalogs while the "nejméně" prefix rendered without it.
    expect(placeholders(cs["real.stats.reachableSubCapped"])).toEqual(["cap", "companies"]);
    expect(placeholders(en["real.stats.reachableSubCapped"])).toEqual(["cap", "companies"]);
  });
});
