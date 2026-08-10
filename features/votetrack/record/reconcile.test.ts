// Kontrola přepočtu proti zveřejněným součtům — čisté pravidlo, fixture po fixtuře.
//
// Testy drží tři věci, na kterých celý nález stojí:
//   1. porovnává se jedna ku jedné a slot bez zveřejněného sloupce se NEDOHADUJE,
//   2. rozdíl se konstatuje (počet + nejhorší příklad), nikdy neopravuje,
//   3. hlasování bez jmenovitých hlasů není „neshoda“, ale vlastní, vypsaná kategorie.

import { describe, expect, it } from "vitest";
import { deriveVoteRecord, type BallotIn, type EventIn } from "./derive";
import {
  RECONCILE_BUCKETS,
  reconcileRecord,
  reconcileVote,
  type PublishedTally,
  type ReconcileInput,
} from "./reconcile";
import type { ClubTally } from "./types";

const tally = (yes: number, no: number, k = 0, away = 0): ClubTally => ({ yes, no, k, away });

const pub = (over: Partial<PublishedTally> = {}): PublishedTally => ({
  yes: null,
  no: null,
  abstain: null,
  notVoting: null,
  ...over,
});

const row = (over: Partial<ReconcileInput> = {}): ReconcileInput => ({
  votePspId: 1,
  votedOn: "2026-03-01",
  derived: tally(100, 60, 30, 10),
  published: pub({ yes: 100, no: 60, abstain: 20, notVoting: 10 }),
  ...over,
});

/* ── jedno hlasování ───────────────────────────────────────────────────────── */

describe("reconcileVote", () => {
  it("porovná pro/proti/K a sečte zveřejněné zdržel se + nehlasoval do jednoho slotu", () => {
    const r = reconcileVote(row());
    expect(r.compared).toEqual([...RECONCILE_BUCKETS]);
    expect(r.deltas).toEqual({ yes: 0, no: 0, k: 0 });
    expect(r.distance).toBe(0);
  });

  it("slot „nepřihlášen“ neporovnává vůbec — zdroj pro něj nemá sloupec", () => {
    // away = 999 v přepočtu; zveřejněné součty o tomhle slotu nic netvrdí, takže
    // nesmí vzniknout ani odchylka, ani „shoda“, kterou nikdo nezkontroloval.
    const r = reconcileVote(row({ derived: tally(100, 60, 30, 999) }));
    expect(r.compared).not.toContain("away");
    expect(r.distance).toBe(0);
  });

  it("neporovnává slot, jehož sloupec zdroj nezveřejnil (žádná domyšlená nula)", () => {
    const r = reconcileVote(row({ published: pub({ yes: 100 }) }));
    expect(r.compared).toEqual(["yes"]);
    expect(r.deltas).toEqual({ yes: 0 });
  });

  it("slot K vyžaduje OBA zveřejněné sloupce — půlka údaje není údaj", () => {
    const r = reconcileVote(row({ published: pub({ yes: 100, no: 60, abstain: 20 }) }));
    expect(r.compared).toEqual(["yes", "no"]);
    expect(r.deltas.k).toBeUndefined();
  });

  it("bez zveřejněných součtů neporovnává nic", () => {
    expect(reconcileVote(row({ published: null })).compared).toEqual([]);
    expect(reconcileVote(row({ published: undefined })).compared).toEqual([]);
    expect(reconcileVote(row({ published: pub() })).compared).toEqual([]);
  });

  it("bez jmenovitých hlasů neporovnává nic (přepočet neexistuje)", () => {
    expect(reconcileVote(row({ derived: null })).compared).toEqual([]);
  });

  it("odchylka je přepočet minus zveřejněno a nese znaménko; vzdálenost je absolutní", () => {
    const r = reconcileVote(
      row({
        derived: tally(98, 61, 30, 10),
        published: pub({ yes: 100, no: 60, abstain: 20, notVoting: 10 }),
      }),
    );
    expect(r.deltas).toEqual({ yes: -2, no: 1, k: 0 });
    expect(r.distance).toBe(3);
  });
});

/* ── celý záznam ───────────────────────────────────────────────────────────── */

describe("reconcileRecord", () => {
  it("sečte shody a neporovnaná hlasování a nikdy je nesmíchá", () => {
    const s = reconcileRecord([
      row({ votePspId: 1 }),
      row({ votePspId: 2 }),
      row({ votePspId: 3, published: pub() }),
      row({ votePspId: 4, derived: null }),
    ]);
    expect(s).toMatchObject({
      votes: 4,
      recounted: 3,
      compared: 2,
      agreed: 2,
      discrepancies: 0,
      uncompared: 1,
      withoutBallots: 1,
      worst: null,
    });
    expect(s.comparedBuckets).toBe(6);
  });

  it("rozdíl NAJDE, spočítá a pojmenuje nejhorší příklad — neopraví ho", () => {
    const s = reconcileRecord([
      row({ votePspId: 10 }),
      row({ votePspId: 11, derived: tally(101, 60, 30, 10) }),
      row({ votePspId: 12, derived: tally(90, 65, 35, 10) }),
    ]);
    expect(s.compared).toBe(3);
    expect(s.agreed).toBe(1);
    expect(s.discrepancies).toBe(2);
    expect(s.worst?.votePspId).toBe(12);
    expect(s.worst?.distance).toBe(20);
    expect(s.worst?.deltas).toEqual({ yes: -10, no: 5, k: 5 });
  });

  it("při shodné vzdálenosti vybere nejhorší příklad deterministicky (nižší id)", () => {
    const worse = (id: number) => row({ votePspId: id, derived: tally(101, 60, 30, 10) });
    expect(reconcileRecord([worse(77), worse(42)]).worst?.votePspId).toBe(42);
    expect(reconcileRecord([worse(42), worse(77)]).worst?.votePspId).toBe(42);
  });

  it("prázdný záznam je prázdný, ne shodný", () => {
    expect(reconcileRecord([])).toMatchObject({ votes: 0, compared: 0, agreed: 0, worst: null });
  });
});

/* ── napojení na derivaci ──────────────────────────────────────────────────── */

const CLUB = new Map<number, string>([
  [10, "A"],
  [11, "A"],
  [20, "B"],
  [21, "B"],
]);
const PERSON = new Map<number, number>([
  [10, 1],
  [11, 2],
  [20, 3],
  [21, 4],
]);
const NAME = new Map<number, string>([
  [1, "Alena Adamová"],
  [2, "Bohumil Beneš"],
  [3, "Cyril Czerný"],
  [4, "Dana Dvořáková"],
]);

const ev = (pspId: number, over: Partial<EventIn> = {}): EventIn => ({
  pspId,
  votedOn: "2026-03-01",
  votedAt: null,
  sessionNo: 1,
  voteNo: pspId,
  outcome: "accepted",
  voided: false,
  titleLong: "Hlasování " + pspId,
  titleShort: null,
  titleNorm: "hlasovani " + pspId,
  sourceUrl: "https://www.psp.cz/sqw/hlasy.sqw?g=" + pspId,
  ...over,
});

const b = (votePspId: number, mandatePspId: number, choice: string): BallotIn => ({
  votePspId,
  mandatePspId,
  choice,
});

const derive = (events: EventIn[], ballots: BallotIn[]) =>
  deriveVoteRecord({ events, ballots, clubByMandate: CLUB, personByMandate: PERSON, nameByPerson: NAME });

describe("deriveVoteRecord nese kontrolu s sebou", () => {
  const ballots = [b(1, 10, "yes"), b(1, 11, "yes"), b(1, 20, "no"), b(1, 21, "abstain")];

  it("shodné součty projdou jako shoda přes všechny tři sloty", () => {
    const record = derive([ev(1, { published: { yes: 2, no: 1, abstain: 1, notVoting: 0 } })], ballots);
    expect(record.reconciliation).toMatchObject({
      votes: 1,
      recounted: 1,
      compared: 1,
      agreed: 1,
      discrepancies: 0,
      worst: null,
    });
  });

  it("hlasování bez zveřejněných součtů je NEPOROVNANÉ, nikdy dohadované", () => {
    const record = derive([ev(1)], ballots);
    expect(record.reconciliation).toMatchObject({ recounted: 1, compared: 0, uncompared: 1, agreed: 0 });
  });

  it("zmatečné hlasování do kontroly nevstupuje (je vyřazené z každé metriky)", () => {
    const record = derive(
      [
        ev(1, { published: { yes: 2, no: 1, abstain: 1, notVoting: 0 } }),
        ev(2, { voided: true, published: { yes: 999, no: 0, abstain: 0, notVoting: 0 } }),
      ],
      ballots,
    );
    expect(record.reconciliation.votes).toBe(1);
    expect(record.reconciliation.agreed).toBe(1);
  });

  it("platné hlasování bez jmenovitých hlasů se počítá zvlášť, ne jako rozdíl", () => {
    const record = derive(
      [
        ev(1, { published: { yes: 2, no: 1, abstain: 1, notVoting: 0 } }),
        ev(2, { published: { yes: 120, no: 60, abstain: 10, notVoting: 5 } }),
      ],
      ballots,
    );
    expect(record.reconciliation).toMatchObject({
      votes: 2,
      recounted: 1,
      withoutBallots: 1,
      discrepancies: 0,
    });
  });

  it("rozdíl se propíše do záznamu i s nejhorším příkladem — a záznam se neopraví", () => {
    const record = derive([ev(1, { published: { yes: 3, no: 1, abstain: 1, notVoting: 0 } })], ballots);
    expect(record.reconciliation.discrepancies).toBe(1);
    expect(record.reconciliation.worst).toMatchObject({ votePspId: 1, distance: 1 });
    // Přepočet dál tvrdí to, co spočítal z hlasů: 2 pro. Rozdíl se konstatuje, ne opraví.
    expect(record.ledger[0].stat.total.yes).toBe(2);
  });
});
