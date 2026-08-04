import { describe, expect, it } from "vitest";

import { buildPosterCitation } from "@/features/shared/poster/citation";
import type { ComponentKey, LeaderboardData, LeaderboardListEntry } from "./getLeaderboardData";
import {
  KRAJ_NEUVEDEN_LABEL,
  KRAJ_NEUVEDEN_SLUG,
  KRAJ_SOURCE_LABEL,
  krajCitationInput,
  krajSlate,
  krajSlug,
  listKraje,
} from "./kraj";
import { PUBLISHED_WEIGHTS, reweigh, type WeightVector } from "./lens";

// ── fixtures ────────────────────────────────────────────────────────────────

const COMPONENTS: LeaderboardData["components"] = [
  { key: "participation", weight: 25, label: "Účast při hlasování", source: "psp.cz" },
  { key: "committee", weight: 20, label: "Práce ve výborech", source: "psp.cz" },
  { key: "legislative", weight: 20, label: "Legislativní výstup", source: "psp.cz" },
  { key: "speech", weight: 15, label: "Vystoupení v sále", source: "psp.cz" },
  { key: "attendance", weight: 10, label: "Docházka", source: "psp.cz" },
  { key: "leadership", weight: 10, label: "Vedení orgánů", source: "psp.cz" },
];

const FULL: Record<ComponentKey, number> = {
  participation: 25, committee: 20, legislative: 20, speech: 15, attendance: 10, leadership: 10,
};
const ATTEND_ONLY: Record<ComponentKey, number> = {
  participation: 25, committee: 0, legislative: 0, speech: 0, attendance: 10, leadership: 0,
};
const LEGIS_ONLY: Record<ComponentKey, number> = {
  participation: 0, committee: 0, legislative: 20, speech: 15, attendance: 0, leadership: 0,
};

function mk(
  name: string,
  pspId: number,
  region: string | null,
  score: number,
  rank: number,
  components: Record<ComponentKey, number> = FULL,
): LeaderboardListEntry {
  return {
    pspId,
    rank,
    name,
    clubAbbrev: "X",
    clubName: "X",
    clubColor: "steel", // fixture — nikdy se nekreslí
    region,
    score,
    tiedCount: 1,
    components,
    effortWorkhorse: false,
    effortWorkhorseFlavour: null,
    effortRapporteurLoad: 0,
    effortHasDossier: false,
    effortLowScoreReason: null,
    effortLowScoreRecordedAt: null,
    duelFacts: {
      speechTurns: null,
      amendmentsAuthored: null,
      interpellations: null,
      rapporteurLoad: null,
      tenureClass: null,
    },
  };
}

// Žebříček už seřazený (skóre sestupně) — tak ho posílá loader i reweigh().
const ENTRIES: LeaderboardListEntry[] = [
  mk("Adamová", 1, "Jihomoravský kraj", 90, 1, FULL),
  mk("Beneš", 2, "Praha", 80, 2, ATTEND_ONLY),
  mk("Cibulka", 3, "Jihomoravský kraj", 70, 3, LEGIS_ONLY),
  mk("Dvořák", 4, "Jihomoravský kraj", 70, 3, ATTEND_ONLY),
  mk("Eliáš", 5, "Vysočina", 60, 5, LEGIS_ONLY),
  mk("Fiala", 6, null, 50, 6, ATTEND_ONLY),
];

const w = (v: Partial<WeightVector>): WeightVector => ({ ...PUBLISHED_WEIGHTS, ...v });

// ── slug ────────────────────────────────────────────────────────────────────

describe("krajSlug — permanent address of a kraj", () => {
  it("strips diacritics and the generic ' kraj' suffix", () => {
    expect(krajSlug("Jihomoravský kraj")).toBe("jihomoravsky");
    expect(krajSlug("Středočeský kraj")).toBe("stredocesky");
    expect(krajSlug("Praha")).toBe("praha");
    expect(krajSlug("Vysočina")).toBe("vysocina");
    expect(krajSlug("Moravskoslezský kraj")).toBe("moravskoslezsky");
  });

  it("is deterministic and URL-safe", () => {
    expect(krajSlug("Královéhradecký kraj")).toBe(krajSlug("Královéhradecký kraj"));
    expect(krajSlug("Hlavní město Praha")).toMatch(/^[a-z0-9-]+$/);
  });
});

// ── rozcestník ──────────────────────────────────────────────────────────────

describe("listKraje — grouping from mandates", () => {
  it("groups by region with counts, Czech alphabetical order", () => {
    const kraje = listKraje(ENTRIES);
    expect(kraje.map((k) => k.label)).toEqual([
      "Jihomoravský kraj",
      "Praha",
      "Vysočina",
      KRAJ_NEUVEDEN_LABEL,
    ]);
    expect(kraje.find((k) => k.slug === "jihomoravsky")?.count).toBe(3);
    expect(kraje.find((k) => k.slug === "praha")?.count).toBe(1);
  });

  it("puts the honest 'kraj neuveden' bucket last, flagged, only when non-empty", () => {
    const kraje = listKraje(ENTRIES);
    const last = kraje.at(-1)!;
    expect(last.slug).toBe(KRAJ_NEUVEDEN_SLUG);
    expect(last.unassigned).toBe(true);
    expect(last.count).toBe(1);

    const withoutNull = listKraje(ENTRIES.filter((e) => e.region !== null));
    expect(withoutNull.some((k) => k.unassigned)).toBe(false);
  });
});

// ── karta ───────────────────────────────────────────────────────────────────

describe("krajSlate — the ballot-card slice of the leaderboard", () => {
  it("filters by slug, keeps incoming order, carries national ranks unchanged", () => {
    const slate = krajSlate(ENTRIES, "jihomoravsky")!;
    expect(slate.label).toBe("Jihomoravský kraj");
    expect(slate.rows.map((r) => r.name)).toEqual(["Adamová", "Cibulka", "Dvořák"]);
    expect(slate.rows.map((r) => r.rank)).toEqual([1, 3, 3]);
    expect(slate.totalMps).toBe(6);
  });

  it("numbers the kraj rank with competition ranking (1, 2, 2) and counts ties", () => {
    const slate = krajSlate(ENTRIES, "jihomoravsky")!;
    expect(slate.rows.map((r) => r.krajRank)).toEqual([1, 2, 2]);
    expect(slate.rows.map((r) => r.krajTiedCount)).toEqual([1, 2, 2]);
  });

  it("computes the kraj average to one decimal", () => {
    const slate = krajSlate(ENTRIES, "jihomoravsky")!;
    expect(slate.avgScore).toBe(76.7); // (90+70+70)/3 = 76,666…
  });

  it("serves the 'neuveden' bucket by its own slug and label", () => {
    const slate = krajSlate(ENTRIES, KRAJ_NEUVEDEN_SLUG)!;
    expect(slate.unassigned).toBe(true);
    expect(slate.label).toBe(KRAJ_NEUVEDEN_LABEL);
    expect(slate.rows.map((r) => r.name)).toEqual(["Fiala"]);
  });

  it("returns null for an unknown slug — an honest 404, never a guess", () => {
    expect(krajSlate(ENTRIES, "atlantida")).toBeNull();
    expect(krajSlate(ENTRIES.filter((e) => e.region !== null), KRAJ_NEUVEDEN_SLUG)).toBeNull();
  });

  it("does not mutate its input", () => {
    const before = JSON.parse(JSON.stringify(ENTRIES));
    krajSlate(ENTRIES, "jihomoravsky");
    expect(ENTRIES).toEqual(before);
  });
});

// ── průchod čočky ───────────────────────────────────────────────────────────

describe("lens passthrough — the card slices the REWEIGHED leaderboard", () => {
  it("kraj slate over reweigh() carries lens scores and lens national ranks", () => {
    // Čočka jen docházka+účast: Cibulka (legislativa) padá pod Dvořáka.
    const lensOnly = w({ participation: 50, committee: 0, legislative: 0, speech: 0, attendance: 50, leadership: 0 });
    const view = reweigh(ENTRIES, COMPONENTS, lensOnly);
    const slate = krajSlate(view.entries, "jihomoravsky")!;

    expect(slate.rows.map((r) => r.name)).toEqual(["Adamová", "Dvořák", "Cibulka"]);
    // Skóre pochází z čočky (Cibulka má pod ní 0,0), nikdy směs s oficiálním.
    expect(slate.rows.at(-1)!.score).toBe(0);
    // Celostátní příčka je příčka POD ČOČKOU (z reweigh), nese se beze změny.
    const national = new Map(view.entries.map((e) => [e.pspId, e.rank]));
    for (const r of slate.rows) expect(r.rank).toBe(national.get(r.pspId));
    // Krajská příčka se čísluje až nad výřezem — Adamová a Dvořák pod touto
    // čočkou sdílí 100,0, competition ranking tedy dává (1, 1, 3).
    expect(slate.rows.map((r) => r.krajRank)).toEqual([1, 1, 3]);
    expect(slate.rows.map((r) => r.krajTiedCount)).toEqual([2, 2, 1]);
  });

  it("membership in a kraj is identity, not score — the same MPs under any lens", () => {
    const view = reweigh(ENTRIES, COMPONENTS, w({ speech: 100 }));
    const official = krajSlate(ENTRIES, "jihomoravsky")!;
    const lensed = krajSlate(view.entries, "jihomoravsky")!;
    expect(new Set(lensed.rows.map((r) => r.pspId))).toEqual(new Set(official.rows.map((r) => r.pspId)));
  });
});

// ── citace ──────────────────────────────────────────────────────────────────

describe("krajCitationInput — the card reuses the canonical citation lines", () => {
  const base = {
    liveUrl: "https://politicas.cz/kraj/jihomoravsky/",
    retrievedAt: "2026-07-30",
    provenancePass: 42,
    weights: { ...PUBLISHED_WEIGHTS },
  };

  it("builds through buildPosterCitation with the shared source label", () => {
    const c = buildPosterCitation(krajCitationInput(base));
    expect(c.sourceLine).toBe(`zdroj: ${KRAJ_SOURCE_LABEL}`);
    expect(c.retrievedLine).toContain("30. 7. 2026");
    expect(c.liveLine).toBe("živá verze: politicas.cz/kraj/jihomoravsky");
    expect(c.methodologyLine).toContain("výpočetní pas 42");
  });

  it("published weights cite the published methodology, without any weight vector", () => {
    const c = buildPosterCitation(krajCitationInput(base));
    expect(c.methodologyLine).toContain("publikovanou vahou 25/20/20/15/10/10");
    expect(c.methodologyLine).not.toContain("VLASTNÍ ČOČKA");
  });

  it("a custom lens bakes its weight vector into the printed methodology line", () => {
    const weights = w({ attendance: 45, participation: 5 });
    const c = buildPosterCitation(krajCitationInput({ ...base, weights }));
    expect(c.methodologyLine).toContain("VLASTNÍ ČOČKA ČTENÁŘE");
    expect(c.methodologyLine).toContain("5-20-20-15-45-10");
    expect(c.methodologyLine).toContain("nejde o zveřejněnou metodiku");
  });
});
