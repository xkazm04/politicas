import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgliteFixtureDir } from "../../../testing/pglite-fixture";

// Isolated PGlite data dir — NEVER the live ./.pglite (same discipline as graph.test.ts).
const dataDir = pgliteFixtureDir("politicas-club-by-mandate-");

const { open, PGLITE_KEY } = await import("../internals");
type GlobalWithPglite = typeof globalThis & { [PGLITE_KEY]?: unknown };
const { makeGraphRepo } = await import("./graph");

/*
 * `clubByMandate` answers ONE club per mandate and every reader treats it as the club
 * TODAY (getLeaderboardData, moneyLoader, volbyLoader). Its query had no ORDER BY, so
 * for an MP who changed clubs mid-term the answer was whichever membership row the
 * scan happened to return last — insertion order, not the calendar. Its sibling
 * `clubWindowsByMandate` calls its own ORDER BY load-bearing for exactly this reason.
 *
 * The seed inserts the CURRENT club first and the closed one second, so a scan in
 * insertion order returns the closed club last — the wrong answer, deterministically.
 */
const SWITCHER = 300;
const STAYER = 301;
// Left their club and sit as independents: the chamber seat is open, every club window is closed.
const INDEPENDENT = 302;
// Replaced MP: the chamber seat is closed too, so the last club is the last KNOWN one.
const REPLACED = 303;

async function seed(pg: Awaited<ReturnType<typeof open>>) {
  await pg.query(
    `insert into organ (id, psp_id, parent_psp_id, organ_type_cz, abbrev, name_cz, name_norm, source, source_url, fetched_at)
     values
      ('o:174', 174, null, 'Parlament', 'PSP10', 'Poslanecká sněmovna', 'psp10', 'psp.cz', 'https://psp.cz', now()),
      ('o:400', 400, 174,  'Klub',      'STARY', 'Starý klub',          'stary', 'psp.cz', 'https://psp.cz', now()),
      ('o:401', 401, 174,  'Klub',      'NOVY',  'Nový klub',           'novy',  'psp.cz', 'https://psp.cz', now())`,
  );
  await pg.query(
    `insert into mandate (id, psp_id, person_psp_id, term_psp_id, term_code, source, source_url, fetched_at)
     values
      ('m:s', 3001, ${SWITCHER}, 174, 'PSP10', 'psp.cz', 'https://psp.cz', now()),
      ('m:t', 3002, ${STAYER},   174, 'PSP10', 'psp.cz', 'https://psp.cz', now()),
      ('m:i', 3003, ${INDEPENDENT}, 174, 'PSP10', 'psp.cz', 'https://psp.cz', now()),
      ('m:r', 3004, ${REPLACED}, 174, 'PSP10', 'psp.cz', 'https://psp.cz', now())`,
  );
  await pg.query(
    `insert into membership (id, person_psp_id, kind, target_psp_id, organ_psp_id, from_at, to_at, source, source_url, fetched_at)
     values
      ('ms:s-new', ${SWITCHER}, 'member', 401, 401, '2026-02-01', null,         'psp.cz', 'https://psp.cz', now()),
      ('ms:s-old', ${SWITCHER}, 'member', 400, 400, '2025-10-04', '2026-01-31', 'psp.cz', 'https://psp.cz', now()),
      ('ms:t',     ${STAYER},   'member', 400, 400, '2025-10-04', null,         'psp.cz', 'https://psp.cz', now()),
      ('ms:i-club', ${INDEPENDENT}, 'member', 400, 400, '2025-10-04', '2026-03-01', 'psp.cz', 'https://psp.cz', now()),
      ('ms:i-seat', ${INDEPENDENT}, 'member', 174, 174, '2025-10-04', null,         'psp.cz', 'https://psp.cz', now()),
      ('ms:r-club', ${REPLACED}, 'member', 400, 400, '2025-10-04', '2026-03-01', 'psp.cz', 'https://psp.cz', now()),
      ('ms:r-seat', ${REPLACED}, 'member', 174, 174, '2025-10-04', '2026-03-01', 'psp.cz', 'https://psp.cz', now())`,
  );
}

describe("clubByMandate — the club TODAY, not the row the scan met last (2026-09-06, bounty-hunter)", () => {
  beforeAll(async () => {
    await seed(await open());
  });

  afterAll(async () => {
    const pg = await open();
    await pg.close();
    delete (globalThis as GlobalWithPglite)[PGLITE_KEY];
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("a club switcher resolves to the OPEN window, whatever order the rows were stored in", async () => {
    const repo = makeGraphRepo(await open());
    const clubs = await repo.clubByMandate("PSP10");
    expect(clubs.get(3001)).toBe("NOVY");
    expect(clubs.get(3002)).toBe("STARY");
  });

  it("a sitting MP whose every club window is closed has NO club today (independent), not the club they left", async () => {
    const repo = makeGraphRepo(await open());
    const clubs = await repo.clubByMandate("PSP10");
    expect(clubs.has(3003)).toBe(false);
  });

  it("a replaced MP (chamber seat closed) keeps the last KNOWN club", async () => {
    const repo = makeGraphRepo(await open());
    const clubs = await repo.clubByMandate("PSP10");
    expect(clubs.get(3004)).toBe("STARY");
  });

  it("clubWindowsByMandate still returns both windows, oldest first", async () => {
    const repo = makeGraphRepo(await open());
    const windows = await repo.clubWindowsByMandate("PSP10");
    expect(windows.get(3001)?.map((w) => w.club)).toEqual(["STARY", "NOVY"]);
  });
});
