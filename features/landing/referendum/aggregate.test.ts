// Referendum o metodice — agregát „jak váží Česko" (moonshot 7B):
// serializace je PRŮCHOD kodekem čočky (žádný fork), medián se počítá nad
// efektivními vahami (invariance vůči měřítku) a k-anonymitní práh je tvrdý.

import { describe, expect, it } from "vitest";

import {
  decodeWeights,
  encodeWeights,
  LENS_COMPONENT_ORDER,
  LENS_PRESETS,
  PUBLISHED_WEIGHTS,
  type WeightVector,
} from "@/features/civicscore/lens";
import { deriveWeightAggregate, K_ANONYMITY_FLOOR, serializeWeights } from "./aggregate";

const w = (v: Partial<WeightVector>): WeightVector => ({ ...PUBLISHED_WEIGHTS, ...v });

describe("serializeWeights — úložná serializace je průchod kodekem, ne fork", () => {
  it("pro každý nezveřejněný vektor se rovná encodeWeights (kodek je jeden)", () => {
    for (const p of LENS_PRESETS) {
      expect(serializeWeights(p.weights)).toBe(encodeWeights(p.weights));
    }
    const custom = w({ attendance: 45, participation: 5 });
    expect(serializeWeights(custom)).toBe(encodeWeights(custom));
  });

  it("serializuje i zveřejněnou metodiku (encodeWeights ji kóduje jako null — úložiště hlas „souhlasím“ nést musí)", () => {
    expect(encodeWeights({ ...PUBLISHED_WEIGHTS })).toBeNull();
    expect(serializeWeights(PUBLISHED_WEIGHTS)).toBe("25-20-20-15-10-10");
  });

  it("decodeWeights(serializeWeights(w)) je identita — každý uložený řádek projde kodekem", () => {
    for (const v of [PUBLISHED_WEIGHTS, ...LENS_PRESETS.map((p) => p.weights), w({ speech: 0, leadership: 100 })]) {
      expect(decodeWeights(serializeWeights(v))).toEqual(v);
    }
  });
});

describe("deriveWeightAggregate — k-anonymitní práh", () => {
  const vec = serializeWeights(LENS_PRESETS[0].weights);

  it("pod prahem vrací počet, ale ŽÁDNÝ medián", () => {
    const agg = deriveWeightAggregate(Array(K_ANONYMITY_FLOOR - 1).fill(vec));
    expect(agg.n).toBe(K_ANONYMITY_FLOOR - 1);
    expect(agg.median).toBeNull();
  });

  it("na prahu se medián zveřejní", () => {
    const agg = deriveWeightAggregate(Array(K_ANONYMITY_FLOOR).fill(vec));
    expect(agg.n).toBe(K_ANONYMITY_FLOOR);
    expect(agg.median).not.toBeNull();
  });

  it("nedekódovatelné a nulové vektory se do n NEPOČÍTAJÍ — práh nejde obejít smetím", () => {
    const junk = ["nesmysl", "1-2-3", "0-0-0-0-0-0"];
    const agg = deriveWeightAggregate([...Array(K_ANONYMITY_FLOOR - 1).fill(vec), ...junk]);
    expect(agg.n).toBe(K_ANONYMITY_FLOOR - 1);
    expect(agg.median).toBeNull();
  });
});

describe("deriveWeightAggregate — medián nad efektivními vahami", () => {
  it("je invariantní vůči měřítku: 10-10-… a 20-20-… jsou týž hlas", () => {
    const half = serializeWeights(w(Object.fromEntries(LENS_COMPONENT_ORDER.map((k) => [k, 10])) as WeightVector));
    const full = serializeWeights(w(Object.fromEntries(LENS_COMPONENT_ORDER.map((k) => [k, 20])) as WeightVector));
    const a = deriveWeightAggregate(Array(K_ANONYMITY_FLOOR).fill(half));
    const b = deriveWeightAggregate(Array(K_ANONYMITY_FLOOR).fill(full));
    expect(a.median).toEqual(b.median);
    // Rovné váhy → efektivně 16,7 na složku (100/6 na desetiny).
    for (const k of LENS_COMPONENT_ORDER) expect(a.median?.[k]).toBeCloseTo(16.7, 5);
  });

  it("počítá po složkách: sudé n průměruje prostřední dvojici", () => {
    // Polovina hlasů „vše na účast", polovina „vše na docházku".
    const onlyPart = serializeWeights(
      Object.fromEntries(LENS_COMPONENT_ORDER.map((k) => [k, k === "participation" ? 100 : 0])) as WeightVector,
    );
    const onlyAtt = serializeWeights(
      Object.fromEntries(LENS_COMPONENT_ORDER.map((k) => [k, k === "attendance" ? 100 : 0])) as WeightVector,
    );
    const agg = deriveWeightAggregate([
      ...Array(K_ANONYMITY_FLOOR / 2).fill(onlyPart),
      ...Array(K_ANONYMITY_FLOOR / 2).fill(onlyAtt),
    ]);
    expect(agg.median?.participation).toBe(50);
    expect(agg.median?.attendance).toBe(50);
    expect(agg.median?.committee).toBe(0);
    // Součet mediánů tu shodou okolností 100 dá — obecné pravidlo „nemusí"
    // ukazuje tříhlasá polarizace: žádná složka nemá nadpoloviční podporu,
    // takže každý složkový medián je 0 a součet zdaleka není 100.
    const onlyLeg = serializeWeights(
      Object.fromEntries(LENS_COMPONENT_ORDER.map((k) => [k, k === "legislative" ? 100 : 0])) as WeightVector,
    );
    const skew = deriveWeightAggregate([
      ...Array(K_ANONYMITY_FLOOR).fill(onlyPart),
      ...Array(K_ANONYMITY_FLOOR + 1).fill(onlyLeg),
      ...Array(K_ANONYMITY_FLOOR + 2).fill(onlyAtt),
    ]);
    const sum = LENS_COMPONENT_ORDER.reduce((s, k) => s + (skew.median?.[k] ?? 0), 0);
    expect(sum).not.toBe(100); // mediány po složkách nejsou rozdělení — surface to přiznává
  });
});
