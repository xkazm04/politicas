// Every kind and relation the graph can carry has a label in BOTH catalogs and in
// the pure-module mirrors of features/graph/permalink.ts. Derived from the ONE enum
// (lib/analysis/kg-verdict.ts), never from a hand-typed list: `graph.kinds` lacked
// `tender` and `graph.rels` lacked the whole procurement layer (procures, bids_on,
// wins) plus five later relations, so a company's neighbourhood printed
// `graph.rels.wins` and the legend printed `graph.kinds.tender` — next-intl's
// missing-key string, typeset as if it were Czech (2026-09-06, scan-sweep,
// parity-auditor: one enum, three catalogs, only the enum grew).

import { describe, expect, it } from "vitest";
import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";
import { KG_EDGE_RELS, KG_NODE_KINDS } from "@/lib/analysis/kg-verdict";
import { KIND_LABELS, REL_LABELS, TRAIL_TITLES } from "./permalink";

type Nested = Record<string, unknown>;
const at = (catalog: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Nested)[k] : undefined), catalog);
const catalogs = [
  ["cs", csCatalog],
  ["en", enCatalog],
] as const;

describe("graph catalogs cover the KG enums (2026-09-06, parity-auditor)", () => {
  it("graph.kinds and graph.inspector.noSource name every KG_NODE_KIND", () => {
    for (const [locale, catalog] of catalogs) {
      for (const kind of KG_NODE_KINDS) {
        expect(typeof at(catalog, `graph.kinds.${kind}`), `${locale} graph.kinds.${kind}`).toBe("string");
        expect(typeof at(catalog, `graph.inspector.noSource.${kind}`), `${locale} noSource.${kind}`).toBe("string");
      }
    }
  });

  it("graph.rels names every KG_EDGE_REL", () => {
    for (const [locale, catalog] of catalogs) {
      for (const rel of KG_EDGE_RELS) {
        expect(typeof at(catalog, `graph.rels.${rel}`), `${locale} graph.rels.${rel}`).toBe("string");
      }
    }
  });

  it("the pure-module mirrors (KIND_LABELS, REL_LABELS) cover the same enums", () => {
    for (const kind of KG_NODE_KINDS) expect(typeof KIND_LABELS[kind], `KIND_LABELS.${kind}`).toBe("string");
    for (const rel of KG_EDGE_RELS) expect(typeof REL_LABELS[rel], `REL_LABELS.${rel}`).toBe("string");
  });

  it("TRAIL_TITLES and graph.trasy.trails are the same set of trail keys", () => {
    for (const [locale, catalog] of catalogs) {
      const trails = at(catalog, "graph.trasy.trails") as Record<string, unknown>;
      expect(Object.keys(trails).sort(), locale).toEqual(Object.keys(TRAIL_TITLES).sort());
    }
  });
});
