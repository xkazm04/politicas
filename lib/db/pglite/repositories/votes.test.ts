import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated PGlite data dir — NEVER the live ./.pglite. Set BEFORE any import that
// calls open() (same discipline as ledger.test.ts / review.test.ts).
const dataDir = mkdtempSync(join(tmpdir(), "politicas-votes-repo-"));
process.env.PGLITE_PATH = dataDir;

const { open, PGLITE_KEY } = await import("../internals");
type GlobalWithPglite = typeof globalThis & { [PGLITE_KEY]?: unknown };
const { makeVoteRepo } = await import("./votes");

/*
 * `listAbsences` dostal 2026-08-12 filtr podle mandátu, protože spis poslance
 * potřebuje JEDEN mandát, ne celé období: na kopii živého store stálo čtení
 * období 410–483 ms (6 425 řádků), jeden mandát 14–20 ms přes
 * `absence_mandate_idx`. Tyhle testy hlídají to, co se filtrem dá rozbít tiše:
 * prázdný seznam id, kombinaci s obdobím a mez výpisu.
 */

const TERM_PSP_ID = 174;
const OTHER_TERM_PSP_ID = 173;

async function seed(pg: Awaited<ReturnType<typeof open>>) {
  await pg.query(
    `insert into organ (id, psp_id, abbrev, name_norm, source, source_url, fetched_at)
     values ('o:174', 174, 'PSP10', 'psp10', 'psp.cz', 'https://psp.cz', now()),
            ('o:173', 173, 'PSP9',  'psp9',  'psp.cz', 'https://psp.cz', now())`,
  );
  const rows: string[] = [];
  const push = (term: number, mandate: number, day: string, from: string | null, to: string | null) =>
    rows.push(
      `('psp:omluva:${term}:${mandate}:${day}:${from ?? ""}:${to ?? ""}', ${term}, ${mandate}, '${day}', ${
        from === null ? "null" : `'${from}'`
      }, ${to === null ? "null" : `'${to}'`}, ${from === null && to === null}, 'psp-hlasovani', 'https://psp.cz/x.zip', now())`,
    );
  // mandát 2052: dvě okna jednoho dne (v 10. období je takových dvojic 1 243)
  push(TERM_PSP_ID, 2052, "2026-07-15", "00:00", "09:00");
  push(TERM_PSP_ID, 2052, "2026-07-15", "09:00", "23:59");
  push(TERM_PSP_ID, 2052, "2026-06-01", null, null);
  push(TERM_PSP_ID, 2137, "2026-07-01", "09:00", "23:59");
  // týž mandát v jiném období by se do slice poslance neměl dostat
  push(OTHER_TERM_PSP_ID, 2052, "2021-05-05", "09:00", "23:59");
  await pg.query(
    `insert into absence (id, term_psp_id, mandate_psp_id, day, from_time, to_time, whole_day, source, source_url, fetched_at)
     values ${rows.join(",")}`,
  );
}

describe("listAbsences — the per-mandate filter (DB integration)", () => {
  beforeAll(async () => {
    await seed(await open());
  });

  afterAll(async () => {
    const pg = await open();
    await pg.close();
    delete (globalThis as GlobalWithPglite)[PGLITE_KEY];
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns one mandate's own filings, and nothing else's", async () => {
    const repo = makeVoteRepo(await open());
    const rows = await repo.listAbsences({ termCode: "PSP10", mandatePspIds: [2052] });
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.mandatePspId))).toEqual(new Set([2052]));
    expect(rows.map((r) => r.day).sort()).toEqual(["2026-06-01", "2026-07-15", "2026-07-15"]);
  });

  it("keeps BOTH windows of one day — the source files them separately", async () => {
    const repo = makeVoteRepo(await open());
    const rows = (await repo.listAbsences({ mandatePspIds: [2052], termCode: "PSP10" })).filter(
      (r) => r.day === "2026-07-15",
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => `${r.fromTime}–${r.toTime}`).sort()).toEqual(["00:00–09:00", "09:00–23:59"]);
    expect(rows.every((r) => r.wholeDay === false)).toBe(true);
  });

  it("reads the whole-day flag from the source, never from the times", async () => {
    const repo = makeVoteRepo(await open());
    const [wholeDay] = (await repo.listAbsences({ mandatePspIds: [2052] })).filter((r) => r.day === "2026-06-01");
    expect(wholeDay.wholeDay).toBe(true);
    expect(wholeDay.fromTime).toBeNull();
    expect(wholeDay.toTime).toBeNull();
  });

  it("the term filter still applies alongside the mandate filter", async () => {
    const repo = makeVoteRepo(await open());
    // Same mandate number in the previous term — scoped out by termCode.
    const psp10 = await repo.listAbsences({ termCode: "PSP10", mandatePspIds: [2052] });
    const psp9 = await repo.listAbsences({ termCode: "PSP9", mandatePspIds: [2052] });
    expect(psp10.every((r) => r.termPspId === TERM_PSP_ID)).toBe(true);
    expect(psp9).toHaveLength(1);
    expect(psp9[0].day).toBe("2021-05-05");
  });

  it("an EMPTY id list matches nothing — it never becomes 'no filter'", async () => {
    const repo = makeVoteRepo(await open());
    expect(await repo.listAbsences({ termCode: "PSP10", mandatePspIds: [] })).toEqual([]);
    // …while omitting the option entirely still reads the term.
    expect((await repo.listAbsences({ termCode: "PSP10" })).length).toBe(4);
  });

  it("unions several mandates (an MP with more than one seat in a term)", async () => {
    const repo = makeVoteRepo(await open());
    const rows = await repo.listAbsences({ termCode: "PSP10", mandatePspIds: [2052, 2137] });
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.mandatePspId))).toEqual(new Set([2052, 2137]));
  });

  it("a mandate with no filings answers empty, not an error", async () => {
    const repo = makeVoteRepo(await open());
    expect(await repo.listAbsences({ termCode: "PSP10", mandatePspIds: [999999] })).toEqual([]);
  });
});
