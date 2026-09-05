// Parser for the UNL export format the Poslanecká sněmovna publishes at
// https://www.psp.cz/sqw/hp.sqw?k=1300 (Informix "UNLOAD" dumps).
//
// Format, per the publisher's own description on that page:
//   • one database row per line
//   • columns separated by the pipe character (\124), trailing pipe on every row
//   • an empty column is SQL NULL
//   • special characters are written as escape sequences introduced by a
//     backslash (\092) followed by one character
//   • the byte encoding is windows-1250
//
// The escape rule matters: a literal pipe inside a vote title is written `\|`,
// so a naive `line.split("|")` silently shifts every later column of that row.
// Vote titles ("Zákon o ... § 12 | 2. čtení") do contain pipes, so this is not
// hypothetical.

/** One parsed row: the raw column strings, `null` where the source column was empty. */
export type UnlRow = (string | null)[];

/**
 * Split one UNL line into columns, honouring backslash escapes.
 *
 * `\|` is a literal pipe, `\\` a literal backslash, `\n`/`\r`/`\t` the obvious
 * control characters; any other `\x` yields `x` verbatim (the publisher does not
 * document a closed set, so passing the character through loses nothing).
 * The trailing empty column produced by the row-terminating pipe is dropped.
 */
export function parseUnlLine(line: string): UnlRow {
  const cols: UnlRow = [];
  let buf = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\") {
      const next = line[++i];
      if (next === undefined) {
        buf += "\\";
        break;
      }
      buf += next === "n" ? "\n" : next === "r" ? "\r" : next === "t" ? "\t" : next;
      continue;
    }
    if (ch === "|") {
      cols.push(buf.length === 0 ? null : buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  // A row ends with `|`, so `buf` is the empty remainder — but keep a non-empty
  // remainder rather than dropping data if a producer ever omits the terminator.
  if (buf.length > 0) cols.push(buf);
  return cols;
}

/**
 * Parse a whole UNL file body into rows. Blank lines are skipped.
 *
 * A row may legitimately contain an escaped newline (`\n`), which `parseUnlLine`
 * turns back into a real newline — so we split on physical newlines FIRST and
 * unescape per line, never the other way round.
 */
export function parseUnl(body: string): UnlRow[] {
  const rows: UnlRow[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (line.length === 0) continue;
    rows.push(parseUnlLine(line));
  }
  return rows;
}

/** Decode a windows-1250 UNL payload. Node's built-in ICU covers cp1250.
 * `fatal: true` makes an unmappable byte (corrupted download, wrong source
 * encoding, an off-by-one in zip extraction) throw instead of silently
 * substituting U+FFFD — this module's whole discipline is "missing beats
 * wrong," and a silently mangled name/title is exactly the "wrong" case. */
export function decodeUnl(bytes: Uint8Array): string {
  return new TextDecoder("windows-1250", { fatal: true }).decode(bytes);
}

/** Column accessor that returns `null` for a missing column (short rows happen). */
export function col(row: UnlRow, i: number): string | null {
  const v = row[i];
  return v === undefined ? null : v;
}

/** Column as an integer, `null` when empty or unparseable. Requires the FULL
 * trimmed value to be digits — Number.parseInt's prefix-parse would otherwise
 * silently accept "123abc" or a mis-escaped "45|" as 123/45, coercing a
 * malformed field into a plausible-looking but wrong id. */
export function colInt(row: UnlRow, i: number): number | null {
  const v = col(row, i);
  if (v === null) return null;
  const trimmed = v.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  // Safe, not merely finite: a 20-digit field parses to a finite 1e20 that is not
  // the number written — a rounded id is the coerced-wrong case this guard exists for.
  return Number.isSafeInteger(n) ? n : null;
}

/** True when year/month/day name a real calendar day. Range checks alone let
 *  `31.02.` through as `…-02-31` (syntactically ISO, semantically no day at all)
 *  until 2026-09-06; a UTC round-trip is the cheapest complete check. */
function isCalendarDay(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/**
 * `DD.MM.YYYY` → `YYYY-MM-DD`. Returns null for empty/malformed input rather
 * than guessing — a wrong date on a civic-accountability record is worse than a
 * missing one. Calendar-validated, not just range-checked.
 */
export function czDateToIso(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  if (!isCalendarDay(Number(y), month, day)) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * `datetime(year to hour)` — the publisher writes `YYYY-MM-DD HH`. Returned as
 * an ISO-8601 instant in UTC; the source carries no zone, and every consumer of
 * these columns (membership windows) works at day resolution.
 */
export function czDateHourToIso(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}))?/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d, h] = m;
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h ?? 0);
  // Same calendar validation czDateToIso enforces for DD.MM.YYYY — a
  // regex-shaped but semantically invalid value (month 13, day 31 of April,
  // hour 27) must not be emitted as a syntactically-ISO but meaningless timestamp.
  if (!isCalendarDay(Number(y), month, day) || hour < 0 || hour > 23) return null;
  return `${y}-${mo}-${d}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

/** Combine `datum` (DD.MM.YYYY) + `čas` (HH:MM) into an ISO instant (UTC). */
export function czDateTimeToIso(date: string | null, time: string | null): string | null {
  const iso = czDateToIso(date);
  if (!iso) return null;
  const m = time ? /^(\d{1,2}):(\d{2})/.exec(time.trim()) : null;
  if (!m) return `${iso}T00:00:00.000Z`;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const hh = String(hour).padStart(2, "0");
  return `${iso}T${hh}:${m[2]}:00.000Z`;
}
