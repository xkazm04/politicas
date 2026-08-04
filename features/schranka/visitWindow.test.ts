import { describe, expect, it, vi } from "vitest";
import type { EntityDelta } from "./deriveDeltas";
import { badgeCount, countSeen, newVisitGuard, openVisit } from "./visitWindow";

const NOW = "2026-08-04T09:30:00.000Z";
const PREV = "2026-08-01T18:00:00.000Z";

/** Razítkovač jako v useSchranka: první volání vrací předchozí razítko a nové
 *  zapíše, druhé už vrací to právě zapsané (přesně ten stav, kterým se okno
 *  „od minulé návštěvy" zavře, když se razítkuje dvakrát). */
function stamper(initial: string | null) {
  let stored = initial;
  const stamp = vi.fn(() => {
    const prev = stored;
    stored = NOW;
    return { prev, now: NOW };
  });
  return { stamp, read: () => stored };
}

describe("openVisit — okno přežije dvojí volání (StrictMode)", () => {
  it("orazítkuje jednou a drží PŘEDCHOZÍ práh", () => {
    const { stamp } = stamper(PREV);
    const guard = newVisitGuard();
    expect(openVisit(guard, stamp)).toEqual({ prev: PREV, day: "2026-08-04" });
    expect(stamp).toHaveBeenCalledTimes(1);
  });

  it("druhé volání téhož okna nic nezapíše a vrací null", () => {
    const { stamp, read } = stamper(PREV);
    const guard = newVisitGuard();
    const first = openVisit(guard, stamp);
    const second = openVisit(guard, stamp);
    expect(second).toBeNull();
    expect(stamp).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ prev: PREV, day: "2026-08-04" });
    expect(read()).toBe(NOW);
  });

  it("simulace dvojího volání updateru: naivní tvar okno zavře, openVisit ne", () => {
    // Naivní `setVisit((v) => v ?? { prev: stampVisit() })`: React ve
    // StrictMode volá updater dvakrát nad TÝMŽ stavem (v je pořád null).
    const naive = stamper(PREV);
    let v: { prev: string | null } | null = null;
    const updater = (prev: typeof v) => prev ?? { prev: naive.stamp().prev };
    updater(v); // první průchod — výsledek React zahodí
    v = updater(v); // druhý průchod — tenhle se použije
    expect(naive.stamp).toHaveBeenCalledTimes(2);
    expect(v).toEqual({ prev: NOW }); // práh = teď → okno je prázdné

    // Táž dvojice volání přes pojistku: práh zůstává předchozí návštěvou.
    const safe = stamper(PREV);
    const guard = newVisitGuard();
    const opened = openVisit(guard, safe.stamp) ?? openVisit(guard, safe.stamp);
    expect(safe.stamp).toHaveBeenCalledTimes(1);
    expect(opened?.prev).toBe(PREV);
  });

  it("první návštěva nemá předchozí razítko", () => {
    const { stamp } = stamper(null);
    expect(openVisit(newVisitGuard(), stamp)?.prev).toBeNull();
  });
});

const delta = (key: string, dates: string[]): EntityDelta => ({
  key,
  label: key,
  href: null,
  denikHref: `/denik?entita=${key}`,
  total: dates.length,
  latestDate: dates[0] ?? null,
  kinds: [{ kind: "contract", count: dates.length }],
  entries: dates.map((date, i) => ({
    id: `${key}-${i}`,
    date,
    kind: "contract",
    titleCs: "zápis",
    pending: false,
    timeBasis: "ucinne",
    source: "registr smluv — smlouvy.gov.cz",
    tone: "signal",
    internalHref: null,
  })),
});

describe("countSeen", () => {
  it("počítá jen řádky ode dne návštěvy dál", () => {
    const deltas = [delta("poslanec:1", ["2026-08-04", "2026-08-02"]), delta("tisk:9", ["2026-08-04"])];
    expect(countSeen(deltas, "2026-08-04")).toBe(2);
    expect(countSeen(deltas, "2026-08-01")).toBe(3);
    expect(countSeen(deltas, "2026-08-05")).toBe(0);
    expect(countSeen([], "2026-08-04")).toBe(0);
  });
});

describe("badgeCount — odznak po návštěvě zhasne", () => {
  it("odečte vodoznak téhož dne", () => {
    expect(badgeCount(3, "2026-08-04", { day: "2026-08-04", count: 3 })).toBe(0);
    expect(badgeCount(5, "2026-08-04", { day: "2026-08-04", count: 3 })).toBe(2);
  });

  it("vodoznak z jiného dne se neodečítá", () => {
    expect(badgeCount(3, "2026-08-05", { day: "2026-08-04", count: 3 })).toBe(3);
    expect(badgeCount(3, "2026-08-04", null)).toBe(3);
  });

  it("nikdy nejde pod nulu (zápis mohl z deníku zmizet)", () => {
    expect(badgeCount(1, "2026-08-04", { day: "2026-08-04", count: 4 })).toBe(0);
  });
});
