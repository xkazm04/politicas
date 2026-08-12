import { describe, expect, it } from "vitest";

import { buildAbsenceRecord, PROFILE_ABSENCE_DAYS, type AbsenceRowInput } from "./absenceRecord";

/*
 * Evidence omluv → dny. Tvary jsou vzaté z živého korpusu (10. období, změřeno
 * 2026-08-12): 6 425 podání ve 110 dnech, 1 243 dvojic mandát×den s víc než
 * jedním oknem, 10 podání s dnem v budoucnosti, ani jedno celodenní.
 */

const TODAY = "2026-08-12";

const row = (day: string, from: string | null = "09:00", to: string | null = "23:59"): AbsenceRowInput => ({
  day,
  fromTime: from,
  toTime: to,
  wholeDay: from === null && to === null,
});

describe("buildAbsenceRecord", () => {
  it("groups filings into days, newest first", () => {
    const r = buildAbsenceRecord([row("2026-03-01"), row("2026-05-01"), row("2026-04-01")], TODAY);
    expect(r.days.map((d) => d.day)).toEqual(["2026-05-01", "2026-04-01", "2026-03-01"]);
    expect(r.totalDays).toBe(3);
    expect(r.filings).toBe(3);
    expect(r.from).toBe("2026-03-01");
    expect(r.to).toBe("2026-05-01");
  });

  it("keeps SEVERAL windows on one day and orders them by start time", () => {
    // 1 243 dvojic mandát×den v 10. období nese víc než jedno okno — sloučit je
    // do „celého dne" by znamenalo tvrdit něco, co zdroj nezapsal.
    const r = buildAbsenceRecord(
      [row("2026-05-01", "09:00", "23:59"), row("2026-05-01", "00:00", "09:00")],
      TODAY,
    );
    expect(r.days).toHaveLength(1);
    expect(r.days[0].windows.map((w) => w.from)).toEqual(["00:00", "09:00"]);
    expect(r.days[0].wholeDay).toBe(false);
    expect(r.totalDays).toBe(1);
    expect(r.filings).toBe(2);
  });

  it("never infers a whole day — only the source's own flag says so", () => {
    const timed = buildAbsenceRecord(
      [row("2026-05-01", "00:00", "09:00"), row("2026-05-01", "09:00", "23:59")],
      TODAY,
    );
    expect(timed.days[0].wholeDay).toBe(false);

    const stated = buildAbsenceRecord([row("2026-05-01", null, null)], TODAY);
    expect(stated.days[0].wholeDay).toBe(true);
    expect(stated.days[0].windows).toEqual([{ from: null, to: null, wholeDay: true }]);
  });

  it("collapses an identical filing recorded twice, and keeps a different one", () => {
    const r = buildAbsenceRecord(
      [row("2026-05-01", "09:00", "23:59"), row("2026-05-01", "09:00", "23:59"), row("2026-05-01", "00:00", "09:00")],
      TODAY,
    );
    expect(r.days[0].windows).toHaveLength(2);
    // `filings` počítá ŘÁDKY evidence, ne vykreslená okna — jinak by se ztratilo,
    // že zdroj ten záznam vede dvakrát.
    expect(r.filings).toBe(3);
  });

  it("discloses the cap instead of shrinking the record", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(`2026-05-${String(i + 1).padStart(2, "0")}`));
    const r = buildAbsenceRecord(rows, TODAY);
    expect(r.days).toHaveLength(PROFILE_ABSENCE_DAYS);
    expect(r.totalDays).toBe(20);
    expect(r.days[0].day).toBe("2026-05-20");
    // …a nejstarší den záznamu je pořád ten skutečný, ne poslední vypsaný.
    expect(r.from).toBe("2026-05-01");
  });

  it("renders a future day and counts it — an excuse is filed AHEAD", () => {
    const r = buildAbsenceRecord([row("2026-08-29"), row("2026-08-01")], TODAY);
    expect(r.days.map((d) => d.day)).toEqual(["2026-08-29", "2026-08-01"]);
    expect(r.days[0].future).toBe(true);
    expect(r.days[1].future).toBe(false);
    expect(r.futureDays).toBe(1);
  });

  it("drops an unreadable day, counts it, and never guesses one", () => {
    const r = buildAbsenceRecord([row("2026-05-01"), row(""), row("nevím")], TODAY);
    expect(r.days).toHaveLength(1);
    expect(r.droppedUndated).toBe(2);
    expect(r.filings).toBe(1);
  });

  it("an empty record is an answer, not a failure", () => {
    const r = buildAbsenceRecord([], TODAY);
    expect(r).toEqual({
      days: [],
      totalDays: 0,
      filings: 0,
      from: null,
      to: null,
      futureDays: 0,
      droppedUndated: 0,
    });
  });

  it("counts DISTINCT days — the quantity the index divides by session days", () => {
    // Ingest sype omluvy do `Set<isoDay>` a míru počítá jako
    // distinct dny / jednací dny (scripts/data-analysis/kg-contribution-ingest.ts).
    // Ověřeno na kopii živého store: pro 207/207 poslanců 10. období vychází
    // round3(min(1, totalDays / 63)) přesně na uloženou `absence_rate`.
    const r = buildAbsenceRecord(
      [row("2026-05-01", "00:00", "09:00"), row("2026-05-01", "09:00", "23:59"), row("2026-05-02")],
      TODAY,
    );
    expect(r.totalDays).toBe(2);
    expect(r.filings).toBe(3);
  });
});
