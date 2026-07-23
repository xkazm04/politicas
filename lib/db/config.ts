/**
 * Database driver selection — the single place that decides where the civic
 * graph lives. Imported on both client and server (it only reads env), so it
 * must NOT pull in @electric-sql/pglite; that loads lazily inside getStore().
 *
 * Today there is exactly one driver (`pglite`, embedded Postgres, zero infra).
 * The indirection exists because politicas is an entity GRAPH: the queries that
 * matter are recursive CTEs over person ↔ party ↔ vote and JSONB reads over
 * heterogeneous open-data payloads, so the target is real Postgres. Keeping the
 * driver behind `Store` means the move to a hosted Postgres is a new file, not
 * a rewrite of every call site.
 */

export type DbDriver = "pglite";

export function dbDriver(): DbDriver | null {
  const explicit = process.env.DB_DRIVER?.trim().toLowerCase();
  if (explicit === "pglite") return "pglite";
  if (explicit) return null;
  return "pglite";
}

/**
 * Local PGlite data directory (created on first use).
 *
 * PGLITE IS SINGLE-CONNECTION. One process may hold one connection to one data
 * dir; a second connection to a live directory corrupts or blocks. Analysis
 * scripts therefore run against a COPY:
 *   cp -r .pglite .pglite-copy && PGLITE_PATH=./.pglite-copy npm run da:slice-stats
 */
export function pglitePath(): string {
  return process.env.PGLITE_PATH || "./.pglite";
}
