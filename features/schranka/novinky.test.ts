import { describe, expect, it } from "vitest";
import { parseNovinkyResponse } from "./novinky";
import { countKinds, type DeltaEntry } from "./deriveDeltas";
import { KIND_NOUN_KEYS } from "./kindVocabulary";

const entry = (over: Record<string, unknown> = {}) => ({
  id: "c-1",
  date: "2026-08-04",
  kind: "contract",
  titleCs: "smlouva",
  pending: false,
  timeBasis: "ucinne",
  source: "registr smluv — smlouvy.gov.cz",
  tone: "signal",
  internalHref: null,
  ...over,
});

const response = (deltas: unknown[]) => ({
  v: 1,
  builtOn: "2026-08-04",
  since: "2026-08-01",
  coverage: { money: true, law: true, reviews: true, changes: true, dukazy: true, recompute: true },
  deltas,
});

const delta = (entries: unknown[]) => ({
  key: "poslanec:1",
  label: "Jan Novák",
  href: "/poslanec/1",
  denikHref: "/denik?entita=poslanec%3A1",
  total: entries.length,
  latestDate: "2026-08-04",
  entries,
});

describe("parseNovinkyResponse — obálka", () => {
  it("odmítá cizí tvar celé odpovědi", () => {
    expect(parseNovinkyResponse(null)).toBeNull();
    expect(parseNovinkyResponse(42)).toBeNull();
    expect(parseNovinkyResponse({ ...response([]), v: 2 })).toBeNull();
    expect(parseNovinkyResponse({ ...response([]), deltas: "ne" })).toBeNull();
    expect(parseNovinkyResponse({ ...response([]), coverage: null })).toBeNull();
  });

  it("zdravou odpověď propustí beze ztráty", () => {
    const parsed = parseNovinkyResponse(response([delta([entry()])]));
    expect(parsed?.deltas).toHaveLength(1);
    expect(parsed?.deltas[0].entries).toHaveLength(1);
    expect(parsed?.droppedEntries).toBe(0);
    expect(parsed?.droppedDeltas).toBe(0);
  });

  it("částka projde jen jako konečné číslo", () => {
    expect(parseNovinkyResponse(response([delta([entry({ czk: 1_000 })])]))?.deltas[0].entries[0].czk)
      .toBe(1_000);
    expect(parseNovinkyResponse(response([delta([entry({ czk: "hodně" })])]))?.droppedEntries).toBe(1);
  });
});

describe("parseNovinkyResponse — vadné řádky se zahodí a POČÍTAJÍ", () => {
  it("neznámý tón by se v renderu ztratil jako prázdná tečka — nezahodí se mlčky", () => {
    const parsed = parseNovinkyResponse(response([delta([entry(), entry({ id: "c-2", tone: "duha" })])]));
    expect(parsed?.deltas[0].entries.map((e) => e.id)).toEqual(["c-1"]);
    expect(parsed?.droppedEntries).toBe(1);
  });

  it("zahodí i neznámý druh, čas a nedatovaný řádek", () => {
    const parsed = parseNovinkyResponse(
      response([
        delta([
          entry({ id: "a", kind: "vymysl" }),
          entry({ id: "b", timeBasis: "kdysi" }),
          entry({ id: "c", date: "4. srpna" }),
          entry({ id: "d", pending: "ano" }),
          entry({ id: "e", internalHref: 5 }),
          null,
        ]),
      ]),
    );
    expect(parsed?.deltas[0].entries).toHaveLength(0);
    expect(parsed?.droppedEntries).toBe(6);
    // `total` je počet zápisů entity, ne počet vykreslených řádků — zahozením
    // řádku zápis nezmizel, takže se nesnižuje.
    expect(parsed?.deltas[0].total).toBe(6);
  });

  it("vadná entita padne celá a spočítá se zvlášť", () => {
    const parsed = parseNovinkyResponse(
      response([delta([entry()]), { key: "poslanec:2", entries: [] }, "nesmysl"]),
    );
    expect(parsed?.deltas).toHaveLength(1);
    expect(parsed?.droppedDeltas).toBe(2);
  });

  it("chybějící pokrytí se čte jako nečitelná vrstva, ne jako v pořádku", () => {
    const parsed = parseNovinkyResponse({ ...response([]), coverage: { money: true } });
    expect(parsed?.coverage).toEqual({
      money: true,
      law: false,
      reviews: false,
      changes: false,
      dukazy: false,
      recompute: false,
    });
  });
});

describe("souhrn druhů na drátě", () => {
  it("projde jen se známým druhem a celým kladným počtem", () => {
    const parsed = parseNovinkyResponse(
      response([
        {
          ...delta([entry()]),
          kinds: [
            { kind: "contract", count: 3 },
            { kind: "vymysl", count: 1 },
            { kind: "review", count: 0 },
            { kind: "change", count: 1.5 },
            "nesmysl",
          ],
        },
      ]),
    );
    expect(parsed?.deltas[0].kinds).toEqual([{ kind: "contract", count: 3 }]);
  });

  it("chybějící souhrn = prázdný souhrn (nedopočítává se z řádků, ty jsou seříznuté)", () => {
    const d = delta([entry()]) as Record<string, unknown>;
    delete d.kinds;
    expect(parseNovinkyResponse(response([d]))?.deltas[0].kinds).toEqual([]);
  });

  it("klíč katalogu (titleKey/sourceKey) projde; vadný tvar shodí jen klíč, ne řádek", () => {
    const parsed = parseNovinkyResponse(
      response([
        delta([
          entry({
            id: "recompute:42:poslanec:1",
            kind: "recompute",
            tone: "cobalt",
            timeBasis: "zaznamenano",
            internalHref: "/metodika",
            titleKey: "schranka.delta.recomputeTitle",
            titleParams: { pass: 42 },
            sourceKey: "schranka.delta.recomputeSource",
            sourceParams: { ref: "contribution-committee-dedupe" },
          }),
        ]),
      ]),
    );
    const row = parsed?.deltas[0].entries[0];
    expect(row?.titleKey).toBe("schranka.delta.recomputeTitle");
    expect(row?.titleParams).toEqual({ pass: 42 });
    expect(row?.sourceKey).toBe("schranka.delta.recomputeSource");
    expect(row?.sourceParams).toEqual({ ref: "contribution-committee-dedupe" });

    // Vadný klíč/parametry: řádek zůstává (má doslovný titleCs), klíč se nenese.
    const broken = parseNovinkyResponse(
      response([delta([entry({ titleKey: 42, titleParams: "ne", sourceKey: "", sourceParams: null })])]),
    );
    const b = broken?.deltas[0].entries[0];
    expect(broken?.droppedEntries).toBe(0);
    expect(b?.titleKey).toBeUndefined();
    expect(b?.sourceKey).toBeUndefined();
    // Nečíselné/nesmyslné hodnoty v parametrech se škrtají, klíč zůstává.
    const partial = parseNovinkyResponse(
      response([delta([entry({ titleKey: "schranka.delta.recomputeTitle", titleParams: { pass: 42, junk: {} } })])]),
    );
    expect(partial?.deltas[0].entries[0].titleParams).toEqual({ pass: 42 });
  });

  it("řádek o přepočtu indexu je platný druh a projde", () => {
    const parsed = parseNovinkyResponse(
      response([
        delta([
          entry({
            id: "recompute:42:poslanec:1",
            kind: "recompute",
            tone: "cobalt",
            timeBasis: "zaznamenano",
            internalHref: "/metodika",
          }),
        ]),
      ]),
    );
    expect(parsed?.deltas[0].entries[0].kind).toBe("recompute");
  });
});

/* ── schránka nepomlouvá vlastní řádky ──────────────────────────────────────
 * Přípustné druhy byly do 2026-08-12 ručně psaný `Set` devíti řetězců, kterému
 * chyběly `mandate` a `organRole`. Server je posílá (deník je vede od
 * 2026-08-04), takže plocha je zahodila A NAPSALA o nich „N řádků odpovědi mělo
 * tvar, kterému schránka nerozumí" — zatímco feed, který parse vůbec nevolá,
 * tytéž řádky vydal. Dvě adresy jednoho odběru, dvě pravdy.
 *
 * Seznam druhů se tu NEVYPISUJE ručně: bere se přes `countKinds`, tedy přes
 * KIND_ORDER v deriveDeltas.ts — druhý zdroj pravdy o druzích než ten, ze
 * kterého parse odvozuje svůj `Set` (KIND_NOUN_KEYS). Test tak křížově drží obě
 * tabulky proti sobě přes skutečné kolo serializace a parse. */
describe("každý druh, který schránka umí seřadit, taky projde po drátě", () => {
  const ALL_KINDS = countKinds(
    (Object.keys(KIND_NOUN_KEYS) as DeltaEntry["kind"][]).map(
      (kind, i) => entry({ id: `k-${i}`, kind }) as unknown as DeltaEntry,
    ),
  ).map((t) => t.kind);

  it("žádný druh se cestou nezahodí — a plocha o něm nenapíše, že mu nerozumí", () => {
    const wire = JSON.parse(
      JSON.stringify(
        response([delta(ALL_KINDS.map((kind, i) => entry({ id: `k-${i}`, kind })))]),
      ),
    );
    const parsed = parseNovinkyResponse(wire);
    expect(parsed?.droppedEntries, "any dropped kind is a row the page slanders").toBe(0);
    expect(parsed?.deltas[0].entries.map((e) => e.kind)).toEqual(ALL_KINDS);
  });

  it("jmenovitě přežijí i ty dva druhy, které ručně psaný seznam vynechával", () => {
    for (const kind of ["mandate", "organRole"]) {
      expect(ALL_KINDS, `${kind} chybí v KIND_ORDER`).toContain(kind);
      const parsed = parseNovinkyResponse(response([delta([entry({ kind })])]));
      expect(parsed?.droppedEntries, kind).toBe(0);
      expect(parsed?.deltas[0].entries[0].kind, kind).toBe(kind);
    }
  });

  it("neznámý druh se pořád zahodí — seznam je odvozený, ne otevřený", () => {
    expect(parseNovinkyResponse(response([delta([entry({ kind: "vymysleny" })])]))?.droppedEntries).toBe(1);
  });
});

/* ── meze čtení dorazí do schránky ─────────────────────────────────────────
 * `coverage` odpovídá „šla ta vrstva přečíst"; `limits` „přečetla se celá".
 * Druhá otázka do 2026-08-12 na schránku vůbec nedorazila, takže useknutý
 * odečet zkrátil čtenáři deltu beze slova. */
describe("meze čtení na drátě", () => {
  const limits = {
    contractCompanies: 57,
    companyCap: 200,
    companiesOverCap: 0,
    edgeCap: 5_000,
    companiesEdgeTruncated: 2,
    malformedIco: 1,
    changesFromGate: 0,
    changesUndisplayable: 3,
    auditCap: 10_000,
    auditTruncated: true,
    changeCap: 5_000,
    changesRead: 5_000,
    changesTruncated: true,
  };

  it("celý tvar projde doslova", () => {
    const parsed = parseNovinkyResponse({ ...response([]), limits });
    expect(parsed?.limits).toEqual(limits);
  });

  it("odpověď bez mezí je platná — plocha pak nepíše nic (mlčení není tvrzení)", () => {
    expect(parseNovinkyResponse(response([]))?.limits).toBeUndefined();
    expect(parseNovinkyResponse(response([]))).not.toBeNull();
  });

  it("půlka mezí není mez: chybějící nebo vadné pole shodí CELÝ blok, ne jen sebe", () => {
    const { auditCap: _drop, ...missing } = limits;
    expect(parseNovinkyResponse({ ...response([]), limits: missing })?.limits).toBeUndefined();
    expect(
      parseNovinkyResponse({ ...response([]), limits: { ...limits, edgeCap: 12.5 } })?.limits,
    ).toBeUndefined();
    expect(
      parseNovinkyResponse({ ...response([]), limits: { ...limits, auditTruncated: "ano" } })?.limits,
    ).toBeUndefined();
    expect(
      parseNovinkyResponse({ ...response([]), limits: { ...limits, malformedIco: -1 } })?.limits,
    ).toBeUndefined();
    // …a odpověď jako celek přežije: mez není důvod zahodit delty.
    expect(parseNovinkyResponse({ ...response([]), limits: missing })).not.toBeNull();
  });
});
