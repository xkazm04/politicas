import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sourceLinksFor } from "@/lib/kg/sourceLinks";
import { BILL_ORIGIN_ORDER, citationRef, esbirkaUrl, pspBillUrl } from "./lawwatchLabels";
import { BILL_ORIGINS } from "./lawTypes";

/* The small formatters every LawWatch surface shares. Two of them are hand mirrors of
 * lib/kg/sourceLinks.ts (the psp.cz history address and the e-Sbírka statute address) and
 * were held to it by a comment; these tests hold them by comparison. */

describe("pspBillUrl / esbirkaUrl mirror lib/kg/sourceLinks", () => {
  it("the bill history address is the one sourceLinksFor builds", () => {
    const [link] = sourceLinksFor({ kind: "bill", id: "bill:tisk:43233", label: "t", props: { cislo: 121 } });
    expect(pspBillUrl(121)).toBe(link.url);
    expect(pspBillUrl(null)).toBeNull();
  });

  it("the statute address is the one sourceLinksFor builds", () => {
    const [link] = sourceLinksFor({ kind: "law", id: "law:sb:586-1992", label: "t", props: { ref: "586/1992" } });
    expect(esbirkaUrl("586/1992")).toBe(link.url);
    expect(esbirkaUrl("č. 586/1992 Sb.")).toBe(link.url);
    expect(esbirkaUrl("nonsense")).toBeNull();
  });
});

describe("BILL_ORIGIN_ORDER — the display order covers exactly the origin vocabulary", () => {
  it("is a permutation of BILL_ORIGINS", () => {
    expect([...BILL_ORIGIN_ORDER].sort()).toEqual([...BILL_ORIGINS].sort());
    expect(BILL_ORIGIN_ORDER[0]).toBe("government");
  });

  it("LawWatchPage and BillBrowser read it instead of spelling their own", () => {
    for (const f of ["features/lawwatch/LawWatchPage.tsx", "features/lawwatch/components/BillBrowser.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(/\bBILL_ORIGIN_ORDER\b/);
      expect(src, f).not.toMatch(/\["government", "mp_group", "mp", "senate", "other"\]/);
    }
  });
});

describe("citationRef — a reference is a formatted link, never a serialized object", () => {
  it("psp.cz URLs name the print", () => {
    const r = citationRef("web", "https://www.psp.cz/sqw/historie.sqw?o=10&t=121");
    expect(r).toEqual({ registry: "psp.cz", label: "sněmovní tisk 121", url: "https://www.psp.cz/sqw/historie.sqw?o=10&t=121" });
  });
  it("a bill_text URL without a print number is labelled as the text", () => {
    expect(citationRef("bill_text", "https://www.psp.cz/sqw/text/orig2.sqw?idd=1").label).toBe("text tisku");
  });
  it("an unknown host is labelled by its host", () => {
    expect(citationRef("web", "https://www.example.org/x").registry).toBe("example.org");
  });
  it("a law citation resolves to e-Sbírka", () => {
    expect(citationRef("law", "586/1992")).toEqual({ registry: "e-Sbírka", label: "zákon č. 586/1992 Sb.", url: esbirkaUrl("586/1992") });
  });
  it("graph facts are readable identifiers without a link", () => {
    expect(citationRef("graph_fact", "company:ico:26185610")).toEqual({ registry: "graf", label: "firma IČO 26185610", url: null });
    expect(citationRef("graph_fact", "law:sb:586-1992").label).toBe("zákon č. 586/1992 Sb.");
    expect(citationRef("graph_fact", "theme:economy").label).toBe("theme:economy");
  });
});

describe("one parser of the law node id", () => {
  it("getLawData.ts derives a ref from a law urn through statuteRef, not its own replace()", () => {
    const src = readFileSync("features/lawwatch/getLawData.ts", "utf8");
    expect(src).toMatch(/refFromLawNodeId\(/);
    expect(src).not.toMatch(/replace\(\/\^law:sb:\/, ""\)\.replace\("-", "\/"\)/);
  });
  it("CollisionsPage.tsx links the print through lawwatchLabels.pspBillUrl", () => {
    const src = readFileSync("features/lawwatch/CollisionsPage.tsx", "utf8");
    expect(src).not.toMatch(/^const pspBillUrl = /m);
    expect(src).toMatch(/import \{[^}]*\bpspBillUrl\b[^}]*\} from "\.\/lawwatchLabels"/);
  });
});
