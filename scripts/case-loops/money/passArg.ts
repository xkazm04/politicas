/** The `--pass=<n>` CLI value → a positive integer kg pass, or null when absent or malformed.
 *  One definition (scan-sweep 2026-09-07): `Number(arg ?? 0)` is finite for a MISSING flag,
 *  so a "required" pass silently defaulted to 0 in the provenance of a live write. */
export function parsePassArg(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}
