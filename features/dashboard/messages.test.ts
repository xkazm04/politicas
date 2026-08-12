// The /dashboard copy catalog, pinned — the discipline `features/civicscore/messages.test.ts`
// established and `features/money/messages.test.ts` repeated. The velín is the front door and
// it had NO messages test at all, so three falsifiable sentences survived here after both of
// those surfaces had already corrected them:
//
//   1. „9. období" over a loader that reads PSP10 — the TENTH term (4 keys);
//   2. „všech {pending} z {total} vazeb čeká na lidskou kontrolu" as a LITERAL, on a money
//      layer whose review console can write `verified` and `rejected`;
//   3. a lead promising „pohyby v žebříčku a nové hrany v grafu" — deltas nothing renders,
//      because the graph keeps no changelog (that is exactly why the feed is DATED FACTS).
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

type Ns = Record<string, unknown>;

/** Flattens `dashboard.realStats.moneyLabel` → one dotted key per leaf string. */
function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.dashboard as Ns);
const en = flatten(enCatalog.dashboard as Ns);

function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

describe("dashboard message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it("no key is empty in either locale", () => {
    for (const k of Object.keys(cs)) {
      expect(cs[k].trim(), `cs.${k}`).not.toBe("");
      expect(en[k].trim(), `en.${k}`).not.toBe("");
    }
  });

  it("each key declares the same ICU placeholders in both locales", () => {
    for (const k of Object.keys(cs)) {
      expect(placeholders(en[k]), k).toEqual(placeholders(cs[k]));
    }
  });

  it("states the term the loaders actually read (PSP10 = the tenth), not the ninth", () => {
    expect(cs["headerNoteReal"]).toContain("10. období");
    expect(en["headerNoteReal"]).toContain("10th term");
    expect(cs["realStats.attendanceSource"]).toContain("10. období");
    expect(en["realStats.attendanceSource"]).toContain("10th term");
    for (const ns of [cs, en]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} still claims the 9th term`).not.toMatch(/9\. období|9th term/);
      }
    }
  });

  it("the header has a sentence for every provenance state, not one confident pass", () => {
    // `summarizeContributionProvenance` answers uniform | mixed | absent, and a uniform
    // chamber may still carry no agreed recompute day. Four states, four sentences —
    // plus the formula-mismatch line that made the 2026-07-29 divergence invisible.
    for (const ns of [cs, en]) {
      for (const k of [
        "headerNoteReal",
        "headerNoteNoDate",
        "headerNoteMixed",
        "headerNoteAbsent",
        "headerNoteUnavailable",
        "headerNoteFormulaMismatch",
      ]) {
        expect(ns[k], k).toBeTruthy();
      }
    }
    expect(placeholders(cs["headerNoteFormulaMismatch"])).toEqual(["declared", "stored"]);
    expect(placeholders(cs["headerNoteMixed"])).toEqual(["covered", "total", "variants"]);
  });

  it("the money tile derives the gate's phase instead of asserting one", () => {
    for (const ns of [cs, en]) {
      for (const phase of ["allPending", "mixed", "allDecided", "empty"]) {
        expect(ns[`realStats.moneyReview.${phase}`], phase).toBeTruthy();
      }
      // The base citation may no longer carry the pending/total counts — those belong to
      // the phase sentence, which is the only thing that can tell all four states apart.
      expect(placeholders(ns["realStats.moneySource"])).toEqual(["pass"]);
    }
    expect(placeholders(cs["realStats.moneyReview.mixed"])).toEqual([
      "decided",
      "pending",
      "rejected",
      "total",
      "verified",
    ]);
  });

  it("the money tile can state a floor, like /penize does", () => {
    // A capped corpus makes every CZK total a LOWER BOUND; /penize renders „nejméně"
    // and the velín used to render the same arithmetic bare — higher confidence than
    // the module it takes the number from.
    expect(cs["realStats.moneyValueFloor"]).toContain("nejméně");
    expect(en["realStats.moneyValueFloor"]).toContain("at least");
    expect(placeholders(cs["realStats.moneyFloorNote"])).toEqual(["cap", "companies"]);
    expect(placeholders(en["realStats.moneyFloorNote"])).toEqual(["cap", "companies"]);
  });

  it("names each layer that can go dark on its own", () => {
    for (const ns of [cs, en]) {
      for (const k of ["partial.title", "partial.body", "partial.source"]) {
        expect(ns[k], k).toBeTruthy();
      }
      for (const layer of ["money", "laws", "slice"]) {
        expect(ns[`partial.layers.${layer}`], layer).toBeTruthy();
      }
      expect(placeholders(ns["partial.body"])).toEqual(["layers"]);
    }
  });

  it("the lead promises only what the surface renders", () => {
    // The graph keeps no changelog, so „ranking moves" / „new edges since your last
    // visit" is a delivery nothing on this page can make. The feed is DATED FACTS.
    expect(cs["lead"]).not.toMatch(/pohyby v žebříčku|nové hrany/);
    expect(en["lead"]).not.toMatch(/ranking moves|new edges/);
    expect(cs["lead"]).toContain("datovaná fakta");
    expect(en["lead"]).toContain("dated facts");
  });

  it("carries the copy for the surfaces the velín links into", () => {
    // The velín summarizes four modules and used to lead into none of them by
    // entity: no /denik, no /metodika, and the company node pointed at an MP.
    for (const ns of [cs, en]) {
      for (const k of [
        "feed.denikLink",
        "feed.denikLinkNamed",
        "feed.denikAll",
        "feed.denikNote",
        "graph.denikEntity",
        "realStats.methodologyLink",
      ]) {
        expect(ns[k], k).toBeTruthy();
      }
      expect(placeholders(ns["feed.denikLinkNamed"])).toEqual(["subject"]);
    }
  });

  it("a selection that matches no row gets a sentence, not twelve dimmed rows", () => {
    // The feed used to answer a law/party selection with a deterministic „0 z 12" and
    // no explanation at all. The empty state must NAME the entity, state the window's
    // limit, and offer the diary — and it must claim nothing about the world.
    for (const ns of [cs, en]) {
      for (const k of ["feed.emptySelection", "feed.emptySelectionDenik", "feed.filterRule"]) {
        expect(ns[k], k).toBeTruthy();
      }
      expect(placeholders(ns["feed.emptySelection"])).toEqual(["label", "rows"]);
    }
    // Silence is not a claim that nothing happened.
    expect(cs["feed.emptySelection"]).toContain("netvrdí");
    expect(en["feed.emptySelection"]).toContain("claims nothing");
    // The filter rule is printed on the surface, so it may not stay a source comment.
    expect(cs["feed.filterRule"]).toContain("dva kroky");
    expect(en["feed.filterRule"]).toContain("two-hop");
  });

  it("the law tile can state the forensic layer, not only the plumbing", () => {
    // `flaggedCount` / `forensicCount` / `paragraphDiffCount` / `summaryCount` /
    // `forensicWithheldCount` were all in LawData and rendered nowhere here: the front
    // door advertised bill→law EDGE counts and hid round 4's findings.
    for (const ns of [cs, en]) {
      expect(placeholders(ns["realStats.lawsForensic"])).toEqual([
        "diffs",
        "flagged",
        "forensic",
        "summaries",
      ]);
      expect(placeholders(ns["realStats.lawsWithheld"])).toEqual(["count"]);
    }
    // A withheld string is disclosed, never described as absent.
    expect(cs["realStats.lawsWithheld"]).toContain("zadržený, ne smazaný");
    expect(en["realStats.lawsWithheld"]).toContain("withheld, not deleted");
  });

  it("a shared rank is stated rather than silently broken", () => {
    for (const ns of [cs, en]) {
      expect(placeholders(ns["realRanking.tiedRank"])).toEqual(["count"]);
      expect(ns["realRanking.badgeSource"], "the row badges carry their own citation").toBeTruthy();
    }
    expect(cs["realRanking.footnote"]).toContain("soutěžní");
    expect(en["realRanking.footnote"]).toContain("competition ranks");
  });

  it("the canvas documents its keyboard pattern and carries a textual alternative", () => {
    // One tab stop + arrow traversal along edges is not a pattern a reader can guess,
    // and a picture with no text alternative is not readable at all. Both are copy the
    // surface must carry in both languages, not a comment in the source.
    for (const ns of [cs, en]) {
      for (const k of [
        "graph.keyboardHint",
        "graph.nodePosition",
        "graph.list.summary",
        "graph.list.intro",
        "graph.list.index",
        "graph.list.realSource",
        "graph.list.mockSource",
      ]) {
        expect(ns[k], k).toBeTruthy();
      }
      expect(placeholders(ns["graph.nodePosition"])).toEqual(["index", "total"]);
      expect(placeholders(ns["graph.list.summary"])).toEqual(["edges", "nodes"]);
      expect(placeholders(ns["graph.list.index"])).toEqual(["index"]);
    }
    // The hint must name every key the canvas actually binds — a documented pattern
    // that omits Home/End documents a different product.
    for (const [ns, keys] of [
      [cs, ["šipky", "Home/End", "Enter", "Escape"]],
      [en, ["arrow", "Home/End", "Enter", "Escape"]],
    ] as const) {
      for (const token of keys) expect(ns["graph.keyboardHint"]).toContain(token);
    }
    // The sample slice may never claim the list shows real ties.
    expect(cs["graph.list.mockSource"]).toContain("smyšlené");
    expect(en["graph.list.mockSource"]).toContain("invented");
  });

  it("the exhibit tells a row behind the window from a row that is gone", () => {
    // Until 2026-08-12 a fact exhibit died once twelve newer facts existed, and the
    // page said the ledger „window" had pushed it out — for a record the same pass
    // still derives. Two different sentences now, and neither hardcodes the window
    // size: `FEED_ROWS` is a constant the copy interpolates.
    for (const ns of [cs, en]) {
      for (const k of [
        "exhibit.beyondWindow",
        "exhibit.citedAddressLabel",
        "exhibit.todayAddress",
        "exhibit.todayAddressNote",
      ]) {
        expect(ns[k], k).toBeTruthy();
      }
      expect(placeholders(ns["exhibit.beyondWindow"])).toEqual(["rows"]);
      expect(placeholders(ns["exhibit.goneBody"])).toEqual(["rows"]);
    }
    // „Gone" may no longer be explained by the display window — that is now a
    // separate, non-fatal state.
    expect(cs["exhibit.goneBody"]).not.toMatch(/vytlačit|novější fakta mohla/);
    expect(en["exhibit.goneBody"]).not.toMatch(/pushed this row out/);
    // The affordances point at the cited address, and the copy says why.
    expect(cs["exhibit.todayAddressNote"]).toContain("CITOVANOU");
    expect(en["exhibit.todayAddressNote"]).toContain("CITED");
  });

  it("no hardcoded chamber size stands in for a counted one", () => {
    // `attendanceSub` printed „přes reálný vzorek 207 poslanců" — a literal that goes
    // stale the moment the chamber the loader reads is not 207.
    for (const ns of [cs, en]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} hardcodes a chamber size`).not.toMatch(/\b207\b/);
      }
    }
    expect(placeholders(cs["realStats.attendanceSub"])).toEqual(["count"]);
  });
});
