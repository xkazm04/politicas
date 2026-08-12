// Vestavný widget (moonshot 7B) — bezpečnost parametru a poctivost stavů:
// surový ?vahy= se do markup NIKDY neotiskne, data z grafu se escapují,
// neplatný vektor je 400 a KAŽDÝ stav nese citaci zdroje.

import { describe, expect, it } from "vitest";

import { componentDefs } from "@/features/civicscore/componentDefs";
import type { ComponentKey, LeaderboardData, LeaderboardListEntry } from "@/features/civicscore/getLeaderboardData";
import type { ContributionProvenance } from "@/features/civicscore/provenance";
import { LENS_PRESETS } from "@/features/civicscore/lens";
import { buildEmbedHtml, escapeHtml } from "./embed";
import { serializeWeights } from "./aggregate";
import type { StandingsInput } from "./ogPayload";

// Zveřejněné složkové definice — IMPORTOVANÉ, ne přepsané. Šest labelů a šest
// citací tu dřív stálo jako literály ve třech fixtures; změna jednoho labelu je
// tiše rozešla s produktem, protože fixture nikdy neporovnávala svůj text s jeho.
const COMPONENTS: LeaderboardData["components"] = componentDefs();

function mk(name: string, pspId: number, score: number): LeaderboardListEntry {
  const components = Object.fromEntries(
    COMPONENTS.map((c) => [c.key, 0]),
  ) as Record<ComponentKey, number>;
  return {
    pspId,
    rank: pspId,
    name,
    clubAbbrev: "X<b>",
    clubName: "X",
    clubColor: "steel", // fixture — nikdy se nekreslí
    region: null,
    score,
    tiedCount: 1,
    components,
    effortWorkhorse: false,
    effortWorkhorseFlavour: null,
    effortRapporteurLoad: 0,
    effortHasDossier: false,
  effortLowScoreReason: null,
  effortRecordedAt: null,
  duelFacts: {
    speechTurns: null,
    amendmentsAuthored: null,
    interpellations: null,
    rapporteurLoad: null,
    tenureClass: null,
  },
  };
}

/** Komora, která se shodne na jednom průchodu i jednom dni přepočtu. */
const UNIFORM: ContributionProvenance = {
  state: "uniform",
  pass: 42,
  ref: "contribution-committee-dedupe",
  computedAt: "2026-08-04",
  distinctCount: 1,
  variants: [{ pass: 42, ref: "contribution-committee-dedupe", count: 2 }],
  covered: 2,
  total: 2,
  declaredRef: "contribution-committee-dedupe",
  formulaMatch: true,
};

/** Půlkou přepočtená komora — jeden den ani jeden průchod z ní nevypadne. */
const MIXED: ContributionProvenance = {
  ...UNIFORM,
  state: "mixed",
  pass: null,
  ref: null,
  computedAt: null,
  distinctCount: 2,
  variants: [
    { pass: 42, ref: "contribution-committee-dedupe", count: 1 },
    { pass: 11, ref: "contribution", count: 1 },
  ],
};

const ENTRIES = [mk('Zlá <script>alert("x")</script> & spol.', 1, 90), mk("Beneš", 2, 50)];
const DATA: StandingsInput = { entries: ENTRIES, components: COMPONENTS, provenance: UNIFORM };
const BASE = { origin: "https://politicas.example", generatedAt: "2026-07-31T00:00:00.000Z" };

describe("buildEmbedHtml — bezpečnost parametru", () => {
  it("neplatný vektor → 400 a surová hodnota se v markup NEOBJEVÍ (ani escapovaná)", () => {
    const raw = '"><img src=x onerror=alert(1)>';
    const { html, status } = buildEmbedHtml({ data: DATA, rawVahy: raw, ...BASE });
    expect(status).toBe(400);
    expect(html).not.toContain(raw);
    expect(html).not.toContain(escapeHtml(raw));
    expect(html).not.toContain("onerror");
    expect(html).toContain("Neplatné váhy");
  });

  it("jména a kluby z grafu se escapují — obranná hloubka", () => {
    const { html, status } = buildEmbedHtml({ data: DATA, rawVahy: null, ...BASE });
    expect(status).toBe(200);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("X&lt;b&gt;");
  });

  it("žádný <script> v celém dokumentu — widget je bez chování", () => {
    const vec = serializeWeights(LENS_PRESETS[0].weights);
    for (const rawVahy of [null, vec]) {
      const { html } = buildEmbedHtml({ data: DATA, rawVahy, ...BASE });
      expect(html).not.toMatch(/<script\b/i);
    }
  });
});

describe("buildEmbedHtml — poctivé stavy + citace", () => {
  const vec = serializeWeights(LENS_PRESETS[0].weights);

  it("bez parametru: zveřejněná metodika, autoritativní skóre, citace na /zebricek", () => {
    const { html } = buildEmbedHtml({ data: DATA, rawVahy: null, ...BASE });
    expect(html).toContain("zveřejněná metodika");
    expect(html).not.toContain("váš index");
    expect(html).toContain("https://politicas.example/zebricek");
    expect(html).toContain("zdroj:");
  });

  it("s čočkou: kobaltový pruh s kanonickým vektorem + odkaz nese ?vahy=", () => {
    const { html, status } = buildEmbedHtml({ data: DATA, rawVahy: vec, ...BASE });
    expect(status).toBe(200);
    expect(html).toContain(`váš index — váhy ${vec}`);
    expect(html).toContain("nejde o zveřejněnou metodiku");
    expect(html).toContain(`/zebricek?vahy=${vec}`);
  });

  it("bez dat: přiznaný výpadek, žádná náhradní čísla, citace zůstává", () => {
    const { html, status } = buildEmbedHtml({ data: null, rawVahy: null, ...BASE });
    expect(status).toBe(200);
    expect(html).toContain("není k dispozici");
    expect(html).toContain("zdroj:");
  });

  it("každý stav nese noindex", () => {
    for (const input of [
      { data: DATA, rawVahy: null },
      { data: DATA, rawVahy: vec },
      { data: DATA, rawVahy: "smetí" },
      { data: null, rawVahy: null },
    ]) {
      const { html } = buildEmbedHtml({ ...input, ...BASE });
      expect(html).toContain('name="robots" content="noindex"');
    }
  });
});

// Widget je jediná plocha politicas, která se vykresluje v CIZÍ redakci — a
// datoval se časem svého vysazení (`new Date()` route handleru), tedy dneškem
// nad daty z dávkového přepočtu. „Stav k" teď datuje DATA.
describe("buildEmbedHtml — „stav k“ datuje data, ne vysazení widgetu", () => {
  const vec = serializeWeights(LENS_PRESETS[0].weights);

  it("uniformní komora: datum přepočtu indexu + průchod, čas vysazení zvlášť a pojmenovaný", () => {
    for (const rawVahy of [null, vec]) {
      const { html } = buildEmbedHtml({ data: DATA, rawVahy, ...BASE });
      expect(html).toContain("stav k 4. 8. 2026");
      expect(html).toContain("přepočet indexu, průchod č. 42");
      expect(html).toContain("vysazeno 31. 7. 2026");
      // Datum vysazení se už nesmí vydávat za stav dat.
      expect(html).not.toContain("stav k 31. 7. 2026");
    }
  });

  it("komora bez jednoho dne přepočtu (mixed) datum nehádá — a ani průchod", () => {
    const { html } = buildEmbedHtml({ data: { ...DATA, provenance: MIXED }, rawVahy: null, ...BASE });
    expect(html).toContain("datum přepočtu indexu graf neuvádí jednotně");
    expect(html).toContain("vysazeno 31. 7. 2026");
    expect(html).not.toContain("stav k");
    expect(html).not.toContain("průchod č.");
  });

  it("chybějící provenience se chová jako neuvedená, ne jako dnešek", () => {
    const { html } = buildEmbedHtml({
      data: { entries: ENTRIES, components: COMPONENTS },
      rawVahy: null,
      ...BASE,
    });
    expect(html).toContain("datum přepočtu indexu graf neuvádí jednotně");
    expect(html).not.toContain("stav k");
  });

  it("bez žebříčku i při neplatném vektoru zůstává citace a poctivé datum", () => {
    for (const input of [
      { data: null, rawVahy: null },
      { data: DATA, rawVahy: "smetí" },
    ]) {
      const { html } = buildEmbedHtml({ ...input, ...BASE });
      expect(html).toContain("zdroj:");
      expect(html).toContain("vysazeno 31. 7. 2026");
    }
    // Neplatný vektor nemá s žebříčkem co dělat — datum přepočtu se u něj
    // vypisuje dál, protože data jsou k dispozici; chybný je parametr.
    expect(buildEmbedHtml({ data: DATA, rawVahy: "smetí", ...BASE }).html).toContain("stav k 4. 8. 2026");
    expect(buildEmbedHtml({ data: null, rawVahy: null, ...BASE }).html).toContain(
      "datum přepočtu indexu graf neuvádí jednotně",
    );
  });
});
