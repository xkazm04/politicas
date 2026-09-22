import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Source-grep guards for Volby: zrcadlo (scan-sweep 2026-09-07, volby-election-mirror). */

const src = (p: string) => readFileSync(p, "utf8");

describe("volbyLoader reads the person urn through lib/ingest/changeEvents", () => {
  it("imports pspIdFromNodeId and holds no local psp:person regex", () => {
    const s = src("features/volby/volbyLoader.ts");
    expect(s).toMatch(/import \{ pspIdFromNodeId \} from "@\/lib\/ingest\/changeEvents"/);
    expect(s).not.toMatch(/\^psp:person:/);
  });
});

describe("/metodika explains every rule a finding can link to", () => {
  it("MetodikaVolbySection derives its list from RULE_REF, not a hand copy", () => {
    const s = src("features/civicscore/MetodikaVolbySection.tsx");
    expect(s).toMatch(/Object\.keys\(RULE_REF\)/);
    expect(s).not.toMatch(/const RULE_KINDS = \[/);
  });
  for (const locale of ["cs", "en"] as const) {
    it(`${locale}: every RULE_REF kind has a metodika title and rule sentence`, async () => {
      const { RULE_REF } = await import("@/lib/analysis/volby/rules");
      const catalog = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as { metodika: Record<string, string> };
      for (const kind of Object.keys(RULE_REF)) {
        expect(typeof catalog.metodika[`volbyRule_${kind}_title`], `${kind} title`).toBe("string");
        expect(typeof catalog.metodika[`volbyRule_${kind}_rule`], `${kind} rule`).toBe("string");
      }
    });
  }
});

describe("VolbyPage looks a kraj up by IČO through krajByIco", () => {
  it("imports krajByIco and does not scan KRAJ_CROSSWALK by hand", () => {
    const s = src("features/volby/VolbyPage.tsx");
    expect(s).toMatch(/krajByIco/);
    expect(s).not.toMatch(/KRAJ_CROSSWALK\.find/);
  });
});

describe("ListPage pins the kraj's members by the rule the loader sorted them with", () => {
  it("compares region to regionLabelFromPspName(pinned.pspLabel), no slug-or-label pair", () => {
    const s = src("features/volby/ListPage.tsx");
    expect(s).toMatch(/regionLabelFromPspName\(pinned\.pspLabel\)/);
    expect(s).not.toMatch(/krajSlug\(m\.region\) === pinned\.slug/);
  });
});

describe("/volby/snemovna/[slug] reads ?kraj= through lib/routing/searchParam", () => {
  it("imports firstParam and keeps no Array.isArray(raw) copy", () => {
    const s = src("app/volby/snemovna/[slug]/page.tsx");
    expect(s).toMatch(/import \{ firstParam \} from "@\/lib\/routing\/searchParam"/);
    expect(s).not.toMatch(/Array\.isArray\(raw\)/);
  });
});

describe("the obec IČO shape is one export", () => {
  it("getObecData exports isObecIco and the route reads it", () => {
    expect(src("features/volby/getObecData.ts")).toMatch(/export const isObecIco/);
    const route = src("app/volby/obec/[ico]/page.tsx");
    expect(route).toMatch(/isObecIco/);
    expect(route).not.toMatch(/const ICO = /);
  });
});
