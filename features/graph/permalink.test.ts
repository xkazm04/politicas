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
  HASH_ALGORITHM,
  hashViewContent,
  parseViewState,
  permalinkPath,
  toEvidenceJsonLd,
  type GraphViewState,
  type PermalinkView,
} from "./permalink";
import type { GraphNode, PathTrailDto } from "./graphTypes";

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

const cestaView = (): PermalinkView => {
  const trail: PathTrailDto = {
    nodeIds: ["p1", "c1"],
    edges: [{ src: "p1", dst: "c1", rel: "linked_to", weight: null, pending: true }],
    ledger: [
      { step: 1, from: node("p1"), to: node("c1", "company"), rel: "linked_to", pending: true, moneyCzk: null },
    ],
    pendingCount: 1,
    moneyCzk: 0,
    hops: 1,
  };
  return {
    ref: "g.x.00000000",
    state: { kind: "cesta", variant: "mapa", from: "p1", to: "c1", path: 0 },
    urlHash: "00000000",
    currentHash: "11111111",
    fresh: false,
    retrievedOn: "2026-07-30",
    title: "label p1 → label c1",
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
});
