// The spis's rebellion instances are the voting ledger's OWN chronicle, indexed by
// person. These tests hold that literally: every expectation runs the real
// `deriveVoteRecord` (features/votetrack/record/derive.ts) over a synthetic term and
// then asks the profile's projection about it — so a future "small" reimplementation of
// the rebellion rule on the profile side fails here rather than shipping a second
// answer about a named person.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toEventIn } from "@/features/votetrack/ledgerRead";
import { deriveVoteRecord, type BallotIn, type EventIn } from "@/features/votetrack/record/derive";
import type { VoteEventRow } from "@/lib/db/types";
import {
  deriveRebellionIndex,
  indexRebellions,
  rebellionRecordFor,
  toInstance,
} from "./rebellionRecord";

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

  it("derives through the shared uncapped rule — deriveRebellionIndex IS the loader's step", () => {
    // The loader does nothing to the ledger but call this; if the uncapped bound ever
    // slips back into the loader (or out of it), the two stop agreeing here first.
    expect(deriveRebellionIndex(input())).toEqual(indexRebellions(uncapped()));
  });
});

/* ── the read path ──────────────────────────────────────────────────────────────
 * The spis used to build its own `EventIn` rows out of `vote_event`, and it left
 * `published` off them — so `record/reconcile.ts`, the check that holds OUR recount
 * against the Chamber's own published tallies, compared NOTHING on /poslanec while
 * running on /hlasovani. It is the failure mode this whole platform is built against:
 * not a wrong number, an invisible absence of checking. These two tests pin the fix
 * from both ends — the projection, and the module that must use it. */

/** A raw `vote_event` row as the store returns it, published columns included. */
const eventRow = (i: number, published: Partial<VoteEventRow> = {}): VoteEventRow =>
  ({
    id: `psp:vote:${i + 1}`,
    pspId: i + 1,
    termPspId: 10,
    termCode: "PSP10",
    sessionNo: 1,
    voteNo: i + 1,
    agendaItem: null,
    votedAt: null,
    votedOn: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    yes: 2,
    no: 3,
    abstain: 0,
    notVoting: 0,
    present: 5,
    quorum: 3,
    kind: "normal",
    outcome: "prijato",
    titleLong: `Hlasování ${i + 1}`,
    titleShort: null,
    titleNorm: `hlasovani-${i + 1}`,
    voided: false,
    sourceUrl: "https://www.psp.cz/eknih/cdrom/opendata/hl-2025ps.zip",
    ...published,
  }) as VoteEventRow;

describe("the spis reads the ledger through ledgerRead", () => {
  it("carries the Chamber's OWN tallies, so the profile path is reconciled too", () => {
    const rows = Array.from({ length: VOTES }, (_, i) => eventRow(i));
    const ledger = { ...input(), events: rows.map(toEventIn) };

    // `toEventIn` is the one row→input projection; it must carry `published` verbatim.
    expect(toEventIn(rows[0]).published).toEqual({ yes: 2, no: 3, abstain: 0, notVoting: 0 });

    const withPublished = deriveVoteRecord(ledger, { chronicleCap: Number.MAX_SAFE_INTEGER });
    expect(withPublished.reconciliation.compared).toBe(VOTES);
    expect(withPublished.reconciliation.uncompared).toBe(0);
    // Our synthetic ballots ARE the published tallies (2 yes / 3 no), so the check agrees.
    expect(withPublished.reconciliation.agreed).toBe(VOTES);
    expect(withPublished.reconciliation.discrepancies).toBe(0);

    // …and the shape the spis used to build by hand: same rows, `published` dropped.
    // Every roll call falls out of the comparison — silently, which is the whole point.
    const handRolled = deriveVoteRecord(
      { ...ledger, events: ledger.events.map(({ published: _drop, ...e }) => e) },
      { chronicleCap: Number.MAX_SAFE_INTEGER },
    );
    expect(handRolled.reconciliation.compared).toBe(0);
    expect(handRolled.reconciliation.uncompared).toBe(VOTES);
    // The rebellion rows themselves are unaffected — this is a check, not an input.
    expect(handRolled.chronicle).toEqual(withPublished.chronicle);
  });

  it("keeps no read of its own: no relation reads, no ad-hoc limits in the loader", () => {
    // A source-level pin, deliberately. The loader cannot be exercised without a store
    // (which tests must never open), and the regression this guards against is textual:
    // a second hand-rolled read growing back beside the shared one.
    const src = readFileSync(new URL("./getRebellionRecord.ts", import.meta.url), "utf8");
    // Comments are stripped first: the header NAMES the reads it no longer performs
    // (that history is the point of the file), and a scanner that cannot tell prose
    // from code would force the explanation out of the module.
    const code = src
      .split("\n")
      .filter((l) => {
        const s = l.trimStart();
        return !s.startsWith("//") && !s.startsWith("*") && !s.startsWith("/*");
      })
      .join("\n");
    expect(code).toMatch(/from "@\/features\/votetrack\/ledgerRead"/);
    for (const read of [
      "listVoteBallots",
      "listVoteEvents",
      "listMandates",
      "listPersons",
      "clubByMandate",
      "getStore",
    ]) {
      expect(code.includes(read), `${read} must come from readLedger, not from here`).toBe(false);
    }
    // No numeric literal limits: the one cap lives in ledgerRead (KG_READ_CAP).
    expect(code).not.toMatch(/limit:\s*[\d_]+/);
    // The TTL is the shared one, imported inside createLedgerMemo — never re-declared.
    expect(code).not.toMatch(/MONEY_MEMO_TTL_MS/);
    expect(code).toMatch(/createLedgerMemo/);
  });
});
