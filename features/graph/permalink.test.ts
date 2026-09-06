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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pragueDay } from "@/features/denik/pragueDay";
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
  worstGateOfView,
  type GraphViewState,
  type PermalinkView,
} from "./permalink";
import type { GateStatus, GraphNode, NodeDetail, PathTrailDto } from "./graphTypes";
import { EMPTY_GRAPH_PROVENANCE } from "@/lib/kg/graphProvenance";

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
  // Historický tvar `g.` (prázdné datum vydání) — dál platná citace.
  const valid = encodeGraphRef({ kind: "uzel", variant: "mapa", node: "n1" }, HASH, "");
  const body = valid.slice("g.".length);

  it.each([
    ["prázdný řetězec", ""],
    ["jiný prefix", valid.replace(/^g\./, "x.")],
    ["jiný prefix u datovaného tvaru", `g3.${body}.20260904`],
    ["chybějící otisk", valid.split(".").slice(0, 2).join(".")],
    ["otisk mimo hex", valid.replace(/[0-9a-f]{8}$/, "ZZZZZZZZ")],
    ["krátký otisk", valid.replace(/[0-9a-f]{8}$/, "0a1b2c3")],
    ["čtyři segmenty u starého tvaru", `${valid}.extra`],
    ["pět segmentů", `g2.${body}.20260904.navic`],
    // Datum se NEOPRAVUJE: 31. února není 3. březen, je to neplatná adresa.
    ["neexistující den", `g2.${body}.20260231`],
    ["datum s pomlčkami", `g2.${body}.2026-09-04`],
    ["příliš krátké datum", `g2.${body}.260904`],
    ["datované bez data", `g2.${body}`],
    ["rozbité base64url", `g.@@@.${HASH}`],
    ["base64url nesoucí ne-JSON", `g.bmVqc29u.${HASH}`], // „nejson"
    ["příliš dlouhá adresa", `g.${"A".repeat(800)}.${HASH}`],
  ])("%s", (_name, ref) => {
    expect(decodeGraphRef(ref)).toBeNull();
  });

  /* PROSTOR ADRES JE APPEND-ONLY (2026-09-04, moonshot G1): `g2.` přibylo
   * s datem vydání, `g.` musí dál luštit — vydaná citace se nikdy neruší. */
  it("oba tvary se luští; datum nese jen ten druhý", () => {
    const state = { kind: "uzel", variant: "mapa", node: "n1" } as const;
    const old = decodeGraphRef(encodeGraphRef(state, HASH, ""));
    expect(old).toEqual({ state, hash: HASH, issuedAt: null });

    const dated = decodeGraphRef(encodeGraphRef(state, HASH, "20260904"));
    expect(dated).toEqual({ state, hash: HASH, issuedAt: "2026-09-04" });
  });

  it("nově vydaná citace nese datum sama od sebe", () => {
    // Vydávající akce (graphActions.citeViewAction) o datu neví; kodek ho
    // razítkuje, protože „kdy byla citace vydána" se odjinud odvodit nedá.
    const ref = encodeGraphRef({ kind: "uzel", variant: "mapa", node: "n1" }, HASH);
    expect(ref.startsWith("g2.")).toBe(true);
    // Den vydání je PRAŽSKÝ (2026-09-08): mezi půlnocí a 01:00/02:00 Prahy
    // dávala UTC do adresy včerejšek — datum, které čtenář cituje jako den vydání.
    expect(decodeGraphRef(ref)?.issuedAt).toBe(pragueDay());
  });

  it("jediné hodiny modulu i `retrievedOn` loaderu jdou přes pragueDay (2026-09-08)", () => {
    const codec = readFileSync("features/graph/permalink.ts", "utf8");
    expect(codec).toMatch(/issuedTodayCompact = \(\): string => pragueDay\(\)/);
    expect(codec).not.toMatch(/toISOString\(\)\.slice\(0, 10\)\.replaceAll/);
    const loader = readFileSync("features/graph/getPermalinkData.ts", "utf8");
    expect(loader).toMatch(/const today = \(\): string => pragueDay\(\);/);
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
  const gate = pending > 0 ? "pending_review" : "verified";
  const prov = { pass: 68, method: "deterministic", ref: "kg:linked_to/v3" };
  const trail: PathTrailDto = {
    nodeIds: ["p1", "c1"],
    edges: [
      { src: "p1", dst: "c1", rel: "linked_to", weight: null, pending: pending > 0, gate, provenance: prov },
    ],
    ledger: [
      {
        step: 1,
        from: node("p1"),
        to: node("c1", "company"),
        rel: "linked_to",
        pending: pending > 0,
        gate,
        provenance: prov,
        claimRef: "c.e.p1.linked_to.c1",
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
    issuedAt: null,
    diff: null,
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
    excludedRejected: 0,
    ruleRef: "evidence-path/v1",
  };
};

/** Uzel s vlastními hlubokými odkazy do registrů. */
const uzelView = (links: NodeDetail["links"]): Extract<PermalinkView, { kind: "uzel" }> => ({
  ref: "g.y.00000000",
  state: { kind: "uzel", variant: "mapa", node: "company:ico:46347534" },
  urlHash: "00000000",
  currentHash: "00000000",
  fresh: true,
  issuedAt: null,
  diff: null,
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

/**
 * Kurátorská trasa s VÝSLOVNĚ zadaným stavem brány na každé hraně. Trasa se
 * nefiltruje (vyžádaná odpověď), takže je to jediný pohled, ve kterém se
 * zamítnutý krok legálně vysází — a musí být poznat.
 */
const trasaWithGates = (gates: (GateStatus | null)[]): Extract<PermalinkView, { kind: "trasa" }> => ({
  ref: "g.t.00000000",
  state: { kind: "trasa", variant: "trasy", trail: "penize-poslancu" },
  urlHash: "00000000",
  currentHash: "11111111",
  fresh: false,
  retrievedOn: "2026-07-30",
  title: "Peníze kolem poslanců",
  origin: "https://politicas.cz",
  bundleDescription: BUNDLE_DESC,
  orderingRule: null,
  issuedAt: null,
  diff: null,
  kind: "trasa",
  trail: {
    key: "penize-poslancu",
    columns: ["person", "company"],
    nodes: gates.map((_, i) => ({ ...node(`n${i}`), column: 0, order: i })),
    edges: gates.map((gate, i) => ({
      src: `n${i}`,
      dst: `n${i + 1}`,
      rel: "linked_to",
      weight: null,
      pending: gate === "pending_review",
      gate,
      provenance: null,
    })),
    provenance: EMPTY_GRAPH_PROVENANCE,
  },
});

/** Okolí uzlu: dvě vykreslené hrany z devíti, jedna z nich zamítnutá. */
const okoliView = (): Extract<PermalinkView, { kind: "okoli" }> => ({
  ref: "g.o.00000000",
  state: { kind: "okoli", variant: "mapa", node: "co:1" },
  urlHash: "00000000",
  currentHash: "00000000",
  fresh: true,
  retrievedOn: "2026-09-04",
  title: "firma: Alfa",
  origin: "https://politicas.cz",
  bundleDescription: BUNDLE_DESC,
  orderingRule: null,
  issuedAt: null,
  diff: null,
  kind: "okoli",
  neighbourhood: {
    anchor: node("co:1", "company"),
    nodes: [{ ...node("co:2", "company"), x: 10, y: 20 }],
    edges: [
      { src: "co:1", dst: "co:2", rel: "supplies", weight: null, pending: false, gate: null, provenance: null },
      { src: "co:1", dst: "co:2", rel: "linked_to", weight: null, pending: false, gate: "rejected", provenance: null },
    ],
    perRel: [
      { rel: "supplies", shown: 1, total: 7 },
      { rel: "linked_to", shown: 1, total: 2 },
    ],
    limit: 60,
    readTruncated: false,
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
    expect(card.review).toEqual({
      pendingEdges: 0,
      rejectedEdges: 0,
      allVerified: true,
      confirming: true,
    });
    // Čerstvá citace nemá co srovnávat — druhý otisk se nesází.
    expect(card.imprint?.citedHash).toBeNull();
  });

  it("čekající hrany potvrzující barvu nedostanou ani u čerstvého pohledu", () => {
    const card = permalinkCardModel({ status: "ok", view: cestaView({ fresh: true, pendingCount: 3 }) });
    expect(card.review).toEqual({
      pendingEdges: 3,
      rejectedEdges: 0,
      allVerified: false,
      confirming: false,
    });
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

/*
 * TŘI STAVY V BALÍČKU DŮKAZŮ (2026-09-04) — tenhle blok před opravou PADAL.
 *
 * `edgeClaim` vypisoval `pending ? "pending_review" : "verified"`, tedy
 * dvouhodnotovou větu o tříhodnotovém poli. Zamítnutá hrana nesla `pending:
 * false`, takže NEJHŮŘ OPRAVITELNÝ artefakt produktu — strojový balíček, který
 * si redakce i crawlery archivují — o ní tvrdil `review_state: verified`.
 */
describe("balíček důkazů — stav kontroly doslova, nikdy překlopený boolean", () => {
  /** Rozdělení tokenů `review_state` přes všechna tvrzení balíčku. */
  const tokens = (view: PermalinkView): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const claim of toEvidenceJsonLd(view).hasPart) {
      for (const p of claim.additionalProperty) {
        if (p.name === "review_state") out[String(p.value)] = (out[String(p.value)] ?? 0) + 1;
      }
    }
    return out;
  };

  it("zamítnutý krok kurátorské trasy odchází jako `rejected`, ne jako `verified`", () => {
    const view = trasaWithGates(["verified", "pending_review", "rejected"]);
    expect(tokens(view)).toEqual({ verified: 1, pending_review: 1, rejected: 1 });
  });

  it("negated relace se vypíše jako `ungated` — „nemá co ověřovat\" není „ověřeno\"", () => {
    expect(tokens(trasaWithGates([null, null]))).toEqual({ ungated: 2 });
  });

  it("každé tvrzení nese vlastní trvalou adresu a svou provenienci", () => {
    const claim = toEvidenceJsonLd(cestaView()).hasPart[0];
    const props = Object.fromEntries(claim.additionalProperty.map((p) => [p.name, p.value]));
    expect(props.claim_ref).toBe("c.e.p1.linked_to.c1");
    expect(props.claim_url).toBe("https://politicas.cz/zdroj/c.e.p1.linked_to.c1");
    expect(props.provenance_ref).toBe("kg:linked_to/v3");
    expect(props.provenance_pass).toBe(68);
    expect(props.provenance_method).toBe("deterministic");
  });

  it("bez zjistitelného hostitele se adresa tvrzení VYNECHÁ, nikdy nehádá", () => {
    const claim = toEvidenceJsonLd(cestaView({ origin: null })).hasPart[0];
    const names = claim.additionalProperty.map((p) => p.name);
    expect(names).toContain("claim_ref");
    expect(names).not.toContain("claim_url");
  });

  it("balíček nese počet vyloučených zamítnutých kroků a identitu pravidla", () => {
    const props = Object.fromEntries(
      toEvidenceJsonLd({ ...cestaView(), excludedRejected: 4 }).additionalProperty.map((p) => [
        p.name,
        p.value,
      ]),
    );
    expect(props.path_excluded_rejected).toBe(4);
    expect(props.path_rule_ref).toBe("evidence-path/v1");
  });

  it("karta odkazu počítá zamítnuté kroky zvlášť a potvrzující barvu jim nedá", () => {
    const card = permalinkCardModel({
      status: "ok",
      view: { ...trasaWithGates(["verified", "rejected"]), fresh: true, currentHash: "00000000" },
    });
    expect(card.review).toEqual({
      pendingEdges: 0,
      rejectedEdges: 1,
      allVerified: false,
      confirming: false,
    });
  });
});

/*
 * [G4] OKOLÍ UZLU — čtvrtý citovatelný druh pohledu.
 *
 * Adresa je slib, který se jen PŘIDÁVÁ: starší tvary (`uzel`, `trasa`,
 * `cesta`) musí projít kodekem beze změny, a nový tvar musí projít TOUŽ
 * přísností — akce i dekodér jsou veřejné endpointy, ne funkce.
 */
describe("okolí uzlu jako citovatelný pohled", () => {
  const okoli: GraphViewState = { kind: "okoli", variant: "mapa", node: "co:46347534" };

  it("projde kodekem tam i zpět — v OBOU tvarech adresy", () => {
    // Nový druh pohledu se přidává do prostoru adres, který je append-only:
    // musí projít starým tvarem  i datovaným  (G1), jinak by okolí
    // bylo citovatelné jen v jedné polovině adres.
    expect(decodeGraphRef(encodeGraphRef(okoli, HASH, ""))).toEqual({
      state: okoli,
      hash: HASH,
      issuedAt: null,
    });
    expect(decodeGraphRef(encodeGraphRef(okoli, HASH, "20260904"))).toEqual({
      state: okoli,
      hash: HASH,
      issuedAt: "2026-09-04",
    });
  });

  it("validace je stejně přísná jako u ostatních druhů", () => {
    expect(parseViewState({ kind: "okoli", variant: "mapa", node: "x" })).toEqual(okoli.node ? {
      kind: "okoli",
      variant: "mapa",
      node: "x",
    } : null);
    expect(parseViewState({ kind: "okoli", variant: "mapa", node: "" })).toBeNull();
    expect(parseViewState({ kind: "okoli", variant: "jina", node: "x" })).toBeNull();
    expect(parseViewState({ kind: "okoli", node: "x" })).toBeNull();
    expect(parseViewState({ kind: "okoli", variant: "mapa", node: "x".repeat(201) })).toBeNull();
  });

  it("neznámé klíče se nepropouštějí — výstup se skládá jen ze známých polí", () => {
    expect(parseViewState({ kind: "okoli", variant: "mapa", node: "x", zlo: 1 })).toEqual({
      kind: "okoli",
      variant: "mapa",
      node: "x",
    });
  });

  it("balíček nese strop I jeho populaci — řez bez počtu je tvrzení o ničem", () => {
    const view = okoliView();
    const props = Object.fromEntries(
      toEvidenceJsonLd(view).additionalProperty.map((p) => [p.name, p.value]),
    );
    expect(props.neighbourhood_edges_shown).toBe(2);
    expect(props.neighbourhood_edges_total).toBe(9);
    expect(props.neighbourhood_limit).toBe(60);
    expect(props.neighbourhood_read_truncated).toBe("no");
    // Per relaci taky „N z M", ne jen N.
    expect(props.neighbourhood_rel_supplies).toBe("1/7");
    expect(props.neighbourhood_rel_linked_to).toBe("1/2");
  });

  it("hrany okolí jdou ven jako tvrzení se stavem brány, zamítnuté doslova", () => {
    const tokens = toEvidenceJsonLd(okoliView())
      .hasPart.flatMap((c) => c.additionalProperty)
      .filter((p) => p.name === "review_state")
      .map((p) => p.value);
    // `supplies` je negated relace → `ungated`, NIKDY „verified"; `linked_to`
    // odmítla kontrola → `rejected` doslova. Ani jeden token není „verified",
    // a to je celý smysl: ověření se tvrdí jen tam, kde ho někdo napsal.
    expect(tokens.sort()).toEqual(["rejected", "ungated"]);
  });

  it("karta počítá zamítnutou vazbu okolí zvlášť a potvrzující barvu nedá", () => {
    const card = permalinkCardModel({ status: "ok", view: okoliView() });
    expect(card.review).toEqual({
      pendingEdges: 0,
      rejectedEdges: 1,
      allVerified: false,
      confirming: false,
    });
  });
});

describe("worstGateOfView — modifikátor brány pro /overeni", () => {
  it("odmítnutí bije čekání a čekání bije ověřeno", () => {
    expect(worstGateOfView(trasaWithGates(["verified", "pending_review", "rejected"]))).toBe("rejected");
    expect(worstGateOfView(trasaWithGates(["verified", "pending_review"]))).toBe("pending_review");
    expect(worstGateOfView(trasaWithGates(["verified", "verified"]))).toBe("verified");
  });

  it("pohled bez hran hodnocených branou je SKUTEČNĚ ungated, ne ověřený", () => {
    // null = „na co se ptát není": uzel, nebo pohled ze samých negated relací.
    expect(worstGateOfView(trasaWithGates([null, null]))).toBeNull();
    expect(worstGateOfView(uzelView([]))).toBeNull();
  });

  it("okolí se hodnotí týmž pravidlem jako trasa", () => {
    expect(worstGateOfView(okoliView())).toBe("rejected");
  });
});
