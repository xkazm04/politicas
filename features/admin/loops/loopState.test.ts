// Testy čisté derivace stavu smyček (6E) — fixture běhy, hraniční pásma
// čerstvosti (kadence × 2 = hranice „stalled“) a práh série selhání.

import { describe, expect, it } from "vitest";
import {
  deriveLoopState,
  parsePassLog,
  stalenessOf,
  ageDaysBetween,
  FAILURE_STREAK_THRESHOLD,
  type IngestRunIn,
  type LoopStateInputs,
} from "./loopState";

const NOW = "2026-07-30T12:00:00.000Z";

const run = (over: Partial<IngestRunIn>): IngestRunIn => ({
  source: "psp-hlasovani",
  startedAt: "2026-07-29T02:00:00.000Z",
  finishedAt: "2026-07-29T02:05:00.000Z",
  status: "ok",
  rowsWritten: 100,
  note: null,
  ...over,
});

const baseInputs = (over: Partial<LoopStateInputs>): LoopStateInputs => ({
  now: NOW,
  loopsPaused: true,
  caseLoops: [
    {
      id: "money",
      labelCs: "Peníze (FollowTheMoney)",
      batchesCompleted: 12,
      unitsProcessed: 211,
      unitsTotal: 211,
      openFrontier: 2,
    },
  ],
  casePasses: [],
  ingestRuns: [],
  ...over,
});

describe("parsePassLog", () => {
  it("čte pass hlavičky graph-log.md a řadí podle čísla passu", () => {
    const md = [
      "## Pass 41 (track: money) — batch 012: corpus (2026-07-27)",
      "text",
      "## Pass 42 (track: effort) — kontribuční index počítá TĚLESA (2026-07-29)",
      "## něco jiného",
    ].join("\n");
    const passes = parsePassLog(md);
    expect(passes).toEqual([
      { pass: 41, track: "money", title: "batch 012: corpus", date: "2026-07-27" },
      { pass: 42, track: "effort", title: "kontribuční index počítá TĚLESA", date: "2026-07-29" },
    ]);
  });

  it("na drift formátu odpoví prázdným polem, nikdy výjimkou", () => {
    expect(parsePassLog("# jiný soubor\nbez passů")).toEqual([]);
  });
});

describe("stalenessOf — sdílený slovník s 6D", () => {
  it("hraniční pásma: ≤ kadence čerstvé, ≤ 2× stárnoucí, > 2× zastaralé", () => {
    expect(stalenessOf(7, 7)).toBe("čerstvé"); // přesně kadence
    expect(stalenessOf(7.1, 7)).toBe("stárnoucí");
    expect(stalenessOf(14, 7)).toBe("stárnoucí"); // přesně 2× — JEŠTĚ ne stalled
    expect(stalenessOf(14.1, 7)).toBe("zastaralé"); // přes 2× — stalled
  });

  it("stáří v budoucnu se ohraničí nulou (posun hodin ≠ záporné stáří)", () => {
    expect(ageDaysBetween(NOW, "2026-08-01T00:00:00.000Z")).toBe(0);
  });
});

describe("deriveLoopState — case-smyčky", () => {
  it("pozastavená smyčka: status pozastaveno, poslední pass, nehodnocená čerstvost, žádná výstraha", () => {
    const { loops, alerts } = deriveLoopState(
      baseInputs({
        casePasses: [
          { pass: 36, track: "money", title: "batch 009", date: "2026-07-27" },
          { pass: 41, track: "money", title: "batch 012", date: "2026-07-27" },
        ],
      }),
    );
    const money = loops.find((l) => l.id === "case:money");
    expect(money).toBeDefined();
    expect(money?.status).toBe("pozastaveno");
    expect(money?.lastActivityAt).toBe("2026-07-27");
    expect(money?.lastActivityLabel).toBe("pass #41 — batch 012");
    expect(money?.staleness).toBeNull(); // nehodnoceno
    expect(money?.stalenessReason).toContain("pozastavena");
    expect(money?.lastDurationMs).toBeNull(); // žurnály trvání nenesou — nefabrikuje se
    expect(money?.durationNote).toContain("nezaznamenává");
    expect(money?.progress?.unitsTotal).toBe(211);
    expect(alerts).toEqual([]); // pozastavené smyčky „stalled“ nehlásí
  });

  it("vedlejší track z pass logu (sources) dostane vlastní smyčku bez postupu", () => {
    const { loops } = deriveLoopState(
      baseInputs({ casePasses: [{ pass: 30, track: "sources", title: "kiosek", date: "2026-07-25" }] }),
    );
    const sources = loops.find((l) => l.id === "case:sources");
    expect(sources?.labelCs).toContain("sources");
    expect(sources?.progress?.unitsTotal).toBeNull();
  });

  it("neběžela-li smyčka nikdy a není pozastavená, stav je neznámo", () => {
    const { loops } = deriveLoopState(baseInputs({ loopsPaused: false }));
    expect(loops.find((l) => l.id === "case:money")?.status).toBe("neznámo");
  });
});

describe("deriveLoopState — ingest smyčky", () => {
  it("úspěšný čerstvý běh: v pořádku, trvání, čerstvé, další očekávaná = konec + kadence", () => {
    const { loops, alerts } = deriveLoopState(baseInputs({ ingestRuns: [run({})] }));
    const ing = loops.find((l) => l.id === "ingest:psp-hlasovani");
    expect(ing?.status).toBe("v pořádku");
    expect(ing?.lastDurationMs).toBe(5 * 60 * 1000);
    expect(ing?.staleness).toBe("čerstvé");
    expect(ing?.cadenceDays).toBe(7);
    expect(ing?.nextExpectedAt).toBe("2026-08-05T02:05:00.000Z");
    expect(alerts).toEqual([]);
  });

  it("hranice stalled: stáří přesně 2× kadence JEŠTĚ nehlásí, těsně přes už ano", () => {
    // kadence 7 dní; NOW - 14 dní = 2026-07-16T12:00 → přesně 2×.
    const atBoundary = deriveLoopState(
      baseInputs({ ingestRuns: [run({ startedAt: "2026-07-16T11:00:00.000Z", finishedAt: "2026-07-16T12:00:00.000Z" })] }),
    );
    expect(atBoundary.loops[1]?.staleness).toBe("stárnoucí");
    expect(atBoundary.alerts).toEqual([]);

    const pastBoundary = deriveLoopState(
      baseInputs({ ingestRuns: [run({ startedAt: "2026-07-16T10:00:00.000Z", finishedAt: "2026-07-16T11:00:00.000Z" })] }),
    );
    const loop = pastBoundary.loops.find((l) => l.id === "ingest:psp-hlasovani");
    expect(loop?.staleness).toBe("zastaralé");
    expect(pastBoundary.alerts).toHaveLength(1);
    expect(pastBoundary.alerts[0].kind).toBe("stalled");
    expect(pastBoundary.alerts[0].loopId).toBe("ingest:psp-hlasovani");
    expect(pastBoundary.alerts[0].since).toBe("2026-07-16T11:00:00.000Z");
    expect(pastBoundary.alerts[0].messageCs).toContain("zastaralé");
  });

  it("zdroj bez deklarované kadence: čerstvost nehodnocena, nikdy stalled", () => {
    const old = run({
      source: "neznamy-zdroj",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:10:00.000Z",
    });
    const { loops, alerts } = deriveLoopState(baseInputs({ ingestRuns: [old] }));
    const ing = loops.find((l) => l.id === "ingest:neznamy-zdroj");
    expect(ing?.staleness).toBeNull();
    expect(ing?.stalenessReason).toContain("kadence");
    expect(ing?.ageDays).not.toBeNull(); // stáří se přizná, jen se neškatulkuje
    expect(alerts).toEqual([]);
  });

  it("série selhání: 1 selhání nehlásí, práh hlásí; úspěch sérii přeruší", () => {
    const failed = (start: string, note: string | null) =>
      run({ status: "failed", startedAt: start, finishedAt: start, note });

    const one = deriveLoopState(baseInputs({ ingestRuns: [failed("2026-07-29T10:00:00.000Z", "HTTP 500")] }));
    const oneLoop = one.loops.find((l) => l.id === "ingest:psp-hlasovani");
    expect(oneLoop?.status).toBe("selhává");
    expect(oneLoop?.failureStreak).toBe(1);
    expect(one.alerts).toEqual([]); // pod prahem

    const two = deriveLoopState(
      baseInputs({
        ingestRuns: [failed("2026-07-29T10:00:00.000Z", "HTTP 500"), failed("2026-07-28T10:00:00.000Z", null)],
      }),
    );
    const twoLoop = two.loops.find((l) => l.id === "ingest:psp-hlasovani");
    expect(twoLoop?.failureStreak).toBe(FAILURE_STREAK_THRESHOLD);
    expect(twoLoop?.lastFailureCause).toBe("HTTP 500");
    expect(two.alerts.map((a) => a.kind)).toEqual(["failure-streak"]);
    expect(two.alerts[0].messageCs).toContain("HTTP 500");

    const broken = deriveLoopState(
      baseInputs({
        ingestRuns: [
          failed("2026-07-29T10:00:00.000Z", "HTTP 500"),
          run({ startedAt: "2026-07-28T10:00:00.000Z", finishedAt: "2026-07-28T10:05:00.000Z" }),
          failed("2026-07-27T10:00:00.000Z", null),
        ],
      }),
    );
    expect(broken.loops.find((l) => l.id === "ingest:psp-hlasovani")?.failureStreak).toBe(1);
    expect(broken.alerts).toEqual([]);
  });

  it("rozběhnutý běh: status běží, sérii selhání nepřerušuje ani neprodlužuje", () => {
    const { loops } = deriveLoopState(
      baseInputs({
        ingestRuns: [
          run({ status: "running", startedAt: "2026-07-30T11:00:00.000Z", finishedAt: null }),
          run({ status: "failed", startedAt: "2026-07-29T10:00:00.000Z", note: "timeout" }),
          run({ status: "failed", startedAt: "2026-07-28T10:00:00.000Z" }),
        ],
      }),
    );
    const ing = loops.find((l) => l.id === "ingest:psp-hlasovani");
    expect(ing?.status).toBe("běží");
    expect(ing?.failureStreak).toBe(2);
  });

  it("determinismus: tytéž vstupy dají týž výsledek včetně otisků výstrah", () => {
    const inputs = baseInputs({
      ingestRuns: [run({ startedAt: "2026-07-01T00:00:00.000Z", finishedAt: "2026-07-01T00:10:00.000Z" })],
    });
    const a = deriveLoopState(inputs);
    const b = deriveLoopState(inputs);
    expect(a).toEqual(b);
    expect(a.alerts[0]?.id).toBe(b.alerts[0]?.id);
  });

  it("změna stavu mění otisk výstrahy (ack se váže na stav, ne na smyčku)", () => {
    const stale = (days: number) => {
      const finished = new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
      return deriveLoopState(baseInputs({ ingestRuns: [run({ startedAt: finished, finishedAt: finished })] }));
    };
    const a = stale(15);
    const b = stale(20);
    expect(a.alerts[0].id).not.toBe(b.alerts[0].id);
  });
});
