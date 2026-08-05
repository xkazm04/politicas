import { describe, expect, it } from "vitest";
import { countKinds, type DeltaEntry } from "./deriveDeltas";
import { KIND_NOUN_KEYS, kindNounKey, kindTallies } from "./kindVocabulary";

const KINDS = Object.keys(KIND_NOUN_KEYS) as DeltaEntry["kind"][];

describe("slovník druhů zápisu (klíče katalogu)", () => {
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
    for (const e of emitted) expect(kindNounKey(e.kind).translated).toBe(true);
  });

  it("známý druh vrací klíč do `schranka.kinds.*` — copy vlastní katalog", () => {
    expect(kindNounKey("contract")).toEqual({ key: "kinds.contract", token: "contract", translated: true });
    expect(kindNounKey("recompute")).toEqual({ key: "kinds.recompute", token: "recompute", translated: true });
    // Každý klíč míří do jmenného prostoru kinds.* a nese jméno druhu.
    for (const [kind, key] of Object.entries(KIND_NOUN_KEYS)) {
      expect(key).toBe(`kinds.${kind}`);
    }
  });

  it("neznámý druh se vypíše DOSLOVA a označí jako nepřeložený (nikdy se nezamlčí)", () => {
    expect(kindNounKey("nejakyNovyDruh")).toEqual({
      key: null,
      token: "nejakyNovyDruh",
      translated: false,
    });
    const t = kindTallies([{ kind: "nejakyNovyDruh", count: 2 }]);
    expect(t).toEqual([{ kind: "nejakyNovyDruh", count: 2, nounKey: null, translated: false }]);
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

  it("kindTallies nese klíč katalogu i počet — plocha sází t(nounKey, {count})", () => {
    expect(kindTallies([{ kind: "contract", count: 3 }])).toEqual([
      { kind: "contract", count: 3, nounKey: "kinds.contract", translated: true },
    ]);
  });
});
