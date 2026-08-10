/*
 * `chronicleCap` JE PREFIXOVÝ ŘEZ — a nic jiného.
 *
 * Na tomhle tvrzení stojí od 2026-08-11 celý sdílený průchod záznamem:
 * `getFullVoteRecord()` derivuje JEDNOU s neoříznutou kronikou, memoizuje to,
 * /hlasovani si z výsledku ukrojí svých `CHRONICLE_CAP` řádků a spis poslance
 * indexuje kroniku celou. Kdyby mez ovlivňovala cokoli DALŠÍHO — sedadla,
 * disciplínu klubů, seismogram, žebříček rebelů, kontrolu proti zveřejněným
 * součtům, pokrytí — ukrojený záznam by nebyl týž záznam a /hlasovani by tiše
 * začalo tisknout jiná čísla.
 *
 * Test to nekontroluje čtením zdrojáku, ale REÁLNOU derivací nad syntetickým
 * obdobím: co pole, to porovnání mezi během s mezí a bez ní.
 */

import { describe, expect, it } from "vitest";
import {
  CHRONICLE_CAP,
  deriveVoteRecord,
  type BallotIn,
  type EventIn,
} from "./record/derive";
import type { VoteRecordData } from "./record/types";

/* Dvouklubová sněmovna přes 60 hlasování. Mandáty 1–3 klub A, 4–5 klub B;
 * mandát 1 poruší linii klubu A při KAŽDÉM hlasování, takže kronika je delší
 * než `CHRONICLE_CAP` a řez je opravdu vidět. Zveřejněné součty odpovídají
 * hlasům, aby kontrola měla co porovnávat. */
const VOTES = 60;

const events = (): EventIn[] =>
  Array.from({ length: VOTES }, (_, i) => ({
    pspId: i + 1,
    published: { yes: 2, no: 3, abstain: 0, notVoting: 0 },
    votedOn: `2026-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, "0")}`,
    votedAt: null,
    sessionNo: 1,
    voteNo: i + 1,
    outcome: "prijato",
    voided: i % 17 === 0, // pár zmatečných, ať se pokrytí nemá kde schovat
    titleLong: `Hlasování ${i + 1}`,
    titleShort: null,
    titleNorm: `hlasovani-${i + 1}`,
    sourceUrl: "https://www.psp.cz/eknih/cdrom/opendata/hl-2025ps.zip",
  }));

const ballots = (): BallotIn[] =>
  events().flatMap((e) => [
    { votePspId: e.pspId, mandatePspId: 1, choice: "no" }, // rebel klubu A
    { votePspId: e.pspId, mandatePspId: 2, choice: "yes" },
    { votePspId: e.pspId, mandatePspId: 3, choice: "yes" },
    { votePspId: e.pspId, mandatePspId: 4, choice: "no" },
    { votePspId: e.pspId, mandatePspId: 5, choice: "no" },
  ]);

const input = () => ({
  events: events(),
  ballots: ballots(),
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
  nameByPerson: new Map([
    [101, "Rebel Rebelová"],
    [102, "Věrná Věrná"],
  ]),
});

const full = () => deriveVoteRecord(input(), { chronicleCap: Number.MAX_SAFE_INTEGER });
const capped = () => deriveVoteRecord(input(), { chronicleCap: CHRONICLE_CAP });

describe("chronicleCap je prezentační řez, ne vstup derivace", () => {
  it("uříznutá kronika je PREFIX té neuříznuté", () => {
    const f = full();
    const c = capped();
    // Předpoklad testu: bez řezu je kronika delší než mez, jinak by nic nedokazoval.
    expect(f.chronicle.length).toBeGreaterThan(CHRONICLE_CAP);
    expect(c.chronicle).toHaveLength(CHRONICLE_CAP);
    expect(c.chronicle).toEqual(f.chronicle.slice(0, CHRONICLE_CAP));
  });

  it("žádné jiné pole záznamu na mezi nezávisí", () => {
    const f = full();
    const c = capped();
    // Vyjmenované schválně: kdo do VoteRecordData přidá pole, musí sem sáhnout
    // a rozhodnout, jestli je na mezi nezávislé — mlčky projít to nemůže.
    const fields: (keyof VoteRecordData)[] = [
      "ledger",
      "seismogram",
      "clubs",
      "topRebels",
      "reconciliation",
      "coverage",
    ];
    for (const key of fields) expect(c[key], key).toEqual(f[key]);
    // A ten výčet je úplný: kromě kroniky nezbylo nic neporovnaného.
    expect([...fields, "chronicle"].sort()).toEqual(Object.keys(f).sort());
  });

  it("řez ani derivace nesahají na kontrolu proti zveřejněným součtům", () => {
    // Pojistka proti nejtišší možné regresi: kdyby se `published` cestou ztratilo,
    // kontrola by neporovnala nic — a vypadala by úplně stejně jako když souhlasí.
    const f = full();
    expect(f.reconciliation.compared).toBeGreaterThan(0);
    expect(f.reconciliation.compared).toBe(capped().reconciliation.compared);
  });
});
