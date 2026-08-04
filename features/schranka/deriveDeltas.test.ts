import { describe, expect, it } from "vitest";
import type { DenikEntry } from "@/features/denik/deriveDenik";
import type { EvidenceEntry } from "@/features/dukazy/deriveFeed";
import { CONTRIBUTION_FORMULA_REF } from "@/lib/analysis/contribution";
import { recomputeDelta, recomputeFactFromProps, type RecomputeFact } from "./recomputeFact";
import {
  daysBefore,
  dayOf,
  deriveDeltas,
  deriveEntityDelta,
  forensicToDelta,
  sinceDay,
  totalNews,
} from "./deriveDeltas";

/** Záznam deníku pro fixturu — jen pole, na kterých delta stojí. */
function entry(over: Partial<DenikEntry> & { id: string; date: string; keys: string[] }): DenikEntry {
  const { keys, ...rest } = over;
  return {
    kind: "contract",
    titleCs: `zápis ${over.id}`,
    pending: false,
    timeBasis: "ucinne",
    source: "registr smluv — smlouvy.gov.cz",
    tone: "signal",
    entities: keys.map((key) => ({ key, label: `popisek ${key}`, href: null })),
    internalHref: null,
    ...rest,
  };
}

const ENTRIES: DenikEntry[] = [
  entry({ id: "contract:a", date: "2026-07-30", keys: ["firma:04544152", "poslanec:1"] }),
  entry({ id: "review:b", date: "2026-07-28", kind: "review", timeBasis: "zaznamenano", keys: ["poslanec:1"] }),
  entry({ id: "assigned:141:x", date: "2026-07-25", kind: "billAssigned", keys: ["tisk:141"] }),
  entry({ id: "contract:old", date: "2026-06-01", keys: ["firma:04544152"] }),
];

const FORENSIC: EvidenceEntry = {
  id: "tisk-99",
  anchor: "z-tisk-99",
  kind: "forensic",
  decision: "forensic-verified",
  decisionCs: "forenzní posudek potvrzen",
  decidedAt: "2026-07-29T08:00:00Z",
  subjectCs: "novela zákona X",
  reviewer: "posudek podepsán",
  priorState: "pending_review",
  links: [],
  internalHref: "/zakony/141",
  sourceCs: "zdroj: kg_node bill.forensic_* · závažnost high",
};

describe("kalendářní pomocníci", () => {
  it("dayOf bere den z instantu, nevalidní → null", () => {
    expect(dayOf("2026-07-31T10:00:00.000Z")).toBe("2026-07-31");
    expect(dayOf(null)).toBeNull();
    expect(dayOf("kdysi")).toBeNull();
  });

  it("daysBefore počítá UTC, přes hranici měsíce", () => {
    expect(daysBefore("2026-08-02", 3)).toBe("2026-07-30");
    expect(daysBefore("2026-03-01", 1)).toBe("2026-02-28");
  });

  it("sinceDay: den poslední návštěvy; bez razítka okno první návštěvy (7 dnů včetně dneška)", () => {
    expect(sinceDay("2026-07-28T23:59:00Z", "2026-07-31")).toBe("2026-07-28");
    expect(sinceDay(null, "2026-07-31")).toBe("2026-07-25");
  });
});

describe("deriveEntityDelta — filtr entity a prahu", () => {
  it("bere jen záznamy entity se dnem >= since (den návštěvy se počítá celý znovu)", () => {
    const d = deriveEntityDelta({ entries: ENTRIES, key: "firma:04544152", since: "2026-07-30" });
    expect(d.entries.map((e) => e.id)).toEqual(["contract:a"]);
    expect(d.total).toBe(1);
    expect(d.latestDate).toBe("2026-07-30");
    // Popisek ze záznamů, href na spis firmy (od 2026-08-04), deník entity vede na filtr.
    expect(d.label).toBe("popisek firma:04544152");
    expect(d.href).toBe("/penize/firma/04544152");
    expect(d.denikHref).toBe("/denik?entita=firma%3A04544152");
  });

  it("hraniční den: záznam PŘESNĚ v since se počítá, den před ne", () => {
    const at = deriveEntityDelta({ entries: ENTRIES, key: "poslanec:1", since: "2026-07-28" });
    expect(at.entries.map((e) => e.id)).toEqual(["contract:a", "review:b"]);
    const after = deriveEntityDelta({ entries: ENTRIES, key: "poslanec:1", since: "2026-07-29" });
    expect(after.entries.map((e) => e.id)).toEqual(["contract:a"]);
  });

  it("entita beze změny: total 0, latestDate null — a nevalidní since nic nepustí", () => {
    const none = deriveEntityDelta({ entries: ENTRIES, key: "tisk:141", since: "2026-07-26" });
    expect(none.total).toBe(0);
    expect(none.latestDate).toBeNull();
    const broken = deriveEntityDelta({ entries: ENTRIES, key: "poslanec:1", since: "kdysi" });
    expect(broken.total).toBe(0);
  });

  it("cap řeže řádky, ale total a latestDate mluví o celku", () => {
    const d = deriveEntityDelta({ entries: ENTRIES, key: "poslanec:1", since: "2026-01-01", cap: 1 });
    expect(d.entries).toHaveLength(1);
    expect(d.total).toBe(2);
  });
});

describe("forenzní posudky (deník důkazů) → delta tisku", () => {
  it("verified posudek se mapuje na klíč tisku, den = den rozhodnutí", () => {
    const mapped = forensicToDelta(FORENSIC);
    expect(mapped).not.toBeNull();
    expect(mapped!.key).toBe("tisk:141");
    expect(mapped!.delta.date).toBe("2026-07-29");
    expect(mapped!.delta.timeBasis).toBe("zaznamenano");
    expect(mapped!.delta.source).toContain("kg_node bill.forensic_*");
  });

  it("ne-forenzní záznam a posudek bez adresy tisku se nemapují", () => {
    expect(forensicToDelta({ ...FORENSIC, kind: "tie" })).toBeNull();
    expect(forensicToDelta({ ...FORENSIC, internalHref: null })).toBeNull();
  });

  it("posudek vstupuje do delty svého tisku vedle záznamů deníku", () => {
    const d = deriveEntityDelta({
      entries: ENTRIES,
      forensic: [FORENSIC],
      key: "tisk:141",
      since: "2026-07-25",
    });
    expect(d.entries.map((e) => e.id)).toEqual(["forensic:tisk-99", "assigned:141:x"]);
  });
});

describe("deriveDeltas — determinismus a řazení", () => {
  const KEYS = ["tisk:141", "poslanec:1", "firma:04544152", "obec:00241717"];

  it("novinky napřed (nejčerstvější den, pak klíč), beze změny na konci; nevalidní klíče ven", () => {
    const deltas = deriveDeltas({ entries: ENTRIES, keys: [...KEYS, "nesmysl"], since: "2026-07-26" });
    expect(deltas.map((d) => d.key)).toEqual([
      "firma:04544152", // 2026-07-30; týž den jako poslanec:1 → klíč vzestupně
      "poslanec:1", // 2026-07-30
      "obec:00241717", // beze změny → na konec, klíč vzestupně
      "tisk:141", // beze změny (assigned je z 25. 7., práh 26. 7.)
    ]);
    expect(totalNews(deltas)).toBe(3);
  });

  it("vstup v libovolném pořadí → byte-identický výstup", () => {
    const a = deriveDeltas({ entries: ENTRIES, keys: KEYS, since: "2026-07-26" });
    const b = deriveDeltas({
      entries: [...ENTRIES].reverse(),
      keys: [...KEYS].reverse(),
      since: "2026-07-26",
    });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("duplicitní klíč se počítá jednou", () => {
    const deltas = deriveDeltas({ entries: ENTRIES, keys: ["poslanec:1", "poslanec:1"], since: "2026-01-01" });
    expect(deltas).toHaveLength(1);
  });
});

// ── vlna 2: souhrn druhů + přepočet indexu ─────────────────────────────────

describe("countKinds — souhrn druhů zápisu", () => {
  it("počítá druhy PŘED seříznutím a řadí je pořadím KIND_ORDER", () => {
    const d = deriveEntityDelta({ entries: ENTRIES, key: "poslanec:1", since: "2026-01-01", cap: 1 });
    expect(d.entries).toHaveLength(1);
    // cap = 1, ale souhrn mluví o obou řádcích delty.
    expect(d.kinds).toEqual([
      { kind: "contract", count: 1 },
      { kind: "review", count: 1 },
    ]);
  });

  it("entita beze změny nese prázdný souhrn (žádné nuly)", () => {
    const d = deriveEntityDelta({ entries: ENTRIES, key: "tisk:141", since: "2026-07-26" });
    expect(d.kinds).toEqual([]);
  });
});

describe("přepočet indexu jako delta", () => {
  const FACT: RecomputeFact = {
    computedAt: "2026-07-29",
    pass: 42,
    ref: "contribution-committee-dedupe",
    covered: 207,
  };

  it("řádek dostane jen POSLANEC, s číslem průchodu, refem a odkazem na metodiku", () => {
    const d = deriveEntityDelta({
      entries: ENTRIES,
      recompute: FACT,
      key: "poslanec:1",
      since: "2026-07-28",
    });
    const row = d.entries.find((e) => e.kind === "recompute");
    expect(row).toBeDefined();
    expect(row!.id).toBe("recompute:42:poslanec:1");
    expect(row!.date).toBe("2026-07-29");
    expect(row!.internalHref).toBe("/metodika");
    expect(row!.source).toBe("výpočet politicas — contribution-committee-dedupe");
    expect(row!.titleCs).toContain("průchod 42");
    expect(row!.timeBasis).toBe("zaznamenano");
  });

  it("NIKDY netvrdí velikost změny skóre — graf předchozí hodnoty nedrží", () => {
    const row = recomputeDelta(FACT, "poslanec:1", "2026-01-01")!;
    expect(row.titleCs).toMatch(/o kolik se skóre pohnulo, záznam neříká/);
    // Žádné číslo kromě průchodu: v titulku nesmí být bodová změna.
    expect(row.titleCs.match(/\d+/g)).toEqual(["42"]);
  });

  it("firma ani tisk řádek o přepočtu nedostanou", () => {
    for (const key of ["firma:04544152", "tisk:141", "obec:00241717"]) {
      expect(recomputeDelta(FACT, key, "2026-01-01")).toBeNull();
    }
  });

  it("přepočet mimo okno čtenáře se nehlásí; přesně na prahu ano", () => {
    expect(recomputeDelta(FACT, "poslanec:1", "2026-07-30")).toBeNull();
    expect(recomputeDelta(FACT, "poslanec:1", "2026-07-29")).not.toBeNull();
    expect(recomputeDelta(null, "poslanec:1", "2026-01-01")).toBeNull();
  });

  it("počítá se do total i do souhrnu druhů (odznak ho tedy vidí)", () => {
    const deltas = deriveDeltas({
      entries: ENTRIES,
      recompute: FACT,
      keys: ["poslanec:1"],
      since: "2026-07-28",
    });
    expect(totalNews(deltas)).toBe(3); // contract + review + recompute
    expect(deltas[0].kinds).toEqual([
      { kind: "contract", count: 1 },
      { kind: "review", count: 1 },
      { kind: "recompute", count: 1 },
    ]);
  });

  it("determinismus se přepočtem nemění", () => {
    const a = deriveDeltas({ entries: ENTRIES, recompute: FACT, keys: ["poslanec:1", "tisk:141"], since: "2026-07-01" });
    const b = deriveDeltas({
      entries: [...ENTRIES].reverse(),
      recompute: FACT,
      keys: ["tisk:141", "poslanec:1"],
      since: "2026-07-01",
    });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe("recomputeFactFromProps — jednotnost, nebo nic", () => {
  const props = (over: Record<string, unknown> = {}) => ({
    contribution_provenance: {
      pass: 42,
      ref: CONTRIBUTION_FORMULA_REF,
      computedAt: "2026-08-04T09:00:00.000Z",
      ...over,
    },
  });

  it("jednotná sněmovna → fakt s dnem, průchodem, refem a pokrytím", () => {
    const fact = recomputeFactFromProps([props(), props(), props()]);
    expect(fact).toEqual({
      computedAt: "2026-08-04",
      pass: 42,
      ref: CONTRIBUTION_FORMULA_REF,
      covered: 3,
    });
  });

  it("půl sněmovny na jiném průchodu → null (nehlásí se nic)", () => {
    expect(recomputeFactFromProps([props(), props({ pass: 11, ref: "contribution" })])).toBeNull();
  });

  it("dva různé dny jednoho průchodu → null", () => {
    expect(
      recomputeFactFromProps([props(), props({ computedAt: "2026-08-05T09:00:00.000Z" })]),
    ).toBeNull();
  });

  it("uzel bez computedAt sráží pokrytí → null (datum by pro část sněmovny neplatilo)", () => {
    expect(recomputeFactFromProps([props(), { contribution_provenance: { pass: 42, ref: CONTRIBUTION_FORMULA_REF } }])).toBeNull();
  });

  it("graf bez provenance → null", () => {
    expect(recomputeFactFromProps([{}, {}])).toBeNull();
  });
});
