// Vestavný widget (moonshot 7B) — bezpečnost parametru a poctivost stavů:
// surový ?vahy= se do markup NIKDY neotiskne, data z grafu se escapují,
// neplatný vektor je 400 a KAŽDÝ stav nese citaci zdroje.

import { describe, expect, it } from "vitest";

import type { ComponentKey, LeaderboardData, LeaderboardListEntry } from "@/features/civicscore/getLeaderboardData";
import { LENS_PRESETS } from "@/features/civicscore/lens";
import { buildEmbedHtml, escapeHtml } from "./embed";
import { serializeWeights } from "./aggregate";
import type { StandingsInput } from "./ogPayload";

const COMPONENTS: LeaderboardData["components"] = [
  { key: "participation", weight: 25, label: "Účast při hlasování", source: "psp.cz" },
  { key: "committee", weight: 20, label: "Práce ve výborech", source: "psp.cz" },
  { key: "legislative", weight: 20, label: "Legislativní výstup", source: "psp.cz" },
  { key: "speech", weight: 15, label: "Vystoupení v sále", source: "psp.cz" },
  { key: "attendance", weight: 10, label: "Docházka", source: "psp.cz" },
  { key: "leadership", weight: 10, label: "Vedení orgánů", source: "psp.cz" },
];

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
  };
}

const DATA: StandingsInput = {
  entries: [mk('Zlá <script>alert("x")</script> & spol.', 1, 90), mk("Beneš", 2, 50)],
  components: COMPONENTS,
};
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

  it("každý stav nese noindex a datum stavu", () => {
    for (const input of [
      { data: DATA, rawVahy: null },
      { data: DATA, rawVahy: vec },
      { data: DATA, rawVahy: "smetí" },
      { data: null, rawVahy: null },
    ]) {
      const { html } = buildEmbedHtml({ ...input, ...BASE });
      expect(html).toContain('name="robots" content="noindex"');
      expect(html).toContain("stav k 31. 7. 2026");
    }
  });
});
