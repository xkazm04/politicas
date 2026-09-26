import { describe, expect, it, vi } from "vitest";
import { sinceDay, type EntityDelta } from "./deriveDeltas";
import { badgeCount, commitVisit, countSeen, newVisitGuard, openVisit } from "./visitWindow";

const NOW = "2026-08-04T09:30:00.000Z";
const PREV = "2026-08-01T18:00:00.000Z";

/** Čtečka jako v useSchranka (`peekVisit`): vrací uložené razítko a okamžik
 *  návštěvy, nic nezapisuje. Zapisuje až `commit` (`commitVisit`). */
function store(initial: string | null) {
  let stored = initial;
  const peek = vi.fn(() => ({ prev: stored, now: NOW }));
  const commit = vi.fn((at: string) => {
    if (stored === null || stored < at) stored = at;
  });
  return { peek, commit, read: () => stored };
}

/** Původní tvar (do 2026-09): razítko se zapsalo už při otevření. */
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
  it("otevře jednou, drží PŘEDCHOZÍ práh a nic nezapíše", () => {
    const { peek, commit, read } = store(PREV);
    const guard = newVisitGuard();
    expect(openVisit(guard, peek)).toEqual({ prev: PREV, now: NOW, day: "2026-08-04" });
    expect(peek).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    expect(read()).toBe(PREV);
  });

  it("druhé volání téhož okna vrací null", () => {
    const { peek } = store(PREV);
    const guard = newVisitGuard();
    const first = openVisit(guard, peek);
    const second = openVisit(guard, peek);
    expect(second).toBeNull();
    expect(peek).toHaveBeenCalledTimes(1);
    expect(first?.prev).toBe(PREV);
  });

  it("simulace dvojího volání updateru: naivní razítkující tvar okno zavře, openVisit ne", () => {
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
    const safe = store(PREV);
    const guard = newVisitGuard();
    const opened = openVisit(guard, safe.peek) ?? openVisit(guard, safe.peek);
    expect(safe.peek).toHaveBeenCalledTimes(1);
    expect(opened?.prev).toBe(PREV);
  });

  it("první návštěva nemá předchozí razítko", () => {
    const { peek } = store(null);
    expect(openVisit(newVisitGuard(), peek)?.prev).toBeNull();
  });
});

describe("commitVisit — razítko až nad ukázanými daty", () => {
  const RESPONSE = { deltas: [] };

  it("načítá se (undefined) ani chyba (null) nezapíše; odpověď zapíše jednou", () => {
    const { peek, commit, read } = store(PREV);
    const guard = newVisitGuard();
    const visit = openVisit(guard, peek);
    expect(commitVisit(guard, visit, undefined, false, commit)).toBe(false);
    expect(commitVisit(guard, visit, null, false, commit)).toBe(false);
    expect(read()).toBe(PREV);
    expect(commitVisit(guard, visit, RESPONSE, false, commit)).toBe(true);
    expect(commitVisit(guard, visit, RESPONSE, false, commit)).toBe(false);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(read()).toBe(NOW);
  });

  it("bez sledování není co načíst — návštěva se zapíše hned", () => {
    const { peek, commit, read } = store(PREV);
    const guard = newVisitGuard();
    expect(commitVisit(guard, openVisit(guard, peek), undefined, true, commit)).toBe(true);
    expect(read()).toBe(NOW);
  });

  it("bez otevřeného okna se nezapisuje", () => {
    const { commit } = store(PREV);
    expect(commitVisit(newVisitGuard(), null, RESPONSE, false, commit)).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  it("A/B: návštěva s chybou načtení mezi dvěma návštěvami — zápisy mezi nimi příště nezmizí", () => {
    // Minulá návštěva 1. 8., zápisy 2. a 3. 8., návštěva 4. 8. skončí chybou
    // načtení, další návštěva 6. 8. Kolik ze dvou mezilehlých zápisů ukáže?
    const between = [delta("poslanec:1", ["2026-08-03", "2026-08-02"])];
    const NEXT_DAY = "2026-08-06";

    // A — původní tvar: razítko zapsané už při otevření.
    const a = stamper(PREV);
    a.stamp();
    expect(countSeen(between, sinceDay(a.read(), NEXT_DAY))).toBe(0);

    // B — razítko až nad daty: chyba načtení nic nezapíše.
    const b = store(PREV);
    const guard = newVisitGuard();
    commitVisit(guard, openVisit(guard, b.peek), null, false, b.commit);
    expect(countSeen(between, sinceDay(b.read(), NEXT_DAY))).toBe(2);
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
