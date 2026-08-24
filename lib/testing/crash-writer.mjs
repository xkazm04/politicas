// A child process that commits a row to a PGlite store and then DIES without
// closing the connection — no clean shutdown, no shutdown checkpoint, the
// control file left saying the cluster is in production.
//
// It exists because a crash-consistency claim is testable and therefore should
// be tested rather than cited (lib/db/pglite/durability.test.ts drives it). What
// it proves is the PROCESS-crash half of this store's contract: the parent
// reopens the same directory, recovery replays the write-ahead log, and the
// committed row is there. It cannot prove the power-cut half, and the test says
// so — `fsync` is off on this substrate, so nothing here ever reached a platter.
//
// Usage: node lib/testing/crash-writer.mjs <dataDir> <id>
import { PGlite } from "@electric-sql/pglite";

const [dir, id] = process.argv.slice(2);
if (!dir || !id) {
  console.error("usage: node crash-writer.mjs <dataDir> <id>");
  process.exit(2);
}

const pg = new PGlite(dir);
await pg.waitReady;
await pg.exec("create table if not exists crash_probe (id text primary key, at timestamptz not null default now())");
await pg.query("insert into crash_probe (id) values ($1) on conflict (id) do nothing", [id]);

// The point of the file: no `await pg.close()`. Exiting here is what an
// application being killed looks like to the store.
process.exit(0);
