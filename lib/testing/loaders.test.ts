// Direct tests for EVERY server loader under features/ — the eight `get*Data.ts` that
// had none, plus features/graph/graphLoader.ts and features/votetrack/getVoteThemes.ts,
// plus the getLeaderboardData suite absorbed from the former
// lib/testing/leaderboard-loader.test.ts (see WHY ONE FILE below):
//
//   features/civicscore/getLeaderboardData.ts  /zebricek
//   features/money/moneyLoader.ts          shared /penize raw read
//   features/money/getMoneyData.ts         /penize ledger
//   features/money/getMpDetail.ts          /penize/[pspId] case file
//   features/money/getVerificationData.ts  /penize/kontrola review queue
//   features/lawwatch/getLawData.ts        /zakony
//   features/lawwatch/getCollisionData.ts  /zakony/kolize
//   features/profile/getProfileData.ts     /poslanec/[id]
//   features/graph/graphLoader.ts          /graf
//   features/votetrack/getVoteThemes.ts    /hlasovani theme filter
//   features/admin/getAdminData.ts         /admin
//
// THE RISK. Every one of these converts failure into `null`, and the page then falls
// back to the labelled sample data in lib/civic/. That fallback is deliberate and
// honest, but it means a regression does not crash — it silently degrades a civic-
// accountability surface to MOCK data. So each loader gets (1) a happy path against
// real seeded rows, (2) an honest-degradation path returning null AND leaving a trace
// through reportLoaderFailure, and (3) its own load-bearing invariants (stable ids,
// UI-relied-on sort order, gated values that must stay labelled).
//
// SHAPE. Per the ADR (docs/architect/decisions/2026-07-26-loader-test-coverage.md) the
// tests live in lib/ (vitest's include glob) while the subject lives in features/.
//
// WHY ONE FILE. PGlite is single-connection per data dir, so each test FILE that seeds a
// store pays a WASM boot; those boots contend in parallel workers hard enough to blow the
// 10s hookTimeout (NOT configurable from here — vitest.config.ts sets only testTimeout)
// across the WHOLE suite. Measured on this tree: 5 booting files is green, SIX is not —
// six loader files failed 4-7 unrelated files, and even one extra booting file failed
// scripts/case-loops/apply-batch.test.ts's beforeEach. So the whole loader layer lives in
// ONE file with ONE boot and ONE shared fixture, and lib/testing/leaderboard-loader.test.ts
// (the ADR's precedent, commit 366e866) was absorbed here rather than kept as a 6th boot;
// its assertions live on in the getLeaderboardData block below, adapted to this fixture.
// The shared fixture also buys a cross-loader consistency check: /admin's tie totals and
// /penize/kontrola's queue are computed from the SAME rows, so a divergence between the
// operator dashboard and the console it monitors fails a test rather than shipping.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { scoreLanguage } from "@/lib/analysis/language-gate";

// Isolated PGlite data dir — NEVER point at ./.pglite (the live directory).
// Set BEFORE importing anything that calls open(): pglitePath() reads
// process.env.PGLITE_PATH lazily but open() memoises on globalThis.
const dataDir = mkdtempSync(join(tmpdir(), "politicas-loaders-"));
process.env.PGLITE_PATH = dataDir;

const { open } = await import("../db/pglite/internals");
const { loadMoneyLayer, loadMpMoneySlice, num, pspIdFromNodeId } = await import("../../features/money/moneyLoader");
const { getMoneyData } = await import("../../features/money/getMoneyData");
const { reviewSummary } = await import("../../features/money/reviewSummary");
const { getReceiptData } = await import("../../features/shared/provenance/getReceiptData");
const { decodeClaimRef } = await import("../../features/shared/provenance/claimRef");
const { getMoneyMpDetail } = await import("../../features/money/getMpDetail");
const { getVerificationQueue } = await import("../../features/money/getVerificationData");
const { getLawData, findBillByCislo } = await import("../../features/lawwatch/getLawData");
const { getCollisionData, COLLISION_CLASSIFICATIONS } = await import("../../features/lawwatch/getCollisionData");
const { getProfileData, getAllProfilePspIds } = await import("../../features/profile/getProfileData");
const { getVoteThemes } = await import("../../features/votetrack/getVoteThemes");
const { getAdminData } = await import("../../features/admin/getAdminData");
const { getLeaderboardData, getLeaderboardListData, buildLeaderboard, resetLeaderboardMemo } = await import(
  "../../features/civicscore/getLeaderboardData"
);
const { lowScoreReasonCopy } = await import("../analysis/low-score-reason");
const { mpBucketClaim, MONEY_METRIC } = await import("../../features/money/moneyClaims");
const { isAttributable } = await import("../../features/money/reachableMoney");

const ALFA = "kg:company:ico:111"; // private supplier of the state → owner-operator tie
const NEMOCNICE = "kg:company:ico:222"; // public body → steward tie
const GAMA = "kg:company:ico:333";
/** An ownership PARENT with public contracts and NO `linked_to` tie — the batch-012
 *  shape (Ministerstvo financí, Praha, ČSOB …) that carried 6.68 tn CZK of public-body
 *  activity into anything that summed `supplies` without checking for a tie. */
const UNTIED_PARENT = "kg:company:ico:444";
const GHOST = "kg:company:ico:999"; // referenced by an edge but has NO company node
// The internal node-id suffix is deliberately UNRELATED to the public print number
// (`props.cislo`) — no loader may conflate them. See CollisionBillRef's doc comment.
const B_FLAGGED = "bill:tisk:43111"; // cislo 4
const B_FORENSIC = "bill:tisk:43222"; // cislo 244
const B_CENSUS = "bill:tisk:43333"; // cislo 120
const B_NOCISLO = "bill:tisk:43999"; // no cislo — must render unlinked, never guessed

/** The raw per-MP counters getLeaderboardData's componentPoints() re-derives the six
 * weighted components from. `contribution_score` stays authoritative and separate — the
 * headline number always comes from the graph, never re-summed from the parts. */
const BASE_COUNTERS = {
  participation_rate: 0.9,
  absence_rate: 0.1,
  committee_count: 2,
  leadership_count: 1,
  bills_authored: 1,
  interpellations: 1,
  speech_turns: 10,
  contribution_provenance: { pass: 30 },
} as const;

/** Fixture census, kept beside the seed so map/census assertions stay maintainable. */
const FIXTURE = {
  // +1 company +1 contract vs pass-35: the batch-013 untied ownership parent and its
  // own large contract, seeded to pin that untied money never reaches an attribution total.
  knownKindNodes: 20, // 4 person + 4 company + 3 contract + 4 bill + 2 law + 2 organ + 1 party
  unknownKindNodes: 1, // a node kind the canvas must refuse to draw
  edges: 24, // incl. the pass-34 rapporteur edge + pass-35 spoke_on/proposes_amendment
  coVotesEdges: 3, // a 96%-dense matrix — must never reach the canvas payload
} as const;

/** Run `fn` with the cardinality gate bypassed. This fixture seeds 3 persons on purpose;
 * the floors themselves are exercised by the degradation tests. storeReady() reads
 * process.env at CALL time, so toggling per test exercises the real gate, not a mock. */
async function withReadinessOff<T>(fn: () => Promise<T>): Promise<T> {
  process.env.KG_READINESS_OFF = "1";
  try {
    return await fn();
  } finally {
    delete process.env.KG_READINESS_OFF;
  }
}

/** Assert that a degradation left a trace — reportLoaderFailure logs `[loader:<name>]`
 * before every `return null`, so an invisible degradation fails the test. */
async function expectTracedDegradation(loader: string, fn: () => Promise<unknown>) {
  // The chamber pass is memoized ACROSS requests (getLeaderboardData.ts), so a
  // degradation check must start from a cold process — otherwise it would assert
  // against an answer read while the store was still healthy. Dropping the memo
  // is what a restart does; the memo itself never caches a null.
  resetLeaderboardMemo();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await fn()).toBeNull();
    expect(spy.mock.calls.map((c) => String(c[0])).join("\n")).toContain(`[loader:${loader}]`);
  } finally {
    spy.mockRestore();
  }
}

let seeding: Promise<void> | null = null;
/** Idempotent — every describe below awaits it; the cold-start block runs BEFORE it. */
function ensureSeeded(): Promise<void> {
  seeding ??= seedFixture();
  return seeding;
}

async function seedFixture(): Promise<void> {
  const pg = await open();

  // ── registry tables: chamber → club/committee tree, mandate, memberships ──
  await pg.query(
    `insert into person (id, psp_id, name_full, name_norm, source, source_url, fetched_at)
     values ('psp:person:100', 100, 'Novák Petr', 'novak petr', 'psp.cz', 'https://psp.cz', now())`,
  );
  await pg.query(
    `insert into organ (id, psp_id, parent_psp_id, organ_type_cz, abbrev, name_cz, name_norm, source, source_url, fetched_at)
     values
      ('o:174', 174, null, 'Parlament', 'PSP10', 'Poslanecká sněmovna', 'psp10', 'psp.cz', 'https://psp.cz', now()),
      ('o:800', 800, 174,  'Klub',      'ODS',   'Klub ODS',            'ods',   'psp.cz', 'https://psp.cz', now()),
      ('o:300', 300, 174,  'Výbor',     'VHZD',  'Hospodářský výbor',   'vhzd',  'psp.cz', 'https://psp.cz', now()),
      ('o:301', 301, 174,  'Komise',    'KOM',   'Stálá komise',        'kom',   'psp.cz', 'https://psp.cz', now()),
      ('o:900', 900, null, 'Kraj',      null,    'Hlavní město Praha',  'praha', 'psp.cz', 'https://psp.cz', now())`,
  );
  await pg.query(
    `insert into mandate (id, psp_id, person_psp_id, term_psp_id, term_code, region_psp_id, source, source_url, fetched_at)
     values ('m:1000', 1000, 100, 174, 'PSP10', 900, 'psp.cz', 'https://psp.cz', now())`,
  );
  await pg.query(
    `insert into membership (id, person_psp_id, kind, target_psp_id, organ_psp_id, function_type_cz, from_at, to_at, source, source_url, fetched_at)
     values
      ('ms:club', 100, 'member',   800, 800, null,       '2025-11-01', null,         'psp.cz', 'https://psp.cz', now()),
      -- psp.cz stores a leadership seat as TWO rows on the SAME organ. Here the
      -- chairmanship ENDED while the plain membership continues: the honest render is
      -- "member · current" — never "chair · current", never a dropped row.
      ('ms:vyb1', 100, 'member',   300, 300, null,       '2025-11-01', null,         'psp.cz', 'https://psp.cz', now()),
      ('ms:vyb2', 100, 'function', 300, 300, 'předseda', '2025-11-01', '2020-01-01', 'psp.cz', 'https://psp.cz', now()),
      -- to_at = 'infinity' is a legal timestamptz psp.cz-shaped data can carry, and it
      -- does NOT parse as a date. It used to make Date.parse(toAt) > now() false and so
      -- rendered the seat as ENDED — an unreadable end date asserted as a fact.
      ('ms:vyb3', 100, 'member',   301, 301, null,       '2025-11-01', 'infinity',   'psp.cz', 'https://psp.cz', now())`,
  );

  // ── knowledge graph nodes ────────────────────────────────────────────────
  await pg.query(
    `insert into kg_node (id, kind, label, props, first_seen_pass, provenance)
     values
      ('psp:person:100', 'person', 'Nováková Jana', $1::jsonb, 30, $11::jsonb),
      ('psp:person:200', 'person', 'Adamec Alois',  $2::jsonb, 30, '{}'::jsonb),
      -- same score as Adamec: the rank tiebreak must be Czech collation, not insertion order
      ('psp:person:250', 'person', 'Beneš Bohumil', $2::jsonb, 30, '{}'::jsonb),
      ('psp:person:300', 'person', 'Cimrman Jára',  $3::jsonb, 30, '{}'::jsonb),
      ($12, 'company', 'Alfa s.r.o.',            $4::jsonb, 30, '{}'::jsonb),
      ($13, 'company', 'Krajská nemocnice a.s.', $5::jsonb, 30, '{}'::jsonb),
      ($14, 'company', 'Gama s.r.o.',            $6::jsonb, 30, '{}'::jsonb),
      ('kg:company:ico:444', 'company', 'Ministerstvo čehosi', '{"ico":"444"}'::jsonb, 30, '{}'::jsonb),
      ('kg:contract:9', 'contract', 'Obří státní zakázka', '{"amount": 900000000, "signedOn": "2024-06-01"}'::jsonb, 30, '{}'::jsonb),
      ('kg:contract:1', 'contract', 'Dodávka IT', $7::jsonb, 30, '{}'::jsonb),
      ('kg:contract:2', 'contract', 'Úklid',      $8::jsonb, 30, '{}'::jsonb),
      ($15, 'bill', 'Novela zákona o daních z příjmů', $16::jsonb, 30, '{}'::jsonb),
      ($17, 'bill', 'Novela trestního zákoníku',       $18::jsonb, 31, '{}'::jsonb),
      ($19, 'bill', 'Novela zákona o pojistném',       $20::jsonb, 29, '{}'::jsonb),
      ($21, 'bill', 'Tisk bez čísla', '{}'::jsonb, 29, '{}'::jsonb),
      ('law:sb:586-1992', 'law', 'zákon č. 586/1992 Sb.', $9::jsonb,  30, '{}'::jsonb),
      ('law:sb:40-2009',  'law', 'zákon č. 40/2009 Sb.',  $10::jsonb, 30, '{}'::jsonb),
      ('psp:organ:1', 'organ', 'rozpočtový výbor',     $22::jsonb, 30, '{}'::jsonb),
      ('psp:organ:2', 'organ', 'ústavně právní výbor', '{}'::jsonb, 30, '{}'::jsonb),
      ('kg:party:ODS', 'party', 'ODS', $23::jsonb, 30, '{}'::jsonb),
      ('kg:mimozemstan:1', 'mimozemstan', 'Neznámý druh', '{}'::jsonb, 30, '{}'::jsonb)`,
    [
      JSON.stringify({
        ...BASE_COUNTERS,
        contribution_score: 70,
        absentee_manager_lead: true,
        rebellion_rate: 0.12,
        contested_vote_rebellion: 0.3,
        effort_tenure_days: 260,
        effort_tenure_class: "full-term",
        effort_tenure_start: "2025-11-01",
        effort_work_themes: ["doprava", "rozpočet", 42],
      }),
      JSON.stringify({ ...BASE_COUNTERS, contribution_score: 80 }),
      JSON.stringify({
        ...BASE_COUNTERS,
        contribution_score: 60,
        // The honest low-score correction + the vintage it was recorded at. Cimrman is
        // last on score; without this the ranking says "lazy" about a structural fact.
        effort_low_score_reason: "declined_mandate",
        effort_provenance: { pass: 14, track: "effort", method: "verdict", computedAt: "2026-07-24T17:41:34.737Z" },
      }),
      JSON.stringify({
        ico: "111",
        subsidies_count: 2,
        subsidies_total_czk: 2_000_000,
        donated_to_party_czk: 500_000,
        donation_recipient_party: "ODS",
      }),
      JSON.stringify({ ico: "222" }),
      JSON.stringify({ ico: "333" }),
      JSON.stringify({ amount: 5_000_000, signedOn: "2024-03-01" }),
      // 1.9M sits inside the 10 % band below the 2M zadávací limit → nearThresholdCount 1.
      // The signature date is one the REAL corpus carries (19 of the 97 887 contracts
      // reachable through `linked_to` are dated 0002, 1970, 2027, 3062 …). A date that
      // could not have happened is not a date: the MP profile keeps the row and the
      // amount and withholds the date — it never repairs it, and never drops the money.
      JSON.stringify({ amount: 1_900_000, signedOn: "3062-07-16" }),
      JSON.stringify({ ref: "586/1992", esbirka_title: "Zákon o daních z příjmů" }),
      JSON.stringify({ ref: "40/2009" }), // no esbirka_title → title must stay null
      JSON.stringify({ pass: 30, method: "kg-compute", ref: "psp.cz", computedAt: "2026-07-24" }),
      ALFA,
      NEMOCNICE,
      GAMA,
      B_FLAGGED,
      JSON.stringify({
        cislo: 4,
        origin: "government",
        submitter: "vláda",
        sponsors: [100, "not-a-number"],
        // pass-34 roles layer: signature order + procedural fate (psp.cz tisky.zip)
        sponsors_ranked: [{ osoba: 100, rank: 1, joined_later: false }],
        stav: "Senát",
        fate_sb: "583/2025",
        fate_published_on: "2025-12-29",
        flagged_conflict: true,
        sponsor_contract_czk: 5_000_000,
        sponsor_money_companies: 2,
      }),
      B_FORENSIC,
      JSON.stringify({
        cislo: 244,
        origin: "mp",
        forensic_review_state: "pending_review",
        forensic_severity: "high",
        forensic_confidence: 0.7,
        forensic_stated_reasoning: "deklarovaný důvod",
        forensic_researched_context: "kontext",
        forensic_conflict_assessment: "posouzení",
        forensic_unstated_effects: [{ effect: "e", whoBenefits: "w", evidence: "ev" }, "junk"],
        forensic_citations: [{ claim: "c", kind: "k", source: "s" }],
        forensic_provenance: { pass: 31 },
      }),
      B_CENSUS,
      JSON.stringify({
        cislo: 120,
        origin: "vymyšlený", // out-of-vocab origin must narrow to "other", never render raw
        amended_laws_full: ["586/1992", "40/2009", 42],
        amends_undercount: 1,
      }),
      B_NOCISLO,
      JSON.stringify({ member_count: 18, organ_type: "Výbor" }),
      JSON.stringify({ seats: 34 }),
    ],
  );

  // ── knowledge graph edges ────────────────────────────────────────────────
  await pg.query(
    `insert into kg_edge (src, rel, dst, weight, props, provenance)
     values
      ($1, 'supplies', 'kg:contract:1', 5000000, '{}'::jsonb, '{}'::jsonb),
      ($1, 'supplies', 'kg:contract:2', 1900000, '{}'::jsonb, '{}'::jsonb),
      -- an untied ownership parent's own contracting: reachable via supplies, but no MP
      -- is tied to it, so it must never enter an attribution total.
      ('kg:company:ico:444', 'supplies', 'kg:contract:9', 900000000, '{}'::jsonb, '{}'::jsonb),
      ('psp:person:100', 'linked_to', $1, null, $4::jsonb, $7::jsonb),
      ('psp:person:200', 'linked_to', $2, null, $5::jsonb, $7::jsonb),
      ('psp:person:200', 'linked_to', $3, null, $6::jsonb, $7::jsonb),
      -- unresolved company endpoint: every reader must DROP it, never guess
      ('psp:person:300', 'linked_to', $8, null, $9::jsonb, $7::jsonb),
      ($10, 'amends', 'law:sb:586-1992', null, '{}'::jsonb, '{}'::jsonb),
      ($10, 'amends', 'law:sb:40-2009',  null, '{}'::jsonb, '{}'::jsonb),
      ($11, 'amends', 'law:sb:586-1992', null, '{}'::jsonb, '{}'::jsonb),
      ($12, 'amends', 'law:sb:586-1992', null, '{}'::jsonb, '{}'::jsonb),
      ($10, 'assigned_to', 'psp:organ:2', null, $13::jsonb, '{}'::jsonb),
      ($10, 'assigned_to', 'psp:organ:1', null, $14::jsonb, '{}'::jsonb),
      ('psp:person:100', 'co_votes_with', 'psp:person:200', 0.91, $15::jsonb, '{}'::jsonb),
      ('psp:person:300', 'co_votes_with', 'psp:person:100', 0.55, $16::jsonb, '{}'::jsonb),
      -- malformed endpoint (ingest slip): must be DROPPED, not rendered as /poslanec/NaN
      ('psp:person:100', 'co_votes_with', 'psp:person:rozbity', 0.99, '{}'::jsonb, '{}'::jsonb),
      ('psp:person:100', 'rebels_against', 'kg:party:ODS', 0.12, $17::jsonb, '{}'::jsonb),
      ('psp:person:100', 'sponsors', $10, null, '{"rank": 1, "role": "predkladatel", "joined_later": false}'::jsonb, '{}'::jsonb),
      ('psp:person:100', 'sponsors', $18, null, '{}'::jsonb, '{}'::jsonb),
      -- pass-34 zpravodaj layer: the assigned analytical role, distinct from sponsorship
      ('psp:person:100', 'rapporteur', $11, null, '{"scopes": ["zpravodaj_vyboru"], "organ_ids": [2]}'::jsonb, '{}'::jsonb),
      -- pass-35 engagement layer: substantive floor speeches + written-amendment authorship
      ('psp:person:100', 'spoke_on', $10, 3, '{}'::jsonb, '{}'::jsonb),
      ('psp:person:100', 'proposes_amendment', $10, 2, '{"sd_cislos": [3, 4]}'::jsonb, '{}'::jsonb),
      ('psp:person:100', 'influential_in', 'psp:organ:1', 1,   '{}'::jsonb, '{}'::jsonb),
      ('psp:person:200', 'influential_in', 'psp:organ:1', 0.3, '{}'::jsonb, '{}'::jsonb)`,
    [
      ALFA,
      NEMOCNICE,
      GAMA,
      JSON.stringify({
        role: "jednatel",
        source: "hlidac:osoby/petr-novak · 2016-01-01–ongoing",
        review_state: "pending_review",
        corroboration: "registry-confirmed",
      }),
      JSON.stringify({
        role: "člen dozorčí rady",
        source: "hlidac · 2020-01-01–ongoing",
        review_state: "verified",
        corroboration: "registry-confirmed",
      }),
      // "rejected" is TERMINAL (D7) — it must leave the pending queue, like "verified".
      JSON.stringify({ role: "jednatel", source: "hlidac", review_state: "rejected" }),
      JSON.stringify({ pass: 42 }),
      GHOST,
      JSON.stringify({ role: "jednatel", source: "hlidac", review_state: "pending_review" }),
      B_FLAGGED,
      B_FORENSIC,
      B_CENSUS,
      JSON.stringify({ role: "dalsi", status: "navrzeno" }),
      JSON.stringify({ role: "garancni", status: "prikazano", assignedOn: "2026-01-15" }),
      JSON.stringify({ shared: 120 }),
      JSON.stringify({ shared: 90 }),
      JSON.stringify({ club: "ODS", rebelVotes: 3, eligibleVotes: 25 }),
      B_NOCISLO,
    ],
  );

  await pg.query(
    `insert into review_audit (id, src, rel, dst, decision, reviewer, note, decided_at, prior_state)
     values
      ('a1', 'psp:person:200', 'linked_to', $1, 'confirm',    'tester',         null,            '2026-07-01T10:00:00Z', 'pending_review'),
      ('a2', 'psp:person:200', 'linked_to', $2, 'reject',     'tester',         null,            '2026-07-02T10:00:00Z', 'pending_review'),
      ('a3', 'psp:person:100', 'linked_to', $3, 'needs-more', 'druhý recenzent', 'chybí ARES VR', '2026-07-03T10:00:00Z', 'pending_review')`,
    [NEMOCNICE, GAMA, ALFA],
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 0 · graphLoader on a cold start — MUST run before the fixture is seeded, so
 *     this block declares no beforeAll and seeds at the end of its one test.
 * ──────────────────────────────────────────────────────────────────────────── */

describe("graphLoader on a cold start over an empty graph", () => {
  // 30s: the first test in the file pays the PGlite WASM boot, which contends
  // when several PGlite test files run in parallel workers.
  //
  // CONTRACT CHANGED 2026-08-13. This block used to pin the OPPOSITE — a "KNOWN GAP,
  // pinned deliberately (reported, not fixed)": `indexPromise ??= buildIndex()` memoised
  // a promise that RESOLVED TO NULL, so a process that booted before the graph was
  // materialized (or through one transient store failure) served an empty /graf for its
  // whole lifetime, with no retry and no failure trace. That is not a gap a test should
  // hold in place: an empty canvas renders as a REAL empty graph, so the surface whose
  // whole subject is traceability was quietly asserting the graph holds nothing. The
  // assertion is replaced, not deleted — the loader now follows the doctrine
  // lib/db/pglite/internals.ts open() already had (ADR 2026-07-26-memoised-rejection-open)
  // and moneyLoader/profile already had for their memos: neither an empty read nor a
  // failure is memoised, and every degradation leaves a reportLoaderFailure trace.
  it("degrades WITH A TRACE and retries once the graph exists", { timeout: 30_000 }, async () => {
    const cold = await import("../../features/graph/graphLoader");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // PGlite creates an empty-but-healthy schema on open → zero nodes.
      expect(await cold.getGraphSeed()).toBeNull();
      expect(await cold.searchGraph("novak", null)).toEqual([]);
      expect(await cold.getMapData()).toBeNull();
      expect(await cold.getTrails()).toBeNull();
      expect((await cold.getPathBetween("psp:person:100", "psp:person:200")).status).toBe("unavailable");

      // Every degrading layer names ITSELF, so a log line says which read went dark.
      const traces = spy.mock.calls.map((c) => String(c[0])).join("\n");
      for (const loader of [
        "graphLoader.buildIndex",
        "graphLoader.getMapData",
        "graphLoader.getTrails",
        "graphLoader.pathAdjacency",
      ]) {
        expect(traces, loader).toContain(`[loader:${loader}]`);
      }
    } finally {
      spy.mockRestore();
    }

    // THE POINT: the same module instance — no vi.resetModules() — sees the data as soon
    // as it exists. A failed/empty read is never memoised, so /graf recovers without a
    // process restart.
    await ensureSeeded();
    const seed = (await cold.getGraphSeed())!;
    expect(seed).not.toBeNull();
    expect(seed.totalNodes).toBe(FIXTURE.knownKindNodes);
    const map = (await cold.getMapData())!;
    expect(map).not.toBeNull();
    expect(await cold.getTrails()).not.toBeNull();
    // ...and a SUCCESSFUL read still memoises: the graph is a batch artefact that
    // only changes on `npm run da:kg-compute`, so the layout is computed once.
    expect(await cold.getMapData()).toBe(map);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · /penize — moneyLoader · getMoneyData · getMpDetail · getVerificationData
 * ──────────────────────────────────────────────────────────────────────────── */

describe("loadMoneyLayer (the shared /penize read)", () => {
  beforeAll(ensureSeeded);

  it("aggregates supplies into per-company contract totals — and reads NO contract nodes", async () => {
    const layer = (await withReadinessOff(loadMoneyLayer))!;
    expect(layer).not.toBeNull();
    const alfa = layer.contractsByCompany.get(ALFA)!;
    expect(alfa.count).toBe(2);
    expect(alfa.czk).toBe(6_900_000);
    expect(alfa.amounts).toEqual([5_000_000, 1_900_000]);
    // Line items (label + signature date) live on the contract NODE and are NOT part of
    // this read: 152 788 of them cost 7.8 s to answer a question only /penize/[pspId]
    // asks. They come from loadMpMoneySlice, which fetches them per company.
    expect("lines" in alfa).toBe(false);
    expect(layer.pass).toBe(42);
  });

  it("loadMpMoneySlice reads ONE MP through the index and returns its line items", async () => {
    const slice = (await withReadinessOff(() => loadMpMoneySlice(100)))!;
    expect(slice).not.toBeNull();
    expect(slice.person.label).toBe("Nováková Jana");
    expect(slice.club).toBe("ODS");
    expect(slice.ties.map((e) => e.dst)).toEqual([ALFA]);
    const lines = slice.linesByCompany.get(ALFA)!;
    // lines sorted amount desc — the UI slices its own top-N off the front.
    expect(lines.map((l) => l.amountCzk)).toEqual([5_000_000, 1_900_000]);
    expect(lines[0].signedOn).toBe("2024-03-01");
    // …and the same aggregate the whole-corpus layer computes, from the same rule.
    expect(slice.contractsByCompany.get(ALFA)).toEqual({ count: 2, czk: 6_900_000, amounts: [5_000_000, 1_900_000] });
    expect(slice.pass).toBe(42);
  });

  it("loadMpMoneySlice is null for an MP with no ties and for an unknown node", async () => {
    expect(await withReadinessOff(() => loadMpMoneySlice(250))).toBeNull();
    expect(await withReadinessOff(() => loadMpMoneySlice(99999))).toBeNull();
  });

  it("exposes tiedCompanyIds, and it EXCLUDES a contract-holding ownership parent", async () => {
    const layer = (await withReadinessOff(loadMoneyLayer))!;
    // The parent's contracts are reachable through `supplies` …
    expect(layer.contractsByCompany.get(UNTIED_PARENT)?.czk).toBe(900_000_000);
    // … but it has no tie, so it is not attributable to anyone.
    expect(layer.tiedCompanyIds.has(UNTIED_PARENT)).toBe(false);
    expect(layer.tiedCompanyIds.has(ALFA)).toBe(true);
  });

  it("REGRESSION (batch 013): an untied parent's money never reaches an attribution total", async () => {
    // Batch 012's re-ingest gave ownership parents (Ministerstvo financí, Praha, ČSOB …)
    // 55 844 contracts worth 6.68 tn CZK. They have no `linked_to` tie, so none of it may
    // be associated with a politician. The fixture's parent holds 900M — an amount that
    // dwarfs every tied company, so any total that accidentally includes it is unmissable.
    const data = (await withReadinessOff(getMoneyData))!;
    const untiedCzk = 900_000_000;
    expect(data.stats.money.totalCzk).toBeLessThan(untiedCzk);
    expect(data.stats.contractCzkAttributable).toBeLessThan(untiedCzk);
    expect(data.stats.contractCzkSteward).toBeLessThan(untiedCzk);
    // And it must not appear as a company in the ledger at all.
    expect(data.mps.flatMap((m) => m.ties).some((t) => t.companyId === UNTIED_PARENT)).toBe(false);
  });

  it("num() parses a numeric string instead of counting it as zero", () => {
    expect(num("1900000")).toBe(1_900_000);
    expect(num(12)).toBe(12);
    expect(num("není číslo")).toBe(0);
    expect(num(undefined)).toBe(0);
  });

  it("pspIdFromNodeId reads the integer tail of an urn, else null", () => {
    expect(pspIdFromNodeId("psp:person:6202")).toBe(6202);
    expect(pspIdFromNodeId("psp:person:abc")).toBeNull();
  });
});

describe("getMoneyData (the /penize ledger)", () => {
  beforeAll(ensureSeeded);

  it("shapes the real money layer, heaviest case file first", async () => {
    const data = (await withReadinessOff(getMoneyData))!;
    expect(data).not.toBeNull();

    // MPs ordered by ATTRIBUTABLE reach desc (the shared definition, per company
    // de-duplicated): 6.9M contracts + 2M subsidies of a firm the MP runs leads. Steward
    // money is not in the key at all — /penize's own methodology says it is the
    // institution's, so it may not decide who the front page draws.
    expect(data.mps.map((m) => m.pspId)).toEqual([100, 200]);
    const lead = data.mps[0];
    expect(lead.name).toBe("Nováková Jana");
    expect(lead.club).toBe("ODS"); // resolved through mandate ⋈ club organ
    expect(lead.absenteeManagerLead).toBe(true);
    expect(lead.attributableReachCzk).toBe(8_900_000);
    expect(lead.stewardReachCzk).toBe(0);

    // GATED VALUES MUST STAY LABELLED: a tie that has not passed human review is
    // pending_review and is excluded from verifiedCount — never silently promoted.
    const tie = lead.ties[0];
    expect(tie.reviewState).toBe("pending_review");
    expect(lead.verifiedCount).toBe(0);
    expect(lead.pendingCount).toBe(1);

    // Deterministic annotations, reused verbatim from reviewTypes.ts so the ledger and
    // the review console can never disagree about what a tie "is".
    expect(tie.tieClass).toBe("owner-operator");
    expect(tie.triangle).toBe(true); // contracts + subsidies + party donation
    expect(tie.nearThresholdCount).toBe(1);
    expect(tie.deMinimis).toBe(false);
    expect(tie.reviewTier).toBe(0); // registry-confirmed owner-operator
    expect(tie.corroboration).toBe("registry-confirmed");
    expect(tie.donatedToPartyCzk).toBe(500_000);
    expect(tie.donationRecipientParty).toBe("ODS");

    // A public body is a steward, not an owner-operator — the class gate that keeps
    // hospital/city contracts out of the "MP enrichment" reading.
    const nemocnice = data.mps[1].ties.find((t) => t.companyId === NEMOCNICE)!;
    expect(nemocnice.tieClass).toBe("steward");
    expect(nemocnice.reviewState).toBe("verified");

    // Absence of a finding is a finding: untied MPs are listed (name-sorted), not dropped.
    expect(data.mpsWithoutTies.map((m) => m.name)).toEqual(["Beneš Bohumil", "Cimrman Jára"]);

    // Featured entity graph = the case file the SELECTION RULE picks — heaviest
    // attributable reach — and the picture states the value it was picked on.
    expect(data.graph?.mp.pspId).toBe(100);
    expect(data.graph?.companies.map((c) => c.id)).toEqual([ALFA]);
    expect(data.graph?.selectedByCzk).toBe(8_900_000);
    expect(data.graph?.companies[0]).toMatchObject({
      tieClass: "owner-operator",
      attributable: true,
      reachCzk: 8_900_000,
    });

    // The steward MP is second and carries no attributable reach — so a board seat in a
    // public body can never be crowned "nejsilnější spis". (The fixture's hospital signs
    // no contracts, so its steward reach is 0 too; the ranking claim is the attributable
    // key, pinned per class in features/money/reachableMoney.test.ts.)
    expect(data.mps[1].ties.some((t) => t.tieClass === "steward")).toBe(true);
    expect(data.mps[1].attributableReachCzk).toBe(0);

    // The owner-operator tile splits recorded classes from guessed ones: this fixture
    // stores no `tie_class`, so every owner-operator class here is `classifyTie`'s guess
    // and the tile may not cite ARES for it.
    expect(data.stats.ownerOperatorMps).toBe(2);
    expect(data.stats.ownerOperatorMpsStoredClass).toBe(0);

    // What the human gate has decided is COUNTED, not asserted. The fixture holds one of
    // each state, so the page's banner is in its `mixed` phase here — the case the two
    // hard-coded "everything is pending" sentences got wrong.
    expect([data.stats.verifiedTies, data.stats.pendingTies, data.stats.rejectedTies]).toEqual([1, 1, 1]);
    expect(reviewSummary({
      verified: data.stats.verifiedTies,
      pending: data.stats.pendingTies,
      rejected: data.stats.rejectedTies,
    })).toMatchObject({ phase: "mixed", decided: 2, total: 3 });

    expect(data.pass).toBe(42);
    expect(data.source).toBe("registr smluv ⋈ ares ⋈ hlídač státu");
  });

  it("every tie carries a /zdroj receipt ref that RESOLVES — a claim with no address is not citable", async () => {
    // /penize published 211 money claims about named people and not one of them had a
    // permanent address, so /overeni (the citation verifier) had nothing here to verify.
    // The ref must be minted from the EDGE's own endpoints; a reconstructed
    // `psp:person:<pspId>` string would look right and resolve to "gone".
    const data = (await withReadinessOff(getMoneyData))!;
    const ties = data.mps.flatMap((m) => m.ties);
    expect(ties.length).toBeGreaterThan(0);
    for (const t of ties) {
      expect(decodeClaimRef(t.receiptRef)).toEqual({
        kind: "edge",
        src: `psp:person:${data.mps.find((m) => m.ties.includes(t))!.pspId}`,
        rel: "linked_to",
        dst: t.companyId,
      });
      const res = await withReadinessOff(() => getReceiptData(t.receiptRef));
      expect(res.status, t.receiptRef).toBe("ok");
      // A receipt is a citation of a CLAIM, so it carries the gate's state, not a verdict.
      if (res.status === "ok" && res.receipt.kind === "edge") {
        expect(res.receipt.gate?.status).toBe(t.reviewState);
      }
    }
  });

  it("does not claim a per-company cap when the fixture has no ceiling (a floor label must be earned)", async () => {
    // The seed has only a handful of companies with differing contract counts, so no
    // ceiling is detectable — and the surface must therefore NOT print "nejméně".
    // The real corpus is capped (money batch 011: 35 companies at exactly 25 contracts),
    // which is why the flag is computed from the data instead of hardcoded: an uncapped
    // re-ingest has to be able to turn the caveat off by itself.
    const data = (await withReadinessOff(getMoneyData))!;
    const coverage = data.stats.contractCoverage;
    expect(coverage).toBeDefined();
    if (coverage.isFloor) {
      // If a fixture ever does trip the heuristic, the reported cap must be real:
      // at least 3 companies sitting on the same low ceiling.
      expect(coverage.companiesAtCap).toBeGreaterThanOrEqual(3);
      expect(coverage.perCompanyCap).toBeGreaterThan(0);
    } else {
      expect(coverage.perCompanyCap).toBeNull();
      expect(coverage.companiesAtCap).toBe(0);
    }
  });

  it("splits reachable CZK into attributable vs steward money", async () => {
    // The seed has an owner-operator tie (6.9M) and a steward tie on a hospital. After the
    // batch-012 re-ingest stewards are ~91% of the real corpus, so folding both into one
    // headline would say something false at nine times the volume — the split is what the
    // surface renders, and the two parts must still reconcile to the whole.
    const data = (await withReadinessOff(getMoneyData))!;
    const { money, contractCzkAttributable, contractCzkSteward } = data.stats;
    expect(money.attributable.contractCzk + money.steward.contractCzk).toBe(money.totalCzk);
    // The owner-operator firm's money is attributable; the hospital's is not.
    expect(money.attributable.contractCzk).toBe(6_900_000);
    expect(money.steward.contractCzk).toBe(money.totalCzk - 6_900_000);
    // The named views /dashboard reads must be exactly those, never a second computation.
    expect(contractCzkAttributable).toBe(money.attributable.contractCzk);
    expect(contractCzkSteward).toBe(money.steward.contractCzk);
    expect(data.stats.contractCoverage).toBe(money.coverage);
  });

  it("counts reachable CZK once per company and drops edges with an unresolved company", async () => {
    const data = (await withReadinessOff(getMoneyData))!;
    expect(data.stats.companiesLinked).toBe(3); // the ghost company is not counted
    expect(data.stats.money.totalCzk).toBe(6_900_000);
    expect(data.stats.money.companies).toBe(3);
    expect(data.stats.verifiedTies).toBe(1);
    expect(data.stats.pendingTies).toBe(1); // the rejected tie counts as neither

    // KNOWN GAP, pinned deliberately (reported, not fixed): `totalTies` is the RAW
    // linked_to row count, so it still includes the edge whose company node is missing
    // — 4 here, while only 3 rows are visible in the ledger. The loader fixed exactly
    // this reconcilability defect on the PERSON side (see its own comment) but left it
    // on the company side, so the aggregate tile can never be reconciled with the rows.
    expect(data.stats.totalTies).toBe(4);
    expect(data.mps.reduce((s, m) => s + m.ties.length, 0)).toBe(3);
  });

  it("returns null and leaves a trace when the graph is below the readiness floor", async () => {
    // 3 persons / 3 companies / 2 contracts are far below CARDINALITY_FLOORS
    // (person 150, company 140, contract 1500) → degrade rather than publish partials.
    await expectTracedDegradation("storeReady", getMoneyData);
    await expectTracedDegradation("storeReady", loadMoneyLayer);
  });
});

describe("getMoneyMpDetail (the /penize/[pspId] case file)", () => {
  beforeAll(ensureSeeded);

  it("expands each tie into contract line items, top-N shown and the rest counted", async () => {
    const detail = (await withReadinessOff(() => getMoneyMpDetail(100)))!;
    expect(detail).not.toBeNull();
    expect(detail.name).toBe("Nováková Jana");
    expect(detail.ties).toHaveLength(1);
    expect(detail.ties[0].contracts.map((c) => c.amountCzk)).toEqual([5_000_000, 1_900_000]);
    expect(detail.ties[0].contractsMoreCount).toBe(0);
    // THE shared definition, class-split — never one merged total (one-money-definition).
    expect(detail.money.attributable.contractCzk).toBe(6_900_000);
    expect(detail.money.attributable.subsidiesCzk).toBe(2_000_000);
    expect(detail.money.attributable.donatedToPartyCzk).toBe(500_000);
    expect(detail.money.attributable.companies).toBe(1);
    expect(detail.money.steward.contractCzk).toBe(0);
    expect(detail.money.steward.companies).toBe(0);
    // The seed's ceiling is not shared by 3 companies, so no "nejméně" may be printed.
    expect(detail.money.coverage.isFloor).toBe(false);
    // Same mapper as the ledger (mapLinkedToTie) — the two surfaces cannot drift.
    expect(detail.ties[0].reviewState).toBe("pending_review");
    expect(detail.ties[0].tieClass).toBe("owner-operator");
  });

  it("returns null for an MP whose only tie was dropped, and for an unknown MP", async () => {
    expect(await withReadinessOff(() => getMoneyMpDetail(300))).toBeNull();
    expect(await withReadinessOff(() => getMoneyMpDetail(99999))).toBeNull();
  });

  it("returns null and leaves a trace below the readiness floor", async () => {
    await expectTracedDegradation("storeReady", () => getMoneyMpDetail(100));
  });
});

describe("getVerificationQueue (the /penize/kontrola review console)", () => {
  beforeAll(ensureSeeded);

  it("serves the PENDING queue only, ranked by reviewRank, with registry deep-links", async () => {
    const queue = (await withReadinessOff(getVerificationQueue))!;
    expect(queue).not.toBeNull();

    // verified AND rejected are terminal (D7); the ghost-company edge is dropped.
    expect(queue.ties.map((t) => t.id)).toEqual(["tie:100:111"]);
    const t = queue.ties[0];
    expect(t.reviewState).toBe("pending_review");
    expect(t.src).toBe("psp:person:100");
    expect(t.dst).toBe(ALFA);
    expect(t.club).toBe("ODS");
    expect(t.tieClass).toBe("owner-operator");
    expect(t.reviewTier).toBe(0);
    expect(t.periodFrom).toBe("2016-01-01");
    expect(t.periodTo).toBeNull(); // "ongoing" is honestly null, never a guessed end date
    expect(t.contractCount).toBe(2);
    expect(t.contractCzk).toBe(6_900_000);
    expect(t.triangle).toBe(true);
    expect(t.links.aresVr).toContain("111");
    expect(t.links.hlidacPerson).toBe("https://www.hlidacstatu.cz/osoba/petr-novak");

    // reviewRank ascending is the console's sort contract.
    expect([...queue.ties].sort((a, b) => a.reviewRank - b.reviewRank).map((x) => x.id)).toEqual(
      queue.ties.map((x) => x.id),
    );

    expect(queue.stats.pending).toBe(1);
    expect(queue.stats.ownerOperator).toBe(1);
    expect(queue.stats.steward).toBe(0);
    expect(queue.stats.tierCounts).toEqual([1, 0, 0, 0]);
    expect(queue.stats.tierCounts.reduce((s, n) => s + n, 0)).toBe(queue.stats.pending);
    expect(queue.pass).toBe(42);
  });

  it("GAP CLOSED: the console now degrades below the cardinality floor like every other money loader", async () => {
    // Was pinned as a KNOWN GAP: getVerificationData.ts never called storeReady(), so the
    // human-review console served a queue built from a half-ingested graph while /penize
    // itself had already degraded to the mock. It now reads the SHARED money layer, which
    // owns the gate, so the two surfaces can no longer disagree about whether the graph
    // is publishable — and the degradation still leaves a trace.
    expect(process.env.KG_READINESS_OFF).toBeUndefined();
    await expectTracedDegradation("storeReady", getVerificationQueue);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · /zakony — getLawData · getCollisionData
 * ──────────────────────────────────────────────────────────────────────────── */

describe("getLawData against a seeded legislation layer", () => {
  beforeAll(ensureSeeded);

  it("joins bills → amends → laws with real totals", async () => {
    const data = (await withReadinessOff(getLawData))!;
    expect(data).not.toBeNull();
    expect(data.totalBills).toBe(4);
    expect(data.totalLaws).toBe(2);
    expect(data.totalAmends).toBe(4);
    expect(data.flaggedCount).toBe(1);
    expect(data.forensicCount).toBe(1);
    expect(data.pass).toBe(31); // max first_seen_pass over the bill nodes

    // Most-amended statute leads; its title comes from esbirka_title, and a statute
    // absent from the e-Sbírka registry honestly carries a null title.
    expect(data.topLaws.map((l) => [l.ref, l.billCount])).toEqual([
      ["586/1992", 3],
      ["40/2009", 1],
    ]);
    expect(data.topLaws[0].title).toBe("Zákon o daních z příjmů");
    expect(data.topLaws[1].title).toBeNull();

    // Origin is a closed vocabulary — an unknown value narrows to "other".
    expect(data.originCounts).toEqual({ government: 1, mp: 1, other: 2 });
  });

  it("orders bills by informativeness: §-diff → forensic → conflict → statutes → print no.", async () => {
    const data = (await withReadinessOff(getLawData))!;
    // The three amending bills all touch 586/1992, for which real e-Sbírka §-diff
    // artifacts exist in the repo, so the first sort key ties among them and the
    // forensic/flagged keys decide; the bill with no amends sorts last.
    expect(data.bills.map((b) => b.cislo)).toEqual([244, 4, 120, null]);
    expect(data.paragraphDiffCount).toBe(3);
    // Diffs are the flagship real-text feature: markup is stripped for display but the
    // substance is verbatim e-Sbírka, never synthesized.
    for (const d of data.bills[0].paragraphDiffs) {
      expect(d.law).toBe("586/1992");
      expect(d.hunks.length).toBeGreaterThan(0);
      for (const h of d.hunks) {
        expect(h.before == null || !h.before.includes("<")).toBe(true);
        expect(h.after == null || !h.after.includes("<")).toBe(true);
      }
    }
  });

  it("keeps the forensic verdict labelled as a gated, derived claim", async () => {
    const data = (await withReadinessOff(getLawData))!;
    const f = data.bills.find((b) => b.cislo === 244)!.forensic!;
    expect(f).not.toBeNull();
    // The gate: a verdict is NEVER promoted to settled fact by the read path.
    expect(f.reviewState).toBe("pending_review");
    expect(f.severity).toBe("high");
    expect(f.confidence).toBe(0.7);
    expect(f.pass).toBe(31);
    // Malformed array entries are skipped, not coerced into empty claims.
    expect(f.unstatedEffects).toEqual([{ effect: "e", whoBenefits: "w", evidence: "ev" }]);
    expect(f.citations).toEqual([{ claim: "c", kind: "k", source: "s" }]);
  });

  it("resolves sponsors, committee routing (garanční first) and the census undercount", async () => {
    const data = (await withReadinessOff(getLawData))!;
    const bill = data.bills.find((b) => b.cislo === 4)!;
    expect(bill.tiskId).toBe(43111); // internal node id, never the print number
    // non-numeric id dropped; role/rank resolved from sponsors_ranked (pass 34)
    expect(bill.sponsors).toEqual([
      { pspId: 100, name: "Novák Petr", role: "predkladatel", rank: 1, joinedLater: false },
    ]);
    expect(bill.stav).toBe("Senát");
    expect(bill.fateSb).toBe("583/2025");
    expect(bill.fatePublishedOn).toBe("2025-12-29");
    expect(bill.flaggedConflict).toBe(true);
    expect(bill.sponsorContractCzk).toBe(5_000_000);

    // zpravodaj (rapporteur edge) resolves on its bill, with the scope list intact —
    // and a bill without one honestly carries an empty list, not an invented row.
    const forensicBill = data.bills.find((b) => b.cislo === 244)!;
    expect(forensicBill.rapporteurs).toEqual([{ pspId: 100, name: "Novák Petr", scopes: ["zpravodaj_vyboru"] }]);
    expect(bill.rapporteurs).toEqual([]);

    // pass-35 engagement: floor speakers (weight = substantive turns) and
    // written-amendment authors resolve on their bill; absent → empty, never invented.
    expect(bill.speakers).toEqual([{ pspId: 100, name: "Novák Petr", turns: 3 }]);
    expect(bill.amendmentAuthors).toEqual([{ pspId: 100, name: "Novák Petr", count: 2 }]);
    expect(forensicBill.speakers).toEqual([]);
    expect(forensicBill.amendmentAuthors).toEqual([]);
    expect(bill.committees.map((c) => [c.role, c.organLabel])).toEqual([
      ["garancni", "rozpočtový výbor"],
      ["dalsi", "ústavně právní výbor"],
    ]);
    expect(bill.committees[0].assignedOn).toBe("2026-01-15");
    expect(data.committeeRoutedBills).toBe(1);

    // Census provenance is kept HONESTLY SEPARATE from the title-derived amends edges.
    const census = data.bills.find((b) => b.cislo === 120)!;
    expect(census.amendedLawsFull).toEqual(["586/1992", "40/2009"]); // the 42 is dropped
    expect(census.amendedLaws.map((l) => l.ref)).toEqual(["586/1992"]);
    expect(census.amendsUndercount).toBe(1);
    expect(data.censusBillCount).toBe(1);
    expect(data.censusUndercountTotal).toBe(1);
  });

  it("findBillByCislo navigates by PRINT NUMBER, not the relevance sort", async () => {
    const data = (await withReadinessOff(getLawData))!;
    const d = findBillByCislo(data, 120)!;
    expect(d.bill.cislo).toBe(120);
    // ring over [4, 120, 244] — ascending print number, not the [244, 4, 120] render order
    expect([d.prevCislo, d.nextCislo]).toEqual([4, 244]);
    expect(findBillByCislo(data, 4)!.prevCislo).toBe(244); // cyclic
    expect(findBillByCislo(data, 99999)).toBeNull();
  });

  it("returns null and leaves a trace when the graph is below the readiness floor", async () => {
    // 4 bills / 2 laws are far below CARDINALITY_FLOORS (bill 100, law 70).
    await expectTracedDegradation("storeReady", getLawData);
  });
});

describe("getCollisionData (forensic leads, never verdicts)", () => {
  beforeAll(ensureSeeded);

  it("clusters non-incidental pairs by (statute, §) and resolves titles from the graph", async () => {
    // No readiness gate on this loader by design — it is payload-driven.
    const data = (await getCollisionData())!;
    expect(data).not.toBeNull();
    expect(data.clusters.length).toBeGreaterThan(0);
    expect(data.clusterCount).toBe(data.clusters.length);
    // Derived from the pairs actually loaded, not a constant — the hardcoded `5` it replaced
    // silently under-reported the moment batch-008's payload was wired in (batch-009).
    expect(data.batchesRun).toBe(new Set(data.clusters.flatMap((c) => c.pairs.map((p) => p.sourceBatch))).size);

    // The two narrated batch-001/002 pairs are hardcoded, so they are always present —
    // and their § loci are exact. "35ba" must NOT be truncated into a "35b" cluster.
    const keys = data.clusters.map((c) => c.key);
    expect(keys).toContain("586/1992§35ba");
    expect(keys).toContain("40/2009§88");

    const tax = data.clusters.find((c) => c.key === "586/1992§35ba")!;
    expect(tax.lawRef).toBe("586/1992");
    expect(tax.lawTitle).toBe("Zákon o daních z příjmů"); // from the seeded law node
    expect(tax.classification).toBe("confirmed-collision");
    // Bills are looked up by props.cislo (the public print number), not the node id.
    const byCislo = new Map(tax.bills.map((b) => [b.cislo, b.title]));
    expect(byCislo.get(120)).toBe("Novela zákona o pojistném");
    expect(byCislo.get(244)).toBe("Novela trestního zákoníku");

    // No incidental noise leaks through; every classification stays in-vocabulary and
    // every lead cites the method that produced it.
    for (const c of data.clusters) {
      expect(COLLISION_CLASSIFICATIONS).toContain(c.classification);
      for (const p of c.pairs) {
        expect(COLLISION_CLASSIFICATIONS).toContain(p.classification);
        expect(p.sourceMethod.length).toBeGreaterThan(0);
        // Czech-first presentation gate: a rendered analysis is either Czech or withheld —
        // an English string must never reach `reasoning`.
        expect(p.reasoning === null || !/(?<![\p{L}])(the|and|both|which|that)(?![\p{L}])/iu.test(p.reasoning)).toBe(true);
        if (p.reasoning !== null) expect(p.reasoningWithheld).toBe(false);
      }
    }
    expect(data.confirmedPairCount + data.coordinationRiskPairCount).toBe(
      data.clusters.reduce((s, c) => s + c.pairs.length, 0),
    );
    expect(data.nWayClusterCount).toBe(data.clusters.filter((c) => c.bills.length >= 3).length);
  });

  it("renders every analysis in Czech or withholds it — the presentation gate, over the real payloads", async () => {
    // Regression lock for batch-009. Two defects this catches, both of which shipped silently:
    //   1. All 44 rendered `reasoning` strings were English analyst prose on a `lang="cs"`
    //      public-accountability surface (measured 44/44 by scoreLanguage).
    //   2. batch-008's payload spells its classifications `confirmed` / `coordination_risk`,
    //      so wiring its filename without normalizing dropped all 12 of its pairs at the
    //      filter — a failure indistinguishable from "that batch found nothing".
    const data = (await getCollisionData())!;
    const pairs = data.clusters.flatMap((c) => c.pairs);

    for (const p of pairs) {
      if (p.reasoning === null) continue;
      const score = scoreLanguage(p.reasoning);
      expect(score.looksEnglish, `pair ${p.pairId} renders English prose: ${score.reason}`).toBe(false);
    }
    expect(data.czechPendingCount).toBe(pairs.filter((p) => p.reasoningWithheld).length);

    // batch-008's pairs must survive the vocabulary normalization, not vanish at the filter.
    expect(pairs.some((p) => p.sourceBatch === 8)).toBe(true);
  });

  it("sorts confirmed clusters first, then by bill count (N-way leads lead)", async () => {
    const data = (await getCollisionData())!;
    const rank = (c: { classification: string; bills: unknown[] }) =>
      (c.classification === "confirmed-collision" ? 0 : 1) * 1e6 - c.bills.length;
    const ranks = data.clusters.map(rank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("renders a bill with no resolvable graph node as a null title, never a guess", async () => {
    const data = (await getCollisionData())!;
    const unseeded = data.clusters.flatMap((c) => c.bills).filter((b) => ![4, 120, 244].includes(b.cislo));
    for (const b of unseeded) expect(b.title).toBeNull();
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · /poslanec — getProfileData
 * ──────────────────────────────────────────────────────────────────────────── */

describe("getProfileData against a seeded graph", () => {
  beforeAll(ensureSeeded);

  it("places the MP in the real ranking with a cyclic prev/next file ring", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    expect(p).not.toBeNull();
    // scores 80 / 80 / 70 / 60 → ranks Adamec(1), Beneš(2), Nováková(3), Cimrman(4)
    expect(p.person.rank).toBe(3);
    expect(p.person.name).toBe("Nováková Jana");
    expect(p.person.score).toBe(70);
    expect(p.total).toBe(4);
    expect([p.prevPspId, p.nextPspId]).toEqual([250, 300]);
    // club + region come from the mandate/organ tree, not from the person node
    expect(p.person.clubAbbrev).toBe("ODS");
    expect(p.person.region).toBe("Praha"); // regionLabel's special case, not "… kraj"
    expect(p.components.map((c) => c.key)).toEqual([
      "participation",
      "committee",
      "legislative",
      "speech",
      "attendance",
      "leadership",
    ]);
    expect(p.provenancePass).toBe(30);
  });

  it("shows each committee ONCE at its highest still-open role (no chimera rows)", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    // Two membership rows on organ 300 (member, open + předseda, ended) → ONE seat,
    // plus organ 301 (the unreadable-end-date seat asserted below).
    expect(p.committees).toHaveLength(2);
    const seat = p.committees.find((c) => c.abbrev === "VHZD")!;
    expect(seat.organType).toBe("Výbor");
    expect(seat.role).toBe("member"); // NOT "chair" — that row is closed
    expect(seat.current).toBe(true);
    expect(seat.toAt).toBeNull(); // every field of the seat comes from ONE row
    expect(seat.toAtUnreadable).toBe(false);
    expect(p.committees.some((c) => c.abbrev === "ODS")).toBe(false); // a club is not a committee
  });

  it("an unreadable seat end-date is FLAGGED, never rendered as an ended seat", async () => {
    // A legal `timestamptz` the app cannot parse ('infinity'). Two defects met here:
    // the mapper used to throw RangeError on it and take the WHOLE dossier down to
    // DataUnavailable, and — once that was fixed — Date.parse(toAt) > now() is false,
    // so the seat would have rendered as PAST. Neither is what the data says.
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    expect(p).not.toBeNull();
    const seat = p.committees.find((c) => c.abbrev === "KOM")!;
    expect(seat).toBeDefined();
    expect(seat.toAtUnreadable).toBe(true);
    expect(seat.current).toBe(true); // an unreadable date proves nothing about it having ended
  });

  it("states the date the current/past seat split was evaluated against", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    expect(p.seatsAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("drops co_votes_with edges with a malformed endpoint and ranks allies by agreement", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    expect(p.coVoters.map((c) => c.pspId)).toEqual([200, 300]); // "rozbity" dropped, not NaN
    expect(p.coVoters.every((c) => Number.isFinite(c.pspId))).toBe(true);
    expect(p.coVoters[0].agreement).toBeCloseTo(0.91, 5);
    expect(p.coVoters[0].shared).toBe(120);
    expect(p.coVoters[0].clubAbbrev).toBe("—"); // Adamec has no mandate → honest dash
  });

  it("reads rebellions and the honest extra signals off the graph", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    expect(p.rebellions).toEqual([
      // Od 2026-08-13 nese každý řádek i svůj původ — spis u agregátu tiskne
      // citaci, která má pojmenovat průchod, ref a den přepočtu. Fixture zapisuje
      // hranu s `'{}'::jsonb`, takže všechny tři jsou POCTIVĚ null a spis vykreslí
      // svou větu „hrana průchod ani den neuvádí" místo vymyšleného čísla.
      // Shoda je záměrně PŘESNÁ: kdyby se sem přidalo pole a nikdo o něm
      // nerozhodl, tenhle řádek spadne dřív, než se dostane ke čtenáři.
      {
        club: "ODS",
        rate: expect.closeTo(0.12, 5),
        rebelVotes: 3,
        eligibleVotes: 25,
        pass: null,
        ref: null,
        computedAt: null,
      },
    ]);
    // rebellion_rate / contested_vote_rebellion are NOT returned: they were shipped
    // to the client for months and rendered nowhere.
    expect(p).not.toHaveProperty("rebellionRate");
    expect(p).not.toHaveProperty("contestedRebellion");
    expect(p.effortTenureDays).toBe(260);
    expect(p.effortTenureClass).toBe("full-term");
    expect(p.effortTenureEnd).toBeNull(); // absent prop → null, never a fabricated date
    expect(p.effortWorkThemes).toEqual(["doprava", "rozpočet"]); // non-string entry dropped
  });

  it("builds sponsored-bill links from `cislo`, never the internal tiskId", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    expect(p.sponsoredBills).toEqual([
      {
        cislo: 4,
        title: "Novela zákona o daních z příjmů",
        url: "https://www.psp.cz/sqw/historie.sqw?o=10&t=4",
        appUrl: "/zakony/4",
        // pass-34 role + fate: signature rank from the edge props, fate from the node
        role: "predkladatel",
        joinedLater: false,
        stav: "Senát",
        fateSb: "583/2025",
      },
      // no `cislo` → the title renders with NO link rather than a broken one; an
      // edge predating the roles backfill honestly carries null role/fate, nothing invented
      { cislo: null, title: "Tisk bez čísla", url: null, appUrl: null, role: null, joinedLater: false, stav: null, fateSb: null },
    ]);
    expect(p.sponsoredBills[0].url).not.toContain("43111");
  });

  it("resolves rapporteur (zpravodaj) bills with their scopes", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    expect(p.rapporteurBills).toEqual([
      {
        cislo: 244,
        title: "Novela trestního zákoníku",
        url: "https://www.psp.cz/sqw/historie.sqw?o=10&t=244",
        appUrl: "/zakony/244",
        scopes: ["zpravodaj_vyboru"],
      },
    ]);
  });

  it("surfaces the work record per bill, not as a bare count", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    // spoke_on / proposes_amendment ride the SAME neighbour read as everything else,
    // and both resolve to the print number — never the internal tiskId.
    expect(p.floorSpeeches).toEqual([
      {
        cislo: 4,
        title: "Novela zákona o daních z příjmů",
        url: "https://www.psp.cz/sqw/historie.sqw?o=10&t=4",
        appUrl: "/zakony/4",
        count: 3,
        // spoke_on carries no sněmovní dokument — the shared mapper yields an
        // empty list, and the dossier only opens the document line for amendments.
        sdCislos: [],
      },
    ]);
    expect(p.floorSpeechTurns).toBe(3);
    expect(p.amendmentBills).toEqual([
      {
        cislo: 4,
        title: "Novela zákona o daních z příjmů",
        url: "https://www.psp.cz/sqw/historie.sqw?o=10&t=4",
        appUrl: "/zakony/4",
        count: 2,
        // the seeded edge carries props.sd_cislos [3, 4] — projected and sorted,
        // proving the amendment-document numbers survive the read end-to-end
        sdCislos: [3, 4],
      },
    ]);
    expect(p.amendmentBillCount).toBe(2);
  });

  it("reads the three index counters off the node, so ABSENT never renders as zero", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    expect(p.speechTurnsTotal).toBe(10); // the whole floor record; spoke_on covers 3 of it
    expect(p.interpellations).toBe(1);
    expect(p.absenceRate).toBe(0.1);
    // Person 300 carries the same counters; a node missing one must yield null, not 0 —
    // pinned here on the field that is genuinely absent from BASE_COUNTERS.
    expect(p.amendmentsAuthored).toBeNull();
  });

  it("returns an empty engagement record for an MP with no such edges", async () => {
    const p = (await withReadinessOff(() => getProfileData(300)))!;
    expect(p.floorSpeeches).toEqual([]);
    expect(p.amendmentBills).toEqual([]);
    expect(p.floorSpeechTurns).toBe(0);
    expect(p.amendmentBillCount).toBe(0);
  });

  it("renders money ties as pending_review facts and sums ONLY attributable money", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    expect(p.money.ties).toHaveLength(1); // the GHOST-company edge belongs to person 300
    const tie = p.money.ties[0];
    expect(tie.company).toBe("Alfa s.r.o.");
    expect(tie.ico).toBe("111");
    expect(tie.tieClass).toBe("owner-operator");
    expect(tie.reviewState).toBe("pending_review"); // nothing here is a settled finding
    expect(tie.source).toBe("hlidac:osoby/petr-novak · 2016-01-01–ongoing"); // cited verbatim
    expect(tie.corroboration).toBe("registry-confirmed");
    expect(tie.contractCount).toBe(2);
    expect(tie.contractCzk).toBe(6_900_000);
    // The tie carries its PERMANENT address and its company's case file — the spis
    // is not a dead end above evidence that has its own pages.
    expect(decodeClaimRef(tie.receiptRef)).toEqual({
      kind: "edge",
      src: "psp:person:100",
      rel: "linked_to",
      dst: ALFA,
    });
    expect(tie.companyHref).toBe("/penize/firma/00000111");
    expect(p.money.reach!.attributable.contractCzk).toBe(6_900_000);
    expect(p.money.reach!.attributable.contractCount).toBe(2);
    expect(p.money.attributableFigure!.value).toBe(6_900_000);
    expect(p.money.unavailable).toBe(false);
    expect(p.money.pendingTies).toBe(1);
    expect(p.money.verifiedTies).toBe(0);
    expect(p.money.stewardTies).toBe(0);
    expect(p.money.pass).toBe(42);
  });

  it("keeps a contract whose signature date could not have happened, WITHOUT the date", async () => {
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    const lines = p.money.ties[0].topContracts;
    expect(lines.map((l) => l.amountCzk)).toEqual([5_000_000, 1_900_000]); // biggest first
    expect(lines[0].signedOn).toBe("2024-03-01");
    expect(lines[0].dateUnusable).toBe(false);
    // year 3062 — the row and its money survive, the date does not, and it is COUNTED
    expect(lines[1].signedOn).toBeNull();
    expect(lines[1].dateUnusable).toBe(true);
    expect(lines[1].amountCzk).toBe(1_900_000);
    expect(p.money.unusableDates).toBe(1);
  });

  it("never attributes a steward seat's institutional money to the MP", async () => {
    // Person 200 sits on a regional hospital's supervisory board (steward) and is
    // `jednatel` of Gama (owner-operator, tie rejected). The hospital's contracting is
    // the hospital's — the loader does not even read it, and the profile sums nothing.
    const p = (await withReadinessOff(() => getProfileData(200)))!;
    const steward = p.money.ties.find((t) => t.company === "Krajská nemocnice a.s.")!;
    expect(steward.tieClass).toBe("steward");
    expect(steward.contractCzk).toBeNull();
    expect(steward.contractCount).toBeNull();
    expect(steward.topContracts).toEqual([]);
    expect(p.money.stewardTies).toBe(1);
    expect(p.money.reach!.attributable.contractCzk).toBe(0); // Gama supplies nothing
    // Review state is rendered as stored — "verified"/"rejected" are not flattened away.
    expect(steward.reviewState).toBe("verified");
    expect(p.money.ties.find((t) => t.company === "Gama s.r.o.")!.reviewState).toBe("rejected");
    // Attributable classes sort ahead of stewards: the file's own claim comes first.
    expect(p.money.ties.map((t) => t.tieClass)).toEqual(["owner-operator", "steward"]);
  });

  it("drops a money tie whose company node does not exist rather than guessing", async () => {
    const p = (await withReadinessOff(() => getProfileData(300)))!;
    expect(p.money.ties).toEqual([]);
    expect(p.money.reach).toBeNull();
    // …and an unresolvable tie is NOT an outage: the section says "no ties", which is
    // what the graph supports, rather than "the money layer is down".
    expect(p.money.unavailable).toBe(false);
  });

  it("prints the SAME attributable money as /penize, from the same claim", async () => {
    // The spis used to run its own `supplies` read and its own per-TIE sum — a fourth
    // implementation of reachable money, measurably divergent from /penize on the live
    // store (Hladík 6881: 23 790 791 881,98 vs 23 570 594 009,66 Kč, because the spis
    // fell back to `contract.amount` where the money layer takes `supplies.weight`
    // only). Both surfaces now read ONE loader and mint ONE claim, so a future fork
    // fails here instead of shipping two numbers about one person.
    const p = (await withReadinessOff(() => getProfileData(100)))!;
    const caseFile = (await withReadinessOff(() => getMoneyMpDetail(100)))!;
    expect(p.money.reach).toEqual(caseFile.money);
    const spisFigure = p.money.attributableFigure!;
    const caseFigure = mpBucketClaim(
      caseFile.pspId,
      "owned",
      caseFile.money.attributable,
      caseFile.ties.filter((t) => isAttributable(t.tieClass)).map((t) => t.reviewState),
      caseFile.pass,
    );
    // Same value AND same address: /overeni re-derives the citation through the very
    // loader the case file uses, so a ref copied off the spis must resolve there.
    expect(spisFigure.value).toBe(caseFigure.value);
    expect(spisFigure.claim).toEqual(caseFigure.claim);
    expect(spisFigure.claim.metric).toBe(MONEY_METRIC.mpOwned);
    // Every tie the case file publishes is on the spis, with the same receipt.
    expect(p.money.ties.map((t) => t.receiptRef).sort()).toEqual(
      caseFile.ties.map((t) => t.receiptRef).sort(),
    );
  });

  it("returns null for an MP absent from the ranking", async () => {
    expect(await withReadinessOff(() => getProfileData(99999))).toBeNull();
  });

  it("getAllProfilePspIds enumerates the ranking, and degrades to an EMPTY list", async () => {
    expect(await withReadinessOff(getAllProfilePspIds)).toEqual([200, 250, 100, 300]);
    // Below the floor the static-params source yields [] rather than throwing — the
    // route pre-renders nothing instead of failing the build. Cold memo, same reason
    // as expectTracedDegradation.
    resetLeaderboardMemo();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await getAllProfilePspIds()).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it("returns null and leaves a trace when the graph is below the readiness floor", async () => {
    await expectTracedDegradation("storeReady", () => getProfileData(100));
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · /graf — graphLoader over the seeded graph
 * ──────────────────────────────────────────────────────────────────────────── */

describe("graphLoader over a seeded graph", () => {
  beforeAll(ensureSeeded);

  // A fresh module instance clears the three memoised promises; open() stays memoised on
  // globalThis, so this reuses the SAME PGlite connection (the single-connection rule).
  const fresh = async () => {
    vi.resetModules();
    return import("../../features/graph/graphLoader");
  };

  it("fold() strips diacritics so 'novak' finds 'Nováková'", async () => {
    const g = await fresh();
    expect(g.fold("Nováková")).toBe("novakova");
    expect(await g.searchGraph("novak", null)).toHaveLength(1);
    expect((await g.searchGraph("NOVÁK", null))[0].label).toBe("Nováková Jana");
    expect(await g.searchGraph("a", null)).toEqual([]); // needle < 2 chars
    expect(await g.searchGraph("alfa", ["person"])).toEqual([]); // kind filter honoured
    expect((await g.searchGraph("alfa", ["company"]))[0].id).toBe(ALFA);
  });

  it("getGraphSeed censuses only KNOWN node kinds and suggests the best-connected", async () => {
    const g = await fresh();
    const seed = (await g.getGraphSeed())!;
    expect(seed).not.toBeNull();
    // An unrecognised kind is refused entry to the canvas — and to the totals.
    expect(seed.census.map((c) => c.kind)).not.toContain("mimozemstan");
    expect(seed.totalNodes).toBe(FIXTURE.knownKindNodes);
    expect(seed.totalEdges).toBe(FIXTURE.edges); // counts ALL edges, incl. co_votes_with
    expect(seed.census.reduce((s, c) => s + c.count, 0)).toBe(seed.totalNodes);
    // Entry points are persons/companies by degree desc — an isolated node is useless.
    expect(seed.suggested.every((n) => n.kind === "person" || n.kind === "company")).toBe(true);
    expect(seed.suggested[0].id).toBe("psp:person:100");
  });

  it("getMapData lays out every node in-world and keeps co_votes_with off the canvas", async () => {
    const g = await fresh();
    const map = (await g.getMapData())!;
    expect(map).not.toBeNull();
    expect(map.nodes).toHaveLength(FIXTURE.knownKindNodes);
    expect(map.edges.some((e) => e.rel === "co_votes_with")).toBe(false);
    // Batch 013: the canvas now emits edges only BETWEEN NODES IT DREW. That drops the
    // fixture's deliberate ghost edge (a linked_to whose company node does not exist),
    // which the map used to hand the renderer as a line into nowhere. co_votes_with (3)
    // plus that ghost (1) are the two exclusions.
    expect(map.edges).toHaveLength(FIXTURE.edges - FIXTURE.coVotesEdges - 1);
    expect(map.edges.some((e) => e.dst === GHOST)).toBe(false);
    for (const n of map.nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(map.world.width);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(map.world.height);
    }
    // A contract sits on the ring around its supplier, not parked in a corner.
    const supplier = map.nodes.find((n) => n.id === ALFA)!;
    const contract = map.nodes.find((n) => n.id === "kg:contract:1")!;
    expect(Math.hypot(contract.x - supplier.x, contract.y - supplier.y)).toBeLessThan(60);
    // A machine claim awaiting human review draws dashed — the tie must stay labelled.
    expect(map.edges.find((e) => e.rel === "linked_to" && e.dst === ALFA)!.pending).toBe(true);
    expect(map.edges.find((e) => e.rel === "linked_to" && e.dst === NEMOCNICE)!.pending).toBe(false);
    // The contract layer is BOUNDED per supplier and the payload says so, so the map can
    // never imply it is showing the whole corpus (batch 012 grew it to 152 788 contracts;
    // drawing them all would ship >150k nodes to the browser).
    expect(map.omitted.perSupplierCap).toBeGreaterThan(0);
    expect(map.omitted.contractsShown).toBeLessThanOrEqual(map.omitted.contractsTotal);
    expect(map.nodes.filter((n) => n.kind === "contract")).toHaveLength(map.omitted.contractsShown);
    // Memoised for the process: the same object comes back.
    expect(await g.getMapData()).toBe(map);
  });

  it("getTrails computes the curated answers and assigns a distinct order per column", async () => {
    const g = await fresh();
    const trails = (await g.getTrails())!;
    expect(trails).not.toBeNull();
    expect(trails.map((t) => t.key)).toEqual([
      "penize-poslancu",
      "nejnovelizovanejsi",
      "darci-stran",
      "vybory-a-penize",
    ]);

    const money = trails.find((t) => t.key === "penize-poslancu")!;
    // Money reachable through firms = supplies weights + the subsidies prop.
    expect(money.nodes.find((n) => n.id === "psp:person:100")!.moneyCzk).toBe(8_900_000);
    expect(money.nodes.find((n) => n.id === ALFA)!.moneyCzk).toBe(8_900_000);
    expect(money.edges.find((e) => e.dst === ALFA)!.pending).toBe(true);

    // Only firms that actually donated appear in the donor trail.
    const donors = trails.find((t) => t.key === "darci-stran")!;
    expect(donors.nodes.filter((n) => n.kind === "company").map((n) => n.id)).toEqual([ALFA]);

    // The order-per-column pass is load-bearing: without it a whole column collapses
    // onto order 0 and the trail renders as three nodes.
    for (const t of trails) {
      const perColumn = new Map<number, number[]>();
      for (const n of t.nodes) perColumn.set(n.column, [...(perColumn.get(n.column) ?? []), n.order]);
      for (const [, orders] of perColumn) {
        expect(new Set(orders).size).toBe(orders.length);
        expect([...orders].sort((a, b) => a - b)).toEqual([...Array(orders.length).keys()]);
      }
    }
  });

  it("getNodeDetail returns cited facts, provenance and registry deep-links", async () => {
    const g = await fresh();
    const detail = (await g.getNodeDetail("psp:person:100", "cs"))!;
    expect(detail).not.toBeNull();
    expect(detail.node.label).toBe("Nováková Jana");
    expect(detail.provenance).toEqual({
      pass: 30,
      method: "kg-compute",
      ref: "psp.cz",
      computedAt: "2026-07-24",
    });
    // The graph key stays readable so a reader knows WHICH field is on screen.
    expect(detail.facts.map((f) => f.label)).toContain("contribution score");
    expect(detail.facts.map((f) => f.label)).toContain("committee count");
    expect(detail.citableId).toBeTruthy();
    expect(detail.degree).toBeGreaterThan(0);

    // CZK-suffixed props format as money, never a raw JS number.
    const company = (await g.getNodeDetail(ALFA, "cs"))!;
    const subsidies = company.facts.find((f) => f.label === "subsidies total czk")!;
    expect(subsidies.value).not.toBe("2000000");
    expect(subsidies.value).toMatch(/\d/);

    // Unknown id and unknown kind both degrade to null, never a half-shaped node.
    expect(await g.getNodeDetail("psp:person:neexistuje", "cs")).toBeNull();
    expect(await g.getNodeDetail("kg:mimozemstan:1", "cs")).toBeNull();
  });

  it("a MISSING node is not an outage — it leaves no failure trace", async () => {
    // getNodeDetail answers null for both "the store is down" and "no such node",
    // and getPermalinkData disambiguates them for the READER with a second probe.
    // The observability layer must keep the same two answers apart: a node that was
    // never in the graph (or a kind the canvas refuses) is a fact about the graph,
    // not a degradation — reporting it would fill the log and Sentry with outages
    // that never happened, which is how a real one stops being noticed.
    const g = await fresh();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await g.getNodeDetail("psp:person:neexistuje", "cs")).toBeNull();
      expect(await g.getNodeDetail("kg:mimozemstan:1", "cs")).toBeNull();
      const traces = spy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(traces).not.toContain("[loader:graphLoader.getNodeDetail]");
    } finally {
      spy.mockRestore();
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · /hlasovani — getVoteThemes
 * ──────────────────────────────────────────────────────────────────────────── */

describe("getVoteThemes", () => {
  beforeAll(ensureSeeded);

  it("reports a NEVER-COMPUTED layer, which is not the outage null (2026-08-12)", async () => {
    // The fixture seeds no vote_tag rows; this loader has no readiness gate by design
    // (vote_tag is a derived enrichment, not a cardinality-floored ingest slice).
    // Until 2026-08-12 the contract was "no tags → null → the section hides", which
    // made an uncomputed layer indistinguishable from an unreadable store — and the
    // rail kept pointing at the #temata anchor either way. The read SUCCEEDED here,
    // so the answer is the third state, and /hlasovani has its own sentence for it.
    expect(await getVoteThemes()).toEqual({ state: "never-computed" });
  });

  it("joins tags to roll calls, newest first, and counts themes by frequency", async () => {
    const pg = await open();
    await pg.query(
      `insert into vote_event (id, psp_id, term_psp_id, term_code, kind, outcome, title_long, title_norm, voted_on, source, source_url, fetched_at)
       values
        ('v:1', 1, 10, 'PSP10', 'normal', 'prijato',   'Novela zákona o daních z příjmů', 'novela', '2026-03-01', 'psp.cz', 'https://psp.cz', now()),
        ('v:2', 2, 10, 'PSP10', 'normal', 'zamitnuto', 'Rozpočet 2026',                   'rozpocet', '2026-05-01', 'psp.cz', 'https://psp.cz', now())`,
    );
    await pg.query(
      `insert into vote_tag (id, vote_psp_id, theme, confidence, model, method, tagged_at)
       values
        ('t:1', 1, 'dane',     0.9, 'haiku', 'sem_classify', now()),
        ('t:2', 2, 'rozpocet', 0.8, 'haiku', 'sem_classify', now()),
        ('t:3', 3, 'rozpocet', 0.7, 'haiku', 'sem_classify', now())`,
    );

    const read = (await getVoteThemes())!;
    expect(read).not.toBeNull();
    // A materialized layer answers `ready` — the state the section renders from.
    expect(read.state).toBe("ready");
    const data = read.state === "ready" ? read.data : null!;

    // Newest roll call first (votedOn desc, lexicographic on RFC3339 dates).
    expect(data.votes.map((v) => v.votePspId)).toEqual([2, 1, 3]);
    expect(data.votes[0].title).toBe("Rozpočet 2026");
    expect(data.votes[0].outcome).toBe("zamitnuto");
    expect(data.votes[0].votedOn).toBe("2026-05-01");

    // A tag whose roll call is missing is kept but NOT dressed up with an invented
    // title/outcome — it degrades to its own id and empty fields.
    const orphan = data.votes.find((v) => v.votePspId === 3)!;
    expect(orphan.title).toBe("#3");
    expect(orphan.outcome).toBe("");
    expect(orphan.votedOn).toBeNull();

    // Theme facets ordered by count desc, from the real group-by.
    expect(data.themes).toEqual([
      { slug: "rozpocet", count: 2 },
      { slug: "dane", count: 1 },
    ]);
    expect(data.total).toBe(3);
    expect(data.total).toBe(data.votes.length);
    // A derived tag always names the model that made it.
    expect(data.model).toBe("haiku");
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · /admin — getAdminData ("degrade to partial, never crash")
 * ──────────────────────────────────────────────────────────────────────────── */

describe("getAdminData", () => {
  beforeAll(ensureSeeded);

  it("mirrors the /penize/kontrola queue: same drop rule, same tier split", async () => {
    const data = await getAdminData();
    const ties = data.reviewHub.ties!;
    expect(ties).not.toBeNull();
    // 4 linked_to rows, one with an unresolved company → dropped, never guessed at.
    // (This dashboard exists to MONITOR the console; a different drop rule would let
    // the two silently diverge.)
    expect(ties.total).toBe(3);
    expect(ties.verified).toBe(1);
    expect(ties.pending).toBe(1);
    expect(ties.rejected).toBe(1);
    expect(ties.verified + ties.pending + ties.rejected).toBe(ties.total);
    // tier0 = registry-confirmed owner-operator, tier2 = registry-confirmed steward,
    // tier3 = corroboration not yet run.
    expect(ties.tiers).toEqual({ tier0: 1, tier1: 0, tier2: 1, tier3: 1 });
    expect(ties.kontrolaHref).toBe("/penize/kontrola");

    // Cross-loader consistency: the console's pending count is this dashboard's.
    const queue = await withReadinessOff(getVerificationQueue);
    expect(queue!.stats.pending).toBe(ties.pending);
  });

  it("surfaces gated forensic verdicts without promoting them to settled fact", async () => {
    const data = await getAdminData();
    const f = data.reviewHub.forensic!;
    expect(f).not.toBeNull();
    expect(f.total).toBe(1); // bills with no forensic_* props are not invented into one
    expect(f.bySeverity).toEqual({ high: 1 });
    expect(f.items[0]).toMatchObject({
      tiskId: 43222,
      cislo: 244,
      severity: "high",
      reviewState: "pending_review",
    });
    expect(f.zakonyHref).toBe("/zakony");
  });

  it("summarises the human-gate audit trail newest-first", async () => {
    const data = await getAdminData();
    const audit = data.reviewHub.audit!;
    expect(audit).not.toBeNull();
    expect(audit.totalDecisions).toBe(3);
    expect(audit.byDecision).toEqual({ confirm: 1, reject: 1, "needs-more": 1 });
    expect(audit.byReviewer).toEqual({ tester: 2, "druhý recenzent": 1 });
    expect(audit.lastDecidedAt).toContain("2026-07-03");
  });

  it("reports real graph totals and the loop state it READ (never a constant)", async () => {
    const data = await getAdminData();
    const g = data.systemState.graph!;
    expect(g).not.toBeNull();
    // Unlike the canvas census, the operator view counts EVERY row, unknown kinds
    // included — an unrecognised kind is exactly what an operator needs to see.
    expect(g.nodes).toBe(FIXTURE.knownKindNodes + FIXTURE.unknownKindNodes);
    expect(g.edges).toBe(FIXTURE.edges);
    expect(Object.values(g.nodesByKind).reduce((s, n) => s + n, 0)).toBe(g.nodes);
    expect(Object.values(g.edgesByRel).reduce((s, n) => s + n, 0)).toBe(g.edges);
    expect(g.nodesByKind.mimozemstan).toBe(1);
    expect(g.edgesByRel.linked_to).toBe(4);
    // Until 2026-08-12 this asserted a hardcoded `loopsPaused === true` while
    // docs/case-loops.md had said RUNNING since 2026-07-25 — the test pinned the
    // lie. The state is now DERIVED from that document's STATUS line, so this
    // re-derives it independently (own fs read + the pure parser) rather than
    // freezing a value the document is free to change.
    const { parseLoopsStatus, LOOPS_STATUS_SOURCE } = await import("../../features/admin/loops/loopState");
    const { readFileSync } = await import("node:fs");
    const expected = parseLoopsStatus(readFileSync(LOOPS_STATUS_SOURCE, "utf8"));
    expect(data.systemState.loopsRunState).toBe(expected.state);
    expect(data.systemState.loopsStatusLabel).toBe(expected.labelCs);
    expect(data.systemState.loopsStatusSource).toBe(LOOPS_STATUS_SOURCE);
    expect(data.systemState.loopsStatusLabel.length).toBeGreaterThan(0);
  });

  it("reads the three case ledgers off disk, each degrading independently", async () => {
    const data = await getAdminData();
    expect(data.loopProgress.map((p) => p.case)).toEqual(["money", "effort", "law"]);
    for (const p of data.loopProgress) {
      // Every slice cites where its numbers came from — the brand rule.
      expect(p.source.length).toBeGreaterThan(0);
      expect(p.labelCs.length).toBeGreaterThan(0);
      // "degrade to partial, never crash": a missing/drifted ledger yields nulls only.
      if (p.progressPct != null) {
        expect(p.progressPct).toBeGreaterThanOrEqual(0);
        expect(p.progressPct).toBeLessThanOrEqual(100);
        expect(p.unitsProcessed).not.toBeNull();
        expect(p.unitsTotal).not.toBeNull();
      }
      expect(p.latestHeadline == null || p.latestHeadline.length <= 320).toBe(true);
    }
  });

  it("parses the shared vault pass log into an ordered head", async () => {
    const data = await getAdminData();
    const { lastPass, recentPasses } = data.vaultHeads;
    expect(recentPasses.length).toBeLessThanOrEqual(3);
    expect(data.systemState.lastPass).toBe(lastPass);
    if (recentPasses.length > 0) {
      expect(recentPasses[0].pass).toBe(lastPass); // newest first
      expect([...recentPasses].sort((a, b) => b.pass - a.pass)).toEqual(recentPasses);
      for (const e of recentPasses) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("money leads stay gated proposals with a stable id order", async () => {
    const data = await getAdminData();
    const leads = data.reviewHub.leads;
    expect(Array.isArray(leads)).toBe(true);
    expect([...leads].sort((a, b) => a.leadId.localeCompare(b.leadId))).toEqual(leads);
    for (const l of leads) {
      expect(l.leadId.length).toBeGreaterThan(0);
      expect(l.note == null || l.note.length <= 280).toBe(true);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · /zebricek — getLeaderboardData
 *
 * Absorbed from lib/testing/leaderboard-loader.test.ts (commit 366e866, the ADR's
 * first loader test) so the loader layer keeps to ONE PGlite boot — see WHY ONE FILE
 * at the top. Every assertion it made is preserved in intent against this fixture;
 * the "no mandates seeded → every club is an honest —" case became "the ONE MP with a
 * mandate gets a real club, the other three keep the dash", which pins the same rule
 * from the side that can actually regress.
 * ──────────────────────────────────────────────────────────────────────────── */

describe("getLeaderboardData against a seeded store", () => {
  beforeAll(ensureSeeded);

  it("ranks by score desc with a cs-locale name tiebreak and builds real aggregates", async () => {
    const built = (await withReadinessOff(buildLeaderboard))!;
    expect(built).not.toBeNull();
    const { data, directory } = built;

    // Two MPs on 80.0 SHARE rank 1 — competition ranking (1, 2, 2, 4 in the general
    // case), so no rank is decided by where a name falls in the alphabet. The
    // ORDER within the tie is still Czech collation (Adamec before Beneš, never
    // insertion order) because the output has to be deterministic; the page says
    // that order means nothing. Nováková still holds the 3rd place she really
    // occupies, so "rank N of 207" keeps its meaning.
    expect(data.entries.map((e) => [e.rank, e.name, e.score])).toEqual([
      [1, "Adamec Alois", 80],
      [1, "Beneš Bohumil", 80],
      [3, "Nováková Jana", 70],
      [4, "Cimrman Jára", 60],
    ]);
    // …and each entry can SAY whether its rank is shared, without reordering anything.
    expect(data.entries.map((e) => e.tiedCount)).toEqual([2, 2, 1, 1]);

    // A club is claimed only where a mandate proves one; the rest keep an honest dash.
    expect(data.entries.filter((e) => e.clubAbbrev !== "—").map((e) => e.pspId)).toEqual([100]);
    expect(data.clubs.map((c) => [c.abbrev, c.seats])).toEqual([["ODS", 34]]); // seats from the party node

    // Aggregates come from the real rows, not a mock.
    expect(data.summary.count).toBe(4);
    expect(data.summary.avg).toBe(72.5);
    expect(data.summary.median).toBe(75);
    expect(data.provenancePass).toBe(30);

    // Histogram bands span the real score range in 5-pt steps: 60..80.
    expect(data.histogram[0].from).toBe(60);
    expect(data.histogram.at(-1)!.from).toBe(80); // the 80,0 maximum must land INSIDE a band
    expect(data.histogram.reduce((s, h) => s + h.count, 0)).toBe(4);
    // A band is [from, from+5) and its LABEL says so: "60–65" holds 60,0 up to but
    // not including 65,0. Labelling it "60–64" put scores above the printed ceiling
    // (37 of 207 MPs on the real store).
    expect(data.histogram.map((h) => h.label)).toEqual(["60–65", "65–70", "70–75", "75–80", "80–85"]);
    for (const band of data.histogram) {
      const inBand = data.entries.filter((e) => e.score >= band.from && e.score < band.from + 5);
      expect(inBand.length, `band ${band.label}`).toBe(band.count);
      const [from, to] = band.label.split("–").map(Number);
      for (const e of inBand) {
        expect(e.score, `${e.name} in ${band.label}`).toBeGreaterThanOrEqual(from);
        expect(e.score, `${e.name} in ${band.label}`).toBeLessThan(to);
      }
    }

    // The six components decompose to finite points, each within its published weight —
    // the invariant every breakdown bar in the UI depends on.
    const weightOf = new Map(data.components.map((c) => [c.key, c.weight]));
    for (const e of data.entries) {
      for (const [key, pts] of Object.entries(e.components)) {
        expect(Number.isFinite(pts), `component ${key}`).toBe(true);
        expect(pts, `component ${key}`).toBeLessThanOrEqual(weightOf.get(key as never)!);
      }
    }

    expect(directory.nameByPspId.get(200)).toBe("Adamec Alois");
    expect(directory.clubByPersonPspId.get(100)).toBe("ODS");

    // getLeaderboardData is buildLeaderboard's `data` half — the page's actual entry point.
    const page = (await withReadinessOff(getLeaderboardData))!;
    expect(page.entries.map((e) => e.pspId)).toEqual(data.entries.map((e) => e.pspId));
  });

  it("carries the honest low-score correction, dated, all the way to the /zebricek list", async () => {
    // The reason exists on the person node, is a CLOSED-VOCABULARY value, and until
    // 2026-08-04 it reached only /poslanec — so the ranking printed the lowest number
    // in the chamber with nothing beside it. The list shape now carries it, with the
    // record time of the enrichment that wrote it (effort_provenance.computedAt).
    const list = (await withReadinessOff(getLeaderboardListData))!;
    const cimrman = list.entries.find((e) => e.name === "Cimrman Jára")!;
    expect(cimrman.effortLowScoreReason).toBe("declined_mandate");
    expect(lowScoreReasonCopy(cimrman.effortLowScoreReason)).not.toBeNull();
    expect(cimrman.effortRecordedAt).toBe("2026-07-24"); // a DATE, not the instant
    // An MP without one gets null, never a fabricated explanation or a stand-in date.
    const novakova = list.entries.find((e) => e.name === "Nováková Jana")!;
    expect(novakova.effortLowScoreReason).toBeNull();
    expect(novakova.effortRecordedAt).toBeNull();
  });

  it("carries the duel FACTS in their own units, with missing kept missing", async () => {
    const list = (await withReadinessOff(getLeaderboardListData))!;
    // Novákova's fixture props carry every counter; Adamec's BASE_COUNTERS carry the
    // counts but no amendments/rapporteur/tenure props at all — those must stay null,
    // because num()'s zero would print "0 pozměňovacích návrhů" about an un-ingested
    // field. This is the one rule the duel cannot get wrong.
    const novakova = list.entries.find((e) => e.name === "Nováková Jana")!;
    expect(novakova.duelFacts.speechTurns).toBe(10);
    expect(novakova.duelFacts.interpellations).toBe(1);
    expect(novakova.duelFacts.tenureClass).toBe("full-term"); // verbatim; an unknown class labels as nothing
    const adamec = list.entries.find((e) => e.name === "Adamec Alois")!;
    expect(adamec.duelFacts.amendmentsAuthored).toBeNull();
    expect(adamec.duelFacts.rapporteurLoad).toBeNull();
    expect(adamec.duelFacts.tenureClass).toBeNull();
  });

  it("returns null and leaves a trace when the graph is below the readiness floor", async () => {
    await expectTracedDegradation("storeReady", getLeaderboardData);
  });
});

afterAll(async () => {
  const pg = await open();
  await pg.close();
  rmSync(dataDir, { recursive: true, force: true });
});
