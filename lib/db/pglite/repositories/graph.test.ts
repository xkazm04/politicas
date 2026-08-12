import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated PGlite data dir — NEVER the live ./.pglite. Set BEFORE any import that
// calls open() (same discipline as votes.test.ts / ledger.test.ts).
const dataDir = mkdtempSync(join(tmpdir(), "politicas-graph-repo-"));
process.env.PGLITE_PATH = dataDir;

const { open, PGLITE_KEY } = await import("../internals");
type GlobalWithPglite = typeof globalThis & { [PGLITE_KEY]?: unknown };
const { makeGraphRepo } = await import("./graph");

/*
 * `listMandates` a `listMemberships` dostaly 2026-08-12 filtr PODLE OSOBY, protože
 * spis poslance potřebuje JEDNOHO člověka, ne celý registr: `mandate_person_idx`
 * a `membership_person_idx` jsou v DDL od první migrace a žádný lister pro ně
 * neměl predikát, takže /poslanec/<id> četl celou mandátní tabulku (všechna
 * období) i všechna členství období a filtroval je v JS.
 *
 * Testy hlídají přesně to, co se takovým filtrem dá rozbít potichu:
 *  • prázdné pole id nesmí ZTICHA znamenat „bez filtru" (precedens
 *    BallotListOptions/AbsenceListOptions),
 *  • vynechaná volba nesmí změnit ANI ŘÁDEK stávajícím volajícím,
 *  • predikát musí vracet TOTÉŽ co dosavadní filtr v JS (jinak by to nebyla
 *    optimalizace, ale změna odpovědi o pojmenovaném člověku),
 *  • období a osoba musejí platit SOUČASNĚ.
 */

const ALICE = 100;
const BOB = 200;

async function seed(pg: Awaited<ReturnType<typeof open>>) {
  await pg.query(
    `insert into organ (id, psp_id, parent_psp_id, organ_type_cz, abbrev, name_cz, name_norm, source, source_url, fetched_at)
     values
      ('o:174', 174, null, 'Parlament', 'PSP10', 'Poslanecká sněmovna', 'psp10', 'psp.cz', 'https://psp.cz', now()),
      ('o:173', 173, null, 'Parlament', 'PSP9',  'Poslanecká sněmovna', 'psp9',  'psp.cz', 'https://psp.cz', now()),
      ('o:300', 300, 174,  'Výbor',     'VHZD',  'Hospodářský výbor',   'vhzd',  'psp.cz', 'https://psp.cz', now())`,
  );
  await pg.query(
    `insert into mandate (id, psp_id, person_psp_id, term_psp_id, term_code, source, source_url, fetched_at)
     values
      ('m:1', 1001, ${ALICE}, 174, 'PSP10', 'psp.cz', 'https://psp.cz', now()),
      ('m:2', 1002, ${ALICE}, 173, 'PSP9',  'psp.cz', 'https://psp.cz', now()),
      ('m:3', 1003, ${BOB},   174, 'PSP10', 'psp.cz', 'https://psp.cz', now()),
      ('m:4', 1004, ${BOB},   173, 'PSP9',  'psp.cz', 'https://psp.cz', now())`,
  );
  await pg.query(
    `insert into membership (id, person_psp_id, kind, target_psp_id, organ_psp_id, function_type_cz, from_at, to_at, source, source_url, fetched_at)
     values
      ('ms:a-chamber', ${ALICE}, 'member',   174, 174, null,       '2025-10-04', null, 'psp.cz', 'https://psp.cz', now()),
      ('ms:a-vyb',     ${ALICE}, 'member',   300, 300, null,       '2025-11-01', null, 'psp.cz', 'https://psp.cz', now()),
      ('ms:a-fn',      ${ALICE}, 'function', 300, 300, 'předseda', '2025-11-01', null, 'psp.cz', 'https://psp.cz', now()),
      ('ms:b-chamber', ${BOB},   'member',   174, 174, null,       '2025-10-04', null, 'psp.cz', 'https://psp.cz', now()),
      ('ms:b-vyb',     ${BOB},   'member',   300, 300, null,       '2025-11-01', null, 'psp.cz', 'https://psp.cz', now()),
      -- předchozí období: organ 173 je jiná sněmovna, takže se do PSP10 nesmí dostat
      ('ms:a-psp9',    ${ALICE}, 'member',   173, 173, null,       '2021-10-09', '2025-10-08', 'psp.cz', 'https://psp.cz', now())`,
  );
}

describe("listMandates / listMemberships — the per-person filter (DB integration)", () => {
  beforeAll(async () => {
    await seed(await open());
  });

  afterAll(async () => {
    const pg = await open();
    await pg.close();
    delete (globalThis as GlobalWithPglite)[PGLITE_KEY];
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("listMandates returns one person's mandates across every term, and nobody else's", async () => {
    const repo = makeGraphRepo(await open());
    const rows = await repo.listMandates({ personPspIds: [ALICE] });
    expect(rows.map((r) => r.pspId)).toEqual([1001, 1002]);
    expect(new Set(rows.map((r) => r.personPspId))).toEqual(new Set([ALICE]));
  });

  it("listMemberships returns one person's rows for the term, and nobody else's", async () => {
    const repo = makeGraphRepo(await open());
    const rows = await repo.listMemberships({ termCode: "PSP10", personPspIds: [ALICE] });
    expect(rows.map((r) => r.id)).toEqual(["ms:a-chamber", "ms:a-fn", "ms:a-vyb"]);
  });

  it("the predicate answers EXACTLY what the JS filter it replaces answered", async () => {
    // The whole point: /poslanec used to read the relation and filter in JS. If the two
    // ever disagree, this is not an optimization but a changed answer about a named person.
    const repo = makeGraphRepo(await open());
    for (const person of [ALICE, BOB]) {
      const filtered = (await repo.listMemberships({ termCode: "PSP10" })).filter(
        (m) => m.personPspId === person,
      );
      expect(await repo.listMemberships({ termCode: "PSP10", personPspIds: [person] })).toEqual(filtered);

      const mandatesFiltered = (await repo.listMandates({ limit: 1_000_000 })).filter(
        (m) => m.personPspId === person,
      );
      expect(await repo.listMandates({ limit: 1_000_000, personPspIds: [person] })).toEqual(mandatesFiltered);
    }
  });

  it("an EMPTY id list matches nothing — it never becomes 'no filter'", async () => {
    const repo = makeGraphRepo(await open());
    expect(await repo.listMandates({ personPspIds: [] })).toEqual([]);
    expect(await repo.listMandates({ termCode: "PSP10", personPspIds: [] })).toEqual([]);
    expect(await repo.listMemberships({ personPspIds: [] })).toEqual([]);
    expect(await repo.listMemberships({ termCode: "PSP10", personPspIds: [] })).toEqual([]);
  });

  it("omitting the option leaves every existing caller byte-identical", async () => {
    // getLeaderboardData, moneyLoader's loadClubs and votetrack's ledgerRead all call
    // these listers with `{termCode, limit}` and nothing else. Adding the predicate must
    // not have moved a single row for them.
    const repo = makeGraphRepo(await open());
    expect((await repo.listMandates()).map((r) => r.pspId)).toEqual([1001, 1002, 1003, 1004]);
    expect((await repo.listMandates({ termCode: "PSP10" })).map((r) => r.pspId)).toEqual([1001, 1003]);
    expect((await repo.listMemberships({ termCode: "PSP10" })).map((r) => r.id)).toEqual([
      "ms:a-chamber",
      "ms:a-fn",
      "ms:a-vyb",
      "ms:b-chamber",
      "ms:b-vyb",
    ]);
    // Ordering is part of the contract: both listers order their read, so a truncation
    // is SYSTEMATIC and callers rely on the order being stable build to build.
    expect((await repo.listMemberships()).map((r) => r.id)).toEqual([
      "ms:a-chamber",
      "ms:a-fn",
      "ms:a-psp9",
      "ms:a-vyb",
      "ms:b-chamber",
      "ms:b-vyb",
    ]);
  });

  it("term and person apply TOGETHER, never one instead of the other", async () => {
    const repo = makeGraphRepo(await open());
    expect((await repo.listMandates({ termCode: "PSP9", personPspIds: [ALICE] })).map((r) => r.pspId)).toEqual([
      1002,
    ]);
    // Alice's PSP9 chamber row is scoped out of a PSP10 read even though it is hers.
    expect((await repo.listMemberships({ termCode: "PSP10", personPspIds: [ALICE] })).map((r) => r.id)).not.toContain(
      "ms:a-psp9",
    );
    expect((await repo.listMemberships({ termCode: "PSP9", personPspIds: [ALICE] })).map((r) => r.id)).toEqual([
      "ms:a-psp9",
    ]);
  });

  it("unions several people, and a person with no rows answers empty rather than erroring", async () => {
    const repo = makeGraphRepo(await open());
    const both = await repo.listMandates({ termCode: "PSP10", personPspIds: [ALICE, BOB] });
    expect(both.map((r) => r.pspId)).toEqual([1001, 1003]);
    expect(await repo.listMandates({ personPspIds: [999999] })).toEqual([]);
    expect(await repo.listMemberships({ termCode: "PSP10", personPspIds: [999999] })).toEqual([]);
  });

  it("the truncation guard still fires on the person-scoped path", async () => {
    // `warnIfTruncated` is the ONE definition (lib/db/pglite/internals.ts) and the new
    // path must not slip out from under it: a read cut off at its own limit is
    // indistinguishable from a complete one, and here it would silently shorten one
    // person's service record.
    const repo = makeGraphRepo(await open());
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };
    try {
      expect(await repo.listMemberships({ termCode: "PSP10", personPspIds: [ALICE], limit: 1 })).toHaveLength(1);
      expect(await repo.listMandates({ personPspIds: [ALICE], limit: 1 })).toHaveLength(1);
    } finally {
      console.warn = original;
    }
    expect(warnings.some((w) => w.includes("listMemberships") && w.includes("persons=1"))).toBe(true);
    expect(warnings.some((w) => w.includes("listMandates") && w.includes("persons=1"))).toBe(true);
  });
});
