import { describe, expect, it } from "vitest";
import { isCzechSafe } from "@/lib/analysis/language-gate";
import { countKinds, type DeltaEntry } from "./deriveDeltas";
import { KIND_NOUNS, kindNoun, kindTallies } from "./kindVocabulary";

const KINDS = Object.keys(KIND_NOUNS) as DeltaEntry["kind"][];

describe("slovník druhů zápisu", () => {
  it("pokrývá KAŽDÝ druh, který delta umí vydat (žádný token na čtenáře)", () => {
    // countKinds vydává druhy v KIND_ORDER; slovník musí znát všechny.
    const emitted = countKinds(
      KINDS.map((kind, i) => ({
        id: `x${i}`,
        date: "2026-08-04",
        kind,
        titleCs: "x",
        pending: false,
        timeBasis: "zaznamenano" as const,
        source: "s",
        tone: "ink" as const,
        internalHref: null,
      })),
    );
    expect(emitted.map((e) => e.kind).sort()).toEqual([...KINDS].sort());
    for (const e of emitted) expect(kindNoun(e.kind, e.count).translated).toBe(true);
  });

  it("české tvary podle počtu: 1 · 2–4 · 5+ (a nula jako 5+)", () => {
    expect(kindNoun("contract", 1).text).toBe("smlouva");
    expect(kindNoun("contract", 3).text).toBe("smlouvy");
    expect(kindNoun("contract", 5).text).toBe("smluv");
    expect(kindNoun("contract", 0).text).toBe("smluv");
  });

  it("neznámý druh se vypíše DOSLOVA a označí jako nepřeložený (nikdy se nezamlčí)", () => {
    expect(kindNoun("nejakyNovyDruh", 2)).toEqual({ text: "nejakyNovyDruh", translated: false });
    const t = kindTallies([{ kind: "nejakyNovyDruh", count: 2 }]);
    expect(t).toEqual([{ kind: "nejakyNovyDruh", count: 2, nounCs: "nejakyNovyDruh", translated: false }]);
  });

  it("nulové a záporné počty se nevydávají; pořadí vstupu se drží", () => {
    expect(
      kindTallies([
        { kind: "review", count: 2 },
        { kind: "contract", count: 0 },
        { kind: "change", count: 1 },
      ]).map((t) => t.kind),
    ).toEqual(["review", "change"]);
  });

  it("všechny tvary projdou českou jazykovou branou (copy, kterou píšeme MY)", () => {
    for (const noun of Object.values(KIND_NOUNS)) {
      for (const form of [noun.one, noun.few, noun.many]) {
        expect(isCzechSafe(form), form).toBe(true);
      }
    }
  });
});
