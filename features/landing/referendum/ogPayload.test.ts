// Karta referenda (moonshot 7B) — odvození pro OG obraz / widget / náhled:
// průchod kodekem čočky (neplatné se odmítá, zveřejněné je oficiální),
// top-N pod čočkou jde VÝHRADNĚ přes reweigh() a otisk vah je efektivní.

import { describe, expect, it } from "vitest";

import type { ComponentKey, LeaderboardData, LeaderboardListEntry } from "@/features/civicscore/getLeaderboardData";
import { effectiveWeights, LENS_PRESETS, reweigh, type WeightVector } from "@/features/civicscore/lens";
import { deriveReferendumCard, type StandingsInput } from "./ogPayload";
import { serializeWeights } from "./aggregate";

// ── fixtures (zrcadlí features/civicscore/lens.test.ts) ─────────────────────

const COMPONENTS: LeaderboardData["components"] = [
  { key: "participation", weight: 25, label: "Účast při hlasování", source: "psp.cz" },
  { key: "committee", weight: 20, label: "Práce ve výborech", source: "psp.cz" },
  { key: "legislative", weight: 20, label: "Legislativní výstup", source: "psp.cz" },
  { key: "speech", weight: 15, label: "Vystoupení v sále", source: "psp.cz" },
  { key: "attendance", weight: 10, label: "Docházka", source: "psp.cz" },
  { key: "leadership", weight: 10, label: "Vedení orgánů", source: "psp.cz" },
];

function mk(name: string, pspId: number, components: Record<ComponentKey, number>, score: number): LeaderboardListEntry {
  return {
    pspId,
    rank: pspId,
    name,
    clubAbbrev: "X",
    clubName: "X",
    clubColor: "steel", // fixture — nikdy se nekreslí (lint: žádné literální hexy)
    region: null,
    score,
    tiedCount: 1,
    components,
    effortWorkhorse: false,
    effortWorkhorseFlavour: null,
    effortRapporteurLoad: 0,
    effortHasDossier: false,
  effortLowScoreReason: null,
  effortLowScoreRecordedAt: null,
  };
}

// A vede oficiálně; C jen legislativa+sál — pod čočkou „Zákonodárce" přeskočí B.
const A = mk("Adamová", 1, { participation: 25, committee: 20, legislative: 20, speech: 15, attendance: 10, leadership: 10 }, 100);
const B = mk("Beneš", 2, { participation: 25, committee: 0, legislative: 0, speech: 0, attendance: 10, leadership: 0 }, 35);
const C = mk("Cibulka", 3, { participation: 0, committee: 0, legislative: 20, speech: 15, attendance: 0, leadership: 0 }, 35);

const DATA: StandingsInput = { entries: [A, B, C], components: COMPONENTS };
const ZAKONODARCE: WeightVector = LENS_PRESETS.find((p) => p.id === "zakonodarce")!.weights;

describe("deriveReferendumCard — průchod kodekem", () => {
  it("neplatný vektor → invalid; nic se neopravuje, ani při chybějících datech", () => {
    expect(deriveReferendumCard(DATA, "nesmysl").kind).toBe("invalid");
    expect(deriveReferendumCard(DATA, "25-20-20").kind).toBe("invalid");
    // invalid má přednost i před nodata — chybný parametr je chybný vždy.
    expect(deriveReferendumCard(null, "nesmysl").kind).toBe("invalid");
  });

  it("bez parametru / s explicitně zveřejněným vektorem → OFICIÁLNÍ index (autoritativní skóre, žádný přepočet)", () => {
    for (const raw of [null, undefined, "", "25-20-20-15-10-10"]) {
      const card = deriveReferendumCard(DATA, raw);
      expect(card.kind).toBe("official");
      if (card.kind === "official") {
        expect(card.top.map((r) => r.name)).toEqual(["Adamová", "Beneš", "Cibulka"]);
        expect(card.top[0].score).toBe(100); // contribution_score z grafu, ne přepočet
        expect(card.count).toBe(3);
      }
    }
  });

  it("chybějící žebříček bez chybného parametru → nodata (poctivé přiznání)", () => {
    expect(deriveReferendumCard(null, null).kind).toBe("nodata");
    expect(deriveReferendumCard(null, "40-5-10-5-35-5").kind).toBe("nodata");
  });
});

describe("deriveReferendumCard — čočka", () => {
  const vec = serializeWeights(ZAKONODARCE);

  it("top-N je přesně reweigh() nad týmiž vstupy — žádná druhá matematika", () => {
    const card = deriveReferendumCard(DATA, vec, 3);
    expect(card.kind).toBe("lens");
    if (card.kind !== "lens") return;
    const view = reweigh(DATA.entries, DATA.components, ZAKONODARCE);
    expect(card.top).toEqual(
      view.entries.slice(0, 3).map((e) => ({
        rank: e.rank,
        tiedCount: e.tiedCount,
        name: e.name,
        clubAbbrev: e.clubAbbrev,
        score: e.score,
      })),
    );
    // Čočka mění pořadí: legislativní profil C předběhne B.
    expect(card.top.map((r) => r.name).indexOf("Cibulka")).toBeLessThan(
      card.top.map((r) => r.name).indexOf("Beneš"),
    );
    expect(card.vector).toBe(vec);
  });

  it("otisk vah nese EFEKTIVNÍ váhy (součet 100, desetiny) v pořadí složek", () => {
    const card = deriveReferendumCard(DATA, vec);
    expect(card.kind).toBe("lens");
    if (card.kind !== "lens") return;
    const eff = effectiveWeights(ZAKONODARCE);
    expect(card.fingerprint.map((f) => f.key)).toEqual(COMPONENTS.map((c) => c.key));
    for (const f of card.fingerprint) expect(f.eff).toBe(eff[f.key]);
  });

  it("topN se ořezává na rozumné meze", () => {
    expect(deriveReferendumCard(DATA, vec, 0).kind).toBe("lens");
    const one = deriveReferendumCard(DATA, vec, 1);
    if (one.kind === "lens") expect(one.top).toHaveLength(1);
  });
});
