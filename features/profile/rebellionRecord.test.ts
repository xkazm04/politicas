// The spis's rebellion instances are the voting ledger's OWN chronicle, indexed by
// person. These tests hold that literally: every expectation runs the real
// `deriveVoteRecord` (features/votetrack/record/derive.ts) over a synthetic term and
// then asks the profile's projection about it — so a future "small" reimplementation of
// the rebellion rule on the profile side fails here rather than shipping a second
// answer about a named person.

import { describe, expect, it } from "vitest";
import { deriveVoteRecord, type BallotIn, type EventIn } from "@/features/votetrack/record/derive";
import { indexRebellions, rebellionRecordFor, toInstance } from "./rebellionRecord";

/* A two-club chamber over N roll calls. Mandates 1–3 are club A, 4–5 club B; person
 * ids equal mandate ids + 100. On every vote club A's line is "yes" and mandate 1
 * breaks it, so mandate 1 rebels on EVERY vote — the shape the chamber-wide cap hides. */
const VOTES = 30;

const events = (): EventIn[] =>
  Array.from({ length: VOTES }, (_, i) => ({
    pspId: i + 1,
    votedOn: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    votedAt: null,
    sessionNo: 1,
    voteNo: i + 1,
    outcome: "prijato",
    voided: false,
    titleLong: `Hlasování ${i + 1}`,
    titleShort: null,
    titleNorm: `hlasovani-${i + 1}`,
    sourceUrl: "https://www.psp.cz/eknih/cdrom/opendata/hl-2025ps.zip",
  }));

const ballots = (): BallotIn[] =>
  events().flatMap((e) => [
    { votePspId: e.pspId, mandatePspId: 1, choice: "no" }, // the rebel
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
  nameByPerson: new Map([[101, "Rebel Rebelová"]]),
});

const uncapped = () => deriveVoteRecord(input(), { chronicleCap: Number.MAX_SAFE_INTEGER });

describe("rebellion instances on the spis", () => {
  it("indexes the SHARED derivation's chronicle — no second rebellion rule", () => {
    const record = uncapped();
    const index = indexRebellions(record);
    // Every chronicle row, and nothing else, reaches the profile.
    const total = [...index.byMp.values()].reduce((n, list) => n + list.length, 0);
    expect(total).toBe(record.chronicle.length);
    expect(index.byMp.get(101)!.map((i) => i.votePspId)).toEqual(
      record.chronicle.filter((c) => c.personPspId === 101).map((c) => c.votePspId),
    );
    // The rule itself stays the derivation's: the rebel is the MP who broke their own
    // club's line, and the club that never had a majority line produces no rows.
    expect(index.byMp.get(101)!.length).toBe(VOTES);
    expect(index.byMp.has(104)).toBe(false);
    expect(index.coverage).toEqual({
      votes: record.coverage.valid,
      from: record.coverage.from,
      to: record.coverage.to,
    });
  });

  it("needs the UNCAPPED chronicle: /hlasovani's 24-row bound is a presentation cap", () => {
    // This is the whole reason the loader passes `chronicleCap`. The chamber-wide
    // default keeps only the 24 newest rows across ALL MPs, so indexing it would hand
    // one MP a truncated record and every other MP a false "no rebellions".
    const defaultCap = indexRebellions(deriveVoteRecord(input()));
    expect(defaultCap.byMp.get(101)!.length).toBe(24);
    expect(defaultCap.byMp.get(101)!.length).toBeLessThan(uncapped().chronicle.length);
    expect(indexRebellions(uncapped()).byMp.get(101)!.length).toBe(VOTES);
  });

  it("caps the printed rows, counts the rest, and never re-sorts", () => {
    const index = indexRebellions(uncapped());
    const shown = rebellionRecordFor(index, 101, 12);
    expect(shown.instances).toHaveLength(12);
    expect(shown.total).toBe(VOTES); // the remainder is counted, not dropped
    // Order is the chronicle's own (newest first); the profile adds no ordering claim.
    expect(shown.instances.map((i) => i.votePspId)).toEqual(
      index.byMp.get(101)!.slice(0, 12).map((i) => i.votePspId),
    );
  });

  it("gives an MP who never broke the line a record, not a gap", () => {
    const record = rebellionRecordFor(indexRebellions(uncapped()), 103);
    expect(record.total).toBe(0);
    expect(record.instances).toEqual([]);
    expect(record.coverage.votes).toBe(VOTES); // the answer states what it looked at
  });

  it("links /hlasovani ONLY for a roll call that page actually renders", () => {
    const base = {
      personPspId: 101,
      name: "Rebel Rebelová",
      club: "A",
      choice: "no" as const,
      line: "yes" as const,
      title: "Hlasování",
      votedOn: "2026-01-01",
      sourceUrl: "https://www.psp.cz/eknih/cdrom/opendata/hl-2025ps.zip",
    };
    expect(toInstance({ ...base, votePspId: 92793, inLedger: true }).appHref).toBe("/hlasovani#h-92793");
    // Outside the ledger window the anchor does not exist — the row keeps the psp.cz
    // address rather than offering a link into an empty page.
    const out = toInstance({ ...base, votePspId: 92793, inLedger: false });
    expect(out.appHref).toBeNull();
    expect(out.pspUrl).toBe("https://www.psp.cz/sqw/hlasy.sqw?g=92793");
    expect(out.sourceUrl).toBe(base.sourceUrl);
  });
});
