// The four /volby loaders against ONE PGlite fixture (one boot — lib/testing/loaders.test.ts
// documents why store-booting files are consolidated: boots contend across workers).
//
// What is pinned: (1) a dark store degrades to `null` WITH a trace, never to a 404;
// (2) an empty tender layer is a named empty state — census rows at zero, `latest: []` —
// not null; (3) an ico the registry does not know is `not-found`, and a registry obec
// with no lot in the corpus gets a CARD with `ledger.total === 0`; (4) the current-holder
// signal is the open chamber membership — a replaced MP's mandate is not counted as a
// seat; (5) the contested record is read for the 12 roll calls only and lined per list.

import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { pgliteFixtureDir } from "@/lib/testing/pglite-fixture";

// Isolated data dir, set BEFORE anything that calls open() is imported.
const dataDir = pgliteFixtureDir("politicas-volby-");

const { open } = await import("@/lib/db/pglite/internals");
const { getStore } = await import("@/lib/db/store");
const { getRegistry } = await import("@/features/budget/mirrorData");
const { getVolbyHomeData } = await import("./getVolbyHomeData");
const { getObecData } = await import("./getObecData");
const { getKrajData } = await import("./getKrajData");
const { getListData } = await import("./getListData");
const { loadTenderLayer, resetTenderLayerMemo } = await import("./tenderLayer");
const { chamberForVolby, resetVolbyMemos } = await import("./volbyLoader");
const { resetLeaderboardMemo } = await import("@/features/civicscore/getLeaderboardData");

const PRAHA_KRAJ_ICO = "00064581"; // KRAJ_CROSSWALK row "praha"
const LIST_SPOLU = 1533;
const COUNTERS = {
  participation_rate: 0.9,
  absence_rate: 0.1,
  committee_count: 2,
  leadership_count: 1,
  bills_authored: 1,
  interpellations: 1,
  speech_turns: 10,
  contribution_provenance: { pass: 30 },
};

afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

async function resetMemos() {
  const store = await getStore();
  if (store) {
    resetTenderLayerMemo(store);
    resetVolbyMemos(store);
  }
  resetLeaderboardMemo();
}

describe("cold start — an empty store is an OUTAGE, not a 404", () => {
  it("every loader returns null and the readiness gate leaves a trace", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await getVolbyHomeData()).toBeNull();
      expect(await getObecData(getRegistry()[0].ic)).toBeNull();
      expect(await getKrajData("praha")).toBeNull();
      expect(await getListData("spolu")).toBeNull();
      expect(spy.mock.calls.map((c) => String(c[0])).join("\n")).toContain("[loader:storeReady]");
    } finally {
      spy.mockRestore();
    }
  });

  it("a malformed or unknown ico / slug is not-found BEFORE the store is consulted", async () => {
    expect(await getObecData("x")).toEqual({ kind: "not-found" });
    expect(await getObecData("00000000")).toEqual({ kind: "not-found" });
    expect(await getKrajData("atlantis")).toEqual({ kind: "not-found" });
  });
});

describe("seeded chamber, empty tender layer", () => {
  beforeAll(async () => {
    process.env.KG_READINESS_OFF = "1";
    const pg = await open();
    await pg.query(
      `insert into organ (id, psp_id, parent_psp_id, organ_type_cz, abbrev, name_cz, name_norm, source, source_url, fetched_at)
       values
        ('o:174',  174,  null, 'Parlament', 'PSP10', 'Poslanecká sněmovna', 'psp10', 'psp.cz', 'https://psp.cz', now()),
        ('o:800',  800,  174,  'Klub',      'ODS',   'Klub ODS',            'ods',   'psp.cz', 'https://psp.cz', now()),
        ('o:900',  900,  null, 'Kraj',      null,    'Hlavní město Praha',  'praha', 'psp.cz', 'https://psp.cz', now()),
        ('o:1533', 1533, null, 'Strana',    null,    'Spolu',               'spolu', 'psp.cz', 'https://psp.cz', now())`,
    );
    // 100 holds the seat today; 200 was elected on the same list and REPLACED (closed chamber row).
    await pg.query(
      `insert into mandate (id, psp_id, person_psp_id, term_psp_id, term_code, region_psp_id, party_list_psp_id, source, source_url, fetched_at)
       values
        ('m:1000', 1000, 100, 174, 'PSP10', 900, 1533, 'psp.cz', 'https://psp.cz', now()),
        ('m:1001', 1001, 200, 174, 'PSP10', 900, 1533, 'psp.cz', 'https://psp.cz', now())`,
    );
    await pg.query(
      `insert into membership (id, person_psp_id, kind, target_psp_id, organ_psp_id, from_at, to_at, source, source_url, fetched_at)
       values
        ('ms:ch100', 100, 'member', 174, 174, '2025-10-04', null,         'psp.cz', 'https://psp.cz', now()),
        ('ms:cl100', 100, 'member', 800, 800, '2025-11-01', null,         'psp.cz', 'https://psp.cz', now()),
        ('ms:ch200', 200, 'member', 174, 174, '2025-10-04', '2026-02-04', 'psp.cz', 'https://psp.cz', now())`,
    );
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ('psp:person:100', 'person', 'Nováková Jana', $1::jsonb, 30, '{}'::jsonb),
        ('psp:person:200', 'person', 'Adamec Alois',  $2::jsonb, 30, '{}'::jsonb),
        ('bill:tisk:43222', 'bill', 'Novela zákona', $3::jsonb, 15, '{}'::jsonb),
        ('kg:company:ico:111', 'company', 'Alfa s.r.o.', '{"ico":"111"}'::jsonb, 30, '{}'::jsonb)`,
      [
        JSON.stringify({
          ...COUNTERS,
          contribution_score: 90,
          effort_workhorse: true,
          effort_rapporteur_load: 3,
          effort_provenance: { pass: 14, computedAt: "2026-07-24T17:41:34.737Z" },
        }),
        JSON.stringify({ ...COUNTERS, contribution_score: 80 }),
        JSON.stringify({
          forensic_severity: "medium",
          forensic_provenance: { pass: 15, computedAt: "2026-07-24T17:41:44.184Z" },
          flagged_conflict: true,
          sponsor_contract_czk: 150_000_000,
          sponsor_money_companies: 1,
          fate_sb: null,
        }),
      ],
    );
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values
        ('psp:person:100', 'sponsors',  'bill:tisk:43222',    null, '{"rank":1}'::jsonb, '{}'::jsonb),
        ('psp:person:200', 'sponsors',  'bill:tisk:43222',    null, '{"rank":2}'::jsonb, '{}'::jsonb),
        ('psp:person:100', 'linked_to', 'kg:company:ico:111', null, '{}'::jsonb,         '{}'::jsonb)`,
    );
    await pg.query(
      `insert into vote_event (id, psp_id, term_psp_id, term_code, kind, outcome, title_long, title_norm, voted_on, yes, no, voided, source, source_url, fetched_at)
       values
        ('v:1', 1, 174, 'PSP10', 'normal', 'prijato',   'Těsné hlasování',   'tesne',  '2026-03-01', 90, 88, false, 'psp.cz', 'https://psp.cz', now()),
        ('v:2', 2, 174, 'PSP10', 'normal', 'zamitnuto', 'Jednomyslné',       'jedno',  '2026-05-01', 150, 2, false, 'psp.cz', 'https://psp.cz', now()),
        ('v:3', 3, 174, 'PSP10', 'normal', 'zmatecne',  'Zmatečné, těsné',   'zmat',   '2026-05-02', 80, 80, true,  'psp.cz', 'https://psp.cz', now())`,
    );
    await pg.query(
      `insert into vote_ballot (id, vote_psp_id, mandate_psp_id, code, choice, source, source_url, fetched_at)
       values
        ('b:1', 1, 1000, 'A', 'yes', 'psp.cz', 'https://psp.cz', now()),
        ('b:2', 2, 1000, 'B', 'no',  'psp.cz', 'https://psp.cz', now()),
        ('b:3', 1, 1001, 'B', 'no',  'psp.cz', 'https://psp.cz', now())`,
    );
    await resetMemos();
  });

  it("home: census rows at zero and latest [] — an empty layer is a named state, not null", async () => {
    const home = (await getVolbyHomeData())!;
    expect(home).not.toBeNull();
    expect(home.census.map((c) => [c.arena, c.authorities, c.lots, c.czkFloor])).toEqual([
      ["komunalni", 0, 0, 0],
      ["krajske", 0, 0, 0],
      ["statni", 0, 0, 0],
      ["nejasne", 0, 0, 0],
    ]);
    // The chamber is seeded, so the MP-side findings are the ONLY latest entries.
    expect(home.latest.every((f) => f.subjectId.startsWith("person:"))).toBe(true);
    expect(home.provenance.counts["tender.tenders"]).toBe(0);
    expect(home.provenance.counts["chamber.current"]).toBe(1);
    expect(home.provenance.counts["chamber.currentHolderSignalFallback"]).toBe(0);
  });

  it("current holder = open chamber membership; the replaced MP is not a seat", async () => {
    const chamber = (await chamberForVolby((await getStore())!))!;
    expect(chamber.currentHolderSignal).toBe("chamber_membership_open");
    expect(chamber.mps.map((m) => [m.pspId, m.current, m.listSlug, m.clubAbbrev, m.moneyTieCount])).toEqual([
      [200, false, "spolu", null, 0],
      [100, true, "spolu", "ODS", 1],
    ]);
  });

  it("list: rolled up over current holders only, findings per member, contested lined per list", async () => {
    const res = await getListData("spolu", "praha");
    expect(res?.kind).toBe("ok");
    if (res?.kind !== "ok") return;
    const { list, card, members, contested, pinnedKraj } = res.data;
    expect(list).toMatchObject({ slug: "spolu", label: "Spolu", seats: 1, clubsToday: { ODS: 1 } });
    expect(members.map((m) => m.pspId)).toEqual([100]);
    const kinds = members[0].findings.map((f) => `${f.kind}/${f.severity}/${f.valence}`).sort();
    expect(kinds).toEqual([
      "effort_rapporteur/low/positive",
      "effort_workhorse/low/positive",
      "law_posudek/medium/negative",
      "law_sponsor_conflict/high/negative",
      "money_ties_unrated/low/unrated",
    ]);
    expect(list.ledger.total).toBe(4); // unrated never enters the total
    expect(list.ledger.counts.unrated.low).toBe(1);
    expect(list.ledger.baseline?.label).toContain("medián");
    expect(card).toMatchObject({ subjectId: `list:${LIST_SPOLU}`, ballot: "snemovni", href: "/volby/snemovna/spolu" });
    expect(card.timeline.map((f) => f.kind)).toEqual(["law_posudek"]); // the only dated later fact
    // the voided roll call is out; the closest one is first; the list's ballot decides the line
    expect(contested.map((c) => [c.votePspId, c.line])).toEqual([
      [1, "yes"],
      [2, "no"],
    ]);
    expect(contested[0].contestedness).toBeGreaterThan(contested[1].contestedness);
    expect(pinnedKraj).toBe("praha");
    const unpinned = await getListData("spolu", "atlantis");
    expect(unpinned?.kind === "ok" ? unpinned.data.pinnedKraj : "wrong-kind").toBeNull();
    expect(await getListData("nope")).toEqual({ kind: "not-found" });
  });

  it("obec: a registry obec with no lot gets a card with ledger.total 0 and the national nejasne count", async () => {
    const obec = getRegistry().find((m) => m.krajIndex === 0)!; // some obec of kraj CZ010
    const res = await getObecData(obec.ic);
    expect(res?.kind).toBe("ok");
    if (res?.kind !== "ok") return;
    expect(res.data.obec).toMatchObject({ ico: obec.ic, name: obec.name, krajSlug: "praha" });
    expect(res.data.komunalni).toMatchObject({
      subjectId: `company:ico:${obec.ic}`,
      ballot: "komunalni",
      href: `/volby/obec/${obec.ic}`,
      findings: [],
      timeline: [],
    });
    expect(res.data.komunalni?.ledger.total).toBe(0);
    expect(res.data.komunalni?.ledger.baseline?.source).toBe("claim:volby-census:flagged-share:komunalni");
    expect(res.data.unlinked).toEqual({ nejasneNational: 0, note: "nepropojeno" });
    expect(res.data.krajCard?.href).toBe("/volby/kraj/praha");
    expect(res.data.lists.map((l) => l.slug)).toEqual(["spolu"]);
  });
});

describe("seeded tender layer", () => {
  beforeAll(async () => {
    const pg = await open();
    await pg.query(
      `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
       values
        ('company:ico:${PRAHA_KRAJ_ICO}', 'company', 'Hlavní město Praha', $1::jsonb, 74, '{}'::jsonb),
        ('company:ico:55555555', 'company', 'Stavby s.r.o.', '{"ico":"55555555"}'::jsonb, 70, '{}'::jsonb),
        ('tender:P/1', 'tender', 'Oprava mostu', $2::jsonb, 70, '{}'::jsonb),
        ('tender:P/2', 'tender', 'Oprava školy', '{"authority_ico":"${PRAHA_KRAJ_ICO}","cpv_division":"45"}'::jsonb, 70, '{}'::jsonb)`,
      [
        JSON.stringify({ electoral_arena: "statni", arena_provenance: { pass: 74 } }), // declared wrong; crosswalk says kraj
        JSON.stringify({ authority_ico: PRAHA_KRAJ_ICO, cpv_division: "45", flags: ["single_bid"], flags_provenance: { pass: 72 } }),
      ],
    );
    await pg.query(
      `insert into kg_edge (src, rel, dst, weight, props, provenance)
       values
        ('company:ico:${PRAHA_KRAJ_ICO}', 'procures', 'tender:P/1', null, '{}'::jsonb, '{}'::jsonb),
        ('company:ico:${PRAHA_KRAJ_ICO}', 'procures', 'tender:P/2', null, '{}'::jsonb, '{}'::jsonb),
        ('company:ico:55555555', 'wins', 'tender:P/1', 1000000, '{"price_czk":1000000,"decided_on":"2025-01-10T00:00:00"}'::jsonb, '{}'::jsonb)`,
    );
    await resetMemos();
  });

  it("kraj: the crosswalk ico's lots under the krajske ballot, MPs of the kraj by list", async () => {
    const res = await getKrajData("praha");
    expect(res?.kind).toBe("ok");
    if (res?.kind !== "ok") return;
    expect(res.data.kraj.slug).toBe("praha");
    expect(res.data.krajske).toMatchObject({ ballot: "krajske", href: "/volby/kraj/praha", label: "Hlavní město Praha" });
    expect(res.data.krajske?.ledger.baseline?.label).toContain("1 označených z 2 zakázek");
    expect(res.data.mps).toEqual([{ pspId: 100, name: "Nováková Jana", listSlug: "spolu", club: "ODS" }]);
    expect(res.data.provenance.counts.krajLots).toBe(2);
    expect(res.data.provenance.pass).toBe(74);
  });

  it("home: census counts the corrected arena and the layer is memoised per store", async () => {
    const home = (await getVolbyHomeData())!;
    const krajske = home.census.find((c) => c.arena === "krajske")!;
    expect(krajske).toEqual({ arena: "krajske", authorities: 1, lots: 2, flaggedShare: 0.5, czkFloor: 1_000_000 });
    expect(home.provenance.counts["tender.arenaCorrectedByRegistry"]).toBe(1);
    const store = (await getStore())!;
    const a = await loadTenderLayer(store);
    const b = await loadTenderLayer(store);
    expect(a).toBe(b);
    expect(a.provenance.coldFoldMs).toBeGreaterThanOrEqual(0);
  });
});
