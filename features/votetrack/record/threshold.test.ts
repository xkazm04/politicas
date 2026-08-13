/*
 * Práh hlasování — „kolik hlasů bylo potřeba".
 *
 * Čtyři věci, které se tady drží, protože se všechny čtyři dají tiše porušit:
 *
 *  1. PRÁH SE NEDOPOČÍTÁVÁ. Nejtišší možná regrese téhle plochy je `quorum ??
 *     simpleMajorityOf(present)`: vypadalo by to jako laskavost ke čtenáři a
 *     zrušilo by to celý nález, protože `differs` by pak z definice nikdy nebylo
 *     pravda. Test to falzifikuje přímo — hlasování se známým počtem přítomných
 *     a bez prahu musí mít `quorum === null` a `differs === null`.
 *  2. „NEPOSOUZENO" NENÍ „NELIŠÍ SE". Tři stavy `differs` (ano / ne / nedá se
 *     posoudit) jsou tři různá zjištění a jedno z nich se nesmí propadnout do
 *     druhého — táž kázeň, jakou seismogram zavedl pro neměřený den.
 *  3. ROZDÍL PROTI PRAHU STOJÍ NA ZVEŘEJNĚNÝCH SLOUPCÍCH JEDNOHO ŘÁDKU. Náš
 *     přepočet ze jmenovitých hlasů do něj nevstupuje; kdyby vstupoval, věta by
 *     nesla odchylku, kterou kontrola v record/reconcile.ts teprve hledá.
 *  4. NÁLEZ MÁ POPULACI. `thresholdDiffers` bez `thresholdComparable` je číslo
 *     bez jmenovatele (precedens `chronicleTotal`).
 *
 * Čísla ve fixtures nejsou vymyšlená: 187 přítomných / práh 101 / 104 pro je
 * hlasování č. 77716 z 18. 2. 2022 (novela zákona o mimořádných opatřeních při
 * epidemii) — jeden z mála případů, kde zveřejněný práh prostou většinou
 * přítomných NENÍ. Prostá většina by u něj byla 94.
 */

import { describe, expect, it } from "vitest";
import { toEventIn } from "../ledgerRead";
import type { VoteEventRow } from "@/lib/db/types";
import { deriveVoteRecord, type BallotIn, type EventIn } from "./derive";
import { deriveThreshold, simpleMajorityOf, summarizeThresholds } from "./threshold";

/* ── 01 · prostá většina přítomných ────────────────────────────────────────── */

describe("simpleMajorityOf", () => {
  it("je floor(present/2)+1 — pro sudý i lichý počet", () => {
    expect(simpleMajorityOf(187)).toBe(94);
    expect(simpleMajorityOf(200)).toBe(101);
    expect(simpleMajorityOf(1)).toBe(1);
  });

  it("bez počtu přítomných neexistuje, a nedopočítává se", () => {
    expect(simpleMajorityOf(null)).toBeNull();
    expect(simpleMajorityOf(undefined)).toBeNull();
  });

  it("co počet poslanců být nemůže, není údaj", () => {
    expect(simpleMajorityOf(Number.NaN)).toBeNull();
    expect(simpleMajorityOf(-3)).toBeNull();
    expect(simpleMajorityOf(12.5)).toBeNull();
  });
});

/* ── 02 · práh jednoho hlasování ───────────────────────────────────────────── */

describe("deriveThreshold", () => {
  it("běžný práh: prostá většina přítomných, výsledek nad ní", () => {
    const t = deriveThreshold({ quorum: 94, present: 187 }, 120);
    expect(t.quorum).toBe(94);
    expect(t.present).toBe(187);
    expect(t.publishedYes).toBe(120);
    expect(t.simpleMajority).toBe(94);
    expect(t.differs).toBe(false);
    expect(t.margin).toBe(26);
  });

  it("výjimečný práh (hlasování č. 77716): 101 ze 187 přítomných, pro 104", () => {
    const t = deriveThreshold({ quorum: 101, present: 187 }, 104);
    expect(t.simpleMajority).toBe(94);
    expect(t.differs).toBe(true);
    // Prošlo o tři hlasy — a to je celý smysl: pod prostou většinou přítomných
    // by ten výsledek vypadal jako pohodlný náskok deseti hlasů.
    expect(t.margin).toBe(3);
  });

  it("výsledek přesně na prahu je nula, ne chybějící údaj", () => {
    expect(deriveThreshold({ quorum: 101, present: 187 }, 101).margin).toBe(0);
  });

  it("výsledek pod prahem nese záporný rozdíl", () => {
    expect(deriveThreshold({ quorum: 94, present: 187 }, 90).margin).toBe(-4);
  });

  it("bez prahu se práh NEDOPOČÍTÁVÁ z počtu přítomných", () => {
    const t = deriveThreshold({ quorum: null, present: 187 }, 104);
    expect(t.quorum).toBeNull();
    // Prostá většina přítomných se spočítat dá a spočítá se — ale JAKO POROVNÁVACÍ
    // hodnota, ne jako náhrada chybějícího sloupce.
    expect(t.simpleMajority).toBe(94);
    // A tohle je ta falzifikace: kdyby `quorum ?? simpleMajority` někdo doplnil,
    // bylo by tu `false` (a `margin` 10), tedy tvrzení o pravidle, které zdroj
    // u hlasování vůbec neuvádí.
    expect(t.differs).toBeNull();
    expect(t.margin).toBeNull();
  });

  it("bez počtu přítomných zůstává práh čitelný, jen se nemá s čím porovnat", () => {
    const t = deriveThreshold({ quorum: 101, present: null }, 104);
    expect(t.quorum).toBe(101);
    expect(t.present).toBeNull();
    expect(t.simpleMajority).toBeNull();
    expect(t.differs).toBeNull();
    // Rozdíl proti prahu počet přítomných nepotřebuje — a proto o něj nepřijde.
    expect(t.margin).toBe(3);
  });

  it("bez zveřejněného „pro“ není rozdíl, a nula se nedopočítává", () => {
    const t = deriveThreshold({ quorum: 101, present: 187 }, null);
    expect(t.publishedYes).toBeNull();
    expect(t.margin).toBeNull();
    // Porovnání prahu s prostou většinou přítomných na „pro“ nezávisí.
    expect(t.differs).toBe(true);
  });

  it("hlasování bez obou sloupců je objekt samých null, ne chybějící blok", () => {
    const t = deriveThreshold(null, null);
    expect(t).toEqual({
      quorum: null,
      present: null,
      publishedYes: null,
      margin: null,
      simpleMajority: null,
      differs: null,
    });
  });

  it("nesmyslný vstup se zahazuje, nikdy neopravuje", () => {
    const t = deriveThreshold({ quorum: Number.NaN, present: -1 }, 104);
    expect(t.quorum).toBeNull();
    expect(t.present).toBeNull();
    expect(t.margin).toBeNull();
    expect(t.differs).toBeNull();
  });
});

/* ── 03 · populace nálezu ──────────────────────────────────────────────────── */

describe("summarizeThresholds", () => {
  it("počítá chybějící práh, porovnatelná hlasování i ta, kde se práh liší", () => {
    const rows = [
      deriveThreshold({ quorum: 94, present: 187 }, 120), // běžný
      deriveThreshold({ quorum: 101, present: 187 }, 104), // výjimečný
      deriveThreshold({ quorum: 120, present: 200 }, 121), // výjimečný
      deriveThreshold({ quorum: null, present: 187 }, 104), // bez prahu
      deriveThreshold({ quorum: 101, present: null }, 104), // neporovnatelný
    ];
    expect(summarizeThresholds(rows)).toEqual({
      withoutQuorum: 1,
      thresholdComparable: 3,
      thresholdDiffers: 2,
    });
  });

  it("neporovnatelné hlasování se do jmenovatele nepočítá", () => {
    // Kdyby `thresholdComparable` bralo i řádky s `differs === null`, četl by se
    // podíl „liší se" nad populací, ve které se u části vůbec neporovnávalo.
    const rows = [deriveThreshold({ quorum: 101, present: null }, 104), deriveThreshold(null, null)];
    expect(summarizeThresholds(rows)).toEqual({
      withoutQuorum: 1,
      thresholdComparable: 0,
      thresholdDiffers: 0,
    });
  });
});

/* ── 04 · práh dojede až do záznamu ────────────────────────────────────────── */

const ev = (pspId: number, over: Partial<EventIn> = {}): EventIn => ({
  pspId,
  votedOn: `2026-02-${String((pspId % 28) + 1).padStart(2, "0")}`,
  votedAt: null,
  sessionNo: 1,
  voteNo: pspId,
  outcome: "accepted",
  voided: false,
  titleLong: `Hlasování ${pspId}`,
  titleShort: null,
  titleNorm: `hlasovani-${pspId}`,
  sourceUrl: "https://www.psp.cz/eknih/cdrom/opendata/hl-2025ps.zip",
  published: { yes: 3, no: 2, abstain: 0, notVoting: 0 },
  threshold: { quorum: 3, present: 5 },
  ...over,
});

const ballots = (ids: number[]): BallotIn[] =>
  ids.flatMap((id) => [
    { votePspId: id, mandatePspId: 1, choice: "yes" },
    { votePspId: id, mandatePspId: 2, choice: "yes" },
    { votePspId: id, mandatePspId: 3, choice: "yes" },
    { votePspId: id, mandatePspId: 4, choice: "no" },
    { votePspId: id, mandatePspId: 5, choice: "no" },
  ]);

const input = (events: EventIn[]) => ({
  events,
  ballots: ballots(events.map((e) => e.pspId)),
  clubByMandate: new Map([
    [1, "A"],
    [2, "A"],
    [3, "A"],
    [4, "B"],
    [5, "B"],
  ]),
  personByMandate: new Map([
    [1, 101],
    [2, 102],
    [3, 103],
    [4, 104],
    [5, 105],
  ]),
  nameByPerson: new Map([[101, "Rebel Rebelová"]]),
});

describe("deriveVoteRecord nese práh na řádek deníku i do pokrytí", () => {
  it("řádek deníku nese sloupce zdroje i obě odvozená čísla", () => {
    const rec = deriveVoteRecord(input([ev(1, { threshold: { quorum: 101, present: 187 }, published: { yes: 104, no: 2, abstain: 0, notVoting: 0 } })]));
    const row = rec.ledger[0];
    expect(row.threshold.quorum).toBe(101);
    expect(row.threshold.present).toBe(187);
    expect(row.threshold.margin).toBe(3);
    expect(row.threshold.simpleMajority).toBe(94);
    expect(row.threshold.differs).toBe(true);
  });

  it("hlasování bez sloupců prahu má na řádku samá null, ne nuly", () => {
    const rec = deriveVoteRecord(input([ev(1, { threshold: null })]));
    expect(rec.ledger[0].threshold).toEqual({
      quorum: null,
      present: null,
      publishedYes: 3,
      margin: null,
      simpleMajority: null,
      differs: null,
    });
  });

  it("pokrytí se počítá přes VŠECHNA platná hlasování, ne přes okno deníku", () => {
    const events = [
      ev(1, { threshold: { quorum: 101, present: 187 } }),
      ev(2),
      ev(3, { threshold: { quorum: null, present: 5 } }),
      ev(4, { threshold: { quorum: 3, present: null } }),
      ev(5, { voided: true, threshold: { quorum: 999, present: 5 } }),
    ];
    // Okno deníku úmyslně kratší než seznam: kdyby se pokrytí počítalo až z něj,
    // nález by se scvrkával podle prezentační meze.
    const rec = deriveVoteRecord(input(events), { ledgerWindow: 1 });
    expect(rec.ledger).toHaveLength(1);
    // Zmatečné hlasování se nepočítá do žádné metriky — ani sem.
    expect(rec.coverage.valid).toBe(4);
    expect(rec.coverage.withoutQuorum).toBe(1);
    expect(rec.coverage.thresholdComparable).toBe(2);
    expect(rec.coverage.thresholdDiffers).toBe(1);
  });
});

/* ── 05 · jediná projekce vote_event ho opravdu nese ───────────────────────── */

const eventRow = (over: Partial<VoteEventRow> = {}): VoteEventRow =>
  ({
    id: "psp:vote:77716",
    pspId: 77716,
    termPspId: 10,
    termCode: "PSP10",
    sessionNo: 1,
    voteNo: 1,
    agendaItem: null,
    votedAt: null,
    votedOn: "2022-02-18",
    yes: 104,
    no: 60,
    abstain: 20,
    notVoting: 3,
    present: 187,
    quorum: 101,
    kind: "normal",
    outcome: "prijato",
    titleLong: "Novela z. o mimoř. opatřeních při epidemii",
    titleShort: null,
    titleNorm: "novela-z-o-mimor-opatrenich-pri-epidemii",
    voided: false,
    sourceUrl: "https://www.psp.cz/eknih/cdrom/opendata/hl-2021ps.zip",
    ...over,
  }) as VoteEventRow;

describe("toEventIn — jediné místo, kde se vote_event čte", () => {
  it("nese práh doslova, vedle zveřejněných součtů", () => {
    // Do 2026-08-13 tenhle řádek `quorum` i `present` zahazoval, takže dva
    // ingestované, uložené a skórované sloupce se do produktu nikdy nedostaly.
    expect(toEventIn(eventRow()).threshold).toEqual({ quorum: 101, present: 187 });
    expect(toEventIn(eventRow()).published).toEqual({ yes: 104, no: 60, abstain: 20, notVoting: 3 });
  });

  it("chybějící sloupec projde jako null, nikdy jako nula", () => {
    expect(toEventIn(eventRow({ quorum: null, present: null })).threshold).toEqual({
      quorum: null,
      present: null,
    });
  });
});
