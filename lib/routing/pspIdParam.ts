/**
 * The `[pspId]` route segment → the MP's psp.cz id, or null when the segment is not a plain
 * run of digits. ONE definition (scan-sweep 2026-09-07): `Number("1e3")`, `Number("0x10")` and
 * `Number(" 5")` are all integers, so a lenient parse gives one MP several addresses; the
 * canonical one is what every link in the app builds - the bare integer. /penize/[pspId] and
 * /penize/[pspId]/paket read it here; /poslanec/[id] still spells the same rule (its context's
 * round). A null is a genuine 404, never a loader's "graph has no such MP".
 */
export function pspIdFromParam(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}
