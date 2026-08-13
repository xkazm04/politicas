/*
 * Trvalá citace pohledu na graf — testy kodeku, otisku a balíčku důkazů.
 *
 * Tři sliby, které tu jsou přibité (zadání batch 3, položka 3B):
 *  1. ROUND-TRIP: každý druh stavu (uzel / trasa / spočítaná cesta, obě
 *     varianty plátna) projde encode → decode beze změny;
 *  2. DETERMINISMUS OTISKU: týž obsah ⇒ týž otisk, nezávisle na pořadí klíčů;
 *  3. ADRESA JE TVRZENÍ: nerozluštitelný ref vrací null (stránka pak 404),
 *     nikdy „opravený" objekt.
 */

import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  citationLine,
  contentHash,
  decodeGraphRef,
  encodeGraphRef,
  GRAPH_SOURCE_LINKS,
  HASH_ALGORITHM,
  hashViewContent,
  parseViewState,
  permalinkCardModel,
  permalinkPath,
  permalinkSources,
  toEvidenceJsonLd,
  type GraphViewState,
  type PermalinkView,
} from "./permalink";
import type { GraphNode, NodeDetail, PathTrailDto } from "./graphTypes";

const HASH = "0a1b2c3d";

const node = (id: string, kind: GraphNode["kind"] = "person"): GraphNode => ({
  id,
  kind,
  label: `label ${id}`,
  degree: 3,
});

// ── Round-trip kodeku ───────────────────────────────────────────────────────

describe("kodek adresy citace", () => {
  const states: GraphViewState[] = [
    { kind: "uzel", variant: "mapa", node: "person:123" },
    { kind: "uzel", variant: "trasy", node: "company:ř-ůž (diakritika & mezery)" },
    { kind: "trasa", variant: "mapa", trail: "penize-poslancu" },
    { kind: "trasa", variant: "trasy", trail: "vybory-a-penize" },
    { kind: "cesta", variant: "mapa", from: "person:1", to: "company:99", path: 0 },
    { kind: "cesta", variant: "trasy", from: "organ:výbor-7", to: "law:56/2001", path: 2 },
  ];

  it("každý druh stavu projde encode → decode beze změny (včetně stavu cesty)", () => {
    for (const state of states) {
      const ref = decodeGraphRef(encodeGraphRef(state, HASH));
      expect(ref).not.toBeNull();
      expect(ref!.state).toEqual(state);
      expect(ref!.hash).toBe(HASH);
    }
  });

  it("adresa je stabilní: týž stav ⇒ týž ref (a /graf/p/ cesta se skládá jen tady)", () => {
    const state = states[4];
    const a = encodeGraphRef(state, HASH);
    const b = encodeGraphRef({ ...state }, HASH);
    expect(a).toBe(b);
    expect(permalinkPath(a)).toBe(`/graf/p/${a}`);
  });

  it("pořadí klíčů vstupního objektu adresu nemění (kanonická serializace)", () => {
    const a = encodeGraphRef({ kind: "cesta", variant: "mapa", from: "x", to: "y", path: 1 }, HASH);
    // Týž stav, klíče v jiném pořadí vzniku — parseViewState objekt skládá
    // znovu, ale kanonický JSON je pojistka i proti budoucí změně skladby.
    const shuffled = parseViewState({ path: 1, to: "y", from: "x", variant: "mapa", kind: "cesta" })!;
    expect(encodeGraphRef(shuffled, HASH)).toBe(a);
  });
});

// ── Nerozluštitelné adresy → null (stránka odpoví 404) ──────────────────────

describe("neplatný ref vrací null", () => {
  const valid = encodeGraphRef({ kind: "uzel", variant: "mapa", node: "n1" }, HASH);

  it.each([
    ["prázdný řetězec", ""],
    ["jiný prefix", valid.replace(/^g\./, "x.")],
    ["chybějící otisk", valid.split(".").slice(0, 2).join(".")],
    ["otisk mimo hex", valid.replace(/[0-9a-f]{8}$/, "ZZZZZZZZ")],
    ["krátký otisk", valid.replace(/[0-9a-f]{8}$/, "0a1b2c3")],
    ["čtyři segmenty", `${valid}.extra`],
    ["rozbité base64url", `g.@@@.${HASH}`],
    ["base64url nesoucí ne-JSON", `g.bmVqc29u.${HASH}`], // „nejson"
    ["příliš dlouhá adresa", `g.${"A".repeat(800)}.${HASH}`],
  ])("%s", (_name, ref) => {
    expect(decodeGraphRef(ref)).toBeNull();
  });

  it("čitelný JSON se špatným tvarem stavu je taky null", () => {
    const bad = [
      null,
      [],
      {},
      { kind: "uzel", variant: "mapa" }, // chybí node
      { kind: "uzel", variant: "jinam", node: "n" }, // neznámá varianta
      { kind: "trasa", variant: "mapa", trail: "" }, // prázdný klíč
      { kind: "cesta", variant: "mapa", from: "a", to: "a", path: 0 }, // from === to
      { kind: "cesta", variant: "mapa", from: "a", to: "b", path: -1 },
      { kind: "cesta", variant: "mapa", from: "a", to: "b", path: 1.5 },
      { kind: "cesta", variant: "mapa", from: "a", to: "b", path: 999 },
      { kind: "neznamy", variant: "mapa", node: "n" },
      { kind: "uzel", variant: "mapa", node: "x".repeat(300) }, // id přes limit
    ];
    for (const state of bad) {
      expect(parseViewState(state)).toBeNull();
    }
  });

  it("parseViewState nepropouští neznámé klíče (výstup se skládá znovu)", () => {
    const parsed = parseViewState({ kind: "uzel", variant: "mapa", node: "n1", smuggled: true });
    expect(parsed).toEqual({ kind: "uzel", variant: "mapa", node: "n1" });
  });
});

// ── Determinismus otisku ────────────────────────────────────────────────────

describe("otisk obsahu", () => {
  it("kanonický JSON nezávisí na pořadí klíčů (i vnořeně)", () => {
    const a = { b: 1, a: { d: [1, 2], c: "x" } };
    const b = { a: { c: "x", d: [1, 2] }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(hashViewContent(a)).toBe(hashViewContent(b));
  });

  it("undefined pole a chybějící pole jsou týž obsah; null je jiný", () => {
    expect(hashViewContent({ a: 1, b: undefined })).toBe(hashViewContent({ a: 1 }));
    expect(hashViewContent({ a: 1, b: null })).not.toBe(hashViewContent({ a: 1 }));
  });

  it("změna obsahu změní otisk; formát je 8 hex znaků", () => {
    const h = hashViewContent({ kind: "uzel", id: "n1" });
    expect(h).toMatch(/^[0-9a-f]{8}$/);
    expect(hashViewContent({ kind: "uzel", id: "n2" })).not.toBe(h);
  });

  it("FNV-1a je stabilní napříč běhy (přibitý vektor)", () => {
    // Změna tohoto testu = změna VŠECH vydaných adres. Vektor je schválně
    // přibitý: "" je ofsetová konstanta FNV, "a" známá hodnota.
    expect(contentHash("")).toBe("811c9dc5");
    expect(contentHash("a")).toBe("e40c292c");
  });
});

// ── Citační řádek a balíček důkazů ──────────────────────────────────────────

const BUNDLE_DESC = "popis balíčku z katalogu";
const ORDERING_RULE = "Pravidlo řazení: nejkratší cesta důkazními hranami …";

/** Cesta o jednom kroku. `pending` a `fresh` jsou parametry, protože přesně na
 *  nich stojí to, co karta smí říct. */
const cestaView = (
  opts: { fresh?: boolean; pendingCount?: number; origin?: string | null } = {},
): Extract<PermalinkView, { kind: "cesta" }> => {
  const pending = opts.pendingCount ?? 1;
  const trail: PathTrailDto = {
    nodeIds: ["p1", "c1"],
    edges: [{ src: "p1", dst: "c1", rel: "linked_to", weight: null, pending: pending > 0 }],
    ledger: [
      {
        step: 1,
        from: node("p1"),
        to: node("c1", "company"),
        rel: "linked_to",
        pending: pending > 0,
        moneyCzk: null,
      },
    ],
    pendingCount: pending,
    moneyCzk: 0,
    hops: 1,
  };
  const fresh = opts.fresh ?? false;
  return {
    ref: "g.x.00000000",
    state: { kind: "cesta", variant: "mapa", from: "p1", to: "c1", path: 0 },
    urlHash: "00000000",
    currentHash: fresh ? "00000000" : "11111111",
    fresh,
    retrievedOn: "2026-07-30",
    title: "label p1 → label c1",
    origin: opts.origin === undefined ? "https://politicas.cz" : opts.origin,
    bundleDescription: BUNDLE_DESC,
    orderingRule: ORDERING_RULE,
    kind: "cesta",
    from: node("p1"),
    to: node("c1", "company"),
    trail,
    totalFound: 1,
    capped: false,
    maxCost: 6,
    hubDegree: 120,
  };
};

/** Uzel s vlastními hlubokými odkazy do registrů. */
const uzelView = (links: NodeDetail["links"]): Extract<PermalinkView, { kind: "uzel" }> => ({
  ref: "g.y.00000000",
  state: { kind: "uzel", variant: "mapa", node: "company:ico:46347534" },
  urlHash: "00000000",
  currentHash: "00000000",
  fresh: true,
  retrievedOn: "2026-07-30",
  title: "firma: Teplárny Brno",
  origin: "https://politicas.cz",
  bundleDescription: BUNDLE_DESC,
  orderingRule: null,
  kind: "uzel",
  detail: {
    node: node("company:ico:46347534", "company"),
    provenance: { method: "deterministic", pass: 10, ref: "kg-pass:10", computedAt: null },
    citableId: "46347534",
    links,
    facts: [],
    degree: 4,
  },
});

describe("citační řádek a JSON-LD", () => {
  it("citační řádek nese titul, datum, adresu i otisk s algoritmem", () => {
    const line = citationLine({
      title: "Peníze kolem poslanců",
      retrievedOn: "30. 7. 2026",
      url: "https://politicas.cz/graf/p/g.x.0a1b2c3d",
      hash: "0a1b2c3d",
    });
    expect(line).toContain("„Peníze kolem poslanců");
    expect(line).toContain("30. 7. 2026");
    expect(line).toContain("https://politicas.cz/graf/p/g.x.0a1b2c3d");
    expect(line).toContain(`${HASH_ALGORITHM} 0a1b2c3d`);
  });

  it("balíček důkazů nese stav kontroly KAŽDÉ hrany a oba otisky", () => {
    const ld = toEvidenceJsonLd(cestaView());
    expect(ld["@type"]).toBe("Dataset");
    expect(ld.hasPart).toHaveLength(1);
    const claim = ld.hasPart[0];
    expect(claim.additionalProperty).toContainEqual({
      "@type": "PropertyValue",
      name: "review_state",
      value: "pending_review",
    });
    // Relace zůstává strojový kód grafu — balíček se páruje na data, ne na češtinu.
    expect(claim.additionalProperty).toContainEqual({
      "@type": "PropertyValue",
      name: "relation",
      value: "linked_to",
    });
    const props = Object.fromEntries(ld.additionalProperty.map((p) => [p.name, p.value]));
    expect(props.content_hash).toBe("11111111");
    expect(props.cited_content_hash).toBe("00000000");
    expect(props.fresh).toBe("no");
  });

  it("balíček je deterministický: týž pohled ⇒ týž serializovaný tvar", () => {
    expect(canonicalJson(toEvidenceJsonLd(cestaView()))).toBe(canonicalJson(toEvidenceJsonLd(cestaView())));
  });

  // Balíček nesl otisky, tvrzení a stav kontroly — ale ne MEZ HLEDÁNÍ ani
  // pravidlo, kterým cesta vznikla. Stránka je tiskne s poznámkou „bez něj by
  // generovaná cesta byla obvinění"; strojový odběratel dostával obvinění.
  it("balíček nese mez hledání i pravidlo řazení spočítané cesty", () => {
    const props = Object.fromEntries(
      toEvidenceJsonLd(cestaView()).additionalProperty.map((p) => [p.name, p.value]),
    );
    expect(props.path_max_cost_steps).toBe(6);
    expect(props.path_hub_degree_threshold).toBe(120);
    expect(props.paths_found).toBe(1);
    expect(props.path_search_capped).toBe("no");
    expect(props.path_ordering_rule).toBe(ORDERING_RULE);
  });

  it("useknuté hledání se v balíčku pozná (a uzel meze hledání nenese vůbec)", () => {
    const capped = toEvidenceJsonLd({ ...cestaView(), capped: true, totalFound: 64 });
    const props = Object.fromEntries(capped.additionalProperty.map((p) => [p.name, p.value]));
    expect(props.path_search_capped).toBe("yes");
    expect(props.paths_found).toBe(64);
    // Uzel se nehledá — mez hledání by o něm netvrdila nic.
    const uzel = toEvidenceJsonLd(uzelView([]));
    const names = uzel.additionalProperty.map((p) => p.name);
    expect(names).not.toContain("path_max_cost_steps");
    expect(names).not.toContain("path_ordering_rule");
  });

  // `url: permalinkPath(ref)` byla relativní adresa — jakmile balíček opustí
  // náš server (archiv redakce, fact-check nástroj), nevede nikam.
  it("adresa i identifikátor jsou absolutní, když je odkud je složit", () => {
    const ld = toEvidenceJsonLd(cestaView({ origin: "https://politicas.cz" }));
    expect(ld.url).toBe("https://politicas.cz/graf/p/g.x.00000000");
    expect(ld.identifier).toBe("https://politicas.cz/graf/p/g.x.00000000");
  });

  it("bez zjistitelného hostitele se `url` VYNECHÁ — doména se nehádá", () => {
    const ld = toEvidenceJsonLd(cestaView({ origin: null }));
    expect(ld.url).toBeUndefined();
    expect(JSON.stringify(ld)).not.toContain("politicas.cz");
    // Identifikátor zůstává ref: je stabilní a není vymyšlený, jen neadresuje.
    expect(ld.identifier).toBe("g.x.00000000");
  });

  it("popis balíčku přichází z katalogu, ne natvrdo z modulu", () => {
    expect(toEvidenceJsonLd(cestaView()).description).toBe(BUNDLE_DESC);
  });
});

// ── Prameny: JEDNO pravidlo pro lištu, kartu i isBasedOn ────────────────────

describe("výběr pramenů citace", () => {
  const links = [
    { registry: "ARES", url: "https://ares.gov.cz/x", tier: "detail" as const },
    { registry: "Registr smluv", url: "https://smlouvy.gov.cz/y", tier: "search" as const },
  ];

  it("uzel s vlastními registry jmenuje JE, ne pramennou základnu platformy", () => {
    const s = permalinkSources(uzelView(links));
    expect(s.fromView).toBe(true);
    expect(s.links.map((l) => l.label)).toEqual(["ARES", "Registr smluv"]);
    // A balíček důkazů odebírá TOTÉŽ pravidlo — dřív vypisoval všechny čtyři
    // registry nepodmíněně, i u uzlu, který s nimi nemá co dělat.
    expect(toEvidenceJsonLd(uzelView(links)).isBasedOn).toEqual([
      "https://ares.gov.cz/x",
      "https://smlouvy.gov.cz/y",
    ]);
  });

  it("pohled bez vlastních odkazů jmenuje pramennou základnu a přizná to", () => {
    for (const view of [uzelView([]), cestaView()]) {
      const s = permalinkSources(view);
      expect(s.fromView).toBe(false);
      expect(s.links).toEqual(GRAPH_SOURCE_LINKS);
    }
    expect(toEvidenceJsonLd(cestaView()).isBasedOn).toEqual(GRAPH_SOURCE_LINKS.map((l) => l.href));
  });
});

// ── Co smí říct karta odkazu (OG obraz) ────────────────────────────────────
//
// Karta `fresh` VŮBEC nečetla (`grep fresh app/graf/p/[ref]/opengraph-image.tsx`
// → 0 zásahů), takže nad citací, o které stránka za ní vyvěsila rozpor,
// tiskla dnešní otisk a „vše ověřeno" v potvrzující modré. A `invalid`,
// `gone` i `unavailable` sdílely jeden náhradní rám tvrdící, že adresa nese
// pohled i otisk.

describe("model karty odkazu", () => {
  it("zastaralý pohled: karta to VÍ a potvrzující barvu nedostane", () => {
    const card = permalinkCardModel({ status: "ok", view: cestaView({ fresh: false, pendingCount: 0 }) });
    expect(card.stale).toBe(true);
    // Dnešní hrany ověřené JSOU — to se nezamlčuje…
    expect(card.review?.allVerified).toBe(true);
    // …ale citace, kterou čtenář drží, není dnešní: modrá se zadrží.
    expect(card.review?.confirming).toBe(false);
    // A oba otisky jdou ven, aby byl rozdíl vidět na kartě, ne až za ní.
    expect(card.imprint).toEqual({
      hash: "11111111",
      citedHash: "00000000",
      retrievedOn: "2026-07-30",
    });
  });

  it("čerstvý pohled bez čekajících hran potvrzující barvu dostane", () => {
    const card = permalinkCardModel({ status: "ok", view: cestaView({ fresh: true, pendingCount: 0 }) });
    expect(card.stale).toBe(false);
    expect(card.review).toEqual({ pendingEdges: 0, allVerified: true, confirming: true });
    // Čerstvá citace nemá co srovnávat — druhý otisk se nesází.
    expect(card.imprint?.citedHash).toBeNull();
  });

  it("čekající hrany potvrzující barvu nedostanou ani u čerstvého pohledu", () => {
    const card = permalinkCardModel({ status: "ok", view: cestaView({ fresh: true, pendingCount: 3 }) });
    expect(card.review).toEqual({ pendingEdges: 3, allVerified: false, confirming: false });
  });

  it("cesta, kterou dnešní graf nedokládá, netvrdí o hranách nic", () => {
    const card = permalinkCardModel({
      status: "ok",
      view: { ...cestaView({ fresh: true }), trail: null },
    });
    expect(card.review).toBeNull();
  });

  it("uzel nesází hrany, takže žádný řádek kontroly nemá", () => {
    expect(permalinkCardModel({ status: "ok", view: uzelView([]) }).review).toBeNull();
  });

  it("invalid · gone · unavailable jsou TŘI karty, ne jedna", () => {
    const invalid = permalinkCardModel({ status: "invalid" });
    const unavailable = permalinkCardModel({ status: "unavailable" });
    const gone = permalinkCardModel({
      status: "gone",
      urlHash: "0a1b2c3d",
      retrievedOn: "2026-07-30",
    });
    expect(new Set([invalid.state, unavailable.state, gone.state]).size).toBe(3);

    // Neplatná adresa ani výpadek NENESOU otisk — karta nesmí tvrdit, že
    // adresa nese pohled a otisk důkazů, když nenese nic (invalid), ani že
    // pohled zanikl, když jen neběží sklad (unavailable).
    expect(invalid.imprint).toBeNull();
    expect(unavailable.imprint).toBeNull();
    // Zaniklý pohled otisk V ADRESE má — zanikl doklad, ne citace.
    expect(gone.imprint).toEqual({
      hash: "0a1b2c3d",
      citedHash: null,
      retrievedOn: "2026-07-30",
    });

    // Žádný z nepohledů nesmí vypadat jako zastaralý pohled ani nabízet
    // potvrzující barvu.
    for (const card of [invalid, unavailable, gone]) {
      expect(card.stale).toBe(false);
      expect(card.review).toBeNull();
    }
  });
});
