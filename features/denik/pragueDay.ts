/*
 * Deník republiky — DEN JE PRAŽSKÝ (moonshot 3A, oprava 2026-08-04).
 *
 * Deník je denní záznam ČESKÉ republiky: „dnešek" v něm musí být dnešek
 * v Praze. Loader ho počítal jako `new Date().toISOString().slice(0, 10)`,
 * tedy UTC — a mezi 00:00 a 02:00 pražského času (v létě; v zimě 00:00–01:00)
 * je pražský den o JEDEN DEN NAPŘED před UTC. Smlouva podepsaná „dnes" v Praze
 * pak spadla za horní mez `date <= today` čistého odvození (deriveDenik.ts),
 * vypadla z deníku a — a to je horší — započítala se do `droppedImplausible`,
 * tedy do čísla, kterým plocha přiznává VADNÁ DATA V KORPUSU. Časové pásmo
 * serveru tak nafukovalo počítadlo poctivosti.
 *
 * ── PROČ TU SMÍ BÝT Intl, KDYŽ czechWeekday ho odmítá ───────────────────────
 * `czechWeekday` se počítá při RENDERU na serveru i na klientovi, a ti dva
 * mohou mít různé verze ICU — proto je čistě aritmetický. Tenhle modul se volá
 * jen na SERVERU (loader, route handlery feedů) a jeho výsledek přechází ke
 * klientovi jako DATA (řetězec `YYYY-MM-DD`). Hydrataci tedy rozjet nemůže.
 *
 * ── LETNÍ ČAS SE NEODHADUJE ────────────────────────────────────────────────
 * Posun se nikde nepíše jako konstanta: čte se z časové zóny pro KONKRÉTNÍ
 * okamžik (+01:00 SEČ / +02:00 SELČ). Půlnoc dne se hledá dvouprůchodově,
 * protože posun platný o půlnoci se může lišit od posunu, kterým se hádalo.
 *
 * Čistý modul (žádný server-only import) — testuje se jako data.
 */

export const DENIK_TIME_ZONE = "Europe/Prague";

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WALL = new Intl.DateTimeFormat("en-US", {
  timeZone: DENIK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Nástěnné hodiny v Praze pro daný okamžik (ms od epochy). */
function wallClock(ms: number): WallClock {
  const parts = WALL.formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : NaN;
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Posun zóny v minutách platný V DANÉM OKAMŽIKU (+60 SEČ / +120 SELČ). */
export function pragueOffsetMinutes(instant: Date = new Date()): number {
  const ms = instant.getTime();
  if (!Number.isFinite(ms)) return NaN;
  const w = wallClock(ms);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Vteřiny se ve formátu zaokrouhlují dolů, takže rozdíl je celý počet minut.
  return Math.round((asUtc - ms) / 60_000);
}

/** `+02:00` / `+01:00` — RFC 3339 tvar posunu. */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/**
 * Dnešek v Praze jako `YYYY-MM-DD`. TOHLE je `today` čistého odvození i datum
 * sestavení plochy — ne UTC den serveru.
 */
export function pragueDay(instant: Date = new Date()): string {
  const w = wallClock(instant.getTime());
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${String(w.year).padStart(4, "0")}-${p2(w.month)}-${p2(w.day)}`;
}

/**
 * Okamžik pražské půlnoci daného dne + posun, který v ní platil.
 * Dvouprůchodově: první odhad použije posun platný v UTC půlnoci téhož data,
 * druhý ho opraví posunem, který platí ve výsledném okamžiku. Bez toho by den
 * přechodu na letní čas dostal posun sousedního režimu.
 */
export function pragueDayStart(day: string): { ms: number; offsetMinutes: number } | null {
  if (!DAY_RE.test(day)) return null;
  const guess = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(guess)) return null;
  const off1 = pragueOffsetMinutes(new Date(guess));
  if (!Number.isFinite(off1)) return null;
  const first = guess - off1 * 60_000;
  const off2 = pragueOffsetMinutes(new Date(first));
  const ms = guess - off2 * 60_000;
  return { ms, offsetMinutes: off2 };
}

/**
 * RFC 3339 razítko dne deníku — pražská půlnoc s vlastním posunem
 * (`2026-08-04T00:00:00+02:00`). Řádek deníku nese DEN, ne okamžik; jeho
 * strojová podoba proto musí říct, které zóny ten den je. Nevalidní vstup →
 * null, a formát pak element vynechá, místo aby publikoval odhad.
 */
export function pragueDayRfc3339(day: string): string | null {
  const start = pragueDayStart(day);
  if (start === null) return null;
  return `${day}T00:00:00${formatOffset(start.offsetMinutes)}`;
}
