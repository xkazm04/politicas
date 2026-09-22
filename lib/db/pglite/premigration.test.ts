import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pgliteFixtureDir } from "../../testing/pglite-fixture";

/*
 * The whole ceremony, exercised end to end on a real store: detect → snapshot →
 * verify → apply → and then the half that is usually only a hope, RESTORE. The
 * technique is explicit that a restore procedure not executed in tests will be
 * executed for the first time in production by whoever is worst placed to debug
 * it, so it is executed here.
 *
 * Everything happens inside one sandbox directory: the "live" store, the
 * snapshots taken beside it and the damaged store moved aside all live under
 * `sandbox/`, so rotation can never see another test file's copies and nothing
 * is left in the OS temp root.
 */

const sandbox = mkdtempSync(join(tmpdir(), "politicas-premig-root-"));
const fixture = pgliteFixtureDir("politicas-premig-");
const liveDir = join(sandbox, ".pglite");
renameSync(fixture, liveDir);
process.env.PGLITE_PATH = liveDir;

const { disclosePendingDdl, lastUnsnapshottedApply, open, PGLITE_KEY } = await import("./internals");
const { CORE_DDL } = await import("./ddl");
const { declaredObjects, describePending, destructiveStatements, pendingSchemaObjects, stripSqlComments } =
  await import("./pending");
const { SNAPSHOT_PREFIX, manifestPathFor, restoreFromSnapshot, takePreMigrationSnapshot } = await import(
  "./premigration"
);
const { listByPrefix, verifyStoreCopy } = await import("./storeCopy");

type Pg = Awaited<ReturnType<typeof open>>;
const quiet = () => {};

async function closeStore(): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  const held = g[PGLITE_KEY] as Promise<Pg> | undefined;
  if (held) await held.then((pg) => pg.close());
  delete g[PGLITE_KEY];
}

afterAll(async () => {
  await closeStore();
  rmSync(sandbox, { recursive: true, force: true });
  rmSync(fixture, { recursive: true, force: true });
});

describe("what CORE_DDL declares", () => {
  it("reads the declarations without reading its own prose", () => {
    const d = declaredObjects();
    expect(d.tables).toHaveLength(19);
    expect(d.tables).toContain("vote_tag");
    expect(d.tables).toContain("sentinel_run");
    expect(d.indexes.length).toBeGreaterThan(20);
    expect(d.columns.some((c) => c.table === "review_audit" && c.column === "row_hash")).toBe(true);
    // The DDL discusses `create table if not exists` inside a comment; a parser
    // that reads comments would invent a table called "alone".
    expect(d.tables).not.toContain("alone");
    expect(stripSqlComments("-- create table if not exists ghost (\ncreate table if not exists real (")).not.toContain(
      "ghost",
    );
  });

  it("finds no destructive statement today, and would find one tomorrow", () => {
    expect(destructiveStatements()).toEqual([]);
    // The statement is reported up to (not including) its terminator.
    expect(destructiveStatements("drop table person;")).toEqual(["drop table person"]);
    expect(destructiveStatements("alter table kg_node drop column props;")).toHaveLength(1);
    expect(destructiveStatements("update person set name_full = '';")).toHaveLength(1);
  });
});

/*
 * The G5 block, proven HERE and nowhere near the live store. The coordinator
 * runs `npm run db:migrate` against ./.pglite after the merge; what this lane
 * owes is the evidence that the step is additive and that the columns actually
 * project the stamp rather than needing a second write.
 */
describe("[G5] the provenance columns", () => {
  it("declares four columns and four indexes, and every one of them is additive", () => {
    const d = declaredObjects();
    for (const table of ["kg_node", "kg_edge"] as const) {
      for (const column of ["source", "ingest_run_id"] as const) {
        expect(d.columns).toContainEqual({ table, column });
      }
    }
    for (const idx of ["kg_node_source_idx", "kg_node_run_idx", "kg_edge_source_idx", "kg_edge_run_idx"]) {
      expect(d.indexes).toContain(idx);
    }
    // The whole block, generated columns and check constraint included, is still
    // create/add-only — so `db:migrate` proceeds loudly rather than refusing.
    expect(destructiveStatements()).toEqual([]);
  });

  it("projects the stamp — the columns cannot disagree with the row they describe", async () => {
    const pg = await open();
    await pg.query(
      `insert into kg_node (id, kind, label, props, provenance)
       values ('g5:test:node', 'person', 'G5 fixture', '{}'::jsonb, $1::jsonb)
       on conflict (id) do update set provenance = excluded.provenance`,
      [
        JSON.stringify({
          source: "smlouvy-gov-cz",
          ingest_run_id: 4242,
          pass: 51,
          ref: "g5-fixture",
          writer: "premigration.test",
        }),
      ],
    );
    const { rows } = await pg.query<{ source: unknown; ingest_run_id: unknown }>(
      `select source, ingest_run_id from kg_node where id = 'g5:test:node'`,
    );
    expect(String(rows[0]!.source)).toBe("smlouvy-gov-cz");
    expect(Number(rows[0]!.ingest_run_id)).toBe(4242);

    // A row whose writer opened no run keeps NULL — "no run coverage", which is
    // the truth, not a missing field. And an UNKNOWN source is a value, not a gap.
    await pg.query(
      `update kg_node set provenance = $1::jsonb where id = 'g5:test:node'`,
      [JSON.stringify({ source: "unknown", ingest_run_id: null, pass: 0, ref: "backfill", writer: "b" })],
    );
    const after = await pg.query<{ source: unknown; ingest_run_id: unknown }>(
      `select source, ingest_run_id from kg_node where id = 'g5:test:node'`,
    );
    expect(String(after.rows[0]!.source)).toBe("unknown");
    expect(after.rows[0]!.ingest_run_id).toBeNull();

    await pg.query(`delete from kg_node where id = 'g5:test:node'`);
  });

  it("keeps a sentinel verdict keyed by the manifest it judged", async () => {
    const pg = await open();
    await pg.query(
      `insert into sentinel_run (id, manifest_hash, ran_at, verdict, report)
       values ('g5:run:1', 'deadbeef', now(), 'ok', '{}'::jsonb) on conflict (id) do nothing`,
    );
    // The verdict vocabulary is the report's own three states — a fourth is refused.
    await expect(
      pg.query(
        `insert into sentinel_run (id, manifest_hash, ran_at, verdict) values ('g5:run:2', 'x', now(), 'green')`,
      ),
    ).rejects.toThrow();
    await pg.query(`delete from sentinel_run where id like 'g5:run:%'`);
  });
});

describe("the ceremony", () => {
  it("finds nothing pending on a fully provisioned store, and takes no snapshot for it", async () => {
    const pg = await open();
    const pending = await pendingSchemaObjects(pg);
    expect(pending.count).toBe(0);
    expect(pending.storeState).toBe("existing");
    expect(describePending(pending)).toContain("0 steps pending");

    const snap = await takePreMigrationSnapshot({ pg, liveDir, pending, log: quiet });
    expect(snap.taken).toBe(false);
    expect(snap.reason).toBe("0 steps pending");
    expect(await listByPrefix(sandbox, SNAPSHOT_PREFIX)).toHaveLength(0);
  });

  it("takes nothing for a fresh store either — there is no earlier state to preserve", async () => {
    const pg = await open();
    const snap = await takePreMigrationSnapshot({
      pg,
      liveDir,
      pending: { storeState: "fresh", tables: ["person"], indexes: [], columns: [], count: 1 },
      log: quiet,
    });
    expect(snap.taken).toBe(false);
    expect(snap.reason).toContain("fresh store");
  });

  it("sees real pending work once an object is missing", async () => {
    const pg = await open();
    // Stand in for "a release added a table": remove one from this isolated copy.
    await pg.exec("drop table vote_tag");
    const pending = await pendingSchemaObjects(pg);
    expect(pending.storeState).toBe("existing");
    expect(pending.tables).toEqual(["vote_tag"]);
    expect(pending.indexes.sort()).toEqual(["vote_tag_theme_idx", "vote_tag_vote_idx"]);
    expect(pending.count).toBe(3);
    expect(describePending(pending)).toContain("vote_tag");
  });

  it("snapshots before the step, verifies the copy by reopening it, and names what it preserves", async () => {
    const pg = await open();
    await pg.query(
      `insert into lens_submission (id, vahy, submitted_at) values ('premig:1', '1-1-1-1-1', now())
       on conflict (id) do nothing`,
    );
    const pending = await pendingSchemaObjects(pg);
    const snap = await takePreMigrationSnapshot({ pg, liveDir, pending, log: quiet });

    expect(snap.taken).toBe(true);
    expect(snap.dir).toContain(SNAPSHOT_PREFIX);
    expect(snap.verification?.ok).toBe(true);
    expect(snap.verification!.tables).toBeGreaterThan(10);

    const manifest = JSON.parse(readFileSync(manifestPathFor(snap.dir!), "utf8")) as Record<string, unknown>;
    expect(manifest.schema).toBe("politicas-premigration");
    expect(String(manifest.preservesFingerprint)).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.dir).toContain(String(manifest.preservesFingerprint).slice(0, 8));
    expect((manifest.pending as { tables: string[] }).tables).toEqual(["vote_tag"]);

    // Applying the step leaves the store current and the copy historical — which
    // is the whole point of taking it BEFORE.
    await pg.exec(CORE_DDL);
    expect((await pendingSchemaObjects(pg)).count).toBe(0);
  });

  it("rotates by migration boundary, manifest and all", async () => {
    // Rotation's own edge cases (prefix isolation, dry run, oldest first) are in
    // lib/db/pglite/storeCopy.test.ts over plain directories, where they cost no
    // WASM boot. What is asserted HERE is the part only the real path shows:
    // that taking a snapshot rotates automatically — creation names the reaper.
    const pg = await open();
    const first = (await listByPrefix(sandbox, SNAPSHOT_PREFIX))[0]!;
    const pending = await pendingSchemaObjects(pg);
    const snap = await takePreMigrationSnapshot({
      pg,
      liveDir,
      pending: { ...pending, tables: ["pretend_pending"], count: 1 },
      keep: 1,
      log: quiet,
      now: () => new Date(Date.UTC(2026, 7, 25, 10, 0, 0)),
    });

    expect(snap.taken).toBe(true);
    expect(snap.kept).toEqual([snap.dir!.split(/[\\/]/).pop()]);
    // The older one went whole: directory and the manifest that described it.
    expect(existsSync(first.path)).toBe(false);
    expect(existsSync(manifestPathFor(first.path))).toBe(false);
    expect(existsSync(manifestPathFor(snap.dir!))).toBe(true);
  });

  it("restores: the damaged store is moved aside, not deleted, and the copy comes back readable", async () => {
    const snaps = await listByPrefix(sandbox, SNAPSHOT_PREFIX);
    const from = snaps[snaps.length - 1]!.path;

    await closeStore();
    // Damage: not a metaphor — make the version stamp unreadable. The store is
    // NOT opened again here on purpose: a failed PGlite open keeps the directory
    // locked in-process on Windows (measured — the rename below then fails with
    // EPERM), which is exactly why the restore door is a separate process.
    writeFileSync(join(liveDir, "PG_VERSION"), "garbage");

    const result = await restoreFromSnapshot({ snapshotDir: from, liveDir, log: quiet });
    expect(result.verification.ok).toBe(true);
    expect(result.movedAsideTo).not.toBeNull();
    expect(existsSync(result.movedAsideTo!)).toBe(true); // evidence, kept

    // The restored store opens, carries the row written before the snapshot, and
    // reads the schema shape the copy preserved.
    const pg = await open();
    const rows = await pg.query<{ n: number }>("select count(*)::int as n from lens_submission where id = 'premig:1'");
    expect(rows.rows[0]!.n).toBe(1);
  });

  it("refuses to restore a copy that does not verify", async () => {
    const broken = join(sandbox, "not-a-store");
    await expect(restoreFromSnapshot({ snapshotDir: broken, liveDir, log: quiet })).rejects.toThrow(
      /refusing to restore/,
    );
  });

  it("discloses at boot that schema work ran with no snapshot, and carries the fact", async () => {
    const pg = await open();
    await pg.exec("drop table vote_tag");
    await closeStore();

    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
    try {
      await open(); // applies CORE_DDL, as every boot does
    } finally {
      console.warn = original;
    }

    expect(warnings.join("\n")).toContain("WITHOUT a pre-migration snapshot");
    expect(warnings.join("\n")).toContain("vote_tag");
    // Carried, not just printed: a later failure report can say "and there was
    // no snapshot" instead of leaving it to be discovered.
    expect(lastUnsnapshottedApply()?.pending).toContain("vote_tag");
    expect((await pendingSchemaObjects(await open())).count).toBe(0);
  });

  it("refuses the boot outright when the pending work is destructive", async () => {
    const pg = await open();
    await pg.exec("drop table vote_tag");
    await expect(disclosePendingDdl(pg, `${CORE_DDL}\ndrop table person;`)).rejects.toThrow(/REFUSING/);
    await pg.exec(CORE_DDL); // put it back for the teardown
  });

  it("does not accept a store that opened but carries nothing", async () => {
    // MEASURED 2026-08-24: given a directory it cannot read as a store, PGlite
    // does not fail — it initializes a NEW one there. Removing global/pg_control
    // from a 19 MB provisioned copy, and removing base/ outright, both produced
    // a connection that opened cleanly and answered queries with ZERO tables.
    // "It opened" is therefore not a verification. This asserts the rule against
    // the shape those cases collapse to: an empty but perfectly healthy store.
    const empty = join(sandbox, "empty-store");
    const { PGlite } = await import("@electric-sql/pglite");
    const fresh = new PGlite(empty);
    await fresh.waitReady;
    await fresh.close();

    const v = await verifyStoreCopy(empty);
    expect(v.ok).toBe(false);
    expect(v.tables).toBe(0);
    expect(v.error).toContain("carries no tables");
    expect(v.files).toBeGreaterThan(0); // structurally a store; semantically nothing
    rmSync(empty, { recursive: true, force: true });
  });
});
