/* Tail recovery for the contract-harvest JSONL (registry technique: reversible-encoding-buys-tail-recovery).
 *
 * The harvest appends one block of newline-terminated records per month and, separately, writes a
 * state file saying the month is done. A kill DURING the append leaves a final line with no newline;
 * the next run's append then fuses its first record onto that fragment and the persist step's
 * JSON.parse throws on a line nobody can attribute. The output is the only artifact that cannot
 * disagree with itself, so on resume we read its tail - bounded, from the end, never the whole file -
 * and discard an unterminated final record (the expected state at the tail of a killed job).
 *
 * Why this is the delimiter variant and not the doubled-escape one: JSONL escapes a newline inside a
 * string as \n, so a raw 0x0A is always a record boundary and can be found scanning backwards without
 * disambiguating escapes. The state file stays: a month with zero party records writes no row, so the
 * output cannot carry "this month is done" (the technique's identity-in-the-row precondition fails). */
import { promises as fs } from "node:fs";

const CHUNK = 64 * 1024;

/** Truncate `path` to its last complete line. Returns the number of bytes discarded (0 = clean or absent). */
export async function repairTornTail(path: string): Promise<number> {
  let fh;
  try {
    fh = await fs.open(path, "r+");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw e;
  }
  try {
    const { size } = await fh.stat();
    if (size === 0) return 0;
    const last = Buffer.alloc(1);
    await fh.read(last, 0, 1, size - 1);
    if (last[0] === 0x0a) return 0;
    // Walk backwards in blocks to the last record boundary; cost is the fragment, not the file.
    let end = size;
    let keep = 0;
    while (end > 0) {
      const start = Math.max(0, end - CHUNK);
      const buf = Buffer.alloc(end - start);
      await fh.read(buf, 0, buf.length, start);
      const nl = buf.lastIndexOf(0x0a);
      if (nl !== -1) {
        keep = start + nl + 1;
        break;
      }
      end = start;
    }
    await fh.truncate(keep);
    return size - keep;
  } finally {
    await fh.close();
  }
}
