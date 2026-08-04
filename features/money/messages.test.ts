// The /penize copy catalog, pinned — the same discipline `features/civicscore/
// messages.test.ts` established. Two of the failures this file exists to catch were
// live: a banner asserting that EVERY tie was still pending (a literal the review
// console can falsify with one click), and „9. období" printed over a loader that reads
// PSP10, the tenth.
import { describe, expect, it } from "vitest";

import csCatalog from "@/messages/cs.json";
import enCatalog from "@/messages/en.json";

type Ns = Record<string, unknown>;

/** Flattens `money.real.stats.ownerLabel` → one dotted key per leaf string. */
function flatten(ns: Ns, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ns)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Ns, key));
  }
  return out;
}

const cs = flatten(csCatalog.money as Ns);
const en = flatten(enCatalog.money as Ns);

function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{(\w+)[^}]*\}/g)].map((m) => m[1]))].sort();
}

describe("money message catalog", () => {
  it("cs and en declare exactly the same keys", () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
  });

  it("each key declares the same ICU placeholders in both locales", () => {
    for (const k of Object.keys(cs)) {
      expect(placeholders(en[k]), k).toEqual(placeholders(cs[k]));
    }
  });

  it("states the term the money loader actually reads (PSP10 = the tenth), not the ninth", () => {
    expect(cs["real.stats.mpsSub"]).toContain("10. období");
    expect(en["real.stats.mpsSub"]).toContain("10th term");
    for (const ns of [cs, en]) {
      for (const [k, v] of Object.entries(ns)) {
        expect(v, `${k} still claims the 9th term`).not.toMatch(/9\. období|9th term/);
      }
    }
  });

  it("has a sentence for every review phase the data can be in", () => {
    for (const ns of [cs, en]) {
      for (const phase of ["allPending", "mixed", "allDecided"]) {
        expect(ns[`real.review.${phase}`], phase).toBeTruthy();
        expect(ns[`real.graph.${phase}`], `graph.${phase}`).toBeTruthy();
      }
      // …and it cites where the counts come from, like every other rendered figure.
      expect(ns["real.review.source"]).toBeTruthy();
    }
  });

  it("the mock graph footer no longer certifies its own sample edges", () => {
    // `graph.allEdgesVerified` used to render „● všechny hrany datované + doložené" in
    // the CONFIRMED colour, over invented edges, beside a real graph whose whole point
    // is that nothing is confirmed until a human says so.
    expect(cs["graph.allEdgesVerified"]).toBeUndefined();
    expect(cs["graph.sampleNotice"]).toContain("ukázková data");
    expect(en["graph.sampleNotice"]).toContain("sample data");
  });

  it("the lower-bound explainer is reachable copy, not a dead key", () => {
    // It sat unused in both catalogs while the "nejméně" prefix rendered without it.
    expect(placeholders(cs["real.stats.reachableSubCapped"])).toEqual(["cap", "companies"]);
    expect(placeholders(en["real.stats.reachableSubCapped"])).toEqual(["cap", "companies"]);
  });
});
