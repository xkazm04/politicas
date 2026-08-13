/*
 * DAŇOVÁ ZÁKLADNA — pravidla, která se dají porušit potichu.
 *
 * Registr smluv publikuje hodnotu smlouvy ve dvou základnách a jako sčitatelné
 * je neuvádí (`lib/ingest/sources/smlouvy-dump.ts` to říká ve své hlavičce);
 * sklizeň je do jednoho pole složí, ale ZAPÍŠE kterou. Co se tu hlídá:
 *
 *  1. NIC SE NEPŘEPOČÍTÁVÁ. Sazbu DPH graf nenese, takže jediná legální operace
 *     je PŘIZNAT složení — testy proto porovnávají korunové součty PŘED a PO
 *     zavedení základny a čekají shodu do posledního bitu.
 *  2. NEZNÁMÁ ZÁKLADNA NENÍ ANI JEDNA ZE STRAN. `none`, `unrecorded` ani cizí
 *     měna nesmí nafouknout ani jednu polovinu tvrzení o sčitatelnosti.
 *  3. „REGISTR MLČEL" ≠ „MY JSME SE NEZEPTALI". `none` a `unrecorded` se
 *     nesměšují v datech; ve větě se spojují vědomě a jen v ní.
 */

import { describe, expect, it } from "vitest";

import {
  AMOUNT_BASES,
  BASIS_COPY_KEYS,
  BASIS_TAG_KEYS,
  basisComposition,
  basisSentences,
  emptyBasisComposition,
  emptyBasisCounts,
  foldBasis,
  mergeBasisCounts,
  readAmountBasis,
  type AmountBasis,
} from "./amountBasis";

describe("readAmountBasis — doslovné čtení hrany, žádné hádání", () => {
  it.each(AMOUNT_BASES.filter((b) => b !== "unrecorded"))("přečte zapsanou hodnotu %s", (b) => {
    expect(readAmountBasis({ amountBasis: b })).toBe(b);
  });

  it("hrana bez pole je `unrecorded` — ne `none`: to jsou dvě různá tvrzení", () => {
    expect(readAmountBasis({})).toBe("unrecorded");
    expect(readAmountBasis({ direction: "recipient" })).toBe("unrecorded");
    expect(readAmountBasis(null)).toBe("unrecorded");
    expect(readAmountBasis(undefined)).toBe("unrecorded");
    // …zatímco explicitní „registr hodnotu nezveřejnil" se zachová.
    expect(readAmountBasis({ amountBasis: "none" })).toBe("none");
  });

  it("token, který tenhle build neumí pojmenovat, NESPADNE k žádné ze stran", () => {
    for (const junk of ["hodnotaBezDph", "VCETNEDPH", "", "0", 42, true, {}]) {
      expect(readAmountBasis({ amountBasis: junk })).toBe("unrecorded");
    }
  });
});

describe("basisComposition — čtyři stavy součtu a žádný pátý", () => {
  it("samé bez DPH: jedna základna, nemíchá se", () => {
    const c = foldBasis(["bezDph", "bezDph", "bezDph"]);
    expect(c).toMatchObject({ bezDph: 3, vcetneDph: 0, counted: 3, sole: "bezDph", mixed: false });
    expect(c.outsideVatSplit).toBe(0);
    expect(basisSentences(c)).toEqual([{ key: "allBezDph", count: 3 }]);
  });

  it("samé včetně DPH: jedna základna, nemíchá se", () => {
    const c = foldBasis(["vcetneDph", "vcetneDph"]);
    expect(c).toMatchObject({ vcetneDph: 2, bezDph: 0, counted: 2, sole: "vcetneDph", mixed: false });
    expect(basisSentences(c)).toEqual([{ key: "allVcetneDph", count: 2 }]);
  });

  it("MÍCHANÝ součet se přizná i s počty na obou stranách", () => {
    const c = foldBasis(["bezDph", "vcetneDph", "bezDph"]);
    expect(c.mixed).toBe(true);
    expect(c.sole).toBeNull(); // dvě základny → žádná jediná
    expect(basisSentences(c)).toEqual([{ key: "mixed", bez: 2, vcetne: 1 }]);
  });

  it("smlouva bez zapsané základny se hlásí ZVLÁŠŤ, nikdy k jedné ze stran", () => {
    const c = foldBasis(["bezDph", "none", "unrecorded", "ciziMena"]);
    expect(c.bezDph).toBe(1);
    expect(c.vcetneDph).toBe(0);
    expect(c.mixed).toBe(false);
    // Ani `none`, ani `unrecorded`, ani cizí měna nezvedly žádnou DPH stranu.
    expect(c.outsideVatSplit).toBe(3);
    expect(basisSentences(c)).toEqual([
      { key: "allBezDph", count: 1 },
      { key: "foreignCurrency", count: 1 },
      { key: "unstated", count: 2 }, // none + unrecorded, spojené AŽ ve větě
    ]);
  });

  it("součet bez jediné DPH strany dostane vlastní větu, ne mlčení", () => {
    const c = foldBasis(["none", "unrecorded"]);
    expect(basisSentences(c)[0]).toEqual({ key: "noVatBasis", count: 2 });
  });

  it("prázdný součet nevykreslí NIC — věta o prázdnu je šum", () => {
    expect(emptyBasisComposition().counted).toBe(0);
    expect(basisSentences(emptyBasisComposition())).toEqual([]);
  });

  it("mergeBasisCounts sčítá po složkách a nemutuje vstupy", () => {
    const a = { ...emptyBasisCounts(), bezDph: 2 };
    const b = { ...emptyBasisCounts(), vcetneDph: 3, none: 1 };
    const m = mergeBasisCounts(a, b);
    expect(m).toEqual({ vcetneDph: 3, bezDph: 2, ciziMena: 0, none: 1, unrecorded: 0 });
    expect(a.bezDph).toBe(2);
    expect(b.vcetneDph).toBe(3);
    expect(basisComposition(m).mixed).toBe(true);
  });
});

describe("copy — modul vydává KLÍČE, ne české věty", () => {
  it("každá základna má svůj popisek a všechny jsou různé", () => {
    const keys = AMOUNT_BASES.map((b) => BASIS_TAG_KEYS[b]);
    expect(new Set(keys).size).toBe(AMOUNT_BASES.length);
  });

  it("BASIS_COPY_KEYS obsahuje každý klíč, který `basisSentences` umí vydat", () => {
    const emitted = new Set<string>();
    // Každá kombinace přítomnosti pěti složek — vyčerpá všechny větve.
    for (let mask = 1; mask < 32; mask++) {
      const bases: AmountBasis[] = [];
      AMOUNT_BASES.forEach((b, i) => {
        if (mask & (1 << i)) bases.push(b);
      });
      for (const s of basisSentences(foldBasis(bases))) emitted.add(s.key);
    }
    expect(emitted.size).toBeGreaterThan(0);
    for (const k of emitted) expect(BASIS_COPY_KEYS).toContain(k);
  });
});

/* ── NEPŘESUNUTÁ KORUNA ────────────────────────────────────────────────────
 *
 * Nejdůležitější test v souboru. Zavedení základny smělo přidat POČTY ŘÁDKŮ a
 * nic jiného: kdyby se cestou pohnul `czk`, `count` nebo `amounts`, publikované
 * částky o jmenovaných lidech by se změnily kvůli změně, která měla jen popisovat.
 * Referenční hodnoty jsou spočítané NEZÁVISLE, ne převzaté z outputu.
 */
describe("součty se nepohnuly ani o haléř", () => {
  /** Přesně ten fold, který v loaderu běžel PŘED touhle změnou. */
  function legacyFold(edges: Array<{ src: string; weight: number }>) {
    const by = new Map<string, { count: number; czk: number; amounts: number[] }>();
    for (const e of edges) {
      const cur = by.get(e.src) ?? { count: 0, czk: 0, amounts: [] };
      cur.count += 1;
      cur.czk += e.weight;
      if (e.weight > 0) cur.amounts.push(e.weight);
      by.set(e.src, cur);
    }
    return by;
  }

  const EDGES = [
    { src: "c:1", weight: 1_234_567.89, props: { amountBasis: "bezDph" } },
    { src: "c:1", weight: 0.1, props: { amountBasis: "vcetneDph" } },
    { src: "c:1", weight: 0.2, props: { amountBasis: "bezDph" } },
    { src: "c:1", weight: 0, props: { amountBasis: "ciziMena" } },
    { src: "c:1", weight: 0, props: {} },
    { src: "c:2", weight: 99_999_999_999.99, props: { amountBasis: "none" } },
  ];

  it("fold se základnou dá TÝŽ czk/count/amounts jako fold bez ní", () => {
    const legacy = legacyFold(EDGES);
    // Tentýž fold, jen s přičítáním řádků podle základny (co dělá moneyLoader).
    const withBasis = new Map<string, { count: number; czk: number; amounts: number[] }>();
    const counts = new Map<string, ReturnType<typeof emptyBasisCounts>>();
    for (const e of EDGES) {
      const cur = withBasis.get(e.src) ?? { count: 0, czk: 0, amounts: [] };
      const cb = counts.get(e.src) ?? emptyBasisCounts();
      cur.count += 1;
      cur.czk += e.weight;
      if (e.weight > 0) cur.amounts.push(e.weight);
      cb[readAmountBasis(e.props)] += 1;
      withBasis.set(e.src, cur);
      counts.set(e.src, cb);
    }

    for (const [id, want] of legacy) {
      const got = withBasis.get(id)!;
      // `Object.is` chytí i −0 vs 0 a NaN; `toBe` na číslech je Object.is.
      expect(got.czk).toBe(want.czk);
      expect(got.count).toBe(want.count);
      expect(got.amounts).toEqual(want.amounts);
    }
    // …a přitom se složení opravdu spočetlo (jinak by test nic nedokazoval).
    expect(basisComposition(counts.get("c:1")!)).toMatchObject({
      bezDph: 2,
      vcetneDph: 1,
      ciziMena: 1,
      unrecorded: 1,
      mixed: true,
      counted: 5,
    });
    expect(basisComposition(counts.get("c:2")!)).toMatchObject({ none: 1, sole: "none", mixed: false });
  });

  it("plovoucí desetinná čárka: pořadí sčítání se nezměnilo", () => {
    // 0.1 + 0.2 !== 0.3 — kdyby změna přeuspořádala sčítání, tenhle součet by
    // se pohnul. Je to ta nejlevnější detekce přeskládaného foldu, jakou máme.
    const czk = EDGES.filter((e) => e.src === "c:1").reduce((n, e) => n + e.weight, 0);
    expect(legacyFold(EDGES).get("c:1")!.czk).toBe(czk);
  });
});
