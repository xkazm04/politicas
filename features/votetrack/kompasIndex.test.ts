/*
 * KOMPAS UŽ NEPOČÍTÁ NIC, CO ZÁZNAM NESPOČÍTAL — a tenhle test je důkaz, že se
 * tím nezměnilo, které otázky vybere.
 *
 * Do 2026-08-11 si `getKompas.ts` nad týmiž ~406 000 hlasy počítal dvě věci,
 * které `record/derive.ts` už spočítal a zahodil:
 *   • průchod A — celosněmovní tally každého otagovaného hlasování
 *     (getKompas.ts:61-70 proti derive.ts:201-210),
 *   • půlku průchodu B — linii klubu přísnou většinou pozičních hlasů
 *     (getKompas.ts:87-112 → lineOf, proti derive.ts:235-250).
 * Obojí teď veze `VoteRecordData.voteIndex`. Že je to TÁŽ odpověď, se tu
 * nekontroluje čtením zdrojáku: stará skládačka je níž přepsaná DOSLOVA a její
 * výsledek se porovnává s rejstříkem nad jedním syntetickým obdobím.
 *
 * Rozdíl je přesně jeden a je záměrný — viz „hlas mandátu bez osoby" níž.
 */

import { describe, expect, it } from "vitest";
import {
  bucketOf,
  deriveVoteRecord,
  lineOf,
  type BallotIn,
  type EventIn,
} from "./record/derive";
import type { ClubTally } from "./record/types";
import { selectQuestions } from "./kompas/select";
import { toWireRecord } from "./getVoteRecord";

/* ── syntetické období ─────────────────────────────────────────────────────── */

const VOTES = 40;
const CLUBS = ["A", "B", "C"] as const;
/* 30 mandátů: 1–10 klub A, 11–20 klub B, 21–30 klub C. Mandát 31 je nezařazený
 * (klub žádný) a mandát 32 má klub, ale ŽÁDNÝ řádek mandátu — tj. neexistuje pro
 * něj osoba. To je ten jediný záměrný rozdíl, viz dole. */
const clubByMandate = new Map<number, string>([
  ...Array.from({ length: 30 }, (_, i) => [i + 1, CLUBS[Math.floor(i / 10)]] as [number, string]),
  [32, "A"],
]);
const personByMandate = new Map<number, number>(
  Array.from({ length: 31 }, (_, i) => [i + 1, 100 + i + 1]),
);
const nameByPerson = new Map<number, string>(
  Array.from({ length: 31 }, (_, i) => [100 + i + 1, `Poslanec ${i + 1}`]),
);

const events: EventIn[] = Array.from({ length: VOTES }, (_, i) => ({
  pspId: i + 1,
  published: null,
  votedOn: `2026-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, "0")}`,
  votedAt: null,
  sessionNo: 1,
  voteNo: i + 1,
  outcome: i % 2 === 0 ? "prijato" : "zamitnuto",
  voided: i % 13 === 0, // pár zmatečných
  titleLong: `Hlasování ${i + 1}`,
  titleShort: null,
  titleNorm: `hlasovani-${i + 1}`,
  sourceUrl: "https://www.psp.cz/eknih/cdrom/opendata/hl-2025ps.zip",
}));

/* Hlasy: klub A většinou pro, C se láme podle hlasování — a klub B se každé páté
 * hlasování rozpůlí 5:5, takže LINII NEMÁ (remíza linii neurčuje). */
const choiceFor = (votePspId: number, mandate: number, club: string | null): string => {
  if (mandate === 7 && votePspId % 4 === 0) return "excused"; // → away
  if (club === "A") return votePspId % 7 === 0 && mandate % 2 === 0 ? "no" : "yes";
  if (club === "B") return votePspId % 5 === 0 ? (mandate % 2 === 0 ? "yes" : "no") : "no";
  if (club === "C") return votePspId % 3 === 0 ? "yes" : "no";
  return mandate % 2 === 0 ? "abstain" : "yes"; // nezařazený
};

const ballots: BallotIn[] = events.flatMap((e) =>
  Array.from({ length: 32 }, (_, i) => i + 1).map((mandate) => ({
    votePspId: e.pspId,
    mandatePspId: mandate,
    choice: choiceFor(e.pspId, mandate, clubByMandate.get(mandate) ?? null),
  })),
);

const input = { events, ballots, clubByMandate, personByMandate, nameByPerson };
const record = deriveVoteRecord(input, { chronicleCap: Number.MAX_SAFE_INTEGER });
const indexById = new Map(record.voteIndex.map((v) => [v.pspId, v]));

/* Každé druhé platné hlasování otagujeme; témata schválně včetně vyloučeného. */
const themeByVote = new Map<string | number, string>();
for (const e of events) {
  if (e.pspId % 2 === 0) themeByVote.set(e.pspId, e.pspId % 6 === 0 ? "procedura" : `tema-${e.pspId % 4}`);
}
const themes = themeByVote as ReadonlyMap<number, string>;

/* ── stará skládačka, přepsaná DOSLOVA z getKompas.ts (pre-2026-08-11) ─────── */

const emptyTally = (): ClubTally => ({ yes: 0, no: 0, k: 0, away: 0 });

/** getKompas.ts:61-70 — „full-chamber tallies for tagged votes". */
function legacyTotals(): Map<number, ClubTally> {
  const totals = new Map<number, ClubTally>();
  for (const b of ballots) {
    if (!themes.has(b.votePspId)) continue;
    let t = totals.get(b.votePspId);
    if (!t) {
      t = emptyTally();
      totals.set(b.votePspId, t);
    }
    t[bucketOf(b.choice)]++;
  }
  return totals;
}

/** getKompas.ts:87-120 — per-club tallies of the selected votes → club lines. */
function legacyClubLines(selectedIds: ReadonlySet<number>): Record<number, Record<string, "yes" | "no">> {
  const clubTallies = new Map<number, Map<string, ClubTally>>();
  for (const b of ballots) {
    if (!selectedIds.has(b.votePspId)) continue;
    const person = personByMandate.get(b.mandatePspId);
    if (person === undefined) continue;
    const club = clubByMandate.get(b.mandatePspId) ?? null;
    const bucket = bucketOf(b.choice);
    if (club !== null) {
      let clubs = clubTallies.get(b.votePspId);
      if (!clubs) {
        clubs = new Map();
        clubTallies.set(b.votePspId, clubs);
      }
      let t = clubs.get(club);
      if (!t) {
        t = emptyTally();
        clubs.set(club, t);
      }
      t[bucket]++;
    }
  }
  const out: Record<number, Record<string, "yes" | "no">> = {};
  for (const [voteId, clubs] of clubTallies) {
    for (const [club, t] of clubs) {
      const line = lineOf(t);
      if (line !== null) (out[voteId] ??= {})[club] = line;
    }
  }
  return out;
}

/* ── the pins ──────────────────────────────────────────────────────────────── */

describe("voteIndex nese přesně to, co si kompas počítal sám", () => {
  it("předpoklad: období má zmatečná hlasování, remízy i tagy", () => {
    // Bez toho by test neprokázal nic — porovnával by prázdno s prázdnem.
    expect(record.voteIndex.length).toBeGreaterThan(20);
    expect(record.voteIndex.length).toBeLessThan(events.length);
    expect([...themes.keys()].length).toBeGreaterThan(10);
    expect(record.voteIndex.some((v) => Object.keys(v.clubLines).length < CLUBS.length)).toBe(true);
  });

  it("celosněmovní tally rejstříku = průchod A starého kompasu", () => {
    const legacy = legacyTotals();
    let compared = 0;
    for (const [voteId, tally] of legacy) {
      const entry = indexById.get(voteId);
      if (!entry) continue; // zmatečné — do rejstříku nepatří ani do výběru
      expect(entry.total, `vote ${voteId}`).toEqual(tally);
      compared++;
    }
    expect(compared).toBeGreaterThan(10);
  });

  it("linie klubů rejstříku = půlka průchodu B starého kompasu", () => {
    const validTagged = new Set(record.voteIndex.filter((v) => themes.has(v.pspId)).map((v) => v.pspId));
    const legacy = legacyClubLines(validTagged);
    for (const voteId of validTagged) {
      const mine = indexById.get(voteId)!.clubLines;
      expect(mine, `vote ${voteId}`).toEqual(legacy[voteId] ?? {});
    }
    expect(validTagged.size).toBeGreaterThan(5);
  });

  it("výběr otázek nad rejstříkem vybere totéž, co nad starými vstupy", () => {
    // Pravidlo je jediná funkce; tenhle test tvrdí, že jeho VSTUP se nezměnil,
    // takže se nemohl změnit ani výstup — a přesto ho pro jistotu spustí.
    const legacy = legacyTotals();
    // Sněmovna fixtury má 32 mandátů, ne 200 — práh účasti se proto podává
    // v možnostech, které pravidlo pro tenhle účel samo nabízí.
    const overIndex = selectQuestions({ votes: record.voteIndex, themeByVote: themes }, { minPositional: 20 });
    for (const s of overIndex.selected) {
      expect(s.total, `vote ${s.vote.pspId}`).toEqual(legacy.get(s.vote.pspId));
    }
    expect(overIndex.selected.length).toBeGreaterThan(0);
    // Zmatečné hlasování se do výběru nemůže dostat ani omylem: v rejstříku není.
    const voidedIds = new Set(events.filter((e) => e.voided).map((e) => e.pspId));
    for (const s of overIndex.selected) expect(voidedIds.has(s.vote.pspId)).toBe(false);
  });

  it("hlas mandátu bez řádku mandátu: rejstřík ho POČÍTÁ, starý kompas ho zahazoval", () => {
    // JEDINÝ záměrný rozdíl. Starý kompas u každého hlasu nejdřív hledal osobu
    // (kvůli seznamu poslanců) a bez ní `continue`oval — takže odevzdaný hlas
    // nevstoupil ani do tally klubu. Rejstřík ho počítá: odevzdaný hlas je
    // odevzdaný hlas a linie klubu je fakt o klubu, ne o tom, koho umíme pojmenovat.
    // Na živém store je ten rozdíl PRÁZDNÝ — změřeno 2026-08-11: clubByMandate má
    // 207 klíčů, listMandates 207 a průnik je úplný (0 mandátů bez osoby).
    expect(clubByMandate.has(32)).toBe(true);
    expect(personByMandate.has(32)).toBe(false);
    const voteId = record.voteIndex[0].pspId;
    const withOrphan = indexById.get(voteId)!.total!;
    const noOrphan = deriveVoteRecord(
      { ...input, ballots: ballots.filter((b) => b.mandatePspId !== 32) },
      { chronicleCap: Number.MAX_SAFE_INTEGER },
    ).voteIndex.find((v) => v.pspId === voteId)!.total!;
    expect(withOrphan.yes + withOrphan.no + withOrphan.k + withOrphan.away).toBe(
      noOrphan.yes + noOrphan.no + noOrphan.k + noOrphan.away + 1,
    );
  });
});

describe("rejstřík nepřechází ke klientovi /hlasovani", () => {
  it("toWireRecord ho zahodí a nesáhne na nic jiného", () => {
    const wire = toWireRecord(record);
    expect("voteIndex" in wire).toBe(false);
    // A ostatní pole jsou táž (kronika je tu kratší než mez, takže i ona).
    expect(Object.keys(wire).sort()).toEqual(
      Object.keys(record)
        .filter((k) => k !== "voteIndex")
        .sort(),
    );
    for (const k of Object.keys(wire) as (keyof typeof wire)[]) {
      if (k === "chronicle") continue;
      expect(wire[k], k).toEqual(record[k]);
    }
  });
});
