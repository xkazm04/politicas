/* Money loop — batch 005, "live-table CHECK migration".
 *
 * D5 (batch 004) added a CHECK constraint to `review_audit.decision` in
 * lib/db/pglite/ddl.ts's CORE_DDL (`check (decision in ('confirm', 'reject',
 * 'needs-more'))`) — but CORE_DDL only runs `create table if not exists`, so
 * that constraint only lands on a FRESHLY-CREATED database. The LIVE
 * ./.pglite database's `review_audit` table was created in batch 003, before
 * the CHECK existed, and `create table if not exists` is a no-op against an
 * existing table — it does NOT retrofit new constraints. Today the only guard
 * on `decision` is the runtime whitelist in features/money/reviewActions.ts.
 *
 * THIS script adds the missing CHECK constraint to an EXISTING `review_audit`
 * table via `ALTER TABLE ... ADD CONSTRAINT`. It uses the SAME auto-generated
 * name Postgres would assign an unnamed inline `check` on a fresh table
 * (`<table>_<column>_check`), so a DB migrated by this script and a DB created
 * fresh from CORE_DDL end up with an identically-named constraint.
 *
 * FLEET MODE — PREPARE, DON'T EXECUTE. This script:
 *   - defaults to dry-run (no flags, or an explicit --dry-run, NEVER writes)
 *   - only --commit performs a live ALTER TABLE, and even then only against
 *     whatever PGLITE_PATH points at — it is the CALLER's responsibility never
 *     to point that at ./.pglite (the live DB) or another case's
 *     .pglite-copy-*. This script does not default PGLITE_PATH itself;
 *     lib/db/config.ts's pglitePath() does that (falls back to ./.pglite when
 *     unset), so a --commit with PGLITE_PATH unset is refused outright unless
 *     --confirm-live is passed (same gate as purge-osvc.ts).
 *
 * Idempotent: checks information_schema.check_constraints for the constraint
 * name before altering — running this twice never errors.
 *
 * Safe: before altering, checks every existing `review_audit.decision` value
 * against the constraint's own allowed set. If any row would violate it, the
 * script REFUSES to add the constraint and prints the offending rows — never
 * adds a constraint that would hide/reject a pre-existing bad row silently.
 *
 * Always writes the payload/listing to
 *   docs/data-analysis/case-money/payloads/batch-005-review-audit-check-migration.json
 * (dry-run AND commit — a durable artifact for the orchestrator, not just
 * console output).
 *
 *   # dry-run against a copy (default; never writes):
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/migrate-review-audit-check.ts
 *
 *   # live-shaped commit — ONLY ever point PGLITE_PATH at an isolated copy/fixture you own:
 *   PGLITE_PATH=./.pglite-copy-money npx tsx scripts/case-loops/money/migrate-review-audit-check.ts --commit
 *
 * Flags: --commit (opt-in write; default is dry-run), --confirm-live (required
 * alongside --commit if PGLITE_PATH is unset, i.e. targeting the default
 * ./.pglite path — mirrors purge-osvc.ts's gate).
 */
import { open } from "@/lib/db/pglite/internals";

const TABLE = "review_audit";
const COLUMN = "decision";
const CONSTRAINT_NAME = `${TABLE}_${COLUMN}_check`;
const ALLOWED_DECISIONS = ["confirm", "reject", "needs-more"] as const;
const PAYLOAD_PATH = "docs/data-analysis/case-money/payloads/batch-005-review-audit-check-migration.json";

const flag = (name: string) => process.argv.includes(`--${name}`);

interface MigrationPayload {
  batch: 5;
  track: "money";
  item: "D5-live-migration";
  kind: "review-audit-check-constraint-migration";
  generatedAt: string;
  dryRun: boolean;
  alreadyExists: boolean;
  violatingRowCount: number;
  violatingRows: { id: string; decision: string }[];
  applied: boolean;
  constraintName: string;
}

async function main() {
  const commit = flag("commit");
  // Orchestrator safety gate (same convention as purge-osvc.ts): a --commit
  // that would land on the DEFAULT live ./.pglite (PGLITE_PATH unset) must be
  // doubly deliberate.
  if (commit && !process.env.PGLITE_PATH && !flag("confirm-live")) {
    console.error(
      "REFUSED: --commit with PGLITE_PATH unset targets the LIVE ./.pglite.\n" +
        "Either point PGLITE_PATH at a copy/fixture, or pass --confirm-live to state the live write is intentional.",
    );
    process.exit(1);
  }

  console.log(`review_audit CHECK migration (batch 005) · ${commit ? "COMMIT" : "DRY-RUN"}`);
  console.log(`  target data dir: ${process.env.PGLITE_PATH || "./.pglite"}`);
  console.log(`  constraint: ${CONSTRAINT_NAME} on ${TABLE}(${COLUMN})\n`);

  const pg = await open();

  // 1) idempotency check — does the constraint already exist?
  const { rows: existingRows } = await pg.query<{ constraint_name: string }>(
    `select constraint_name
       from information_schema.check_constraints
      where constraint_name = $1
        and constraint_schema = current_schema()`,
    [CONSTRAINT_NAME],
  );
  const alreadyExists = existingRows.length > 0;
  console.log(`constraint already exists: ${alreadyExists}`);

  // 2) pre-check — would any existing row violate the constraint?
  const placeholders = ALLOWED_DECISIONS.map((_, i) => `$${i + 1}`).join(", ");
  const { rows: violating } = await pg.query<{ id: string; decision: string }>(
    `select id, decision from ${TABLE} where decision not in (${placeholders})`,
    [...ALLOWED_DECISIONS],
  );
  console.log(`violating rows (decision not in ${JSON.stringify(ALLOWED_DECISIONS)}): ${violating.length}`);
  if (violating.length) {
    console.log(`  ⚠⚠ REFUSING to add the constraint — existing bad rows would be hidden/rejected:`);
    for (const r of violating.slice(0, 50)) console.log(`      id=${r.id} decision=${JSON.stringify(r.decision)}`);
  }

  let applied = false;

  if (alreadyExists) {
    console.log(`\nNOOP: constraint ${CONSTRAINT_NAME} already present — nothing to do (idempotent).`);
  } else if (violating.length > 0) {
    console.log(`\nNOT APPLYING: ${violating.length} existing row(s) would violate the constraint. Fix the data first.`);
  } else if (!commit) {
    console.log(`\nDRY-RUN: would run:`);
    console.log(
      `  ALTER TABLE ${TABLE} ADD CONSTRAINT ${CONSTRAINT_NAME} CHECK (${COLUMN} in ('confirm', 'reject', 'needs-more'));`,
    );
    console.log(`Re-run with --commit (against an isolated copy) to apply.`);
  } else {
    console.log(`\n--commit passed — altering the table...`);
    await pg.query(
      `alter table ${TABLE} add constraint ${CONSTRAINT_NAME} check (${COLUMN} in ('confirm', 'reject', 'needs-more'))`,
    );
    applied = true;
    console.log(`  applied: ${CONSTRAINT_NAME}`);
  }

  const payload: MigrationPayload = {
    batch: 5,
    track: "money",
    item: "D5-live-migration",
    kind: "review-audit-check-constraint-migration",
    generatedAt: new Date().toISOString(),
    dryRun: !commit,
    alreadyExists,
    violatingRowCount: violating.length,
    violatingRows: violating.map((r) => ({ id: r.id, decision: r.decision })),
    applied,
    constraintName: CONSTRAINT_NAME,
  };

  const fs = await import("node:fs/promises");
  await fs.mkdir("docs/data-analysis/case-money/payloads", { recursive: true });
  await fs.writeFile(PAYLOAD_PATH, JSON.stringify(payload, null, 2));
  console.log(`\npayload written: ${PAYLOAD_PATH}`);

  await pg.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
