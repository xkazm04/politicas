/**
 * A route segment that must be a positive integer - a print number, a psp id, an IČO-free
 * ordinal - or null when it is anything else (scan-sweep 2026-09-07).
 *
 * `Number("1e3")`, `Number("0x10")`, `Number(" 5")`, `Number("8.5")` and `Number("")` are all
 * finite, so a lenient parse hands one record several addresses (or a fractional one that
 * silently 404s). The canonical address is the one every link in the app builds: the bare
 * integer. A null is a genuine 404, never a loader's "no such record".
 * `lib/routing/pspIdParam.ts` spells the same rule for MP ids (backlog: alias it here).
 */
export function positiveIntParam(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
