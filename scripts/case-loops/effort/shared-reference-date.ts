/* The day tenure is measured TO. Batch 003 pinned it to its run date
 * (2026-07-24) as a literal in two scripts, which was right for that batch's
 * payload and wrong for every re-run since: `effort_tenure_days` written in
 * September would still have counted days to July, and the profile gates the
 * PSP9→PSP10 trend on that number (TREND_MIN_TENURE_DAYS). The reference is now
 * an explicit argument with today as the default; a payload records the date it
 * used, so batch 003 stays reproducible with `--reference=2026-07-24`.
 */
export function referenceDate(argv: readonly string[] = process.argv): Date {
  const hit = argv.find((a) => a.startsWith("--reference="));
  if (!hit) return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const raw = hit.slice("--reference=".length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00.000Z`))) {
    throw new Error(`--reference must be YYYY-MM-DD, got ${JSON.stringify(raw)}`);
  }
  return new Date(`${raw}T00:00:00.000Z`);
}
